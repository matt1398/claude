/**
 * ChunkBuilder service - Builds visualization chunks from parsed session data.
 *
 * Responsibilities:
 * - Group messages into chunks (user message + responses)
 * - Attach subagents to chunks
 * - Build waterfall chart data
 * - Calculate chunk metrics
 */

import {
  Chunk,
  ParsedMessage,
  Subagent,
  SessionMetrics,
  ToolExecution,
  WaterfallItem,
  WaterfallData,
  Session,
  SessionDetail,
  EMPTY_METRICS,
  isRealUserMessage,
  isInternalUserMessage,
  isAssistantMessage,
} from '../types/claude';
import { calculateMetrics } from '../utils/jsonl';

let chunkIdCounter = 0;

/**
 * Generate a unique chunk ID.
 */
function generateChunkId(): string {
  return `chunk-${++chunkIdCounter}`;
}

export class ChunkBuilder {
  // ===========================================================================
  // Chunk Building
  // ===========================================================================

  /**
   * Build chunks from messages.
   * A chunk consists of one user message and all subsequent responses until the next user message.
   */
  buildChunks(messages: ParsedMessage[], subagents: Subagent[] = []): Chunk[] {
    const chunks: Chunk[] = [];

    // Filter to main thread messages (non-sidechain)
    const mainMessages = messages.filter((m) => !m.isSidechain);

    // Find all real user messages (these start chunks)
    // Use isRealUserMessage to exclude internal user messages (tool results)
    const userMessages = mainMessages.filter(isRealUserMessage);

    for (let i = 0; i < userMessages.length; i++) {
      const userMsg = userMessages[i];
      const nextUserMsg = userMessages[i + 1];

      // Collect responses until next user message
      const responses = this.collectResponses(mainMessages, userMsg, nextUserMsg);

      // Collect sidechain messages for this time range
      const sidechainMessages = this.collectSidechainMessages(
        messages,
        userMsg.timestamp,
        nextUserMsg?.timestamp
      );

      // Calculate timing
      const { startTime, endTime, durationMs } = this.calculateChunkTiming(userMsg, responses);

      // Calculate metrics
      const metrics = calculateMetrics([userMsg, ...responses]);

      // Build tool executions
      const toolExecutions = this.buildToolExecutions([userMsg, ...responses]);

      const chunk: Chunk = {
        id: generateChunkId(),
        userMessage: userMsg,
        responses,
        startTime,
        endTime,
        durationMs,
        metrics,
        subagents: [], // Will be filled by linkSubagents
        sidechainMessages,
        toolExecutions,
      };

      chunks.push(chunk);
    }

    // Link subagents to chunks
    this.linkSubagentsToChunks(chunks, subagents);

    return chunks;
  }

  /**
   * Collect responses for a user message.
   */
  private collectResponses(
    messages: ParsedMessage[],
    userMsg: ParsedMessage,
    nextUserMsg: ParsedMessage | undefined
  ): ParsedMessage[] {
    const responses: ParsedMessage[] = [];
    const startTime = userMsg.timestamp;
    const endTime = nextUserMsg?.timestamp;

    for (const msg of messages) {
      // Skip if before this user message
      if (msg.timestamp < startTime) continue;

      // Skip if at or after next user message
      if (endTime && msg.timestamp >= endTime) continue;

      // Skip the user message itself
      if (msg.uuid === userMsg.uuid) continue;

      // Include assistant responses and internal user messages (tool results)
      // This ensures tool results are part of the response, not a new chunk
      if (isAssistantMessage(msg) || isInternalUserMessage(msg)) {
        responses.push(msg);
      }
    }

    return responses;
  }

  /**
   * Collect sidechain messages in a time range.
   */
  private collectSidechainMessages(
    messages: ParsedMessage[],
    startTime: Date,
    endTime: Date | undefined
  ): ParsedMessage[] {
    return messages.filter((m) => {
      if (!m.isSidechain) return false;
      if (m.timestamp < startTime) return false;
      if (endTime && m.timestamp >= endTime) return false;
      return true;
    });
  }

  /**
   * Calculate chunk timing from user message and responses.
   */
  private calculateChunkTiming(
    userMsg: ParsedMessage,
    responses: ParsedMessage[]
  ): { startTime: Date; endTime: Date; durationMs: number } {
    const startTime = userMsg.timestamp;

    let endTime = startTime;
    for (const resp of responses) {
      if (resp.timestamp > endTime) {
        endTime = resp.timestamp;
      }
    }

    return {
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
    };
  }

  /**
   * Build tool execution tracking from messages.
   * Enhanced to use sourceToolUseID for more accurate matching.
   */
  private buildToolExecutions(messages: ParsedMessage[]): ToolExecution[] {
    const executions: ToolExecution[] = [];
    const toolCallMap = new Map<
      string,
      { call: import('../types/claude').ToolCall; startTime: Date }
    >();

    // First pass: collect all tool calls
    for (const msg of messages) {
      for (const toolCall of msg.toolCalls) {
        toolCallMap.set(toolCall.id, {
          call: toolCall,
          startTime: msg.timestamp,
        });
      }
    }

    // Second pass: match with results and build executions
    // Try sourceToolUseID first (most accurate), then fall back to toolResults array
    for (const msg of messages) {
      // Check if this message has a sourceToolUseID (internal user messages)
      if (msg.sourceToolUseID) {
        const callInfo = toolCallMap.get(msg.sourceToolUseID);
        if (callInfo && msg.toolResults.length > 0) {
          // Use the first tool result for this internal user message
          const result = msg.toolResults[0];
          executions.push({
            toolCall: callInfo.call,
            result,
            startTime: callInfo.startTime,
            endTime: msg.timestamp,
            durationMs: msg.timestamp.getTime() - callInfo.startTime.getTime(),
          });
        }
      }

      // Also check toolResults array for any results not matched above
      for (const result of msg.toolResults) {
        // Skip if already matched via sourceToolUseID
        const alreadyMatched = executions.some(
          (e) => e.result?.toolUseId === result.toolUseId
        );
        if (alreadyMatched) continue;

        const callInfo = toolCallMap.get(result.toolUseId);
        if (callInfo) {
          executions.push({
            toolCall: callInfo.call,
            result,
            startTime: callInfo.startTime,
            endTime: msg.timestamp,
            durationMs: msg.timestamp.getTime() - callInfo.startTime.getTime(),
          });
        }
      }
    }

    // Add calls without results
    for (const [id, callInfo] of toolCallMap) {
      const hasResult = executions.some((e) => e.toolCall.id === id);
      if (!hasResult) {
        executions.push({
          toolCall: callInfo.call,
          startTime: callInfo.startTime,
        });
      }
    }

    // Sort by start time
    executions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return executions;
  }

  /**
   * Link subagents to chunks based on timing.
   */
  private linkSubagentsToChunks(chunks: Chunk[], subagents: Subagent[]): void {
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

  // ===========================================================================
  // Session Detail Building
  // ===========================================================================

  /**
   * Build a complete SessionDetail from parsed data.
   */
  buildSessionDetail(
    session: Session,
    messages: ParsedMessage[],
    subagents: Subagent[]
  ): SessionDetail {
    // Build chunks
    const chunks = this.buildChunks(messages, subagents);

    // Calculate overall metrics
    const metrics = calculateMetrics(messages);

    return {
      session,
      messages,
      chunks,
      subagents,
      metrics,
    };
  }

  // ===========================================================================
  // Waterfall Chart Data
  // ===========================================================================

  /**
   * Build waterfall chart data from chunks.
   */
  buildWaterfallData(chunks: Chunk[]): WaterfallData {
    if (chunks.length === 0) {
      const now = new Date();
      return {
        items: [],
        minTime: now,
        maxTime: now,
        totalDurationMs: 0,
      };
    }

    const items: WaterfallItem[] = [];
    let itemIdCounter = 0;

    // Find overall time range
    const allTimes: number[] = [];
    for (const chunk of chunks) {
      allTimes.push(chunk.startTime.getTime(), chunk.endTime.getTime());
      for (const sub of chunk.subagents) {
        allTimes.push(sub.startTime.getTime(), sub.endTime.getTime());
      }
    }

    const minTime = new Date(Math.min(...allTimes));
    const maxTime = new Date(Math.max(...allTimes));
    const totalDurationMs = maxTime.getTime() - minTime.getTime();

    // Build items for each chunk
    for (const chunk of chunks) {
      const chunkItemId = `item-${++itemIdCounter}`;

      // Main chunk item
      items.push({
        id: chunkItemId,
        label: this.getChunkLabel(chunk),
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        durationMs: chunk.durationMs,
        tokenUsage: {
          input_tokens: chunk.metrics.inputTokens,
          output_tokens: chunk.metrics.outputTokens,
          cache_read_input_tokens: chunk.metrics.cacheReadTokens,
          cache_creation_input_tokens: chunk.metrics.cacheCreationTokens,
        },
        level: 0,
        type: 'chunk',
        isParallel: false,
      });

      // Subagent items
      for (const subagent of chunk.subagents) {
        items.push({
          id: `item-${++itemIdCounter}`,
          label: subagent.description || subagent.subagentType || subagent.id,
          startTime: subagent.startTime,
          endTime: subagent.endTime,
          durationMs: subagent.durationMs,
          tokenUsage: {
            input_tokens: subagent.metrics.inputTokens,
            output_tokens: subagent.metrics.outputTokens,
            cache_read_input_tokens: subagent.metrics.cacheReadTokens,
            cache_creation_input_tokens: subagent.metrics.cacheCreationTokens,
          },
          level: 1,
          type: 'subagent',
          isParallel: subagent.isParallel,
          parentId: chunkItemId,
          metadata: {
            subagentType: subagent.subagentType,
            messageCount: subagent.metrics.messageCount,
          },
        });
      }

      // Tool execution items (optional, level 2)
      for (const toolExec of chunk.toolExecutions) {
        if (toolExec.durationMs && toolExec.durationMs > 100) {
          // Only show significant tool executions
          items.push({
            id: `item-${++itemIdCounter}`,
            label: toolExec.toolCall.name,
            startTime: toolExec.startTime,
            endTime: toolExec.endTime!,
            durationMs: toolExec.durationMs,
            tokenUsage: {
              input_tokens: 0,
              output_tokens: 0,
            },
            level: 2,
            type: 'tool',
            isParallel: false,
            parentId: chunkItemId,
            metadata: {
              toolName: toolExec.toolCall.name,
            },
          });
        }
      }
    }

    return {
      items,
      minTime,
      maxTime,
      totalDurationMs,
    };
  }

  /**
   * Get a display label for a chunk.
   */
  private getChunkLabel(chunk: Chunk): string {
    // Get first line of user message
    let text = '';
    if (typeof chunk.userMessage.content === 'string') {
      text = chunk.userMessage.content;
    } else {
      const textBlock = chunk.userMessage.content.find((b) => b.type === 'text' && b.text);
      text = textBlock?.text || '';
    }

    // Truncate to 50 chars
    if (text.length > 50) {
      return text.substring(0, 50) + '...';
    }
    return text || `Chunk ${chunk.id}`;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get total metrics for all chunks.
   */
  getTotalChunkMetrics(chunks: Chunk[]): SessionMetrics {
    if (chunks.length === 0) {
      return { ...EMPTY_METRICS };
    }

    let durationMs = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let messageCount = 0;

    for (const chunk of chunks) {
      durationMs += chunk.durationMs;
      inputTokens += chunk.metrics.inputTokens;
      outputTokens += chunk.metrics.outputTokens;
      cacheReadTokens += chunk.metrics.cacheReadTokens;
      cacheCreationTokens += chunk.metrics.cacheCreationTokens;
      messageCount += chunk.metrics.messageCount;
    }

    return {
      durationMs,
      totalTokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      messageCount,
    };
  }

  /**
   * Find chunk containing a specific message UUID.
   */
  findChunkByMessageId(chunks: Chunk[], messageUuid: string): Chunk | undefined {
    return chunks.find(
      (c) =>
        c.userMessage.uuid === messageUuid || c.responses.some((r) => r.uuid === messageUuid)
    );
  }

  /**
   * Find chunk containing a specific subagent.
   */
  findChunkBySubagentId(chunks: Chunk[], subagentId: string): Chunk | undefined {
    return chunks.find((c) => c.subagents.some((s) => s.id === subagentId));
  }
}
