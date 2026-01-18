/**
 * IPC Handlers - Expose safe API to renderer process.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-sessions: List sessions for a project
 * - get-sessions-paginated: List sessions with cursor-based pagination
 * - get-session-detail: Get full session detail with subagents
 * - get-session-groups: Get conversation groups for a session (alternative to chunks)
 * - get-session-metrics: Get metrics for a session
 * - search-sessions: Search sessions in a project
 * - get-subagent-detail: Get detailed information for a specific subagent
 * - validate-skill: Validate if a skill exists (global or project-specific)
 * - validate-path: Validate if a file/directory path exists relative to project
 * - validate-mentions: Batch validate multiple items (more efficient)
 * - session:scrollToLine: Deep link handler for scrolling to a specific line in a session
 *
 * Additional handlers registered via separate modules:
 * - notifications:* - See ./notifications.ts
 * - config:* - See ./config.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  Project,
  ProjectGroup,
  Session,
  SessionDetail,
  SessionMetrics,
  WaterfallData,
  SubagentDetail,
  ConversationGroup,
  PaginatedSessionsResult,
  SearchSessionsResult,
} from '../types/claude';
import { ProjectScanner } from '../services/ProjectScanner';
import { SessionParser } from '../services/SessionParser';
import { SubagentResolver } from '../services/SubagentResolver';
import { ChunkBuilder } from '../services/ChunkBuilder';
import { DataCache } from '../services/DataCache';
import { registerNotificationHandlers, removeNotificationHandlers } from './notifications';
import { registerConfigHandlers, removeConfigHandlers } from './config';

// Service instances
let projectScanner: ProjectScanner;
let sessionParser: SessionParser;
let subagentResolver: SubagentResolver;
let chunkBuilder: ChunkBuilder;
let dataCache: DataCache;

// =============================================================================
// Project Handlers (defined before registerHandlers to avoid hoisting issues)
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

/**
 * Handler for 'get-project-groups' IPC call.
 * Lists all projects grouped by date from ~/.claude/projects/
 */
export async function handleGetProjectGroups(): Promise<ProjectGroup[]> {
  console.log('[IPC] get-project-groups called');
  const groups = await projectScanner.scanGrouped();
  console.log(`[IPC] Returning ${groups.length} project groups`);
  return groups;
}

// =============================================================================
// Initialization
// =============================================================================

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
  ipcMain.handle('get-project-groups', handleGetProjectGroups);

  // Session handlers
  ipcMain.handle('get-sessions', handleGetSessions);
  ipcMain.handle('get-sessions-paginated', handleGetSessionsPaginated);
  ipcMain.handle('get-session-detail', handleGetSessionDetail);
  ipcMain.handle('get-session-groups', handleGetSessionGroups);
  ipcMain.handle('get-session-metrics', handleGetSessionMetrics);

  // Search handlers
  ipcMain.handle('search-sessions', handleSearchSessions);

  // Subagent handlers
  ipcMain.handle('get-subagent-detail', handleGetSubagentDetail);

  // Validation handlers
  ipcMain.handle('validate-skill', handleValidateSkill);
  ipcMain.handle('validate-path', handleValidatePath);
  ipcMain.handle('validate-mentions', handleValidateMentions);

  // Deep link handler for session scrolling (from notifications)
  ipcMain.handle('session:scrollToLine', handleScrollToLine);

  // Register notification and config handlers
  registerNotificationHandlers(ipcMain);
  registerConfigHandlers(ipcMain);

  console.log('IPC: Handlers registered');
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
 * Handler for 'get-sessions-paginated' IPC call.
 * Lists sessions for a project with cursor-based pagination.
 */
async function handleGetSessionsPaginated(
  _event: IpcMainInvokeEvent,
  projectId: string,
  cursor: string | null,
  limit?: number
): Promise<PaginatedSessionsResult> {
  try {
    console.log(`IPC: get-sessions-paginated for project ${projectId}, cursor: ${cursor ? 'yes' : 'no'}, limit: ${limit}`);

    if (!projectId) {
      console.error('IPC: get-sessions-paginated called with empty projectId');
      return { sessions: [], nextCursor: null, hasMore: false, totalCount: 0 };
    }

    const result = await projectScanner.listSessionsPaginated(projectId, cursor, limit);
    console.log(`IPC: Found ${result.sessions.length} sessions, hasMore: ${result.hasMore}, total: ${result.totalCount}`);
    return result;
  } catch (error) {
    console.error(`IPC: Error in get-sessions-paginated for project ${projectId}:`, error);
    return { sessions: [], nextCursor: null, hasMore: false, totalCount: 0 };
  }
}

/**
 * Handler for 'search-sessions' IPC call.
 * Searches sessions in a project for a query string.
 */
async function handleSearchSessions(
  _event: IpcMainInvokeEvent,
  projectId: string,
  query: string,
  maxResults?: number
): Promise<SearchSessionsResult> {
  try {
    console.log(`IPC: search-sessions for project ${projectId}, query: "${query}"`);

    if (!projectId) {
      console.error('IPC: search-sessions called with empty projectId');
      return { results: [], totalMatches: 0, sessionsSearched: 0, query };
    }

    const result = await projectScanner.searchSessions(projectId, query, maxResults);
    console.log(`IPC: Found ${result.totalMatches} matches in ${result.sessionsSearched} sessions`);
    return result;
  } catch (error) {
    console.error(`IPC: Error in search-sessions for project ${projectId}:`, error);
    return { results: [], totalMatches: 0, sessionsSearched: 0, query };
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
// Navigation Handlers
// =============================================================================

/**
 * Handler for 'session:scrollToLine' IPC call.
 * Used for deep linking from notifications to specific lines in a session.
 * The actual scrolling happens in the renderer; this handler validates and returns the data.
 */
async function handleScrollToLine(
  _event: IpcMainInvokeEvent,
  sessionId: string,
  lineNumber: number
): Promise<{ success: boolean; sessionId: string; lineNumber: number }> {
  try {
    console.log(`IPC: session:scrollToLine sessionId=${sessionId}, lineNumber=${lineNumber}`);

    if (!sessionId) {
      console.error('IPC: session:scrollToLine called with empty sessionId');
      return { success: false, sessionId: '', lineNumber: 0 };
    }

    if (typeof lineNumber !== 'number' || lineNumber < 0) {
      console.error('IPC: session:scrollToLine called with invalid lineNumber');
      return { success: false, sessionId, lineNumber: 0 };
    }

    return { success: true, sessionId, lineNumber };
  } catch (error) {
    console.error(`IPC: Error in session:scrollToLine:`, error);
    return { success: false, sessionId: '', lineNumber: 0 };
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
  ipcMain.removeHandler('get-project-groups');
  ipcMain.removeHandler('get-sessions');
  ipcMain.removeHandler('get-sessions-paginated');
  ipcMain.removeHandler('get-session-detail');
  ipcMain.removeHandler('get-session-groups');
  ipcMain.removeHandler('get-session-metrics');
  ipcMain.removeHandler('get-waterfall-data');
  ipcMain.removeHandler('get-subagent-detail');
  ipcMain.removeHandler('search-sessions');
  ipcMain.removeHandler('validate-skill');
  ipcMain.removeHandler('validate-path');
  ipcMain.removeHandler('validate-mentions');
  ipcMain.removeHandler('session:scrollToLine');

  // Remove notification and config handlers
  removeNotificationHandlers(ipcMain);
  removeConfigHandlers(ipcMain);

  console.log('IPC: Handlers removed');
}
