/**
 * Tab type definitions for the tabbed layout feature.
 * Based on specs/001-tabbed-layout-dashboard/contracts/tab-state.ts
 */

import type { Session } from './data';

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
 */
export interface TabSlice {
  // State
  openTabs: Tab[];
  activeTabId: string | null;

  // Actions
  openTab: (tab: TabInput) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  openDashboard: () => void;

  // Selectors
  getActiveTab: () => Tab | null;
  isSessionOpen: (sessionId: string) => boolean;
}

/**
 * Project context state and actions
 */
export interface ProjectContextSlice {
  activeProjectId: string | null;
  setActiveProject: (projectId: string) => void;
}

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

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Checks if a session is already open in a tab
 */
export function isSessionOpenInTabs(tabs: Tab[], sessionId: string): boolean {
  return tabs.some(t => t.type === 'session' && t.sessionId === sessionId);
}

/**
 * Find tab by session ID
 */
export function findTabBySession(tabs: Tab[], sessionId: string): Tab | undefined {
  return tabs.find(t => t.type === 'session' && t.sessionId === sessionId);
}

/**
 * Truncate label to max length with ellipsis
 */
export function truncateLabel(label: string): string {
  if (label.length <= TAB_LABEL_MAX_LENGTH) return label;
  return label.slice(0, TAB_LABEL_MAX_LENGTH - 1) + '…';
}
