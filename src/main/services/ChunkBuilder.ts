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
  AIChunk,
  ParsedMessage,
  Process,
  SessionMetrics,
  ToolExecution,
  Session,
  SessionDetail,
  EMPTY_METRICS,
  isParsedHardNoiseMessage,
  isParsedUserChunkMessage,
  isParsedSystemChunkMessage,
  SemanticStep,
  EnhancedChunk,
  EnhancedUserChunk,
  EnhancedAIChunk,
  EnhancedSystemChunk,
  ContentBlock,
  SemanticStepGroup,
  isUserChunk,
  isAIChunk,
  isEnhancedAIChunk,
  isSystemChunk,
  ConversationGroup,
  TaskExecution,
  ToolCall,
  MessageCategory,
} from '../types/claude';
import { calculateMetrics } from '../utils/jsonl';
import { fillTimelineGaps } from '../utils/timelineGapFilling';
import { calculateStepContext } from '../utils/contextAccumulator';

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
   * Build chunks from messages using 4-category classification.
   * Produces independent UserChunks, AIChunks, and SystemChunks.
   *
   * Categories:
   * - User: Genuine user input (creates UserChunk, renders RIGHT)
   * - System: Command output <local-command-stdout> (creates SystemChunk, renders LEFT)
   * - Hard Noise: Filtered out entirely (system metadata, caveats, reminders)
   * - AI: All other messages grouped into AIChunks (renders LEFT)
   *
   * All chunk types are INDEPENDENT - no pairing between User and AI.
   */
  buildChunks(messages: ParsedMessage[], subagents: Process[] = []): EnhancedChunk[] {
    const chunks: EnhancedChunk[] = [];

    // Filter to main thread messages (non-sidechain)
    const mainMessages = messages.filter((m) => !m.isSidechain);
    console.log(`[ChunkBuilder] Total messages: ${messages.length}, Main thread: ${mainMessages.length}`);

    // Classify each message into categories
    const classified = this.classifyMessages(mainMessages);

    // Log classification summary
    const categoryCounts = new Map<MessageCategory, number>();
    for (const { category } of classified) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
    console.log(`[ChunkBuilder] Message classification:`, Object.fromEntries(categoryCounts));

    // Build chunks from classification - AI chunks are INDEPENDENT
    let aiBuffer: ParsedMessage[] = [];

    for (const { message, category } of classified) {
      switch (category) {
        case 'hardNoise':
          // Skip - filtered out
          break;

        case 'user':
          // Flush any buffered AI messages first
          if (aiBuffer.length > 0) {
            chunks.push(this.buildAIChunkFromBuffer(aiBuffer, subagents, messages));
            aiBuffer = [];
          }
          chunks.push(this.buildUserChunk(message));
          break;

        case 'system':
          // Flush any buffered AI messages first
          if (aiBuffer.length > 0) {
            chunks.push(this.buildAIChunkFromBuffer(aiBuffer, subagents, messages));
            aiBuffer = [];
          }
          chunks.push(this.buildSystemChunk(message));
          break;

        case 'ai':
          aiBuffer.push(message);
          break;
      }
    }

    // Flush remaining AI buffer
    if (aiBuffer.length > 0) {
      chunks.push(this.buildAIChunkFromBuffer(aiBuffer, subagents, messages));
    }

    // Log final chunk summary
    const userChunkCount = chunks.filter(isUserChunk).length;
    const aiChunkCount = chunks.filter(isAIChunk).length;
    const systemChunkCount = chunks.filter(isSystemChunk).length;
    console.log(`[ChunkBuilder] Created ${chunks.length} chunks: ${userChunkCount} user, ${aiChunkCount} AI, ${systemChunkCount} system`);

    return chunks;
  }

  // ===========================================================================
  // Message Classification
  // ===========================================================================

  /**
   * Classify all messages into categories.
   */
  private classifyMessages(messages: ParsedMessage[]): Array<{message: ParsedMessage, category: MessageCategory}> {
    return messages.map(message => ({
      message,
      category: this.categorizeMessage(message)
    }));
  }

  /**
   * Categorize a single message into one of four categories.
   */
  private categorizeMessage(message: ParsedMessage): MessageCategory {
    // Check hard noise first (filtered out)
    if (isParsedHardNoiseMessage(message)) {
      return 'hardNoise';
    }

    // Check system (command output)
    if (isParsedSystemChunkMessage(message)) {
      return 'system';
    }

    // Check user (real user input)
    if (isParsedUserChunkMessage(message)) {
      return 'user';
    }

    // Everything else is AI (assistant messages, tool results, etc.)
    return 'ai';
  }

  // ===========================================================================
  // Chunk Builders
  // ===========================================================================

  /**
   * Build a UserChunk from a user message.
   */
  private buildUserChunk(message: ParsedMessage): EnhancedUserChunk {
    const id = generateChunkId();
    const metrics = calculateMetrics([message]);

    return {
      id,
      chunkType: 'user',
      userMessage: message,
      startTime: message.timestamp,
      endTime: message.timestamp,
      durationMs: 0,
      metrics,
      rawMessages: [message],
    };
  }

  /**
   * Build a SystemChunk from a command output message.
   */
  private buildSystemChunk(message: ParsedMessage): EnhancedSystemChunk {
    const id = generateChunkId();
    const commandOutput = this.extractCommandOutput(message);
    const metrics = calculateMetrics([message]);

    return {
      id,
      chunkType: 'system',
      message,
      commandOutput,
      startTime: message.timestamp,
      endTime: message.timestamp,
      durationMs: 0,
      metrics,
      rawMessages: [message],
    };
  }

  /**
   * Extract command output from <local-command-stdout> tag.
   */
  private extractCommandOutput(message: ParsedMessage): string {
    const content = typeof message.content === 'string' ? message.content : '';
    const match = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
    const matchStderr = content.match(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/);
    if (match) {
      return match[1];
    }
    if (matchStderr) {
      return matchStderr[1];
    }
    return content;
  }

  /**
   * Build an AIChunk from buffered AI messages.
   */
  private buildAIChunkFromBuffer(
    responses: ParsedMessage[],
    subagents: Process[],
    allMessages: ParsedMessage[]
  ): EnhancedAIChunk {
    const id = generateChunkId();
    const { startTime, endTime, durationMs } = this.calculateAIChunkTiming(responses);
    const metrics = calculateMetrics(responses);
    const toolExecutions = this.buildToolExecutions(responses);

    // Collect sidechain messages for this time range
    const sidechainMessages = this.collectSidechainMessages(
      allMessages,
      startTime,
      endTime
    );

    const chunk: EnhancedAIChunk = {
      id,
      chunkType: 'ai',
      responses,
      startTime,
      endTime,
      durationMs,
      metrics,
      processes: [],
      sidechainMessages,
      toolExecutions,
      semanticSteps: [],
      rawMessages: responses,
    };

    // Link processes to this chunk
    this.linkProcessesToAIChunk(chunk, subagents);

    // Extract semantic steps
    chunk.semanticSteps = this.extractSemanticStepsFromAIChunk(chunk);
    chunk.semanticSteps = fillTimelineGaps({
      steps: chunk.semanticSteps,
      chunkStartTime: chunk.startTime,
      chunkEndTime: chunk.endTime,
    });
    calculateStepContext(chunk.semanticSteps, chunk.rawMessages);
    chunk.semanticStepGroups = this.buildSemanticStepGroups(chunk.semanticSteps);

    return chunk;
  }

  /**
   * Link processes to a single AI chunk based on timing.
   */
  private linkProcessesToAIChunk(chunk: EnhancedAIChunk, subagents: Process[]): void {
    for (const subagent of subagents) {
      if (subagent.startTime >= chunk.startTime && subagent.startTime <= chunk.endTime) {
        chunk.processes.push(subagent);
      }
    }
    chunk.processes.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  // ===========================================================================
  // Simplified Grouping Strategy
  // ===========================================================================

  /**
   * Build conversation groups using simplified grouping strategy.
   * Groups one user message with all AI responses until the next user message.
   *
   * This is a cleaner alternative to buildChunks() that:
   * - Uses simpler time-based grouping
   * - Separates Task executions from regular tool executions
   * - Links subagents more explicitly via TaskExecution
   */
  buildGroups(messages: ParsedMessage[], subagents: Process[]): ConversationGroup[] {
    const groups: ConversationGroup[] = [];

    // Step 1: Filter to main thread only (not sidechain)
    const mainMessages = messages.filter(m => !m.isSidechain);

    // Step 2: Find all REAL user messages (these start groups)
    // Use isParsedUserChunkMessage to filter out noise
    const userMessages = mainMessages.filter(isParsedUserChunkMessage);

    // Step 3: For each user message, collect all AI responses until next user message
    for (let i = 0; i < userMessages.length; i++) {
      const userMsg = userMessages[i];
      const nextUserMsg = userMessages[i + 1];

      // Collect all messages between this user message and the next
      const aiResponses = this.collectAIResponses(mainMessages, userMsg, nextUserMsg);

      // Separate Task tool results from regular tool executions
      const { taskExecutions, regularToolExecutions } = this.separateTaskExecutions(aiResponses, subagents);

      // Link subagents to this group
      const groupSubagents = this.linkSubagentsToGroup(userMsg, nextUserMsg, subagents);

      // Calculate metrics
      const { startTime, endTime, durationMs } = this.calculateGroupTiming(userMsg, aiResponses);
      const metrics = calculateMetrics([userMsg, ...aiResponses]);

      groups.push({
        id: `group-${i + 1}`,
        type: 'user-ai-exchange',
        userMessage: userMsg,
        aiResponses,
        processes: groupSubagents,
        toolExecutions: regularToolExecutions,
        taskExecutions,
        startTime,
        endTime,
        durationMs,
        metrics
      });
    }

    return groups;
  }

  /**
   * Collect AI responses between a user message and the next user message.
   * Simpler than collectResponses - just uses timestamp boundaries.
   */
  private collectAIResponses(
    messages: ParsedMessage[],
    userMsg: ParsedMessage,
    nextUserMsg: ParsedMessage | undefined
  ): ParsedMessage[] {
    const responses: ParsedMessage[] = [];
    const startTime = userMsg.timestamp;
    const endTime = nextUserMsg?.timestamp;

    for (const msg of messages) {
      // Skip if before this user message
      if (msg.timestamp <= startTime) continue;

      // Skip if at or after next user message
      if (endTime && msg.timestamp >= endTime) continue;

      // Include ALL non-user messages (assistant + internal user messages)
      if (msg.type === 'assistant' || (msg.type === 'user' && msg.isMeta === true)) {
        responses.push(msg);
      }
    }

    return responses;
  }

  /**
   * Separate Task executions from regular tool executions.
   * Task tools spawn subagents, so we track them separately to avoid duplication.
   */
  private separateTaskExecutions(
    responses: ParsedMessage[],
    allSubagents: Process[]
  ): { taskExecutions: TaskExecution[], regularToolExecutions: ToolExecution[] } {
    const taskExecutions: TaskExecution[] = [];
    const regularToolExecutions: ToolExecution[] = [];

    // Build map of tool_use_id -> subagent for Task calls
    const taskIdToSubagent = new Map<string, Process>();
    for (const subagent of allSubagents) {
      if (subagent.parentTaskId) {
        taskIdToSubagent.set(subagent.parentTaskId, subagent);
      }
    }

    // Collect all tool calls
    const toolCalls = new Map<string, { call: ToolCall, timestamp: Date }>();
    for (const msg of responses) {
      if (msg.type === 'assistant') {
        for (const toolCall of msg.toolCalls) {
          toolCalls.set(toolCall.id, { call: toolCall, timestamp: msg.timestamp });
        }
      }
    }

    // Match with results
    for (const msg of responses) {
      if (msg.type === 'user' && msg.isMeta === true && msg.sourceToolUseID) {
        const callInfo = toolCalls.get(msg.sourceToolUseID);
        if (!callInfo) continue;

        // Check if this is a Task call with a subagent
        const subagent = taskIdToSubagent.get(msg.sourceToolUseID);
        if (callInfo.call.name === 'Task' && subagent) {
          // This is a Task execution
          taskExecutions.push({
            taskCall: callInfo.call,
            taskCallTimestamp: callInfo.timestamp,
            subagent,
            toolResult: msg,
            resultTimestamp: msg.timestamp,
            durationMs: msg.timestamp.getTime() - callInfo.timestamp.getTime()
          });
        } else {
          // Regular tool execution
          const result = msg.toolResults[0];
          if (result) {
            regularToolExecutions.push({
              toolCall: callInfo.call,
              result,
              startTime: callInfo.timestamp,
              endTime: msg.timestamp,
              durationMs: msg.timestamp.getTime() - callInfo.timestamp.getTime()
            });
          }
        }
      }
    }

    return { taskExecutions, regularToolExecutions };
  }

  /**
   * Link subagents to a conversation group based on timing.
   */
  private linkSubagentsToGroup(
    userMsg: ParsedMessage,
    nextUserMsg: ParsedMessage | undefined,
    allSubagents: Process[]
  ): Process[] {
    const groupSubagents: Process[] = [];
    const startTime = userMsg.timestamp;
    const endTime = nextUserMsg?.timestamp || new Date(Date.now() + 1000 * 60 * 60 * 24); // Far future if no next message

    // Collect subagents that start within this group's time range
    for (const subagent of allSubagents) {
      if (subagent.startTime >= startTime && subagent.startTime < endTime) {
        groupSubagents.push(subagent);
      }
    }

    return groupSubagents;
  }

  /**
   * Calculate group timing from user message and AI responses.
   */
  private calculateGroupTiming(
    userMsg: ParsedMessage,
    aiResponses: ParsedMessage[]
  ): { startTime: Date; endTime: Date; durationMs: number } {
    const startTime = userMsg.timestamp;

    let endTime = startTime;
    for (const resp of aiResponses) {
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
   * Calculate timing for AI chunks (responses only, no user message).
   */
  private calculateAIChunkTiming(
    responses: ParsedMessage[]
  ): { startTime: Date; endTime: Date; durationMs: number } {
    if (responses.length === 0) {
      const now = new Date();
      return { startTime: now, endTime: now, durationMs: 0 };
    }

    const startTime = responses[0].timestamp;
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
        label: this.buildGroupLabel(groupSteps),
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
  private buildGroupLabel(steps: SemanticStep[]): string {
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
   * Extract semantic steps from AI chunk responses.
   * Semantic steps represent logical units of work within responses.
   *
   * Note: Task tool_use blocks are filtered when corresponding subagents exist,
   * since the Task call and subagent represent the same execution. Orphaned Task
   * calls (without subagents) are kept as fallback.
   */
  private extractSemanticStepsFromAIChunk(chunk: AIChunk | EnhancedAIChunk): SemanticStep[] {
    const steps: SemanticStep[] = [];
    let stepIdCounter = 0;

    // Build set of Task IDs that have corresponding processes
    // This prevents duplicate entries for Task calls that spawned processes
    const taskIdsWithProcesses = new Set<string>(
      chunk.processes
        .filter((s: Process) => s.parentTaskId)
        .map((s: Process) => s.parentTaskId!)
    );

    // Process only AI responses (no user message in AIChunk)
    for (const msg of chunk.responses) {
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
            // Filter out Task tool calls that have corresponding processes
            // Keep orphaned Task calls as fallback
            const isTaskWithProcess = this.isTaskToolCall(block) && taskIdsWithProcesses.has(block.id);

            if (!isTaskWithProcess) {
              steps.push({
                id: block.id,
                type: 'tool_call',
                startTime: new Date(msg.timestamp),
                durationMs: 0,
                content: {
                  toolName: block.name,
                  toolInput: block.input,
                  sourceModel: msg.model,
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
      // Note: isMeta can be true or null in JSONL, so check for toolResults presence directly
      if (msg.type === 'user' && msg.toolResults && msg.toolResults.length > 0) {
        for (const result of msg.toolResults) {
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
              toolUseResult: msg.toolUseResult,  // Enriched data from message
            },
            context: msg.agentId ? 'subagent' : 'main',
            agentId: msg.agentId,
          });
        }
      }
    }

    // Link processes as steps
    for (const process of chunk.processes) {
      steps.push({
        id: process.id,
        type: 'subagent',
        startTime: process.startTime,
        endTime: process.endTime,
        durationMs: process.durationMs,
        content: {
          subagentId: process.id,
          subagentDescription: process.description,
        },
        tokens: {
          input: process.metrics.inputTokens,
          output: process.metrics.outputTokens,
          cached: process.metrics.cacheReadTokens,
        },
        isParallel: process.isParallel,
        context: 'subagent',
        agentId: process.id,
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
    subagents: Process[]
  ): SessionDetail {
    // Build chunks
    const chunks = this.buildChunks(messages, subagents);

    // Calculate overall metrics
    const metrics = calculateMetrics(messages);

    return {
      session,
      messages,
      chunks,
      processes: subagents,
      metrics,
    };
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
  findChunkByMessageId(
    chunks: (Chunk | EnhancedChunk)[],
    messageUuid: string
  ): Chunk | EnhancedChunk | undefined {
    return chunks.find((c) => {
      // UserChunk: check userMessage
      if (isUserChunk(c)) {
        return c.userMessage.uuid === messageUuid;
      }
      // AIChunk: check responses
      if (isAIChunk(c)) {
        return c.responses.some((r) => r.uuid === messageUuid);
      }
      return false;
    });
  }

  /**
   * Find chunk containing a specific subagent.
   * Only AIChunks have processes.
   */
  findChunkBySubagentId(
    chunks: (Chunk | EnhancedChunk)[],
    subagentId: string
  ): Chunk | EnhancedChunk | undefined {
    return chunks.find((c) => {
      if (isAIChunk(c)) {
        return c.processes.some((s: Process) => s.id === subagentId);
      }
      return false;
    });
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

      // Build semantic step groups from AI chunks only (UserChunks don't have semanticSteps)
      const allSemanticSteps = chunks
        .filter((c): c is EnhancedAIChunk => isEnhancedAIChunk(c))
        .flatMap(c => c.semanticSteps);
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
