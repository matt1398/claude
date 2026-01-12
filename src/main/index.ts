/**
 * Main process entry point for Claude Code Execution Visualizer.
 *
 * Responsibilities:
 * - Initialize Electron app and main window
 * - Set up IPC handlers for data access
 * - Initialize services (ProjectScanner, SessionParser, etc.)
 * - Start file watcher for live updates
 * - Manage application lifecycle
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { ProjectScanner } from './services/ProjectScanner';
import { SessionParser } from './services/SessionParser';
import { SubagentResolver } from './services/SubagentResolver';
import { ChunkBuilder } from './services/ChunkBuilder';
import { DataCache } from './services/DataCache';
import { FileWatcher } from './services/FileWatcher';
import { initializeIpcHandlers, removeIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

// Service instances
let projectScanner: ProjectScanner;
let sessionParser: SessionParser;
let subagentResolver: SubagentResolver;
let chunkBuilder: ChunkBuilder;
let dataCache: DataCache;
let fileWatcher: FileWatcher;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initializes all services.
 */
function initializeServices(): void {
  console.log('Initializing services...');

  // Initialize services (paths are set automatically from environment)
  projectScanner = new ProjectScanner();
  sessionParser = new SessionParser(projectScanner);
  subagentResolver = new SubagentResolver(projectScanner);
  chunkBuilder = new ChunkBuilder();
  dataCache = new DataCache(50, 10); // Max 50 sessions, 10 minute TTL

  console.log(`Projects directory: ${projectScanner.getProjectsDir()}`);

  // Initialize IPC handlers
  initializeIpcHandlers(
    projectScanner,
    sessionParser,
    subagentResolver,
    chunkBuilder,
    dataCache
  );

  // Start file watcher
  fileWatcher = new FileWatcher(dataCache);
  fileWatcher.start();

  // Forward file change events to renderer
  fileWatcher.on('file-change', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-change', event);
    }
  });

  fileWatcher.on('todo-change', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('todo-change', event);
    }
  });

  // Start automatic cache cleanup
  cleanupInterval = dataCache.startAutoCleanup(5); // Clean every 5 minutes

  console.log('Services initialized successfully');
}

/**
 * Shuts down all services.
 */
function shutdownServices(): void {
  console.log('Shutting down services...');

  // Stop file watcher
  if (fileWatcher) {
    fileWatcher.stop();
  }

  // Stop cache cleanup
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  // Remove IPC handlers
  removeIpcHandlers();

  console.log('Services shut down successfully');
}

/**
 * Creates the main application window.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    title: 'Claude Code Execution Visualizer',
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('Main window created');
}

/**
 * Application ready handler.
 */
app.whenReady().then(() => {
  console.log('App ready, initializing...');

  // Initialize services first
  initializeServices();

  // Then create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * All windows closed handler.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit handler - cleanup.
 */
app.on('before-quit', () => {
  shutdownServices();
});
