/**
 * Utility functions for decoding Claude Code project directory names.
 *
 * Directory naming pattern:
 * - Encoded: "-Users-bskim-doe" -> Decoded: "/Users/bskim/doe"
 * - Leading dash is removed
 * - Remaining dashes are replaced with slashes
 */

/**
 * Decodes a project directory name to its original path.
 * @param encodedName - The encoded directory name (e.g., "-Users-bskim-doe")
 * @returns The decoded path (e.g., "/Users/bskim/doe")
 */
export function decodePath(encodedName: string): string {
  if (!encodedName) {
    return '';
  }

  // Remove leading dash if present
  const withoutLeadingDash = encodedName.startsWith('-')
    ? encodedName.slice(1)
    : encodedName;

  // Replace remaining dashes with slashes
  const decodedPath = withoutLeadingDash.replace(/-/g, '/');

  // Add leading slash if not present
  return decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
}

/**
 * Encodes a path to the Claude Code directory name format.
 * @param path - The original path (e.g., "/Users/bskim/doe")
 * @returns The encoded directory name (e.g., "-Users-bskim-doe")
 */
export function encodePath(path: string): string {
  if (!path) {
    return '';
  }

  // Remove leading slash if present
  const withoutLeadingSlash = path.startsWith('/')
    ? path.slice(1)
    : path;

  // Replace slashes with dashes
  const encoded = withoutLeadingSlash.replace(/\//g, '-');

  // Add leading dash
  return `-${encoded}`;
}

/**
 * Validates if a directory name follows the Claude Code encoding pattern.
 * @param encodedName - The directory name to validate
 * @returns true if valid, false otherwise
 */
export function isValidEncodedPath(encodedName: string): boolean {
  if (!encodedName) {
    return false;
  }

  // Must start with a dash
  if (!encodedName.startsWith('-')) {
    return false;
  }

  // Should contain only alphanumeric, dashes, underscores, and dots
  // (typical path characters when encoded)
  const validPattern = /^-[a-zA-Z0-9_\-\.]+$/;
  return validPattern.test(encodedName);
}
