import { ipcMain } from 'electron'

// Placeholder IPC handlers
// These will be implemented in Phase 1.3-1.7

export function registerIpcHandlers(): void {
  ipcMain.handle('get-projects', async () => {
    // TODO: Implement in Phase 1.3 - ProjectScanner
    return []
  })

  ipcMain.handle('get-sessions', async (_, projectId: string) => {
    // TODO: Implement in Phase 1.4 - SessionParser
    return []
  })

  ipcMain.handle('get-session-detail', async (_, projectId: string, sessionId: string) => {
    // TODO: Implement in Phase 1.4-1.5 - SessionParser + SubagentResolver
    return null
  })
}
