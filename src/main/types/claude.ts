/**
 * Complete type definitions for Claude Code Visualizer.
 * Single source of truth for JSONL format and application types.
 *
 * This file contains:
 * - Core JSONL format types (from raw .jsonl files)
 * - Application-specific types (Project, Session, ParsedMessage, etc.)
 * - Type guards for both raw JSONL entries and parsed messages
 * - Helper functions for extracting and linking data
 * - Constants for initialization
 */

// =============================================================================
// Core JSONL Types
// =============================================================================

export type EntryType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot' | 'queue-operation';
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
 * Tool use result data - preserves full structure from JSONL entries.
 *
 * The structure varies significantly by tool type:
 * - File tools: { type, success, filePath, content, structuredPatch, ... }
 * - Task tools: { status, prompt, agentId, content, totalDurationMs, totalTokens, usage, ... }
 * - AskUserQuestion: { questions, answers }
 * - Bash: { stdout, stderr, exitCode, ... }
 *
 * Using Record<string, unknown> to preserve all data without loss.
 */
export type ToolUseResultData = Record<string, unknown>;

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

  toolUseResult?: ToolUseResultData;
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

export interface QueueOperationEntry extends BaseEntry {
  type: 'queue-operation';
  operation: string;
}

export type ChatHistoryEntry = UserEntry | AssistantEntry | SystemEntry | SummaryEntry | FileHistorySnapshotEntry | QueueOperationEntry;

// =============================================================================
// Type Guards for Raw JSONL Entries
// =============================================================================

/**
 * Real user message - starts a new chunk/group.
 * Must be: type='user' AND isMeta!=true AND (string content OR array with text/image blocks)
 *
 * This is the PRIMARY classifier for conversation group boundaries.
 * All real user messages (not noise) should start new groups.
 *
 * Accepts both formats:
 * - Older sessions: content as string
 * - Newer sessions: content as array with text/image blocks
 *
 * Note: For chunk creation, prefer `isParsedUserChunkMessage()` which also filters noise messages.
 */
export function isRealUserMessage(entry: ChatHistoryEntry): entry is UserEntry {
  if (entry.type !== 'user') return false;
  if (entry.isMeta === true) return false;

  const userEntry = entry as UserEntry;
  const content = userEntry.message?.content;

  // String content format (older sessions)
  if (typeof content === 'string') return true;

  // Array content format (newer sessions)
  if (Array.isArray(content)) {
    // Filter out system-generated interruption messages
    if (content.length === 1 &&
        content[0].type === 'text' &&
        content[0].text === '[Request interrupted by user for tool use]') {
      return false;
    }

    // Check if it contains text or image blocks (real user input)
    // Exclude arrays with only tool_result blocks (those are internal messages)
    return content.some(block =>
      block.type === 'text' || block.type === 'image'
    );
  }

  return false;
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
  // IMPORTANT: Not all array content is interruption!
  // Newer sessions use array format for ALL messages: [{type:'text', text:'...'}]
  // Only classify as interruption if it does NOT contain text/image blocks
  const content = userEntry.message?.content;
  if (Array.isArray(content)) {
    // Check if this is a real user message with text/image content
    const hasUserContent = content.some(block =>
      block && typeof block === 'object' && (block.type === 'text' || block.type === 'image')
    );

    // If it has text/image blocks, it's a real user message, not a response
    if (hasUserContent) {
      return false; // NOT a response message
    }

    // Otherwise it's an interruption or internal message
    return true;
  }

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

/**
 * Task tool result - internal user message that contains a tool_result for a Task tool.
 * Used to link Task tool calls with their subagent executions.
 */
export function isTaskToolResult(entry: ChatHistoryEntry): entry is UserEntry {
  if (entry.type !== 'user') return false;
  if (!entry.isMeta) return false;

  const userEntry = entry as UserEntry;
  if (!userEntry.sourceToolUseID) return false;

  // Check if content contains a tool_result block
  if (!Array.isArray(userEntry.message?.content)) return false;

  return userEntry.message.content.some(block =>
    block && typeof block === 'object' && block.type === 'tool_result'
  );
}

// =============================================================================
// Noise Filtering Type Guards
// =============================================================================

/**
 * Hard noise message - NEVER rendered or counted in the UI.
 * These are low-level system messages that should be completely invisible.
 *
 * Filtered types:
 * - 'system' entries
 * - 'summary' entries
 * - 'file-history-snapshot' entries
 * - 'queue-operation' entries
 *
 * Filtered user messages:
 * - Messages containing ONLY these system metadata tags (no real content):
 *   - <local-command-caveat>
 *   - <system-reminder>
 *
 * Example hard noise:
 * ```json
 * {"type":"user","message":{"content":"<local-command-caveat>...</local-command-caveat>"},"isMeta":true}
 * ```
 */
export function isHardNoiseMessage(entry: ChatHistoryEntry): boolean {
  // Store type to avoid TypeScript narrowing issues
  const entryType = entry.type;

  // Filter structural metadata types - these should never be displayed
  if (entryType === 'system') return true;
  if (entryType === 'summary') return true;
  if (entryType === 'file-history-snapshot') return true;
  if (entryType === 'queue-operation') return true;

  // Filter user messages with ONLY system metadata tags (no real content)
  if (entry.type === 'user') {
    const userEntry = entry as UserEntry;
    const content = userEntry.message?.content;

    if (typeof content === 'string') {
      // These are system-generated metadata, not user input
      const hardNoiseTags = [
        '<local-command-caveat>',
        '<system-reminder>'
      ];

      // Check if content contains ONLY noise tags (trim whitespace)
      const trimmedContent = content.trim();

      // If the content is wrapped in a noise tag, it's hard noise
      for (const tag of hardNoiseTags) {
        const openTag = tag;
        const closeTag = tag.replace('<', '</');
        if (trimmedContent.startsWith(openTag) && trimmedContent.endsWith(closeTag)) {
          return true;
        }
      }
    }
  }

  return false;
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
 * Message Categories (New 4-Category System):
 *
 * 1. USER MESSAGES (create UserChunks):
 *    - Genuine user input that initiates a new request/response cycle
 *    - Detected by: isParsedUserChunkMessage() type guard
 *    - Requirements: type='user', isMeta!=true, has text/image content
 *    - Excludes: <local-command-stdout>, <local-command-caveat>, <system-reminder>
 *    - Allows: <command-name> (slash commands like /model are visible user input)
 *
 * 2. SYSTEM MESSAGES (create SystemChunks):
 *    - Command output from slash commands
 *    - Detected by: isParsedSystemChunkMessage() type guard
 *    - Contains <local-command-stdout> tag
 *    - Renders on LEFT side like AI responses
 *
 * 3. HARD NOISE MESSAGES (filtered out):
 *    - System-generated metadata that should NEVER be displayed
 *    - Detected by: isParsedHardNoiseMessage() type guard
 *    - Includes: system/summary/file-history-snapshot/queue-operation entries
 *    - Includes: User messages with ONLY <local-command-caveat> or <system-reminder>
 *
 * 4. AI MESSAGES (create AIChunks):
 *    - All assistant messages and flow messages between User/System/HardNoise
 *    - Includes: assistant messages, tool results, interruptions
 *    - Consecutive AI messages are grouped into single AIChunk
 *    - AIChunks are INDEPENDENT - no longer paired with UserChunks
 *
 * Key Rules:
 * - User messages START UserChunks (render on RIGHT)
 * - System messages START SystemChunks (render on LEFT)
 * - AI messages are GROUPED into independent AIChunks (render on LEFT)
 * - Hard noise messages are FILTERED OUT entirely
 *
 * Tool Linking:
 * - tool_use.id in assistant message
 * - tool_result.tool_use_id in internal user message
 * - Also: sourceToolUseID field directly on internal user entry
 */

// =============================================================================
// Helper Functions for JSONL Entries
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

// =============================================================================
// Application-Specific Type Aliases
// =============================================================================

/**
 * Token usage statistics (alias for API compatibility).
 * Maps to UsageMetadata from the spec.
 */
export type TokenUsage = UsageMetadata;

/**
 * Message type classification for parsed messages.
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot' | 'queue-operation';

/**
 * Message category for chunk building.
 * Used to classify messages into one of four categories for independent chunk creation.
 */
export type MessageCategory = 'user' | 'system' | 'hardNoise' | 'ai';

// =============================================================================
// Project & Session Types
// =============================================================================

/**
 * Project information derived from ~/.claude/projects/ directory.
 */
export interface Project {
  /** Encoded directory name (e.g., "-Users-bskim-myproject") */
  id: string;
  /** Decoded actual filesystem path */
  path: string;
  /** Display name (last path segment) */
  name: string;
  /** List of session IDs (JSONL filenames without extension) */
  sessions: string[];
  /** Unix timestamp when project directory was created */
  createdAt: number;
  /** Unix timestamp of most recent session activity */
  mostRecentSession?: number;
}

/**
 * Session metadata and summary.
 */
export interface Session {
  /** Session UUID (JSONL filename without extension) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Project filesystem path */
  projectPath: string;
  /** Todo data from ~/.claude/todos/{id}.json if exists */
  todoData?: unknown;
  /** Unix timestamp when session file was created */
  createdAt: number;
  /** First user message text (for preview) */
  firstMessage?: string;
  /** Timestamp of first user message (RFC3339) */
  messageTimestamp?: string;
  /** Whether this session has subagents */
  hasSubagents: boolean;
  /** Total message count in the session */
  messageCount: number;
}

/**
 * Aggregated metrics for a session or chunk.
 */
export interface SessionMetrics {
  /** Duration in milliseconds */
  durationMs: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cache read tokens */
  cacheReadTokens: number;
  /** Cache creation tokens */
  cacheCreationTokens: number;
  /** Number of messages */
  messageCount: number;
  /** Estimated cost in USD */
  costUsd?: number;
}

// =============================================================================
// Parsed Message Types
// =============================================================================

/**
 * Parsed and enriched message from JSONL.
 * This is the application's internal representation after parsing raw JSONL entries.
 */
export interface ParsedMessage {
  /** Unique message identifier */
  uuid: string;
  /** Parent message UUID for threading */
  parentUuid: string | null;
  /** Message type */
  type: MessageType;
  /** Message timestamp */
  timestamp: Date;
  /** Message role if present */
  role?: string;
  /** Message content (string or content blocks) */
  content: ContentBlock[] | string;
  /** Token usage for this message */
  usage?: TokenUsage;
  /** Model used for this response */
  model?: string;
  // Metadata
  /** Current working directory when message was created */
  cwd?: string;
  /** Git branch context */
  gitBranch?: string;
  /** Agent ID for subagent messages */
  agentId?: string;
  /** Whether this is a sidechain message */
  isSidechain: boolean;
  /** Whether this is a meta message */
  isMeta: boolean;
  /** User type ("external" for user input) */
  userType?: string;
  // Extracted tool information
  /** Tool calls made in this message */
  toolCalls: ToolCall[];
  /** Tool results received in this message */
  toolResults: ToolResult[];
  /** Source tool use ID if this is a tool result message */
  sourceToolUseID?: string;
  /** Source assistant UUID if this is a tool result message */
  sourceToolAssistantUUID?: string;
  /** Tool use result information if this is a tool result message */
  toolUseResult?: ToolUseResultData;
}

/**
 * Tool call extracted from assistant message.
 */
export interface ToolCall {
  /** Tool use ID for linking to results */
  id: string;
  /** Tool name */
  name: string;
  /** Tool input parameters */
  input: Record<string, unknown>;
  /** Whether this is a Task (subagent) tool call */
  isTask: boolean;
  /** Task description if isTask */
  taskDescription?: string;
  /** Task subagent type if isTask */
  taskSubagentType?: string;
}

/**
 * Tool result extracted from user message.
 */
export interface ToolResult {
  /** Corresponding tool_use ID */
  toolUseId: string;
  /** Result content */
  content: string | unknown[];
  /** Whether the tool execution errored */
  isError: boolean;
}

// =============================================================================
// Subagent Types
// =============================================================================

/**
 * Resolved subagent information.
 */
export interface Process {
  /** Agent ID extracted from filename */
  id: string;
  /** Path to the subagent JSONL file */
  filePath: string;
  /** Parsed messages from the subagent session */
  messages: ParsedMessage[];
  /** When the subagent started */
  startTime: Date;
  /** When the subagent ended */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Aggregated metrics for the subagent */
  metrics: SessionMetrics;
  /** Task description from parent Task call */
  description?: string;
  /** Subagent type from Task call (e.g., "Explore", "Plan") */
  subagentType?: string;
  /** Whether executed in parallel with other subagents */
  isParallel: boolean;
  /** The tool_use ID of the Task call that spawned this */
  parentTaskId?: string;
}

// =============================================================================
// Chunk Types (for visualization)
// =============================================================================

/**
 * Base chunk properties shared by all chunk types.
 */
export interface BaseChunk {
  /** Unique chunk identifier */
  id: string;
  /** When the chunk started */
  startTime: Date;
  /** When the chunk ended */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Aggregated metrics for the chunk */
  metrics: SessionMetrics;
}

/**
 * User chunk - represents a single user input message.
 * This is separate from AI responses to support independent visualization.
 */
export interface UserChunk extends BaseChunk {
  /** Discriminator for chunk type */
  chunkType: 'user';
  /** The user message */
  userMessage: ParsedMessage;
}

/**
 * AI chunk - represents all assistant responses to a user message.
 * Contains responses, tool executions, and subagent spawns.
 *
 * NOTE: AI chunks are independent - they no longer reference a parent user chunk.
 */
export interface AIChunk extends BaseChunk {
  /** Discriminator for chunk type */
  chunkType: 'ai';
  /** All assistant responses and internal messages */
  responses: ParsedMessage[];
  /** Processes spawned during this chunk */
  processes: Process[];
  /** Sidechain messages within this chunk */
  sidechainMessages: ParsedMessage[];
  /** Tool executions in this chunk */
  toolExecutions: ToolExecution[];
}

/**
 * System chunk - represents command output rendered like AI.
 */
export interface SystemChunk extends BaseChunk {
  chunkType: 'system';
  message: ParsedMessage;
  commandOutput: string;  // Extracted from <local-command-stdout>
}

/**
 * A chunk can be either a user input, AI response, or system output.
 * This discriminated union enables separate visualization and processing.
 */
export type Chunk = UserChunk | AIChunk | SystemChunk;

/**
 * Tool execution with timing information.
 */
export interface ToolExecution {
  /** The tool call */
  toolCall: ToolCall;
  /** The tool result if received */
  result?: ToolResult;
  /** When the tool was called */
  startTime: Date;
  /** When the result was received */
  endTime?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
}

// =============================================================================
// Conversation Group Types (Simplified Grouping Strategy)
// =============================================================================

/**
 * Task execution links a Task tool call to its subagent execution.
 * This provides a complete view of async subagent work initiated by Task tool.
 */
export interface TaskExecution {
  /** The Task tool_use block that initiated the subagent */
  taskCall: ToolCall;
  /** When the Task tool was called */
  taskCallTimestamp: Date;
  /** The linked subagent execution */
  subagent: Process;
  /** The isMeta:true tool_result message for this Task */
  toolResult: ParsedMessage;
  /** When the tool result was received */
  resultTimestamp: Date;
  /** Duration from task call to result */
  durationMs: number;
}

/**
 * ConversationGroup represents a natural grouping in the conversation flow:
 * - One real user message (isMeta: false, string content)
 * - All AI responses until the next user message (assistant messages + internal messages)
 * - Subagents spawned during this group
 * - Tool executions (excluding Task tools with subagents to avoid duplication)
 * - Task executions (Task tools with their subagent results)
 *
 * This is a simplified alternative to Chunks that focuses on natural conversation boundaries.
 */
export interface ConversationGroup {
  /** Unique group identifier */
  id: string;
  /** Group type - currently only one type but extensible */
  type: 'user-ai-exchange';
  /** The real user message that starts this group (isMeta: false) */
  userMessage: ParsedMessage;
  /** All AI responses: assistant messages and internal messages (tool results, etc.) */
  aiResponses: ParsedMessage[];
  /** Processes spawned during this group */
  processes: Process[];
  /** Tool executions (excluding Task tools that have matching processes) */
  toolExecutions: ToolExecution[];
  /** Task tool calls with their subagent executions */
  taskExecutions: TaskExecution[];
  /** When the group started (user message timestamp) */
  startTime: Date;
  /** When the group ended (last AI response timestamp) */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Aggregated metrics for the group */
  metrics: SessionMetrics;
}

// =============================================================================
// Semantic Step Types (Enhanced Chunk Visualization)
// =============================================================================

/**
 * Semantic step types for breakdown within responses.
 */
export type SemanticStepType =
  | 'thinking'      // Extended thinking content
  | 'tool_call'     // Tool invocation
  | 'tool_result'   // Tool result received
  | 'subagent'      // Subagent execution
  | 'output'        // Main text output
  | 'interruption'; // User interruption

/**
 * A semantic step represents a logical unit of work within a response.
 *
 * Note: Task tool_use blocks are filtered during extraction when corresponding
 * subagents exist. Since Task calls spawn async subagents, the tool_call and
 * subagent represent the same execution. Filtering prevents duplicate entries
 * in the Gantt chart. Orphaned Task calls (without matching subagents) are
 * retained as fallback to ensure visibility of all work.
 */
export interface SemanticStep {
  /** Unique step identifier */
  id: string;
  /** Step type */
  type: SemanticStepType;
  /** When the step started */
  startTime: Date;
  /** When the step ended */
  endTime?: Date;
  /** Duration in milliseconds */
  durationMs: number;

  /** Content varies by type */
  content: {
    thinkingText?: string;      // For thinking
    toolName?: string;          // For tool_call/result
    toolInput?: unknown;        // For tool_call
    toolResultContent?: string; // For tool_result
    isError?: boolean;          // For tool_result
    toolUseResult?: ToolUseResultData; // For tool_result - enriched data from message
    subagentId?: string;        // For subagent
    subagentDescription?: string;
    outputText?: string;        // For output
    sourceModel?: string;       // For tool_call - model from source assistant message
  };

  /** Token attribution */
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };

  /** Parallel execution */
  isParallel?: boolean;
  groupId?: string;

  /** Context (main agent vs subagent) */
  context: 'main' | 'subagent';
  agentId?: string;

  /** Source message UUID (for grouping steps by assistant message) */
  sourceMessageId?: string;

  /** Effective end time after gap filling (extends to next step or chunk end) */
  effectiveEndTime?: Date;

  /** Effective duration including waiting time until next step */
  effectiveDurationMs?: number;

  /** Whether timing was gap-filled vs having original endTime */
  isGapFilled?: boolean;

  /** Context tokens for this step (cache_read + cache_creation + input) */
  contextTokens?: number;

  /** Cumulative context up to this step (session-wide accumulation) */
  accumulatedContext?: number;

  /** Token breakdown for step-level estimation */
  tokenBreakdown?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
}

/**
 * Semantic step group for collapsible visualization.
 * Groups multiple micro-steps by their source assistant message.
 */
export interface SemanticStepGroup {
  /** Unique group ID */
  id: string;
  /** Display label (e.g., "Assistant Response", "Tool: Read") */
  label: string;
  /** Steps in this group */
  steps: SemanticStep[];
  /** true if multiple steps grouped, false if standalone */
  isGrouped: boolean;
  /** Assistant message UUID if grouped */
  sourceMessageId?: string;
  /** Earliest step start */
  startTime: Date;
  /** Latest step end */
  endTime: Date;
  /** Sum of all step durations */
  totalDuration: number;
}

/**
 * Enhanced AI chunk with semantic step breakdown.
 * This extends AIChunk with additional visualization data.
 */
export interface EnhancedAIChunk extends AIChunk {
  /** Semantic steps extracted from messages */
  semanticSteps: SemanticStep[];
  /** Semantic steps grouped for collapsible UI */
  semanticStepGroups?: SemanticStepGroup[];
  /** Raw messages for debug sidebar */
  rawMessages: ParsedMessage[];
}

/**
 * Enhanced user chunk with additional metadata.
 */
export interface EnhancedUserChunk extends UserChunk {
  /** Raw messages for debug sidebar */
  rawMessages: ParsedMessage[];
}

/**
 * Enhanced system chunk with additional metadata.
 */
export interface EnhancedSystemChunk extends SystemChunk {
  /** Raw messages for debug sidebar */
  rawMessages: ParsedMessage[];
}

/**
 * Enhanced chunk can be user, AI, or system type.
 */
export type EnhancedChunk = EnhancedUserChunk | EnhancedAIChunk | EnhancedSystemChunk;

// =============================================================================
// Session Detail (complete parsed session)
// =============================================================================

/**
 * Complete parsed session with all data.
 */
export interface SessionDetail {
  /** Session metadata */
  session: Session;
  /** All messages in the session */
  messages: ParsedMessage[];
  /** Messages grouped into chunks */
  chunks: Chunk[];
  /** All processes in the session */
  processes: Process[];
  /** Aggregated metrics for the entire session */
  metrics: SessionMetrics;
}

/**
 * Detailed subagent information for drill-down modal.
 * Contains parsed execution data for a specific subagent.
 */
export interface SubagentDetail {
  /** Agent ID */
  id: string;
  /** Task description */
  description: string;
  /** Subagent's chunks with semantic breakdown */
  chunks: EnhancedChunk[];
  /** Semantic step groups for visualization */
  semanticStepGroups?: SemanticStepGroup[];
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Token and message metrics */
  metrics: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    messageCount: number;
  };
}

// =============================================================================
// Waterfall Chart Types
// =============================================================================

/**
 * Waterfall item for Gantt-style visualization.
 */
export interface WaterfallItem {
  /** Unique item identifier */
  id: string;
  /** Display label */
  label: string;
  /** Item start time */
  startTime: Date;
  /** Item end time */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Token usage for this item */
  tokenUsage: TokenUsage;
  /** Hierarchy depth (0 = main session) */
  level: number;
  /** Item type */
  type: 'chunk' | 'subagent' | 'tool';
  /** Whether executed in parallel */
  isParallel: boolean;
  /** Parent item ID */
  parentId?: string;
  /** Group ID for parallel items */
  groupId?: string;
  /** Additional metadata for display */
  metadata?: {
    subagentType?: string;
    toolName?: string;
    messageCount?: number;
  };
}

/**
 * Complete waterfall chart data.
 */
export interface WaterfallData {
  /** All waterfall items */
  items: WaterfallItem[];
  /** Earliest timestamp in the session */
  minTime: Date;
  /** Latest timestamp in the session */
  maxTime: Date;
  /** Total session duration in milliseconds */
  totalDurationMs: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Path encoding/decoding result.
 */
export interface PathInfo {
  /** Encoded path (directory name) */
  encoded: string;
  /** Decoded filesystem path */
  decoded: string;
  /** Display name */
  name: string;
}

/**
 * File watching event.
 */
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  projectId?: string;
  sessionId?: string;
  isSubagent: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Empty metrics constant for initialization.
 */
export const EMPTY_METRICS: SessionMetrics = {
  durationMs: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  messageCount: 0,
};

/**
 * Empty token usage constant for initialization.
 */
export const EMPTY_TOKEN_USAGE: TokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

// =============================================================================
// Application-Specific Type Guards for ParsedMessage
// =============================================================================

/**
 * Type guard to check if a ParsedMessage is a real user message.
 * This wraps the spec's type guard but works with ParsedMessage instead of UserEntry.
 *
 * Accepts both formats:
 * - Older sessions: content as string
 * - Newer sessions: content as array with text/image blocks
 *
 * Excludes command output messages (with <local-command-stdout>) which should
 * be treated as system responses, not user input that starts new chunks.
 */
export function isParsedRealUserMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  if (msg.isMeta) return false;

  const content = msg.content;

  // String content format (older sessions)
  if (typeof content === 'string') {
    return true;
  }

  // Array content format (newer sessions)
  if (Array.isArray(content)) {
    // Check if it contains text or image blocks (real user input)
    // Exclude arrays with only tool_result blocks (those are internal messages)
    return content.some(block =>
      block.type === 'text' || block.type === 'image'
    );
  }

  return false;
}

/**
 * Type guard for User chunk creation - genuine user input that starts User chunks.
 *
 * Returns true if message should create a User chunk:
 * - type='user'
 * - isMeta!=true
 * - Has text/image content
 * - Content does NOT contain: <local-command-stdout>, <local-command-caveat>, <system-reminder>
 * - Content MAY contain: <command-name> (slash commands like /model ARE user input)
 *
 * Example User chunk messages:
 * - "Help me debug this code"
 * - "<command-name>/model</command-name> Switch to sonnet"
 *
 * NOT User chunks:
 * - "<local-command-stdout>Set model to...</local-command-stdout>" → System chunk
 * - "<local-command-caveat>...</local-command-caveat>" → Hard noise
 * - "<system-reminder>...</system-reminder>" → Hard noise
 */
export function isParsedUserChunkMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  if (msg.isMeta === true) return false;

  const content = msg.content;

  // Check string content
  if (typeof content === 'string') {
    const trimmed = content.trim();

    // Exclude messages that are system output or system metadata
    // These tags indicate system-generated content, not user input
    const excludeTags = [
      '<local-command-stdout>',
      '<local-command-caveat>',
      '<system-reminder>'
    ];

    for (const tag of excludeTags) {
      if (trimmed.includes(tag)) {
        return false;
      }
    }

    // <command-name> is ALLOWED - it's user-initiated slash commands
    // Remaining content is genuine user input
    return trimmed.length > 0;
  }

  // Array content format (newer sessions)
  if (Array.isArray(content)) {
    // Must contain text or image blocks for real user input
    const hasUserContent = content.some(block =>
      block.type === 'text' || block.type === 'image'
    );

    if (!hasUserContent) {
      return false;
    }

    // Check text blocks for excluded tags
    const excludeTags = [
      '<local-command-stdout>',
      '<local-command-caveat>',
      '<system-reminder>'
    ];

    for (const block of content) {
      if (block.type === 'text') {
        const textBlock = block as TextContent;
        for (const tag of excludeTags) {
          if (textBlock.text.includes(tag)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  return false;
}

/**
 * Type guard for System chunk creation - command output messages.
 *
 * Returns true if message should create a System chunk:
 * - type='user' (confusingly, command output comes as user entries in JSONL)
 * - Contains <local-command-stdout> tag
 *
 * System chunks render on the LEFT side (like AI responses) with neutral gray styling.
 *
 * Example:
 * ```
 * {
 *   type: "user",
 *   content: "<local-command-stdout>Set model to sonnet...</local-command-stdout>"
 * }
 * ```
 */
export function isParsedSystemChunkMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;

  const content = msg.content;

  if (typeof content === 'string') {
    return content.includes('<local-command-stdout>');
  }

  // Array content - check text blocks
  if (Array.isArray(content)) {
    return content.some(block =>
      block.type === 'text' && (block as TextContent).text.includes('<local-command-stdout>')
    );
  }

  return false;
}

/**
 * Type guard to check if a ParsedMessage is an internal user message.
 * This wraps the spec's type guard but works with ParsedMessage instead of UserEntry.
 */
export function isParsedInternalUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user' && msg.isMeta === true;
}

/**
 * Type guard to check if a ParsedMessage is a command output message.
 *
 * Command output messages are type:"user" but should display as assistant/system messages.
 * They contain command output wrapped in <local-command-stdout> tags.
 *
 * Example:
 * ```
 * {
 *   type: "user",
 *   content: "<local-command-stdout>Set model to sonnet...</local-command-stdout>"
 * }
 * ```
 */
export function isParsedCommandOutputMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  const content = msg.content;
  if (typeof content === 'string') {
    return content.includes('<local-command-stdout>');
  }
  return false;
}

/**
 * Type guard for ParsedMessage that should be included in responses (not start new chunks).
 * This wraps the spec's type guard but works with ParsedMessage instead of UserEntry.
 */
export function isParsedResponseUserMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;

  // Internal messages (tool results) - isMeta: true
  if (msg.isMeta === true) return true;

  // Command output messages - should be treated as system responses
  if (isParsedCommandOutputMessage(msg)) return true;

  // Interruption messages - isMeta: false but array content
  // IMPORTANT: Not all array content is interruption!
  // Newer sessions use array format for ALL messages: [{type:'text', text:'...'}]
  // Only classify as interruption if:
  // 1. Array content AND
  // 2. Does NOT contain text/image blocks (i.e., only tool_result blocks)
  if (Array.isArray(msg.content)) {
    // Check if this is a real user message with text/image content
    // Real user messages have text or image blocks
    const hasUserContent = msg.content.some(block =>
      block.type === 'text' || block.type === 'image'
    );

    // If it has text/image blocks, it's a real user message, not a response
    if (hasUserContent) {
      return false; // NOT a response message, should be a trigger
    }

    // Otherwise it's an interruption or internal message (array content but no text/image)
    return true;
  }

  return false;
}


/**
 * Type guard to check if a ParsedMessage is an assistant message.
 */
export function isParsedAssistantMessage(msg: ParsedMessage): boolean {
  return msg.type === 'assistant';
}

/**
 * Hard noise message (ParsedMessage version) - NEVER rendered or counted in the UI.
 * This wraps isHardNoiseMessage() but works with ParsedMessage instead of ChatHistoryEntry.
 *
 * Filtered types:
 * - 'system' entries
 * - 'summary' entries
 * - 'file-history-snapshot' entries
 * - 'queue-operation' entries
 *
 * Filtered user messages:
 * - Messages containing ONLY these system metadata tags (no real content):
 *   - <local-command-caveat>
 *   - <system-reminder>
 *
 * Filtered assistant messages:
 * - Synthetic messages with model='<synthetic>' (system-generated placeholders)
 */
export function isParsedHardNoiseMessage(msg: ParsedMessage): boolean {
  // Filter structural metadata types - these should never be displayed
  if (msg.type === 'system') return true;
  if (msg.type === 'summary') return true;
  if (msg.type === 'file-history-snapshot') return true;
  if (msg.type === 'queue-operation') return true;

  // Filter synthetic assistant messages (system-generated placeholders)
  if (msg.type === 'assistant' && msg.model === '<synthetic>') {
    return true;
  }

  // Filter user messages with ONLY system metadata tags (no real content)
  if (msg.type === 'user') {
    const content = msg.content;

    if (typeof content === 'string') {
      // These are system-generated metadata, not user input
      const hardNoiseTags = [
        '<local-command-caveat>',
        '<system-reminder>'
      ];

      // Check if content contains ONLY noise tags (trim whitespace)
      const trimmedContent = content.trim();

      // If the content is wrapped in a noise tag, it's hard noise
      for (const tag of hardNoiseTags) {
        const openTag = tag;
        const closeTag = tag.replace('<', '</');
        if (trimmedContent.startsWith(openTag) && trimmedContent.endsWith(closeTag)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Type guard to check if a ParsedMessage is a Task tool result.
 * Used to link Task tool calls with their subagent executions.
 */
export function isParsedTaskToolResult(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  if (!msg.isMeta) return false;
  if (!msg.sourceToolUseID) return false;

  // Check if content contains a tool_result block
  if (!Array.isArray(msg.content)) return false;

  return msg.content.some(block =>
    block && typeof block === 'object' && block.type === 'tool_result'
  );
}

// =============================================================================
// Chunk Type Guards
// =============================================================================

/**
 * Type guard to check if a chunk is a UserChunk.
 */
export function isUserChunk(chunk: Chunk | EnhancedChunk): chunk is UserChunk {
  return 'chunkType' in chunk && chunk.chunkType === 'user';
}

/**
 * Type guard to check if a chunk is an AIChunk.
 */
export function isAIChunk(chunk: Chunk | EnhancedChunk): chunk is AIChunk {
  return 'chunkType' in chunk && chunk.chunkType === 'ai';
}

/**
 * Type guard to check if a chunk is an EnhancedUserChunk.
 */
export function isEnhancedUserChunk(chunk: Chunk | EnhancedChunk): chunk is EnhancedUserChunk {
  return isUserChunk(chunk) && 'rawMessages' in chunk;
}

/**
 * Type guard to check if a chunk is an EnhancedAIChunk.
 */
export function isEnhancedAIChunk(chunk: Chunk | EnhancedChunk): chunk is EnhancedAIChunk {
  return isAIChunk(chunk) && 'semanticSteps' in chunk;
}

/**
 * Type guard to check if a chunk is a SystemChunk.
 */
export function isSystemChunk(chunk: Chunk | EnhancedChunk): chunk is SystemChunk {
  return 'chunkType' in chunk && chunk.chunkType === 'system';
}

/**
 * Type guard to check if a chunk is an EnhancedSystemChunk.
 */
export function isEnhancedSystemChunk(chunk: Chunk | EnhancedChunk): chunk is EnhancedSystemChunk {
  return isSystemChunk(chunk) && 'rawMessages' in chunk;
}
