/**
 * Utilities for parsing JSONL (JSON Lines) files used by Claude Code sessions.
 *
 * JSONL format: One JSON object per line
 * - Each line is a complete, valid JSON object
 * - Lines are separated by newline characters
 * - Empty lines should be skipped
 */

import * as fs from 'fs';
import * as readline from 'readline';
import {
  ChatHistoryEntry,
  ParsedMessage,
  ContentBlock,
  ToolCall,
  ToolResult,
  TokenUsage,
  SessionMetrics,
  MessageType,
  EMPTY_METRICS,
  EMPTY_TOKEN_USAGE,
  isParsedRealUserMessage,
  isParsedInternalUserMessage,
  isParsedResponseUserMessage,
  isParsedAssistantMessage,
  isParsedUserChunkMessage,
  isTextContent,
} from '../types/claude';
import { isCommandOutputContent, sanitizeDisplayContent } from '../../shared/utils/contentSanitizer';

// =============================================================================
// Core Parsing Functions
// =============================================================================

/**
 * Parse a JSONL file line by line using streaming.
 * This avoids loading the entire file into memory.
 */
export async function parseJsonlFile(filePath: string): Promise<ParsedMessage[]> {
  const messages: ParsedMessage[] = [];

  if (!fs.existsSync(filePath)) {
    return messages;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as ChatHistoryEntry;
      const parsed = parseChatHistoryEntry(entry);
      if (parsed) {
        messages.push(parsed);
      }
    } catch (error) {
      console.error(`Error parsing line in ${filePath}:`, error);
    }
  }

  return messages;
}

/**
 * Parse raw JSONL entries without enrichment.
 * Faster for cases where you only need raw data.
 */
export async function parseJsonlRaw(filePath: string): Promise<ChatHistoryEntry[]> {
  const entries: ChatHistoryEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return entries;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      entries.push(JSON.parse(line) as ChatHistoryEntry);
    } catch (error) {
      console.error(`Error parsing line in ${filePath}:`, error);
    }
  }

  return entries;
}

/**
 * Stream a JSONL file and call a callback for each parsed message.
 */
export async function streamJsonlFile(
  filePath: string,
  callback: (message: ParsedMessage, index: number) => void | Promise<void>
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let index = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as ChatHistoryEntry;
      const parsed = parseChatHistoryEntry(entry);
      if (parsed) {
        await callback(parsed, index++);
      }
    } catch (error) {
      console.error(`Error parsing line in ${filePath}:`, error);
    }
  }
}

// =============================================================================
// Entry Parsing
// =============================================================================

/**
 * Parse a single JSONL entry into a ParsedMessage.
 */
export function parseChatHistoryEntry(entry: ChatHistoryEntry): ParsedMessage | null {
  // Skip entries without uuid (usually metadata)
  if (!entry.uuid) {
    return null;
  }

  const type = parseMessageType(entry.type);
  if (!type) {
    return null;
  }

  // Handle different entry types
  let content: string | ContentBlock[] = '';
  let role: string | undefined;
  let usage: TokenUsage | undefined;
  let model: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let agentId: string | undefined;
  let isSidechain = false;
  let isMeta = false;
  let userType: string | undefined;
  let sourceToolUseID: string | undefined;
  let sourceToolAssistantUUID: string | undefined;
  let toolUseResult: Record<string, unknown> | undefined;
  let parentUuid: string | null = null;

  // Extract properties based on entry type
  let isCompactSummary = false;
  if (entry.type === 'user' || entry.type === 'assistant' || entry.type === 'system') {
    const convEntry = entry as any; // Use any to access common properties
    content = convEntry.message?.content ?? '';
    role = convEntry.message?.role;
    usage = convEntry.message?.usage;
    model = convEntry.message?.model;
    cwd = convEntry.cwd;
    gitBranch = convEntry.gitBranch;
    agentId = convEntry.agentId;
    isSidechain = convEntry.isSidechain ?? false;
    isMeta = convEntry.isMeta ?? false;
    userType = convEntry.userType;
    parentUuid = convEntry.parentUuid ?? null;
    isCompactSummary = convEntry.isCompactSummary === true;

    if (entry.type === 'user') {
      sourceToolUseID = convEntry.sourceToolUseID;
      sourceToolAssistantUUID = convEntry.sourceToolAssistantUUID;
      toolUseResult = convEntry.toolUseResult;
    }
  }

  const contentBlocks = normalizeContent(content);

  // Extract tool calls and results
  const toolCalls = extractToolCalls(contentBlocks);
  const toolResults = extractToolResults(contentBlocks);

  return {
    uuid: entry.uuid,
    parentUuid,
    type,
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    role,
    content: contentBlocks,
    usage,
    model,
    // Metadata
    cwd,
    gitBranch,
    agentId,
    isSidechain,
    isMeta,
    userType,
    isCompactSummary,
    // Tool info
    toolCalls,
    toolResults,
    sourceToolUseID,
    sourceToolAssistantUUID,
    toolUseResult,
  };
}

/**
 * Parse message type string into enum.
 */
function parseMessageType(type?: string): MessageType | null {
  switch (type) {
    case 'user':
      return 'user';
    case 'assistant':
      return 'assistant';
    case 'system':
      return 'system';
    case 'summary':
      return 'summary';
    case 'file-history-snapshot':
      return 'file-history-snapshot';
    case 'queue-operation':
      return 'queue-operation';
    default:
      // Unknown types are skipped
      return null;
  }
}

/**
 * Normalize message content to always be ContentBlock[].
 */
function normalizeContent(content: string | ContentBlock[]): ContentBlock[] | string {
  if (typeof content === 'string') {
    return content;
  }
  return content;
}

// =============================================================================
// Tool Extraction
// =============================================================================

/**
 * Extract tool calls from content blocks.
 */
function extractToolCalls(content: ContentBlock[] | string): ToolCall[] {
  if (typeof content === 'string') {
    return [];
  }

  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (block.type === 'tool_use' && block.id && block.name) {
      const input = (block.input ?? {}) as Record<string, unknown>;
      const isTask = block.name === 'Task';

      const toolCall: ToolCall = {
        id: block.id,
        name: block.name,
        input,
        isTask,
      };

      // Extract Task-specific info
      if (isTask) {
        toolCall.taskDescription = input.description as string | undefined;
        toolCall.taskSubagentType = input.subagent_type as string | undefined;
      }

      toolCalls.push(toolCall);
    }
  }

  return toolCalls;
}

/**
 * Extract tool results from content blocks.
 */
function extractToolResults(content: ContentBlock[] | string): ToolResult[] {
  if (typeof content === 'string') {
    return [];
  }

  const toolResults: ToolResult[] = [];

  for (const block of content) {
    if (block.type === 'tool_result' && block.tool_use_id) {
      toolResults.push({
        toolUseId: block.tool_use_id,
        content: block.content ?? '',
        isError: block.is_error ?? false,
      });
    }
  }

  return toolResults;
}

// =============================================================================
// First Message Extraction
// =============================================================================

/**
 * Extract the first user message from a JSONL file.
 * Used for session previews.
 *
 * Priority:
 * 1. First summary entry (preferred for preview)
 * 2. First non-command user message
 * 3. First command message as fallback (for command-only sessions)
 */
export async function extractFirstUserMessage(
  filePath: string
): Promise<{ text: string; timestamp: string } | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Track first command message as fallback
  let firstCommandMessage: { text: string; timestamp: string } | null = null;

  try {
    // FIRST PASS: Scan for summary entry
    for await (const line of rl) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line) as ChatHistoryEntry;

      // Found a summary entry - use it immediately
      if (entry.type === 'summary') {
        const summaryEntry = entry as any;
        const summaryText = summaryEntry.summary;

        if (summaryText && typeof summaryText === 'string') {
          fileStream.destroy();
          return {
            text: summaryText.substring(0, 100), // Limit to 100 chars as requested
            timestamp: entry.timestamp ?? new Date().toISOString(),
          };
        }
      }
    }

    // If we reach here, no summary was found - need to scan again for user messages
    rl.close();
    fileStream.destroy();

    // SECOND PASS: Scan for user messages (fallback)
    const fileStream2 = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl2 = readline.createInterface({
      input: fileStream2,
      crlfDelay: Infinity,
    });

    for await (const line of rl2) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line) as ChatHistoryEntry;

      // Skip non-user messages
      if (entry.type !== 'user') continue;

      const content = entry.message?.content;
      if (typeof content === 'string') {
        // Skip output/caveat messages entirely
        if (isCommandOutputContent(content)) {
          continue;
        }

        // Check if it's a command message
        const isCommand = content.startsWith('<command-name>');

        if (isCommand) {
          // Store as fallback if we haven't found one yet
          if (!firstCommandMessage) {
            // Extract command name for display
            const commandMatch = content.match(/<command-name>\/([^<]+)<\/command-name>/);
            const commandName = commandMatch ? `/${commandMatch[1]}` : '/command';
            firstCommandMessage = {
              text: commandName,
              timestamp: entry.timestamp ?? new Date().toISOString(),
            };
          }
          continue;
        }

        // Found a valid non-command user message - apply sanitization for display
        const sanitized = sanitizeDisplayContent(content);
        if (sanitized.length > 0) {
          fileStream2.destroy();
          return {
            text: sanitized.substring(0, 500), // Limit preview length
            timestamp: entry.timestamp ?? new Date().toISOString(),
          };
        }
      }

      // Handle content blocks
      if (Array.isArray(content)) {
        const textContent = content
          .filter(isTextContent)
          .map((b) => b.text)
          .join(' ');

        if (textContent && !textContent.startsWith('<command-name>')) {
          // Apply sanitization for display
          const sanitized = sanitizeDisplayContent(textContent);
          if (sanitized.length > 0) {
            fileStream2.destroy();
            return {
              text: sanitized.substring(0, 500),
              timestamp: entry.timestamp ?? new Date().toISOString(),
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting first message from ${filePath}:`, error);
  }

  // Return first command message as fallback for command-only sessions
  return firstCommandMessage;
}

/**
 * Extract CWD (current working directory) from the first entry.
 * Used to get the actual project path from encoded directory names.
 */
export async function extractCwd(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line) as ChatHistoryEntry;
      // Only conversational entries have cwd
      if ('cwd' in entry && entry.cwd) {
        fileStream.destroy();
        return entry.cwd;
      }
    }
  } catch (error) {
    console.error(`Error extracting cwd from ${filePath}:`, error);
  }

  return null;
}

// =============================================================================
// Metrics Calculation
// =============================================================================

/**
 * Calculate session metrics from parsed messages.
 */
export function calculateMetrics(messages: ParsedMessage[]): SessionMetrics {
  if (messages.length === 0) {
    return { ...EMPTY_METRICS };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let costUsd = 0;

  // Get timestamps for duration
  const timestamps = messages.map((m) => m.timestamp.getTime()).filter((t) => !isNaN(t));

  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;

  for (const msg of messages) {
    if (msg.usage) {
      inputTokens += msg.usage.input_tokens || 0;
      outputTokens += msg.usage.output_tokens || 0;
      cacheReadTokens += msg.usage.cache_read_input_tokens || 0;
      cacheCreationTokens += msg.usage.cache_creation_input_tokens || 0;
    }
  }

  return {
    durationMs: maxTime - minTime,
    totalTokens: inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    messageCount: messages.length,
    costUsd: costUsd > 0 ? costUsd : undefined,
  };
}

/**
 * Aggregate token usage from multiple TokenUsage objects.
 */
export function aggregateTokenUsage(usages: (TokenUsage | undefined)[]): TokenUsage {
  const result = { ...EMPTY_TOKEN_USAGE };

  for (const usage of usages) {
    if (!usage) continue;
    result.input_tokens += usage.input_tokens || 0;
    result.output_tokens += usage.output_tokens || 0;
    result.cache_read_input_tokens =
      (result.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    result.cache_creation_input_tokens =
      (result.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  }

  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Count messages in a JSONL file without full parsing.
 */
export async function countMessages(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  let count = 0;
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      count++;
    }
  }

  return count;
}

/**
 * Count user chunk messages (real user inputs that start User chunks) in a JSONL file.
 * This matches the UserChunk count in the UI.
 *
 * Uses isParsedUserChunkMessage which:
 * - Includes real user messages (isMeta!=true, has text/image content)
 * - Includes slash commands (<command-name>) as visible user input
 * - Excludes command output (<local-command-stdout>) - those are System chunks
 * - Excludes noise (<local-command-caveat>, <system-reminder>)
 */
export async function countTriggerMessages(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  let count = 0;
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed) as ChatHistoryEntry;
      // Parse entry to ParsedMessage to use the new type guard
      const parsed = parseChatHistoryEntry(entry);
      if (parsed && isParsedUserChunkMessage(parsed)) {
        count++;
      }
    } catch (error) {
      // Skip invalid lines
      continue;
    }
  }

  return count;
}

/**
 * Check if a file is a valid JSONL file by checking first line.
 */
export async function isValidJsonl(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      JSON.parse(line);
      fileStream.destroy();
      return true;
    }
  } catch {
    fileStream.destroy();
    return false;
  }

  return false;
}

/**
 * Extract text content from a message for display.
 * This version applies content sanitization to filter XML-like tags.
 */
export function extractTextContent(message: ParsedMessage): string {
  let rawText: string;

  if (typeof message.content === 'string') {
    rawText = message.content;
  } else {
    rawText = message.content
      .filter(isTextContent)
      .map((block) => block.text)
      .join('\n');
  }

  // Apply sanitization to remove XML-like tags for display
  return sanitizeDisplayContent(rawText);
}

/**
 * Extract raw text content from a message without sanitization.
 * Used for debug purposes where you need to see the original content including XML tags.
 */
export function extractRawTextContent(message: ParsedMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter(isTextContent)
    .map((block) => block.text)
    .join('\n');
}

/**
 * Get all Task calls from a list of messages.
 */
export function getTaskCalls(messages: ParsedMessage[]): ToolCall[] {
  return messages.flatMap((m) => m.toolCalls.filter((tc) => tc.isTask));
}

/**
 * Check if a session is ongoing (AI response in progress).
 *
 * A session is considered "ongoing" if:
 * 1. The last non-noise message is an assistant message with tool_use blocks
 *    but no corresponding tool_result has been received yet (orphaned tool calls)
 * 2. Or if the last message is an assistant message with only thinking blocks
 *
 * This is an efficient check that reads from the end of the file.
 *
 * @param filePath - Path to the session JSONL file
 * @returns Promise<boolean> - true if session is ongoing
 */
export async function checkSessionOngoing(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  // Read the file content - we need to check the last few messages
  // For efficiency, we read all lines but only process the last relevant ones
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Collect relevant messages (skip noise)
  const recentMessages: Array<{
    type: string;
    hasToolUse: boolean;
    hasToolResult: boolean;
    hasTextOutput: boolean;
    toolUseIds: Set<string>;
    toolResultIds: Set<string>;
    isMeta: boolean;
  }> = [];

  const NOISE_TYPES = ['system', 'summary', 'file-history-snapshot', 'queue-operation'];

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry = JSON.parse(trimmed) as ChatHistoryEntry;

        // Skip entries without uuid
        if (!entry.uuid) continue;

        // Skip noise types
        if (NOISE_TYPES.includes(entry.type)) continue;

        // Extract message properties
        const type = entry.type;
        let hasToolUse = false;
        let hasToolResult = false;
        let hasTextOutput = false;
        const toolUseIds = new Set<string>();
        const toolResultIds = new Set<string>();
        const isMeta = (entry as any).isMeta === true;

        const content = (entry as any).message?.content;

        if (type === 'assistant' && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.id) {
              hasToolUse = true;
              toolUseIds.add(block.id);
            }
            if (block.type === 'text' && block.text && block.text.trim().length > 0) {
              hasTextOutput = true;
            }
          }
        }

        if (type === 'user' && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              hasToolResult = true;
              toolResultIds.add(block.tool_use_id);
            }
          }
        }

        recentMessages.push({
          type,
          hasToolUse,
          hasToolResult,
          hasTextOutput,
          toolUseIds,
          toolResultIds,
          isMeta,
        });
      } catch {
        // Skip invalid lines
        continue;
      }
    }
  } catch (error) {
    console.error(`Error checking session ongoing status: ${error}`);
    return false;
  }

  // Analyze the messages to determine if ongoing
  // Work backwards to find the last assistant message and check if it has pending tool calls
  if (recentMessages.length === 0) {
    return false;
  }

  // Find the last assistant message
  let lastAssistantIndex = -1;
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (recentMessages[i].type === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  if (lastAssistantIndex === -1) {
    // No assistant message found
    return false;
  }

  const lastAssistant = recentMessages[lastAssistantIndex];

  // If the last assistant message has text output, it's not ongoing
  if (lastAssistant.hasTextOutput) {
    return false;
  }

  // If the last assistant message has tool calls, check if they have results
  if (lastAssistant.hasToolUse) {
    // Collect all tool results that came after this assistant message
    const receivedResults = new Set<string>();
    for (let i = lastAssistantIndex + 1; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      if (msg.hasToolResult) {
        msg.toolResultIds.forEach(id => receivedResults.add(id));
      }
    }

    // Check if any tool calls are still pending
    for (const toolUseId of lastAssistant.toolUseIds) {
      if (!receivedResults.has(toolUseId)) {
        // Found a tool call without a result - session is ongoing
        return true;
      }
    }
  }

  // If we reach here after the last assistant message, check what comes after
  // If the last message is a user message without isMeta (real user input waiting for response)
  // that would mean waiting for AI, but typically the last AI message has been processed
  // For our purposes, we only mark ongoing if there are pending tool calls
  return false;
}

// =============================================================================
// Type Guard Functions (Re-exported from claude.ts)
// =============================================================================

export {
  isParsedRealUserMessage as isRealUserMessage,
  isParsedInternalUserMessage as isInternalUserMessage,
  isParsedResponseUserMessage as isResponseUserMessage,
  isParsedAssistantMessage as isAssistantMessage
};
