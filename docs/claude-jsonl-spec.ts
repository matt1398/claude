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

/**
 * Base for conversational entries (user, assistant, system).
 *
 * Sidechain behavior:
 * - isSidechain: false → Main agent message
 * - isSidechain: true → Subagent message
 * - sessionId: For subagents, points to parent session UUID
 */
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
 *
 * Note: This is the basic filter for user input. For chunk creation,
 * prefer `isTriggerMessage()` which also filters noise messages.
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
// Noise Filtering Type Guards
// =============================================================================

/**
 * Noise message - system-generated metadata to be filtered.
 * These messages don't contribute to conversation flow or visualization.
 *
 * Filtered patterns:
 * - file-history-snapshot entries
 * - system entries with local_command subtype
 * - user messages containing system XML tags:
 *   - <command-name>, <command-message>, <command-args>
 *   - <local-command-stdout>, <local-command-caveat>
 *   - <system-reminder>
 */
export function isNoiseMessage(entry: ChatHistoryEntry): boolean {
  // Filter file-history-snapshot entries
  if (entry.type === 'file-history-snapshot') return true;

  // Filter system entries with local_command subtype
  if (entry.type === 'system') {
    const systemEntry = entry as SystemEntry;
    return systemEntry.subtype === 'local_command' as any;
  }

  // Filter user messages with system XML tags
  if (entry.type === 'user') {
    const userEntry = entry as UserEntry;
    const content = userEntry.message?.content;

    if (typeof content === 'string') {
      const systemTags = [
        '<command-name>',
        '<command-message>',
        '<command-args>',
        '<local-command-stdout>',
        '<local-command-caveat>',
        '<system-reminder>'
      ];

      return systemTags.some(tag => content.includes(tag));
    }
  }

  return false;
}

/**
 * Trigger message - genuine user input that starts chunks.
 * This is the primary filter for chunk creation.
 *
 * Requirements:
 * - Must be type: 'user'
 * - Must have isMeta !== true
 * - Must have string content (not array)
 * - Must NOT match noise message patterns
 *
 * Flow messages (responses, tool results, interruptions) are NOT trigger messages.
 * Noise messages (system metadata) are NOT trigger messages.
 */
export function isTriggerMessage(entry: ChatHistoryEntry): entry is UserEntry {
  // Must be a real user message first
  if (!isRealUserMessage(entry)) return false;

  // Must not be noise
  return !isNoiseMessage(entry);
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
// Subagent Directory Structures
// =============================================================================

/**
 * Claude Code supports two subagent directory structures:
 *
 * NEW STRUCTURE (Current):
 * ~/.claude/projects/
 *   {project_name}/
 *     {session_uuid}.jsonl              ← Main agent
 *     {session_uuid}/
 *       agent_{agent_uuid}.jsonl         ← Subagents
 *
 * OLD STRUCTURE (Legacy, still supported):
 * ~/.claude/projects/
 *   {project_name}/
 *     {session_uuid}.jsonl              ← Main agent
 *     agent_{agent_uuid}.jsonl           ← Subagents (at root)
 *
 * Identification:
 * - Main agent: isSidechain: false (or undefined)
 * - Subagent: isSidechain: true
 * - Linking: subagent.sessionId === parent session UUID
 *
 * When scanning for subagents:
 * 1. First check {session_uuid}/ subdirectory (new structure)
 * 2. Fall back to project root for agent_*.jsonl (old structure)
 * 3. Match by sessionId field to link to parent
 */

// =============================================================================
// Message Flow Pattern
// =============================================================================

/**
 * Typical conversation flow:
 *
 * 1. User types → type: "user", isMeta: false, content: string → TRIGGER MESSAGE (STARTS CHUNK)
 * 2. Assistant responds → type: "assistant", may contain tool_use → FLOW MESSAGE (PART OF RESPONSE)
 * 3. Tool executes → type: "user", isMeta: true, contains tool_result → FLOW MESSAGE (PART OF RESPONSE)
 * 4. User interrupts → type: "user", isMeta: false, content: array → FLOW MESSAGE (PART OF RESPONSE)
 * 5. Assistant continues → type: "assistant" → FLOW MESSAGE (PART OF RESPONSE)
 *
 * Message Categories:
 *
 * 1. TRIGGER MESSAGES (start chunks):
 *    - Genuine user input that initiates a new request/response cycle
 *    - Detected by: isTriggerMessage() type guard
 *    - Requirements: type='user', isMeta!=true, string content, NOT noise
 *
 * 2. FLOW MESSAGES (part of responses):
 *    - All assistant messages
 *    - Internal user messages (tool results): isMeta=true
 *    - Interruption messages: user messages with array content
 *
 * 3. NOISE MESSAGES (filtered out):
 *    - System-generated metadata
 *    - file-history-snapshot entries
 *    - system entries with local_command subtype
 *    - User messages containing system XML tags:
 *      <command-name>, <command-message>, <command-args>,
 *      <local-command-stdout>, <local-command-caveat>, <system-reminder>
 *    - Detected by: isNoiseMessage() type guard
 *
 * Key Rules:
 * - Trigger messages (genuine user input, not noise) START chunks
 * - Flow messages (responses, tool results, interruptions) are PART of responses
 * - Noise messages are FILTERED OUT entirely
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
