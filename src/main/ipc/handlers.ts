/**
 * IPC Handlers - Expose safe API to renderer process.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-sessions: List sessions for a project
 * - get-session-detail: Get full session detail with subagents
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Project, Session, SessionDetail } from '../../renderer/types/data';
import { ProjectScanner } from '../services/ProjectScanner';
import { SessionParser } from '../services/SessionParser';
import { SubagentResolver } from '../services/SubagentResolver';
import { DataCache } from '../services/DataCache';

// Service instances
let projectScanner: ProjectScanner;
let sessionParser: SessionParser;
let subagentResolver: SubagentResolver;
let dataCache: DataCache;

/**
 * Initializes IPC handlers with service instances.
 * @param scanner - ProjectScanner instance
 * @param parser - SessionParser instance
 * @param resolver - SubagentResolver instance
 * @param cache - DataCache instance
 */
export function initializeIpcHandlers(
  scanner: ProjectScanner,
  parser: SessionParser,
  resolver: SubagentResolver,
  cache: DataCache
): void {
  projectScanner = scanner;
  sessionParser = parser;
  subagentResolver = resolver;
  dataCache = cache;

  registerHandlers();
}

/**
 * Registers all IPC handlers.
 */
function registerHandlers(): void {
  // Get all projects
  ipcMain.handle('get-projects', handleGetProjects);

  // Get sessions for a project
  ipcMain.handle('get-sessions', handleGetSessions);

  // Get full session detail
  ipcMain.handle('get-session-detail', handleGetSessionDetail);
}

/**
 * Handler for 'get-projects' IPC call.
 * Lists all projects from ~/.claude/projects/
 * @returns Promise that resolves to array of projects
 */
async function handleGetProjects(_event: IpcMainInvokeEvent): Promise<Project[]> {
  try {
    console.log('IPC: get-projects');
    const projects = await projectScanner.scan();
    console.log(`IPC: Found ${projects.length} projects`);
    return projects;
  } catch (error) {
    console.error('IPC: Error in get-projects:', error);
    return [];
  }
}

/**
 * Handler for 'get-sessions' IPC call.
 * Lists all sessions for a given project.
 * @param _event - IPC event
 * @param projectId - The encoded project directory name
 * @returns Promise that resolves to array of sessions
 */
async function handleGetSessions(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<Session[]> {
  try {
    console.log(`IPC: get-sessions for project ${projectId}`);

    if (!projectId) {
      console.error('IPC: get-sessions called with empty projectId');
      return [];
    }

    const sessions = await sessionParser.listSessions(projectId);
    console.log(`IPC: Found ${sessions.length} sessions`);
    return sessions;
  } catch (error) {
    console.error(`IPC: Error in get-sessions for project ${projectId}:`, error);
    return [];
  }
}

/**
 * Handler for 'get-session-detail' IPC call.
 * Gets full session detail including parsed chunks and subagents.
 * Uses cache to avoid re-parsing large files.
 * @param _event - IPC event
 * @param projectId - The encoded project directory name
 * @param sessionId - The session UUID
 * @returns Promise that resolves to SessionDetail
 */
async function handleGetSessionDetail(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<SessionDetail | null> {
  try {
    console.log(`IPC: get-session-detail for ${projectId}:${sessionId}`);

    if (!projectId || !sessionId) {
      console.error('IPC: get-session-detail called with invalid parameters');
      return null;
    }

    const cacheKey = `${projectId}:${sessionId}`;

    // Check cache first
    let sessionDetail = dataCache.get(cacheKey);

    if (sessionDetail) {
      console.log(`IPC: Serving from cache: ${cacheKey}`);
      return sessionDetail;
    }

    console.log(`IPC: Cache miss, parsing session: ${cacheKey}`);

    // Parse session
    sessionDetail = await sessionParser.parseSessionDetail(projectId, sessionId);

    // Resolve subagents
    sessionDetail = await subagentResolver.resolveSubagents(sessionDetail, projectId);

    // Link Task calls to subagents
    subagentResolver.linkTaskCallsToSubagents(sessionDetail.chunks);

    // Cache the result
    dataCache.set(cacheKey, sessionDetail);

    console.log(
      `IPC: Parsed session with ${sessionDetail.chunks.length} chunks, ` +
      `${sessionDetail.chunks.reduce((sum, c) => sum + c.subagents.length, 0)} subagents`
    );

    return sessionDetail;
  } catch (error) {
    console.error(`IPC: Error in get-session-detail for ${projectId}:${sessionId}:`, error);
    return null;
  }
}

/**
 * Removes all IPC handlers.
 * Should be called when shutting down.
 */
export function removeIpcHandlers(): void {
  ipcMain.removeHandler('get-projects');
  ipcMain.removeHandler('get-sessions');
  ipcMain.removeHandler('get-session-detail');
  console.log('IPC: Handlers removed');
}
