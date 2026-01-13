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
  isParsedResponseUserMessage,
  isParsedAssistantMessage,
  isParsedNoiseMessage,
  isParsedTriggerMessage,
  SemanticStep,
  EnhancedChunk,
  ContentBlock,
  SemanticStepGroup,
  isTextContent,
} from '../types/claude';
import { calculateMetrics } from '../utils/jsonl';
import { fillTimelineGaps } from '../utils/timelineGapFilling';
import { calculateAccumulatedContext } from '../utils/contextAccumulator';

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
   * A chunk consists of one trigger message (genuine user input) and all subsequent responses.
   * Noise messages (commands, caveats, snapshots) are filtered out.
   * Returns EnhancedChunks with semantic step breakdown.
   */
  buildChunks(messages: ParsedMessage[], subagents: Subagent[] = []): EnhancedChunk[] {
    const chunks: EnhancedChunk[] = [];

    // Filter to main thread messages (non-sidechain)
    const mainMessages = messages.filter((m) => !m.isSidechain);

    // Filter out noise messages (commands, caveats, snapshots)
    const cleanMessages = mainMessages.filter((m) => !isParsedNoiseMessage(m));

    // Find all trigger messages (these start chunks)
    // Use isParsedTriggerMessage to identify genuine user inputs
    const userMessages = cleanMessages.filter(isParsedTriggerMessage);

    for (let i = 0; i < userMessages.length; i++) {
      const userMsg = userMessages[i];
      const nextUserMsg = userMessages[i + 1];

      // Collect responses until next user message (from clean messages, noise already filtered)
      const responses = this.collectResponses(cleanMessages, userMsg, nextUserMsg);

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

      // Create base chunk
      const baseChunk: Chunk = {
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

      // Link subagents first (needed for extractSemanticSteps)
      // Will be properly linked for all chunks at the end
      const chunk: EnhancedChunk = {
        ...baseChunk,
        semanticSteps: [], // Will be filled after subagents are linked
        rawMessages: [userMsg, ...responses],
      };

      chunks.push(chunk);
    }

    // Link subagents to chunks
    this.linkSubagentsToChunks(chunks, subagents);

    // Extract semantic steps for each chunk (now that subagents are linked)
    for (const chunk of chunks) {
      chunk.semanticSteps = this.extractSemanticSteps(chunk);

      // Apply timeline gap filling
      chunk.semanticSteps = fillTimelineGaps({
        steps: chunk.semanticSteps,
        chunkStartTime: chunk.startTime,
        chunkEndTime: chunk.endTime,
      });

      chunk.semanticStepGroups = this.buildSemanticStepGroups(chunk.semanticSteps);
    }

    return chunks;
  }

  /**
   * Collect responses for a user message.
   * Note: Input messages should already be filtered for noise (no system/summary/snapshot messages).
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

      // Include assistant responses and response user messages
      // Response user messages include:
      // - Tool results (isMeta: true)
      // - Interruptions (isMeta: false, array content)
      // This ensures these are part of the response, not starting new chunks
      // Noise messages are already filtered out at this point
      if (isParsedAssistantMessage(msg) || isParsedResponseUserMessage(msg)) {
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
  private linkSubagentsToChunks(chunks: (Chunk | EnhancedChunk)[], subagents: Subagent[]): void {
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
   * Check if a tool_use block is a Task tool call.
   * Task tools spawn async subagents, so we filter them to avoid duplication.
   */
  private isTaskToolCall(block: ContentBlock): boolean {
    return block.type === 'tool_use' && block.name === 'Task';
  }

  /**
   * Build semantic step groups from steps.
   * Groups steps by their source assistant message for collapsible UI.
   */
  private buildSemanticStepGroups(steps: SemanticStep[]): SemanticStepGroup[] {
    const groups: SemanticStepGroup[] = [];
    let groupIdCounter = 0;

    // Group steps by assistant message or standalone type
    const stepsByGroup = new Map<string | null, SemanticStep[]>();

    for (const step of steps) {
      const messageId = this.extractMessageIdFromStep(step);
      const existingSteps = stepsByGroup.get(messageId) || [];
      existingSteps.push(step);
      stepsByGroup.set(messageId, existingSteps);
    }

    // Build groups
    for (const [messageId, groupSteps] of stepsByGroup) {
      const startTime = groupSteps[0].startTime;
      const endTimes = groupSteps
        .map(s => s.endTime || new Date(s.startTime.getTime() + s.durationMs))
        .map(d => d.getTime());
      const endTime = new Date(Math.max(...endTimes));
      const totalDuration = groupSteps.reduce((sum, s) => sum + s.durationMs, 0);

      groups.push({
        id: `group-${++groupIdCounter}`,
        label: this.buildGroupLabel(groupSteps, messageId || undefined),
        steps: groupSteps,
        isGrouped: messageId !== null && groupSteps.length > 1,
        sourceMessageId: messageId || undefined,
        startTime,
        endTime,
        totalDuration,
      });
    }

    // Sort by startTime
    return groups.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Extract the assistant message ID from a step, or null if standalone.
   * Steps from the same assistant message share the message UUID.
   * Subagents, tool results, and interruptions are standalone (null).
   */
  private extractMessageIdFromStep(step: SemanticStep): string | null {
    // Use sourceMessageId if available
    if (step.sourceMessageId) {
      return step.sourceMessageId;
    }

    // Standalone steps (not grouped)
    if (step.type === 'subagent') return null;
    if (step.type === 'tool_result') return null;
    if (step.type === 'interruption') return null;
    if (step.type === 'tool_call') return null; // Tool calls are standalone

    return null;
  }

  /**
   * Build a descriptive label for a group.
   */
  private buildGroupLabel(steps: SemanticStep[], messageId?: string): string {
    if (steps.length === 1) {
      const step = steps[0];
      switch (step.type) {
        case 'thinking':
          return 'Thinking';
        case 'tool_call':
          return `Tool: ${step.content.toolName || 'Unknown'}`;
        case 'tool_result':
          return `Result: ${step.content.isError ? '❌' : '✓'}`;
        case 'subagent':
          return step.content.subagentDescription || 'Subagent';
        case 'output':
          return 'Output';
        case 'interruption':
          return 'Interruption';
      }
    }

    // Multiple steps grouped together
    const hasThinking = steps.some(s => s.type === 'thinking');
    const hasOutput = steps.some(s => s.type === 'output');
    const toolCalls = steps.filter(s => s.type === 'tool_call');

    if (toolCalls.length > 0) {
      return `Tools (${toolCalls.length})`;
    }
    if (hasThinking && hasOutput) {
      return 'Assistant Response';
    }
    if (hasThinking) {
      return 'Thinking';
    }
    if (hasOutput) {
      return 'Output';
    }

    return `Response (${steps.length} steps)`;
  }

  /**
   * Extract semantic steps from chunk messages.
   * Semantic steps represent logical units of work within responses.
   *
   * Note: Task tool_use blocks are filtered when corresponding subagents exist,
   * since the Task call and subagent represent the same execution. Orphaned Task
   * calls (without subagents) are kept as fallback.
   */
  private extractSemanticSteps(chunk: Chunk): SemanticStep[] {
    const steps: SemanticStep[] = [];
    let stepIdCounter = 0;

    // Build set of Task IDs that have corresponding subagents
    // This prevents duplicate entries for Task calls that spawned subagents
    const taskIdsWithSubagents = new Set<string>(
      chunk.subagents
        .filter((s) => s.parentTaskId)
        .map((s) => s.parentTaskId!)
    );

    // Get all messages for this chunk (user message + responses)
    const chunkMessages = [chunk.userMessage, ...chunk.responses];

    for (const msg of chunkMessages) {
      if (msg.type === 'assistant') {
        // Extract from content blocks
        const content = Array.isArray(msg.content) ? msg.content : [];

        for (const block of content) {
          if (block.type === 'thinking' && block.thinking) {
            steps.push({
              id: `${msg.uuid}-thinking-${stepIdCounter++}`,
              type: 'thinking',
              startTime: new Date(msg.timestamp),
              durationMs: 0, // Estimated from token count
              content: { thinkingText: block.thinking },
              context: msg.agentId ? 'subagent' : 'main',
              agentId: msg.agentId,
              sourceMessageId: msg.uuid,
            });
          }

          if (block.type === 'tool_use' && block.id && block.name) {
            // Filter out Task tool calls that have corresponding subagents
            // Keep orphaned Task calls as fallback
            const isTaskWithSubagent = this.isTaskToolCall(block) && taskIdsWithSubagents.has(block.id);

            if (!isTaskWithSubagent) {
              steps.push({
                id: block.id,
                type: 'tool_call',
                startTime: new Date(msg.timestamp),
                durationMs: 0,
                content: {
                  toolName: block.name,
                  toolInput: block.input,
                },
                context: msg.agentId ? 'subagent' : 'main',
                agentId: msg.agentId,
                sourceMessageId: msg.uuid,
              });
            }
          }

          if (block.type === 'text' && block.text) {
            steps.push({
              id: `${msg.uuid}-output-${stepIdCounter++}`,
              type: 'output',
              startTime: new Date(msg.timestamp),
              durationMs: 0,
              content: { outputText: block.text },
              context: msg.agentId ? 'subagent' : 'main',
              agentId: msg.agentId,
              sourceMessageId: msg.uuid,
            });
          }
        }
      }

      // Tool results from internal user messages
      if (msg.type === 'user' && msg.isMeta) {
        for (const result of msg.toolResults || []) {
          steps.push({
            id: result.toolUseId,
            type: 'tool_result',
            startTime: new Date(msg.timestamp),
            durationMs: 0,
            content: {
              toolResultContent:
                typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content),
              isError: result.isError,
            },
            context: msg.agentId ? 'subagent' : 'main',
            agentId: msg.agentId,
          });
        }
      }
    }

    // Link subagents as steps
    for (const subagent of chunk.subagents) {
      steps.push({
        id: subagent.id,
        type: 'subagent',
        startTime: subagent.startTime,
        endTime: subagent.endTime,
        durationMs: subagent.durationMs,
        content: {
          subagentId: subagent.id,
          subagentDescription: subagent.description,
        },
        tokens: {
          input: subagent.metrics.inputTokens,
          output: subagent.metrics.outputTokens,
          cached: subagent.metrics.cacheReadTokens,
        },
        isParallel: subagent.isParallel,
        context: 'subagent',
        agentId: subagent.id,
      });
    }

    // Sort by startTime
    return steps.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
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

    // Calculate context accumulation across all chunks
    let allSteps: SemanticStep[] = [];
    for (const chunk of chunks) {
      allSteps = allSteps.concat(chunk.semanticSteps);
    }

    // Apply context accumulation (session-wide)
    allSteps = calculateAccumulatedContext({
      steps: allSteps,
      messages,
      isSubagent: false,
    });

    // Update chunks with accumulated steps
    let stepIndex = 0;
    for (const chunk of chunks) {
      chunk.semanticSteps = allSteps.slice(stepIndex, stepIndex + chunk.semanticSteps.length);
      stepIndex += chunk.semanticSteps.length;
    }

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
  buildWaterfallData(chunks: (Chunk | EnhancedChunk)[]): WaterfallData {
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
      const textBlock = chunk.userMessage.content.find(isTextContent);
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
  getTotalChunkMetrics(chunks: (Chunk | EnhancedChunk)[]): SessionMetrics {
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
  findChunkByMessageId(chunks: (Chunk | EnhancedChunk)[], messageUuid: string): Chunk | EnhancedChunk | undefined {
    return chunks.find(
      (c) =>
        c.userMessage.uuid === messageUuid || c.responses.some((r) => r.uuid === messageUuid)
    );
  }

  /**
   * Find chunk containing a specific subagent.
   */
  findChunkBySubagentId(chunks: (Chunk | EnhancedChunk)[], subagentId: string): Chunk | EnhancedChunk | undefined {
    return chunks.find((c) => c.subagents.some((s) => s.id === subagentId));
  }

  // ===========================================================================
  // Subagent Detail Building (for drill-down)
  // ===========================================================================

  /**
   * Build detailed information for a specific subagent.
   * Used for drill-down modal to show subagent's internal execution.
   *
   * @param projectId - Project ID
   * @param sessionId - Parent session ID (currently unused, kept for API consistency)
   * @param subagentId - Subagent ID to load
   * @param sessionParser - SessionParser instance for parsing subagent file
   * @param subagentResolver - SubagentResolver instance for nested subagents
   * @returns SubagentDetail or null if not found
   */
  async buildSubagentDetail(
    projectId: string,
    _sessionId: string, // Unused but kept for API consistency
    subagentId: string,
    sessionParser: import('./SessionParser').SessionParser,
    subagentResolver: import('./SubagentResolver').SubagentResolver
  ): Promise<import('../types/claude').SubagentDetail | null> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      // Construct path to subagent JSONL file
      const claudeDir = path.join(os.homedir(), '.claude', 'projects');
      const subagentPath = path.join(
        claudeDir,
        projectId,
        'subagents',
        `agent-${subagentId}.jsonl`
      );

      // Check if file exists
      try {
        await fs.access(subagentPath);
      } catch {
        console.warn(`Subagent file not found: ${subagentPath}`);
        return null;
      }

      // Parse subagent JSONL file
      const parsedSession = await sessionParser.parseSessionFile(subagentPath);

      // Resolve nested subagents within this subagent
      const nestedSubagents = await subagentResolver.resolveSubagents(
        projectId,
        subagentId, // Use subagentId as sessionId for nested resolution
        parsedSession.taskCalls
      );

      // Build chunks with semantic steps
      const chunks = this.buildChunks(parsedSession.messages, nestedSubagents);

      // Apply context accumulation for subagent (resets to 10k)
      let allSteps: SemanticStep[] = [];
      for (const chunk of chunks) {
        allSteps = allSteps.concat(chunk.semanticSteps);
      }

      allSteps = calculateAccumulatedContext({
        steps: allSteps,
        messages: parsedSession.messages,
        isSubagent: true, // Resets context to 10k
      });

      // Update chunks
      let stepIndex = 0;
      for (const chunk of chunks) {
        chunk.semanticSteps = allSteps.slice(stepIndex, stepIndex + chunk.semanticSteps.length);
        stepIndex += chunk.semanticSteps.length;
      }

      // Extract description (try to get from first user message)
      let description = 'Subagent';
      if (parsedSession.messages.length > 0) {
        const firstUserMsg = parsedSession.messages.find(m => m.type === 'user' && typeof m.content === 'string');
        if (firstUserMsg && typeof firstUserMsg.content === 'string') {
          description = firstUserMsg.content.substring(0, 100);
          if (firstUserMsg.content.length > 100) {
            description += '...';
          }
        }
      }

      // Calculate timing
      const times = parsedSession.messages.map(m => m.timestamp.getTime());
      const startTime = new Date(Math.min(...times));
      const endTime = new Date(Math.max(...times));
      const duration = endTime.getTime() - startTime.getTime();

      // Calculate thinking tokens
      let thinkingTokens = 0;
      for (const msg of parsedSession.messages) {
        if (msg.type === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'thinking' && block.thinking) {
              // Rough estimate: ~4 chars per token
              thinkingTokens += Math.ceil(block.thinking.length / 4);
            }
          }
        }
      }

      // Build semantic step groups from all chunks
      const allSemanticSteps = chunks.flatMap(c => c.semanticSteps);
      const semanticStepGroups = allSemanticSteps.length > 0
        ? this.buildSemanticStepGroups(allSemanticSteps)
        : undefined;

      return {
        id: subagentId,
        description,
        chunks,
        semanticStepGroups,
        startTime,
        endTime,
        duration,
        metrics: {
          inputTokens: parsedSession.metrics.inputTokens,
          outputTokens: parsedSession.metrics.outputTokens,
          thinkingTokens,
          messageCount: parsedSession.metrics.messageCount,
        },
      };
    } catch (error) {
      console.error(`Error building subagent detail for ${subagentId}:`, error);
      return null;
    }
  }
}
