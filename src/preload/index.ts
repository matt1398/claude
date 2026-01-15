import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../renderer/types/data';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getSessions: (projectId: string) => ipcRenderer.invoke('get-sessions', projectId),
  getSessionsPaginated: (projectId: string, cursor: string | null, limit?: number) =>
    ipcRenderer.invoke('get-sessions-paginated', projectId, cursor, limit),
  searchSessions: (projectId: string, query: string, maxResults?: number) =>
    ipcRenderer.invoke('search-sessions', projectId, query, maxResults),
  getSessionDetail: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('get-session-detail', projectId, sessionId),
  getSessionMetrics: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('get-session-metrics', projectId, sessionId),
  getWaterfallData: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('get-waterfall-data', projectId, sessionId),
  getSubagentDetail: (projectId: string, sessionId: string, subagentId: string) =>
    ipcRenderer.invoke('get-subagent-detail', projectId, sessionId, subagentId),
  getSessionGroups: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('get-session-groups', projectId, sessionId),

  // Validation methods
  validateSkill: (skillName: string, projectPath: string) =>
    ipcRenderer.invoke('validate-skill', skillName, projectPath),
  validatePath: (relativePath: string, projectPath: string) =>
    ipcRenderer.invoke('validate-path', relativePath, projectPath),
  validateMentions: (
    mentions: { type: 'skill' | 'path'; value: string }[],
    projectPath: string
  ) => ipcRenderer.invoke('validate-mentions', mentions, projectPath),
};

// Use contextBridge to securely expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
