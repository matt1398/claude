# Research Findings: Tabbed Layout with Dashboard

**Date**: 2026-01-14
**Branch**: `001-tabbed-layout-dashboard`
**Purpose**: Resolve technical unknowns before implementation

---

## 1. Electron Frameless Windows with macOS Integration

### Decision: Use `titleBarStyle: 'hidden'` with implicit traffic light reservation

### Rationale
- Most compatible approach for Electron 28.x
- Native macOS behavior preserved
- Traffic lights remain visible and functional
- Minimal code complexity compared to `customButtonsOnHover`

### Implementation

**Main Process (BrowserWindow configuration):**
```typescript
const mainWindow = new BrowserWindow({
  frame: false,
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 16, y: 12 }, // Default position
  show: false, // Prevent white flash
  backgroundColor: '#1a1a1a',
  // ... other options
});
```

**Renderer (CSS for drag regions):**
```css
/* Draggable header container */
.sidebar-header {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  height: 40px;
  padding-left: 70px; /* Reserve space for traffic lights */
}

/* Interactive elements must be no-drag */
.sidebar-header button,
.sidebar-header .dropdown {
  -webkit-app-region: no-drag;
  cursor: pointer;
}
```

### Key Constraints
- Only rectangular drag regions supported
- Buttons on drag regions won't fire click events unless explicitly set to `no-drag`
- DevTools open can break drag behavior (use detached mode for dev)
- Text selection conflict: use `-webkit-user-select: none` on drag regions

### Alternatives Considered
| Approach | Rejected Because |
|----------|------------------|
| `hiddenInset` | Forced toolbar-like appearance, less flexible |
| `customButtonsOnHover` | Hides controls until hover, reduces discoverability |
| Custom traffic lights | More code, accessibility concerns, must replicate Electron logic |

---

## 2. Tab State Management with Zustand

### Decision: Array + activeTabId pattern with content-based deduplication

### Rationale
- Preserves tab order (important for sequential access)
- Simple O(1) lookup for active tab
- Content-based deduplication matches user mental model
- No need for persistence (in-memory is sufficient for this app)

### Implementation

**Tab State Interface:**
```typescript
interface Tab {
  id: string;              // Unique identifier
  type: 'session' | 'dashboard';
  sessionId?: string;      // For session tabs
  projectId?: string;      // For session tabs
  label: string;           // Display name
}

interface TabSlice {
  openTabs: Tab[];
  activeTabId: string | null;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  openDashboard: () => void;
}
```

**Key Actions:**
```typescript
openTab: (tab) => {
  // Duplicate prevention by sessionId
  const existing = openTabs.find(t =>
    t.type === 'session' && t.sessionId === tab.sessionId
  );
  if (existing) {
    set({ activeTabId: existing.id });
    return;
  }
  set({
    openTabs: [...openTabs, tab],
    activeTabId: tab.id
  });
},

closeTab: (tabId) => {
  const index = openTabs.findIndex(t => t.id === tabId);
  const newTabs = openTabs.filter(t => t.id !== tabId);

  // Focus adjacent tab or dashboard
  let newActiveId = activeTabId;
  if (activeTabId === tabId) {
    newActiveId = newTabs[index]?.id || newTabs[index - 1]?.id || null;
  }

  set({ openTabs: newTabs, activeTabId: newActiveId });
}
```

### Alternatives Considered
| Approach | Rejected Because |
|----------|------------------|
| Redux Toolkit | Overkill for this use case, Zustand already in codebase |
| Map/object structure | Loses tab order which is important for UX |
| localStorage persistence | Not needed - session tabs are transient |

---

## 3. Date-Based Session Grouping

### Decision: Array.reduce with pre-calculated boundaries using date-fns

### Rationale
- Maximum browser compatibility
- Pre-calculating "today", "yesterday", etc. boundaries avoids repeated calculation
- `isToday()` and `isYesterday()` from date-fns are reliable and well-tested
- No timezone complexity needed (client-side only, local time is correct)

### Implementation

**Grouping Utility:**
```typescript
import { isToday, isYesterday, differenceInDays, startOfDay } from 'date-fns';

type DateCategory = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

interface GroupedSessions {
  Today: Session[];
  Yesterday: Session[];
  'Previous 7 Days': Session[];
  Older: Session[];
}

function groupSessionsByDate(sessions: Session[]): GroupedSessions {
  // Pre-calculate boundaries once
  const now = new Date();

  return sessions.reduce<GroupedSessions>(
    (acc, session) => {
      const sessionDate = new Date(session.createdAt);

      if (isToday(sessionDate)) {
        acc.Today.push(session);
      } else if (isYesterday(sessionDate)) {
        acc.Yesterday.push(session);
      } else if (differenceInDays(now, sessionDate) <= 7) {
        acc['Previous 7 Days'].push(session);
      } else {
        acc.Older.push(session);
      }

      return acc;
    },
    { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] }
  );
}
```

**Memoization Strategy:**
```typescript
// In component, memoize grouping result
const groupedSessions = useMemo(
  () => groupSessionsByDate(sessions),
  [sessions]
);
```

### Performance Considerations
- For 50-100 sessions (typical): No optimization needed
- For 500+ sessions: Consider memoization + virtual scrolling
- Current codebase already uses `@tanstack/react-virtual` - reuse for long lists

### Alternatives Considered
| Approach | Rejected Because |
|----------|------------------|
| `Object.groupBy` | Limited browser support (Chrome 117+, Safari 17.2+) |
| Manual date parsing | Error-prone, date-fns already in dependencies |
| Server-side grouping | Adds IPC complexity, client-side is fast enough |

---

## 4. Dashboard Component Patterns

### Decision: Time-based greeting with simple hour-based logic

### Rationale
- Straightforward implementation
- No external dependencies needed
- Matches user expectations from Linear/Notion style apps

### Implementation

**Greeting Utility:**
```typescript
type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  return 'Evening';
}

function getGreeting(): string {
  return `Good ${getTimeOfDay()}`;
}
```

**Quick Actions Pattern:**
```typescript
interface QuickAction {
  label: string;
  shortcut: string;
  icon: React.ComponentType;
  action: () => void;
}

const quickActions: QuickAction[] = [
  {
    label: 'New Session',
    shortcut: '⌘N',
    icon: PlusIcon,
    action: () => { /* handled by keyboard listener */ }
  },
  // ...
];
```

### Project Card Design
- Minimalist zinc-900 background with subtle border
- Project name (primary text)
- Path (secondary text, truncated)
- Last opened time (relative format using date-fns `formatDistanceToNow`)

---

## 5. Integration with Existing Codebase

### State Integration Strategy

The existing Zustand store at `src/renderer/store/index.ts` will be extended, not replaced:

**Current State (preserve):**
- `projects`, `projectsLoading`, `projectsError`
- `sessions`, `sessionsLoading`, `sessionsError`
- `sessionDetail`, `sessionDetailLoading`, `sessionDetailError`
- All existing actions (`fetchProjects`, `selectProject`, etc.)

**New State (add):**
- `activeProjectId` (context for sidebar filtering)
- `openTabs`, `activeTabId` (tab management)
- Tab actions (`openTab`, `closeTab`, `setActiveTab`, `openDashboard`)

### Component Reuse

| Existing Component | Reuse Strategy |
|-------------------|----------------|
| `MiddlePanel` | Wrap in tab content area, no changes needed |
| `RightPanel` | Include within session tab view |
| `ChatHistory` | Render inside session tabs |
| `SessionsList` | Base for `DateGroupedSessions`, extract logic |

### Layout Transition

```
Current: ThreePanelLayout (fixed 3-column)
    └── ProjectsList + SessionsList | MiddlePanel | RightPanel

New: TabbedLayout
    └── Sidebar (project dropdown + date-grouped sessions)
        └── TabBar + ContentArea
            └── IF dashboard tab: DashboardView
            └── IF session tab: MiddlePanel + RightPanel
```

---

## Summary

All technical unknowns resolved. No clarification needed from specification. Ready to proceed to Phase 1 (data model and contracts).
