# Tasks: Tabbed Layout with Project-Centric Sidebar and Dashboard

**Input**: Design documents from `/specs/001-tabbed-layout-dashboard/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/tab-state.ts, research.md, quickstart.md

**Tests**: Not explicitly requested in specification. Test tasks not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Electron app**: `src/renderer/` for React components, `src/main/` for main process
- Store: `src/renderer/store/index.ts`
- Components: `src/renderer/components/`
- Utils: `src/renderer/utils/`
- Types: `src/renderer/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and utility functions that all user stories depend on

- [ ] T001 Create Tab type definitions in src/renderer/types/tabs.ts
- [ ] T002 [P] Create greeting utility function in src/renderer/utils/greeting.ts
- [ ] T003 [P] Create date grouping utility function in src/renderer/utils/dateGrouping.ts

---

## Phase 2: Foundational (State Management)

**Purpose**: Extend Zustand store with tab and project context slices - MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add TabSlice interface and state to src/renderer/store/index.ts (openTabs, activeTabId)
- [ ] T005 Implement openTab action with duplicate prevention in src/renderer/store/index.ts
- [ ] T006 Implement closeTab action with adjacent tab focus logic in src/renderer/store/index.ts
- [ ] T007 Implement setActiveTab and openDashboard actions in src/renderer/store/index.ts
- [ ] T008 Add activeProjectId state and setActiveProject action in src/renderer/store/index.ts

**Checkpoint**: Store foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Dashboard on App Launch (Priority: P1) 🎯 MVP

**Goal**: Display welcoming dashboard with greeting, quick actions, and recent projects grid on app launch

**Independent Test**: Launch app fresh → verify dashboard displays with time-appropriate greeting, action buttons, and project grid

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create GreetingBanner component in src/renderer/components/dashboard/GreetingBanner.tsx
- [ ] T010 [P] [US1] Create QuickActions component with keyboard shortcut hints in src/renderer/components/dashboard/QuickActions.tsx
- [ ] T011 [P] [US1] Create RecentProjectsGrid component in src/renderer/components/dashboard/RecentProjectsGrid.tsx
- [ ] T012 [US1] Create DashboardView container component in src/renderer/components/dashboard/DashboardView.tsx
- [ ] T013 [US1] Create TabbedLayout shell with conditional dashboard/session rendering in src/renderer/components/layout/TabbedLayout.tsx
- [ ] T014 [US1] Update App.tsx to use TabbedLayout instead of ThreePanelLayout

**Checkpoint**: Dashboard displays on app launch with greeting, actions, and projects

---

## Phase 4: User Story 2 - macOS Window Integration (Priority: P1)

**Goal**: Proper traffic light spacing and draggable window header on macOS

**Independent Test**: On macOS, verify traffic lights visible without overlap, window draggable from header, buttons still clickable

### Implementation for User Story 2

- [ ] T015 [P] [US2] Create SidebarHeader component with drag region and traffic light spacing in src/renderer/components/layout/SidebarHeader.tsx
- [ ] T016 [US2] Create Sidebar container component in src/renderer/components/layout/Sidebar.tsx
- [ ] T017 [US2] Integrate SidebarHeader into TabbedLayout in src/renderer/components/layout/TabbedLayout.tsx
- [ ] T018 [US2] Add CSS for -webkit-app-region: drag and no-drag zones in src/renderer/index.css

**Checkpoint**: macOS window integration complete - traffic lights visible, window draggable

---

## Phase 5: User Story 3 - Switch Between Projects (Priority: P1)

**Goal**: Project dropdown in sidebar to switch active project context

**Independent Test**: Click project dropdown → select different project → session list updates to show only that project's sessions

### Implementation for User Story 3

- [ ] T019 [P] [US3] Create ProjectDropdown component in src/renderer/components/sidebar/ProjectDropdown.tsx
- [ ] T020 [US3] Integrate ProjectDropdown into SidebarHeader in src/renderer/components/layout/SidebarHeader.tsx
- [ ] T021 [US3] Connect ProjectDropdown to store's setActiveProject action in src/renderer/components/sidebar/ProjectDropdown.tsx
- [ ] T022 [US3] Filter sessions by activeProjectId in Sidebar component in src/renderer/components/layout/Sidebar.tsx

**Checkpoint**: Project switching works - dropdown shows projects, selection filters sessions

---

## Phase 6: User Story 4 - Open Sessions in Tabs (Priority: P2)

**Goal**: Click session → opens in tab, tab management (focus, close, deduplication)

**Independent Test**: Click multiple sessions → each opens in new tab. Click same session → focuses existing tab. Close tab → adjacent tab focuses.

### Implementation for User Story 4

- [ ] T023 [P] [US4] Create SessionItem component in src/renderer/components/sidebar/SessionItem.tsx
- [ ] T024 [P] [US4] Create TabBar component with tabs, close buttons, and new tab button in src/renderer/components/layout/TabBar.tsx
- [ ] T025 [US4] Wire SessionItem click to store's openTab action in src/renderer/components/sidebar/SessionItem.tsx
- [ ] T026 [US4] Integrate TabBar into TabbedLayout in src/renderer/components/layout/TabbedLayout.tsx
- [ ] T027 [US4] Implement session content rendering when tab is active in src/renderer/components/layout/TabbedLayout.tsx
- [ ] T028 [US4] Add tab close and focus handlers to TabBar in src/renderer/components/layout/TabBar.tsx

**Checkpoint**: Tabbed interface works - sessions open in tabs, tabs can be switched and closed

---

## Phase 7: User Story 5 - Navigate Session List by Date Groups (Priority: P2)

**Goal**: Sessions grouped by Today, Yesterday, Previous 7 Days, Older

**Independent Test**: Sessions from different dates appear under correct group headers

### Implementation for User Story 5

- [ ] T029 [P] [US5] Create DateGroupedSessions component in src/renderer/components/sidebar/DateGroupedSessions.tsx
- [ ] T030 [US5] Integrate dateGrouping utility into DateGroupedSessions in src/renderer/components/sidebar/DateGroupedSessions.tsx
- [ ] T031 [US5] Replace inline session list in Sidebar with DateGroupedSessions in src/renderer/components/layout/Sidebar.tsx

**Checkpoint**: Sessions appear grouped by date with proper headers

---

## Phase 8: User Story 6 - Return to Dashboard from Tabs (Priority: P3)

**Goal**: New tab button opens dashboard, closing all tabs shows dashboard

**Independent Test**: With sessions open, click "+" → dashboard tab opens. Close all tabs → dashboard displays.

### Implementation for User Story 6

- [ ] T032 [US6] Wire new tab button to openDashboard action in src/renderer/components/layout/TabBar.tsx
- [ ] T033 [US6] Ensure TabbedLayout shows dashboard when activeTabId is null in src/renderer/components/layout/TabbedLayout.tsx

**Checkpoint**: Users can always return to dashboard via new tab or closing all tabs

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, empty states, and refinements

- [ ] T034 [P] Add empty state for no projects in DashboardView in src/renderer/components/dashboard/DashboardView.tsx
- [ ] T035 [P] Add empty state for no sessions in DateGroupedSessions in src/renderer/components/sidebar/DateGroupedSessions.tsx
- [ ] T036 [P] Add tooltip for truncated project names in ProjectDropdown in src/renderer/components/sidebar/ProjectDropdown.tsx
- [ ] T037 Add horizontal scroll for tab overflow in TabBar in src/renderer/components/layout/TabBar.tsx
- [ ] T038 Add error state handling for deleted session files in TabbedLayout in src/renderer/components/layout/TabbedLayout.tsx
- [ ] T039 Run typecheck and fix any TypeScript errors
- [ ] T040 Validate implementation against quickstart.md test checkpoints

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 types - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Phase 2 completion
  - US1, US2, US3 are P1 priority - complete in order or parallel
  - US4, US5 are P2 priority - start after P1 stories
  - US6 is P3 priority - start after P2 stories
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Parallelize With |
|-------|----------|--------------|---------------------|
| US1 (Dashboard) | P1 | Phase 2 only | US2, US3 |
| US2 (macOS) | P1 | Phase 2 only | US1, US3 |
| US3 (Project Switch) | P1 | Phase 2 only | US1, US2 |
| US4 (Tabs) | P2 | Phase 2 + US1 (for TabbedLayout) | US5 |
| US5 (Date Groups) | P2 | Phase 2 + US3 (for Sidebar) | US4 |
| US6 (Return to Dashboard) | P3 | US1 + US4 | None |

### Parallel Opportunities by Phase

**Phase 1 (Setup)**:
```
Parallel: T002, T003 (different utility files)
```

**Phase 3 (US1 - Dashboard)**:
```
Parallel: T009, T010, T011 (different component files)
```

**Phase 4 (US2 - macOS)**:
```
Sequential: T015 → T016 → T017 → T018
```

**Phase 5 (US3 - Project Switch)**:
```
T019 parallel → then T020, T021, T022 sequential
```

**Phase 6 (US4 - Tabs)**:
```
Parallel: T023, T024 (different files)
Then sequential: T025 → T026 → T027 → T028
```

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch all dashboard components together:
Task: "Create GreetingBanner component in src/renderer/components/dashboard/GreetingBanner.tsx"
Task: "Create QuickActions component in src/renderer/components/dashboard/QuickActions.tsx"
Task: "Create RecentProjectsGrid component in src/renderer/components/dashboard/RecentProjectsGrid.tsx"

# Then sequentially:
Task: "Create DashboardView container in src/renderer/components/dashboard/DashboardView.tsx"
Task: "Create TabbedLayout shell in src/renderer/components/layout/TabbedLayout.tsx"
Task: "Update App.tsx to use TabbedLayout"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types and utilities)
2. Complete Phase 2: Foundational (store extensions)
3. Complete Phase 3: User Story 1 (Dashboard)
4. **STOP and VALIDATE**: Launch app, verify dashboard displays
5. Deploy/demo if ready - users see welcoming zero-state

### Incremental Delivery

1. **Setup + Foundational** → Foundation ready
2. **Add US1 (Dashboard)** → App launches with dashboard (MVP!)
3. **Add US2 (macOS)** → Native window integration
4. **Add US3 (Project Switch)** → Project-focused navigation
5. **Add US4 (Tabs)** → Multi-session workflows
6. **Add US5 (Date Groups)** → Better session discovery
7. **Add US6 (Return to Dashboard)** → Navigation consistency
8. **Polish** → Edge cases and refinements

### Task Count Summary

| Phase | Story | Task Count |
|-------|-------|------------|
| Phase 1 | Setup | 3 |
| Phase 2 | Foundational | 5 |
| Phase 3 | US1 (Dashboard) | 6 |
| Phase 4 | US2 (macOS) | 4 |
| Phase 5 | US3 (Project Switch) | 4 |
| Phase 6 | US4 (Tabs) | 6 |
| Phase 7 | US5 (Date Groups) | 3 |
| Phase 8 | US6 (Return to Dashboard) | 2 |
| Phase 9 | Polish | 7 |
| **Total** | | **40** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- ThreePanelLayout preserved for reference - do not delete until migration verified
