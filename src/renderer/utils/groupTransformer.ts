/**
 * Transforms EnhancedChunk[] into SessionConversation structure.
 *
 * This module converts chunk-based data into a chat-style conversation model
 * with UserGroups (right-aligned) and AIGroups (left-aligned), enabling a
 * three-panel chat interface with synchronized Gantt visualization.
 */

import type {
  UserGroup,
  UserGroupContent,
  CommandInfo,
  ImageData,
  FileReference,
  AIGroup,
  AIGroupSummary,
  AIGroupStatus,
  AIGroupTokens,
  ConversationTurn,
  SessionConversation,
} from '../types/groups';

import type {
  EnhancedChunk,
  ParsedMessage,
  Subagent,
  SemanticStep,
  ContentBlock,
  SessionMetrics,
} from '../types/data';

import { isAssistantMessage, isRealUserMessage } from '../types/data';

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern for detecting slash commands.
 * Matches: /command-name [optional args]
 */
const COMMAND_PATTERN = /\/([a-z-]+)(?:\s+(.+?))?(?=\s*\/|\s*$)/gi;

/**
 * Maximum characters to extract for thinking preview.
 */
const THINKING_PREVIEW_LENGTH = 100;

/**
 * Time window (ms) to consider subagents as belonging to an AI Group.
 * If a subagent starts within this window of an AI Group's start/end, link them.
 */
const SUBAGENT_LINK_WINDOW_MS = 100;

// =============================================================================
// Main Transformation Function
// =============================================================================

/**
 * Transforms EnhancedChunk[] into SessionConversation.
 *
 * @param chunks - Array of enhanced chunks with semantic steps
 * @param subagents - Array of all subagents in the session
 * @returns SessionConversation structure for chat-style rendering
 */
export function transformChunksToConversation(
  chunks: EnhancedChunk[],
  subagents: Subagent[]
): SessionConversation {
  if (!chunks || chunks.length === 0) {
    return {
      sessionId: '',
      turns: [],
      totalUserGroups: 0,
      totalAIGroups: 0,
    };
  }

  const turns: ConversationTurn[] = [];
  let totalAIGroupCount = 0;

  // Process each chunk into a conversation turn
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      // Create UserGroup from the chunk's user message
      const userGroup = createUserGroup(chunk.userMessage, i);

      // Split chunk responses into AIGroups
      const aiGroups = splitIntoAIGroups(chunk, userGroup.id, subagents);
      totalAIGroupCount += aiGroups.length;

      // Create conversation turn
      const turn: ConversationTurn = {
        id: `turn-${i}`,
        userGroup,
        aiGroups,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
      };

      turns.push(turn);
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
      // Continue with other chunks even if one fails
    }
  }

  return {
    sessionId: chunks[0]?.id.split('-')[0] || '',
    turns,
    totalUserGroups: chunks.length,
    totalAIGroups: totalAIGroupCount,
  };
}

// =============================================================================
// UserGroup Creation
// =============================================================================

/**
 * Creates a UserGroup from a ParsedMessage.
 *
 * @param message - The user's input message
 * @param index - Index within the session (for ordering)
 * @returns UserGroup with parsed content
 */
export function createUserGroup(message: ParsedMessage, index: number): UserGroup {
  const content = extractUserGroupContent(message);

  return {
    id: `user-${message.uuid}`,
    message,
    timestamp: message.timestamp,
    content,
    index,
  };
}

/**
 * Extracts and parses content from a user message.
 *
 * @param message - The user message to parse
 * @returns Parsed UserGroupContent
 */
function extractUserGroupContent(message: ParsedMessage): UserGroupContent {
  let rawText = '';
  const images: ImageData[] = [];
  const fileReferences: FileReference[] = [];

  // Extract text from content
  // TODO: Image handling - Images are not currently part of ContentBlock type.
  // Need to investigate JSONL format to see how images are actually represented.
  if (typeof message.content === 'string') {
    rawText = message.content;
  } else if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        rawText += block.text;
      }
    }
  }

  // Extract commands
  const commands = extractCommands(rawText);

  // Extract file references (@file.ts)
  fileReferences.push(...extractFileReferences(rawText));

  // Remove commands from display text
  let displayText = rawText;
  for (const cmd of commands) {
    displayText = displayText.replace(cmd.raw, '').trim();
  }

  return {
    text: displayText || undefined,
    rawText,
    commands,
    images,
    fileReferences,
  };
}

/**
 * Extracts commands from text using regex.
 *
 * @param text - Text to parse for commands
 * @returns Array of CommandInfo objects
 */
export function extractCommands(text: string): CommandInfo[] {
  if (!text) return [];

  const commands: CommandInfo[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  COMMAND_PATTERN.lastIndex = 0;

  while ((match = COMMAND_PATTERN.exec(text)) !== null) {
    const [fullMatch, commandName, args] = match;
    commands.push({
      name: commandName,
      args: args?.trim(),
      raw: fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return commands;
}

/**
 * Extracts images from content blocks.
 *
 * TODO: Image extraction not yet implemented.
 * ContentBlock type does not include 'image' type.
 * Need to investigate actual JSONL format to determine how images are represented.
 *
 * @param content - Content blocks or string
 * @returns Array of ImageData objects (currently always empty)
 */
export function extractImages(content: ContentBlock[] | string): ImageData[] {
  // Images will be handled in a future phase once we understand the JSONL format
  return [];
}

/**
 * Extracts ImageData from an image content block.
 *
 * TODO: Not yet implemented - will be needed when image support is added.
 */
// function extractImageFromBlock(block: any): ImageData {
//   return {
//     id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
//     mediaType: block.source?.media_type || 'image/png',
//     data: block.source?.data,
//   };
// }

/**
 * Extracts file references (@file.ts) from text.
 *
 * @param text - Text to parse for file references
 * @returns Array of FileReference objects
 */
function extractFileReferences(text: string): FileReference[] {
  if (!text) return [];

  const references: FileReference[] = [];
  const FILE_REF_PATTERN = /@([^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = FILE_REF_PATTERN.exec(text)) !== null) {
    const [fullMatch, path] = match;
    references.push({
      path,
      raw: fullMatch,
    });
  }

  return references;
}

// =============================================================================
// AIGroup Creation
// =============================================================================

/**
 * Splits chunk responses into AIGroups at assistant message boundaries.
 *
 * Each assistant message creates a new AIGroup. This handles cases where
 * the user interrupts mid-response, creating multiple AI response cycles.
 *
 * @param chunk - The enhanced chunk to split
 * @param userGroupId - ID of the parent UserGroup
 * @param allSubagents - All subagents in the session
 * @returns Array of AIGroup objects
 */
export function splitIntoAIGroups(
  chunk: EnhancedChunk,
  userGroupId: string,
  allSubagents: Subagent[]
): AIGroup[] {
  const aiGroups: AIGroup[] = [];

  // Group semantic steps by their source assistant message
  const stepsByMessageId = new Map<string, SemanticStep[]>();

  for (const step of chunk.semanticSteps) {
    const messageId = step.sourceMessageId || 'unknown';
    if (!stepsByMessageId.has(messageId)) {
      stepsByMessageId.set(messageId, []);
    }
    stepsByMessageId.get(messageId)!.push(step);
  }

  // Create an AIGroup for each assistant message
  let responseIndex = 0;

  for (const [messageId, steps] of stepsByMessageId.entries()) {
    if (steps.length === 0) continue;

    // Find the source assistant message
    const sourceMessage = chunk.responses.find(
      msg => msg.uuid === messageId && isAssistantMessage(msg)
    );

    if (!sourceMessage && messageId !== 'unknown') {
      // Skip if we can't find the source message (unless it's orphaned steps)
      continue;
    }

    // Calculate timing
    const startTime = steps[0].startTime;
    const endTime = steps[steps.length - 1].endTime || steps[steps.length - 1].startTime;
    const durationMs = endTime.getTime() - startTime.getTime();

    // Calculate tokens
    const tokens = calculateTokensFromSteps(steps, sourceMessage);

    // Generate summary
    const summary = computeAIGroupSummary(steps);

    // Determine status
    const status = determineAIGroupStatus(steps);

    // Link subagents by timing
    const linkedSubagents = linkSubagentsToAIGroup(startTime, endTime, allSubagents);

    // Create metrics from source message
    const metrics: SessionMetrics = sourceMessage
      ? {
          durationMs,
          totalTokens: (sourceMessage.usage?.input_tokens || 0) + (sourceMessage.usage?.output_tokens || 0),
          inputTokens: sourceMessage.usage?.input_tokens || 0,
          outputTokens: sourceMessage.usage?.output_tokens || 0,
          cacheReadTokens: sourceMessage.usage?.cache_read_input_tokens || 0,
          cacheCreationTokens: sourceMessage.usage?.cache_creation_input_tokens || 0,
          messageCount: 1,
        }
      : chunk.metrics;

    const aiGroup: AIGroup = {
      id: `ai-${chunk.id}-${responseIndex}`,
      userGroupId,
      responseIndex,
      startTime,
      endTime,
      durationMs,
      steps,
      tokens,
      summary,
      status,
      subagents: linkedSubagents,
      chunkId: chunk.id,
      metrics,
    };

    aiGroups.push(aiGroup);
    responseIndex++;
  }

  // If no AI groups were created but we have semantic steps, create a fallback group
  if (aiGroups.length === 0 && chunk.semanticSteps.length > 0) {
    const steps = chunk.semanticSteps;
    const startTime = steps[0].startTime;
    const endTime = steps[steps.length - 1].endTime || steps[steps.length - 1].startTime;
    const durationMs = endTime.getTime() - startTime.getTime();

    aiGroups.push({
      id: `ai-${chunk.id}-0`,
      userGroupId,
      responseIndex: 0,
      startTime,
      endTime,
      durationMs,
      steps,
      tokens: calculateTokensFromSteps(steps, null),
      summary: computeAIGroupSummary(steps),
      status: determineAIGroupStatus(steps),
      subagents: linkSubagentsToAIGroup(startTime, endTime, allSubagents),
      chunkId: chunk.id,
      metrics: chunk.metrics,
    });
  }

  return aiGroups;
}

/**
 * Calculates token metrics from semantic steps and source message.
 *
 * @param steps - Semantic steps in this AI Group
 * @param sourceMessage - Source assistant message (if available)
 * @returns Token metrics
 */
function calculateTokensFromSteps(
  steps: SemanticStep[],
  sourceMessage: ParsedMessage | null | undefined
): AIGroupTokens {
  let input = 0;
  let output = 0;
  let cached = 0;
  let thinking = 0;

  // Sum from steps
  for (const step of steps) {
    if (step.tokens) {
      input += step.tokens.input || 0;
      output += step.tokens.output || 0;
      cached += step.tokens.cached || 0;
    }
    if (step.tokenBreakdown) {
      input += step.tokenBreakdown.input || 0;
      output += step.tokenBreakdown.output || 0;
      cached += step.tokenBreakdown.cacheRead || 0;
    }
    if (step.type === 'thinking' && step.tokens?.output) {
      thinking += step.tokens.output;
    }
  }

  // Override with source message usage if available (more accurate)
  if (sourceMessage?.usage) {
    input = sourceMessage.usage.input_tokens || 0;
    output = sourceMessage.usage.output_tokens || 0;
    cached = sourceMessage.usage.cache_read_input_tokens || 0;
  }

  return {
    input,
    output,
    cached,
    thinking,
  };
}

/**
 * Links subagents to an AI Group by timing overlap.
 *
 * @param startTime - AI Group start time
 * @param endTime - AI Group end time
 * @param allSubagents - All subagents in the session
 * @returns Subagents that overlap with this AI Group
 */
function linkSubagentsToAIGroup(
  startTime: Date,
  endTime: Date,
  allSubagents: Subagent[]
): Subagent[] {
  const linked: Subagent[] = [];

  for (const subagent of allSubagents) {
    const subStart = subagent.startTime.getTime();
    const subEnd = subagent.endTime.getTime();
    const aiStart = startTime.getTime();
    const aiEnd = endTime.getTime();

    // Check if subagent overlaps with AI Group (with window tolerance)
    const overlaps =
      (subStart >= aiStart - SUBAGENT_LINK_WINDOW_MS && subStart <= aiEnd + SUBAGENT_LINK_WINDOW_MS) ||
      (subEnd >= aiStart - SUBAGENT_LINK_WINDOW_MS && subEnd <= aiEnd + SUBAGENT_LINK_WINDOW_MS) ||
      (subStart <= aiStart && subEnd >= aiEnd);

    if (overlaps) {
      linked.push(subagent);
    }
  }

  return linked;
}

// =============================================================================
// AIGroup Summary & Status Computation
// =============================================================================

/**
 * Computes summary statistics for an AIGroup's collapsed view.
 *
 * @param steps - Semantic steps in the AI Group
 * @returns Summary statistics
 */
export function computeAIGroupSummary(steps: SemanticStep[]): AIGroupSummary {
  let thinkingPreview: string | undefined;
  let toolCallCount = 0;
  let outputMessageCount = 0;
  let subagentCount = 0;
  let totalDurationMs = 0;
  let totalTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  for (const step of steps) {
    // Extract thinking preview from first thinking step
    if (!thinkingPreview && step.type === 'thinking' && step.content.thinkingText) {
      const fullText = step.content.thinkingText;
      thinkingPreview = fullText.length > THINKING_PREVIEW_LENGTH
        ? fullText.slice(0, THINKING_PREVIEW_LENGTH) + '...'
        : fullText;
    }

    // Count step types
    if (step.type === 'tool_call') toolCallCount++;
    if (step.type === 'output') outputMessageCount++;
    if (step.type === 'subagent') subagentCount++;

    // Sum duration
    totalDurationMs += step.durationMs || 0;

    // Sum tokens
    if (step.tokens) {
      totalTokens += (step.tokens.input || 0) + (step.tokens.output || 0);
      outputTokens += step.tokens.output || 0;
      cachedTokens += step.tokens.cached || 0;
    }
    if (step.tokenBreakdown) {
      totalTokens += step.tokenBreakdown.input + step.tokenBreakdown.output;
      outputTokens += step.tokenBreakdown.output;
      cachedTokens += step.tokenBreakdown.cacheRead;
    }
  }

  return {
    thinkingPreview,
    toolCallCount,
    outputMessageCount,
    subagentCount,
    totalDurationMs,
    totalTokens,
    outputTokens,
    cachedTokens,
  };
}

/**
 * Determines the status of an AIGroup based on its steps.
 *
 * @param steps - Semantic steps in the AI Group
 * @returns AIGroupStatus
 */
export function determineAIGroupStatus(steps: SemanticStep[]): AIGroupStatus {
  if (steps.length === 0) return 'error';

  // Check for interruption
  const hasInterruption = steps.some(step => step.type === 'interruption');
  if (hasInterruption) return 'interrupted';

  // Check for errors
  const hasError = steps.some(step =>
    step.type === 'tool_result' && step.content.isError
  );
  if (hasError) return 'error';

  // Check if any step is incomplete (no endTime)
  const hasIncomplete = steps.some(step => !step.endTime);
  if (hasIncomplete) return 'in_progress';

  // Otherwise, complete
  return 'complete';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validates that a message is a real user message (not internal/meta).
 *
 * @param message - Message to validate
 * @returns true if real user message
 */
export function isValidUserMessage(message: ParsedMessage): boolean {
  return isRealUserMessage(message);
}

/**
 * Generates a unique ID for a conversation element.
 *
 * @param prefix - ID prefix
 * @param suffix - ID suffix (optional)
 * @returns Unique ID string
 */
export function generateId(prefix: string, suffix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 9);
  return suffix ? `${prefix}-${suffix}-${timestamp}-${random}` : `${prefix}-${timestamp}-${random}`;
}

/**
 * Formats duration for display.
 *
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string (e.g., "2.5s", "1m 23s")
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats token count for display.
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.2k", "234")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}
