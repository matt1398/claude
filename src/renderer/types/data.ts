/**
 * Type definitions for the renderer process.
 * These types are aligned with src/main/types/claude.ts for IPC communication.
 */

// =============================================================================
// Electron API (exposed via preload script)
// =============================================================================

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>;
  getSessions: (projectId: string) => Promise<Session[]>;
  getSessionDetail: (projectId: string, sessionId: string) => Promise<SessionDetail | null>;
  getSessionMetrics: (projectId: string, sessionId: string) => Promise<SessionMetrics | null>;
  getWaterfallData: (projectId: string, sessionId: string) => Promise<WaterfallData | null>;
}

// =============================================================================
// Project & Session Types
// =============================================================================

/**
 * Project information from ~/.claude/projects/
 */
export interface Project {
  /** Encoded directory name (e.g., "-Users-bskim-myproject") */
  id: string;
  /** Decoded actual filesystem path */
  path: string;
  /** Display name (last path segment) */
  name: string;
  /** List of session IDs */
  sessions: string[];
  /** Unix timestamp when project directory was created */
  createdAt: number;
  /** Unix timestamp of most recent session activity */
  mostRecentSession?: number;
}

/**
 * Session metadata.
 */
export interface Session {
  /** Session UUID */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Project filesystem path */
  projectPath: string;
  /** Todo data if exists */
  todoData?: unknown;
  /** Unix timestamp when session file was created */
  createdAt: number;
  /** First user message text (for preview) */
  firstMessage?: string;
  /** Timestamp of first user message (RFC3339) */
  messageTimestamp?: string;
  /** Whether this session has subagents */
  hasSubagents: boolean;
  /** Total message count */
  messageCount: number;
}

// =============================================================================
// Metrics Types
// =============================================================================

/**
 * Token usage statistics.
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
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
// Message Types
// =============================================================================

/**
 * Message type classification.
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot';

/**
 * Content block types in messages.
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

/**
 * Parsed message from JSONL.
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
  /** Current working directory */
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
  // Tool info
  /** Tool calls made in this message */
  toolCalls: ToolCall[];
  /** Tool results received in this message */
  toolResults: ToolResult[];
  // Tool result tracking
  /** Tool use ID this message is responding to (for internal user messages) */
  sourceToolUseID?: string;
  /** Assistant UUID that made the tool call (for linking results to calls) */
  sourceToolAssistantUUID?: string;
  /** Result status for tool execution (if this is a tool result message) */
  toolUseResult?: {
    success: boolean;
    commandName?: string;
  };
}

/**
 * Type guard: Check if message is a real user message (not internal/meta).
 *
 * A real user message must have:
 * 1. type === 'user'
 * 2. isMeta !== true (false or undefined)
 * 3. content as a string (not an array)
 *
 * The string content check excludes system-generated messages that have
 * array content, such as "[Request interrupted by user for tool use]".
 * These interruption messages have `content` as an array of ContentBlock
 * rather than a plain string, distinguishing them from genuine user input.
 */
export function isRealUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user'
    && !msg.isMeta
    && typeof msg.content === 'string';
}

/**
 * Type guard: Check if message is an internal user message (tool result).
 */
export function isInternalUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user' && msg.isMeta === true;
}

/**
 * Type guard: Check if message is an assistant message.
 */
export function isAssistantMessage(msg: ParsedMessage): boolean {
  return msg.type === 'assistant';
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
// Chunk Types
// =============================================================================

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
    subagentId?: string;        // For subagent
    subagentDescription?: string;
    outputText?: string;        // For output
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
}

/**
 * Enhanced chunk with semantic step breakdown.
 */
export interface EnhancedChunk extends Chunk {
  /** Semantic steps extracted from messages */
  semanticSteps: SemanticStep[];
  /** Raw messages for debug sidebar */
  rawMessages: ParsedMessage[];
}

// =============================================================================
// Session Detail
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
// File Change Events
// =============================================================================

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
// Utility Types
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
// Window Type Extension
// =============================================================================

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
