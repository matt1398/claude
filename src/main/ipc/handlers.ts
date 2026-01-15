/**
 * IPC Handlers - Expose safe API to renderer process.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-sessions: List sessions for a project
 * - get-session-detail: Get full session detail with subagents
 * - get-session-groups: Get conversation groups for a session (alternative to chunks)
 * - get-session-metrics: Get metrics for a session
 * - get-waterfall-data: Get waterfall chart data for a session
 * - get-subagent-detail: Get detailed information for a specific subagent
 * - start-watching-session: Start watching a session file for changes
 * - stop-watching-session: Stop watching the current session file
 * - refresh-current-session: Clear cache and re-fetch session detail
 * - validate-skill: Validate if a skill exists (global or project-specific)
 * - validate-path: Validate if a file/directory path exists relative to project
 * - validate-mentions: Batch validate multiple items (more efficient)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import {
  Project,
  Session,
  SessionDetail,
  SessionMetrics,
  SubagentDetail,
  ConversationGroup,
} from '../types/claude';
import { ProjectScanner } from '../services/ProjectScanner';
import { SessionParser } from '../services/SessionParser';
import { SubagentResolver } from '../services/SubagentResolver';
import { ChunkBuilder } from '../services/ChunkBuilder';
import { DataCache } from '../services/DataCache';
import { FileWatcher } from '../services/FileWatcher';

// Service instances
let projectScanner: ProjectScanner;
let sessionParser: SessionParser;
let subagentResolver: SubagentResolver;
let chunkBuilder: ChunkBuilder;
let dataCache: DataCache;
let fileWatcher: FileWatcher;
let mainWindow: BrowserWindow | null = null;

/**
 * Initializes IPC handlers with service instances.
 */
export function initializeIpcHandlers(
  scanner: ProjectScanner,
  parser: SessionParser,
  resolver: SubagentResolver,
  builder: ChunkBuilder,
  cache: DataCache,
  watcher: FileWatcher,
  window: BrowserWindow
): void {
  projectScanner = scanner;
  sessionParser = parser;
  subagentResolver = resolver;
  chunkBuilder = builder;
  dataCache = cache;
  fileWatcher = watcher;
  mainWindow = window;

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
  ipcMain.handle('get-session-groups', handleGetSessionGroups);
  ipcMain.handle('get-session-metrics', handleGetSessionMetrics);

  // Subagent handlers
  ipcMain.handle('get-subagent-detail', handleGetSubagentDetail);

  // Session watching handlers
  ipcMain.handle('start-watching-session', handleStartWatchingSession);
  ipcMain.handle('stop-watching-session', handleStopWatchingSession);
  ipcMain.handle('refresh-current-session', handleRefreshCurrentSession);

  // Validation handlers
  ipcMain.handle('validate-skill', handleValidateSkill);
  ipcMain.handle('validate-path', handleValidatePath);
  ipcMain.handle('validate-mentions', handleValidateMentions);

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
 * Handler for 'get-session-groups' IPC call.
 * Gets conversation groups for a session using the new buildGroups API.
 * This is an alternative to chunks that provides a simpler, more natural grouping.
 */
async function handleGetSessionGroups(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<ConversationGroup[]> {
  try {
    console.log(`IPC: get-session-groups for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      console.error('IPC: get-session-groups called with invalid parameters');
      return [];
    }

    // Parse session messages
    const parsedSession = await sessionParser.parseSession(projectId, sessionId);

    // Resolve subagents
    const subagents = await subagentResolver.resolveSubagents(
      projectId,
      sessionId,
      parsedSession.taskCalls
    );

    // Build conversation groups using the new API
    const groups = chunkBuilder.buildGroups(parsedSession.messages, subagents);

    console.log(
      `IPC: Built ${groups.length} conversation groups with ${subagents.length} subagents`
    );

    return groups;
  } catch (error) {
    console.error(`IPC: Error in get-session-groups for ${projectId}/${sessionId}:`, error);
    return [];
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

    // Check cache first
    let subagentDetail = dataCache.getSubagent(cacheKey);

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

    // Cache the result
    dataCache.setSubagent(cacheKey, subagentDetail);

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
// Session Watching Handlers
// =============================================================================

/**
 * Handler for 'start-watching-session' IPC call.
 * Starts watching a specific session file for changes and sends updates to renderer.
 */
async function handleStartWatchingSession(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`IPC: start-watching-session for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Build session file path
    const sessionPath = projectScanner.getSessionPath(projectId, sessionId);

    if (!fs.existsSync(sessionPath)) {
      return { success: false, error: `Session file not found: ${sessionPath}` };
    }

    // Stop any existing watcher
    fileWatcher.stopWatchingSession();

    // Start watching with callback
    await fileWatcher.startWatchingSession(sessionPath, (content) => {
      // Send updated content to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('session-file-updated', {
          projectId,
          sessionId,
          content
        });
      }
    });

    console.log(`IPC: Started watching session: ${sessionPath}`);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error starting session watch:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'stop-watching-session' IPC call.
 * Stops watching the current session file.
 */
async function handleStopWatchingSession(
  _event: IpcMainInvokeEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('IPC: stop-watching-session');
    fileWatcher.stopWatchingSession();
    return { success: true };
  } catch (error) {
    console.error('IPC: Error stopping session watch:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'refresh-current-session' IPC call.
 * Clears cache and re-fetches session detail.
 */
async function handleRefreshCurrentSession(
  _event: IpcMainInvokeEvent,
  projectId: string,
  sessionId: string
): Promise<SessionDetail | null> {
  try {
    console.log(`IPC: refresh-current-session for ${projectId}/${sessionId}`);

    if (!projectId || !sessionId) {
      console.error('IPC: refresh-current-session called with invalid parameters');
      return null;
    }

    // Clear cache for this session
    dataCache.invalidateSession(projectId, sessionId);
    console.log(`IPC: Cleared cache for ${projectId}/${sessionId}`);

    // Re-fetch session detail (will parse fresh from disk)
    const sessionDetail = await handleGetSessionDetail(_event, projectId, sessionId);

    console.log(`IPC: Refreshed session with ${sessionDetail?.chunks.length || 0} chunks`);
    return sessionDetail;
  } catch (error) {
    console.error(`IPC: Error refreshing session for ${projectId}/${sessionId}:`, error);
    return null;
  }
}

// =============================================================================
// Validation Handlers
// =============================================================================

/**
 * Handler for 'validate-skill' IPC call.
 * Validates if a skill exists (global or project-specific).
 */
async function handleValidateSkill(
  _event: IpcMainInvokeEvent,
  skillName: string,
  projectPath: string
): Promise<{ exists: boolean; location?: 'global' | 'project' }> {
  // Check project-specific first
  const projectSkillPath = path.join(projectPath, '.claude', 'skills', skillName);
  if (fs.existsSync(projectSkillPath)) {
    return { exists: true, location: 'project' };
  }

  // Check global
  const globalSkillPath = path.join(os.homedir(), '.claude', 'skills', skillName);
  if (fs.existsSync(globalSkillPath)) {
    return { exists: true, location: 'global' };
  }

  return { exists: false };
}

/**
 * Handler for 'validate-path' IPC call.
 * Validates if a file/directory path exists relative to project.
 */
async function handleValidatePath(
  _event: IpcMainInvokeEvent,
  relativePath: string,
  projectPath: string
): Promise<{ exists: boolean; isDirectory?: boolean }> {
  try {
    const fullPath = path.join(projectPath, relativePath);

    if (!fs.existsSync(fullPath)) {
      return { exists: false };
    }

    const stats = fs.statSync(fullPath);
    return {
      exists: true,
      isDirectory: stats.isDirectory()
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Handler for 'validate-mentions' IPC call.
 * Batch validates multiple items (more efficient).
 */
async function handleValidateMentions(
  _event: IpcMainInvokeEvent,
  mentions: { type: 'skill' | 'path'; value: string }[],
  projectPath: string
): Promise<Record<string, boolean>> {
  const results = new Map<string, boolean>();

  for (const mention of mentions) {
    if (mention.type === 'skill') {
      const projectSkillPath = path.join(projectPath, '.claude', 'skills', mention.value);
      const globalSkillPath = path.join(os.homedir(), '.claude', 'skills', mention.value);
      results.set(`/${mention.value}`, fs.existsSync(projectSkillPath) || fs.existsSync(globalSkillPath));
    } else {
      const fullPath = path.join(projectPath, mention.value);
      results.set(`@${mention.value}`, fs.existsSync(fullPath));
    }
  }

  return Object.fromEntries(results);
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
  ipcMain.removeHandler('get-session-groups');
  ipcMain.removeHandler('get-session-metrics');
  ipcMain.removeHandler('get-waterfall-data');
  ipcMain.removeHandler('get-subagent-detail');
  ipcMain.removeHandler('start-watching-session');
  ipcMain.removeHandler('stop-watching-session');
  ipcMain.removeHandler('refresh-current-session');
  ipcMain.removeHandler('validate-skill');
  ipcMain.removeHandler('validate-path');
  ipcMain.removeHandler('validate-mentions');
  console.log('IPC: Handlers removed');
}
