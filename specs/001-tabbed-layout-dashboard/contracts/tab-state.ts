/**
 * Tab State Interface Contract
 *
 * This file defines the TypeScript interfaces for the tab management system.
 * These are the contracts that must be implemented by the Zustand store.
 *
 * Branch: 001-tabbed-layout-dashboard
 * Date: 2026-01-14
 */

// Session type reference - use the actual type from src/renderer/types/data.ts
// This contract file is for documentation; actual implementation imports from the codebase
type Session = {
  id: string;
  title: string;
  createdAt: number;
  // ... other fields from the actual Session type
};

// =============================================================================
// Core Types
// =============================================================================

/**
 * Represents a single open tab in the main content area
 */
export interface Tab {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Type of content displayed in this tab */
  type: 'session' | 'dashboard';

  /** Session ID (required when type === 'session') */
  sessionId?: string;

  /** Project ID (required when type === 'session') */
  projectId?: string;

  /** Display name for the tab (max 50 chars) */
  label: string;

  /** Unix timestamp when tab was opened */
  createdAt: number;
}

/**
 * Input type for creating a new tab (id and createdAt are auto-generated)
 */
export type TabInput = Omit<Tab, 'id' | 'createdAt'>;

/**
 * Categories for date-based session grouping
 */
export type DateCategory = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

/**
 * Sessions grouped by relative date category
 */
export type DateGroupedSessions = Record<DateCategory, Session[]>;

// =============================================================================
// State Slice Interfaces
// =============================================================================

/**
 * Tab management state and actions
 *
 * This slice manages the multi-tab interface, including:
 * - Tracking which tabs are open
 * - Managing focus/active tab
 * - Preventing duplicate session tabs
 * - Auto-focusing adjacent tabs on close
 */
export interface TabSlice {
  // State
  openTabs: Tab[];
  activeTabId: string | null;

  // Actions

  /**
   * Opens a new tab or focuses existing if sessionId matches.
   *
   * Behavior:
   * - If type='session' and sessionId already open: focus existing tab
   * - Otherwise: create new tab with generated id/timestamp and focus it
   *
   * @param tab Tab input (without id and createdAt)
   */
  openTab: (tab: TabInput) => void;

  /**
   * Closes a tab by ID.
   *
   * Behavior:
   * - Removes tab from openTabs
   * - If closed tab was active: focus next tab, or previous, or null
   * - If activeTabId becomes null: dashboard view is shown
   *
   * @param tabId ID of tab to close
   */
  closeTab: (tabId: string) => void;

  /**
   * Switches focus to an existing tab.
   *
   * @param tabId ID of tab to focus (must exist in openTabs)
   */
  setActiveTab: (tabId: string) => void;

  /**
   * Opens or focuses the dashboard tab.
   *
   * Behavior:
   * - If dashboard tab exists: focus it
   * - Otherwise: create new dashboard tab and focus it
   */
  openDashboard: () => void;

  // Selectors

  /**
   * Returns the currently active tab object, or null if none.
   */
  getActiveTab: () => Tab | null;

  /**
   * Checks if a session is already open in a tab.
   *
   * @param sessionId Session ID to check
   * @returns true if session is open
   */
  isSessionOpen: (sessionId: string) => boolean;
}

/**
 * Project context state and actions
 *
 * This slice manages which project is active for sidebar filtering.
 */
export interface ProjectContextSlice {
  // State

  /** Currently selected project ID for sidebar session filtering */
  activeProjectId: string | null;

  // Actions

  /**
   * Sets the active project, updating the sidebar session list.
   *
   * Behavior:
   * - Updates activeProjectId
   * - Triggers session list filter to show only this project's sessions
   * - Does NOT close any open tabs (tabs persist across project switches)
   *
   * @param projectId Project ID to set as active
   */
  setActiveProject: (projectId: string) => void;
}

// =============================================================================
// Combined Store Interface
// =============================================================================

/**
 * Extended AppState including tab and project context slices.
 *
 * This extends the existing store interface with new state for the
 * tabbed layout feature.
 */
export interface TabbedLayoutState extends TabSlice, ProjectContextSlice {
  // Include existing state from the current store...
  // (These are preserved, not redefined)
}

// =============================================================================
// Utility Functions Contract
// =============================================================================

/**
 * Groups sessions by relative date category.
 *
 * @param sessions Array of sessions to group
 * @returns Object with sessions grouped into Today, Yesterday, Previous 7 Days, Older
 */
export type GroupSessionsByDate = (sessions: Session[]) => DateGroupedSessions;

/**
 * Returns a time-appropriate greeting.
 *
 * @returns "Good Morning" (5-12), "Good Afternoon" (12-17), or "Good Evening" (17-5)
 */
export type GetGreeting = () => string;

// =============================================================================
// Constants
// =============================================================================

/** Maximum characters for tab label before truncation */
export const TAB_LABEL_MAX_LENGTH = 50;

/** Dashboard tab identifier constant */
export const DASHBOARD_TAB_ID = 'dashboard';

/** Date category order for rendering */
export const DATE_CATEGORY_ORDER: DateCategory[] = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Older',
];
