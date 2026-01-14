# Quickstart Guide: Tabbed Layout with Dashboard

**Branch**: `001-tabbed-layout-dashboard`
**Date**: 2026-01-14

---

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- macOS for full testing (Windows/Linux for partial)

## Setup

```bash
# Switch to feature branch
git checkout 001-tabbed-layout-dashboard

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

---

## Implementation Order

Follow this sequence to build the feature incrementally:

### Phase 1: State Foundation

1. **Extend Zustand Store** (`src/renderer/store/index.ts`)
   - Add `TabSlice` state and actions
   - Add `activeProjectId` to existing state
   - Implement `openTab`, `closeTab`, `setActiveTab`, `openDashboard`

2. **Add Type Definitions** (`src/renderer/types/tabs.ts`)
   - Copy interfaces from `specs/001-tabbed-layout-dashboard/contracts/tab-state.ts`
   - Export from types index

3. **Create Utility Functions**
   - `src/renderer/utils/dateGrouping.ts` - Session grouping by date
   - `src/renderer/utils/greeting.ts` - Time-based greeting

### Phase 2: Layout Components

4. **Create Sidebar Components**
   - `SidebarHeader.tsx` - Drag region + project dropdown
   - `ProjectDropdown.tsx` - Project switcher
   - `DateGroupedSessions.tsx` - Sessions by date category
   - `SessionItem.tsx` - Individual session row

5. **Create Tab Components**
   - `TabBar.tsx` - Tab strip with close buttons
   - `TabbedLayout.tsx` - Main layout container

6. **Create Dashboard Components**
   - `DashboardView.tsx` - Main dashboard container
   - `GreetingBanner.tsx` - Time-based greeting
   - `QuickActions.tsx` - Action buttons
   - `RecentProjectsGrid.tsx` - Project cards

### Phase 3: Integration

7. **Update App.tsx**
   - Replace `ThreePanelLayout` with `TabbedLayout`

8. **Wire Up Interactions**
   - Session click → opens tab
   - Tab click → focuses content
   - Close button → closes tab
   - Project dropdown → filters sessions

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Store extension | `src/renderer/store/index.ts` |
| Tab types | `src/renderer/types/tabs.ts` |
| Main layout | `src/renderer/components/layout/TabbedLayout.tsx` |
| Tab bar | `src/renderer/components/layout/TabBar.tsx` |
| Sidebar | `src/renderer/components/layout/Sidebar.tsx` |
| Dashboard | `src/renderer/components/dashboard/DashboardView.tsx` |
| Date grouping | `src/renderer/utils/dateGrouping.ts` |

---

## Testing Checkpoints

### After Phase 1 (State)
```bash
# Type check passes
pnpm typecheck

# Manual test: Open console, verify store has new state
# In DevTools: useStore.getState().openTabs should be []
```

### After Phase 2 (Components)
```bash
# Build succeeds
pnpm build

# Manual tests:
# - Sidebar header has ~40px top padding
# - Window is draggable from header
# - Project dropdown opens/closes
# - Session items are grouped by date
```

### After Phase 3 (Integration)
```bash
# Full manual test:
# 1. Launch app → Dashboard appears
# 2. Click session → Tab opens, content shows
# 3. Click another session → Second tab opens
# 4. Click same session → Focuses existing tab (no duplicate)
# 5. Close tab → Adjacent tab focuses
# 6. Close all tabs → Dashboard appears
# 7. Switch project → Session list updates
```

---

## Common Issues

### macOS Traffic Lights Overlap
**Symptom**: Close/minimize/maximize buttons overlap content
**Fix**: Ensure `SidebarHeader` has `padding-top: 40px` or `h-10` spacer div

### Drag Region Not Working
**Symptom**: Window won't drag from header
**Fix**: Check `-webkit-app-region: drag` is applied, and buttons have `no-drag`

### Tab Duplicates
**Symptom**: Same session opens multiple tabs
**Fix**: Verify `openTab` checks for existing `sessionId` before creating

### Sessions Not Filtering
**Symptom**: Switching projects doesn't update session list
**Fix**: Ensure `activeProjectId` is used in session list selector

---

## Development Tips

1. **Hot Reload**: electron-vite supports HMR for renderer changes
2. **DevTools**: Use React DevTools to inspect Zustand state
3. **CSS Debug**: Add `outline: 1px solid red` to verify drag regions
4. **Logging**: Add `console.log` in store actions during development

---

## Reference Documents

- [spec.md](./spec.md) - Feature requirements
- [plan.md](./plan.md) - Implementation plan
- [research.md](./research.md) - Technical decisions
- [data-model.md](./data-model.md) - Entity definitions
- [contracts/tab-state.ts](./contracts/tab-state.ts) - TypeScript interfaces
