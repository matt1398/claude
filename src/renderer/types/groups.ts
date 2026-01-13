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
