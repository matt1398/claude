/**
 * SubagentResolver service - Links Task calls to subagent files and detects parallelism.
 *
 * Responsibilities:
 * - Find subagent JSONL files in {sessionId}/subagents/ directory
 * - Parse each subagent file
 * - Calculate start/end times and metrics
 * - Detect parallel execution (100ms overlap threshold)
 * - Link subagents to parent Task tool calls
 */

import * as path from 'path';
import { Subagent, ParsedMessage, ToolCall, SessionMetrics } from '../types/claude';
import { parseJsonlFile, calculateMetrics } from '../utils/jsonl';
import { ProjectScanner } from './ProjectScanner';

/** Parallel detection window in milliseconds */
const PARALLEL_WINDOW_MS = 100;

export class SubagentResolver {
  private projectScanner: ProjectScanner;

  constructor(projectScanner: ProjectScanner) {
    this.projectScanner = projectScanner;
  }

  // ===========================================================================
  // Main Resolution
  // ===========================================================================

  /**
   * Resolve all subagents for a session.
   */
  async resolveSubagents(
    projectId: string,
    sessionId: string,
    taskCalls: ToolCall[]
  ): Promise<Subagent[]> {
    // Get subagent files
    const subagentFiles = await this.projectScanner.listSubagentFiles(projectId, sessionId);

    if (subagentFiles.length === 0) {
      return [];
    }

    // Parse all subagent files
    const subagents = await Promise.all(
      subagentFiles.map((filePath) => this.parseSubagentFile(filePath))
    );

    // Filter out failed parses
    const validSubagents = subagents.filter((s): s is Subagent => s !== null);

    // Link to Task calls
    this.linkToTaskCalls(validSubagents, taskCalls);

    // Detect parallel execution
    this.detectParallelExecution(validSubagents);

    // Sort by start time
    validSubagents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return validSubagents;
  }

  // ===========================================================================
  // Subagent Parsing
  // ===========================================================================

  /**
   * Parse a single subagent file.
   */
  private async parseSubagentFile(filePath: string): Promise<Subagent | null> {
    try {
      const messages = await parseJsonlFile(filePath);

      if (messages.length === 0) {
        return null;
      }

      // Extract agent ID from filename (agent-{id}.jsonl)
      const filename = path.basename(filePath);
      const agentId = filename.replace(/^agent-/, '').replace(/\.jsonl$/, '');

      // Extract subagent type from first message if available
      const firstMessage = messages[0];
      let subagentType: string | undefined;

      if (firstMessage?.type === 'user' && typeof firstMessage.content === 'string') {
        // Try to extract subagent type from the prompt
        // Common patterns: "You are an X agent", "As an X agent", etc.
        const match = firstMessage.content.match(/you are (?:an? )?(\w+) agent/i);
        if (match) {
          subagentType = match[1];
        }
      }

      // Calculate timing
      const { startTime, endTime, durationMs } = this.calculateTiming(messages);

      // Calculate metrics
      const metrics = calculateMetrics(messages);

      return {
        id: agentId,
        filePath,
        messages,
        startTime,
        endTime,
        durationMs,
        metrics,
        subagentType,
        isParallel: false, // Will be set by detectParallelExecution
      };
    } catch (error) {
      console.error(`Error parsing subagent file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Calculate timing from messages.
   */
  private calculateTiming(messages: ParsedMessage[]): {
    startTime: Date;
    endTime: Date;
    durationMs: number;
  } {
    const timestamps = messages.map((m) => m.timestamp.getTime()).filter((t) => !isNaN(t));

    if (timestamps.length === 0) {
      const now = new Date();
      return { startTime: now, endTime: now, durationMs: 0 };
    }

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      startTime: new Date(minTime),
      endTime: new Date(maxTime),
      durationMs: maxTime - minTime,
    };
  }

  // ===========================================================================
  // Task Call Linking
  // ===========================================================================

  /**
   * Link subagents to their parent Task tool calls.
   * Uses sourceToolUseID for accurate matching, with fallback heuristics.
   */
  private linkToTaskCalls(subagents: Subagent[], taskCalls: ToolCall[]): void {
    const unlinkedTasks = [...taskCalls];

    for (const subagent of subagents) {
      // PRIORITY 1: Match by sourceToolUseID (most accurate)
      // The first message in a subagent should have sourceToolUseID pointing to the Task call
      const firstMessage = subagent.messages[0];
      if (firstMessage?.sourceToolUseID) {
        const matchById = unlinkedTasks.find(
          (tc) => tc.isTask && tc.id === firstMessage.sourceToolUseID
        );

        if (matchById) {
          this.applyTaskCallToSubagent(subagent, matchById);
          unlinkedTasks.splice(unlinkedTasks.indexOf(matchById), 1);
          continue;
        }
      }

      // PRIORITY 2: Match by subagent type from Task input (fallback)
      const matchByType = unlinkedTasks.find(
        (tc) =>
          tc.isTask &&
          tc.taskSubagentType &&
          tc.taskSubagentType.toLowerCase() === subagent.subagentType?.toLowerCase()
      );

      if (matchByType) {
        this.applyTaskCallToSubagent(subagent, matchByType);
        unlinkedTasks.splice(unlinkedTasks.indexOf(matchByType), 1);
        continue;
      }

      // PRIORITY 3: Match by description similarity (fallback)
      const matchByDescription = this.findBestDescriptionMatch(subagent, unlinkedTasks);
      if (matchByDescription) {
        this.applyTaskCallToSubagent(subagent, matchByDescription);
        unlinkedTasks.splice(unlinkedTasks.indexOf(matchByDescription), 1);
      }
    }

    // PRIORITY 4: If there are still unlinked subagents and tasks, match by order (last resort)
    const unlinkedSubagents = subagents.filter((s) => !s.parentTaskId);
    for (let i = 0; i < Math.min(unlinkedSubagents.length, unlinkedTasks.length); i++) {
      if (unlinkedTasks[i].isTask) {
        this.applyTaskCallToSubagent(unlinkedSubagents[i], unlinkedTasks[i]);
      }
    }
  }

  /**
   * Apply Task call info to a subagent.
   */
  private applyTaskCallToSubagent(subagent: Subagent, taskCall: ToolCall): void {
    subagent.parentTaskId = taskCall.id;
    subagent.description = taskCall.taskDescription || subagent.description;
    subagent.subagentType = taskCall.taskSubagentType || subagent.subagentType;
  }

  /**
   * Find the best matching Task call by description.
   */
  private findBestDescriptionMatch(subagent: Subagent, taskCalls: ToolCall[]): ToolCall | null {
    // If subagent has no identifying info, skip
    if (!subagent.description && !subagent.subagentType) {
      return null;
    }

    // Try to match based on first user message in subagent
    const firstUserMsg = subagent.messages.find((m) => m.type === 'user');
    if (!firstUserMsg) return null;

    const subagentPrompt = this.getTextContent(firstUserMsg);
    if (!subagentPrompt) return null;

    // Find Task call with matching description
    for (const task of taskCalls) {
      if (!task.isTask) continue;

      const taskDesc = task.taskDescription || '';
      const taskPrompt = (task.input.prompt as string) || '';

      // Check if the subagent prompt contains the task description/prompt
      if (
        (taskDesc && subagentPrompt.includes(taskDesc)) ||
        (taskPrompt && subagentPrompt.includes(taskPrompt))
      ) {
        return task;
      }
    }

    return null;
  }

  /**
   * Get text content from a message.
   */
  private getTextContent(message: ParsedMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    return message.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text!)
      .join('\n');
  }

  // ===========================================================================
  // Parallel Detection
  // ===========================================================================

  /**
   * Detect parallel execution among subagents.
   * Subagents with start times within PARALLEL_WINDOW_MS are marked as parallel.
   */
  private detectParallelExecution(subagents: Subagent[]): void {
    if (subagents.length < 2) return;

    // Sort by start time
    const sorted = [...subagents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Group by start time buckets
    const groups: Subagent[][] = [];
    let currentGroup: Subagent[] = [];
    let groupStartTime = 0;

    for (const agent of sorted) {
      const startMs = agent.startTime.getTime();

      if (currentGroup.length === 0) {
        // Start new group
        currentGroup.push(agent);
        groupStartTime = startMs;
      } else if (startMs - groupStartTime <= PARALLEL_WINDOW_MS) {
        // Add to current group
        currentGroup.push(agent);
      } else {
        // Finalize current group and start new one
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [agent];
        groupStartTime = startMs;
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Mark agents in groups with multiple members as parallel
    for (const group of groups) {
      if (group.length > 1) {
        for (const agent of group) {
          agent.isParallel = true;
        }
      }
    }
  }

  // ===========================================================================
  // Chunk Linking
  // ===========================================================================

  /**
   * Link subagents to chunks based on timing.
   * A subagent belongs to the chunk whose time range contains its start time.
   */
  linkSubagentsToChunks(
    chunks: Array<{ startTime: Date; endTime: Date; subagents: Subagent[] }>,
    subagents: Subagent[]
  ): void {
    for (const subagent of subagents) {
      // Find the chunk that contains this subagent's start time
      for (const chunk of chunks) {
        if (subagent.startTime >= chunk.startTime && subagent.startTime <= chunk.endTime) {
          chunk.subagents.push(subagent);
          break;
        }
      }
    }

    // Sort subagents within each chunk
    for (const chunk of chunks) {
      chunk.subagents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
  }

  /**
   * Link subagents to chunks using Task call timestamps.
   * More accurate than timing-based linking.
   */
  linkSubagentsToChunksViaTaskCalls(
    chunks: Array<{
      startTime: Date;
      endTime: Date;
      subagents: Subagent[];
      responses: ParsedMessage[];
    }>,
    subagents: Subagent[]
  ): void {
    for (const chunk of chunks) {
      // Get Task calls from this chunk's responses
      const chunkTaskIds = new Set<string>();
      for (const response of chunk.responses) {
        for (const tc of response.toolCalls) {
          if (tc.isTask) {
            chunkTaskIds.add(tc.id);
          }
        }
      }

      // Find subagents linked to these Task calls
      for (const subagent of subagents) {
        if (subagent.parentTaskId && chunkTaskIds.has(subagent.parentTaskId)) {
          chunk.subagents.push(subagent);
        }
      }

      // Sort by start time
      chunk.subagents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get subagent by ID.
   */
  findSubagentById(subagents: Subagent[], id: string): Subagent | undefined {
    return subagents.find((s) => s.id === id);
  }

  /**
   * Get parallel subagent groups.
   */
  getParallelGroups(subagents: Subagent[]): Subagent[][] {
    const parallelAgents = subagents.filter((s) => s.isParallel);
    if (parallelAgents.length === 0) return [];

    // Group by start time
    const sorted = [...parallelAgents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const groups: Subagent[][] = [];
    let currentGroup: Subagent[] = [];
    let groupStartTime = 0;

    for (const agent of sorted) {
      const startMs = agent.startTime.getTime();

      if (currentGroup.length === 0) {
        currentGroup.push(agent);
        groupStartTime = startMs;
      } else if (startMs - groupStartTime <= PARALLEL_WINDOW_MS) {
        currentGroup.push(agent);
      } else {
        groups.push(currentGroup);
        currentGroup = [agent];
        groupStartTime = startMs;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.filter((g) => g.length > 1);
  }

  /**
   * Calculate total metrics for all subagents.
   */
  getTotalSubagentMetrics(subagents: Subagent[]): SessionMetrics {
    if (subagents.length === 0) {
      return {
        durationMs: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        messageCount: 0,
      };
    }

    let totalDuration = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let messageCount = 0;

    for (const agent of subagents) {
      totalDuration += agent.durationMs;
      inputTokens += agent.metrics.inputTokens;
      outputTokens += agent.metrics.outputTokens;
      cacheReadTokens += agent.metrics.cacheReadTokens;
      cacheCreationTokens += agent.metrics.cacheCreationTokens;
      messageCount += agent.metrics.messageCount;
    }

    return {
      durationMs: totalDuration,
      totalTokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      messageCount,
    };
  }
}
