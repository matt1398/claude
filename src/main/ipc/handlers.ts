/**
 * IPC Handlers - Expose safe API to renderer process.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-sessions: List sessions for a project
 * - get-session-detail: Get full session detail with subagents
 * - get-session-metrics: Get metrics for a session
 * - get-waterfall-data: Get waterfall chart data for a session
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  Project,
  Session,
  SessionDetail,
  SessionMetrics,
  WaterfallData,
  SubagentDetail,
} from '../types/claude';
import { ProjectScanner } from '../services/ProjectScanner';
import { SessionParser } from '../services/SessionParser';
import { SubagentResolver } from '../services/SubagentResolver';
import { ChunkBuilder } from '../services/ChunkBuilder';
import { DataCache } from '../services/DataCache';

// Service instances
let projectScanner: ProjectScanner;
let sessionParser: SessionParser;
let subagentResolver: SubagentResolver;
let chunkBuilder: ChunkBuilder;
let dataCache: DataCache;

/**
 * Initializes IPC handlers with service instances.
 */
export function initializeIpcHandlers(
  scanner: ProjectScanner,
  parser: SessionParser,
  resolver: SubagentResolver,
  builder: ChunkBuilder,
  cache: DataCache
): void {
  projectScanner = scanner;
  sessionParser = parser;
  subagentResolver = resolver;
  chunkBuilder = builder;
  dataCache = cache;

  registerHandlers();
}

/**
 * Registers all IPC handlers.
 */
function registerHandlers(): void {
  // Project handlers
  ipcMain.handle('get-projects', handleGetProjects);

  // Session handlers
  ipcMain.handle('get-sessions', handleGetSessions);
  ipcMain.handle('get-session-detail', handleGetSessionDetail);
  ipcMain.handle('get-session-metrics', handleGetSessionMetrics);

  // Visualization handlers
  ipcMain.handle('get-waterfall-data', handleGetWaterfallData);

  // Subagent handlers
  ipcMain.handle('get-subagent-detail', handleGetSubagentDetail);

  console.log('IPC: Handlers registered');
}

// =============================================================================
// Project Handlers
// =============================================================================

/**
 * Handler for 'get-projects' IPC call.
 * Lists all projects from ~/.claude/projects/
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

// =============================================================================
// Session Handlers
// =============================================================================

/**
 * Handler for 'get-sessions' IPC call.
 * Lists all sessions for a given project.
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

    const sessions = await projectScanner.listSessions(projectId);
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
 */
async function handleGetSessionDetail(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<SessionDetail | null> {
  try {
    console.log(`IPC: get-session-detail for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      console.error('IPC: get-session-detail called with invalid parameters');
      return null;
    }

    const cacheKey = DataCache.buildKey(projectId, sessionId);

    // Check cache first
    let sessionDetail = dataCache.get(cacheKey);

    if (sessionDetail) {
      console.log(`IPC: Serving from cache: ${cacheKey}`);
      return sessionDetail;
    }

    console.log(`IPC: Cache miss, parsing session: ${cacheKey}`);

    // Get session metadata
    const session = await projectScanner.getSession(projectId, sessionId);
    if (!session) {
      console.error(`IPC: Session not found: ${sessionId}`);
      return null;
    }

    // Parse session messages
    const parsedSession = await sessionParser.parseSession(projectId, sessionId);

    // Resolve subagents
    const subagents = await subagentResolver.resolveSubagents(
      projectId,
      sessionId,
      parsedSession.taskCalls
    );

    // Build session detail with chunks
    sessionDetail = chunkBuilder.buildSessionDetail(session, parsedSession.messages, subagents);

    // Cache the result
    dataCache.set(cacheKey, sessionDetail);

    console.log(
      `IPC: Parsed session with ${sessionDetail.chunks.length} chunks, ` +
        `${subagents.length} subagents`
    );

    return sessionDetail;
  } catch (error) {
    console.error(`IPC: Error in get-session-detail for ${projectId}/${sessionId}:`, error);
    return null;
  }
}

/**
 * Handler for 'get-session-metrics' IPC call.
 * Gets metrics for a session without full detail.
 */
async function handleGetSessionMetrics(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<SessionMetrics | null> {
  try {
    console.log(`IPC: get-session-metrics for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      return null;
    }

    // Try to get from cache first
    const cacheKey = DataCache.buildKey(projectId, sessionId);
    const cached = dataCache.get(cacheKey);

    if (cached) {
      return cached.metrics;
    }

    // Parse session to get metrics
    const parsedSession = await sessionParser.parseSession(projectId, sessionId);
    return parsedSession.metrics;
  } catch (error) {
    console.error(`IPC: Error in get-session-metrics for ${projectId}/${sessionId}:`, error);
    return null;
  }
}

// =============================================================================
// Visualization Handlers
// =============================================================================

/**
 * Handler for 'get-waterfall-data' IPC call.
 * Gets waterfall chart data for a session.
 */
async function handleGetWaterfallData(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<WaterfallData | null> {
  try {
    console.log(`IPC: get-waterfall-data for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      return null;
    }

    // Get session detail (will use cache if available)
    const sessionDetail = await handleGetSessionDetail(_event, projectId, sessionId);

    if (!sessionDetail) {
      return null;
    }

    // Build waterfall data from chunks
    return chunkBuilder.buildWaterfallData(sessionDetail.chunks);
  } catch (error) {
    console.error(`IPC: Error in get-waterfall-data for ${projectId}/${sessionId}:`, error);
    return null;
  }
}

// =============================================================================
// Subagent Handlers (for drill-down)
// =============================================================================

/**
 * Handler for 'get-subagent-detail' IPC call.
 * Gets detailed information for a specific subagent for drill-down modal.
 */
async function handleGetSubagentDetail(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string,
  subagentId: string
): Promise<SubagentDetail | null> {
  try {
    console.log(`IPC: get-subagent-detail for ${projectId}/${sessionId}/subagent-${subagentId}`);

    if (!projectId || !sessionId || !subagentId) {
      console.error('IPC: get-subagent-detail called with invalid parameters');
      return null;
    }

    const cacheKey = `subagent-${projectId}-${subagentId}`;

    // Check cache first (cast to correct type)
    let subagentDetail = dataCache.get(cacheKey) as SubagentDetail | undefined;

    if (subagentDetail) {
      console.log(`IPC: Serving subagent from cache: ${cacheKey}`);
      return subagentDetail;
    }

    console.log(`IPC: Cache miss, parsing subagent: ${cacheKey}`);

    // Build subagent detail
    const builtDetail = await chunkBuilder.buildSubagentDetail(
      projectId,
      sessionId,
      subagentId,
      sessionParser,
      subagentResolver
    );

    if (!builtDetail) {
      console.error(`IPC: Subagent not found: ${subagentId}`);
      return null;
    }

    subagentDetail = builtDetail;

    // Cache the result (cast to any for storage)
    dataCache.set(cacheKey, subagentDetail as any);

    console.log(
      `IPC: Parsed subagent with ${subagentDetail.chunks.length} chunks`
    );

    return subagentDetail;
  } catch (error) {
    console.error(`IPC: Error in get-subagent-detail for ${subagentId}:`, error);
    return null;
  }
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Removes all IPC handlers.
 * Should be called when shutting down.
 */
export function removeIpcHandlers(): void {
  ipcMain.removeHandler('get-projects');
  ipcMain.removeHandler('get-sessions');
  ipcMain.removeHandler('get-session-detail');
  ipcMain.removeHandler('get-session-metrics');
  ipcMain.removeHandler('get-waterfall-data');
  ipcMain.removeHandler('get-subagent-detail');
  console.log('IPC: Handlers removed');
}
