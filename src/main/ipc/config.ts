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
 * - config:addTrigger: Add a new notification trigger
 * - config:updateTrigger: Update an existing notification trigger
 * - config:removeTrigger: Remove a notification trigger
 * - config:getTriggers: Get all notification triggers
 * - config:testTrigger: Test a trigger against historical session data
 */

import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ConfigManager, AppConfig, TriggerContentType, TriggerMatchField } from '../services/ConfigManager';

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

  // Trigger management handlers
  ipcMain.handle('config:addTrigger', handleAddTrigger);
  ipcMain.handle('config:updateTrigger', handleUpdateTrigger);
  ipcMain.handle('config:removeTrigger', handleRemoveTrigger);
  ipcMain.handle('config:getTriggers', handleGetTriggers);
  ipcMain.handle('config:testTrigger', handleTestTrigger);

  console.log('IPC: Config handlers registered (including trigger management)');
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
 * Returns the full updated config.
 */
async function handleUpdateConfig(
  _event: IpcMainInvokeEvent,
  section: keyof AppConfig,
  data: Partial<AppConfig[keyof AppConfig]>
): Promise<ConfigResult<AppConfig>> {
  try {
    console.log(`IPC: config:update section=${section}`, data);

    if (!section) {
      return { success: false, error: 'Section is required' };
    }

    configManager.updateConfig(section, data);
    const updatedConfig = configManager.getConfig();
    return { success: true, data: updatedConfig };
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

/**
 * Handler for 'config:addTrigger' - Adds a new notification trigger.
 */
async function handleAddTrigger(
  _event: IpcMainInvokeEvent,
  trigger: {
    id: string;
    name: string;
    enabled: boolean;
    contentType: string;
    requireError?: boolean;
    toolName?: string;
    matchField?: string;
    matchPattern?: string;
    ignorePatterns?: string[];
  }
): Promise<ConfigResult> {
  try {
    if (!trigger.id || !trigger.name || !trigger.contentType) {
      return {
        success: false,
        error: 'Trigger must have id, name, and contentType',
      };
    }

    console.log(`IPC: config:addTrigger (id: ${trigger.id}, name: ${trigger.name})`);

    configManager.addTrigger({
      id: trigger.id,
      name: trigger.name,
      enabled: trigger.enabled,
      contentType: trigger.contentType as TriggerContentType,
      requireError: trigger.requireError,
      toolName: trigger.toolName,
      matchField: trigger.matchField as TriggerMatchField | undefined,
      matchPattern: trigger.matchPattern,
      ignorePatterns: trigger.ignorePatterns,
      isBuiltin: false,
    });

    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:addTrigger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add trigger',
    };
  }
}

/**
 * Handler for 'config:updateTrigger' - Updates an existing notification trigger.
 */
async function handleUpdateTrigger(
  _event: IpcMainInvokeEvent,
  triggerId: string,
  updates: Partial<{
    name: string;
    enabled: boolean;
    contentType: string;
    requireError: boolean;
    toolName: string;
    matchField: string;
    matchPattern: string;
  }>
): Promise<ConfigResult> {
  try {
    if (!triggerId) {
      return {
        success: false,
        error: 'Trigger ID is required',
      };
    }

    console.log(`IPC: config:updateTrigger (id: ${triggerId})`);

    configManager.updateTrigger(triggerId, updates as Partial<import('../services/ConfigManager').NotificationTrigger>);

    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:updateTrigger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update trigger',
    };
  }
}

/**
 * Handler for 'config:removeTrigger' - Removes a notification trigger.
 */
async function handleRemoveTrigger(
  _event: IpcMainInvokeEvent,
  triggerId: string
): Promise<ConfigResult> {
  try {
    if (!triggerId) {
      return {
        success: false,
        error: 'Trigger ID is required',
      };
    }

    console.log(`IPC: config:removeTrigger (id: ${triggerId})`);

    configManager.removeTrigger(triggerId);

    return { success: true };
  } catch (error) {
    console.error('IPC: Error in config:removeTrigger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove trigger',
    };
  }
}

/**
 * Handler for 'config:getTriggers' - Gets all notification triggers.
 */
async function handleGetTriggers(
  _event: IpcMainInvokeEvent
): Promise<ConfigResult<import('../services/ConfigManager').NotificationTrigger[]>> {
  try {
    console.log('IPC: config:getTriggers');

    const triggers = configManager.getTriggers();

    return { success: true, data: triggers };
  } catch (error) {
    console.error('IPC: Error in config:getTriggers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get triggers',
    };
  }
}

/**
 * Handler for 'config:testTrigger' - Tests a trigger against historical session data.
 * Returns errors that would have been detected by the trigger.
 */
async function handleTestTrigger(
  _event: IpcMainInvokeEvent,
  trigger: import('../services/ConfigManager').NotificationTrigger
): Promise<ConfigResult<{
  totalCount: number;
  errors: Array<{
    id: string;
    sessionId: string;
    projectId: string;
    message: string;
    timestamp: number;
    source: string;
    context: { projectName: string };
  }>;
}>> {
  try {
    console.log(`IPC: config:testTrigger (id: ${trigger.id}, name: ${trigger.name})`);

    const { errorDetector } = await import('../services/ErrorDetector');
    const result = await errorDetector.testTrigger(trigger, 50);

    // Map the DetectedError objects to the simplified format expected by the renderer
    const errors = result.errors.map((error) => ({
      id: error.id,
      sessionId: error.sessionId,
      projectId: error.projectId,
      message: error.message,
      timestamp: error.timestamp,
      source: error.source,
      context: { projectName: error.context.projectName },
    }));

    return { success: true, data: { totalCount: result.totalCount, errors } };
  } catch (error) {
    console.error('IPC: Error in config:testTrigger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test trigger',
    };
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
  ipcMain.removeHandler('config:addTrigger');
  ipcMain.removeHandler('config:updateTrigger');
  ipcMain.removeHandler('config:removeTrigger');
  ipcMain.removeHandler('config:getTriggers');
  ipcMain.removeHandler('config:testTrigger');
  console.log('IPC: Config handlers removed');
}
