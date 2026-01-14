# Data Model: Tabbed Layout with Dashboard

**Branch**: `001-tabbed-layout-dashboard`
**Date**: 2026-01-14
**Source**: [spec.md](./spec.md) Key Entities section

---

## Entity Definitions

### Tab

Represents an open view in the main content area.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier (UUID v4) |
| type | `'session'` \| `'dashboard'` | Yes | Type of content displayed |
| sessionId | string | Conditional | Session identifier (required if type = 'session') |
| projectId | string | Conditional | Project identifier (required if type = 'session') |
| label | string | Yes | Display name for tab |
| createdAt | number | Yes | Unix timestamp when tab was opened |

**Validation Rules:**
- `id` must be unique across all open tabs
- If `type === 'session'`, both `sessionId` and `projectId` must be set
- If `type === 'dashboard'`, `sessionId` and `projectId` must be undefined
- `label` maximum length: 50 characters (truncate with ellipsis)

**State Transitions:**
- `OPEN` → Tab is created and added to openTabs array
- `FOCUS` → Tab becomes activeTabId
- `CLOSE` → Tab is removed from openTabs array

---

### DateGroupedSessions

Represents sessions organized by relative date categories.

| Field | Type | Description |
|-------|------|-------------|
| Today | Session[] | Sessions created today |
| Yesterday | Session[] | Sessions created yesterday |
| Previous 7 Days | Session[] | Sessions 2-7 days old |
| Older | Session[] | Sessions more than 7 days old |

**Derivation Rules:**
- Computed from sessions array using `date-fns` comparison functions
- Categories are mutually exclusive
- Within each category, sessions maintain their original sort order (by createdAt descending)

---

### AppTabState

Represents the tab management portion of application state (new slice in Zustand store).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| openTabs | Tab[] | [] | All currently open tabs |
| activeTabId | string \| null | null | ID of focused tab, null shows dashboard |

**Invariants:**
- Maximum one tab per unique sessionId (deduplication)
- If openTabs is empty and activeTabId is null, dashboard view is shown
- activeTabId must reference an existing tab in openTabs, or be null

---

### AppProjectContext

Represents the project context portion of application state (extends existing store).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| activeProjectId | string \| null | null | Currently selected project in sidebar |

**Relationship to Existing State:**
- `activeProjectId` filters which sessions appear in sidebar
- `selectedProjectId` (existing) continues to work for data fetching
- These may be synchronized or treated as the same field

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        AppState (Zustand Store)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │ AppProjectContext│     │      AppTabState                │   │
│  ├─────────────────┤     ├─────────────────────────────────┤   │
│  │ activeProjectId │     │ openTabs: Tab[]                 │   │
│  │       │         │     │ activeTabId: string | null      │   │
│  └───────┼─────────┘     └──────────────┬──────────────────┘   │
│          │                              │                       │
│          │ filters                      │ contains              │
│          ▼                              ▼                       │
│  ┌─────────────────┐           ┌─────────────────────────┐     │
│  │ sessions[]      │           │ Tab                      │     │
│  │ (existing)      │           ├─────────────────────────┤     │
│  └────────┬────────┘           │ id                       │     │
│           │                    │ type: session|dashboard  │     │
│           │ grouped into       │ sessionId? (→ Session)   │     │
│           ▼                    │ projectId? (→ Project)   │     │
│  ┌─────────────────────┐       │ label                    │     │
│  │ DateGroupedSessions │       │ createdAt                │     │
│  ├─────────────────────┤       └─────────────────────────┘     │
│  │ Today: []           │                                        │
│  │ Yesterday: []       │                                        │
│  │ Previous 7 Days: [] │                                        │
│  │ Older: []           │                                        │
│  └─────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Type Definitions (TypeScript)

```typescript
// src/renderer/types/tabs.ts

/**
 * Represents a single open tab in the main content area
 */
export interface Tab {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Type of content: session view or dashboard */
  type: 'session' | 'dashboard';

  /** Session ID for session tabs */
  sessionId?: string;

  /** Project ID for session tabs */
  projectId?: string;

  /** Display name for the tab */
  label: string;

  /** Unix timestamp when tab was opened */
  createdAt: number;
}

/**
 * Categories for date-based session grouping
 */
export type DateCategory = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

/**
 * Sessions grouped by relative date
 */
export type DateGroupedSessions = {
  [K in DateCategory]: Session[];
};

/**
 * Tab management state slice
 */
export interface TabSlice {
  /** All currently open tabs */
  openTabs: Tab[];

  /** ID of the currently focused tab, null shows dashboard */
  activeTabId: string | null;

  /** Open a new tab or focus existing if duplicate sessionId */
  openTab: (tab: Omit<Tab, 'id' | 'createdAt'>) => void;

  /** Close a tab by ID, auto-focus adjacent tab */
  closeTab: (tabId: string) => void;

  /** Switch focus to an existing tab */
  setActiveTab: (tabId: string) => void;

  /** Open or focus the dashboard tab */
  openDashboard: () => void;

  /** Get the currently active tab object */
  getActiveTab: () => Tab | null;
}

/**
 * Project context state slice
 */
export interface ProjectContextSlice {
  /** Currently selected project for sidebar filtering */
  activeProjectId: string | null;

  /** Set the active project (updates sidebar session list) */
  setActiveProject: (projectId: string) => void;
}
```

---

## Validation Helpers

```typescript
// src/renderer/utils/tabValidation.ts

import type { Tab } from '../types/tabs';

/**
 * Validates tab structure before insertion
 */
export function validateTab(tab: Partial<Tab>): tab is Tab {
  if (!tab.id || typeof tab.id !== 'string') return false;
  if (!tab.type || !['session', 'dashboard'].includes(tab.type)) return false;
  if (!tab.label || typeof tab.label !== 'string') return false;
  if (typeof tab.createdAt !== 'number') return false;

  if (tab.type === 'session') {
    if (!tab.sessionId || !tab.projectId) return false;
  }

  if (tab.type === 'dashboard') {
    if (tab.sessionId !== undefined || tab.projectId !== undefined) return false;
  }

  return true;
}

/**
 * Checks if a session is already open in a tab
 */
export function isSessionOpen(tabs: Tab[], sessionId: string): boolean {
  return tabs.some(t => t.type === 'session' && t.sessionId === sessionId);
}

/**
 * Find tab by session ID
 */
export function findTabBySession(tabs: Tab[], sessionId: string): Tab | undefined {
  return tabs.find(t => t.type === 'session' && t.sessionId === sessionId);
}
```
