/**
 * ErrorDetector service - Detects errors from parsed JSONL messages.
 *
 * Responsibilities:
 * - Scan parsed messages for tool result errors
 * - Extract error information from tool results
 * - Generate unique error IDs for tracking
 * - Provide line numbers for deep linking
 *
 * Detection criteria:
 * - Only detects errors when isError === true or is_error === true
 * - Does NOT use text-based heuristics (no checking for "error" in strings)
 */

import { randomUUID } from 'crypto';
import {
  ParsedMessage,
  ToolResultContent,
  ContentBlock,
  isToolResultContent,
} from '../types/claude';
import { extractProjectName } from '../utils/pathDecoder';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a detected error from a Claude Code session.
 */
export interface DetectedError {
  /** UUID for unique identification */
  id: string;
  /** Unix timestamp when error was detected */
  timestamp: number;
  /** Session ID where error occurred */
  sessionId: string;
  /** Project ID (encoded directory name) */
  projectId: string;
  /** Path to the JSONL file */
  filePath: string;
  /** Source of the error - tool name or 'assistant' */
  source: string;
  /** Error message content */
  message: string;
  /** Line number in JSONL for deep linking */
  lineNumber?: number;
  /** Additional context about the error */
  context: {
    /** Human-readable project name */
    projectName: string;
    /** Current working directory when error occurred */
    cwd?: string;
  };
}

// =============================================================================
// Error Detector Class
// =============================================================================

export class ErrorDetector {
  // ===========================================================================
  // Main Detection Method
  // ===========================================================================

  /**
   * Detects errors from an array of parsed messages.
   *
   * @param messages - Array of ParsedMessage objects from a session
   * @param sessionId - The session ID
   * @param projectId - The project ID (encoded directory name)
   * @param filePath - Path to the JSONL file
   * @returns Array of DetectedError objects
   */
  detectErrors(
    messages: ParsedMessage[],
    sessionId: string,
    projectId: string,
    filePath: string
  ): DetectedError[] {
    const errors: DetectedError[] = [];
    const projectName = extractProjectName(projectId);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const lineNumber = i + 1; // 1-based line numbers for JSONL

      // Check tool results in the message
      const messageErrors = this.detectErrorsInMessage(
        message,
        sessionId,
        projectId,
        filePath,
        projectName,
        lineNumber
      );

      errors.push(...messageErrors);
    }

    return errors;
  }

  // ===========================================================================
  // Message-Level Detection
  // ===========================================================================

  /**
   * Detects errors in a single message.
   */
  private detectErrorsInMessage(
    message: ParsedMessage,
    sessionId: string,
    projectId: string,
    filePath: string,
    projectName: string,
    lineNumber: number
  ): DetectedError[] {
    const errors: DetectedError[] = [];

    // Pattern 1: Check toolResults array on ParsedMessage (isError === true)
    if (message.toolResults && message.toolResults.length > 0) {
      for (const toolResult of message.toolResults) {
        if (toolResult.isError === true) {
          const errorMessage = this.extractToolResultMessage(toolResult.content);
          if (errorMessage) {
            errors.push(this.createDetectedError({
              sessionId,
              projectId,
              filePath,
              projectName,
              lineNumber,
              source: this.findToolName(message, toolResult.toolUseId) || 'unknown',
              message: errorMessage,
              timestamp: message.timestamp,
              cwd: message.cwd,
            }));
          }
        }
      }
    }

    // Pattern 2: Check toolUseResult field (enriched data from entry)
    if (message.toolUseResult) {
      const resultError = this.checkToolUseResult(
        message.toolUseResult,
        sessionId,
        projectId,
        filePath,
        projectName,
        lineNumber,
        message.timestamp,
        message.cwd
      );
      if (resultError) {
        errors.push(resultError);
      }
    }

    // Pattern 3: Check content blocks for tool_result with is_error
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isToolResultContent(block)) {
          const contentError = this.checkToolResultContent(
            block,
            message,
            sessionId,
            projectId,
            filePath,
            projectName,
            lineNumber
          );
          if (contentError) {
            errors.push(contentError);
          }
        }
      }
    }

    return errors;
  }

  // ===========================================================================
  // Tool Use Result Detection
  // ===========================================================================

  /**
   * Checks toolUseResult field for isError === true or is_error === true.
   */
  private checkToolUseResult(
    toolUseResult: Record<string, unknown>,
    sessionId: string,
    projectId: string,
    filePath: string,
    projectName: string,
    lineNumber: number,
    timestamp: Date,
    cwd?: string
  ): DetectedError | null {
    // Only detect errors when isError or is_error is explicitly true
    const hasError = toolUseResult.isError === true || toolUseResult.is_error === true;

    if (!hasError) {
      return null;
    }

    // Extract error message from various fields
    let errorMessage: string | null = null;
    let source = 'tool';

    if (typeof toolUseResult.error === 'string') {
      errorMessage = toolUseResult.error;
    } else if (typeof toolUseResult.stderr === 'string' && toolUseResult.stderr.trim()) {
      errorMessage = toolUseResult.stderr;
    } else if (typeof toolUseResult.content === 'string') {
      errorMessage = toolUseResult.content;
    } else if (typeof toolUseResult.message === 'string') {
      errorMessage = toolUseResult.message;
    }

    // Check toolName if present
    if (typeof toolUseResult.toolName === 'string') {
      source = toolUseResult.toolName;
    }

    if (errorMessage) {
      return this.createDetectedError({
        sessionId,
        projectId,
        filePath,
        projectName,
        lineNumber,
        source,
        message: errorMessage,
        timestamp,
        cwd,
      });
    }

    return null;
  }

  // ===========================================================================
  // Tool Result Content Detection
  // ===========================================================================

  /**
   * Checks a tool_result content block for is_error === true.
   */
  private checkToolResultContent(
    block: ToolResultContent,
    message: ParsedMessage,
    sessionId: string,
    projectId: string,
    filePath: string,
    projectName: string,
    lineNumber: number
  ): DetectedError | null {
    // Only detect errors when is_error is explicitly true
    if (block.is_error !== true) {
      return null;
    }

    const errorMessage = this.extractToolResultMessage(block.content);
    if (errorMessage) {
      return this.createDetectedError({
        sessionId,
        projectId,
        filePath,
        projectName,
        lineNumber,
        source: this.findToolNameByToolUseId(message, block.tool_use_id) || 'tool',
        message: errorMessage,
        timestamp: message.timestamp,
        cwd: message.cwd,
      });
    }

    return null;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Extracts error message string from tool result content.
   */
  private extractToolResultMessage(content: string | unknown[]): string | null {
    if (typeof content === 'string') {
      return content.trim() || null;
    }

    if (Array.isArray(content)) {
      // Extract text from content blocks
      const texts: string[] = [];
      for (const item of content) {
        if (item && typeof item === 'object' && 'type' in item) {
          const block = item as ContentBlock;
          if (block.type === 'text' && 'text' in block) {
            texts.push(block.text);
          }
        }
      }
      return texts.join('\n').trim() || null;
    }

    return null;
  }

  /**
   * Finds tool name from message's tool calls by tool use ID.
   */
  private findToolName(message: ParsedMessage, toolUseId: string): string | null {
    if (message.toolCalls) {
      const toolCall = message.toolCalls.find((tc) => tc.id === toolUseId);
      if (toolCall) {
        return toolCall.name;
      }
    }
    return null;
  }

  /**
   * Finds tool name by searching tool_use_id in the message context.
   */
  private findToolNameByToolUseId(message: ParsedMessage, toolUseId: string): string | null {
    // First check toolCalls
    const fromToolCalls = this.findToolName(message, toolUseId);
    if (fromToolCalls) return fromToolCalls;

    // Check sourceToolUseID if this message is a tool result
    if (message.sourceToolUseID === toolUseId && message.toolUseResult) {
      if (typeof message.toolUseResult.toolName === 'string') {
        return message.toolUseResult.toolName;
      }
    }

    return null;
  }

  /**
   * Creates a DetectedError object with all required fields.
   */
  private createDetectedError(params: {
    sessionId: string;
    projectId: string;
    filePath: string;
    projectName: string;
    lineNumber: number;
    source: string;
    message: string;
    timestamp: Date;
    cwd?: string;
  }): DetectedError {
    return {
      id: randomUUID(),
      timestamp: params.timestamp.getTime(),
      sessionId: params.sessionId,
      projectId: params.projectId,
      filePath: params.filePath,
      source: params.source,
      message: this.truncateMessage(params.message),
      lineNumber: params.lineNumber,
      context: {
        projectName: params.projectName,
        cwd: params.cwd,
      },
    };
  }

  /**
   * Truncates error message to a reasonable length for display.
   */
  private truncateMessage(message: string, maxLength: number = 500): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.slice(0, maxLength) + '...';
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const errorDetector = new ErrorDetector();
