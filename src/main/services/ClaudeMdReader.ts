/**
 * ClaudeMdReader service - Reads CLAUDE.md files and calculates token counts.
 *
 * Responsibilities:
 * - Read CLAUDE.md files from various locations
 * - Calculate character counts and estimate token counts
 * - Handle file not found gracefully
 * - Support tilde (~) expansion to home directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ===========================================================================
// Types
// ===========================================================================

export interface ClaudeMdFileInfo {
  path: string;
  exists: boolean;
  charCount: number;
  estimatedTokens: number; // charCount / 4
}

export interface ClaudeMdReadResult {
  files: Map<string, ClaudeMdFileInfo>;
}

// ===========================================================================
// Helper Functions
// ===========================================================================

/**
 * Expands tilde (~) in a path to the actual home directory.
 * @param filePath - Path that may contain ~
 * @returns Expanded path with ~ replaced by home directory
 */
function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    const homeDir = app.getPath('home');
    return path.join(homeDir, filePath.slice(1));
  }
  return filePath;
}

// ===========================================================================
// Main Functions
// ===========================================================================

/**
 * Reads a single CLAUDE.md file and returns its info.
 * @param filePath - Path to the CLAUDE.md file (supports ~ expansion)
 * @returns ClaudeMdFileInfo with file details
 */
export function readClaudeMdFile(filePath: string): ClaudeMdFileInfo {
  const expandedPath = expandTilde(filePath);

  try {
    if (!fs.existsSync(expandedPath)) {
      return {
        path: expandedPath,
        exists: false,
        charCount: 0,
        estimatedTokens: 0,
      };
    }

    const content = fs.readFileSync(expandedPath, 'utf8');
    const charCount = content.length;
    const estimatedTokens = Math.floor(charCount / 4);

    return {
      path: expandedPath,
      exists: true,
      charCount,
      estimatedTokens,
    };
  } catch (error) {
    // Handle permission denied, file not readable, etc.
    console.error(`Error reading CLAUDE.md file at ${expandedPath}:`, error);
    return {
      path: expandedPath,
      exists: false,
      charCount: 0,
      estimatedTokens: 0,
    };
  }
}

/**
 * Reads all .md files in a directory and returns combined info.
 * Used for project rules directory.
 * @param dirPath - Path to the directory (supports ~ expansion)
 * @returns ClaudeMdFileInfo with combined stats from all .md files
 */
function readDirectoryMdFiles(dirPath: string): ClaudeMdFileInfo {
  const expandedPath = expandTilde(dirPath);

  try {
    if (!fs.existsSync(expandedPath)) {
      return {
        path: expandedPath,
        exists: false,
        charCount: 0,
        estimatedTokens: 0,
      };
    }

    const stats = fs.statSync(expandedPath);
    if (!stats.isDirectory()) {
      return {
        path: expandedPath,
        exists: false,
        charCount: 0,
        estimatedTokens: 0,
      };
    }

    const entries = fs.readdirSync(expandedPath);
    const mdFiles = entries.filter((entry) => entry.endsWith('.md'));

    if (mdFiles.length === 0) {
      return {
        path: expandedPath,
        exists: false,
        charCount: 0,
        estimatedTokens: 0,
      };
    }

    let totalCharCount = 0;

    for (const mdFile of mdFiles) {
      const filePath = path.join(expandedPath, mdFile);
      try {
        const fileStats = fs.statSync(filePath);
        if (fileStats.isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          totalCharCount += content.length;
        }
      } catch {
        // Skip files we can't read
        continue;
      }
    }

    return {
      path: expandedPath,
      exists: true,
      charCount: totalCharCount,
      estimatedTokens: Math.floor(totalCharCount / 4),
    };
  } catch (error) {
    console.error(`Error reading directory ${expandedPath}:`, error);
    return {
      path: expandedPath,
      exists: false,
      charCount: 0,
      estimatedTokens: 0,
    };
  }
}

/**
 * Reads all potential CLAUDE.md locations for a project.
 * @param projectRoot - The root directory of the project
 * @returns ClaudeMdReadResult with Map of path -> ClaudeMdFileInfo
 */
export function readAllClaudeMdFiles(projectRoot: string): ClaudeMdReadResult {
  const files = new Map<string, ClaudeMdFileInfo>();
  const expandedProjectRoot = expandTilde(projectRoot);

  // 1. Enterprise CLAUDE.md: /Library/Application Support/ClaudeCode/CLAUDE.md
  const enterprisePath = '/Library/Application Support/ClaudeCode/CLAUDE.md';
  files.set('enterprise', readClaudeMdFile(enterprisePath));

  // 2. User memory: ~/.claude/CLAUDE.md
  const userMemoryPath = '~/.claude/CLAUDE.md';
  files.set('user', readClaudeMdFile(userMemoryPath));

  // 3. Project memory: ${projectRoot}/CLAUDE.md
  const projectMemoryPath = path.join(expandedProjectRoot, 'CLAUDE.md');
  files.set('project', readClaudeMdFile(projectMemoryPath));

  // 4. Project memory alt: ${projectRoot}/.claude/CLAUDE.md
  const projectMemoryAltPath = path.join(expandedProjectRoot, '.claude', 'CLAUDE.md');
  files.set('project-alt', readClaudeMdFile(projectMemoryAltPath));

  // 5. Project rules: ${projectRoot}/.claude/rules/*.md
  const projectRulesPath = path.join(expandedProjectRoot, '.claude', 'rules');
  files.set('project-rules', readDirectoryMdFiles(projectRulesPath));

  // 6. Project local: ${projectRoot}/CLAUDE.local.md
  const projectLocalPath = path.join(expandedProjectRoot, 'CLAUDE.local.md');
  files.set('project-local', readClaudeMdFile(projectLocalPath));

  return { files };
}

/**
 * Reads a specific directory's CLAUDE.md file.
 * Used for directory-specific CLAUDE.md detected from file reads.
 * @param dirPath - Path to the directory (supports ~ expansion)
 * @returns ClaudeMdFileInfo for the CLAUDE.md file in that directory
 */
export function readDirectoryClaudeMd(dirPath: string): ClaudeMdFileInfo {
  const expandedDirPath = expandTilde(dirPath);
  const claudeMdPath = path.join(expandedDirPath, 'CLAUDE.md');
  return readClaudeMdFile(claudeMdPath);
}
