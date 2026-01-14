/**
 * Content sanitization utilities for display in the renderer.
 *
 * Handles conversion of raw content (with XML tags) into
 * human-readable format for the UI.
 */

/**
 * Patterns for noise tags that should be completely removed.
 */
const NOISE_TAG_PATTERNS = [
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/gi,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi,
  /<system-reminder>[\s\S]*?<\/system-reminder>/gi,
];

/**
 * Extract command display from command XML tags.
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
 * Sanitize content for display.
 *
 * - Command messages: Converted to readable format (e.g., "/model sonnet")
 * - Noise tags: Completely removed
 * - Regular content: Returned as-is
 */
export function sanitizeDisplayContent(content: string): string {
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
