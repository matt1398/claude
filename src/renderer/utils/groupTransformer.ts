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
  EnhancedUserChunk,
  EnhancedAIChunk,
  ParsedMessage,
  Subagent,
  SemanticStep,
} from '../types/data';

import {
  isAssistantMessage,
  isRealUserMessage,
  isEnhancedUserChunk,
  isEnhancedAIChunk,
} from '../types/data';
import { sanitizeDisplayContent, isCommandContent } from './contentSanitizer';

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
 * Processes separated chunks (UserChunk + AIChunk pairs) into conversation turns.
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

  return transformSeparatedChunks(chunks, subagents);
}

/**
 * Transforms new separated chunks (UserChunk + AIChunk pairs) into SessionConversation.
 *
 * @param chunks - Array of separated chunks (UserChunks and AIChunks mixed)
 * @param subagents - Array of all subagents in the session
 * @returns SessionConversation structure
 */
function transformSeparatedChunks(
  chunks: EnhancedChunk[],
  subagents: Subagent[]
): SessionConversation {
  const turns: ConversationTurn[] = [];
  let totalAIGroupCount = 0;
  let turnIndex = 0;

  // Separate user chunks and AI chunks
  const userChunks = chunks.filter(isEnhancedUserChunk);
  const aiChunks = chunks.filter(isEnhancedAIChunk);

  // Create a map of AI chunks by userChunkId for quick lookup
  const aiChunkMap = new Map<string, EnhancedAIChunk>();
  for (const aiChunk of aiChunks) {
    aiChunkMap.set(aiChunk.userChunkId, aiChunk);
  }

  // Process each user chunk and find its corresponding AI chunk
  for (const userChunk of userChunks) {
    try {
      // Create UserGroup from the user chunk
      const userGroup = createUserGroup(userChunk.userMessage, turnIndex);

      // Find corresponding AI chunk
      const aiChunk = aiChunkMap.get(userChunk.id);

      // Create AIGroups from the AI chunk (if it exists)
      const aiGroups = aiChunk
        ? splitIntoAIGroupsFromAIChunk(aiChunk, userGroup.id, subagents)
        : [];
      totalAIGroupCount += aiGroups.length;

      // Determine turn timing
      const startTime = userChunk.startTime;
      const endTime = aiChunk?.endTime || userChunk.endTime;

      // Create conversation turn
      const turn: ConversationTurn = {
        id: `turn-${turnIndex}`,
        userGroup,
        aiGroups,
        startTime,
        endTime,
      };

      turns.push(turn);
      turnIndex++;
    } catch (error) {
      console.error(`Error processing user chunk ${userChunk.id}:`, error);
      // Continue with other chunks even if one fails
    }
  }

  return {
    sessionId: userChunks[0]?.id.split('-')[0] || '',
    turns,
    totalUserGroups: userChunks.length,
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

  // Sanitize content for display (handles XML tags from command messages)
  // This converts <command-name>/model</command-name> to "/model"
  const sanitizedText = sanitizeDisplayContent(rawText);

  // Check if this is a command message (for special handling)
  const isCommand = isCommandContent(rawText);

  // Extract commands from the sanitized text (for inline /commands in regular messages)
  // For command messages, the command is already extracted as sanitizedText
  const commands = isCommand ? [] : extractCommands(sanitizedText);

  // Extract file references (@file.ts) from sanitized text
  fileReferences.push(...extractFileReferences(sanitizedText));

  // For command messages, use the sanitized command as display text
  // For regular messages, remove inline commands from display
  let displayText = sanitizedText;
  if (!isCommand) {
    for (const cmd of commands) {
      displayText = displayText.replace(cmd.raw, '').trim();
    }
  }

  return {
    text: displayText || undefined,
    rawText: sanitizedText, // Use sanitized version as rawText for display
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
 * @returns Array of ImageData objects (currently always empty)
 */
export function extractImages(): ImageData[] {
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
 * Regex pattern for detecting file/directory references.
 * Matches @path that looks like a file/directory reference.
 * Must either:
 * 1. Start with common directory names: src, app, lib, types, packages, etc.
 * 2. Contain a forward slash (indicating a path)
 *
 * This avoids matching:
 * - URLs like `example.com/@api`
 * - Email-like patterns
 * - Random `@something` without path structure
 */
export const FILE_REF_PATTERN = /@((?:src|app|apps|lib|types|packages|components|utils|services|hooks|store|renderer|main|preload|public|assets|config|test|tests|spec|specs|e2e|docs|scripts)(?:\/[^\s,)}\]]+)?|[a-zA-Z0-9._-]+\/[^\s,)}\]]+)/g;

/**
 * Extracts file references (@file.ts) from text.
 *
 * @param text - Text to parse for file references
 * @returns Array of FileReference objects
 */
function extractFileReferences(text: string): FileReference[] {
  if (!text) return [];

  const references: FileReference[] = [];
  // Reset regex state before use
  FILE_REF_PATTERN.lastIndex = 0;
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
 * Creates ONE AIGroup from a new separated AIChunk.
 *
 * @param aiChunk - The separated AI chunk to process
 * @param userGroupId - ID of the parent UserGroup
 * @param allSubagents - All subagents in the session
 * @returns Array containing exactly ONE AIGroup
 */
function splitIntoAIGroupsFromAIChunk(
  aiChunk: EnhancedAIChunk,
  userGroupId: string,
  allSubagents: Subagent[]
): AIGroup[] {
  const steps = aiChunk.semanticSteps;

  // If no semantic steps, return empty array
  if (steps.length === 0) {
    return [];
  }

  // Calculate timing from all steps
  const startTime = steps[0].startTime;
  const endTime = steps[steps.length - 1].endTime || steps[steps.length - 1].startTime;
  const durationMs = endTime.getTime() - startTime.getTime();

  // Find any source assistant message for token calculation
  const sourceMessage = aiChunk.responses.find(msg => isAssistantMessage(msg)) || null;

  // Calculate tokens from all steps
  const tokens = calculateTokensFromSteps(steps, sourceMessage);

  // Generate summary from all steps
  const summary = computeAIGroupSummary(steps);

  // Determine status from all steps
  const status = determineAIGroupStatus(steps);

  // Use subagents from the chunk (already linked by ChunkBuilder)
  // Or link by timing as fallback
  const linkedSubagents = aiChunk.subagents.length > 0
    ? aiChunk.subagents
    : linkSubagentsToAIGroup(startTime, endTime, allSubagents);

  // Create single AIGroup with all steps
  const aiGroup: AIGroup = {
    id: `ai-${aiChunk.id}`,
    userGroupId,
    responseIndex: 0,
    startTime,
    endTime,
    durationMs,
    steps,
    tokens,
    summary,
    status,
    subagents: linkedSubagents,
    chunkId: aiChunk.id,
    metrics: aiChunk.metrics,
  };

  return [aiGroup];
}


/**
 * Creates ONE AIGroup per chunk containing ALL semantic steps.
 *
 * @param chunk - The enhanced AI chunk to process
 * @param userGroupId - ID of the parent UserGroup
 * @param allSubagents - All subagents in the session
 * @returns Array containing exactly ONE AIGroup
 */
export function splitIntoAIGroups(
  chunk: EnhancedChunk,
  userGroupId: string,
  allSubagents: Subagent[]
): AIGroup[] {
  if (isEnhancedAIChunk(chunk)) {
    return splitIntoAIGroupsFromAIChunk(chunk, userGroupId, allSubagents);
  }
  // UserChunks don't have AI responses
  return [];
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
