import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../renderer/types/data';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getSessions: (projectId: string) => ipcRenderer.invoke('get-sessions', projectId),
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

  // Session watching methods
  startWatchingSession: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('start-watching-session', projectId, sessionId),
  stopWatchingSession: () =>
    ipcRenderer.invoke('stop-watching-session'),
  refreshCurrentSession: (projectId: string, sessionId: string) =>
    ipcRenderer.invoke('refresh-current-session', projectId, sessionId),

  // Event listeners
  onSessionFileUpdated: (callback: (data: { projectId: string; sessionId: string; content: string }) => void) => {
    ipcRenderer.on('session-file-updated', (_event, data) => callback(data));
  },
  onTriggerSoftRefresh: (callback: () => void) => {
    ipcRenderer.on('trigger-soft-refresh', () => callback());
  },
  removeSessionFileUpdatedListener: () => {
    ipcRenderer.removeAllListeners('session-file-updated');
  },
  removeTriggerSoftRefreshListener: () => {
    ipcRenderer.removeAllListeners('trigger-soft-refresh');
  },
};

// Use contextBridge to securely expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
