/**
 * Utility functions for encoding/decoding Claude Code project directory names.
 *
 * Directory naming pattern:
 * - Path: /Users/bskim/my-project
 * - Encoded: -Users-bskim-my-project
 *
 * IMPORTANT: This encoding is LOSSY for paths containing dashes.
 * For accurate path resolution, use extractCwd() from jsonl.ts to read
 * the actual cwd from session files.
 */

import { PathInfo } from '../types/claude';

// =============================================================================
// Core Encoding/Decoding
// =============================================================================

/**
 * Decodes a project directory name to its original path.
 * Note: This is a best-effort decode. Paths with dashes cannot be decoded accurately.
 *
 * @param encodedName - The encoded directory name (e.g., "-Users-bskim-doe")
 * @returns The decoded path (e.g., "/Users/bskim/doe")
 */
export function decodePath(encodedName: string): string {
  if (!encodedName) {
    return '';
  }

  // Remove leading dash if present (indicates absolute path)
  const withoutLeadingDash = encodedName.startsWith('-') ? encodedName.slice(1) : encodedName;

  // Replace dashes with slashes
  const decodedPath = withoutLeadingDash.replace(/-/g, '/');

  // Ensure leading slash for absolute paths
  return decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
}

/**
 * Encodes a path to the Claude Code directory name format.
 *
 * @param path - The original path (e.g., "/Users/bskim/doe")
 * @returns The encoded directory name (e.g., "-Users-bskim-doe")
 */
export function encodePath(path: string): string {
  if (!path) {
    return '';
  }

  // Normalize path separators for cross-platform
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove leading slash if present
  const withoutLeadingSlash = normalizedPath.startsWith('/')
    ? normalizedPath.slice(1)
    : normalizedPath;

  // Replace slashes with dashes
  const encoded = withoutLeadingSlash.replace(/\//g, '-');

  // Add leading dash for absolute paths
  return `-${encoded}`;
}

/**
 * Extract the project name (last path segment) from an encoded directory name.
 *
 * @param encodedName - The encoded directory name
 * @returns The project name
 */
export function extractProjectName(encodedName: string): string {
  const decoded = decodePath(encodedName);
  const segments = decoded.split('/').filter(Boolean);
  return segments[segments.length - 1] || encodedName;
}

/**
 * Get complete path info from an encoded directory name.
 *
 * @param encodedName - The encoded directory name
 * @returns PathInfo with encoded, decoded, and name
 */
export function getPathInfo(encodedName: string): PathInfo {
  return {
    encoded: encodedName,
    decoded: decodePath(encodedName),
    name: extractProjectName(encodedName),
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates if a directory name follows the Claude Code encoding pattern.
 *
 * @param encodedName - The directory name to validate
 * @returns true if valid, false otherwise
 */
export function isValidEncodedPath(encodedName: string): boolean {
  if (!encodedName) {
    return false;
  }

  // Must start with a dash (indicates absolute path)
  if (!encodedName.startsWith('-')) {
    return false;
  }

  // Should contain only alphanumeric, dashes, underscores, dots, and spaces
  // (typical path characters when encoded)
  const validPattern = /^-[a-zA-Z0-9_\-\.\s]+$/;
  return validPattern.test(encodedName);
}

/**
 * Check if an encoded path likely contains ambiguous dashes.
 * Consecutive dashes or dashes adjacent to common path segments suggest ambiguity.
 *
 * @param encodedName - The encoded directory name
 * @returns true if ambiguous, false otherwise
 */
export function isAmbiguousEncoding(encodedName: string): boolean {
  // Consecutive dashes suggest original path had dashes
  if (encodedName.includes('--')) {
    return true;
  }

  // Common patterns that suggest dashes in original
  const dashPatterns = [
    /-my-/, // my-project -> -my-project
    /-node-modules-/, // node-modules folder
    /-next-/, // next-auth, next-js etc
    /-react-/, // react-native, react-dom etc
  ];

  return dashPatterns.some((pattern) => pattern.test(encodedName));
}

// =============================================================================
// Session ID Extraction
// =============================================================================

/**
 * Extract session ID from a JSONL filename.
 *
 * @param filename - The filename (e.g., "abc123.jsonl")
 * @returns The session ID (e.g., "abc123")
 */
export function extractSessionId(filename: string): string {
  return filename.replace(/\.jsonl$/, '');
}

/**
 * Extract project ID and session ID from a full path.
 *
 * @param filePath - Full path to a session file
 * @param basePath - The ~/.claude/projects/ base path
 * @returns Object with projectId and sessionId, or null if invalid
 */
export function extractIdsFromPath(
  filePath: string,
  basePath: string
): { projectId: string; sessionId: string } | null {
  // Normalize paths
  const normalizedFile = filePath.replace(/\\/g, '/');
  const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/$/, '');

  // Check if path is under base
  if (!normalizedFile.startsWith(normalizedBase)) {
    return null;
  }

  // Get relative path
  const relativePath = normalizedFile.slice(normalizedBase.length + 1);
  const segments = relativePath.split('/');

  if (segments.length < 2) {
    return null;
  }

  const projectId = segments[0];

  // Check if it's a direct session file or nested in subagents
  if (segments.length === 2 && segments[1].endsWith('.jsonl')) {
    return {
      projectId,
      sessionId: extractSessionId(segments[1]),
    };
  }

  // Handle subagent paths: projectId/sessionId/subagents/agent-xxx.jsonl
  if (segments.length >= 4 && segments[2] === 'subagents') {
    return {
      projectId,
      sessionId: segments[1],
    };
  }

  return null;
}

// =============================================================================
// Path Construction
// =============================================================================

/**
 * Construct the path to a project directory.
 */
export function buildProjectPath(basePath: string, projectId: string): string {
  return `${basePath}/${projectId}`;
}

/**
 * Construct the path to a session JSONL file.
 */
export function buildSessionPath(basePath: string, projectId: string, sessionId: string): string {
  return `${basePath}/${projectId}/${sessionId}.jsonl`;
}

/**
 * Construct the path to a session's subagents directory.
 */
export function buildSubagentsPath(basePath: string, projectId: string, sessionId: string): string {
  return `${basePath}/${projectId}/${sessionId}/subagents`;
}

/**
 * Construct the path to a todo file.
 */
export function buildTodoPath(claudeBasePath: string, sessionId: string): string {
  return `${claudeBasePath}/todos/${sessionId}.json`;
}

// =============================================================================
// Home Directory
// =============================================================================

/**
 * Get the user's home directory.
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '/';
}

/**
 * Get the Claude config base path (~/.claude).
 */
export function getClaudeBasePath(): string {
  return `${getHomeDir()}/.claude`;
}

/**
 * Get the projects directory path (~/.claude/projects).
 */
export function getProjectsBasePath(): string {
  return `${getClaudeBasePath()}/projects`;
}

/**
 * Get the todos directory path (~/.claude/todos).
 */
export function getTodosBasePath(): string {
  return `${getClaudeBasePath()}/todos`;
}
