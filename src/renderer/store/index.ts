import { create } from 'zustand';
import { Project, Session, SessionDetail, SubagentDetail } from '../types/data';
import type { SessionConversation, AIGroup, AIGroupExpansionLevel } from '../types/groups';
import { transformChunksToConversation } from '../utils/groupTransformer';

interface BreadcrumbItem {
  id: string;
  description: string;
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

  // Actions
  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  fetchSessions: (projectId: string) => Promise<void>;
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

  // Select a project and fetch its sessions
  selectProject: (id: string) => {
    console.log('[Store] selectProject called with id:', id);
    set({
      selectedProjectId: id,
      selectedSessionId: null,
      sessionDetail: null,
      sessions: [],
      sessionsError: null
    });
    console.log('[Store] selectedProjectId set to:', id);

    // Fetch sessions for this project
    get().fetchSessions(id);
  },

  // Fetch sessions for a specific project
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

  // Select a session and fetch its detail
  selectSession: (id: string) => {
    set({
      selectedSessionId: id,
      sessionDetail: null,
      sessionDetailError: null
    });

    // Fetch detail for this session
    const projectId = get().selectedProjectId;
    if (projectId) {
      get().fetchSessionDetail(projectId, id);
    }
  },

  // Fetch full session detail with chunks and subagents
  fetchSessionDetail: async (projectId: string, sessionId: string) => {
    set({
      sessionDetailLoading: true,
      sessionDetailError: null,
      conversationLoading: true
    });
    try {
      const detail = await window.electronAPI.getSessionDetail(projectId, sessionId);

      // Transform chunks to conversation
      // Note: detail.chunks are actually EnhancedChunk[] at runtime despite type definition
      const conversation: SessionConversation | null = detail
        ? transformChunksToConversation(detail.chunks as any, detail.subagents)
        : null;

      // Initialize visibleAIGroupId to first AI Group if available
      const firstAIGroupId = conversation?.turns?.[0]?.aiGroups?.[0]?.id ?? null;
      const firstAIGroup = conversation?.turns?.[0]?.aiGroups?.[0] ?? null;

      set({
        sessionDetail: detail,
        sessionDetailLoading: false,
        conversation,
        conversationLoading: false,
        visibleAIGroupId: firstAIGroupId,
        selectedAIGroup: firstAIGroup
      });
    } catch (error) {
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
      for (const turn of state.conversation.turns) {
        const found = turn.aiGroups.find(g => g.id === aiGroupId);
        if (found) {
          selectedAIGroup = found;
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
  }
}));
