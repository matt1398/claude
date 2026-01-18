/**
 * CLAUDE.md Injection Tracker
 *
 * Tracks system context injections from various CLAUDE.md sources throughout a session.
 * Detects injections based on:
 * - Global sources (enterprise, user-memory, project-memory, project-rules, project-local)
 * - Directory-specific CLAUDE.md files (detected from Read tool calls and @ mentions)
 */

import type { ClaudeMdSource, ClaudeMdInjection, ClaudeMdStats } from '../types/claudeMd';
import type { ChatItem, AIGroup, UserGroup } from '../types/groups';
import type { SemanticStep, ClaudeMdFileInfo } from '../types/data';

// =============================================================================
// Constants
// =============================================================================

/** Default estimated tokens for global CLAUDE.md sources */
const DEFAULT_ESTIMATED_TOKENS = 500;

/** CLAUDE.md filename to search for */
const CLAUDE_MD_FILENAME = 'CLAUDE.md';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique ID for an injection based on its path.
 * Uses a simple hash-like approach for readability.
 */
export function generateInjectionId(path: string): string {
  // Create a simple hash from the path
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive hex string
  const positiveHash = Math.abs(hash).toString(16);
  return `cmd-${positiveHash}`;
}

/**
 * Create a display name for a CLAUDE.md injection.
 * Returns the raw path for transparency.
 */
export function getDisplayName(path: string, _source: ClaudeMdSource): string {
  return path;
}

/**
 * Check if a path is absolute (starts with /).
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/');
}

/**
 * Join paths, handling both absolute and relative.
 */
function joinPaths(base: string, relative: string): string {
  if (isAbsolutePath(relative)) {
    return relative;
  }
  // Remove trailing slash from base if present
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/${relative}`;
}

/**
 * Get the directory containing a file.
 */
function getDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return filePath.slice(0, lastSlash);
}

/**
 * Get the parent directory of a path.
 */
function getParentDirectory(dirPath: string): string | null {
  const lastSlash = dirPath.lastIndexOf('/');
  if (lastSlash <= 0) return null; // At root or invalid
  return dirPath.slice(0, lastSlash);
}

/**
 * Check if dirPath is at or above stopPath in the directory tree.
 */
function isAtOrAbove(dirPath: string, stopPath: string): boolean {
  // Normalize paths by removing trailing slashes
  const normDir = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
  const normStop = stopPath.endsWith('/') ? stopPath.slice(0, -1) : stopPath;

  // dirPath is at or above stopPath if stopPath starts with dirPath
  return normStop === normDir || normStop.startsWith(normDir + '/');
}

// =============================================================================
// Path Extraction Functions
// =============================================================================

/**
 * Extract file paths from Read tool calls in semantic steps.
 */
export function extractReadToolPaths(steps: SemanticStep[]): string[] {
  const paths: string[] = [];

  for (const step of steps) {
    // Check if this is a Read tool call
    if (step.type === 'tool_call' && step.content.toolName === 'Read') {
      const toolInput = step.content.toolInput as Record<string, unknown> | undefined;
      if (toolInput && typeof toolInput.file_path === 'string') {
        paths.push(toolInput.file_path);
      }
    }
  }

  return paths;
}

/**
 * Extract file paths from user @ mentions.
 * Converts relative paths to absolute using projectRoot.
 */
export function extractUserMentionPaths(
  userGroup: UserGroup | null,
  projectRoot: string
): string[] {
  if (!userGroup) return [];

  const fileReferences = userGroup.content.fileReferences || [];
  const paths: string[] = [];

  for (const ref of fileReferences) {
    if (ref.path) {
      // Convert to absolute if relative
      const absolutePath = isAbsolutePath(ref.path)
        ? ref.path
        : joinPaths(projectRoot, ref.path);
      paths.push(absolutePath);
    }
  }

  return paths;
}

// =============================================================================
// CLAUDE.md Detection Functions
// =============================================================================

/**
 * Detect potential CLAUDE.md files by walking up from a file's directory to project root.
 * Returns paths to CLAUDE.md files that would be injected based on the file path.
 */
export function detectClaudeMdFromFilePath(
  filePath: string,
  projectRoot: string
): string[] {
  const claudeMdPaths: string[] = [];

  // Get the directory containing the file
  let currentDir = getDirectory(filePath);

  // Walk up to project root (inclusive)
  while (currentDir && isAtOrAbove(projectRoot, currentDir)) {
    // Add potential CLAUDE.md path for this directory
    const claudeMdPath = `${currentDir}/${CLAUDE_MD_FILENAME}`;
    claudeMdPaths.push(claudeMdPath);

    // Move to parent directory
    const parentDir = getParentDirectory(currentDir);
    if (!parentDir || parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return claudeMdPaths;
}

// =============================================================================
// Injection Creation Functions
// =============================================================================

/**
 * Create injection entries for global CLAUDE.md sources.
 * These are injected at the start of every session.
 * Only includes files that actually exist (tokens > 0).
 */
export function createGlobalInjections(
  projectRoot: string,
  aiGroupId: string,
  tokenData?: Record<string, ClaudeMdFileInfo>
): ClaudeMdInjection[] {
  const injections: ClaudeMdInjection[] = [];

  // Helper to get token count from tokenData or fallback to default
  const getTokens = (key: string): number => {
    return tokenData?.[key]?.estimatedTokens ?? DEFAULT_ESTIMATED_TOKENS;
  };

  // 1. Enterprise config
  const enterprisePath = '/Library/Application Support/ClaudeCode/CLAUDE.md';
  const enterpriseTokens = getTokens('enterprise');
  if (enterpriseTokens > 0) {
    injections.push({
      id: generateInjectionId(enterprisePath),
      path: enterprisePath,
      source: 'enterprise',
      displayName: getDisplayName(enterprisePath, 'enterprise'),
      isGlobal: true,
      estimatedTokens: enterpriseTokens,
      firstSeenInGroup: aiGroupId,
    });
  }

  // 2. User memory (~/.claude/CLAUDE.md)
  // Use ~ for display purposes (renderer cannot access Node.js process.env)
  const userMemoryPath = '~/.claude/CLAUDE.md';
  const userTokens = getTokens('user');
  if (userTokens > 0) {
    injections.push({
      id: generateInjectionId(userMemoryPath),
      path: userMemoryPath,
      source: 'user-memory',
      displayName: getDisplayName(userMemoryPath, 'user-memory'),
      isGlobal: true,
      estimatedTokens: userTokens,
      firstSeenInGroup: aiGroupId,
    });
  }

  // 3. Project memory - could be at root or in .claude folder
  const projectMemoryPath = `${projectRoot}/CLAUDE.md`;
  const projectMemoryAltPath = `${projectRoot}/.claude/CLAUDE.md`;
  // Add the main project CLAUDE.md
  const projectTokens = getTokens('project');
  if (projectTokens > 0) {
    injections.push({
      id: generateInjectionId(projectMemoryPath),
      path: projectMemoryPath,
      source: 'project-memory',
      displayName: getDisplayName(projectMemoryPath, 'project-memory'),
      isGlobal: true,
      estimatedTokens: projectTokens,
      firstSeenInGroup: aiGroupId,
    });
  }
  // Also add the .claude folder variant
  const projectAltTokens = getTokens('project-alt');
  if (projectAltTokens > 0) {
    injections.push({
      id: generateInjectionId(projectMemoryAltPath),
      path: projectMemoryAltPath,
      source: 'project-memory',
      displayName: getDisplayName(projectMemoryAltPath, 'project-memory'),
      isGlobal: true,
      estimatedTokens: projectAltTokens,
      firstSeenInGroup: aiGroupId,
    });
  }

  // 4. Project rules (*.md files in .claude/rules/)
  const projectRulesPath = `${projectRoot}/.claude/rules/*.md`;
  const projectRulesTokens = getTokens('project-rules');
  if (projectRulesTokens > 0) {
    injections.push({
      id: generateInjectionId(projectRulesPath),
      path: projectRulesPath,
      source: 'project-rules',
      displayName: getDisplayName(projectRulesPath, 'project-rules'),
      isGlobal: true,
      estimatedTokens: projectRulesTokens,
      firstSeenInGroup: aiGroupId,
    });
  }

  // 5. Project local
  const projectLocalPath = `${projectRoot}/CLAUDE.local.md`;
  const projectLocalTokens = getTokens('project-local');
  if (projectLocalTokens > 0) {
    injections.push({
      id: generateInjectionId(projectLocalPath),
      path: projectLocalPath,
      source: 'project-local',
      displayName: getDisplayName(projectLocalPath, 'project-local'),
      isGlobal: true,
      estimatedTokens: projectLocalTokens,
      firstSeenInGroup: aiGroupId,
    });
  }

  return injections;
}

/**
 * Create an injection entry for a directory-specific CLAUDE.md.
 */
function createDirectoryInjection(
  path: string,
  aiGroupId: string
): ClaudeMdInjection {
  return {
    id: generateInjectionId(path),
    path,
    source: 'directory',
    displayName: getDisplayName(path, 'directory'),
    isGlobal: false,
    estimatedTokens: DEFAULT_ESTIMATED_TOKENS,
    firstSeenInGroup: aiGroupId,
  };
}

// =============================================================================
// Stats Computation
// =============================================================================

/**
 * Parameters for computing CLAUDE.md stats for an AI group.
 */
export interface ComputeClaudeMdStatsParams {
  aiGroup: AIGroup;
  userGroup: UserGroup | null;
  isFirstGroup: boolean;
  previousInjections: ClaudeMdInjection[];
  projectRoot: string;
  contextTokens: number;
  tokenData?: Record<string, ClaudeMdFileInfo>;
}

/**
 * Compute CLAUDE.md injection statistics for an AI group.
 */
export function computeClaudeMdStats(params: ComputeClaudeMdStatsParams): ClaudeMdStats {
  const {
    aiGroup,
    userGroup,
    isFirstGroup,
    previousInjections,
    projectRoot,
    contextTokens,
    tokenData,
  } = params;

  const newInjections: ClaudeMdInjection[] = [];
  const previousPaths = new Set(previousInjections.map(inj => inj.path));

  // For the first group, add global injections
  if (isFirstGroup) {
    const globalInjections = createGlobalInjections(projectRoot, aiGroup.id, tokenData);
    for (const injection of globalInjections) {
      if (!previousPaths.has(injection.path)) {
        newInjections.push(injection);
        previousPaths.add(injection.path);
      }
    }
  }

  // Collect all file paths from Read tools and user @ mentions
  const allFilePaths: string[] = [];

  // Extract from Read tool calls in semantic steps
  const readPaths = extractReadToolPaths(aiGroup.steps);
  allFilePaths.push(...readPaths);

  // Extract from user @ mentions
  const mentionPaths = extractUserMentionPaths(userGroup, projectRoot);
  allFilePaths.push(...mentionPaths);

  // For each file path, detect potential CLAUDE.md files
  for (const filePath of allFilePaths) {
    const claudeMdPaths = detectClaudeMdFromFilePath(filePath, projectRoot);

    for (const claudeMdPath of claudeMdPaths) {
      // Skip if already seen
      if (previousPaths.has(claudeMdPath)) {
        continue;
      }

      // Skip if this is a global path (already handled)
      const isGlobalPath =
        claudeMdPath === `${projectRoot}/CLAUDE.md` ||
        claudeMdPath === `${projectRoot}/.claude/CLAUDE.md` ||
        claudeMdPath === `${projectRoot}/CLAUDE.local.md`;

      if (isGlobalPath) {
        continue;
      }

      // Create directory injection
      const injection = createDirectoryInjection(claudeMdPath, aiGroup.id);
      newInjections.push(injection);
      previousPaths.add(claudeMdPath);
    }
  }

  // Build accumulated injections
  const accumulatedInjections = [...previousInjections, ...newInjections];

  // Calculate totals
  const totalEstimatedTokens = accumulatedInjections.reduce(
    (sum, inj) => sum + inj.estimatedTokens,
    0
  );

  // Calculate percentage of context
  const percentageOfContext = contextTokens > 0
    ? (totalEstimatedTokens / contextTokens) * 100
    : 0;

  return {
    newInjections,
    accumulatedInjections,
    totalEstimatedTokens,
    percentageOfContext,
    newCount: newInjections.length,
    accumulatedCount: accumulatedInjections.length,
  };
}

// =============================================================================
// Session Processing
// =============================================================================

/**
 * Process all chat items in a session and compute CLAUDE.md stats for each AI group.
 * Returns a map of aiGroupId -> ClaudeMdStats.
 */
export function processSessionClaudeMd(
  items: ChatItem[],
  projectRoot: string,
  tokenData?: Record<string, ClaudeMdFileInfo>
): Map<string, ClaudeMdStats> {
  const statsMap = new Map<string, ClaudeMdStats>();
  let accumulatedInjections: ClaudeMdInjection[] = [];
  let isFirstAiGroup = true;
  let previousUserGroup: UserGroup | null = null;

  for (const item of items) {
    // Track user groups for pairing with subsequent AI groups
    if (item.type === 'user') {
      previousUserGroup = item.group;
      continue;
    }

    // Process AI groups
    if (item.type === 'ai') {
      const aiGroup = item.group;

      // Get context tokens from the AI group's metrics
      // Use input tokens as a proxy for context window usage
      const contextTokens = aiGroup.tokens.input || 0;

      // Compute stats for this group
      const stats = computeClaudeMdStats({
        aiGroup,
        userGroup: previousUserGroup,
        isFirstGroup: isFirstAiGroup,
        previousInjections: accumulatedInjections,
        projectRoot,
        contextTokens,
        tokenData,
      });

      // Store stats
      statsMap.set(aiGroup.id, stats);

      // Update accumulated state for next iteration
      accumulatedInjections = stats.accumulatedInjections;
      isFirstAiGroup = false;

      // Clear the user group pairing after processing
      previousUserGroup = null;
    }
  }

  return statsMap;
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Create empty stats for cases where no tracking is needed.
 */
export function createEmptyStats(): ClaudeMdStats {
  return {
    newInjections: [],
    accumulatedInjections: [],
    totalEstimatedTokens: 0,
    percentageOfContext: 0,
    newCount: 0,
    accumulatedCount: 0,
  };
}
