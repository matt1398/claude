/**
 * ErrorDetector service - Detects errors from parsed JSONL messages.
 *
 * Responsibilities:
 * - Scan parsed messages for tool result errors
 * - Extract error information from tool results
 * - Generate unique error IDs for tracking
 * - Provide line numbers for deep linking
 * - Support configurable notification triggers from ConfigManager
 *
 * Detection criteria:
 * - Uses configurable triggers from ConfigManager
 * - Supports tool_result triggers with requireError, toolName, and matchPattern
 * - Supports tool_use triggers for future expansion
 */

import { randomUUID } from 'crypto';
import {
  ParsedMessage,
  ContentBlock,
  isToolResultContent,
  ToolUseContent,
} from '../types/claude';
import { extractProjectName } from '../utils/pathDecoder';
import { ConfigManager, NotificationTrigger } from './ConfigManager';

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
  /** Tool use ID for precise deep linking to the specific tool item */
  toolUseId?: string;
  /** Additional context about the error */
  context: {
    /** Human-readable project name */
    projectName: string;
    /** Current working directory when error occurred */
    cwd?: string;
  };
}

/**
 * Extracted tool result information for trigger matching.
 */
interface ExtractedToolResult {
  toolUseId: string;
  isError: boolean;
  content: string | unknown[];
  toolName?: string;
}

// =============================================================================
// Error Detector Class
// =============================================================================

export class ErrorDetector {
  // ===========================================================================
  // Main Detection Method
  // ===========================================================================

  /**
   * Detects errors from an array of parsed messages using configurable triggers.
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

    // Get enabled triggers from config
    const configManager = ConfigManager.getInstance();
    const triggers = configManager.getEnabledTriggers();

    if (triggers.length === 0) {
      return errors;
    }

    // Build tool_use map for linking results to calls
    const toolUseMap = this.buildToolUseMap(messages);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const lineNumber = i + 1; // 1-based line numbers for JSONL

      // Check each trigger against this message
      for (const trigger of triggers) {
        const error = this.checkTrigger(
          message,
          trigger,
          toolUseMap,
          sessionId,
          projectId,
          filePath,
          lineNumber
        );

        if (error) {
          errors.push(error);
        }
      }
    }

    return errors;
  }

  // ===========================================================================
  // Tool Use Map Building
  // ===========================================================================

  /**
   * Builds a map of tool_use_id to tool_use content.
   * This allows linking tool_results back to their tool_use calls to check tool names.
   */
  private buildToolUseMap(
    messages: ParsedMessage[]
  ): Map<string, { name: string; input: Record<string, unknown> }> {
    const map = new Map<string, { name: string; input: Record<string, unknown> }>();

    for (const message of messages) {
      if (message.type !== 'assistant') continue;

      // Check content array for tool_use blocks
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'tool_use') {
            const toolUse = block as ToolUseContent;
            map.set(toolUse.id, {
              name: toolUse.name,
              input: toolUse.input || {},
            });
          }
        }
      }

      // Also check toolCalls if present
      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          map.set(toolCall.id, {
            name: toolCall.name,
            input: toolCall.input || {},
          });
        }
      }
    }

    return map;
  }

  // ===========================================================================
  // Trigger Checking
  // ===========================================================================

  /**
   * Checks if a message matches a specific trigger.
   * @param message - The parsed message to check
   * @param trigger - The trigger configuration
   * @param toolUseMap - Map of tool_use_id to tool_use content for linking results to calls
   * @param sessionId - Session ID
   * @param projectId - Project ID
   * @param filePath - File path
   * @param lineNumber - Line number in JSONL
   * @returns DetectedError if trigger matches, null otherwise
   */
  private checkTrigger(
    message: ParsedMessage,
    trigger: NotificationTrigger,
    toolUseMap: Map<string, { name: string; input: Record<string, unknown> }>,
    sessionId: string,
    projectId: string,
    filePath: string,
    lineNumber: number
  ): DetectedError | null {
    // Handle tool_result triggers
    if (trigger.contentType === 'tool_result') {
      return this.checkToolResultTrigger(
        message,
        trigger,
        toolUseMap,
        sessionId,
        projectId,
        filePath,
        lineNumber
      );
    }

    // Handle tool_use triggers (for future expansion)
    if (trigger.contentType === 'tool_use') {
      return this.checkToolUseTrigger(
        message,
        trigger,
        sessionId,
        projectId,
        filePath,
        lineNumber
      );
    }

    return null;
  }

  /**
   * Checks if a tool_result matches a trigger.
   */
  private checkToolResultTrigger(
    message: ParsedMessage,
    trigger: NotificationTrigger,
    toolUseMap: Map<string, { name: string; input: Record<string, unknown> }>,
    sessionId: string,
    projectId: string,
    filePath: string,
    lineNumber: number
  ): DetectedError | null {
    const toolResults = this.extractToolResults(message);

    for (const result of toolResults) {
      // If requireError is true, only match when is_error is true
      if (trigger.requireError) {
        if (!result.isError) {
          continue;
        }

        // Extract error message for ignore pattern checking
        const errorMessage = this.extractErrorMessage(result);

        // Check ignore patterns - if any match, skip this error
        if (this.matchesIgnorePatterns(errorMessage, trigger.ignorePatterns)) {
          continue;
        }

        // Create detected error
        return this.createDetectedError({
          sessionId,
          projectId,
          filePath,
          projectName: extractProjectName(projectId),
          lineNumber,
          source: result.toolName || 'tool_result',
          message: errorMessage,
          timestamp: message.timestamp,
          cwd: message.cwd,
          toolUseId: result.toolUseId,
        });
      }

      // Non-error tool_result triggers (if toolName is specified)
      if (trigger.toolName) {
        const toolUse = toolUseMap.get(result.toolUseId);
        if (!toolUse || toolUse.name !== trigger.toolName) {
          continue;
        }

        // Match against content if matchField is 'content'
        if (trigger.matchField === 'content' && trigger.matchPattern) {
          const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          if (!this.matchesPattern(content, trigger.matchPattern)) {
            continue;
          }
          if (this.matchesIgnorePatterns(content, trigger.ignorePatterns)) {
            continue;
          }

          return this.createDetectedError({
            sessionId,
            projectId,
            filePath,
            projectName: extractProjectName(projectId),
            lineNumber,
            source: trigger.toolName,
            message: `Tool result matched: ${content.slice(0, 200)}`,
            timestamp: message.timestamp,
            cwd: message.cwd,
            toolUseId: result.toolUseId,
          });
        }
      }
    }

    return null;
  }

  /**
   * Checks if a tool_use matches a trigger.
   */
  private checkToolUseTrigger(
    message: ParsedMessage,
    trigger: NotificationTrigger,
    sessionId: string,
    projectId: string,
    filePath: string,
    lineNumber: number
  ): DetectedError | null {
    if (message.type !== 'assistant') return null;

    const contentBlocks = this.getContentBlocks(message);

    for (const block of contentBlocks) {
      if (block.type !== 'tool_use') continue;

      const toolUse = block as { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown> };

      // Check tool name if specified
      if (trigger.toolName && toolUse.name !== trigger.toolName) {
        continue;
      }

      // Extract the field to match based on matchField
      const fieldValue = this.extractToolUseField(toolUse, trigger.matchField);
      if (!fieldValue) continue;

      // Check match pattern
      if (trigger.matchPattern && !this.matchesPattern(fieldValue, trigger.matchPattern)) {
        continue;
      }

      // Check ignore patterns
      if (this.matchesIgnorePatterns(fieldValue, trigger.ignorePatterns)) {
        continue;
      }

      // Match found!
      return this.createDetectedError({
        sessionId,
        projectId,
        filePath,
        projectName: extractProjectName(projectId),
        lineNumber,
        source: toolUse.name,
        message: `${trigger.matchField || 'tool_use'}: ${fieldValue.slice(0, 200)}`,
        timestamp: message.timestamp,
        cwd: message.cwd,
        toolUseId: toolUse.id,
      });
    }

    return null;
  }

  /**
   * Extracts the specified field from a tool_use block.
   */
  private extractToolUseField(
    toolUse: { name: string; input?: Record<string, unknown> },
    matchField?: string
  ): string | null {
    if (!matchField || !toolUse.input) return null;

    const value = toolUse.input[matchField];
    if (typeof value === 'string') {
      return value;
    }
    if (value !== undefined) {
      return JSON.stringify(value);
    }
    return null;
  }

  /**
   * Gets content blocks from a message, handling both array and object formats.
   */
  private getContentBlocks(message: ParsedMessage): ContentBlock[] {
    if (Array.isArray(message.content)) {
      return message.content;
    }
    return [];
  }

  /**
   * Checks if content matches any of the ignore patterns.
   */
  private matchesIgnorePatterns(content: string, ignorePatterns?: string[]): boolean {
    if (!ignorePatterns || ignorePatterns.length === 0) {
      return false;
    }

    for (const pattern of ignorePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) {
          return true;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return false;
  }

  /**
   * Checks if content matches a pattern.
   */
  private matchesPattern(content: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Tool Result Extraction
  // ===========================================================================

  /**
   * Extracts tool results from a message.
   */
  private extractToolResults(message: ParsedMessage): ExtractedToolResult[] {
    const results: ExtractedToolResult[] = [];

    // Pattern 1: Check toolResults array on ParsedMessage
    if (message.toolResults && message.toolResults.length > 0) {
      for (const toolResult of message.toolResults) {
        results.push({
          toolUseId: toolResult.toolUseId,
          isError: toolResult.isError === true,
          content: toolResult.content,
          toolName: this.findToolName(message, toolResult.toolUseId) || undefined,
        });
      }
    }

    // Pattern 2: Check toolUseResult field (enriched data from entry)
    if (message.toolUseResult) {
      const toolUseResult = message.toolUseResult;
      const hasError = toolUseResult.isError === true || toolUseResult.is_error === true;
      const toolUseId = (typeof toolUseResult.toolUseId === 'string' ? toolUseResult.toolUseId : undefined)
        || message.sourceToolUseID;

      if (toolUseId) {
        results.push({
          toolUseId,
          isError: hasError,
          content: this.extractContentFromToolUseResult(toolUseResult),
          toolName: typeof toolUseResult.toolName === 'string' ? toolUseResult.toolName : undefined,
        });
      }
    }

    // Pattern 3: Check content blocks for tool_result
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isToolResultContent(block)) {
          results.push({
            toolUseId: block.tool_use_id,
            isError: block.is_error === true,
            content: block.content,
            toolName: this.findToolNameByToolUseId(message, block.tool_use_id) || undefined,
          });
        }
      }
    }

    return results;
  }

  /**
   * Extracts content string from toolUseResult.
   */
  private extractContentFromToolUseResult(toolUseResult: Record<string, unknown>): string {
    if (typeof toolUseResult.error === 'string') {
      return toolUseResult.error;
    }
    if (typeof toolUseResult.stderr === 'string' && (toolUseResult.stderr as string).trim()) {
      return toolUseResult.stderr as string;
    }
    if (typeof toolUseResult.content === 'string') {
      return toolUseResult.content;
    }
    if (typeof toolUseResult.message === 'string') {
      return toolUseResult.message;
    }
    return '';
  }

  /**
   * Extracts error message from a tool result.
   */
  private extractErrorMessage(result: ExtractedToolResult): string {
    if (typeof result.content === 'string') {
      return result.content.trim() || 'Unknown error';
    }

    if (Array.isArray(result.content)) {
      const texts: string[] = [];
      for (const item of result.content) {
        if (item && typeof item === 'object' && 'type' in item) {
          const block = item as ContentBlock;
          if (block.type === 'text' && 'text' in block) {
            texts.push(block.text);
          }
        }
      }
      return texts.join('\n').trim() || 'Unknown error';
    }

    return 'Unknown error';
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

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
    toolUseId?: string;
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
      toolUseId: params.toolUseId,
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

  // ===========================================================================
  // Trigger Testing (Preview Feature)
  // ===========================================================================

  /**
   * Tests a trigger configuration against historical session data.
   * Returns a list of errors that would have been detected.
   * @param trigger - The trigger configuration to test
   * @param limit - Maximum number of results to return (default 50)
   */
  public async testTrigger(
    trigger: NotificationTrigger,
    limit: number = 50
  ): Promise<{
    totalCount: number;
    errors: DetectedError[];
  }> {
    // Import ProjectScanner and SessionParser dynamically to avoid circular dependency
    const { ProjectScanner } = await import('./ProjectScanner');
    const { parseJsonlFile } = await import('../utils/jsonl');

    const projectScanner = new ProjectScanner();
    const errors: DetectedError[] = [];
    let totalCount = 0;

    try {
      // Get list of all projects
      const projects = await projectScanner.scan();

      // Process each project to find session files
      for (const project of projects) {
        if (errors.length >= limit) break;

        const sessionFiles = await projectScanner.listSessionFiles(project.id);

        // Process each session file (most recent first)
        for (const filePath of sessionFiles) {
          if (errors.length >= limit) break;

          try {
            // Parse session file
            const messages = await parseJsonlFile(filePath);

            // Extract sessionId from file path
            const filename = filePath.split('/').pop() || '';
            const sessionId = filename.replace(/\.jsonl$/, '');

            // Test the trigger against each message
            const sessionErrors = this.detectErrorsWithTrigger(
              messages,
              trigger,
              sessionId,
              project.id,
              filePath
            );

            totalCount += sessionErrors.length;

            // Add errors up to limit
            for (const error of sessionErrors) {
              if (errors.length >= limit) break;
              errors.push(error);
            }
          } catch (error) {
            // Skip files that can't be parsed
            console.error(`Error parsing session file ${filePath}:`, error);
            continue;
          }
        }
      }

      return { totalCount, errors };
    } catch (error) {
      console.error('Error testing trigger:', error);
      return { totalCount: 0, errors: [] };
    }
  }

  /**
   * Detects errors from messages using a single trigger.
   * Used by testTrigger for preview functionality.
   */
  private detectErrorsWithTrigger(
    messages: ParsedMessage[],
    trigger: NotificationTrigger,
    sessionId: string,
    projectId: string,
    filePath: string
  ): DetectedError[] {
    const errors: DetectedError[] = [];

    // Build tool_use map for linking results to calls
    const toolUseMap = this.buildToolUseMap(messages);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const lineNumber = i + 1; // 1-based line numbers for JSONL

      const error = this.checkTrigger(
        message,
        trigger,
        toolUseMap,
        sessionId,
        projectId,
        filePath,
        lineNumber
      );

      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const errorDetector = new ErrorDetector();
