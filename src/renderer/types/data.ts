/**
 * Type definitions for the renderer process.
 * These types are aligned with src/main/types/claude.ts for IPC communication.
 */

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
 * Tool use result data structure.
 * Contains detailed information about tool execution results from JSONL entries.
 */
export interface ToolUseResultData {
  type?: 'text' | 'edit' | 'create' | 'delete' | 'bash' | string;
  success?: boolean;
  commandName?: string;
  // For file reads (type: 'text')
  file?: {
    filePath: string;
    content: string;
    numLines: number;
    startLine: number;
    totalLines: number;
  };
  // For edits (type: 'edit')
  filePath?: string;
  oldString?: string;
  newString?: string;
  structuredPatch?: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
  // For bash commands (type: 'bash')
  stdout?: string;
  stderr?: string;
  exitCode?: number;
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
  /** Tool use result data - preserves full structure from JSONL entries.
   * Structure varies by tool type (file tools, Task, AskUserQuestion, Bash, etc.) */
  toolUseResult?: Record<string, unknown>;
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

/**
 * Type guard: Check if message is a command output message.
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
export function isCommandOutputMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  const content = msg.content;
  if (typeof content === 'string') {
    return content.includes('<local-command-stdout>');
  }
  return false;
}

// =============================================================================
// Process Types
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
 */
export interface UserChunk extends BaseChunk {
  /** Discriminator for chunk type */
  chunkType: 'user';
  /** The user message */
  userMessage: ParsedMessage;
}

/**
 * AI chunk - represents all assistant responses to a user message.
 */
export interface AIChunk extends BaseChunk {
  /** Discriminator for chunk type */
  chunkType: 'ai';
  /** Reference to the parent user chunk ID */
  userChunkId: string;
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
 * A chunk can be either a user input or AI response.
 */
export type Chunk = UserChunk | AIChunk;

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
// Electron API (exposed via preload script)
// =============================================================================

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>;
  getSessions: (projectId: string) => Promise<Session[]>;
  getSessionDetail: (projectId: string, sessionId: string) => Promise<SessionDetail | null>;
  getSessionMetrics: (projectId: string, sessionId: string) => Promise<SessionMetrics | null>;
  getWaterfallData: (projectId: string, sessionId: string) => Promise<WaterfallData | null>;
  getSubagentDetail: (projectId: string, sessionId: string, subagentId: string) => Promise<SubagentDetail | null>;
  getSessionGroups: (projectId: string, sessionId: string) => Promise<ConversationGroup[]>;

  // Validation methods
  validateSkill: (skillName: string, projectPath: string) =>
    Promise<{ exists: boolean; location?: 'global' | 'project' }>;
  validatePath: (relativePath: string, projectPath: string) =>
    Promise<{ exists: boolean; isDirectory?: boolean }>;
  validateMentions: (
    mentions: { type: 'skill' | 'path'; value: string }[],
    projectPath: string
  ) => Promise<Record<string, boolean>>;
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
    toolUseResult?: ToolUseResultData; // For tool_result - enriched data from message
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

  /** Source message UUID (for grouping steps by assistant message) */
  sourceMessageId?: string;

  /** Effective end time (gap-filled for overlaps) */
  effectiveEndTime?: Date;
  /** Effective duration in milliseconds (gap-filled) */
  effectiveDurationMs?: number;
  /** Whether this step's timing was gap-filled */
  isGapFilled?: boolean;
  /** Context tokens for this step */
  contextTokens?: number;
  /** Accumulated context tokens up to this step */
  accumulatedContext?: number;
  /** Detailed token breakdown */
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
 * Enhanced chunk can be either user or AI type.
 */
export type EnhancedChunk = EnhancedUserChunk | EnhancedAIChunk;

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
