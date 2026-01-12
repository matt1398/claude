/**
 * SubagentResolver service - Links Task calls to subagent files and detects parallelism.
 *
 * Responsibilities:
 * - Find subagent JSONL files in {sessionId}/subagents/ directory
 * - Parse each subagent file
 * - Calculate start/end times and token usage
 * - Detect parallel execution by analyzing timestamps
 * - Link subagents to their parent chunks
 */

import * as fs from 'fs';
import * as path from 'path';
import { ResolvedSubagent, Message, TokenUsage, Chunk, SessionDetail } from '../../renderer/types/data';
import { parseJsonlFile } from '../utils/jsonl';
import { ProjectScanner } from './ProjectScanner';
import { SessionParser } from './SessionParser';

export class SubagentResolver {
  private projectScanner: ProjectScanner;
  private sessionParser: SessionParser;

  constructor(projectScanner: ProjectScanner, sessionParser: SessionParser) {
    this.projectScanner = projectScanner;
    this.sessionParser = sessionParser;
  }

  /**
   * Resolves subagents for a session detail, linking them to chunks.
   * @param sessionDetail - The session detail to resolve subagents for
   * @param projectId - The encoded project directory name
   * @returns Promise that resolves to the updated SessionDetail with subagents
   */
  async resolveSubagents(sessionDetail: SessionDetail, projectId: string): Promise<SessionDetail> {
    const sessionId = sessionDetail.session.id;
    const subagentsPath = this.projectScanner.getSubagentsPath(projectId, sessionId);

    // Check if subagents directory exists
    if (!fs.existsSync(subagentsPath)) {
      return sessionDetail;
    }

    try {
      // List all subagent files
      const entries = fs.readdirSync(subagentsPath, { withFileTypes: true });
      const subagentFiles = entries
        .filter(entry => entry.isFile() && entry.name.startsWith('agent-') && entry.name.endsWith('.jsonl'))
        .map(entry => path.join(subagentsPath, entry.name));

      // Parse all subagent files in parallel
      const subagents = await Promise.all(
        subagentFiles.map(filePath => this.parseSubagent(filePath))
      );

      // Filter out any failed parses
      const validSubagents = subagents.filter((s): s is ResolvedSubagent => s !== null);

      // Detect parallel execution
      this.detectParallelExecution(validSubagents);

      // Link subagents to chunks
      this.linkSubagentsToChunks(sessionDetail.chunks, validSubagents);

      return sessionDetail;
    } catch (error) {
      console.error(`Error resolving subagents for session ${sessionId}:`, error);
      return sessionDetail;
    }
  }

  /**
   * Parses a single subagent file.
   * @param filePath - Path to the subagent JSONL file
   * @returns Promise that resolves to a ResolvedSubagent, or null if parsing fails
   */
  private async parseSubagent(filePath: string): Promise<ResolvedSubagent | null> {
    try {
      const agentId = path.basename(filePath, '.jsonl');
      const messages = await parseJsonlFile(filePath);

      if (messages.length === 0) {
        return null;
      }

      // Calculate start and end times
      const timestamps = messages.map(m => new Date(m.timestamp).getTime());
      const startTime = new Date(Math.min(...timestamps)).toISOString();
      const endTime = new Date(Math.max(...timestamps)).toISOString();
      const duration = Math.max(...timestamps) - Math.min(...timestamps);

      // Calculate token usage
      const tokenUsage = this.calculateTokenUsage(messages);

      // Try to extract type from messages
      const type = this.extractSubagentType(messages);

      return {
        agentId,
        messages,
        startTime,
        endTime,
        duration,
        tokenUsage,
        type,
      };
    } catch (error) {
      console.error(`Error parsing subagent file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Calculates total token usage for a subagent.
   * @param messages - Messages in the subagent
   * @returns TokenUsage object
   */
  private calculateTokenUsage(messages: Message[]): TokenUsage {
    let inputTokens = 0;
    let cacheReadTokens = 0;
    let outputTokens = 0;

    for (const msg of messages) {
      if (msg.message?.usage) {
        inputTokens += msg.message.usage.input_tokens || 0;
        cacheReadTokens += msg.message.usage.cache_read_input_tokens || 0;
        outputTokens += msg.message.usage.output_tokens || 0;
      }
    }

    return {
      input_tokens: inputTokens,
      cache_read_input_tokens: cacheReadTokens,
      output_tokens: outputTokens,
    };
  }

  /**
   * Extracts subagent type from messages.
   * @param messages - Messages in the subagent
   * @returns The subagent type (e.g., "explore", "plan"), or undefined
   */
  private extractSubagentType(messages: Message[]): string | undefined {
    // Try to find type in first user or system message
    for (const msg of messages) {
      if (msg.type === 'system' || msg.type === 'user') {
        const text = this.extractMessageText(msg);

        // Look for common patterns
        if (text.toLowerCase().includes('explore')) return 'explore';
        if (text.toLowerCase().includes('plan')) return 'plan';
        if (text.toLowerCase().includes('implement')) return 'implement';
        if (text.toLowerCase().includes('review')) return 'review';
      }
    }

    return undefined;
  }

  /**
   * Extracts text content from a message.
   * @param message - The message to extract text from
   * @returns Extracted text
   */
  private extractMessageText(message: Message): string {
    if (!message.message) {
      return '';
    }

    const content = message.message.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const part of content) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text);
        }
      }
      return textParts.join('\n');
    }

    return '';
  }

  /**
   * Detects parallel execution among subagents.
   * Marks subagents as parallel if they have overlapping time ranges
   * and were invoked at approximately the same time.
   * @param subagents - Array of resolved subagents
   */
  private detectParallelExecution(subagents: ResolvedSubagent[]): void {
    // Group subagents by start time (within 500ms window)
    const groups = new Map<number, ResolvedSubagent[]>();

    for (const agent of subagents) {
      const startMs = new Date(agent.startTime).getTime();
      const groupKey = Math.floor(startMs / 500) * 500; // Round to 500ms bucket

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(agent);
    }

    // Mark agents in groups with multiple members as parallel
    for (const group of groups.values()) {
      if (group.length > 1) {
        for (const agent of group) {
          agent.isParallel = true;
        }
      }
    }
  }

  /**
   * Links subagents to their parent chunks based on timing.
   * A subagent belongs to a chunk if it starts within that chunk's time range.
   * @param chunks - Array of chunks
   * @param subagents - Array of resolved subagents
   */
  private linkSubagentsToChunks(chunks: Chunk[], subagents: ResolvedSubagent[]): void {
    for (const subagent of subagents) {
      const subagentStartTime = new Date(subagent.startTime);

      // Find the chunk that this subagent belongs to
      for (const chunk of chunks) {
        // Check if subagent starts within chunk's time range
        if (
          subagentStartTime >= chunk.startTime &&
          subagentStartTime <= chunk.endTime
        ) {
          chunk.subagents.push(subagent);
          break; // Each subagent belongs to only one chunk
        }
      }
    }

    // Sort subagents within each chunk by start time
    for (const chunk of chunks) {
      chunk.subagents.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }
  }

  /**
   * Links subagents to Task tool calls in assistant messages.
   * Updates subagent descriptions based on Task inputs.
   * @param chunks - Array of chunks
   */
  linkTaskCallsToSubagents(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      // Extract all Task calls from assistant responses in this chunk
      const taskCalls: Array<{ id: string; type?: string; description?: string; timestamp: Date }> = [];

      for (const response of chunk.responses) {
        if (response.type === 'assistant') {
          const calls = this.sessionParser.extractTaskCalls(response);
          for (const call of calls) {
            taskCalls.push({
              ...call,
              timestamp: new Date(response.timestamp),
            });
          }
        }
      }

      // Try to match subagents to Task calls by timing
      // Assumption: subagent starts shortly after Task call
      for (const subagent of chunk.subagents) {
        const subagentStart = new Date(subagent.startTime);

        // Find the closest Task call that came before this subagent
        let closestCall: typeof taskCalls[0] | null = null;
        let minTimeDiff = Infinity;

        for (const call of taskCalls) {
          if (call.timestamp <= subagentStart) {
            const timeDiff = subagentStart.getTime() - call.timestamp.getTime();
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestCall = call;
            }
          }
        }

        // If we found a Task call within 5 seconds, link it
        if (closestCall && minTimeDiff < 5000) {
          subagent.description = closestCall.description;
          if (closestCall.type && !subagent.type) {
            subagent.type = closestCall.type;
          }
        }
      }
    }
  }
}
