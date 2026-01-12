/**
 * Claude Code JSONL Format Specification
 * Minimal, implementation-focused type definitions
 */

// =============================================================================
// Core Types
// =============================================================================

export type EntryType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ContentType = 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'image';
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;

// =============================================================================
// Content Blocks
// =============================================================================

export interface BaseContent {
  type: ContentType;
}

export interface TextContent extends BaseContent {
  type: 'text';
  text: string;
}

export interface ThinkingContent extends BaseContent {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface ToolUseContent extends BaseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent extends BaseContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ImageContent extends BaseContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export type ContentBlock = TextContent | ThinkingContent | ToolUseContent | ToolResultContent | ImageContent;

// =============================================================================
// Messages
// =============================================================================

export interface UsageMetadata {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
}

export interface AssistantMessage {
  role: 'assistant';
  model: string;
  id: string;
  type: 'message';
  content: ContentBlock[];
  stop_reason: StopReason;
  stop_sequence: string | null;
  usage: UsageMetadata;
}

// =============================================================================
// JSONL Entries
// =============================================================================

export interface BaseEntry {
  type: EntryType;
  timestamp?: string;
  uuid?: string;
}

export interface ConversationalEntry extends BaseEntry {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: 'external';
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  slug?: string;
}

/**
 * CRITICAL: User entries serve two purposes:
 *
 * 1. Real User Input (chunk starters):
 *    - isMeta: false or undefined
 *    - content: string
 *    - These START new chunks
 *
 * 2. Response Messages (part of response flow):
 *    a) Internal (tool results):
 *       - isMeta: true
 *       - content: array with tool_result blocks
 *    b) Interruptions:
 *       - isMeta: false
 *       - content: array (not string)
 */
export interface UserEntry extends ConversationalEntry {
  type: 'user';
  message: UserMessage;
  isMeta?: boolean;
  agentId?: string;
  // Present when isMeta: true
  toolUseResult?: {
    success: boolean;
    commandName?: string;
  };
  sourceToolUseID?: string;
  sourceToolAssistantUUID?: string;
}

export interface AssistantEntry extends ConversationalEntry {
  type: 'assistant';
  message: AssistantMessage;
  requestId: string;
  agentId?: string;
}

export interface SystemEntry extends ConversationalEntry {
  type: 'system';
  subtype: 'turn_duration' | 'init';
  durationMs: number;
  isMeta: boolean;
}

export interface SummaryEntry extends BaseEntry {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

export interface FileHistorySnapshotEntry extends BaseEntry {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, string>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

export type ChatHistoryEntry = UserEntry | AssistantEntry | SystemEntry | SummaryEntry | FileHistorySnapshotEntry;

// =============================================================================
// Type Guards (As Used by ChunkBuilder)
// =============================================================================

/**
 * Real user message - starts a new chunk.
 * Must be: type='user' AND isMeta!=true AND content is string
 */
export function isRealUserMessage(entry: ChatHistoryEntry): entry is UserEntry {
  return entry.type === 'user'
    && entry.isMeta !== true
    && typeof (entry as UserEntry).message?.content === 'string';
}

/**
 * Response user message - part of response flow (does not start chunks).
 * Includes both tool results (isMeta: true) and interruptions (array content).
 */
export function isResponseUserMessage(entry: ChatHistoryEntry): entry is UserEntry {
  if (entry.type !== 'user') return false;

  const userEntry = entry as UserEntry;

  // Tool results: isMeta: true
  if (userEntry.isMeta === true) return true;

  // Interruptions: array content (not string)
  if (Array.isArray(userEntry.message?.content)) return true;

  return false;
}

/**
 * Internal user message (tool results only).
 * Subset of response user messages with isMeta: true.
 */
export function isInternalUserMessage(entry: ChatHistoryEntry): entry is UserEntry {
  return entry.type === 'user' && (entry as UserEntry).isMeta === true;
}

/**
 * Assistant message.
 */
export function isAssistantMessage(entry: ChatHistoryEntry): entry is AssistantEntry {
  return entry.type === 'assistant';
}

/**
 * Subagent entry.
 */
export function isSubagentEntry(entry: ChatHistoryEntry): boolean {
  return 'isSidechain' in entry && entry.isSidechain === true && 'agentId' in entry && !!(entry as any).agentId;
}

// =============================================================================
// Content Type Guards
// =============================================================================

export function isTextContent(content: ContentBlock): content is TextContent {
  return content.type === 'text';
}

export function isThinkingContent(content: ContentBlock): content is ThinkingContent {
  return content.type === 'thinking';
}

export function isToolUseContent(content: ContentBlock): content is ToolUseContent {
  return content.type === 'tool_use';
}

export function isToolResultContent(content: ContentBlock): content is ToolResultContent {
  return content.type === 'tool_result';
}

export function isImageContent(content: ContentBlock): content is ImageContent {
  return content.type === 'image';
}

// =============================================================================
// Message Flow Pattern
// =============================================================================

/**
 * Typical conversation flow:
 *
 * 1. User types → type: "user", isMeta: false, content: string → STARTS CHUNK
 * 2. Assistant responds → type: "assistant", may contain tool_use
 * 3. Tool executes → type: "user", isMeta: true, contains tool_result → PART OF RESPONSE
 * 4. User interrupts → type: "user", isMeta: false, content: array → PART OF RESPONSE
 * 5. Assistant continues → type: "assistant"
 *
 * Key Rules:
 * - Real user messages (string content, !isMeta) START chunks
 * - Response user messages (array content OR isMeta:true) are PART of responses
 * - Assistant messages are always part of responses
 *
 * Tool Linking:
 * - tool_use.id in assistant message
 * - tool_result.tool_use_id in internal user message
 * - Also: sourceToolUseID field directly on internal user entry
 */

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract tool uses from assistant entry.
 */
export function extractToolUses(entry: AssistantEntry): ToolUseContent[] {
  return entry.message.content.filter(isToolUseContent);
}

/**
 * Extract tool results from internal user entry.
 */
export function extractToolResults(entry: UserEntry): ToolResultContent[] {
  if (!Array.isArray(entry.message.content)) return [];
  return entry.message.content.filter(isToolResultContent);
}

/**
 * Link tool uses with their results.
 */
export function linkToolUsesWithResults(
  entries: ChatHistoryEntry[]
): Map<string, { toolUse: ToolUseContent; toolResult: ToolResultContent | null }> {
  const toolMap = new Map();

  // Collect tool uses
  for (const entry of entries) {
    if (isAssistantMessage(entry)) {
      for (const toolUse of extractToolUses(entry)) {
        toolMap.set(toolUse.id, { toolUse, toolResult: null });
      }
    }
  }

  // Link results
  for (const entry of entries) {
    if (isInternalUserMessage(entry)) {
      for (const toolResult of extractToolResults(entry)) {
        const execution = toolMap.get(toolResult.tool_use_id);
        if (execution) {
          execution.toolResult = toolResult;
        }
      }
    }
  }

  return toolMap;
}

/**
 * Extract text content from message.
 */
export function extractTextContent(entry: UserEntry | AssistantEntry): string {
  const content = entry.message.content;

  if (typeof content === 'string') return content;

  return content
    .filter(isTextContent)
    .map(block => block.text)
    .join('\n');
}
