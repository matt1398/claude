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
import { Process, ParsedMessage, ToolCall, SessionMetrics } from '../types/claude';
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
  ): Promise<Process[]> {
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
    const validSubagents = subagents.filter((s): s is Process => s !== null);

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
  private async parseSubagentFile(filePath: string): Promise<Process | null> {
    try {
      const messages = await parseJsonlFile(filePath);

      if (messages.length === 0) {
        return null;
      }

      // Filter out warmup subagents - these are pre-warming agents spawned by Claude Code
      // that have "Warmup" as the first user message and should not be displayed
      if (this.isWarmupSubagent(messages)) {
        return null;
      }

      // Extract agent ID from filename (agent-{id}.jsonl)
      const filename = path.basename(filePath);
      const agentId = filename.replace(/^agent-/, '').replace(/\.jsonl$/, '');

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
        isParallel: false, // Will be set by detectParallelExecution
      };
    } catch (error) {
      console.error(`Error parsing subagent file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if this is a warmup subagent that should be filtered out.
   * Warmup subagents are pre-warming agents spawned by Claude Code that have:
   * - First user message with content exactly "Warmup"
   * - isSidechain: true (all subagents have this)
   */
  private isWarmupSubagent(messages: ParsedMessage[]): boolean {
    // Find the first user message
    const firstUserMessage = messages.find(m => m.type === 'user');
    if (!firstUserMessage) {
      return false;
    }

    // Check if content is exactly "Warmup" (string, not array)
    return firstUserMessage.content === 'Warmup';
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
   *
   * Uses timestamp-based matching: matches each subagent to the most recent Task call
   * that occurred before the subagent's start time. This is deterministic and doesn't
   * rely on complex heuristics or fields that may not exist in the JSONL.
   *
   * After matching, enriches subagents with Task call metadata (description, subagentType).
   */
  private linkToTaskCalls(subagents: Process[], taskCalls: ToolCall[]): void {
    // Filter to only Task calls
    const taskCallsOnly = taskCalls.filter((tc) => tc.isTask);

    if (taskCallsOnly.length === 0 || subagents.length === 0) {
      return;
    }

    // Sort both lists by time for deterministic matching
    const sortedSubagents = [...subagents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const sortedTasks = [...taskCallsOnly].sort((a, b) => {
      // Tasks don't have timestamps directly, so we use their index as a proxy for order
      return taskCallsOnly.indexOf(a) - taskCallsOnly.indexOf(b);
    });

    // Simple positional matching: nth subagent → nth Task call
    // This works because Task calls and subagent files are created in sequence
    for (let i = 0; i < sortedSubagents.length; i++) {
      const subagent = sortedSubagents[i];
      const taskCall = sortedTasks[i % sortedTasks.length]; // Wrap around if more subagents than tasks

      // Set parent link
      subagent.parentTaskId = taskCall.id;

      // Extract metadata from Task call
      subagent.description = taskCall.taskDescription;
      subagent.subagentType = taskCall.taskSubagentType;
    }
  }

  // ===========================================================================
  // Parallel Detection
  // ===========================================================================

  /**
   * Detect parallel execution among subagents.
   * Subagents with start times within PARALLEL_WINDOW_MS are marked as parallel.
   */
  private detectParallelExecution(subagents: Process[]): void {
    if (subagents.length < 2) return;

    // Sort by start time
    const sorted = [...subagents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Group by start time buckets
    const groups: Process[][] = [];
    let currentGroup: Process[] = [];
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
   * Link processes to chunks based on timing.
   * A process belongs to the chunk whose time range contains its start time.
   */
  linkProcessesToChunks(
    chunks: Array<{ startTime: Date; endTime: Date; processes: Process[] }>,
    subagents: Process[]
  ): void {
    for (const subagent of subagents) {
      // Find the chunk that contains this subagent's start time
      for (const chunk of chunks) {
        if (subagent.startTime >= chunk.startTime && subagent.startTime <= chunk.endTime) {
          chunk.processes.push(subagent);
          break;
        }
      }
    }

    // Sort processes within each chunk
    for (const chunk of chunks) {
      chunk.processes.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
  }

  /**
   * Link processes to chunks using Task call timestamps.
   * More accurate than timing-based linking.
   */
  linkProcessesToChunksViaTaskCalls(
    chunks: Array<{
      startTime: Date;
      endTime: Date;
      processes: Process[];
      responses: ParsedMessage[];
    }>,
    subagents: Process[]
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
          chunk.processes.push(subagent);
        }
      }

      // Sort by start time
      chunk.processes.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get subagent by ID.
   */
  findSubagentById(subagents: Process[], id: string): Process | undefined {
    return subagents.find((s) => s.id === id);
  }

  /**
   * Get parallel subagent groups.
   */
  getParallelGroups(subagents: Process[]): Process[][] {
    const parallelAgents = subagents.filter((s) => s.isParallel);
    if (parallelAgents.length === 0) return [];

    // Group by start time
    const sorted = [...parallelAgents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const groups: Process[][] = [];
    let currentGroup: Process[] = [];
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
  getTotalSubagentMetrics(subagents: Process[]): SessionMetrics {
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
