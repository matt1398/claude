/**
 * Type definitions for the new chat history architecture.
 * These types separate user input from AI responses for a chat-style display.
 */

import type { ParsedMessage, SemanticStep, Subagent, SessionMetrics } from './data';

// =============================================================================
// Expansion Levels
// =============================================================================

/**
 * AI Group expansion levels for the collapsible UI.
 * - collapsed: Show only summary line "1 tool call, 3 messages"
 * - items: Show list of items (thinking, tool calls, etc.)
 * - full: Show full content of each item
 */
export type AIGroupExpansionLevel = 'collapsed' | 'items' | 'full';

// =============================================================================
// User Group Types
// =============================================================================

/**
 * Command reference extracted from user input (e.g., /isolate-context, /context).
 */
export interface CommandInfo {
  /** Command name without slash (e.g., "isolate-context") */
  name: string;
  /** Optional arguments after the command */
  args?: string;
  /** Full raw text including slash */
  raw: string;
  /** Position in the text where command starts */
  startIndex: number;
  /** Position in the text where command ends */
  endIndex: number;
}

/**
 * Image data from user message.
 */
export interface ImageData {
  /** Unique identifier */
  id: string;
  /** MIME type */
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** Base64 encoded data for display */
  data?: string;
}

/**
 * File reference mentioned in user message (e.g., @file.ts).
 */
export interface FileReference {
  /** File path */
  path: string;
  /** Optional line range */
  lineRange?: {
    start: number;
    end?: number;
  };
  /** Raw text as written */
  raw: string;
}

/**
 * Parsed content from a user message.
 */
export interface UserGroupContent {
  /** Plain text content (with commands removed for display) */
  text?: string;
  /** Raw text content (original) */
  rawText?: string;
  /** Extracted commands */
  commands: CommandInfo[];
  /** Extracted images */
  images: ImageData[];
  /** Extracted file references */
  fileReferences: FileReference[];
}

/**
 * User Group - represents a user's complete input.
 * This is one side of a conversation turn.
 */
export interface UserGroup {
  /** Unique identifier */
  id: string;
  /** Original ParsedMessage */
  message: ParsedMessage;
  /** Timestamp of the message */
  timestamp: Date;
  /** Parsed content */
  content: UserGroupContent;
  /** Index within the session (for ordering) */
  index: number;
}

// =============================================================================
// AI Group Types
// =============================================================================

/**
 * Summary statistics for the collapsed AI Group view.
 */
export interface AIGroupSummary {
  /** Preview of thinking content (first ~100 chars) */
  thinkingPreview?: string;
  /** Number of tool calls in this group */
  toolCallCount: number;
  /** Number of output messages */
  outputMessageCount: number;
  /** Number of subagent executions */
  subagentCount: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Total tokens used */
  totalTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cached tokens */
  cachedTokens: number;
}

/**
 * Linked tool item pairing a tool call with its result.
 * Includes preview text for display in collapsed/item views.
 */
export interface LinkedToolItem {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool input parameters */
  input: Record<string, unknown>;
  /** Tool result if received */
  result?: {
    content: string | unknown[];
    isError: boolean;
  };
  /** Preview of input (first 100 chars) */
  inputPreview: string;
  /** Preview of output (first 200 chars) */
  outputPreview?: string;
  /** When the tool was called */
  startTime: Date;
  /** When the result was received */
  endTime?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Whether this is an orphaned call (no result) */
  isOrphaned: boolean;
}

/**
 * Display item for the AI Group - union of possible items to show.
 * These are flattened and shown in chronological order.
 */
export type AIGroupDisplayItem =
  | { type: 'thinking'; content: string; timestamp: Date }
  | { type: 'tool'; tool: LinkedToolItem }
  | { type: 'subagent'; subagent: Subagent }
  | { type: 'output'; content: string; timestamp: Date };

/**
 * The last output in an AI Group - what user sees as "the answer".
 * Either text output or the last tool result.
 */
export interface AIGroupLastOutput {
  /** Output type */
  type: 'text' | 'tool_result';
  /** Text content if type === 'text' */
  text?: string;
  /** Tool name if type === 'tool_result' */
  toolName?: string;
  /** Tool result content if type === 'tool_result' */
  toolResult?: string;
  /** Whether the tool result was an error */
  isError?: boolean;
  /** Timestamp of this output */
  timestamp: Date;
}

/**
 * Enhanced AI Group with display-ready data for the new UI.
 * Extends the base AIGroup with computed properties for rendering.
 */
export interface EnhancedAIGroup extends AIGroup {
  /** The last visible output (text or tool result) */
  lastOutput: AIGroupLastOutput | null;
  /** Flattened display items in chronological order */
  displayItems: AIGroupDisplayItem[];
  /** Map of tool call IDs to linked tool items */
  linkedTools: Map<string, LinkedToolItem>;
  /** Human-readable summary of items (e.g., "2 thinking, 4 tool calls, 3 subagents") */
  itemsSummary: string;
}

/**
 * Status of an AI Group.
 */
export type AIGroupStatus = 'complete' | 'interrupted' | 'error' | 'in_progress';

/**
 * Token metrics for an AI Group.
 */
export interface AIGroupTokens {
  input: number;
  output: number;
  cached: number;
  thinking?: number;
}

/**
 * AI Group - represents a single assistant response cycle.
 * Multiple AI Groups can exist per user message (e.g., if interrupted).
 */
export interface AIGroup {
  /** Unique identifier */
  id: string;
  /** Reference to the parent UserGroup */
  userGroupId: string;
  /** Index within the chunk (for multiple responses per user message) */
  responseIndex: number;
  /** Start timestamp */
  startTime: Date;
  /** End timestamp */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Semantic steps within this response */
  steps: SemanticStep[];
  /** Token metrics */
  tokens: AIGroupTokens;
  /** Summary for collapsed view */
  summary: AIGroupSummary;
  /** Completion status */
  status: AIGroupStatus;
  /** Associated subagents */
  subagents: Subagent[];
  /** Source chunk ID */
  chunkId: string;
  /** Metrics for this AI response */
  metrics: SessionMetrics;
}

// =============================================================================
// Conversation Types
// =============================================================================

/**
 * Conversation turn - pairs a user message with all AI responses.
 */
export interface ConversationTurn {
  /** Unique identifier */
  id: string;
  /** The user's input */
  userGroup: UserGroup;
  /** AI responses (may be multiple if interrupted/resumed) */
  aiGroups: AIGroup[];
  /** Start time (user message timestamp) */
  startTime: Date;
  /** End time (last AI response end) */
  endTime: Date;
}

/**
 * Complete conversation for a session.
 */
export interface SessionConversation {
  /** Session ID */
  sessionId: string;
  /** All conversation turns */
  turns: ConversationTurn[];
  /** Total count of user groups */
  totalUserGroups: number;
  /** Total count of AI groups */
  totalAIGroups: number;
}

// =============================================================================
// Chat Message Types (for rendering)
// =============================================================================

/**
 * Chat message wrapper for unified rendering.
 */
export interface ChatMessage {
  /** Unique identifier */
  id: string;
  /** Message type */
  type: 'user' | 'ai';
  /** Timestamp for ordering */
  timestamp: Date;
  /** User group data (if type === 'user') */
  userGroup?: UserGroup;
  /** AI group data (if type === 'ai') */
  aiGroup?: AIGroup;
}
