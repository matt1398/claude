# Real-Time Updates Implementation

This document describes the near real-time update system for the Claude Code Execution Visualizer, enabling automatic UI updates when session files change without manual refresh.

## Overview

The real-time update system monitors `~/.claude/projects/` for file changes and automatically updates the UI while preserving user state (expansion toggles, scroll position, etc.).

```
FileWatcher (main process)
    ↓ detects file change (100ms debounce)
IPC event: 'file-change'
    ↓
Preload bridge: window.electronAPI.onFileChange
    ↓
Zustand store listener
    ↓
refreshSessionInPlace() or refreshSessionsInPlace()
    ↓
UI updates without flickering
```

## Architecture

### 1. File Watching (Main Process)

**File**: `src/main/services/FileWatcher.ts`

The `FileWatcher` service uses `chokidar` to monitor:
- `~/.claude/projects/**/*.jsonl` - Session and subagent files
- `~/.claude/todos/**/*.json` - Todo files

Key features:
- 100ms debounce to handle rapid file changes
- Distinguishes between `add`, `change`, and `unlink` events
- Identifies whether a file is a main session or subagent file (`isSubagent` flag)
- Automatically invalidates `DataCache` when files change

### 2. IPC Bridge (Preload)

**File**: `src/preload/index.ts`

Exposes file-change events to the renderer:

```typescript
onFileChange: (callback: (event: FileChangeEvent) => void) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on('file-change', listener);
  return () => ipcRenderer.removeListener('file-change', listener);
}
```

**FileChangeEvent structure**:
```typescript
interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  projectId?: string;
  sessionId?: string;
  isSubagent: boolean;
}
```

### 3. Event Listener Initialization (Renderer)

**File**: `src/renderer/App.tsx`

Event listeners are initialized once when the app starts:

```typescript
useEffect(() => {
  const cleanup = initializeNotificationListeners();
  return cleanup;
}, []);
```

**File**: `src/renderer/store/index.ts` (`initializeNotificationListeners`)

Handles three event types:
1. **New session added** (`type === 'add'`) → Refresh sessions list
2. **Session content changed** (`type === 'change'`) → Refresh session detail
3. **Subagent file changed** (`type === 'change', isSubagent: true`) → Refresh session detail

```typescript
window.electronAPI.onFileChange((event) => {
  if (event.type === 'unlink') return;

  const state = useStore.getState();

  // New session added
  if (event.type === 'add' && !event.isSubagent && event.projectId) {
    if (state.selectedProjectId === event.projectId) {
      state.refreshSessionsInPlace(event.projectId);
    }
    return;
  }

  // Session or subagent content changed
  if (event.type === 'change' && event.projectId && event.sessionId) {
    const activeTab = state.getActiveTab();
    const isViewingSession =
      (state.selectedSessionId === event.sessionId) ||
      (activeTab?.type === 'session' && activeTab.sessionId === event.sessionId);

    if (isViewingSession) {
      state.refreshSessionInPlace(event.projectId, event.sessionId);
    }
  }
});
```

### 4. Flicker-Free Refresh Actions

Two specialized refresh actions avoid UI flickering:

#### `refreshSessionInPlace(projectId, sessionId)`

Updates session content without:
- Setting `sessionDetailLoading: true`
- Resetting `visibleAIGroupId` or `selectedAIGroup`
- Touching expansion states (`expandedAIGroupIds`, `expandedDisplayItemIds`)

#### `refreshSessionsInPlace(projectId)`

Updates sessions list without:
- Setting `sessionsLoading: true`
- Showing loading skeleton

## State Persistence Across Refreshes

### Problem: Local React State Resets

When conversation data updates, React components may re-render and lose local `useState` values.

### Solution: Zustand Store for UI State

All expansion states are stored in Zustand:

| State | Purpose |
|-------|---------|
| `expandedAIGroupIds: Set<string>` | AI group expand/collapse toggle |
| `expandedDisplayItemIds: Map<string, Set<string>>` | Display items (thinking, tools) per AI group |
| `expandedStepIds: Set<string>` | Semantic step expansion |
| `aiGroupExpansionLevels: Map<string, AIGroupExpansionLevel>` | Expansion level (collapsed/items/full) |

### Problem: Unstable Chunk IDs

Chunk IDs were generated with a global counter:
```typescript
let chunkIdCounter = 0;
function generateChunkId() {
  return `chunk-${++chunkIdCounter}`;  // Different on each parse!
}
```

When a session is re-parsed, different IDs are generated, breaking the connection with stored expansion state.

### Solution: Stable Chunk IDs Based on Message UUID

**File**: `src/main/services/ChunkBuilder.ts`

```typescript
function generateStableChunkId(prefix: string, message: ParsedMessage): string {
  return `${prefix}-${message.uuid}`;  // Always the same for same message
}
```

| Chunk Type | ID Format | Example |
|------------|-----------|---------|
| User | `user-{uuid}` | `user-abc123` |
| AI | `ai-{firstResponseUuid}` | `ai-def456` |
| System | `system-{uuid}` | `system-ghi789` |
| Compact | `compact-{uuid}` | `compact-jkl012` |

## React Key Stability

**File**: `src/renderer/utils/groupTransformer.ts`

All conversation items use stable chunk IDs as React keys:

```typescript
// Before (unstable)
id: `ai-${index}`  // Changes if items reorder

// After (stable)
id: chunk.id  // Same across refreshes
```

This ensures React only re-renders truly new items, not existing ones.

## Component Changes

### AIChatGroup.tsx

Before:
```typescript
const [isExpanded, setIsExpanded] = useState(...);  // Resets on re-render
```

After:
```typescript
const expandedAIGroupIds = useStore((s) => s.expandedAIGroupIds);
const toggleAIGroupExpansion = useStore((s) => s.toggleAIGroupExpansion);
const isExpanded = expandedAIGroupIds.has(aiGroup.id) || containsHighlightedError || shouldExpandForSearch;
```

### DisplayItemList.tsx / SubagentItem.tsx

Similar pattern - expansion state moved from local `useState` to Zustand store with `expandedDisplayItemIds`.

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ FileWatcher │───▶│  DataCache  │    │   IPC Send  │         │
│  │  (chokidar) │    │ (invalidate)│    │'file-change'│         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Preload Script                             │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  window.electronAPI.onFileChange(callback)             │     │
│  └───────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                            │
│  ┌─────────────────┐                                            │
│  │ Zustand Store   │                                            │
│  │ (listener in    │                                            │
│  │  initializeNotificationListeners)                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ├── type: 'add' ──▶ refreshSessionsInPlace()          │
│           │                                                      │
│           └── type: 'change' ──▶ refreshSessionInPlace()        │
│                                         │                        │
│                                         ▼                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UI Updates                                              │   │
│  │  - No loading states                                     │   │
│  │  - Expansion states preserved                            │   │
│  │  - Only new items rendered (stable keys)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

| File | Changes |
|------|---------|
| `src/preload/index.ts` | Added `onFileChange` listener |
| `src/renderer/types/data.ts` | Added `onFileChange` to `ElectronAPI` interface |
| `src/renderer/App.tsx` | Added `initializeNotificationListeners()` call |
| `src/renderer/store/index.ts` | Added refresh actions, expansion states, file-change listener |
| `src/renderer/components/chat/AIChatGroup.tsx` | Moved `isExpanded` to Zustand |
| `src/renderer/utils/groupTransformer.ts` | Use stable `chunk.id` for group IDs |
| `src/main/services/ChunkBuilder.ts` | Stable chunk ID generation using message UUID |

## Testing

### Test 1: Session Content Updates
1. Open a session in the app
2. Expand some AI groups and display items
3. In the terminal, append to the session file or wait for Claude to respond
4. Verify: Content updates without flickering, expansion states preserved

### Test 2: New Session Detection
1. Select a project to view its sessions list
2. Start a new Claude Code session in that project directory
3. Verify: New session appears in the list without full reload

### Test 3: Subagent Updates
1. Open a session with active Task/subagent
2. Watch as the subagent executes
3. Verify: Subagent content (thinking, tool calls) updates in real-time

## Performance Considerations

- **Debouncing**: 100ms debounce in FileWatcher prevents excessive updates
- **Conditional refresh**: Only refreshes if viewing the affected session
- **No loading states**: Avoids UI flicker during background refreshes
- **Stable keys**: React only re-renders new items, not existing ones
- **Cache invalidation**: DataCache is invalidated, ensuring fresh data on next fetch

## Future Improvements

1. **Incremental parsing**: Parse only new JSONL lines instead of full file
2. **Optimistic updates**: Show new content immediately before server confirms
3. **WebSocket alternative**: Consider WebSocket for lower latency than file watching
4. **Diff-based updates**: Send only changed chunks instead of full conversation
