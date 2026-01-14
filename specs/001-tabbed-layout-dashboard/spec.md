# Feature Specification: Tabbed Layout with Project-Centric Sidebar and Dashboard

**Feature Branch**: `001-tabbed-layout-dashboard`
**Created**: 2026-01-14
**Status**: Draft
**Input**: User description: "Restructure application layout to support Project > Session hierarchy with Tabbed Interface and implement premium Zero State Dashboard with macOS native integration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Dashboard on App Launch (Priority: P1)

When a user opens the application or creates a new tab, they should see a welcoming dashboard view that provides quick access to recent projects and common actions, rather than a blank or confusing state.

**Why this priority**: The dashboard is the first thing users see. A polished, functional zero-state experience establishes trust and provides immediate value. Without this, users face a confusing empty state.

**Independent Test**: Can be fully tested by launching the application fresh and verifying the dashboard displays with greeting, quick actions, and recent projects grid. Delivers immediate value by making project discovery intuitive.

**Acceptance Scenarios**:

1. **Given** the application is launched for the first time, **When** the main view loads, **Then** the dashboard displays with a time-appropriate greeting (e.g., "Good Morning"), quick action buttons, and a grid of recent projects
2. **Given** the user has opened multiple sessions in tabs, **When** the user clicks "New Tab" button, **Then** a new tab opens showing the dashboard view
3. **Given** the dashboard is displayed, **When** the user clicks a project card in the recent projects grid, **Then** that project becomes active and its sessions appear in the sidebar

---

### User Story 2 - macOS Window Integration (Priority: P1)

As a macOS user, I need the application window to integrate properly with macOS traffic lights (close/minimize/maximize buttons) so I can use native window controls and drag the window without conflicts.

**Why this priority**: Without proper macOS integration, the app is unusable on macOS - traffic lights overlap content, and the window cannot be dragged. This is a critical blocker for macOS users.

**Independent Test**: Can be fully tested on macOS by verifying traffic lights are visible and functional in the top-left, and the window can be dragged by the header area. Delivers native desktop experience.

**Acceptance Scenarios**:

1. **Given** the app is running on macOS, **When** the sidebar header loads, **Then** the traffic lights are fully visible without overlapping any content
2. **Given** the app is running on macOS, **When** the user clicks and drags the header area (top of sidebar), **Then** the entire window moves accordingly
3. **Given** the app is running on macOS, **When** the user clicks on a button within the header area, **Then** the click registers on the button (not as a drag action)

---

### User Story 3 - Switch Between Projects (Priority: P1)

As a user working across multiple projects, I need to quickly switch the active project context so I can focus on sessions relevant to my current work.

**Why this priority**: Project switching is a core navigation action. Users typically work on one project at a time but may have sessions from multiple projects open. Easy switching is essential for workflow efficiency.

**Independent Test**: Can be fully tested by clicking the project dropdown, selecting a different project, and verifying the session list updates. Delivers clear project-focused navigation.

**Acceptance Scenarios**:

1. **Given** a project is currently selected, **When** the user clicks the project dropdown in the sidebar header, **Then** a list of all available projects appears
2. **Given** the project dropdown is open, **When** the user selects a different project, **Then** the sidebar session list updates to show only sessions from the newly selected project
3. **Given** the user switches projects, **When** the session list updates, **Then** the previously active project's sessions are no longer visible in the sidebar (but open tabs remain)

---

### User Story 4 - Open Sessions in Tabs (Priority: P2)

As a user analyzing multiple sessions, I need to open sessions in tabs so I can compare and switch between them without losing context.

**Why this priority**: Tabbed interface enables multi-session workflows. While users can function with single-session view, tabs significantly improve productivity when investigating related sessions.

**Independent Test**: Can be fully tested by clicking multiple sessions in the sidebar and verifying each opens in a new tab. Delivers multi-session workflow capability.

**Acceptance Scenarios**:

1. **Given** the user is viewing the dashboard, **When** they click a session in the sidebar, **Then** that session opens in a new tab and becomes the active tab
2. **Given** a session is already open in a tab, **When** the user clicks the same session in the sidebar, **Then** the existing tab is focused (no duplicate tab created)
3. **Given** multiple tabs are open, **When** the user clicks a different tab, **Then** the content area switches to show that tab's session
4. **Given** a tab is open, **When** the user clicks the close button on the tab, **Then** the tab closes and the next available tab (or dashboard) becomes active

---

### User Story 5 - Navigate Session List by Date Groups (Priority: P2)

As a user looking for a specific session, I need sessions grouped by date (Today, Yesterday, Previous 7 Days, Older) so I can quickly locate recent work.

**Why this priority**: Date-grouped sessions improve discoverability and match mental models of "when did I work on this?" Common pattern in modern productivity apps.

**Independent Test**: Can be fully tested by having sessions from multiple dates and verifying they appear under correct date group headers. Delivers organized session discovery.

**Acceptance Scenarios**:

1. **Given** sessions exist from today, **When** the session list loads, **Then** today's sessions appear under a "Today" header
2. **Given** sessions exist from yesterday, **When** the session list loads, **Then** yesterday's sessions appear under a "Yesterday" header
3. **Given** sessions exist from the past week, **When** the session list loads, **Then** those sessions appear under a "Previous 7 Days" header
4. **Given** sessions exist from more than 7 days ago, **When** the session list loads, **Then** those sessions appear under an "Older" header

---

### User Story 6 - Return to Dashboard from Tabs (Priority: P3)

As a user who has drilled into sessions, I need a way to return to the dashboard view to access quick actions and project overview.

**Why this priority**: Dashboard provides orientation and quick actions. While not needed constantly, users should always have a path back to the "home" view.

**Independent Test**: Can be fully tested by opening a session tab, then using the new tab action, and verifying dashboard appears. Delivers navigation consistency.

**Acceptance Scenarios**:

1. **Given** the user has session tabs open, **When** they click the "+" (new tab) button in the tab bar, **Then** a new dashboard tab opens and becomes active
2. **Given** all session tabs are closed, **When** the last tab closes, **Then** the dashboard view is displayed automatically

---

### Edge Cases

- What happens when there are no projects available? Display dashboard with empty state message and guidance.
- What happens when a project has no sessions? Display empty state in session list with helpful message.
- What happens when the user closes all tabs? Automatically show dashboard view.
- What happens when a session file is deleted while its tab is open? Display error state in that tab with option to close.
- What happens with very long project names in the dropdown? Truncate with ellipsis, show full name on hover tooltip.
- What happens with many open tabs (e.g., 10+)? Tab bar becomes scrollable horizontally.

## Requirements *(mandatory)*

### Functional Requirements

**State Management**

- **FR-001**: System MUST maintain an active project ID representing the currently selected project context
- **FR-002**: System MUST maintain a list of open tabs, where each tab references either a session or the dashboard
- **FR-003**: System MUST maintain an active tab ID indicating which tab is currently focused
- **FR-004**: System MUST persist the active project selection across sessions within the application lifecycle

**Sidebar Behavior**

- **FR-005**: Sidebar MUST display a project dropdown at the top, below the macOS drag region
- **FR-006**: Sidebar MUST filter and display only sessions belonging to the currently active project
- **FR-007**: Sessions in the sidebar MUST be grouped by relative date categories (Today, Yesterday, Previous 7 Days, Older)
- **FR-008**: Clicking a session in the sidebar MUST add it to open tabs (if not already present) and focus it
- **FR-009**: Session list items MUST use minimalist styling without heavy background colors

**macOS Integration**

- **FR-010**: Sidebar header MUST reserve space (approximately 40px height) for macOS traffic lights
- **FR-011**: Sidebar header area MUST be draggable to move the application window
- **FR-012**: Interactive elements within the header MUST be excluded from the drag region

**Tab Interface**

- **FR-013**: Tab bar MUST display at the top of the main content area (right of sidebar)
- **FR-014**: Active tab MUST be visually distinguished with light text and subtle indicator
- **FR-015**: Inactive tabs MUST display with muted text styling
- **FR-016**: Each tab MUST include a close button to remove it from the open tabs list
- **FR-017**: Tab bar MUST include a "new tab" button that opens the dashboard
- **FR-018**: Closing the last tab MUST automatically display the dashboard view

**Content Area Logic**

- **FR-019**: When active tab references a session, system MUST render the chat/session view
- **FR-020**: When active tab references dashboard (or no tabs exist), system MUST render the dashboard view

**Dashboard View**

- **FR-021**: Dashboard MUST display a time-based greeting (Good Morning/Afternoon/Evening)
- **FR-022**: Dashboard MUST display quick action buttons with keyboard shortcut hints
- **FR-023**: Dashboard MUST display a grid of recently accessed projects
- **FR-024**: Project cards MUST show project name, path, and last accessed time
- **FR-025**: Clicking a project card MUST set that project as active

### Key Entities

- **Project**: Represents a Git repository/codebase being analyzed. Attributes: ID, name, path, last accessed timestamp, session count
- **Session**: Represents a Claude Code conversation thread within a project. Attributes: ID, project ID, created timestamp, title/description
- **Tab**: Represents an open view in the main content area. Attributes: ID, type (session or dashboard), session ID (if type is session), label
- **AppContext**: Represents the global application state. Attributes: active project ID, open tabs list, active tab ID

## Assumptions

- The application already has access to project and session data via existing IPC handlers
- macOS traffic lights use approximately 70-80px horizontal space from the left edge
- The existing chat/session view components can be reused within the tabbed interface
- Projects are pre-sorted by most recent activity from the existing data layer
- Time-based greeting uses local system time (morning: 5-12, afternoon: 12-17, evening: 17-5)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify and switch projects within 2 seconds using the dropdown
- **SC-002**: Users can open a session in a new tab with a single click
- **SC-003**: Dashboard loads within 500ms of application launch or new tab creation
- **SC-004**: 100% of macOS users can drag the window using the sidebar header
- **SC-005**: Tab switching between open sessions occurs within 200ms
- **SC-006**: Users can locate sessions from the current day within 3 seconds using date groupings
- **SC-007**: Quick action buttons on dashboard reduce navigation steps by at least 50% for common actions
