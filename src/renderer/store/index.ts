import { create } from 'zustand';
import { Project, Session, SessionDetail, SubagentDetail, DetectedError, AppConfig, ClaudeMdFileInfo } from '../types/data';
import type { SessionConversation, AIGroup, AIGroupExpansionLevel } from '../types/groups';
import { transformChunksToConversation } from '../utils/groupTransformer';
import { findLastOutput } from '../utils/aiGroupEnhancer';
import { processSessionClaudeMd } from '../utils/claudeMdTracker';
import type { ClaudeMdStats } from '../types/claudeMd';
import type { Tab, TabInput } from '../types/tabs';
import { isSessionOpenInTabs, findTabBySession, truncateLabel } from '../types/tabs';

interface BreadcrumbItem {
  id: string;
  description: string;
}

/**
 * Represents a single search match in the conversation.
 * Only searches: user message text and AI lastOutput text (not tool results, thinking, or subagents)
 */
export interface SearchMatch {
  /** ID of the chat item containing this match */
  itemId: string;
  /** Type of item ('user' | 'ai') - system items are not searched */
  itemType: 'user' | 'ai';
  /** Which match within this item (0-based) */
  matchIndexInItem: number;
  /** Global index across all matches */
  globalIndex: number;
  /** Display item ID within the AI group (e.g., "lastOutput") */
  displayItemId?: string;
}

/**
 * Search context for navigating from Command Palette results.
 */
export interface SearchNavigationContext {
  /** The search query */
  query: string;
  /** Timestamp of the message containing the search match */
  messageTimestamp: number;
  /** The matched text */
  matchedText: string;
}

interface AppState {
  // Projects state
  projects: Project[];
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectsError: string | null;

  // Sessions state
  sessions: Session[];
  selectedSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string | null;
  // Pagination state
  sessionsCursor: string | null;
  sessionsHasMore: boolean;
  sessionsTotalCount: number;
  sessionsLoadingMore: boolean;

  // Session detail state
  sessionDetail: SessionDetail | null;
  sessionDetailLoading: boolean;
  sessionDetailError: string | null;

  // Subagent drill-down state
  drillDownStack: BreadcrumbItem[];
  currentSubagentDetail: SubagentDetail | null;
  subagentDetailLoading: boolean;
  subagentDetailError: string | null;

  // Conversation state (new chat architecture)
  conversation: SessionConversation | null;
  conversationLoading: boolean;

  // CLAUDE.md stats (injection tracking per AI group)
  sessionClaudeMdStats: Map<string, ClaudeMdStats> | null;

  // Visible AI Group (for Gantt sync)
  visibleAIGroupId: string | null;
  selectedAIGroup: AIGroup | null;

  // Expansion states
  aiGroupExpansionLevels: Map<string, AIGroupExpansionLevel>;
  expandedStepIds: Set<string>;

  // Chart mode
  ganttChartMode: 'timeline' | 'context';

  // Detail popover state
  activeDetailItem: {
    aiGroupId: string;
    itemId: string;
    type: 'thinking' | 'text' | 'linked-tool' | 'subagent';
  } | null;

  // Tab state (new)
  openTabs: Tab[];
  activeTabId: string | null;

  // Project context state (new)
  activeProjectId: string | null;

  // Search state
  searchQuery: string;
  searchVisible: boolean;
  searchResultCount: number;
  currentSearchIndex: number;
  searchMatches: SearchMatch[];

  // Auto-expand state for search results
  /** AI group IDs that should be expanded to show search results */
  searchExpandedAIGroupIds: Set<string>;
  /** Subagent IDs within AI groups that should show their execution trace */
  searchExpandedSubagentIds: Set<string>;
  /** Current search result's display item ID for precise expansion (e.g., "thinking-0") */
  searchCurrentDisplayItemId: string | null;
  /** Current search result's item ID within subagent trace (e.g., "subagent-thinking-0") */
  searchCurrentSubagentItemId: string | null;

  // Command palette state
  commandPaletteOpen: boolean;

  // Notifications state
  notifications: DetectedError[];
  unreadCount: number;
  notificationsLoading: boolean;
  notificationsError: string | null;

  // App config state
  appConfig: AppConfig | null;
  configLoading: boolean;
  configError: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  fetchSessions: (projectId: string) => Promise<void>;
  fetchSessionsInitial: (projectId: string) => Promise<void>;
  fetchSessionsMore: () => Promise<void>;
  resetSessionsPagination: () => void;
  selectSession: (id: string) => void;
  fetchSessionDetail: (projectId: string, sessionId: string) => Promise<void>;
  clearSelection: () => void;

  // Drill-down actions
  drillDownSubagent: (projectId: string, sessionId: string, subagentId: string, description: string) => Promise<void>;
  navigateToBreadcrumb: (index: number) => void;
  closeSubagentModal: () => void;

  // Conversation actions (new)
  setVisibleAIGroup: (aiGroupId: string | null) => void;
  setAIGroupExpansion: (aiGroupId: string, level: AIGroupExpansionLevel) => void;
  toggleStepExpansion: (stepId: string) => void;
  setGanttChartMode: (mode: 'timeline' | 'context') => void;

  // Detail popover actions
  showDetailPopover: (aiGroupId: string, itemId: string, type: 'thinking' | 'text' | 'linked-tool' | 'subagent') => void;
  hideDetailPopover: () => void;

  // Tab actions (new)
  openTab: (tab: TabInput) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  openDashboard: () => void;
  getActiveTab: () => Tab | null;
  isSessionOpen: (sessionId: string) => boolean;
  clearTabDeepLink: (tabId: string) => void;

  // Project context actions (new)
  setActiveProject: (projectId: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  showSearch: () => void;
  hideSearch: () => void;
  nextSearchResult: () => void;
  previousSearchResult: () => void;
  /** Expand AI groups and subagents needed to show the current search result */
  expandForCurrentSearchResult: () => void;

  // Command palette actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  navigateToSession: (projectId: string, sessionId: string, fromSearch?: boolean, searchContext?: SearchNavigationContext) => void;

  // Notification actions
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  navigateToError: (error: DetectedError) => void;
  openNotificationsTab: () => void;

  // Config actions
  fetchConfig: () => Promise<void>;
  updateConfig: (section: string, data: Record<string, unknown>) => Promise<void>;
  openSettingsTab: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  projects: [],
  selectedProjectId: null,
  projectsLoading: false,
  projectsError: null,

  sessions: [],
  selectedSessionId: null,
  sessionsLoading: false,
  sessionsError: null,
  // Pagination state
  sessionsCursor: null,
  sessionsHasMore: false,
  sessionsTotalCount: 0,
  sessionsLoadingMore: false,

  sessionDetail: null,
  sessionDetailLoading: false,
  sessionDetailError: null,

  drillDownStack: [],
  currentSubagentDetail: null,
  subagentDetailLoading: false,
  subagentDetailError: null,

  conversation: null,
  conversationLoading: false,

  // CLAUDE.md stats (injection tracking per AI group)
  sessionClaudeMdStats: null,

  visibleAIGroupId: null,
  selectedAIGroup: null,

  aiGroupExpansionLevels: new Map(),
  expandedStepIds: new Set(),

  ganttChartMode: 'timeline',

  activeDetailItem: null,

  // Tab state (new)
  openTabs: [],
  activeTabId: null,

  // Project context state (new)
  activeProjectId: null,

  // Search state (initial values)
  searchQuery: '',
  searchVisible: false,
  searchResultCount: 0,
  currentSearchIndex: -1,
  searchMatches: [],

  // Auto-expand state for search results (initial values)
  searchExpandedAIGroupIds: new Set(),
  searchExpandedSubagentIds: new Set(),
  searchCurrentDisplayItemId: null,
  searchCurrentSubagentItemId: null,

  // Command palette state
  commandPaletteOpen: false,

  // Notifications state (initial values)
  notifications: [],
  unreadCount: 0,
  notificationsLoading: false,
  notificationsError: null,

  // App config state (initial values)
  appConfig: null,
  configLoading: false,
  configError: null,

  // Fetch all projects from main process
  fetchProjects: async () => {
    set({ projectsLoading: true, projectsError: null });
    try {
      const projects = await window.electronAPI.getProjects();
      // Sort by most recent session (descending)
      const sorted = projects.sort((a, b) =>
        (b.mostRecentSession || 0) - (a.mostRecentSession || 0)
      );
      set({ projects: sorted, projectsLoading: false });
    } catch (error) {
      set({
        projectsError: error instanceof Error ? error.message : 'Failed to fetch projects',
        projectsLoading: false
      });
    }
  },

  // Select a project and fetch its sessions (paginated)
  selectProject: (id: string) => {
    console.log('[Store] selectProject called with id:', id);
    set({
      selectedProjectId: id,
      selectedSessionId: null,
      sessionDetail: null,
      sessions: [],
      sessionsError: null,
      // Reset pagination state
      sessionsCursor: null,
      sessionsHasMore: false,
      sessionsTotalCount: 0,
      sessionsLoadingMore: false
    });
    console.log('[Store] selectedProjectId set to:', id);

    // Fetch sessions for this project (paginated)
    get().fetchSessionsInitial(id);
  },

  // Fetch sessions for a specific project (legacy - not paginated)
  fetchSessions: async (projectId: string) => {
    console.log('[Store] fetchSessions called for project:', projectId);
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await window.electronAPI.getSessions(projectId);
      // Sort by createdAt (descending)
      const sorted = sessions.sort((a, b) => b.createdAt - a.createdAt);
      set({ sessions: sorted, sessionsLoading: false });
      console.log('[Store] Fetched', sessions.length, 'sessions');
    } catch (error) {
      set({
        sessionsError: error instanceof Error ? error.message : 'Failed to fetch sessions',
        sessionsLoading: false
      });
    }
  },

  // Fetch initial page of sessions (paginated)
  fetchSessionsInitial: async (projectId: string) => {
    console.log('[Store] fetchSessionsInitial called for project:', projectId);
    set({
      sessionsLoading: true,
      sessionsError: null,
      sessions: [],
      sessionsCursor: null,
      sessionsHasMore: false,
      sessionsTotalCount: 0
    });
    try {
      const result = await window.electronAPI.getSessionsPaginated(projectId, null, 20);
      set({
        sessions: result.sessions,
        sessionsCursor: result.nextCursor,
        sessionsHasMore: result.hasMore,
        sessionsTotalCount: result.totalCount,
        sessionsLoading: false
      });
      console.log('[Store] Fetched initial', result.sessions.length, 'sessions, hasMore:', result.hasMore, 'total:', result.totalCount);
    } catch (error) {
      set({
        sessionsError: error instanceof Error ? error.message : 'Failed to fetch sessions',
        sessionsLoading: false
      });
    }
  },

  // Fetch more sessions (next page)
  fetchSessionsMore: async () => {
    const state = get();
    const { selectedProjectId, sessionsCursor, sessionsHasMore, sessionsLoadingMore } = state;

    // Guard: don't fetch if already loading, no more pages, or no project
    if (!selectedProjectId || !sessionsHasMore || sessionsLoadingMore || !sessionsCursor) {
      return;
    }

    console.log('[Store] fetchSessionsMore called');
    set({ sessionsLoadingMore: true });
    try {
      const result = await window.electronAPI.getSessionsPaginated(selectedProjectId, sessionsCursor, 20);
      set((prevState) => ({
        sessions: [...prevState.sessions, ...result.sessions],
        sessionsCursor: result.nextCursor,
        sessionsHasMore: result.hasMore,
        sessionsLoadingMore: false
      }));
      console.log('[Store] Fetched more', result.sessions.length, 'sessions, hasMore:', result.hasMore);
    } catch (error) {
      set({
        sessionsError: error instanceof Error ? error.message : 'Failed to fetch more sessions',
        sessionsLoadingMore: false
      });
    }
  },

  // Reset pagination state
  resetSessionsPagination: () => {
    set({
      sessions: [],
      sessionsCursor: null,
      sessionsHasMore: false,
      sessionsTotalCount: 0,
      sessionsLoadingMore: false,
      sessionsError: null
    });
  },

  // Select a session and fetch its detail
  selectSession: (id: string) => {
    console.log('[Store] selectSession called with id:', id);
    set({
      selectedSessionId: id,
      sessionDetail: null,
      sessionDetailError: null
    });
    console.log('[Store] selectedSessionId set to:', id);

    // Fetch detail for this session
    const projectId = get().selectedProjectId;
    console.log('[Store] Current selectedProjectId:', projectId);
    if (projectId) {
      console.log('[Store] Fetching session detail for project:', projectId, 'session:', id);
      get().fetchSessionDetail(projectId, id);
    } else {
      console.warn('[Store] Cannot fetch session detail: no project selected');
    }
  },

  // Fetch full session detail with chunks and subagents
  fetchSessionDetail: async (projectId: string, sessionId: string) => {
    console.log('[Store] fetchSessionDetail called for project:', projectId, 'session:', sessionId);
    set({
      sessionDetailLoading: true,
      sessionDetailError: null,
      conversationLoading: true
    });
    try {
      console.log('[Store] Calling electronAPI.getSessionDetail...');
      const detail = await window.electronAPI.getSessionDetail(projectId, sessionId);
      console.log('[Store] Received session detail:', detail ? 'SUCCESS' : 'NULL');

      if (detail) {

        const subagents = detail.processes.filter((p: any) => p.subagentType);
        console.log('[Store] Subagents:', subagents);
        console.log('[Store] Session detail has', detail.chunks?.length, 'chunks');
        console.log('[Store] Session detail has', subagents.length, 'subagents');
      }

      // Transform chunks to conversation
      // Note: detail.chunks are actually EnhancedChunk[] at runtime despite type definition
      const conversation: SessionConversation | null = detail
        ? transformChunksToConversation(detail.chunks as any, detail.processes)
        : null;

      if (conversation) {
        console.log('[Store] Transformed to conversation with', conversation.items.length, 'items');
        const aiItems = conversation.items.filter(item => item.type === 'ai');
        console.log('[Store] Conversation has', aiItems.length, 'AI groups');
      }

      // Initialize visibleAIGroupId to first AI Group if available
      const firstAIItem = conversation?.items?.find(item => item.type === 'ai');
      const firstAIGroupId = firstAIItem?.type === 'ai' ? firstAIItem.group.id : null;
      const firstAIGroup = firstAIItem?.type === 'ai' ? firstAIItem.group : null;
      console.log('[Store] Setting visibleAIGroupId to:', firstAIGroupId);

      // Compute CLAUDE.md stats for the session
      const projectRoot = detail?.session?.projectPath || '';
      let claudeMdStats: Map<string, ClaudeMdStats> | null = null;
      if (conversation?.items) {
        // Fetch real CLAUDE.md token data
        let claudeMdTokenData: Record<string, ClaudeMdFileInfo> = {};
        try {
          claudeMdTokenData = await window.electronAPI.readClaudeMdFiles(projectRoot);
        } catch (err) {
          console.error('[Store] Failed to read CLAUDE.md files:', err);
        }

        claudeMdStats = processSessionClaudeMd(conversation.items, projectRoot, claudeMdTokenData);
        console.log('[Store] Computed CLAUDE.md stats for', claudeMdStats.size, 'AI groups');
      }

      // Update tab label if this session is open in a tab
      const currentState = get();
      const existingTab = findTabBySession(currentState.openTabs, sessionId);
      if (existingTab && detail) {
        const newLabel = detail.session.firstMessage
          ? truncateLabel(detail.session.firstMessage)
          : `Session ${sessionId.slice(0, 8)}`;
        const updatedTabs = currentState.openTabs.map(tab =>
          tab.id === existingTab.id ? { ...tab, label: newLabel } : tab
        );
        set({ openTabs: updatedTabs });
      }

      set({
        sessionDetail: detail,
        sessionDetailLoading: false,
        conversation,
        conversationLoading: false,
        visibleAIGroupId: firstAIGroupId,
        selectedAIGroup: firstAIGroup,
        sessionClaudeMdStats: claudeMdStats
      });
      console.log('[Store] fetchSessionDetail completed successfully');
    } catch (error) {
      console.error('[Store] fetchSessionDetail error:', error);
      set({
        sessionDetailError: error instanceof Error ? error.message : 'Failed to fetch session detail',
        sessionDetailLoading: false,
        conversationLoading: false
      });
    }
  },

  // Clear all selections
  clearSelection: () => {
    set({
      selectedProjectId: null,
      selectedSessionId: null,
      sessions: [],
      sessionDetail: null
    });
  },

  // Drill down into a subagent
  drillDownSubagent: async (projectId: string, sessionId: string, subagentId: string, description: string) => {
    set({ subagentDetailLoading: true, subagentDetailError: null });
    try {
      const detail = await window.electronAPI.getSubagentDetail(projectId, sessionId, subagentId);

      if (!detail) {
        set({
          subagentDetailError: 'Failed to load subagent details',
          subagentDetailLoading: false
        });
        return;
      }

      // Add to breadcrumb stack
      const currentStack = get().drillDownStack;
      set({
        drillDownStack: [...currentStack, { id: subagentId, description }],
        currentSubagentDetail: detail,
        subagentDetailLoading: false
      });
    } catch (error) {
      set({
        subagentDetailError: error instanceof Error ? error.message : 'Failed to load subagent',
        subagentDetailLoading: false
      });
    }
  },

  // Navigate to a specific breadcrumb (pop stack to that level)
  navigateToBreadcrumb: (index: number) => {
    const state = get();

    // If navigating to index 0 or negative, close modal
    if (index <= 0) {
      set({
        drillDownStack: [],
        currentSubagentDetail: null,
        subagentDetailError: null
      });
      return;
    }

    // Pop stack to the specified index
    const newStack = state.drillDownStack.slice(0, index);

    if (newStack.length === 0) {
      set({
        drillDownStack: [],
        currentSubagentDetail: null,
        subagentDetailError: null
      });
      return;
    }

    // Reload detail for the target level
    const targetItem = newStack[newStack.length - 1];
    const projectId = state.selectedProjectId;
    const sessionId = state.selectedSessionId;

    if (!projectId || !sessionId) return;

    set({ subagentDetailLoading: true, subagentDetailError: null });

    window.electronAPI.getSubagentDetail(projectId, sessionId, targetItem.id)
      .then(detail => {
        if (detail) {
          set({
            drillDownStack: newStack,
            currentSubagentDetail: detail,
            subagentDetailLoading: false
          });
        } else {
          set({
            subagentDetailError: 'Failed to load subagent details',
            subagentDetailLoading: false
          });
        }
      })
      .catch(error => {
        set({
          subagentDetailError: error instanceof Error ? error.message : 'Failed to load subagent',
          subagentDetailLoading: false
        });
      });
  },

  // Close the subagent modal
  closeSubagentModal: () => {
    set({
      drillDownStack: [],
      currentSubagentDetail: null,
      subagentDetailError: null
    });
  },

  // Set visible AI Group (called by scroll observer)
  setVisibleAIGroup: (aiGroupId: string | null) => {
    const state = get();

    if (aiGroupId === state.visibleAIGroupId) return;

    // Find the AIGroup in the conversation
    let selectedAIGroup: AIGroup | null = null;
    if (aiGroupId && state.conversation) {
      for (const item of state.conversation.items) {
        if (item.type === 'ai' && item.group.id === aiGroupId) {
          selectedAIGroup = item.group;
          break;
        }
      }
    }

    set({
      visibleAIGroupId: aiGroupId,
      selectedAIGroup
    });
  },

  // Set expansion level for a specific AI Group
  setAIGroupExpansion: (aiGroupId: string, level: AIGroupExpansionLevel) => {
    const state = get();
    const newLevels = new Map(state.aiGroupExpansionLevels);
    newLevels.set(aiGroupId, level);
    set({ aiGroupExpansionLevels: newLevels });
  },

  // Toggle expansion state for a semantic step
  toggleStepExpansion: (stepId: string) => {
    const state = get();
    const newExpandedStepIds = new Set(state.expandedStepIds);
    if (newExpandedStepIds.has(stepId)) {
      newExpandedStepIds.delete(stepId);
    } else {
      newExpandedStepIds.add(stepId);
    }
    set({ expandedStepIds: newExpandedStepIds });
  },

  // Set Gantt chart display mode
  setGanttChartMode: (mode: 'timeline' | 'context') => {
    set({ ganttChartMode: mode });
  },

  // Show detail popover
  showDetailPopover: (aiGroupId: string, itemId: string, type: 'thinking' | 'text' | 'linked-tool' | 'subagent') => {
    set({
      activeDetailItem: {
        aiGroupId,
        itemId,
        type
      }
    });
  },

  // Hide detail popover
  hideDetailPopover: () => {
    set({ activeDetailItem: null });
  },

  // Tab actions (new)

  // Open a tab or focus existing if sessionId matches
  openTab: (tab: TabInput) => {
    const state = get();

    // If opening a session tab, check for duplicates
    if (tab.type === 'session' && tab.sessionId) {
      const existing = findTabBySession(state.openTabs, tab.sessionId);
      if (existing) {
        // Focus existing tab instead of creating duplicate
        set({ activeTabId: existing.id });
        return;
      }
    }

    // Create new tab with generated id and timestamp
    const newTab: Tab = {
      ...tab,
      id: crypto.randomUUID(),
      label: truncateLabel(tab.label),
      createdAt: Date.now(),
    };

    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
    });
  },

  // Close a tab by ID, auto-focus adjacent tab
  closeTab: (tabId: string) => {
    const state = get();
    const index = state.openTabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const newTabs = state.openTabs.filter(t => t.id !== tabId);

    // Determine new active tab
    let newActiveId = state.activeTabId;
    if (state.activeTabId === tabId) {
      // Closed tab was active, focus adjacent
      // Try next tab first, then previous, then null (dashboard)
      newActiveId = newTabs[index]?.id ?? newTabs[index - 1]?.id ?? null;
    }

    set({
      openTabs: newTabs,
      activeTabId: newActiveId,
    });
  },

  // Switch focus to an existing tab
  setActiveTab: (tabId: string) => {
    const state = get();
    const exists = state.openTabs.some(t => t.id === tabId);
    if (exists) {
      set({ activeTabId: tabId });
    }
  },

  // Open or focus the dashboard
  openDashboard: () => {
    const state = get();

    // Check if dashboard tab already exists
    const dashboardTab = state.openTabs.find(t => t.type === 'dashboard');
    if (dashboardTab) {
      set({ activeTabId: dashboardTab.id });
      return;
    }

    // Create new dashboard tab
    const newTab: Tab = {
      id: crypto.randomUUID(),
      type: 'dashboard',
      label: 'Dashboard',
      createdAt: Date.now(),
    };

    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
    });
  },

  // Get the currently active tab
  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.openTabs.find(t => t.id === state.activeTabId) ?? null;
  },

  // Check if a session is already open
  isSessionOpen: (sessionId: string) => {
    const state = get();
    return isSessionOpenInTabs(state.openTabs, sessionId);
  },

  // Clear deep link props (scrollToLine, highlightErrorId, errorTimestamp, highlightToolUseId, searchContext) from a tab after scrolling
  clearTabDeepLink: (tabId: string) => {
    const state = get();
    const updatedTabs = state.openTabs.map((tab) =>
      tab.id === tabId
        ? { ...tab, scrollToLine: undefined, highlightErrorId: undefined, errorTimestamp: undefined, highlightToolUseId: undefined, searchContext: undefined }
        : tab
    );
    set({ openTabs: updatedTabs });
  },

  // Project context actions (new)

  // Set active project and fetch its sessions
  setActiveProject: (projectId: string) => {
    set({ activeProjectId: projectId });

    // Also update selectedProjectId for compatibility with existing code
    // and fetch sessions
    get().selectProject(projectId);
  },

  // Search actions

  setSearchQuery: (query: string) => {
    const conversation = get().conversation;

    if (!query.trim() || !conversation) {
      set({
        searchQuery: query,
        searchResultCount: 0,
        currentSearchIndex: -1,
        searchMatches: [],
        searchCurrentDisplayItemId: null,
        searchCurrentSubagentItemId: null,
      });
      return;
    }

    // Build search matches by scanning conversation
    // ONLY searches: user message text and AI lastOutput text (not tool results)
    const matches: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();
    let globalIndex = 0;

    // Helper to find matches in text and add to matches array
    const findMatchesInText = (
      text: string,
      itemId: string,
      itemType: 'user' | 'ai',
      matchIndexInItem: { value: number },
      displayItemId?: string
    ) => {
      const lowerText = text.toLowerCase();
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        matches.push({
          itemId,
          itemType,
          matchIndexInItem: matchIndexInItem.value,
          globalIndex,
          displayItemId,
        });
        matchIndexInItem.value++;
        globalIndex++;
        pos += lowerQuery.length;
      }
    };

    for (const item of conversation.items) {
      const matchIndexInItem = { value: 0 };

      if (item.type === 'user') {
        // Search user message text
        const text = item.group.content.rawText || item.group.content.text || '';
        findMatchesInText(text, item.group.id, 'user', matchIndexInItem);
      } else if (item.type === 'ai') {
        // For AI items: ONLY search lastOutput text (not tool results, thinking, or subagents)
        const aiGroup = item.group;
        const itemId = aiGroup.id;
        const lastOutput = findLastOutput(aiGroup.steps);

        if (lastOutput && lastOutput.type === 'text' && lastOutput.text) {
          // Last output text - displayItemId indicates this is lastOutput content
          findMatchesInText(lastOutput.text, itemId, 'ai', matchIndexInItem, 'lastOutput');
        }
        // Skip tool_result type - only searching text output
      }
      // Skip system items entirely
    }

    set({
      searchQuery: query,
      searchResultCount: matches.length,
      currentSearchIndex: matches.length > 0 ? 0 : -1,
      searchMatches: matches
    });
  },

  showSearch: () => {
    set({ searchVisible: true });
  },

  hideSearch: () => {
    set({
      searchVisible: false,
      searchQuery: '',
      searchResultCount: 0,
      currentSearchIndex: -1,
      searchMatches: [],
      searchExpandedAIGroupIds: new Set(),
      searchExpandedSubagentIds: new Set(),
      searchCurrentDisplayItemId: null,
      searchCurrentSubagentItemId: null,
    });
  },

  nextSearchResult: () => {
    const state = get();
    if (state.searchResultCount > 0) {
      const nextIndex = (state.currentSearchIndex + 1) % state.searchResultCount;
      set({ currentSearchIndex: nextIndex });
      // Auto-expand any collapsed sections containing the result
      get().expandForCurrentSearchResult();
    }
  },

  previousSearchResult: () => {
    const state = get();
    if (state.searchResultCount > 0) {
      const prevIndex = state.currentSearchIndex - 1;
      const newIndex = prevIndex < 0 ? state.searchResultCount - 1 : prevIndex;
      set({ currentSearchIndex: newIndex });
      // Auto-expand any collapsed sections containing the result
      get().expandForCurrentSearchResult();
    }
  },

  expandForCurrentSearchResult: () => {
    const state = get();
    const { currentSearchIndex, searchMatches } = state;

    if (currentSearchIndex < 0 || searchMatches.length === 0) return;

    const currentMatch = searchMatches[currentSearchIndex];
    if (!currentMatch) return;

    // For AI group matches, track the display item ID for highlighting
    // Since we only search lastOutput text (always visible), no expansion needed
    if (currentMatch.itemType === 'ai') {
      set({
        searchCurrentDisplayItemId: currentMatch.displayItemId || null,
        searchCurrentSubagentItemId: null,
      });
    } else {
      // For user matches, clear display item IDs
      set({
        searchCurrentDisplayItemId: null,
        searchCurrentSubagentItemId: null,
      });
    }
  },

  // Command palette actions
  openCommandPalette: () => {
    set({ commandPaletteOpen: true });
  },

  closeCommandPalette: () => {
    set({ commandPaletteOpen: false });
  },

  navigateToSession: (projectId: string, sessionId: string, fromSearch = false, searchContext?: SearchNavigationContext) => {
    const state = get();

    // If different project, select it first
    if (state.selectedProjectId !== projectId) {
      state.selectProject(projectId);
    }

    // Check if session tab is already open
    const existingTab = findTabBySession(state.openTabs, sessionId);

    if (existingTab && searchContext) {
      // Update existing tab with search context and focus it
      const updatedTabs = state.openTabs.map((tab) =>
        tab.id === existingTab.id
          ? {
              ...tab,
              searchContext: {
                query: searchContext.query,
                messageTimestamp: searchContext.messageTimestamp,
                matchedText: searchContext.matchedText,
              },
            }
          : tab
      );
      set({
        openTabs: updatedTabs,
        activeTabId: existingTab.id,
      });
    } else {
      // Open the session in a new tab
      state.openTab({
        type: 'session',
        label: 'Loading...',
        projectId,
        sessionId,
        fromSearch,
        searchContext: searchContext ? {
          query: searchContext.query,
          messageTimestamp: searchContext.messageTimestamp,
          matchedText: searchContext.matchedText,
        } : undefined,
      });
    }

    // If opened from search, clear sidebar selection to deselect
    if (fromSearch) {
      set({ selectedSessionId: null });
    }

    // Fetch session detail
    state.fetchSessionDetail(projectId, sessionId);
  },

  // ==========================================================================
  // Notification Actions
  // ==========================================================================

  // Fetch all notifications from main process
  fetchNotifications: async () => {
    set({ notificationsLoading: true, notificationsError: null });
    try {
      const result = await window.electronAPI.notifications.get();
      // API returns 'notifications' array and 'unreadCount'
      const notifications = result.notifications || [];
      set({
        notifications,
        unreadCount: result.unreadCount || 0,
        notificationsLoading: false,
      });
    } catch (error) {
      set({
        notificationsError: error instanceof Error ? error.message : 'Failed to fetch notifications',
        notificationsLoading: false,
      });
    }
  },

  // Mark a single notification as read
  markNotificationRead: async (id: string) => {
    try {
      await window.electronAPI.notifications.markRead(id);
      // Optimistically update local state
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return { notifications, unreadCount };
      });
    } catch (error) {
      console.error('[Store] Failed to mark notification as read:', error);
    }
  },

  // Mark all notifications as read
  markAllNotificationsRead: async () => {
    try {
      await window.electronAPI.notifications.markAllRead();
      // Optimistically update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('[Store] Failed to mark all notifications as read:', error);
    }
  },

  // Clear all notifications
  clearNotifications: async () => {
    try {
      await window.electronAPI.notifications.clear();
      set({
        notifications: [],
        unreadCount: 0,
      });
    } catch (error) {
      console.error('[Store] Failed to clear notifications:', error);
    }
  },

  // Navigate to error location in session (deep linking)
  navigateToError: (error: DetectedError) => {
    const state = get();

    // Mark the notification as read
    state.markNotificationRead(error.id);

    // Check if session tab is already open
    const existingTab = findTabBySession(state.openTabs, error.sessionId);

    if (existingTab) {
      // Update existing tab with scroll/highlight info and focus it
      const updatedTabs = state.openTabs.map((tab) =>
        tab.id === existingTab.id
          ? {
              ...tab,
              scrollToLine: error.lineNumber,
              highlightErrorId: error.id,
              errorTimestamp: error.timestamp,
              highlightToolUseId: error.toolUseId,
            }
          : tab
      );
      set({
        openTabs: updatedTabs,
        activeTabId: existingTab.id,
      });
    } else {
      // Open new session tab with deep link props
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'session',
        label: 'Loading...',
        projectId: error.projectId,
        sessionId: error.sessionId,
        createdAt: Date.now(),
        scrollToLine: error.lineNumber,
        highlightErrorId: error.id,
        errorTimestamp: error.timestamp,
        highlightToolUseId: error.toolUseId,
      };

      set({
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
      });

      // If different project, select it first
      if (state.selectedProjectId !== error.projectId) {
        state.selectProject(error.projectId);
      }

      // Fetch session detail
      state.fetchSessionDetail(error.projectId, error.sessionId);
    }
  },

  // Open or focus the notifications tab
  openNotificationsTab: () => {
    const state = get();

    // Check if notifications tab already exists
    const notificationsTab = state.openTabs.find((t) => t.type === 'notifications');
    if (notificationsTab) {
      set({ activeTabId: notificationsTab.id });
      return;
    }

    // Create new notifications tab
    const newTab: Tab = {
      id: crypto.randomUUID(),
      type: 'notifications',
      label: 'Notifications',
      createdAt: Date.now(),
    };

    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
    });
  },

  // ==========================================================================
  // Config Actions
  // ==========================================================================

  // Fetch app configuration from main process
  fetchConfig: async () => {
    set({ configLoading: true, configError: null });
    try {
      const config = await window.electronAPI.config.get();
      set({
        appConfig: config,
        configLoading: false,
      });
    } catch (error) {
      set({
        configError: error instanceof Error ? error.message : 'Failed to fetch config',
        configLoading: false,
      });
    }
  },

  // Update a section of the app configuration
  updateConfig: async (section: string, data: Record<string, unknown>) => {
    try {
      await window.electronAPI.config.update(section, data);
      // Refresh config after update
      const config = await window.electronAPI.config.get();
      set({ appConfig: config });
    } catch (error) {
      console.error('[Store] Failed to update config:', error);
      set({
        configError: error instanceof Error ? error.message : 'Failed to update config',
      });
    }
  },

  // Open or focus the settings tab
  openSettingsTab: () => {
    const state = get();

    // Check if settings tab already exists
    const settingsTab = state.openTabs.find((t) => t.type === 'settings');
    if (settingsTab) {
      set({ activeTabId: settingsTab.id });
      return;
    }

    // Create new settings tab
    const newTab: Tab = {
      id: crypto.randomUUID(),
      type: 'settings',
      label: 'Settings',
      createdAt: Date.now(),
    };

    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
    });
  },
}));

// ==========================================================================
// Store Initialization - Subscribe to IPC Events
// ==========================================================================

/**
 * Initialize notification event listeners.
 * Call this once when the app starts (e.g., in App.tsx useEffect).
 */
export function initializeNotificationListeners(): () => void {
  const cleanupFns: Array<() => void> = [];

  // Listen for new notifications from main process
  if (window.electronAPI.notifications?.onNew) {
    const cleanup = window.electronAPI.notifications.onNew(
      (_event: unknown, error: unknown) => {
        // Cast the error to DetectedError type
        const notification = error as DetectedError;
        if (notification && notification.id) {
          useStore.setState((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
        }
      }
    );
    if (typeof cleanup === 'function') {
      cleanupFns.push(cleanup);
    }
  }

  // Listen for notification updates from main process
  if (window.electronAPI.notifications?.onUpdated) {
    const cleanup = window.electronAPI.notifications.onUpdated(
      (event: unknown) => {
        // The event data contains the updated notification
        const updatedNotification = event as DetectedError;
        if (updatedNotification && updatedNotification.id) {
          useStore.setState((state) => {
            const notifications = state.notifications.map((n) =>
              n.id === updatedNotification.id ? updatedNotification : n
            );
            const unreadCount = notifications.filter((n) => !n.isRead).length;
            return { notifications, unreadCount };
          });
        }
      }
    );
    if (typeof cleanup === 'function') {
      cleanupFns.push(cleanup);
    }
  }

  // Return cleanup function
  return () => {
    cleanupFns.forEach((fn) => fn());
  };
}
