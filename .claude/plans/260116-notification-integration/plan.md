# Notification Integration Plan

## Overview

Integrate error notification functionality from `notification_example/` into the main Claude Code Visualizer Electron app. This includes:
1. Mac top bar notifications for Claude Code errors
2. App settings panel (notifications + general settings)
3. Notification aggregation tab with deep linking to errored sessions

---

## Architecture Analysis

### Source (notification_example)
- **Menubar app** using `menubar` package (separate top bar icon)
- **LogWatcher**: Uses `chokidar` to watch `~/.claude/projects/**/*.jsonl`
- **ErrorDetector**: Detects errors via `toolUseResult.includes('error')` or `is_error: true`
- **Notifier**: Uses Electron's native `Notification` API with 5s throttling
- **ConfigManager**: Stores settings at `~/.claude/monitor-config.json`

### Target (claude-viz)
- **Full Electron app** with window (not menubar)
- **FileWatcher**: Already watches `~/.claude/projects/` and `~/.claude/todos/`
- **Tab-based UI**: Dashboard, session tabs
- **Zustand store**: Centralized state management
- **IPC pattern**: Main → Preload → Renderer

---

## Implementation Plan

### Phase 1: Core Error Detection & Notification System

#### 1.1 Error Detection Service (Main Process)
**File**: `src/main/services/ErrorDetector.ts`

```typescript
interface DetectedError {
  id: string                    // UUID for unique identification
  timestamp: number
  sessionId: string
  projectId: string
  filePath: string
  source: string               // Tool name or 'assistant'
  message: string
  lineNumber?: number          // Line in JSONL for deep linking
  context: {
    projectName: string
    cwd?: string
  }
}
```

**Detection patterns** (from notification_example):
1. `toolUseResult?.toLowerCase().includes('error')`
2. `message.content[].type === 'tool_result' && is_error === true`

#### 1.2 Notification Manager Service (Main Process)
**File**: `src/main/services/NotificationManager.ts`

- Integrates with existing `FileWatcher`
- Stores error history (max 100 entries, persisted to `~/.claude/viz-notifications.json`)
- Handles throttling (5s per unique error hash)
- Sends native macOS notifications via Electron `Notification` API
- Emits IPC events to renderer (`notification:new`, `notification:updated`)

#### 1.3 Config Manager Enhancement (Main Process)
**File**: `src/main/services/ConfigManager.ts`

```typescript
interface AppConfig {
  // Notification settings
  notifications: {
    enabled: boolean
    soundEnabled: boolean
    ignoredRegex: string[]
    ignoredProjects: string[]      // Encoded project paths
    snoozedUntil: number | null
    snoozeMinutes: number
  }

  // General app settings
  general: {
    launchAtLogin: boolean
    showDockIcon: boolean
    theme: 'dark' | 'light' | 'system'
    defaultTab: 'dashboard' | 'last-session'
  }

  // Display settings
  display: {
    showTimestamps: boolean
    compactMode: boolean
    syntaxHighlighting: boolean
  }
}
```

**Storage**: `~/.claude/viz-config.json`

---

### Phase 2: IPC Layer & Preload Bridge

#### 2.1 New IPC Handlers
**File**: `src/main/ipc/handlers.ts` (extend)

```typescript
// Notification handlers
'notifications:get'           → Get all notifications (paginated)
'notifications:markRead'      → Mark notification as read
'notifications:markAllRead'   → Mark all as read
'notifications:clear'         → Clear all notifications
'notifications:getUnreadCount' → Get unread count for badge

// Config handlers
'config:get'                  → Get full config
'config:update'               → Update config section
'config:addIgnoreRegex'       → Add ignore pattern
'config:removeIgnoreRegex'    → Remove ignore pattern
'config:addIgnoreProject'     → Add ignored project
'config:removeIgnoreProject'  → Remove ignored project
'config:snooze'               → Set snooze duration
'config:clearSnooze'          → Clear snooze

// Deep link handlers
'session:scrollToLine'        → Navigate to specific line in session
```

#### 2.2 Preload Bridge Extensions
**File**: `src/preload/index.ts` (extend)

```typescript
const electronAPI = {
  ...existing,

  // Notifications
  notifications: {
    get: (options) => ipcRenderer.invoke('notifications:get', options),
    markRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
    clear: () => ipcRenderer.invoke('notifications:clear'),
    getUnreadCount: () => ipcRenderer.invoke('notifications:getUnreadCount'),
    onNew: (callback) => ipcRenderer.on('notification:new', callback),
    onUpdated: (callback) => ipcRenderer.on('notification:updated', callback),
  },

  // Config
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (section, data) => ipcRenderer.invoke('config:update', section, data),
    ...
  },
}
```

---

### Phase 3: Renderer Integration

#### 3.1 Zustand Store Extensions
**File**: `src/renderer/store/index.ts` (extend)

```typescript
// Notifications slice
notifications: DetectedError[]
unreadCount: number
notificationsLoading: boolean

// Config slice
appConfig: AppConfig | null
configLoading: boolean

// Actions
fetchNotifications: () => Promise<void>
markNotificationRead: (id: string) => Promise<void>
markAllNotificationsRead: () => Promise<void>
clearNotifications: () => Promise<void>
fetchConfig: () => Promise<void>
updateConfig: (section, data) => Promise<void>
navigateToError: (error: DetectedError) => Promise<void>
```

#### 3.2 Tab System Extension
**File**: `src/renderer/store/index.ts` (extend Tab type)

```typescript
interface Tab {
  id: string
  type: 'session' | 'dashboard' | 'notifications' | 'settings'
  // ... existing fields

  // For error deep linking
  scrollToLine?: number
  highlightErrorId?: string
}
```

---

### Phase 4: UI Components

#### 4.1 Notification Badge & Bell Icon
**File**: `src/renderer/components/layout/TabBar.tsx` (modify)

- Add bell icon next to search button
- Show unread count badge
- Click opens notifications tab

#### 4.2 Notifications Tab View
**File**: `src/renderer/components/notifications/NotificationsView.tsx`

```
┌─────────────────────────────────────────────────┐
│ Notifications                    [Mark All Read]│
├─────────────────────────────────────────────────┤
│ ● Error in project-name          2 min ago      │
│   Build failed: exit code 1                     │
│   [View Session]                                │
├─────────────────────────────────────────────────┤
│ ● Error in another-project       15 min ago     │
│   TypeError: Cannot read property...            │
│   [View Session]                                │
└─────────────────────────────────────────────────┘
```

Features:
- List of errors grouped by project or chronological
- Click "View Session" → opens session tab, scrolls to error
- Filter by project, date range
- Clear all button

#### 4.3 Settings Tab View
**File**: `src/renderer/components/settings/SettingsView.tsx`

```
┌─────────────────────────────────────────────────┐
│ Settings                                         │
├─────────────────────────────────────────────────┤
│ [General] [Notifications] [Display] [Advanced]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ GENERAL                                         │
│ ○ Launch at login                    [Toggle]   │
│ ○ Show dock icon                     [Toggle]   │
│ ○ Default tab on launch              [Dropdown] │
│                                                 │
│ NOTIFICATIONS                                   │
│ ○ Enable notifications               [Toggle]   │
│ ○ Play sound                         [Toggle]   │
│ ○ Snooze notifications              [Dropdown]  │
│                                                 │
│ IGNORED PATTERNS                                │
│ ○ warning|deprecated                 [Remove]   │
│ ○ TODO|FIXME                         [Remove]   │
│ [+ Add Pattern]                                 │
│                                                 │
│ IGNORED PROJECTS                                │
│ ○ my-test-project                    [Remove]   │
│ [+ Add Project]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

Tabs:
1. **General**: Launch at login, dock icon, default tab
2. **Notifications**: Enable/disable, sound, snooze, ignore patterns
3. **Display**: Timestamps, compact mode, syntax highlighting
4. **Advanced**: Reset settings, clear cache, export/import config

#### 4.4 Settings Icon in TabBar
**File**: `src/renderer/components/layout/TabBar.tsx` (modify)

- Add gear icon (⚙️) next to bell icon
- Click opens settings tab

---

### Phase 5: Deep Linking to Errors

#### 5.1 Session Detail Enhancement
**File**: `src/renderer/components/detail/SessionDetail.tsx` (modify)

- Accept `scrollToLine` and `highlightErrorId` from tab props
- On mount, if these are set:
  1. Find the chunk/message containing the error
  2. Expand collapsed sections if needed
  3. Scroll to that element
  4. Apply highlight animation (red glow fade)

#### 5.2 Error Highlight Component
**File**: `src/renderer/components/detail/ErrorHighlight.tsx`

- Wraps error content with animated highlight
- Auto-removes highlight after 3 seconds
- Provides visual context for "where is the error?"

#### 5.3 Navigation Flow

```
User clicks Mac notification
    ↓
Electron receives notification click event
    ↓
Main process emits 'notification:clicked' with error data
    ↓
Renderer receives event
    ↓
Store action: navigateToError(error)
    ↓
1. Open/focus app window
2. Open session tab with { scrollToLine, highlightErrorId }
3. SessionDetail mounts, scrolls & highlights
    ↓
User sees error in < 1 second
```

---

### Phase 6: Native macOS Integration

#### 6.1 Notification Click Handling
**File**: `src/main/services/NotificationManager.ts`

```typescript
const notification = new Notification({
  title: 'Claude Code Error',
  subtitle: projectName,
  body: errorMessage.slice(0, 200),
  sound: config.notifications.soundEnabled ? 'default' : undefined,
});

notification.on('click', () => {
  // Focus app window
  mainWindow.show();
  mainWindow.focus();

  // Send deep link to renderer
  mainWindow.webContents.send('notification:clicked', {
    errorId,
    sessionId,
    projectId,
    lineNumber,
  });
});

notification.show();
```

#### 6.2 App Lifecycle Integration
**File**: `src/main/index.ts` (modify)

- Handle `app.setLoginItemSettings()` based on config
- Handle dock visibility based on config
- Ensure notification permission is requested on first run

---

## File Changes Summary

### New Files (10)
```
src/main/services/ErrorDetector.ts       # Error detection from JSONL
src/main/services/NotificationManager.ts # Native notifications + history
src/main/services/ConfigManager.ts       # App configuration
src/main/ipc/notifications.ts            # Notification IPC handlers
src/main/ipc/config.ts                   # Config IPC handlers
src/renderer/components/notifications/NotificationsView.tsx
src/renderer/components/notifications/NotificationCard.tsx
src/renderer/components/settings/SettingsView.tsx
src/renderer/components/settings/SettingsTabs.tsx
src/renderer/components/detail/ErrorHighlight.tsx
```

### Modified Files (8)
```
src/main/index.ts                        # App lifecycle, notification setup
src/main/ipc/handlers.ts                 # Register new handlers
src/main/services/FileWatcher.ts         # Hook error detection
src/preload/index.ts                     # Extend electronAPI
src/renderer/types/data.ts               # New type definitions
src/renderer/store/index.ts              # Notifications & config state
src/renderer/components/layout/TabBar.tsx # Bell & gear icons
src/renderer/components/detail/SessionDetail.tsx # Deep link scrolling
```

---

## Dependencies

### New Dependencies
```json
{
  "uuid": "^9.0.0"       // For notification IDs (may already have)
}
```

No other new dependencies needed - uses Electron's native `Notification` API and existing packages.

---

## Implementation Order

1. **ConfigManager** - Foundation for all settings
2. **ErrorDetector** - Core error detection logic
3. **NotificationManager** - Native notifications + storage
4. **IPC Layer** - Connect main ↔ renderer
5. **Zustand Store** - State management
6. **TabBar Icons** - Bell + gear icons
7. **SettingsView** - Settings UI
8. **NotificationsView** - Error aggregation UI
9. **Deep Linking** - Scroll to error in session
10. **Polish** - Animations, edge cases, testing

---

## Questions Resolved

1. **Separate menubar vs integrated?** → Integrated into main app (no menubar package needed)
2. **Where to store config?** → `~/.claude/viz-config.json` (separate from notification_example)
3. **Where to store notification history?** → `~/.claude/viz-notifications.json`
4. **Tab types?** → Add 'notifications' and 'settings' to existing tab system
5. **Deep link mechanism?** → Store scrollToLine/highlightErrorId in tab props, SessionDetail handles on mount

---

## Risk Mitigation

1. **Performance**: Error detection runs on file change events (already debounced at 100ms)
2. **Notification spam**: 5-second throttle per unique error hash
3. **Storage growth**: Cap notification history at 100 entries, auto-prune on startup
4. **Config corruption**: JSON schema validation, fallback to defaults on parse error
