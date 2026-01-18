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
import * as readline from 'readline';
import { Project, Session, ChatHistoryEntry, isHardNoiseMessage, PaginatedSessionsResult, SessionCursor, SearchResult, SearchSessionsResult, isParsedHardNoiseMessage, ParsedMessage } from '../types/claude';
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
import { extractFirstUserMessage, extractCwd, extractGitBranch, countTriggerMessages, checkSessionOngoing } from '../utils/jsonl';

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
   * Checks if a session file contains any non-noise messages.
   * Returns true if the session has at least one meaningful message.
   *
   * Noise messages include:
   * - file-history-snapshot entries
   * - summary entries
   * - system entries with local_command subtype
   * - user messages with system metadata tags (local-command-stdout, etc.)
   * - command messages (e.g., /model, /clear) with <command-name> tags
   *
   * Sessions containing ONLY noise messages are filtered out from the UI.
   */
  private async hasNonNoiseMessages(filePath: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as ChatHistoryEntry;

          // Skip entries without uuid (queue-operation, etc.)
          if (!entry.uuid) {
            continue;
          }

          // If we find any non-hard-noise message, return true immediately
          // Hard noise includes system entries, summaries, file-history-snapshots, etc.
          // Soft noise (commands) should now be visible, so we only filter hard noise
          if (!isHardNoiseMessage(entry)) {
            fileStream.destroy();
            return true;
          }
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }
    } catch (error) {
      console.error(`Error checking noise messages in ${filePath}:`, error);
    }

    // All messages were noise
    return false;
  }

  /**
   * Lists all sessions for a given project with metadata.
   * Filters out sessions that contain only noise messages.
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

          // Check if session has non-noise messages
          const hasContent = await this.hasNonNoiseMessages(filePath);
          if (!hasContent) {
            return null; // Filter out noise-only sessions
          }

          return this.buildSessionMetadata(projectId, sessionId, filePath, decodedPath);
        })
      );

      // Filter out null results (noise-only sessions)
      const validSessions = sessions.filter((s): s is Session => s !== null);

      // Sort by created date (most recent first)
      validSessions.sort((a, b) => b.createdAt - a.createdAt);

      return validSessions;
    } catch (error) {
      console.error(`Error listing sessions for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Lists sessions for a project with cursor-based pagination.
   * Efficiently fetches only the sessions needed for the current page.
   *
   * @param projectId - The project ID to list sessions for
   * @param cursor - Base64-encoded cursor from previous page (null for first page)
   * @param limit - Number of sessions to return (default 20)
   * @returns Paginated result with sessions, cursor, and metadata
   */
  async listSessionsPaginated(
    projectId: string,
    cursor: string | null,
    limit: number = 20
  ): Promise<PaginatedSessionsResult> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return { sessions: [], nextCursor: null, hasMore: false, totalCount: 0 };
      }

      // Step 1: Get all session files with their timestamps (lightweight stat calls)
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const sessionFiles = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
      );

      // Get stats for all session files
      type SessionFileInfo = { name: string; sessionId: string; timestamp: number; filePath: string };
      const fileInfos: SessionFileInfo[] = [];

      for (const file of sessionFiles) {
        const filePath = path.join(projectPath, file.name);
        try {
          const stats = fs.statSync(filePath);
          fileInfos.push({
            name: file.name,
            sessionId: extractSessionId(file.name),
            timestamp: stats.birthtimeMs,
            filePath,
          });
        } catch {
          // Skip files we can't stat
          continue;
        }
      }

      const totalCount = fileInfos.length;

      // Step 2: Sort by timestamp descending (most recent first)
      fileInfos.sort((a, b) => {
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp;
        }
        // Tie-breaker: sort by sessionId alphabetically
        return a.sessionId.localeCompare(b.sessionId);
      });

      // Step 3: Apply cursor filter to find starting position
      let startIndex = 0;
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as SessionCursor;
          startIndex = fileInfos.findIndex((info) => {
            // Find the first item that comes AFTER the cursor
            if (info.timestamp < decoded.timestamp) return true;
            if (info.timestamp === decoded.timestamp && info.sessionId > decoded.sessionId) return true;
            return false;
          });
          // If cursor not found, start from beginning
          if (startIndex === -1) startIndex = fileInfos.length;
        } catch {
          // Invalid cursor, start from beginning
          startIndex = 0;
        }
      }

      // Step 4: Fetch sessions for this page
      // Fetch extra for noise filtering, then filter down to limit
      const fetchLimit = Math.min(limit + 10, fileInfos.length - startIndex);
      const candidateFiles = fileInfos.slice(startIndex, startIndex + fetchLimit);

      const decodedPath = decodePath(projectId);
      const sessions: Session[] = [];

      for (const fileInfo of candidateFiles) {
        if (sessions.length >= limit) break;

        // Check if session has non-noise messages
        const hasContent = await this.hasNonNoiseMessages(fileInfo.filePath);
        if (!hasContent) continue;

        const session = await this.buildSessionMetadata(
          projectId,
          fileInfo.sessionId,
          fileInfo.filePath,
          decodedPath
        );
        sessions.push(session);
      }

      // Step 5: Build next cursor
      let nextCursor: string | null = null;
      const hasMore = startIndex + fetchLimit < fileInfos.length || sessions.length === limit;

      if (sessions.length > 0 && hasMore) {
        const lastSession = sessions[sessions.length - 1];
        const lastFileInfo = fileInfos.find((f) => f.sessionId === lastSession.id);
        if (lastFileInfo) {
          const cursorData: SessionCursor = {
            timestamp: lastFileInfo.timestamp,
            sessionId: lastFileInfo.sessionId,
          };
          nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
        }
      }

      return {
        sessions,
        nextCursor,
        hasMore: nextCursor !== null,
        totalCount,
      };
    } catch (error) {
      console.error(`Error listing paginated sessions for project ${projectId}:`, error);
      return { sessions: [], nextCursor: null, hasMore: false, totalCount: 0 };
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

    // Count conversation turns (trigger messages only)
    const messageCount = await countTriggerMessages(filePath);

    // Check for subagents
    const hasSubagents = this.hasSubagentsSync(projectId, sessionId);

    // Load todo data if exists
    const todoData = await this.loadTodoData(sessionId);

    // Check if session is ongoing (AI response in progress)
    const isOngoing = await checkSessionOngoing(filePath);

    // Extract git branch if available
    const gitBranch = await extractGitBranch(filePath);

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
      isOngoing,
      gitBranch: gitBranch ?? undefined,
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
   * Checks if a session has subagent files (session-specific only).
   * Only checks the NEW structure: {projectId}/{sessionId}/subagents/
   * Verifies that at least one subagent file has non-empty content.
   */
  hasSubagentsSync(projectId: string, sessionId: string): boolean {
    // Check NEW structure: {projectId}/{sessionId}/subagents/
    const newSubagentsPath = this.getSubagentsPath(projectId, sessionId);
    if (fs.existsSync(newSubagentsPath)) {
      try {
        const entries = fs.readdirSync(newSubagentsPath);
        const subagentFiles = entries.filter(
          (name) => name.startsWith('agent-') && name.endsWith('.jsonl')
        );

        // Check if at least one subagent file has content (not empty)
        for (const fileName of subagentFiles) {
          const filePath = path.join(newSubagentsPath, fileName);
          try {
            const stats = fs.statSync(filePath);
            // File must have size > 0 and contain at least one line
            if (stats.size > 0) {
              const content = fs.readFileSync(filePath, 'utf8');
              if (content.trim().length > 0) {
                return true;
              }
            }
          } catch (error) {
            // Skip this file if we can't read it
            continue;
          }
        }
      } catch (error) {
        // Ignore errors
      }
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
      // Must filter by sessionId since all sessions share the same project root
      const oldFiles = await this.getProjectRootSubagentFiles(projectId, sessionId);
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
   * Scans {projectId}/agent-*.jsonl files and filters by sessionId.
   *
   * In the OLD structure, all subagent files are in the project root,
   * so we must read each file's first line to check if it belongs to the session.
   */
  private async getProjectRootSubagentFiles(projectId: string, sessionId: string): Promise<string[]> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return [];
      }

      const files = fs.readdirSync(projectPath);
      const agentFiles = files
        .filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))
        .map((f) => path.join(projectPath, f));

      // Filter files by checking if their sessionId matches
      const matchingFiles: string[] = [];
      for (const filePath of agentFiles) {
        if (await this.subagentBelongsToSession(filePath, sessionId)) {
          matchingFiles.push(filePath);
        }
      }

      return matchingFiles;
    } catch (error) {
      console.error(`Error reading project root for subagent files:`, error);
      return [];
    }
  }

  /**
   * Checks if a subagent file belongs to a specific session by reading its first line.
   * Subagent files have a sessionId field that points to the parent session.
   */
  private async subagentBelongsToSession(filePath: string, sessionId: string): Promise<boolean> {
    try {
      // Read just the first line to check sessionId
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstNewline = content.indexOf('\n');
      const firstLine = firstNewline > 0 ? content.slice(0, firstNewline) : content;

      if (!firstLine.trim()) {
        return false;
      }

      const entry = JSON.parse(firstLine);
      return entry.sessionId === sessionId;
    } catch (error) {
      // If we can't read or parse the file, don't include it
      return false;
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

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Searches sessions in a project for a query string.
   * Filters out noise messages and returns matching content.
   *
   * @param projectId - The project ID to search in
   * @param query - Search query string
   * @param maxResults - Maximum number of results to return (default 50)
   */
  async searchSessions(
    projectId: string,
    query: string,
    maxResults: number = 50
  ): Promise<SearchSessionsResult> {
    const results: SearchResult[] = [];
    let sessionsSearched = 0;

    if (!query || query.trim().length === 0) {
      return { results: [], totalMatches: 0, sessionsSearched: 0, query };
    }

    const normalizedQuery = query.toLowerCase().trim();

    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return { results: [], totalMatches: 0, sessionsSearched: 0, query };
      }

      // Get all session files
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const sessionFiles = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
      );

      // Search each session file
      for (const file of sessionFiles) {
        if (results.length >= maxResults) break;

        const sessionId = extractSessionId(file.name);
        const filePath = path.join(projectPath, file.name);
        sessionsSearched++;

        try {
          const sessionResults = await this.searchSessionFile(
            projectId,
            sessionId,
            filePath,
            normalizedQuery,
            maxResults - results.length
          );
          results.push(...sessionResults);
        } catch (error) {
          // Skip files we can't read
          continue;
        }
      }

      return {
        results,
        totalMatches: results.length,
        sessionsSearched,
        query,
      };
    } catch (error) {
      console.error(`Error searching sessions for project ${projectId}:`, error);
      return { results: [], totalMatches: 0, sessionsSearched: 0, query };
    }
  }

  /**
   * Searches a single session file for a query string.
   */
  private async searchSessionFile(
    projectId: string,
    sessionId: string,
    filePath: string,
    query: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let sessionTitle: string | undefined;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (results.length >= maxResults) {
          rl.close();
          return;
        }

        try {
          const entry = JSON.parse(line) as ChatHistoryEntry;

          // Convert to ParsedMessage-like for noise filtering
          const parsedMsg: ParsedMessage = {
            uuid: entry.uuid || '',
            parentUuid: null,
            type: entry.type as any,
            content: entry.type === 'user' || entry.type === 'assistant'
              ? entry.message?.content || ''
              : '',
            timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            model: entry.type === 'assistant' ? (entry as any).message?.model : undefined,
            isMeta: entry.type === 'user' ? (entry as any).isMeta : undefined,
            isSidechain: false,
            toolCalls: [],
            toolResults: [],
          };

          // Skip noise messages
          if (isParsedHardNoiseMessage(parsedMsg)) {
            return;
          }

          // Extract searchable text
          let searchableText = '';

          if (entry.type === 'user' && entry.message?.content) {
            if (typeof entry.message.content === 'string') {
              searchableText = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              searchableText = entry.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join(' ');
            }

            // Capture first user message as session title
            if (!sessionTitle && searchableText) {
              sessionTitle = searchableText.slice(0, 100);
            }
          } else if (entry.type === 'assistant' && entry.message?.content) {
            if (Array.isArray(entry.message.content)) {
              searchableText = entry.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join(' ');
            }
          }

          // Search for query
          if (searchableText) {
            const lowerText = searchableText.toLowerCase();
            const matchIndex = lowerText.indexOf(query);

            if (matchIndex !== -1) {
              // Extract context around match
              const contextStart = Math.max(0, matchIndex - 50);
              const contextEnd = Math.min(searchableText.length, matchIndex + query.length + 50);
              const context = searchableText.slice(contextStart, contextEnd);
              const matchedText = searchableText.slice(matchIndex, matchIndex + query.length);

              results.push({
                sessionId,
                projectId,
                sessionTitle: sessionTitle || 'Untitled Session',
                matchedText,
                context: (contextStart > 0 ? '...' : '') + context + (contextEnd < searchableText.length ? '...' : ''),
                messageType: entry.type as 'user' | 'assistant',
                timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
              });
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      });

      rl.on('close', () => {
        resolve(results);
      });

      rl.on('error', () => {
        resolve(results);
      });
    });
  }
}
