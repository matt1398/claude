/**
 * ============================================================================
 * Claude Code JSONL Format - Complete Specification
 * ============================================================================
 *
 * This is the single source of truth for understanding Claude Code's JSONL
 * chat history format. Each conversation session is stored as a .jsonl file
 * where each line represents a single event in the conversation.
 *
 * @version 3.0.0
 * @see https://claude.ai/claude-code
 *
 * ============================================================================
 * TABLE OF CONTENTS
 * ============================================================================
 *
 * 1. CRITICAL CONCEPTS
 *    - Message Type Distinction (isMeta flag)
 *    - Message Flow Patterns
 *    - Tool Call Linking
 *    - Subagent Patterns
 *
 * 2. TYPE DEFINITIONS
 *    - Base Types and Enums
 *    - Content Block Interfaces
 *    - Message Interfaces
 *    - Entry Interfaces
 *
 * 3. TYPE GUARDS & HELPERS
 *    - Entry Type Guards
 *    - Content Type Guards
 *    - Message Classification
 *
 * 4. USAGE EXAMPLES
 *    - Parsing JSONL Files
 *    - Filtering Real User Messages
 *    - Linking Tool Calls
 *    - Handling Subagents
 *    - Building Conversation Flows
 *
 * 5. SUBAGENT PATTERNS
 *    - Subagent Detection
 *    - File Structure
 *    - Execution Tracing
 *
 * ============================================================================
 */

// ============================================================================
// 1. CRITICAL CONCEPTS
// ============================================================================

/**
 * ============================================================================
 * CRITICAL: Understanding Message Types
 * ============================================================================
 *
 * The most important concept in this format is distinguishing between:
 *
 * 1. REAL USER INPUT (what the user actually typed)
 * 2. INTERNAL SYSTEM MESSAGES (tool results sent back to Claude)
 *
 * Both use type: "user" but are distinguished by the `isMeta` flag:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ REAL USER MESSAGE                                                   │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ {                                                                   │
 * │   "type": "user",                                                   │
 * │   "isMeta": false,           ← Key indicator                        │
 * │   "message": {                                                      │
 * │     "role": "user",                                                 │
 * │     "content": "Help me debug this function"                        │
 * │   }                                                                 │
 * │ }                                                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ INTERNAL USER MESSAGE (Tool Result)                                 │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ {                                                                   │
 * │   "type": "user",                                                   │
 * │   "isMeta": true,            ← Key indicator                        │
 * │   "message": {                                                      │
 * │     "role": "user",                                                 │
 * │     "content": [{                                                   │
 * │       "type": "tool_result",                                        │
 * │       "tool_use_id": "toolu_xyz",                                   │
 * │       "content": "File contents..."                                 │
 * │     }]                                                              │
 * │   },                                                                │
 * │   "toolUseResult": { "success": true, "commandName": "Read" },      │
 * │   "sourceToolUseID": "toolu_xyz"                                    │
 * │ }                                                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ============================================================================
 * Message Flow Pattern
 * ============================================================================
 *
 * A typical conversation turn follows this pattern:
 *
 * 1. User types message → type: "user", isMeta: false
 * 2. Assistant responds → type: "assistant" (may contain tool_use)
 * 3. Tool executes → type: "user", isMeta: true (contains tool_result)
 * 4. Assistant continues → type: "assistant"
 *
 * Example sequence:
 *
 * Line 1: {"type": "user", "isMeta": false, "message": {"content": "Read /path/to/file"}}
 * Line 2: {"type": "assistant", "message": {"content": [{"type": "tool_use", "id": "toolu_123", "name": "Read"}]}}
 * Line 3: {"type": "user", "isMeta": true, "message": {"content": [{"type": "tool_result", "tool_use_id": "toolu_123"}]}}
 * Line 4: {"type": "assistant", "message": {"content": [{"type": "text", "text": "Here's what I found..."}]}}
 *
 * ============================================================================
 * Tool Call Linking
 * ============================================================================
 *
 * Tool calls and results are linked via IDs:
 *
 * 1. Assistant message contains tool_use with id: "toolu_xyz123"
 * 2. Tool executes
 * 3. Internal user message contains tool_result with tool_use_id: "toolu_xyz123"
 *
 * Additional linking fields:
 * - sourceToolUseID: ID of the tool_use this is responding to
 * - sourceToolAssistantUUID: UUID of the assistant message that made the tool call
 *
 * ============================================================================
 * No Turn-Based Grouping
 * ============================================================================
 *
 * IMPORTANT: Claude Code JSONL is a LINEAR stream of messages.
 * There is NO turn-based grouping structure in the format.
 *
 * Messages are linked via:
 * - parentUuid: Points to the previous message
 * - UUID chains: Follow parentUuid to reconstruct conversation tree
 * - Timestamps: Chronological ordering
 *
 * If you need turns, you must construct them programmatically by:
 * 1. Grouping messages between real user inputs
 * 2. Following UUID parent chains
 * 3. Matching tool_use with their tool_result responses
 *
 * ============================================================================
 * Session Boundaries
 * ============================================================================
 *
 * Sessions start with a system message with subtype="init" (if present).
 * The first message in a session typically has parentUuid: null.
 *
 * Session clearing is marked by a summary entry:
 * {"type": "summary", "summary": "Session Cleared", "leafUuid": "..."}
 *
 * ============================================================================
 */

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

// ----------------------------------------------------------------------------
// Base Types and Enums
// ----------------------------------------------------------------------------

/**
 * Type of entry in the JSONL chat history.
 * Each line in the JSONL file has one of these types.
 */
export type EntryType =
  | 'user'              // User message (BOTH real user input AND internal tool results)
  | 'assistant'         // Assistant message (Claude's response)
  | 'system'            // System message (metadata, duration tracking, etc.)
  | 'summary'           // Session summary or clearing marker
  | 'file-history-snapshot'; // File state snapshot for tracking changes

/**
 * Role of the message sender in the conversation.
 * NOTE: "user" role is used for both real user input and tool results.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Type of content block within a message.
 *
 * For opcode parsing:
 * - 'text': Plain text to display
 * - 'thinking': Extended thinking blocks (cryptographically signed)
 * - 'tool_use': Tool invocation request from Claude
 * - 'tool_result': Tool execution result sent back to Claude
 * - 'image': Base64-encoded image data
 */
export type ContentType =
  | 'text'              // Plain text content
  | 'thinking'          // Extended thinking (reasoning trace)
  | 'tool_use'          // Tool invocation request
  | 'tool_result'       // Tool execution result
  | 'image';            // Image content (base64 encoded)

/**
 * User type indicator - typically "external" for regular users.
 */
export type UserType = 'external';

/**
 * Reason why the model stopped generating.
 *
 * For opcode parsing:
 * - 'end_turn': Natural completion, no more messages expected
 * - 'tool_use': Model stopped to invoke tools, expect tool results next
 * - 'max_tokens': Hit token limit, response may be truncated
 * - 'stop_sequence': Hit a stop sequence
 */
export type StopReason =
  | 'end_turn'          // Natural completion
  | 'tool_use'          // Stopped to invoke a tool
  | 'max_tokens'        // Hit token limit
  | 'stop_sequence'     // Hit a stop sequence
  | null;               // Still generating or unknown

/**
 * System message subtype for categorizing system events.
 */
export type SystemSubtype =
  | 'turn_duration'     // Tracks duration of a conversation turn
  | 'init';             // Session initialization marker

/**
 * Extended thinking level setting.
 */
export type ThinkingLevel = 'high' | 'medium' | 'low' | 'off';

/**
 * Todo item status.
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Service tier used for the API request.
 */
export type ServiceTier = 'standard';

/**
 * Subagent type determines capabilities and model selection.
 *
 * For opcode parsing:
 * - 'explore': Read-only agent for research (faster, cheaper)
 * - 'general-purpose': Full-capability agent for implementation
 */
export type SubagentType = 'explore' | 'general-purpose';

// ----------------------------------------------------------------------------
// Content Block Interfaces
// ----------------------------------------------------------------------------

/**
 * Base interface for all content blocks.
 */
export interface BaseContent {
  type: ContentType;
  cache_control?: CacheControl;
}

/**
 * Cache control settings for prompt caching.
 * Enables ephemeral caching to reduce costs and latency.
 */
export interface CacheControl {
  type: 'ephemeral';
}

/**
 * Plain text content block.
 *
 * For opcode parsing:
 * - This is the main displayable content
 * - Render as markdown or plain text
 *
 * @example
 * {
 *   "type": "text",
 *   "text": "Hello! How can I help you today?"
 * }
 */
export interface TextContent extends BaseContent {
  type: 'text';
  text: string;
}

/**
 * Extended thinking content block.
 * Contains Claude's internal reasoning process before generating a response.
 *
 * For opcode parsing:
 * - This is cryptographically signed to ensure authenticity
 * - Display in a collapsible/expandable section
 * - Shows Claude's reasoning process
 *
 * @example
 * {
 *   "type": "thinking",
 *   "thinking": "Let me analyze this request. The user wants to...",
 *   "signature": "EvMJCkYICxgCKkCtuxCLmUrlVgZEPqqLXOhecX3ng+14h8o8Fxp0qAWpNExNy6jl..."
 * }
 */
export interface ThinkingContent extends BaseContent {
  type: 'thinking';
  thinking: string;
  signature: string; // Cryptographic signature to verify authenticity
}

/**
 * Tool use content block.
 * Represents Claude's request to invoke a tool/function.
 *
 * For opcode parsing:
 * - The 'id' field is crucial for linking to tool results
 * - 'name' is the tool name (Read, Write, Bash, etc.)
 * - 'input' contains the tool parameters
 * - Store this to match with corresponding tool_result later
 *
 * @example
 * {
 *   "type": "tool_use",
 *   "id": "toolu_01K7G8sPe4fjo9CGQ38ZrhwT",
 *   "name": "Read",
 *   "input": {
 *     "file_path": "/path/to/file.ts"
 *   }
 * }
 */
export interface ToolUseContent extends BaseContent {
  type: 'tool_use';
  id: string;           // Unique identifier for this tool invocation
  name: string;         // Name of the tool being invoked
  input: Record<string, any>; // Tool parameters as key-value pairs
}

/**
 * Tool result content block.
 * Contains the result of a tool execution, sent back to Claude.
 *
 * CRITICAL FOR OPCODE PARSING:
 * ============================
 *
 * Tool results are linked to their originating tool calls via IDs:
 *
 * 1. Assistant message contains tool_use with id: "toolu_xyz123"
 * 2. Tool executes
 * 3. Internal user message (isMeta: true) contains tool_result with tool_use_id: "toolu_xyz123"
 *
 * The tool_use_id in the tool_result matches the id in the tool_use.
 *
 * For opcode parsing:
 * - Use tool_use_id to find the matching tool_use block
 * - Check is_error to determine if execution succeeded
 * - Content can be string or array of content blocks
 * - These appear in "user" type entries with isMeta: true
 *
 * @example
 * // Tool call (from assistant message)
 * {
 *   "type": "tool_use",
 *   "id": "toolu_01K7G8sPe4fjo9CGQ38ZrhwT",
 *   "name": "Read",
 *   "input": { "file_path": "/path/to/file.ts" }
 * }
 *
 * // Tool result (from internal user message)
 * {
 *   "type": "tool_result",
 *   "tool_use_id": "toolu_01K7G8sPe4fjo9CGQ38ZrhwT",  // Links back to tool_use
 *   "content": "File contents here...",
 *   "is_error": false
 * }
 */
export interface ToolResultContent extends BaseContent {
  type: 'tool_result';
  tool_use_id: string;  // References the tool_use.id this is responding to
  content: string | ContentBlock[]; // Result data or error message
  is_error?: boolean;   // Whether this result represents an error
}

/**
 * Image content block.
 * Contains base64-encoded image data.
 *
 * For opcode parsing:
 * - Decode base64 data to display image
 * - Check media_type for proper rendering
 *
 * @example
 * {
 *   "type": "image",
 *   "source": {
 *     "type": "base64",
 *     "media_type": "image/png",
 *     "data": "iVBORw0KGgoAAAANSUhEUgA..."
 *   }
 * }
 */
export interface ImageContent extends BaseContent {
  type: 'image';
  source: ImageSource;
}

/**
 * Image source data.
 */
export interface ImageSource {
  type: 'base64';
  media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string; // Base64-encoded image data
}

/**
 * Union type of all possible content blocks.
 *
 * For opcode parsing:
 * - Always check the 'type' field first
 * - Use type guards to safely access specific fields
 */
export type ContentBlock =
  | TextContent
  | ThinkingContent
  | ToolUseContent
  | ToolResultContent
  | ImageContent;

// ----------------------------------------------------------------------------
// Message Interfaces
// ----------------------------------------------------------------------------

/**
 * Base message structure containing role and content.
 */
export interface BaseMessage {
  role: MessageRole;
  content: string | ContentBlock[];
}

/**
 * User message structure.
 * Simpler than assistant messages - just role and content.
 *
 * IMPORTANT: This is used for BOTH real user input AND internal tool results.
 * Check the parent entry's isMeta flag to distinguish.
 *
 * @example
 * {
 *   "role": "user",
 *   "content": "Can you help me debug this code?"
 * }
 */
export interface UserMessage extends BaseMessage {
  role: 'user';
  content: string | ContentBlock[];
}

/**
 * Assistant message structure.
 * Contains full API response metadata including model, usage, and stop reason.
 *
 * For opcode parsing:
 * - model: Which Claude model was used
 * - id: Unique message ID from API
 * - content: Array of content blocks (text, thinking, tool_use)
 * - stop_reason: Why generation stopped (important for tool use detection)
 * - usage: Token usage and caching metrics
 *
 * @example
 * {
 *   "role": "assistant",
 *   "model": "claude-sonnet-4-5-20250929",
 *   "id": "msg_012t78qg2aXfxscErCbCRQUM",
 *   "type": "message",
 *   "content": [...],
 *   "stop_reason": "end_turn",
 *   "usage": {...}
 * }
 */
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  model: string;        // Model identifier (e.g., "claude-sonnet-4-5-20250929")
  id: string;           // Unique message ID from the API
  type: 'message';      // Always "message" for assistant responses
  content: ContentBlock[];
  stop_reason: StopReason;
  stop_sequence: string | null;
  usage: UsageMetadata;
}

/**
 * Token usage and cost tracking for an API request.
 * Includes prompt caching metrics for cache hits and creation.
 *
 * For opcode parsing:
 * - input_tokens: Fresh tokens read
 * - cache_read_input_tokens: Tokens served from cache (cheaper)
 * - cache_creation_input_tokens: Tokens written to cache
 * - output_tokens: Tokens generated in response
 *
 * @example
 * {
 *   "input_tokens": 9,
 *   "cache_creation_input_tokens": 14886,
 *   "cache_read_input_tokens": 13421,
 *   "output_tokens": 463,
 *   "cache_creation": {
 *     "ephemeral_5m_input_tokens": 14886,
 *     "ephemeral_1h_input_tokens": 0
 *   },
 *   "service_tier": "standard"
 * }
 */
export interface UsageMetadata {
  input_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens: number;
  cache_creation?: CacheCreationMetadata;
  service_tier?: ServiceTier;
}

/**
 * Cache creation breakdown by TTL.
 */
export interface CacheCreationMetadata {
  ephemeral_5m_input_tokens: number;
  ephemeral_1h_input_tokens: number;
}

// ----------------------------------------------------------------------------
// Entry Base Interfaces
// ----------------------------------------------------------------------------

/**
 * Base fields common to all entry types in the JSONL file.
 *
 * For opcode parsing:
 * - type: Discriminator field for entry type
 * - timestamp: ISO 8601 timestamp for chronological ordering
 * - uuid: Unique identifier for this entry
 */
export interface BaseEntry {
  type: EntryType;
  timestamp?: string;   // ISO 8601 timestamp
  uuid?: string;        // Unique identifier for this entry
}

/**
 * Base fields for conversational entries (user, assistant, system).
 *
 * For opcode parsing:
 * - parentUuid: Links to previous message (null for conversation roots)
 * - isSidechain: true = subagent, false = main conversation
 * - sessionId: Groups messages into sessions
 * - agentId: Present for subagent messages (e.g., "aa3589d")
 * - cwd: Working directory for context
 * - gitBranch: Current git branch
 */
export interface ConversationalEntry extends BaseEntry {
  parentUuid: string | null; // UUID of the previous message in the thread
  isSidechain: boolean;      // Whether this is a sidechain (subagent) conversation
  userType: UserType;
  cwd: string;               // Current working directory
  sessionId: string;         // Session UUID
  version: string;           // Claude Code version (e.g., "2.1.4")
  gitBranch: string;         // Current git branch (empty string if not in git repo)
  slug?: string;             // Human-readable session slug
}

// ----------------------------------------------------------------------------
// User Entry Interface
// ----------------------------------------------------------------------------

/**
 * ============================================================================
 * CRITICAL: User Entry Types
 * ============================================================================
 *
 * User entries are THE MOST COMPLEX part of this format because they serve
 * two completely different purposes:
 *
 * 1. REAL USER INPUT (isMeta: false or undefined)
 *    - Actual messages typed by the human user
 *    - Contains user prompts, questions, or instructions
 *    - These are the messages you want for conversation display
 *    - May include images, todos, thinking settings
 *
 * 2. INTERNAL TOOL RESULTS (isMeta: true)
 *    - System-generated messages containing tool execution results
 *    - Sent back to Claude after a tool executes
 *    - NOT typed by the user - auto-generated by the system
 *    - Contains tool_result content blocks
 *    - Linked to tool_use via tool_use_id
 *    - Has additional metadata: toolUseResult, sourceToolUseID, sourceToolAssistantUUID
 *
 * For opcode parsing:
 * ==================
 *
 * When you encounter a "user" type entry:
 *
 * 1. Check isMeta first:
 *    - if (entry.isMeta === true) → Internal tool result, don't display directly
 *    - if (entry.isMeta === false || entry.isMeta === undefined) → Real user input, display it
 *
 * 2. For real user messages:
 *    - Extract content (string or ContentBlock[])
 *    - Check for images (imagePasteIds)
 *    - Check for todos (todos array)
 *    - Display thinking metadata if present
 *
 * 3. For internal tool results:
 *    - Extract tool_result content blocks
 *    - Link to tool_use using sourceToolUseID or content[].tool_use_id
 *    - Check toolUseResult.success to see if tool succeeded
 *    - Use for execution flow tracking, not direct display
 *
 * ============================================================================
 */

/**
 * Base user entry interface with common fields.
 * Use RealUserEntry or InternalUserEntry for type-safe access.
 */
interface BaseUserEntry extends ConversationalEntry {
  type: 'user';
  message: UserMessage;
  thinkingMetadata?: ThinkingMetadata;
  todos?: TodoItem[];
  imagePasteIds?: string[];           // IDs of pasted images
  agentId?: string;                   // Agent identifier for subagent conversations
  isMeta?: boolean;                   // CRITICAL: Distinguishes real user input from internal messages
}

/**
 * Real user entry - actual human input.
 * These are messages that a real user typed into the chat.
 *
 * For opcode parsing:
 * - Display these in the conversation UI
 * - Extract text from message.content
 * - Show todos if present
 * - Show thinking settings if present
 *
 * @example
 * {
 *   "type": "user",
 *   "isMeta": false,
 *   "parentUuid": null,
 *   "isSidechain": false,
 *   "userType": "external",
 *   "cwd": "/Users/user/project",
 *   "sessionId": "ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa",
 *   "version": "2.1.4",
 *   "gitBranch": "main",
 *   "message": {
 *     "role": "user",
 *     "content": "Help me debug this function"
 *   },
 *   "uuid": "16acbaa1-0e4b-47dd-b5ac-c43d2a0c7a4c",
 *   "timestamp": "2026-01-12T11:49:49.146Z",
 *   "thinkingMetadata": {
 *     "level": "high",
 *     "disabled": false,
 *     "triggers": []
 *   },
 *   "todos": []
 * }
 */
export interface RealUserEntry extends BaseUserEntry {
  isMeta?: false;  // Real user messages have isMeta: false or undefined
}

/**
 * Internal user entry - tool result message.
 * These are system-generated messages containing tool execution results.
 * They use the "user" role because they're sent back to Claude as if from the user,
 * but they're actually generated by the system after tool execution.
 *
 * For opcode parsing:
 * - DO NOT display these directly in conversation UI
 * - Use for tool execution tracking and linking
 * - Extract tool_result content blocks
 * - Link to tool_use via sourceToolUseID or content[].tool_use_id
 * - Check toolUseResult.success for execution status
 *
 * @example
 * {
 *   "type": "user",
 *   "isMeta": true,
 *   "parentUuid": "75c40157-a860-46f1-b075-8a289880066b",
 *   "isSidechain": false,
 *   "userType": "external",
 *   "cwd": "/Users/user/project",
 *   "sessionId": "ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa",
 *   "version": "2.1.4",
 *   "gitBranch": "main",
 *   "message": {
 *     "role": "user",
 *     "content": [
 *       {
 *         "type": "tool_result",
 *         "tool_use_id": "toolu_01K7G8sPe4fjo9CGQ38ZrhwT",
 *         "content": "File contents here...",
 *         "is_error": false
 *       }
 *     ]
 *   },
 *   "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "timestamp": "2026-01-12T11:49:50.234Z",
 *   "toolUseResult": {
 *     "success": true,
 *     "commandName": "Read"
 *   },
 *   "sourceToolAssistantUUID": "75c40157-a860-46f1-b075-8a289880066b",
 *   "sourceToolUseID": "toolu_01K7G8sPe4fjo9CGQ38ZrhwT"
 * }
 */
export interface InternalUserEntry extends BaseUserEntry {
  isMeta: true;  // Internal messages always have isMeta: true
  toolUseResult?: ToolUseResult;      // Present when this is a tool result message
  sourceToolAssistantUUID?: string;   // UUID of assistant message that requested the tool
  sourceToolUseID?: string;           // ID of the tool_use that this is responding to
}

/**
 * Union type representing any user entry.
 *
 * For opcode parsing:
 * - Always use type guards (isRealUserMessage, isInternalUserMessage)
 * - Never assume all "user" entries are displayable
 */
export type UserEntry = RealUserEntry | InternalUserEntry;

/**
 * Extended thinking configuration metadata.
 */
export interface ThinkingMetadata {
  level: ThinkingLevel;
  disabled: boolean;
  triggers: string[];  // List of trigger conditions for thinking
}

/**
 * Todo item in the task list.
 *
 * For opcode parsing:
 * - Display todos to show task progress
 * - content: Imperative form ("Run tests")
 * - activeForm: Present continuous form ("Running tests")
 * - status: Current state (pending, in_progress, completed)
 */
export interface TodoItem {
  content: string;      // Imperative form: "Run tests"
  status: TodoStatus;
  activeForm: string;   // Present continuous form: "Running tests"
}

/**
 * Result of a tool execution.
 *
 * For opcode parsing:
 * - success: Whether tool executed successfully
 * - commandName: Name of the tool/command that was executed
 */
export interface ToolUseResult {
  success: boolean;
  commandName?: string; // Name of the command/skill that was executed
}

// ----------------------------------------------------------------------------
// Assistant Entry Interface
// ----------------------------------------------------------------------------

/**
 * Assistant entry in the JSONL chat history.
 * Represents a response generated by Claude.
 *
 * For opcode parsing:
 * - Display all assistant messages in conversation UI
 * - Extract text content for display
 * - Show thinking blocks if present
 * - Track tool_use blocks for linking with results
 * - Use stop_reason to determine if tools will execute next
 *
 * @example
 * {
 *   "type": "assistant",
 *   "parentUuid": "16acbaa1-0e4b-47dd-b5ac-c43d2a0c7a4c",
 *   "isSidechain": false,
 *   "userType": "external",
 *   "cwd": "/Users/user/project",
 *   "sessionId": "ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa",
 *   "version": "2.1.4",
 *   "gitBranch": "main",
 *   "message": {
 *     "model": "claude-sonnet-4-5-20250929",
 *     "id": "msg_012t78qg2aXfxscErCbCRQUM",
 *     "type": "message",
 *     "role": "assistant",
 *     "content": [
 *       {
 *         "type": "text",
 *         "text": "I'll help you debug that function."
 *       }
 *     ],
 *     "stop_reason": "end_turn",
 *     "usage": {...}
 *   },
 *   "requestId": "req_011CX3S5fzfx9Y5bbAtY1g99",
 *   "uuid": "75c40157-a860-46f1-b075-8a289880066b",
 *   "timestamp": "2026-01-12T11:49:58.416Z"
 * }
 */
export interface AssistantEntry extends ConversationalEntry {
  type: 'assistant';
  message: AssistantMessage;
  requestId: string;    // Unique identifier for the API request
  agentId?: string;     // Agent identifier for subagent conversations
}

// ----------------------------------------------------------------------------
// System Entry Interface
// ----------------------------------------------------------------------------

/**
 * System entry in the JSONL chat history.
 * Used for tracking metadata and system events like conversation duration.
 *
 * For opcode parsing:
 * - Usually not displayed in conversation UI
 * - Use for analytics and session tracking
 * - subtype="turn_duration": Marks end of a conversation turn
 * - subtype="init": Marks session initialization
 *
 * @example
 * {
 *   "type": "system",
 *   "subtype": "turn_duration",
 *   "parentUuid": "aee84ff2-67ae-46c3-8e81-b11a58face83",
 *   "isSidechain": false,
 *   "userType": "external",
 *   "cwd": "/Users/user/project",
 *   "sessionId": "ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa",
 *   "version": "2.1.4",
 *   "gitBranch": "main",
 *   "slug": "fuzzy-moseying-lemon",
 *   "durationMs": 800840,
 *   "timestamp": "2026-01-12T12:03:09.992Z",
 *   "uuid": "2f639c16-3403-4c3c-93de-e64f8a110017",
 *   "isMeta": false
 * }
 */
export interface SystemEntry extends ConversationalEntry {
  type: 'system';
  subtype: SystemSubtype;
  durationMs: number;   // Duration in milliseconds
  isMeta: boolean;      // Whether this is a meta system message
}

// ----------------------------------------------------------------------------
// Summary Entry Interface
// ----------------------------------------------------------------------------

/**
 * Summary entry in the JSONL chat history.
 * Contains a human-readable summary of the session or a clearing action.
 *
 * For opcode parsing:
 * - summary="Session Cleared": Session was cleared at this point
 * - Other summaries: AI-generated session descriptions
 * - leafUuid: Points to the last message in the summarized branch
 *
 * @example
 * // Session cleared
 * {
 *   "type": "summary",
 *   "summary": "Session Cleared",
 *   "leafUuid": "b8a4afa6-c898-46b0-a882-a9a168505255"
 * }
 *
 * // Session summary
 * {
 *   "type": "summary",
 *   "summary": "Building Electron app visualizing Claude Code execution",
 *   "leafUuid": "22826c95-995c-424f-bce7-a21abd03a894"
 * }
 */
export interface SummaryEntry extends BaseEntry {
  type: 'summary';
  summary: string;      // Human-readable summary text
  leafUuid: string;     // UUID of the leaf message in the conversation tree
}

// ----------------------------------------------------------------------------
// File History Snapshot Interface
// ----------------------------------------------------------------------------

/**
 * File history snapshot entry.
 * Tracks the state of files at a specific point in the conversation for diffing.
 *
 * For opcode parsing:
 * - Usually not displayed directly
 * - Use for file change tracking and diffing
 * - trackedFileBackups: Map of file path to backup content
 *
 * @example
 * {
 *   "type": "file-history-snapshot",
 *   "messageId": "16acbaa1-0e4b-47dd-b5ac-c43d2a0c7a4c",
 *   "snapshot": {
 *     "messageId": "16acbaa1-0e4b-47dd-b5ac-c43d2a0c7a4c",
 *     "trackedFileBackups": {
 *       "/path/to/file.ts": "backup-content-here"
 *     },
 *     "timestamp": "2026-01-12T11:49:49.152Z"
 *   },
 *   "isSnapshotUpdate": false
 * }
 */
export interface FileHistorySnapshotEntry extends BaseEntry {
  type: 'file-history-snapshot';
  messageId: string;           // UUID of the associated message
  snapshot: FileSnapshot;
  isSnapshotUpdate: boolean;   // Whether this updates an existing snapshot
}

/**
 * File snapshot data structure.
 */
export interface FileSnapshot {
  messageId: string;
  trackedFileBackups: Record<string, string>; // Map of file path to backup content
  timestamp: string;            // ISO 8601 timestamp
}

// ----------------------------------------------------------------------------
// Union Types for All Entries
// ----------------------------------------------------------------------------

/**
 * Union type representing any entry in the JSONL chat history.
 *
 * For opcode parsing:
 * - Use type guards or discriminated union pattern to narrow the type
 * - Always check entry.type first
 *
 * @example
 * function processEntry(entry: ChatHistoryEntry) {
 *   switch (entry.type) {
 *     case 'user':
 *       if (isRealUserMessage(entry)) {
 *         console.log('User:', entry.message.content);
 *       }
 *       break;
 *     case 'assistant':
 *       console.log('Assistant:', entry.message.content);
 *       break;
 *     case 'system':
 *       console.log('System duration:', entry.durationMs);
 *       break;
 *     case 'summary':
 *       console.log('Summary:', entry.summary);
 *       break;
 *     case 'file-history-snapshot':
 *       console.log('Snapshot:', Object.keys(entry.snapshot.trackedFileBackups));
 *       break;
 *   }
 * }
 */
export type ChatHistoryEntry =
  | UserEntry
  | AssistantEntry
  | SystemEntry
  | SummaryEntry
  | FileHistorySnapshotEntry;

// ============================================================================
// 3. TYPE GUARDS & HELPERS
// ============================================================================

// ----------------------------------------------------------------------------
// Entry Type Guards
// ----------------------------------------------------------------------------

/**
 * Type guard to check if an entry is a user entry (any kind).
 *
 * For opcode parsing:
 * - This matches BOTH real user messages AND internal tool results
 * - Use isRealUserMessage() or isInternalUserMessage() to distinguish
 */
export function isUserEntry(entry: ChatHistoryEntry): entry is UserEntry {
  return entry.type === 'user';
}

/**
 * Type guard to check if an entry is a REAL user message (actual human input).
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * Use this to filter for displayable user messages in a chat UI.
 * This is the primary way to distinguish real user input from tool results.
 *
 * @example
 * const realUserMessages = entries.filter(isRealUserMessage);
 * // Returns only messages that the user actually typed
 *
 * // In UI rendering:
 * for (const entry of entries) {
 *   if (isRealUserMessage(entry)) {
 *     renderUserMessage(entry.message.content);
 *   }
 * }
 */
export function isRealUserMessage(entry: ChatHistoryEntry): entry is RealUserEntry {
  return entry.type === 'user' && !entry.isMeta;
}

/**
 * Type guard to check if an entry is an INTERNAL user message (tool result).
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * Use this to identify system-generated tool result messages.
 * These should NOT be displayed as user messages in the UI.
 *
 * @example
 * const toolResults = entries.filter(isInternalUserMessage);
 * // Returns only tool result messages
 *
 * // For tool execution tracking:
 * for (const entry of entries) {
 *   if (isInternalUserMessage(entry)) {
 *     processToolResult(entry);
 *   }
 * }
 */
export function isInternalUserMessage(entry: ChatHistoryEntry): entry is InternalUserEntry {
  return entry.type === 'user' && entry.isMeta === true;
}

/**
 * Type guard to check if a user entry contains tool results.
 * Checks the content array for tool_result blocks.
 *
 * For opcode parsing:
 * - Use to identify entries with tool results
 * - Usually combined with isInternalUserMessage()
 *
 * @example
 * if (isUserEntry(entry) && hasToolResults(entry)) {
 *   // This is a tool result message
 *   const results = entry.message.content.filter(c => c.type === 'tool_result');
 * }
 */
export function hasToolResults(entry: UserEntry): boolean {
  if (!entry.message?.content || !Array.isArray(entry.message.content)) {
    return false;
  }
  return entry.message.content.some(
    (content: any) => content.type === 'tool_result'
  );
}

/**
 * Type guard to check if an entry is an assistant entry.
 *
 * For opcode parsing:
 * - All assistant messages should be displayed in UI
 */
export function isAssistantEntry(entry: ChatHistoryEntry): entry is AssistantEntry {
  return entry.type === 'assistant';
}

/**
 * Type guard to check if an entry is a system entry.
 *
 * For opcode parsing:
 * - Usually used for analytics, not display
 */
export function isSystemEntry(entry: ChatHistoryEntry): entry is SystemEntry {
  return entry.type === 'system';
}

/**
 * Type guard to check if an entry is a summary entry.
 *
 * For opcode parsing:
 * - Check for "Session Cleared" to detect clearing points
 */
export function isSummaryEntry(entry: ChatHistoryEntry): entry is SummaryEntry {
  return entry.type === 'summary';
}

/**
 * Type guard to check if an entry is a file history snapshot entry.
 *
 * For opcode parsing:
 * - Use for file change tracking
 */
export function isFileHistorySnapshotEntry(entry: ChatHistoryEntry): entry is FileHistorySnapshotEntry {
  return entry.type === 'file-history-snapshot';
}

// ----------------------------------------------------------------------------
// Content Type Guards
// ----------------------------------------------------------------------------

/**
 * Type guard to check if content is text content.
 *
 * For opcode parsing:
 * - Primary content type for display
 */
export function isTextContent(content: ContentBlock): content is TextContent {
  return content.type === 'text';
}

/**
 * Type guard to check if content is thinking content.
 *
 * For opcode parsing:
 * - Display in expandable section
 * - Shows Claude's reasoning
 */
export function isThinkingContent(content: ContentBlock): content is ThinkingContent {
  return content.type === 'thinking';
}

/**
 * Type guard to check if content is tool use content.
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * Use this to identify tool invocations.
 * Store the tool_use.id to link with tool_result later.
 */
export function isToolUseContent(content: ContentBlock): content is ToolUseContent {
  return content.type === 'tool_use';
}

/**
 * Type guard to check if content is tool result content.
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * Use this to identify tool results.
 * Use tool_use_id to link back to the tool_use block.
 */
export function isToolResultContent(content: ContentBlock): content is ToolResultContent {
  return content.type === 'tool_result';
}

/**
 * Type guard to check if content is image content.
 *
 * For opcode parsing:
 * - Decode base64 to display
 */
export function isImageContent(content: ContentBlock): content is ImageContent {
  return content.type === 'image';
}

// ----------------------------------------------------------------------------
// Subagent Detection
// ----------------------------------------------------------------------------

/**
 * Type guard to check if an entry is from a subagent.
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * Subagents are isolated execution contexts spawned via the Task tool.
 * They have separate JSONL files but share the same sessionId.
 *
 * For opcode parsing:
 * - isSidechain: true = subagent message
 * - agentId: Identifies which subagent (e.g., "aa3589d")
 * - sessionId: Links back to parent session
 *
 * @example
 * if (isSubagentEntry(entry)) {
 *   console.log(`Subagent ${entry.agentId} message`);
 * }
 */
export function isSubagentEntry(entry: ChatHistoryEntry): entry is (UserEntry | AssistantEntry | SystemEntry) & { agentId: string } {
  return 'isSidechain' in entry && entry.isSidechain === true && 'agentId' in entry && !!entry.agentId;
}

/**
 * Type guard to check if an entry is from the main conversation.
 *
 * For opcode parsing:
 * - Opposite of isSubagentEntry
 */
export function isMainConversationEntry(entry: ChatHistoryEntry): boolean {
  return 'isSidechain' in entry && entry.isSidechain === false;
}

// ----------------------------------------------------------------------------
// Tool Linking Helpers
// ----------------------------------------------------------------------------

/**
 * Extract all tool uses from an assistant entry.
 *
 * For opcode parsing:
 * - Use to build tool execution tracking
 * - Store returned tool uses for linking with results
 *
 * @example
 * const toolUses = extractToolUses(assistantEntry);
 * for (const toolUse of toolUses) {
 *   console.log(`Tool: ${toolUse.name}, ID: ${toolUse.id}`);
 * }
 */
export function extractToolUses(entry: AssistantEntry): ToolUseContent[] {
  return entry.message.content.filter(isToolUseContent);
}

/**
 * Extract all tool results from an internal user entry.
 *
 * For opcode parsing:
 * - Use to process tool execution results
 * - Link back to tool uses via tool_use_id
 *
 * @example
 * const toolResults = extractToolResults(internalUserEntry);
 * for (const result of toolResults) {
 *   console.log(`Result for: ${result.tool_use_id}`);
 * }
 */
export function extractToolResults(entry: InternalUserEntry): ToolResultContent[] {
  if (!Array.isArray(entry.message.content)) {
    return [];
  }
  return entry.message.content.filter(isToolResultContent);
}

/**
 * Link tool uses with their results.
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * This is the primary method for linking tool calls to their results.
 * Returns a map of tool_use_id to { toolUse, toolResult, assistantUuid, resultUuid }
 *
 * For opcode parsing:
 * - Use this to build complete tool execution traces
 * - Enables showing tool call → result relationships
 *
 * @example
 * const entries = parseJSONL('session.jsonl');
 * const toolExecutions = linkToolUsesWithResults(entries);
 *
 * for (const [toolId, execution] of toolExecutions) {
 *   console.log(`Tool: ${execution.toolUse.name}`);
 *   console.log(`Input:`, execution.toolUse.input);
 *   console.log(`Result:`, execution.toolResult.content);
 *   console.log(`Success:`, !execution.toolResult.is_error);
 * }
 */
export function linkToolUsesWithResults(
  entries: ChatHistoryEntry[]
): Map<string, {
  toolUse: ToolUseContent;
  toolResult: ToolResultContent | null;
  assistantUuid: string;
  resultUuid: string | null;
}> {
  const toolMap = new Map<string, {
    toolUse: ToolUseContent;
    toolResult: ToolResultContent | null;
    assistantUuid: string;
    resultUuid: string | null;
  }>();

  // First pass: collect all tool uses
  for (const entry of entries) {
    if (isAssistantEntry(entry)) {
      const toolUses = extractToolUses(entry);
      for (const toolUse of toolUses) {
        toolMap.set(toolUse.id, {
          toolUse,
          toolResult: null,
          assistantUuid: entry.uuid || '',
          resultUuid: null,
        });
      }
    }
  }

  // Second pass: link tool results
  for (const entry of entries) {
    if (isInternalUserMessage(entry)) {
      const toolResults = extractToolResults(entry);
      for (const toolResult of toolResults) {
        const execution = toolMap.get(toolResult.tool_use_id);
        if (execution) {
          execution.toolResult = toolResult;
          execution.resultUuid = entry.uuid || null;
        }
      }
    }
  }

  return toolMap;
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

/**
 * Extract all user entries from a chat history.
 */
export type UserEntries<T extends ChatHistoryEntry[]> = Extract<T[number], UserEntry>[];

/**
 * Extract all assistant entries from a chat history.
 */
export type AssistantEntries<T extends ChatHistoryEntry[]> = Extract<T[number], AssistantEntry>[];

/**
 * Conversational entries (user, assistant, system) - entries that have conversation metadata.
 */
export type ConversationalEntries = UserEntry | AssistantEntry | SystemEntry;

/**
 * Message-bearing entries (user, assistant) - entries that contain actual messages.
 */
export type MessageEntries = UserEntry | AssistantEntry;

// ============================================================================
// 4. USAGE EXAMPLES
// ============================================================================

/**
 * ============================================================================
 * Example 1: Reading and Parsing a JSONL File
 * ============================================================================
 *
 * Basic file reading with Node.js readline interface.
 *
 * ```typescript
 * import * as fs from 'fs';
 * import * as readline from 'readline';
 *
 * async function parseJSONLHistory(filePath: string): Promise<ChatHistoryEntry[]> {
 *   const entries: ChatHistoryEntry[] = [];
 *   const fileStream = fs.createReadStream(filePath);
 *   const rl = readline.createInterface({
 *     input: fileStream,
 *     crlfDelay: Infinity
 *   });
 *
 *   for await (const line of rl) {
 *     if (line.trim()) {
 *       const entry = JSON.parse(line) as ChatHistoryEntry;
 *       entries.push(entry);
 *     }
 *   }
 *
 *   return entries;
 * }
 *
 * // Usage
 * const entries = await parseJSONLHistory('session.jsonl');
 * console.log(`Loaded ${entries.length} entries`);
 * ```
 */

/**
 * ============================================================================
 * Example 2: Filtering for Displayable Messages
 * ============================================================================
 *
 * CRITICAL FOR OPCODE:
 * This shows how to filter for messages that should be displayed in a chat UI.
 *
 * ```typescript
 * function getDisplayableMessages(entries: ChatHistoryEntry[]): ChatHistoryEntry[] {
 *   return entries.filter(entry => {
 *     // Include ALL assistant messages
 *     if (isAssistantEntry(entry)) return true;
 *
 *     // Include ONLY real user messages (not tool results)
 *     if (isRealUserMessage(entry)) return true;
 *
 *     // Exclude everything else (internal messages, tool results, system, etc.)
 *     return false;
 *   });
 * }
 *
 * // Alternative: More explicit filtering
 * function getChatUIMessages(entries: ChatHistoryEntry[]) {
 *   const realUserMessages = entries.filter(isRealUserMessage);
 *   const assistantMessages = entries.filter(isAssistantEntry);
 *
 *   // Combine and sort by timestamp
 *   return [...realUserMessages, ...assistantMessages]
 *     .sort((a, b) => {
 *       const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
 *       const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
 *       return timeA - timeB;
 *     });
 * }
 *
 * // Usage in UI rendering
 * const displayable = getDisplayableMessages(entries);
 * for (const entry of displayable) {
 *   if (isRealUserMessage(entry)) {
 *     renderUserMessage(entry);
 *   } else if (isAssistantEntry(entry)) {
 *     renderAssistantMessage(entry);
 *   }
 * }
 * ```
 */

/**
 * ============================================================================
 * Example 3: Extracting Text Content
 * ============================================================================
 *
 * How to extract displayable text from messages.
 *
 * ```typescript
 * function extractTextContent(entry: UserEntry | AssistantEntry): string {
 *   const content = entry.message.content;
 *
 *   // Handle string content (simple case)
 *   if (typeof content === 'string') {
 *     return content;
 *   }
 *
 *   // Handle content block array
 *   return content
 *     .filter(isTextContent)
 *     .map(block => block.text)
 *     .join('\n');
 * }
 *
 * function getUserPrompts(entries: ChatHistoryEntry[]): string[] {
 *   return entries
 *     .filter(isRealUserMessage)
 *     .map(extractTextContent)
 *     .filter(text => text.trim().length > 0);
 * }
 *
 * // Usage
 * const prompts = getUserPrompts(entries);
 * console.log('User asked:', prompts);
 * ```
 */

/**
 * ============================================================================
 * Example 4: Linking Tool Calls with Results
 * ============================================================================
 *
 * CRITICAL FOR OPCODE:
 * This shows the complete pattern for linking tool_use to tool_result.
 *
 * ```typescript
 * interface ToolExecution {
 *   toolName: string;
 *   toolId: string;
 *   input: any;
 *   result: any;
 *   isError: boolean;
 *   assistantUuid: string;
 *   resultUuid: string;
 *   timestamp: string;
 * }
 *
 * function extractToolExecutions(entries: ChatHistoryEntry[]): ToolExecution[] {
 *   const executions: ToolExecution[] = [];
 *   const toolUseMap = new Map<string, { tool: ToolUseContent; assistantUuid: string; timestamp: string }>();
 *
 *   for (const entry of entries) {
 *     // Collect tool_use requests from assistant messages
 *     if (isAssistantEntry(entry)) {
 *       for (const content of entry.message.content) {
 *         if (isToolUseContent(content)) {
 *           toolUseMap.set(content.id, {
 *             tool: content,
 *             assistantUuid: entry.uuid || '',
 *             timestamp: entry.timestamp || ''
 *           });
 *         }
 *       }
 *     }
 *
 *     // Match tool_result with their tool_use
 *     if (isInternalUserMessage(entry)) {
 *       for (const content of entry.message.content || []) {
 *         if (isToolResultContent(content)) {
 *           const toolInfo = toolUseMap.get(content.tool_use_id);
 *           if (toolInfo) {
 *             executions.push({
 *               toolName: toolInfo.tool.name,
 *               toolId: content.tool_use_id,
 *               input: toolInfo.tool.input,
 *               result: content.content,
 *               isError: content.is_error || false,
 *               assistantUuid: toolInfo.assistantUuid,
 *               resultUuid: entry.uuid || '',
 *               timestamp: entry.timestamp || ''
 *             });
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 *   return executions;
 * }
 *
 * // Usage
 * const toolExecutions = extractToolExecutions(entries);
 * for (const exec of toolExecutions) {
 *   console.log(`Tool: ${exec.toolName}`);
 *   console.log(`  Input:`, exec.input);
 *   console.log(`  Output:`, exec.result);
 *   console.log(`  Success:`, !exec.isError);
 * }
 * ```
 */

/**
 * ============================================================================
 * Example 5: Building Conversation Flow
 * ============================================================================
 *
 * Analyze message flow including message types.
 *
 * ```typescript
 * function analyzeConversationFlow(entries: ChatHistoryEntry[]) {
 *   const flow: Array<{
 *     index: number;
 *     type: string;
 *     messageType: 'real_user' | 'internal_user' | 'assistant' | 'system' | 'other';
 *     preview: string;
 *     timestamp: string;
 *   }> = [];
 *
 *   entries.forEach((entry, index) => {
 *     let messageType: any = 'other';
 *     let preview = '';
 *
 *     if (isRealUserMessage(entry)) {
 *       messageType = 'real_user';
 *       preview = extractTextContent(entry).substring(0, 50);
 *     } else if (isInternalUserMessage(entry)) {
 *       messageType = 'internal_user';
 *       const toolResults = extractToolResults(entry);
 *       preview = `Tool results (${toolResults.length})`;
 *     } else if (isAssistantEntry(entry)) {
 *       messageType = 'assistant';
 *       preview = extractTextContent(entry).substring(0, 50);
 *     } else if (isSystemEntry(entry)) {
 *       messageType = 'system';
 *       preview = `System: ${entry.subtype} (${entry.durationMs}ms)`;
 *     }
 *
 *     flow.push({
 *       index,
 *       type: entry.type,
 *       messageType,
 *       preview,
 *       timestamp: entry.timestamp || ''
 *     });
 *   });
 *
 *   return flow;
 * }
 *
 * // Example output:
 * // [
 * //   { index: 0, type: 'user', messageType: 'real_user', preview: 'Help me debug this function' },
 * //   { index: 1, type: 'assistant', messageType: 'assistant', preview: "I'll help you debug that. Let me read the file..." },
 * //   { index: 2, type: 'user', messageType: 'internal_user', preview: 'Tool results (1)' },
 * //   { index: 3, type: 'assistant', messageType: 'assistant', preview: 'I found the issue. The function...' }
 * // ]
 * ```
 */

/**
 * ============================================================================
 * Example 6: Calculating Token Usage
 * ============================================================================
 *
 * Extract usage metrics from assistant messages.
 *
 * ```typescript
 * interface TokenUsageStats {
 *   totalInput: number;
 *   totalOutput: number;
 *   totalCacheHits: number;
 *   totalCacheCreations: number;
 *   messageCount: number;
 * }
 *
 * function calculateTokenUsage(entries: ChatHistoryEntry[]): TokenUsageStats {
 *   const stats: TokenUsageStats = {
 *     totalInput: 0,
 *     totalOutput: 0,
 *     totalCacheHits: 0,
 *     totalCacheCreations: 0,
 *     messageCount: 0
 *   };
 *
 *   for (const entry of entries) {
 *     if (isAssistantEntry(entry)) {
 *       const usage = entry.message.usage;
 *       stats.totalInput += usage.input_tokens;
 *       stats.totalOutput += usage.output_tokens;
 *       if (usage.cache_read_input_tokens) {
 *         stats.totalCacheHits += usage.cache_read_input_tokens;
 *       }
 *       if (usage.cache_creation_input_tokens) {
 *         stats.totalCacheCreations += usage.cache_creation_input_tokens;
 *       }
 *       stats.messageCount++;
 *     }
 *   }
 *
 *   return stats;
 * }
 *
 * // Usage
 * const stats = calculateTokenUsage(entries);
 * console.log(`Total tokens: ${stats.totalInput + stats.totalOutput}`);
 * console.log(`Cache efficiency: ${(stats.totalCacheHits / stats.totalInput * 100).toFixed(1)}%`);
 * ```
 */

/**
 * ============================================================================
 * Example 7: Building Conversation Tree
 * ============================================================================
 *
 * Reconstruct the conversation tree using parentUuid links.
 *
 * ```typescript
 * interface ConversationNode {
 *   entry: MessageEntries;
 *   children: ConversationNode[];
 * }
 *
 * function buildConversationTree(entries: ChatHistoryEntry[]): ConversationNode[] {
 *   const messageEntries = entries.filter(
 *     (e): e is MessageEntries => isUserEntry(e) || isAssistantEntry(e)
 *   );
 *
 *   const nodeMap = new Map<string, ConversationNode>();
 *   const roots: ConversationNode[] = [];
 *
 *   // Create nodes
 *   for (const entry of messageEntries) {
 *     const node: ConversationNode = { entry, children: [] };
 *     if (entry.uuid) {
 *       nodeMap.set(entry.uuid, node);
 *     }
 *   }
 *
 *   // Link children to parents
 *   for (const entry of messageEntries) {
 *     const node = entry.uuid ? nodeMap.get(entry.uuid) : undefined;
 *     if (!node) continue;
 *
 *     if (entry.parentUuid === null) {
 *       roots.push(node);
 *     } else {
 *       const parent = nodeMap.get(entry.parentUuid);
 *       if (parent) {
 *         parent.children.push(node);
 *       }
 *     }
 *   }
 *
 *   return roots;
 * }
 *
 * // Usage
 * const tree = buildConversationTree(entries);
 * function printTree(node: ConversationNode, depth = 0) {
 *   const indent = '  '.repeat(depth);
 *   const type = node.entry.type;
 *   const preview = extractTextContent(node.entry).substring(0, 30);
 *   console.log(`${indent}${type}: ${preview}`);
 *   for (const child of node.children) {
 *     printTree(child, depth + 1);
 *   }
 * }
 * tree.forEach(root => printTree(root));
 * ```
 */

// ============================================================================
// 5. SUBAGENT PATTERNS
// ============================================================================

/**
 * ============================================================================
 * Subagent Patterns
 * ============================================================================
 *
 * Subagents are isolated Claude Code execution contexts spawned from a main
 * conversation to perform specific tasks.
 *
 * Key Concepts:
 * ------------
 * - Subagents run in separate JSONL files
 * - They share the same sessionId as the parent
 * - They have their own agentId (e.g., "aa3589d")
 * - They are marked with isSidechain: true
 * - They are spawned via the "Task" tool
 *
 * File Structure:
 * --------------
 * .claude/projects/
 * └── -Users-bskim-ClaudeContext/
 *     ├── ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa.jsonl    # Main conversation
 *     └── ffafd0d7-bd9e-4540-b6b2-ebdc6f13deaa/         # Session directory
 *         └── subagents/
 *             ├── agent-aa3589d.jsonl                    # Subagent 1
 *             ├── agent-ab054ca.jsonl                    # Subagent 2
 *             └── agent-a495d58.jsonl                    # Subagent 3
 *
 * Subagent Types:
 * --------------
 * 1. "explore" - Read-only agent for research
 *    - Cannot modify files
 *    - Uses faster, cheaper models (typically Haiku)
 *    - Optimized for searching and understanding
 *
 * 2. "general-purpose" - Full-capability agent
 *    - Can create, modify, and delete files
 *    - Executes complex multi-step tasks
 *    - Uses more powerful models when needed
 *
 * Warmup Pattern:
 * --------------
 * Every subagent starts with a "warmup" exchange:
 *
 * Line 1: {"type": "user", "message": {"content": "Warmup"}, "parentUuid": null, "isSidechain": true, "agentId": "aa3589d"}
 * Line 2: {"type": "assistant", "message": {"content": [{"type": "text", "text": "I'm ready..."}]}, "isSidechain": true, "agentId": "aa3589d"}
 * Line 3: {"type": "user", "message": {"content": "Actual task prompt..."}, "isSidechain": true, "agentId": "aa3589d"}
 *
 * ============================================================================
 */

/**
 * Subagent detection and filtering
 */

/**
 * Extract subagent metadata from entries.
 *
 * For opcode parsing:
 * - Use to identify all subagents in a session
 * - Group messages by agentId
 *
 * @example
 * const subagents = extractSubagentMetadata(entries);
 * for (const [agentId, metadata] of subagents) {
 *   console.log(`Subagent ${agentId}: ${metadata.messageCount} messages`);
 * }
 */
export function extractSubagentMetadata(
  entries: ChatHistoryEntry[]
): Map<string, {
  agentId: string;
  sessionId: string;
  messageCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
}> {
  const subagents = new Map<string, {
    agentId: string;
    sessionId: string;
    messageCount: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }>();

  for (const entry of entries) {
    if (isSubagentEntry(entry)) {
      const existing = subagents.get(entry.agentId);
      if (existing) {
        existing.messageCount++;
        existing.lastTimestamp = entry.timestamp || existing.lastTimestamp;
      } else {
        subagents.set(entry.agentId, {
          agentId: entry.agentId,
          sessionId: entry.sessionId,
          messageCount: 1,
          firstTimestamp: entry.timestamp || '',
          lastTimestamp: entry.timestamp || ''
        });
      }
    }
  }

  return subagents;
}

/**
 * Find Task tool invocations in main conversation.
 *
 * CRITICAL FOR OPCODE:
 * ===================
 * This shows which assistant messages spawned subagents.
 *
 * For opcode parsing:
 * - Track Task tool uses to understand subagent spawning
 * - Link Task tool_result to get subagent output summary
 *
 * @example
 * const tasks = extractTaskInvocations(entries);
 * for (const task of tasks) {
 *   console.log(`Task: ${task.description}`);
 *   console.log(`Type: ${task.subagentType}`);
 *   console.log(`Result: ${task.result}`);
 * }
 */
export function extractTaskInvocations(
  entries: ChatHistoryEntry[]
): Array<{
  toolUseId: string;
  assistantUuid: string;
  subagentType: SubagentType;
  description: string;
  prompt: string;
  timestamp: string;
  result?: string;
  resultTimestamp?: string;
}> {
  const tasks: Array<{
    toolUseId: string;
    assistantUuid: string;
    subagentType: SubagentType;
    description: string;
    prompt: string;
    timestamp: string;
    result?: string;
    resultTimestamp?: string;
  }> = [];

  const toolUseMap = new Map<string, any>();

  for (const entry of entries) {
    if (isAssistantEntry(entry)) {
      for (const content of entry.message.content) {
        if (isToolUseContent(content) && content.name === 'Task') {
          const task = {
            toolUseId: content.id,
            assistantUuid: entry.uuid || '',
            subagentType: content.input.subagent_type as SubagentType,
            description: content.input.description || '',
            prompt: content.input.prompt || '',
            timestamp: entry.timestamp || ''
          };
          tasks.push(task);
          toolUseMap.set(content.id, task);
        }
      }
    }

    // Link results
    if (isInternalUserMessage(entry)) {
      const messageContent = entry.message.content;
      const contentArray = Array.isArray(messageContent) ? messageContent : [];
      for (const content of contentArray) {
        if (isToolResultContent(content)) {
          const task = toolUseMap.get(content.tool_use_id);
          if (task) {
            task.result = typeof content.content === 'string'
              ? content.content
              : JSON.stringify(content.content);
            task.resultTimestamp = entry.timestamp;
          }
        }
      }
    }
  }

  return tasks;
}

/**
 * Separate main conversation from subagent messages.
 *
 * For opcode parsing:
 * - Use when you need to process main and subagent messages separately
 *
 * @example
 * const { main, subagents } = separateMainAndSubagents(entries);
 * console.log(`Main: ${main.length} messages`);
 * for (const [agentId, messages] of subagents) {
 *   console.log(`Subagent ${agentId}: ${messages.length} messages`);
 * }
 */
export function separateMainAndSubagents(
  entries: ChatHistoryEntry[]
): {
  main: ChatHistoryEntry[];
  subagents: Map<string, ChatHistoryEntry[]>;
} {
  const main: ChatHistoryEntry[] = [];
  const subagents = new Map<string, ChatHistoryEntry[]>();

  for (const entry of entries) {
    if (isSubagentEntry(entry)) {
      const agentId = entry.agentId;
      if (!subagents.has(agentId)) {
        subagents.set(agentId, []);
      }
      subagents.get(agentId)!.push(entry);
    } else {
      main.push(entry);
    }
  }

  return { main, subagents };
}

// ============================================================================
// Session Metadata and Statistics
// ============================================================================

/**
 * Session-level metadata extracted from entries.
 *
 * For opcode parsing:
 * - Use to display session information
 * - Track session context (cwd, git branch, etc.)
 */
export interface SessionMetadata {
  sessionId: string;
  version: string;
  cwd: string;
  gitBranch: string;
  slug?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  userType: UserType;
  isSubagent: boolean;
  agentId?: string;
}

/**
 * Statistics about a chat session.
 *
 * For opcode parsing:
 * - Use for analytics and session summaries
 */
export interface SessionStatistics {
  totalEntries: number;
  realUserMessages: number;
  internalUserMessages: number;
  assistantMessages: number;
  systemMessages: number;
  summaries: number;
  fileSnapshots: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheHits: number;
  totalCacheCreations: number;
  toolUses: number;
  thinkingBlocks: number;
  images: number;
  subagentCount: number;
}

/**
 * Extract session metadata from entries.
 *
 * For opcode parsing:
 * - Call once to get session context
 * - Returns metadata from first conversational entry
 */
export function extractSessionMetadata(entries: ChatHistoryEntry[]): SessionMetadata | null {
  const firstConversational = entries.find(
    (e): e is ConversationalEntries => 'sessionId' in e
  ) as ConversationalEntries | undefined;

  if (!firstConversational) {
    return null;
  }

  return {
    sessionId: firstConversational.sessionId,
    version: firstConversational.version,
    cwd: firstConversational.cwd,
    gitBranch: firstConversational.gitBranch,
    slug: firstConversational.slug,
    startTimestamp: entries[0]?.timestamp,
    endTimestamp: entries[entries.length - 1]?.timestamp,
    userType: firstConversational.userType,
    isSubagent: firstConversational.isSidechain,
    agentId: 'agentId' in firstConversational ? firstConversational.agentId : undefined
  };
}

/**
 * Calculate session statistics.
 *
 * For opcode parsing:
 * - Use for session summaries and analytics
 *
 * @example
 * const stats = calculateSessionStatistics(entries);
 * console.log(`User messages: ${stats.realUserMessages}`);
 * console.log(`Tool uses: ${stats.toolUses}`);
 * console.log(`Total tokens: ${stats.totalInputTokens + stats.totalOutputTokens}`);
 */
export function calculateSessionStatistics(entries: ChatHistoryEntry[]): SessionStatistics {
  const stats: SessionStatistics = {
    totalEntries: entries.length,
    realUserMessages: 0,
    internalUserMessages: 0,
    assistantMessages: 0,
    systemMessages: 0,
    summaries: 0,
    fileSnapshots: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheHits: 0,
    totalCacheCreations: 0,
    toolUses: 0,
    thinkingBlocks: 0,
    images: 0,
    subagentCount: 0
  };

  const subagentIds = new Set<string>();

  for (const entry of entries) {
    if (isRealUserMessage(entry)) {
      stats.realUserMessages++;
    } else if (isInternalUserMessage(entry)) {
      stats.internalUserMessages++;
    } else if (isAssistantEntry(entry)) {
      stats.assistantMessages++;
      const usage = entry.message.usage;
      stats.totalInputTokens += usage.input_tokens;
      stats.totalOutputTokens += usage.output_tokens;
      if (usage.cache_read_input_tokens) {
        stats.totalCacheHits += usage.cache_read_input_tokens;
      }
      if (usage.cache_creation_input_tokens) {
        stats.totalCacheCreations += usage.cache_creation_input_tokens;
      }

      // Count content types
      for (const content of entry.message.content) {
        if (isToolUseContent(content)) {
          stats.toolUses++;
        } else if (isThinkingContent(content)) {
          stats.thinkingBlocks++;
        } else if (isImageContent(content)) {
          stats.images++;
        }
      }
    } else if (isSystemEntry(entry)) {
      stats.systemMessages++;
    } else if (isSummaryEntry(entry)) {
      stats.summaries++;
    } else if (isFileHistorySnapshotEntry(entry)) {
      stats.fileSnapshots++;
    }

    // Track subagents
    if (isSubagentEntry(entry)) {
      subagentIds.add(entry.agentId);
    }
  }

  stats.subagentCount = subagentIds.size;

  return stats;
}

// ============================================================================
// Parser Options and Result Types
// ============================================================================

/**
 * Options for parsing JSONL chat history files.
 */
export interface ParseOptions {
  /**
   * Whether to validate entries against the schema.
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to include file history snapshots in the result.
   * @default true
   */
  includeSnapshots?: boolean;

  /**
   * Whether to include system messages in the result.
   * @default true
   */
  includeSystemMessages?: boolean;

  /**
   * Filter entries by type.
   */
  typeFilter?: EntryType[];

  /**
   * Filter entries by timestamp range.
   */
  timestampRange?: {
    start?: string;
    end?: string;
  };

  /**
   * Whether to include subagent messages.
   * @default true
   */
  includeSubagents?: boolean;
}

/**
 * Result of parsing a JSONL chat history file.
 */
export interface ParseResult {
  entries: ChatHistoryEntry[];
  metadata: SessionMetadata | null;
  statistics: SessionStatistics;
  errors: ParseError[];
}

/**
 * Error encountered during parsing.
 */
export interface ParseError {
  line: number;
  entry?: Partial<ChatHistoryEntry>;
  error: string;
  raw?: string;
}

/**
 * Parse JSONL file with options.
 *
 * For opcode parsing:
 * - Primary entry point for parsing JSONL files
 * - Returns parsed entries, metadata, and statistics
 *
 * @example
 * const result = await parseJSONLFile('session.jsonl', {
 *   includeSnapshots: false,
 *   includeSystemMessages: false
 * });
 *
 * console.log('Metadata:', result.metadata);
 * console.log('Statistics:', result.statistics);
 * console.log('Entries:', result.entries.length);
 *
 * if (result.errors.length > 0) {
 *   console.error('Parse errors:', result.errors);
 * }
 */
export async function parseJSONLFile(
  _filePath: string,
  _options: ParseOptions = {}
): Promise<ParseResult> {
  // This is a placeholder - actual implementation would use Node.js fs/readline
  // to read and parse the file line by line
  throw new Error('Not implemented - example usage only');
}

/**
 * ============================================================================
 * END OF SPECIFICATION
 * ============================================================================
 *
 * This file provides a complete, production-ready specification of the Claude
 * Code JSONL format. It includes:
 *
 * ✓ Complete TypeScript interfaces for all 28+ fields
 * ✓ Critical message distinction (real user vs internal user via isMeta)
 * ✓ All content types (text, thinking, tool_use, tool_result, image)
 * ✓ Type guards and helpers for safe type narrowing
 * ✓ Comprehensive documentation in JSDoc comments
 * ✓ Complete usage examples showing parsing, filtering, and linking
 * ✓ Subagent patterns and detection
 * ✓ Tool call linking via tool_use_id
 * ✓ Conversation flow patterns
 * ✓ Session metadata and statistics
 *
 * For opcode development, the most critical concepts are:
 *
 * 1. Use isRealUserMessage() to filter for displayable user messages
 * 2. Use linkToolUsesWithResults() to connect tool calls to results
 * 3. Use isSubagentEntry() to identify subagent messages
 * 4. Check stop_reason to predict next message type
 * 5. Follow parentUuid chains to reconstruct conversation trees
 *
 * This is the ONLY file needed to understand the entire JSONL format.
 *
 * ============================================================================
 */
