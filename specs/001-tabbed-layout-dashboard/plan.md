# Implementation Plan: Tabbed Layout with Project-Centric Sidebar and Dashboard

**Branch**: `001-tabbed-layout-dashboard` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-tabbed-layout-dashboard/spec.md`

## Summary

This feature restructures the application layout from a three-panel fixed view to a project-centric tabbed interface with a zero-state dashboard. The primary requirements are:

1. **Dashboard View**: A welcoming landing page with time-based greeting, quick actions, and recent projects grid
2. **Tabbed Interface**: Multiple sessions open simultaneously in tabs, with tab management (open, close, focus)
3. **Project-Centric Sidebar**: Project dropdown switcher with date-grouped session list
4. **macOS Native Integration**: Proper traffic light spacing and drag region handling

Technical approach uses Zustand for tab/project state management, refactors the existing `ThreePanelLayout` into a new `TabbedLayout` with conditional rendering based on active tab state.

## Technical Context

**Language/Version**: TypeScript 5.5, React 18.3, Node.js (Electron 28.x main process)
**Primary Dependencies**: Zustand 4.5 (state), React 18.3 (UI), Tailwind CSS 3.4 (styling), Lucide React (icons), date-fns 3.6 (date grouping)
**Storage**: N/A (state is in-memory via Zustand; session data comes from existing IPC handlers)
**Testing**: `tsx` runner with custom test scripts (`npm run test:chunks`)
**Target Platform**: macOS (primary), Windows/Linux (secondary) - Electron desktop app
**Project Type**: Electron application with main/preload/renderer architecture
**Performance Goals**: Dashboard loads <500ms, tab switch <200ms, session list renders <100ms (virtual scrolling already available)
**Constraints**: Must integrate with existing session/project data layer, maintain compatibility with current chat view components
**Scale/Scope**: Typical user has 5-20 projects, 10-50 sessions per project, 1-10 open tabs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Code Quality First | TypeScript strict mode, no `any`, explicit interfaces | PASS | New components will follow existing patterns with strict typing |
| I. Code Quality First | Single responsibility per service | PASS | Tab state separate from session detail state in store |
| II. Testing Standards | Critical logic must have tests | PASS | Date grouping utility will have unit tests |
| III. UX Consistency | Use `claude-dark-*` tokens, loading/error/empty states | PASS | Dashboard and tabs will use established theme |
| III. UX Consistency | Visible focus states, smooth transitions | PASS | Tab focus and transitions will follow accessibility patterns |
| IV. Performance | Initial render <500ms | PASS | Dashboard only loads project list (already cached) |
| IV. Performance | Virtual scrolling for 100+ items | PASS | Session list already uses virtual scrolling patterns |

**Pre-Commit Gates:**
- `npm run typecheck` must pass
- New components must use `claude-dark-*` color tokens
- Tab state logic must be unit testable

**No Constitution Violations Identified.**

## Project Structure

### Documentation (this feature)

```text
specs/001-tabbed-layout-dashboard/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: State/entity models
├── quickstart.md        # Phase 1: Development guide
├── contracts/           # Phase 1: Interface contracts
│   └── tab-state.ts     # Tab state interface contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── main/                          # Main process (unchanged for this feature)
│   ├── index.ts
│   ├── ipc/handlers.ts
│   ├── services/
│   │   ├── ProjectScanner.ts
│   │   ├── SessionParser.ts
│   │   ├── ChunkBuilder.ts
│   │   └── ...
│   └── types/claude.ts
│
├── preload/
│   └── index.ts                   # (unchanged)
│
└── renderer/
    ├── App.tsx                    # Updated: Switch from ThreePanelLayout to TabbedLayout
    ├── store/
    │   └── index.ts               # Extended: Add tab slice and project context slice
    │
    ├── components/
    │   ├── layout/
    │   │   ├── ThreePanelLayout.tsx    # Preserved for reference/migration
    │   │   ├── TabbedLayout.tsx        # NEW: Main layout with sidebar + tabbed content
    │   │   ├── TabBar.tsx              # NEW: Tab strip with close buttons and new tab
    │   │   ├── Sidebar.tsx             # NEW: Project dropdown + date-grouped sessions
    │   │   ├── SidebarHeader.tsx       # NEW: Drag region + project switcher
    │   │   ├── MiddlePanel.tsx         # Preserved (used within tabs)
    │   │   └── RightPanel.tsx          # Preserved (used within tabs)
    │   │
    │   ├── dashboard/
    │   │   ├── DashboardView.tsx       # NEW: Zero-state dashboard
    │   │   ├── GreetingBanner.tsx      # NEW: Time-based greeting
    │   │   ├── QuickActions.tsx        # NEW: Action buttons with shortcuts
    │   │   └── RecentProjectsGrid.tsx  # NEW: Project cards grid
    │   │
    │   ├── sidebar/
    │   │   ├── ProjectDropdown.tsx     # NEW: Project switcher dropdown
    │   │   ├── DateGroupedSessions.tsx # NEW: Sessions grouped by date
    │   │   └── SessionItem.tsx         # NEW: Single session list item
    │   │
    │   ├── projects/
    │   │   └── ProjectsList.tsx        # Preserved (may be deprecated post-migration)
    │   ├── sessions/
    │   │   └── SessionsList.tsx        # Preserved (base for DateGroupedSessions)
    │   ├── chat/                       # Preserved (rendered inside tabs)
    │   ├── gantt/                      # Preserved (rendered inside tabs)
    │   └── detail/                     # Preserved (rendered inside tabs)
    │
    ├── utils/
    │   ├── dateGrouping.ts             # NEW: Group sessions by Today/Yesterday/etc
    │   └── greeting.ts                 # NEW: Time-based greeting logic
    │
    └── types/
        ├── data.ts                     # Extended: Tab and AppContext types
        └── groups.ts                   # Preserved
```

**Structure Decision**: Electron single-project structure maintained. New components added under `renderer/components/` following existing patterns. Store extended with new slices rather than replaced.

## Complexity Tracking

> No Constitution violations requiring justification.

| Area | Approach | Rationale |
|------|----------|-----------|
| Tab State | Single Zustand slice | Keeps tab logic co-located and testable |
| Date Grouping | Utility function + memoization | Pure function, easy to test, no external deps |
| macOS Integration | CSS `-webkit-app-region` | Standard Electron pattern, no native code |
