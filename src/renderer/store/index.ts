import { create } from 'zustand';
import { Project, Session, SessionDetail, SubagentDetail } from '../types/data';
import type { SessionConversation, AIGroup, AIGroupExpansionLevel } from '../types/groups';
import { transformChunksToConversation } from '../utils/groupTransformer';
import type { Tab, TabInput } from '../types/tabs';
import { isSessionOpenInTabs, findTabBySession, truncateLabel } from '../types/tabs';

interface BreadcrumbItem {
  id: string;
  description: string;
}

/**
 * Represents a single search match in the conversation.
 */
export interface SearchMatch {
  /** ID of the chat item containing this match */
  itemId: string;
  /** Type of item ('user' | 'system' | 'ai') */
  itemType: 'user' | 'system' | 'ai';
  /** Which match within this item (0-based) */
  matchIndexInItem: number;
  /** Global index across all matches */
  globalIndex: number;
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

  // Command palette state
  commandPaletteOpen: boolean;

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

  // Project context actions (new)
  setActiveProject: (projectId: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  showSearch: () => void;
  hideSearch: () => void;
  nextSearchResult: () => void;
  previousSearchResult: () => void;

  // Command palette actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  navigateToSession: (projectId: string, sessionId: string, fromSearch?: boolean) => void;
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

  // Command palette state
  commandPaletteOpen: false,

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

      set({
        sessionDetail: detail,
        sessionDetailLoading: false,
        conversation,
        conversationLoading: false,
        visibleAIGroupId: firstAIGroupId,
        selectedAIGroup: firstAIGroup
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
        searchMatches: []
      });
      return;
    }

    // Build search matches by scanning conversation
    const matches: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();
    let globalIndex = 0;

    for (const item of conversation.items) {
      let searchableTexts: string[] = [];
      let itemId = '';
      let itemType: 'user' | 'system' | 'ai' = 'user';

      if (item.type === 'user') {
        itemId = item.group.id;
        itemType = 'user';
        const text = item.group.content.rawText || item.group.content.text || '';
        searchableTexts = [text];
      } else if (item.type === 'system') {
        itemId = item.group.id;
        itemType = 'system';
        searchableTexts = [item.group.commandOutput || ''];
      } else if (item.type === 'ai') {
        itemId = item.group.id;
        itemType = 'ai';
        // Collect text from all steps
        for (const step of item.group.steps) {
          if (step.content.thinkingText) {
            searchableTexts.push(step.content.thinkingText);
          }
          if (step.content.outputText) {
            searchableTexts.push(step.content.outputText);
          }
          if (step.content.toolResultContent) {
            searchableTexts.push(step.content.toolResultContent);
          }
        }
      }

      // Count matches in all searchable texts for this item
      let matchIndexInItem = 0;
      for (const text of searchableTexts) {
        const lowerText = text.toLowerCase();
        let pos = 0;
        while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
          matches.push({
            itemId,
            itemType,
            matchIndexInItem,
            globalIndex,
          });
          matchIndexInItem++;
          globalIndex++;
          pos += lowerQuery.length;
        }
      }
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
      searchMatches: []
    });
  },

  nextSearchResult: () => {
    const state = get();
    if (state.searchResultCount > 0) {
      const nextIndex = (state.currentSearchIndex + 1) % state.searchResultCount;
      set({ currentSearchIndex: nextIndex });
    }
  },

  previousSearchResult: () => {
    const state = get();
    if (state.searchResultCount > 0) {
      const prevIndex = state.currentSearchIndex - 1;
      const newIndex = prevIndex < 0 ? state.searchResultCount - 1 : prevIndex;
      set({ currentSearchIndex: newIndex });
    }
  },

  // Command palette actions
  openCommandPalette: () => {
    set({ commandPaletteOpen: true });
  },

  closeCommandPalette: () => {
    set({ commandPaletteOpen: false });
  },

  navigateToSession: (projectId: string, sessionId: string, fromSearch = false) => {
    const state = get();

    // If different project, select it first
    if (state.selectedProjectId !== projectId) {
      state.selectProject(projectId);
    }

    // Open the session in a new tab
    state.openTab({
      type: 'session',
      label: 'Loading...',
      projectId,
      sessionId,
      fromSearch,
    });

    // If opened from search, clear sidebar selection to deselect
    if (fromSearch) {
      set({ selectedSessionId: null });
    }

    // Fetch session detail
    state.fetchSessionDetail(projectId, sessionId);
  },
}));
