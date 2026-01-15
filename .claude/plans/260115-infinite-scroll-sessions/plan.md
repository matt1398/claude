# Infinite Scroll + Virtual Scrolling for Sessions List

## Overview

Add cursor-based pagination with infinite scroll to the sessions list, using @tanstack/react-virtual for efficient DOM rendering. Priority is sessions list; projects list can follow the same pattern later.

## Files to Modify

| File | Changes |
|------|---------|
| `src/main/services/ProjectScanner.ts` | Add `listSessionsPaginated()` method |
| `src/main/ipc/handlers.ts` | Add `get-sessions-paginated` IPC handler |
| `src/preload/index.ts` | Add `getSessionsPaginated` to bridge |
| `src/renderer/types/data.ts` | Add `PaginatedSessionsResult` type |
| `src/renderer/store/index.ts` | Add pagination state and actions |
| `src/renderer/components/sidebar/DateGroupedSessions.tsx` | Rewrite with virtualization |

## Implementation Steps

### Phase 1: Backend API

**1.1 Add types** (in `src/main/types/claude.ts` or inline)

```typescript
interface PaginatedSessionsResult {
  sessions: Session[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

interface SessionCursor {
  timestamp: number;  // createdAt of last session
  sessionId: string;  // tie-breaker
}
```

**1.2 Add `listSessionsPaginated()` to `ProjectScanner.ts` (line ~250)**

Key approach:
1. Get all `.jsonl` files in project dir (lightweight - just directory listing)
2. Get file stats for sorting (stat calls only, no JSONL parsing yet)
3. Sort by `birthtimeMs` descending
4. Apply cursor filter to find start index
5. Fetch only needed sessions (page size + buffer for noise filtering)
6. Build next cursor from last session

```typescript
async listSessionsPaginated(
  projectId: string,
  cursor: string | null,
  limit: number = 20
): Promise<PaginatedSessionsResult>
```

**1.3 Add IPC handler** in `handlers.ts` (after line 69)

```typescript
ipcMain.handle('get-sessions-paginated', handleGetSessionsPaginated);
```

### Phase 2: Preload Bridge

**2.1 Update `src/preload/index.ts`**

```typescript
getSessionsPaginated: (projectId: string, cursor: string | null, limit?: number) =>
  ipcRenderer.invoke('get-sessions-paginated', projectId, cursor, limit),
```

### Phase 3: Type Definitions

**3.1 Add to `src/renderer/types/data.ts`**

- Add `PaginatedSessionsResult` interface
- Update `ElectronAPI` interface with new method

### Phase 4: Zustand Store

**4.1 Add pagination state** (in `src/renderer/store/index.ts`)

```typescript
// New state
sessionsCursor: string | null;
sessionsHasMore: boolean;
sessionsTotalCount: number;
sessionsLoadingMore: boolean;

// New actions
fetchSessionsInitial: (projectId: string) => Promise<void>;
fetchSessionsMore: () => Promise<void>;
resetSessionsPagination: () => void;
```

**4.2 Update `selectProject`** to call `fetchSessionsInitial` instead of `fetchSessions`

### Phase 5: Virtual Scrolling Component

**5.1 Rewrite `DateGroupedSessions.tsx`** with @tanstack/react-virtual

Key changes:
- Flatten sessions with date headers into single virtual list
- Use `useVirtualizer` hook with parent ref
- Estimate sizes: headers = 32px, sessions = 88px
- Trigger `fetchSessionsMore()` when scrolling near end
- Render loader row when `sessionsHasMore` is true

Virtual item types:
```typescript
type VirtualItem =
  | { type: 'header'; category: DateCategory; id: string }
  | { type: 'session'; session: Session; id: string };
```

## Configuration

| Constant | Value | Rationale |
|----------|-------|-----------|
| `SESSIONS_PAGE_SIZE` | 20 | Balance between load time and scroll smoothness |
| `SESSIONS_OVERSCAN` | 5 | Pre-render items for smooth scrolling |
| `SESSION_ITEM_HEIGHT` | 88px | Match current SessionItem height |
| `HEADER_ITEM_HEIGHT` | 32px | Match current date header height |

## Verification

1. **Initial load**: First 20 sessions render with date headers
2. **Scroll to bottom**: Triggers load more, appends new sessions
3. **Date headers**: Remain visible as you scroll through groups
4. **Project change**: Resets pagination, loads fresh data
5. **Error handling**: Shows inline error, doesn't break UI
6. **Empty state**: "No sessions found" when project has no sessions
7. **Loading states**: Skeletons on initial, spinner on load more

### Test Commands

```bash
npm run dev        # Start dev server
npm run typecheck  # Verify types
```

Manual testing:
1. Open app, select project with 50+ sessions
2. Observe initial load only shows ~20 sessions
3. Scroll down, verify more sessions load automatically
4. Switch projects, verify list resets
5. Check fast scrolling doesn't cause duplicate loads

## Future Work (Out of Scope)

- Projects list pagination (same pattern)
- Session detail pagination for large conversations
- Scroll position restoration when returning to list