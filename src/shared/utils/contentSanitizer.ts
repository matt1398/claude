/**
 * Content sanitization utilities for display.
 *
 * SHARED MODULE: Used by both main and renderer processes.
 * - Main process: Used in jsonl.ts for initial parsing
 * - Renderer process: Used in groupTransformer.ts for display formatting
 *
 * This module handles conversion of raw JSONL content (with XML tags) into
 * human-readable format for the UI.
 *
 * NOTE: This file was previously duplicated in both main/utils and renderer/utils.
 * Consolidated to src/shared/utils to maintain DRY principle while serving both processes.
 */

/**
 * Patterns for noise tags that should be completely removed.
 * These are system-generated metadata that provide no value in display.
 */
const NOISE_TAG_PATTERNS = [
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi,
  /<system-reminder>[\s\S]*?<\/system-reminder>/gi,
];

/**
 * Extract content from <local-command-stdout> tags.
 * Returns the command output without the wrapper tags.
 */
function extractCommandOutput(content: string): string | null {
  const match = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract command info from command XML tags.
 * Returns the slash command in readable format (e.g., "/model sonnet")
 */
function extractCommandDisplay(content: string): string | null {
  const commandNameMatch = content.match(/<command-name>\/([^<]+)<\/command-name>/);
  const commandArgsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);

  if (commandNameMatch) {
    const commandName = `/${commandNameMatch[1].trim()}`;
    const args = commandArgsMatch?.[1]?.trim();
    return args ? `${commandName} ${args}` : commandName;
  }

  return null;
}

/**
 * Check if content is primarily a command message.
 */
export function isCommandContent(content: string): boolean {
  return content.includes('<command-name>');
}

/**
 * Check if content is a command output message.
 */
export function isCommandOutputContent(content: string): boolean {
  return content.includes('<local-command-stdout>');
}

/**
 * Sanitize content for display.
 *
 * - Command messages: Converted to readable format (e.g., "/model sonnet")
 * - Command output: Extracted from <local-command-stdout> tags
 * - Noise tags: Completely removed
 * - Regular content: Returned as-is
 */
export function sanitizeDisplayContent(content: string): string {
  // If it's a command output message, extract the output content
  if (isCommandOutputContent(content)) {
    const commandOutput = extractCommandOutput(content);
    if (commandOutput) {
      return commandOutput;
    }
  }

  // If it's a command message, extract the command for display
  if (isCommandContent(content)) {
    const commandDisplay = extractCommandDisplay(content);
    if (commandDisplay) {
      return commandDisplay;
    }
  }

  // Remove noise tags
  let sanitized = content;
  for (const pattern of NOISE_TAG_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Also remove any remaining command tags (in case of mixed content)
  sanitized = sanitized
    .replace(/<command-name>[\s\S]*?<\/command-name>/gi, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/gi, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/gi, '');

  return sanitized.trim();
}
