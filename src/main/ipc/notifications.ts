/**
 * IPC Handlers for Notification Operations.
 *
 * Handlers:
 * - notifications:get: Get all notifications (paginated)
 * - notifications:markRead: Mark notification as read
 * - notifications:markAllRead: Mark all as read
 * - notifications:clear: Clear all notifications
 * - notifications:getUnreadCount: Get unread count for badge
 */

import { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  NotificationManager,
  GetNotificationsOptions,
  GetNotificationsResult,
  StoredNotification,
  DetectedError,
} from '../services/NotificationManager';

// Re-export types for external use
export type {
  GetNotificationsOptions,
  GetNotificationsResult,
  StoredNotification,
  DetectedError,
};

/**
 * Registers all notification-related IPC handlers.
 *
 * @param ipcMain - The Electron IpcMain instance
 */
export function registerNotificationHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('notifications:get', handleGetNotifications);
  ipcMain.handle('notifications:markRead', handleMarkRead);
  ipcMain.handle('notifications:markAllRead', handleMarkAllRead);
  ipcMain.handle('notifications:clear', handleClear);
  ipcMain.handle('notifications:getUnreadCount', handleGetUnreadCount);

  console.log('IPC: Notification handlers registered');
}

/**
 * Removes all notification IPC handlers.
 * Should be called when shutting down.
 */
export function removeNotificationHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler('notifications:get');
  ipcMain.removeHandler('notifications:markRead');
  ipcMain.removeHandler('notifications:markAllRead');
  ipcMain.removeHandler('notifications:clear');
  ipcMain.removeHandler('notifications:getUnreadCount');

  console.log('IPC: Notification handlers removed');
}

// =============================================================================
// Handler Implementations
// =============================================================================

/**
 * Handler for 'notifications:get' IPC call.
 * Gets all notifications with optional pagination and filtering.
 */
async function handleGetNotifications(
  _event: IpcMainInvokeEvent,
  options?: GetNotificationsOptions
): Promise<GetNotificationsResult> {
  try {
    const opts = options ?? {};
    console.log(`IPC: notifications:get (limit: ${opts.limit ?? 'all'}, offset: ${opts.offset ?? 0})`);

    const manager = NotificationManager.getInstance();
    const result = await manager.getNotifications(opts);

    console.log(`IPC: Returning ${result.notifications.length} notifications, total: ${result.totalCount}`);
    return result;
  } catch (error) {
    console.error('IPC: Error in notifications:get:', error);
    return {
      notifications: [],
      total: 0,
      totalCount: 0,
      unreadCount: 0,
      hasMore: false,
    };
  }
}

/**
 * Handler for 'notifications:markRead' IPC call.
 * Marks a specific notification as read.
 */
async function handleMarkRead(
  _event: IpcMainInvokeEvent,
  notificationId: string
): Promise<boolean> {
  try {
    console.log(`IPC: notifications:markRead (id: ${notificationId})`);

    if (!notificationId) {
      console.error('IPC: notifications:markRead called with empty notificationId');
      return false;
    }

    const manager = NotificationManager.getInstance();
    const success = await manager.markRead(notificationId);

    console.log(`IPC: Marked notification ${notificationId} as read: ${success}`);
    return success;
  } catch (error) {
    console.error(`IPC: Error in notifications:markRead for ${notificationId}:`, error);
    return false;
  }
}

/**
 * Handler for 'notifications:markAllRead' IPC call.
 * Marks all notifications as read.
 */
async function handleMarkAllRead(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  try {
    console.log('IPC: notifications:markAllRead');

    const manager = NotificationManager.getInstance();
    const success = await manager.markAllRead();

    console.log(`IPC: Marked all notifications as read: ${success}`);
    return success;
  } catch (error) {
    console.error('IPC: Error in notifications:markAllRead:', error);
    return false;
  }
}

/**
 * Handler for 'notifications:clear' IPC call.
 * Clears all notifications.
 */
async function handleClear(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  try {
    console.log('IPC: notifications:clear');

    const manager = NotificationManager.getInstance();
    const success = await manager.clearAll();

    console.log(`IPC: Cleared all notifications: ${success}`);
    return success;
  } catch (error) {
    console.error('IPC: Error in notifications:clear:', error);
    return false;
  }
}

/**
 * Handler for 'notifications:getUnreadCount' IPC call.
 * Gets the count of unread notifications for badge display.
 */
async function handleGetUnreadCount(
  _event: IpcMainInvokeEvent
): Promise<number> {
  try {
    console.log('IPC: notifications:getUnreadCount');

    const manager = NotificationManager.getInstance();
    const count = await manager.getUnreadCount();

    console.log(`IPC: Unread count: ${count}`);
    return count;
  } catch (error) {
    console.error('IPC: Error in notifications:getUnreadCount:', error);
    return 0;
  }
}
