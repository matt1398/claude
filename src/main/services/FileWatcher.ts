/**
 * FileWatcher service - Watches for changes in Claude Code project files.
 *
 * Responsibilities:
 * - Watch ~/.claude/projects/ directory for changes
 * - Detect new/modified/deleted session files
 * - Emit events to notify renderer process
 * - Invalidate cache entries when files change
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { DataCache } from './DataCache';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  projectId: string;
  sessionId?: string;
  filePath: string;
}

export class FileWatcher extends EventEmitter {
  private watcher: fs.FSWatcher | null = null;
  private watchedPath: string;
  private dataCache: DataCache;
  private isWatching: boolean = false;

  constructor(watchedPath: string, dataCache: DataCache) {
    super();
    this.watchedPath = watchedPath;
    this.dataCache = dataCache;
  }

  /**
   * Starts watching the projects directory.
   */
  start(): void {
    if (this.isWatching) {
      console.warn('FileWatcher: Already watching');
      return;
    }

    try {
      // Check if directory exists
      if (!fs.existsSync(this.watchedPath)) {
        console.warn(`FileWatcher: Directory does not exist: ${this.watchedPath}`);
        return;
      }

      this.watcher = fs.watch(
        this.watchedPath,
        { recursive: true },
        (eventType, filename) => {
          if (filename) {
            this.handleFileChange(eventType, filename);
          }
        }
      );

      this.isWatching = true;
      console.log(`FileWatcher: Started watching ${this.watchedPath}`);
    } catch (error) {
      console.error('FileWatcher: Error starting watcher:', error);
    }
  }

  /**
   * Stops watching the projects directory.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      console.log('FileWatcher: Stopped watching');
    }
  }

  /**
   * Handles file change events.
   * @param eventType - Type of event ('rename' or 'change')
   * @param filename - Relative path to the changed file
   */
  private handleFileChange(eventType: string, filename: string): void {
    try {
      // Parse the filename to extract projectId and sessionId
      const parts = filename.split(path.sep);

      // Ignore non-JSONL files
      if (!filename.endsWith('.jsonl')) {
        return;
      }

      // Extract projectId (first part of path)
      const projectId = parts[0];

      // Check if this is a session file or subagent file
      let sessionId: string | undefined;
      let changeType: FileChangeEvent['type'];

      const fullPath = path.join(this.watchedPath, filename);
      const fileExists = fs.existsSync(fullPath);

      // Determine change type
      if (eventType === 'rename') {
        changeType = fileExists ? 'add' : 'unlink';
      } else {
        changeType = 'change';
      }

      // Session file at project root: projectId/sessionId.jsonl
      if (parts.length === 2) {
        sessionId = path.basename(parts[1], '.jsonl');
      }
      // Subagent file: projectId/sessionId/subagents/agent-hash.jsonl
      else if (parts.length === 4 && parts[2] === 'subagents') {
        sessionId = parts[1];
      }

      if (sessionId) {
        // Invalidate cache for this session
        const cacheKey = `${projectId}:${sessionId}`;
        this.dataCache.invalidate(cacheKey);

        // Emit event
        const event: FileChangeEvent = {
          type: changeType,
          projectId,
          sessionId,
          filePath: fullPath,
        };

        this.emit('file-change', event);
        console.log(`FileWatcher: File ${changeType} - ${filename}`);
      }
    } catch (error) {
      console.error('FileWatcher: Error handling file change:', error);
    }
  }

  /**
   * Returns whether the watcher is currently active.
   * @returns true if watching, false otherwise
   */
  isActive(): boolean {
    return this.isWatching;
  }
}
