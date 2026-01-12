/**
 * Core type definitions for Claude Code file parsing.
 * Based on opcode's architecture and Claude Code's actual JSONL format.
 */

// =============================================================================
// JSONL Entry Types (raw file format)
// =============================================================================

/**
 * Raw JSONL entry as stored in session files.
 * Each line in a .jsonl file represents one entry.
 */
export interface JsonlEntry {
  type?: string;
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  message?: MessageData;
  // Metadata
  cwd?: string;
  gitBranch?: string;
  agentId?: string;
  sessionId?: string;
  isSidechain?: boolean;
  userType?: string;
  isMeta?: boolean;
  // Cost tracking
  costUsd?: number;
  // Tool result tracking
  sourceToolUseID?: string;
  sourceToolAssistantUUID?: string;
  toolUseResult?: {
    success: boolean;
    commandName?: string;
  };
}

/**
 * Message data within a JSONL entry.
 */
export interface MessageData {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  usage?: TokenUsage;
  model?: string;
  stop_reason?: string;
}

/**
 * Token usage statistics from Claude API response.
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * Content block types in assistant messages.
 */
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  // Text block
  text?: string;
  // Tool use block
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // Tool result block
  tool_use_id?: string;
  content?: string | unknown[];
  is_error?: boolean;
  // Thinking block
  thinking?: string;
}

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
 * Message type classification.
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot';

/**
 * Parsed and enriched message from JSONL.
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
  toolUseResult?: {
    success: boolean;
    commandName?: string;
  };
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
export interface Subagent {
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
 * A chunk represents one user message and all subsequent assistant responses.
 */
export interface Chunk {
  /** Unique chunk identifier */
  id: string;
  /** The user message that started this chunk */
  userMessage: ParsedMessage;
  /** All assistant responses in this chunk */
  responses: ParsedMessage[];
  /** When the chunk started (user message timestamp) */
  startTime: Date;
  /** When the chunk ended (last response timestamp) */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Aggregated metrics for the chunk */
  metrics: SessionMetrics;
  /** Subagents spawned during this chunk */
  subagents: Subagent[];
  /** Sidechain messages within this chunk */
  sidechainMessages: ParsedMessage[];
  /** Tool executions in this chunk */
  toolExecutions: ToolExecution[];
}

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
  /** All subagents in the session */
  subagents: Subagent[];
  /** Aggregated metrics for the entire session */
  metrics: SessionMetrics;
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
// Type Guard Functions
// =============================================================================

/**
 * Type guard to check if a message is a real user message.
 * Real user messages start chunks and are not meta messages.
 */
export function isRealUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user' && !msg.isMeta;
}

/**
 * Type guard to check if a message is an internal user message.
 * Internal user messages are tool results and are part of responses.
 */
export function isInternalUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user' && msg.isMeta === true;
}

/**
 * Type guard to check if a message is an assistant message.
 */
export function isAssistantMessage(msg: ParsedMessage): boolean {
  return msg.type === 'assistant';
}
