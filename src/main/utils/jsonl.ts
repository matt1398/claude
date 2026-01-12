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
  JsonlEntry,
  ParsedMessage,
  ContentBlock,
  ToolCall,
  ToolResult,
  TokenUsage,
  SessionMetrics,
  MessageType,
  EMPTY_METRICS,
  EMPTY_TOKEN_USAGE,
} from '../types/claude';

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
      const entry = JSON.parse(line) as JsonlEntry;
      const parsed = parseJsonlEntry(entry);
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
export async function parseJsonlRaw(filePath: string): Promise<JsonlEntry[]> {
  const entries: JsonlEntry[] = [];

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
      entries.push(JSON.parse(line) as JsonlEntry);
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
      const entry = JSON.parse(line) as JsonlEntry;
      const parsed = parseJsonlEntry(entry);
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
export function parseJsonlEntry(entry: JsonlEntry): ParsedMessage | null {
  // Skip entries without uuid (usually metadata)
  if (!entry.uuid) {
    return null;
  }

  const type = parseMessageType(entry.type);
  if (!type) {
    return null;
  }

  const content = entry.message?.content ?? '';
  const contentBlocks = normalizeContent(content);

  // Extract tool calls and results
  const toolCalls = extractToolCalls(contentBlocks);
  const toolResults = extractToolResults(contentBlocks);

  return {
    uuid: entry.uuid,
    parentUuid: entry.parentUuid ?? null,
    type,
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    role: entry.message?.role,
    content: contentBlocks,
    usage: entry.message?.usage,
    model: entry.message?.model,
    // Metadata
    cwd: entry.cwd,
    gitBranch: entry.gitBranch,
    agentId: entry.agentId,
    isSidechain: entry.isSidechain ?? false,
    isMeta: entry.isMeta ?? false,
    userType: entry.userType,
    // Tool info
    toolCalls,
    toolResults,
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

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line) as JsonlEntry;

      // Skip non-user messages
      if (entry.type !== 'user') continue;

      // Skip caveat/command messages (following opcode's logic)
      const content = entry.message?.content;
      if (typeof content === 'string') {
        if (content.includes('<command-name>') || content.includes('<local-command-stdout>')) {
          continue;
        }
        if (content.includes('caveat')) {
          continue;
        }

        // Found a valid user message
        fileStream.destroy();
        return {
          text: content.substring(0, 500), // Limit preview length
          timestamp: entry.timestamp ?? new Date().toISOString(),
        };
      }

      // Handle content blocks
      if (Array.isArray(content)) {
        const textContent = content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text)
          .join(' ');

        if (textContent && !textContent.includes('<command-name>')) {
          fileStream.destroy();
          return {
            text: textContent.substring(0, 500),
            timestamp: entry.timestamp ?? new Date().toISOString(),
          };
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting first message from ${filePath}:`, error);
  }

  return null;
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

      const entry = JSON.parse(line) as JsonlEntry;
      if (entry.cwd) {
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
    totalTokens: inputTokens + outputTokens,
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
 */
export function extractTextContent(message: ParsedMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text!)
    .join('\n');
}

/**
 * Get all Task calls from a list of messages.
 */
export function getTaskCalls(messages: ParsedMessage[]): ToolCall[] {
  return messages.flatMap((m) => m.toolCalls.filter((tc) => tc.isTask));
}
