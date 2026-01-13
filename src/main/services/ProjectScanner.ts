/**
 * ProjectScanner service - Scans ~/.claude/projects/ directory and lists all projects.
 *
 * Responsibilities:
 * - Read project directories from ~/.claude/projects/
 * - Decode directory names to original paths (with cwd fallback)
 * - List session files for each project
 * - Read todo data from ~/.claude/todos/
 * - Return sorted list of projects by recent activity
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project, Session } from '../types/claude';
import {
  decodePath,
  isValidEncodedPath,
  extractProjectName,
  getProjectsBasePath,
  getTodosBasePath,
  buildSessionPath,
  buildSubagentsPath,
  buildTodoPath,
  extractSessionId,
  isAmbiguousEncoding,
} from '../utils/pathDecoder';
import { extractFirstUserMessage, extractCwd, countMessages } from '../utils/jsonl';

export class ProjectScanner {
  private readonly projectsDir: string;
  private readonly todosDir: string;

  constructor(projectsDir?: string, todosDir?: string) {
    this.projectsDir = projectsDir || getProjectsBasePath();
    this.todosDir = todosDir || getTodosBasePath();
  }

  // ===========================================================================
  // Project Scanning
  // ===========================================================================

  /**
   * Scans the projects directory and returns a list of all projects.
   * @returns Promise resolving to projects sorted by most recent activity
   */
  async scan(): Promise<Project[]> {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        console.warn(`Projects directory does not exist: ${this.projectsDir}`);
        return [];
      }

      const entries = fs.readdirSync(this.projectsDir, { withFileTypes: true });

      // Filter to only directories with valid encoding pattern
      const projectDirs = entries.filter(
        (entry) => entry.isDirectory() && isValidEncodedPath(entry.name)
      );

      // Process each project directory
      const projects = await Promise.all(projectDirs.map((dir) => this.scanProject(dir.name)));

      // Filter out null results and sort by most recent
      const validProjects = projects.filter((p): p is Project => p !== null);
      validProjects.sort((a, b) => (b.mostRecentSession || 0) - (a.mostRecentSession || 0));

      return validProjects;
    } catch (error) {
      console.error('Error scanning projects directory:', error);
      return [];
    }
  }

  /**
   * Scans a single project directory and returns project metadata.
   */
  private async scanProject(encodedName: string): Promise<Project | null> {
    try {
      const projectPath = path.join(this.projectsDir, encodedName);
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });

      // Get session files (.jsonl at root level)
      const sessionFiles = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
      );

      const sessionIds = sessionFiles.map((f) => extractSessionId(f.name));

      // Find most recent session timestamp
      let mostRecentSession: number | undefined;
      let createdAt = Date.now();

      for (const file of sessionFiles) {
        const filePath = path.join(projectPath, file.name);
        const stats = fs.statSync(filePath);

        if (!mostRecentSession || stats.mtimeMs > mostRecentSession) {
          mostRecentSession = stats.mtimeMs;
        }
        if (stats.birthtimeMs < createdAt) {
          createdAt = stats.birthtimeMs;
        }
      }

      // Get actual project path - try cwd from first session if encoding is ambiguous
      let actualPath = decodePath(encodedName);

      if (isAmbiguousEncoding(encodedName) && sessionFiles.length > 0) {
        const firstSessionPath = path.join(projectPath, sessionFiles[0].name);
        const cwd = await extractCwd(firstSessionPath);
        if (cwd) {
          actualPath = cwd;
        }
      }

      return {
        id: encodedName,
        path: actualPath,
        name: extractProjectName(encodedName),
        sessions: sessionIds,
        createdAt: Math.floor(createdAt),
        mostRecentSession: mostRecentSession ? Math.floor(mostRecentSession) : undefined,
      };
    } catch (error) {
      console.error(`Error scanning project ${encodedName}:`, error);
      return null;
    }
  }

  /**
   * Gets details for a specific project by ID.
   */
  async getProject(projectId: string): Promise<Project | null> {
    const projectPath = path.join(this.projectsDir, projectId);

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    return this.scanProject(projectId);
  }

  // ===========================================================================
  // Session Listing
  // ===========================================================================

  /**
   * Lists all sessions for a given project with metadata.
   */
  async listSessions(projectId: string): Promise<Session[]> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return [];
      }

      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const sessionFiles = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
      );

      // Get project path for session records
      const decodedPath = decodePath(projectId);

      const sessions = await Promise.all(
        sessionFiles.map(async (file) => {
          const sessionId = extractSessionId(file.name);
          const filePath = path.join(projectPath, file.name);

          return this.buildSessionMetadata(projectId, sessionId, filePath, decodedPath);
        })
      );

      // Sort by created date (most recent first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);

      return sessions;
    } catch (error) {
      console.error(`Error listing sessions for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Build session metadata from a session file.
   */
  private async buildSessionMetadata(
    projectId: string,
    sessionId: string,
    filePath: string,
    projectPath: string
  ): Promise<Session> {
    const stats = fs.statSync(filePath);

    // Extract first message for preview
    const firstMsgData = await extractFirstUserMessage(filePath);

    // Count messages
    const messageCount = await countMessages(filePath);

    // Check for subagents
    const hasSubagents = this.hasSubagentsSync(projectId, sessionId);

    // Load todo data if exists
    const todoData = await this.loadTodoData(sessionId);

    return {
      id: sessionId,
      projectId,
      projectPath,
      todoData,
      createdAt: Math.floor(stats.birthtimeMs),
      firstMessage: firstMsgData?.text,
      messageTimestamp: firstMsgData?.timestamp,
      hasSubagents,
      messageCount,
    };
  }

  /**
   * Gets a single session's metadata.
   */
  async getSession(projectId: string, sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionPath(projectId, sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const decodedPath = decodePath(projectId);
    return this.buildSessionMetadata(projectId, sessionId, filePath, decodedPath);
  }

  // ===========================================================================
  // Todo Data
  // ===========================================================================

  /**
   * Loads todo data for a session from ~/.claude/todos/{sessionId}.json
   */
  async loadTodoData(sessionId: string): Promise<unknown | undefined> {
    try {
      const todoPath = buildTodoPath(path.dirname(this.projectsDir), sessionId);

      if (!fs.existsSync(todoPath)) {
        return undefined;
      }

      const content = fs.readFileSync(todoPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Silently ignore todo loading errors
      return undefined;
    }
  }

  // ===========================================================================
  // Path Helpers
  // ===========================================================================

  /**
   * Gets the path to the session JSONL file.
   */
  getSessionPath(projectId: string, sessionId: string): string {
    return buildSessionPath(this.projectsDir, projectId, sessionId);
  }

  /**
   * Gets the path to the subagents directory.
   */
  getSubagentsPath(projectId: string, sessionId: string): string {
    return buildSubagentsPath(this.projectsDir, projectId, sessionId);
  }

  /**
   * Lists all session file paths for a project.
   */
  async listSessionFiles(projectId: string): Promise<string[]> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return [];
      }

      const entries = fs.readdirSync(projectPath, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map((entry) => path.join(projectPath, entry.name));
    } catch (error) {
      console.error(`Error listing session files for project ${projectId}:`, error);
      return [];
    }
  }

  // ===========================================================================
  // Subagent Detection
  // Supports two directory structures:
  // - NEW: {projectId}/{sessionId}/subagents/agent-{agentId}.jsonl
  // - OLD: {projectId}/agent-{agentId}.jsonl (legacy, still supported)
  // ===========================================================================

  /**
   * Checks if a session has a subagents directory (async).
   */
  async hasSubagents(projectId: string, sessionId: string): Promise<boolean> {
    return this.hasSubagentsSync(projectId, sessionId);
  }

  /**
   * Checks if a session has subagent files in either NEW or OLD structure (sync).
   */
  hasSubagentsSync(projectId: string, sessionId: string): boolean {
    // Check NEW structure: {projectId}/{sessionId}/subagents/
    const newSubagentsPath = this.getSubagentsPath(projectId, sessionId);
    if (fs.existsSync(newSubagentsPath)) {
      try {
        const entries = fs.readdirSync(newSubagentsPath);
        const hasNewFiles = entries.some(
          (name) => name.startsWith('agent-') && name.endsWith('.jsonl')
        );
        if (hasNewFiles) {
          return true;
        }
      } catch (error) {
        // Continue to check OLD structure
      }
    }

    // Check OLD structure: {projectId}/agent-*.jsonl
    try {
      const projectPath = path.join(this.projectsDir, projectId);
      if (fs.existsSync(projectPath)) {
        const entries = fs.readdirSync(projectPath);
        return entries.some((name) => name.startsWith('agent-') && name.endsWith('.jsonl'));
      }
    } catch (error) {
      // Ignore errors
    }

    return false;
  }

  /**
   * Lists all subagent files for a session from both NEW and OLD structures.
   * Returns NEW structure files first, then OLD structure files.
   */
  async listSubagentFiles(projectId: string, sessionId: string): Promise<string[]> {
    const allFiles: string[] = [];

    try {
      // Scan NEW structure: {projectId}/{sessionId}/subagents/agent-*.jsonl
      const newSubagentsPath = this.getSubagentsPath(projectId, sessionId);
      if (fs.existsSync(newSubagentsPath)) {
        const entries = fs.readdirSync(newSubagentsPath, { withFileTypes: true });
        const newFiles = entries
          .filter(
            (entry) =>
              entry.isFile() && entry.name.startsWith('agent-') && entry.name.endsWith('.jsonl')
          )
          .map((entry) => path.join(newSubagentsPath, entry.name));
        allFiles.push(...newFiles);
      }
    } catch (error) {
      console.error(
        `Error scanning NEW subagent structure for session ${sessionId}:`,
        error
      );
    }

    try {
      // Scan OLD structure: {projectId}/agent-*.jsonl
      const oldFiles = await this.getProjectRootSubagentFiles(projectId);
      allFiles.push(...oldFiles);
    } catch (error) {
      console.error(
        `Error scanning OLD subagent structure for project ${projectId}:`,
        error
      );
    }

    return allFiles;
  }

  /**
   * Gets subagent files from project root (OLD structure).
   * Scans {projectId}/agent-*.jsonl files.
   */
  private async getProjectRootSubagentFiles(projectId: string): Promise<string[]> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return [];
      }

      const files = fs.readdirSync(projectPath);
      return files
        .filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))
        .map((f) => path.join(projectPath, f));
    } catch (error) {
      console.error(`Error reading project root for subagent files:`, error);
      return [];
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Gets the base projects directory path.
   */
  getProjectsDir(): string {
    return this.projectsDir;
  }

  /**
   * Gets the base todos directory path.
   */
  getTodosDir(): string {
    return this.todosDir;
  }

  /**
   * Checks if the projects directory exists.
   */
  projectsDirExists(): boolean {
    return fs.existsSync(this.projectsDir);
  }
}
