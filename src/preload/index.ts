import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../renderer/types/data';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProjectGroups: () => ipcRenderer.invoke('get-project-groups'),
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

  // Notifications API
  notifications: {
    get: (options?: { limit?: number; offset?: number }) =>
      ipcRenderer.invoke('notifications:get', options),
    markRead: (id: string) =>
      ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () =>
      ipcRenderer.invoke('notifications:markAllRead'),
    clear: () =>
      ipcRenderer.invoke('notifications:clear'),
    getUnreadCount: () =>
      ipcRenderer.invoke('notifications:getUnreadCount'),
    onNew: (callback: (event: unknown, error: unknown) => void) => {
      ipcRenderer.on('notification:new', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
      return () => ipcRenderer.removeListener('notification:new', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
    },
    onUpdated: (callback: (event: unknown) => void) => {
      ipcRenderer.on('notification:updated', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
      return () => ipcRenderer.removeListener('notification:updated', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
    },
    onClicked: (callback: (event: unknown, data: unknown) => void) => {
      ipcRenderer.on('notification:clicked', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
      return () => ipcRenderer.removeListener('notification:clicked', callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void);
    },
  },

  // Config API - unwraps { success, data, error } responses from IPC handlers
  config: {
    get: async () => {
      const result = await ipcRenderer.invoke('config:get');
      if (!result.success) throw new Error(result.error || 'Failed to get config');
      return result.data;
    },
    update: async (section: string, data: object) => {
      const result = await ipcRenderer.invoke('config:update', section, data);
      if (!result.success) throw new Error(result.error || 'Failed to update config');
      return result.data;
    },
    addIgnoreRegex: async (pattern: string) => {
      const result = await ipcRenderer.invoke('config:addIgnoreRegex', pattern);
      if (!result.success) throw new Error(result.error || 'Failed to add ignore regex');
      // Re-fetch config after mutation
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
    removeIgnoreRegex: async (pattern: string) => {
      const result = await ipcRenderer.invoke('config:removeIgnoreRegex', pattern);
      if (!result.success) throw new Error(result.error || 'Failed to remove ignore regex');
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
    addIgnoreProject: async (projectId: string) => {
      const result = await ipcRenderer.invoke('config:addIgnoreProject', projectId);
      if (!result.success) throw new Error(result.error || 'Failed to add ignore project');
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
    removeIgnoreProject: async (projectId: string) => {
      const result = await ipcRenderer.invoke('config:removeIgnoreProject', projectId);
      if (!result.success) throw new Error(result.error || 'Failed to remove ignore project');
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
    snooze: async (minutes: number) => {
      const result = await ipcRenderer.invoke('config:snooze', minutes);
      if (!result.success) throw new Error(result.error || 'Failed to snooze');
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
    clearSnooze: async () => {
      const result = await ipcRenderer.invoke('config:clearSnooze');
      if (!result.success) throw new Error(result.error || 'Failed to clear snooze');
      const configResult = await ipcRenderer.invoke('config:get');
      return configResult.data;
    },
  },

  // Deep link navigation
  session: {
    scrollToLine: (sessionId: string, lineNumber: number) =>
      ipcRenderer.invoke('session:scrollToLine', sessionId, lineNumber),
  },
};

// Use contextBridge to securely expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
