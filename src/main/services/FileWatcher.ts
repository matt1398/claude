/**
 * FileWatcher service - Watches for changes in Claude Code project files.
 *
 * Responsibilities:
 * - Watch ~/.claude/projects/ directory for session changes
 * - Watch ~/.claude/todos/ directory for todo changes
 * - Detect new/modified/deleted files
 * - Emit events to notify renderer process
 * - Invalidate cache entries when files change
 * - Detect errors in changed session files and notify NotificationManager
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { FileChangeEvent } from '../types/claude';
import { DataCache } from './DataCache';
import { getProjectsBasePath, getTodosBasePath } from '../utils/pathDecoder';
import { errorDetector } from './ErrorDetector';
import { NotificationManager } from './NotificationManager';
import { parseJsonlFile } from '../utils/jsonl';

/** Debounce window for file change events */
const DEBOUNCE_MS = 100;

export class FileWatcher extends EventEmitter {
  private projectsWatcher: fs.FSWatcher | null = null;
  private todosWatcher: fs.FSWatcher | null = null;
  private projectsPath: string;
  private todosPath: string;
  private dataCache: DataCache;
  private notificationManager: NotificationManager | null = null;
  private isWatching: boolean = false;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Track last processed line count per file for incremental error detection */
  private lastProcessedLineCount: Map<string, number> = new Map();

  constructor(dataCache: DataCache, projectsPath?: string, todosPath?: string) {
    super();
    this.projectsPath = projectsPath || getProjectsBasePath();
    this.todosPath = todosPath || getTodosBasePath();
    this.dataCache = dataCache;
  }

  /**
   * Sets the NotificationManager for error detection integration.
   * Must be called before start() to enable error notifications.
   */
  setNotificationManager(manager: NotificationManager): void {
    this.notificationManager = manager;
  }

  // ===========================================================================
  // Watcher Control
  // ===========================================================================

  /**
   * Starts watching the projects and todos directories.
   */
  start(): void {
    if (this.isWatching) {
      console.warn('FileWatcher: Already watching');
      return;
    }

    this.startProjectsWatcher();
    this.startTodosWatcher();
    this.isWatching = true;
  }

  /**
   * Stops all watchers.
   */
  stop(): void {
    if (this.projectsWatcher) {
      this.projectsWatcher.close();
      this.projectsWatcher = null;
    }

    if (this.todosWatcher) {
      this.todosWatcher.close();
      this.todosWatcher = null;
    }

    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear error detection tracking
    this.lastProcessedLineCount.clear();

    this.isWatching = false;
    console.log('FileWatcher: Stopped watching');
  }

  /**
   * Starts the projects directory watcher.
   */
  private startProjectsWatcher(): void {
    try {
      if (!fs.existsSync(this.projectsPath)) {
        console.warn(`FileWatcher: Projects directory does not exist: ${this.projectsPath}`);
        return;
      }

      this.projectsWatcher = fs.watch(
        this.projectsPath,
        { recursive: true },
        (eventType, filename) => {
          if (filename) {
            this.handleProjectsChange(eventType, filename);
          }
        }
      );

      console.log(`FileWatcher: Started watching projects at ${this.projectsPath}`);
    } catch (error) {
      console.error('FileWatcher: Error starting projects watcher:', error);
    }
  }

  /**
   * Starts the todos directory watcher.
   */
  private startTodosWatcher(): void {
    try {
      if (!fs.existsSync(this.todosPath)) {
        // Todos directory may not exist yet - that's OK
        return;
      }

      this.todosWatcher = fs.watch(this.todosPath, (eventType, filename) => {
        if (filename) {
          this.handleTodosChange(eventType, filename);
        }
      });

      console.log(`FileWatcher: Started watching todos at ${this.todosPath}`);
    } catch (error) {
      console.error('FileWatcher: Error starting todos watcher:', error);
    }
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Handles file change events in the projects directory.
   */
  private handleProjectsChange(eventType: string, filename: string): void {
    try {
      // Ignore non-JSONL files
      if (!filename.endsWith('.jsonl')) {
        return;
      }

      // Debounce rapid changes to the same file
      this.debounce(filename, () => this.processProjectsChange(eventType, filename));
    } catch (error) {
      console.error('FileWatcher: Error handling projects change:', error);
    }
  }

  /**
   * Process a debounced projects change.
   */
  private processProjectsChange(eventType: string, filename: string): void {
    const parts = filename.split(path.sep);
    const projectId = parts[0];

    if (!projectId) return;

    const fullPath = path.join(this.projectsPath, filename);
    const fileExists = fs.existsSync(fullPath);

    // Determine change type
    let changeType: FileChangeEvent['type'];
    if (eventType === 'rename') {
      changeType = fileExists ? 'add' : 'unlink';
    } else {
      changeType = 'change';
    }

    // Parse session ID and check if it's a subagent
    let sessionId: string | undefined;
    let isSubagent = false;

    // Session file at project root: projectId/sessionId.jsonl
    if (parts.length === 2) {
      sessionId = path.basename(parts[1], '.jsonl');
    }
    // Subagent file: projectId/sessionId/subagents/agent-hash.jsonl
    else if (parts.length === 4 && parts[2] === 'subagents') {
      sessionId = parts[1];
      isSubagent = true;
    }

    if (sessionId) {
      // Invalidate cache
      this.dataCache.invalidateSession(projectId, sessionId);

      // Emit event
      const event: FileChangeEvent = {
        type: changeType,
        path: fullPath,
        projectId,
        sessionId,
        isSubagent,
      };

      this.emit('file-change', event);
      console.log(
        `FileWatcher: ${changeType} ${isSubagent ? 'subagent' : 'session'} - ${filename}`
      );

      // Detect errors in changed session files (not deleted files)
      // Only detect errors in main session files, not subagent files
      if (changeType !== 'unlink' && !isSubagent && this.notificationManager) {
        this.detectErrorsInSessionFile(projectId, sessionId, fullPath).catch((err) => {
          console.error('FileWatcher: Error detecting errors in session file:', err);
        });
      }
    }
  }

  // ===========================================================================
  // Error Detection
  // ===========================================================================

  /**
   * Detects errors in a session file and sends notifications.
   * Uses incremental processing to only check new lines since last check.
   */
  private async detectErrorsInSessionFile(
    projectId: string,
    sessionId: string,
    filePath: string
  ): Promise<void> {
    if (!this.notificationManager) {
      return;
    }

    try {
      // Parse the file to get all messages
      const messages = await parseJsonlFile(filePath);
      const currentLineCount = messages.length;

      // Get the last processed line count for this file
      const lastLineCount = this.lastProcessedLineCount.get(filePath) || 0;

      // If no new lines, skip processing
      if (currentLineCount <= lastLineCount) {
        return;
      }

      // Only process new messages (from lastLineCount onwards)
      const newMessages = messages.slice(lastLineCount);

      // Detect errors in new messages
      // Note: We pass the offset-adjusted line numbers to errorDetector
      const errors = errorDetector.detectErrors(
        newMessages,
        sessionId,
        projectId,
        filePath
      );

      // Adjust line numbers to account for the offset
      for (const error of errors) {
        if (error.lineNumber !== undefined) {
          error.lineNumber = error.lineNumber + lastLineCount;
        }
      }

      // Notify for each detected error
      for (const error of errors) {
        this.notificationManager.addError(error);
      }

      // Update the last processed line count
      this.lastProcessedLineCount.set(filePath, currentLineCount);

      if (errors.length > 0) {
        console.log(`FileWatcher: Detected ${errors.length} errors in ${filePath}`);
      }
    } catch (err) {
      console.error(`FileWatcher: Error processing session file for errors: ${filePath}`, err);
    }
  }

  /**
   * Clears the error detection tracking for a specific file.
   * Call this when a file is deleted or to force re-processing.
   */
  clearErrorTracking(filePath: string): void {
    this.lastProcessedLineCount.delete(filePath);
  }

  /**
   * Clears all error detection tracking.
   */
  clearAllErrorTracking(): void {
    this.lastProcessedLineCount.clear();
  }

  /**
   * Handles file change events in the todos directory.
   */
  private handleTodosChange(eventType: string, filename: string): void {
    try {
      // Only handle JSON files
      if (!filename.endsWith('.json')) {
        return;
      }

      // Debounce rapid changes
      this.debounce(`todos/${filename}`, () => this.processTodosChange(eventType, filename));
    } catch (error) {
      console.error('FileWatcher: Error handling todos change:', error);
    }
  }

  /**
   * Process a debounced todos change.
   */
  private processTodosChange(eventType: string, filename: string): void {
    // Session ID is the filename without extension
    const sessionId = path.basename(filename, '.json');
    const fullPath = path.join(this.todosPath, filename);
    const fileExists = fs.existsSync(fullPath);

    // Determine change type
    let changeType: FileChangeEvent['type'];
    if (eventType === 'rename') {
      changeType = fileExists ? 'add' : 'unlink';
    } else {
      changeType = 'change';
    }

    // Emit event (we don't have projectId for todos)
    const event: FileChangeEvent = {
      type: changeType,
      path: fullPath,
      sessionId,
      isSubagent: false,
    };

    this.emit('todo-change', event);
    console.log(`FileWatcher: ${changeType} todo - ${filename}`);
  }

  // ===========================================================================
  // Debouncing
  // ===========================================================================

  /**
   * Debounce a function call for a specific key.
   */
  private debounce(key: string, fn: () => void): void {
    // Clear existing timer for this key
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      fn();
    }, DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  /**
   * Returns whether the watcher is currently active.
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Returns watched paths.
   */
  getWatchedPaths(): { projects: string; todos: string } {
    return {
      projects: this.projectsPath,
      todos: this.todosPath,
    };
  }
}
