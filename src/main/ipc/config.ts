/**
 * IPC Handlers for App Configuration.
 *
 * Handlers:
 * - config:get: Get full app configuration
 * - config:update: Update a specific config section
 * - config:addIgnoreRegex: Add an ignore pattern for notifications
 * - config:removeIgnoreRegex: Remove an ignore pattern
 * - config:addIgnoreProject: Add a project to ignore list
 * - config:removeIgnoreProject: Remove a project from ignore list
 * - config:snooze: Set snooze duration for notifications
 * - config:clearSnooze: Clear the snooze timer
 */

import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ConfigManager, AppConfig } from '../services/ConfigManager';

// Get singleton instance
const configManager = ConfigManager.getInstance();

/**
 * Response type for config operations
 */
interface ConfigResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Registers all config-related IPC handlers.
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  // Get full configuration
  ipcMain.handle('config:get', handleGetConfig);

  // Update configuration section
  ipcMain.handle('config:update', handleUpdateConfig);

  // Ignore regex pattern handlers
  ipcMain.handle('config:addIgnoreRegex', handleAddIgnoreRegex);
  ipcMain.handle('config:removeIgnoreRegex', handleRemoveIgnoreRegex);

  // Ignore project handlers
  ipcMain.handle('config:addIgnoreProject', handleAddIgnoreProject);
  ipcMain.handle('config:removeIgnoreProject', handleRemoveIgnoreProject);

  // Snooze handlers
  ipcMain.handle('config:snooze', handleSnooze);
  ipcMain.handle('config:clearSnooze', handleClearSnooze);

  console.log('IPC: Config handlers registered');
}

// =============================================================================
// Handler Functions
// =============================================================================

/**
 * Handler for 'config:get' IPC call.
 * Returns the full app configuration.
 */
async function handleGetConfig(
  _event: IpcMainInvokeEvent
): Promise<ConfigResult<AppConfig>> {
  try {
    console.log('IPC: config:get');
    const config = configManager.getConfig();
    return { success: true, data: config };
  } catch (error) {
    console.error('IPC: Error in config:get:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:update' IPC call.
 * Updates a specific section of the configuration.
 */
async function handleUpdateConfig(
  _event: IpcMainInvokeEvent,
  section: keyof AppConfig,
  data: Partial<AppConfig[keyof AppConfig]>
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:update section=${section}`);

    if (!section) {
      return { success: false, error: 'Section is required' };
    }

    configManager.updateConfig(section, data);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:update:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:addIgnoreRegex' IPC call.
 * Adds a regex pattern to the notification ignore list.
 */
async function handleAddIgnoreRegex(
  _event: IpcMainInvokeEvent,
  pattern: string
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:addIgnoreRegex pattern="${pattern}"`);

    if (!pattern || typeof pattern !== 'string') {
      return { success: false, error: 'Pattern is required and must be a string' };
    }

    // Validate that the pattern is a valid regex
    try {
      new RegExp(pattern);
    } catch {
      return { success: false, error: 'Invalid regex pattern' };
    }

    configManager.addIgnoreRegex(pattern);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:addIgnoreRegex:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:removeIgnoreRegex' IPC call.
 * Removes a regex pattern from the notification ignore list.
 */
async function handleRemoveIgnoreRegex(
  _event: IpcMainInvokeEvent,
  pattern: string
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:removeIgnoreRegex pattern="${pattern}"`);

    if (!pattern || typeof pattern !== 'string') {
      return { success: false, error: 'Pattern is required and must be a string' };
    }

    configManager.removeIgnoreRegex(pattern);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:removeIgnoreRegex:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:addIgnoreProject' IPC call.
 * Adds a project to the notification ignore list.
 */
async function handleAddIgnoreProject(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:addIgnoreProject projectId="${projectId}"`);

    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'Project ID is required and must be a string' };
    }

    configManager.addIgnoreProject(projectId);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:addIgnoreProject:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:removeIgnoreProject' IPC call.
 * Removes a project from the notification ignore list.
 */
async function handleRemoveIgnoreProject(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:removeIgnoreProject projectId="${projectId}"`);

    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'Project ID is required and must be a string' };
    }

    configManager.removeIgnoreProject(projectId);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:removeIgnoreProject:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:snooze' IPC call.
 * Sets the snooze timer for notifications.
 */
async function handleSnooze(
  _event: IpcMainInvokeEvent,
  minutes: number
): Promise<ConfigResult> {
  try {
    console.log(`IPC: config:snooze minutes=${minutes}`);

    if (typeof minutes !== 'number' || minutes <= 0) {
      return { success: false, error: 'Minutes must be a positive number' };
    }

    configManager.setSnooze(minutes);
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:snooze:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for 'config:clearSnooze' IPC call.
 * Clears the snooze timer.
 */
async function handleClearSnooze(
  _event: IpcMainInvokeEvent
): Promise<ConfigResult> {
  try {
    console.log('IPC: config:clearSnooze');
    configManager.clearSnooze();
    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:clearSnooze:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Removes all config-related IPC handlers.
 * Should be called when shutting down.
 */
export function removeConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler('config:get');
  ipcMain.removeHandler('config:update');
  ipcMain.removeHandler('config:addIgnoreRegex');
  ipcMain.removeHandler('config:removeIgnoreRegex');
  ipcMain.removeHandler('config:addIgnoreProject');
  ipcMain.removeHandler('config:removeIgnoreProject');
  ipcMain.removeHandler('config:snooze');
  ipcMain.removeHandler('config:clearSnooze');
  console.log('IPC: Config handlers removed');
}
