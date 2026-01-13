import { create } from 'zustand';
import { Project, Session, SessionDetail, SubagentDetail } from '../types/data';

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
    set({ sessionDetailLoading: true, sessionDetailError: null });
    try {
      const detail = await window.electronAPI.getSessionDetail(projectId, sessionId);
      set({ sessionDetail: detail, sessionDetailLoading: false });
    } catch (error) {
      set({ 
        sessionDetailError: error instanceof Error ? error.message : 'Failed to fetch session detail',
        sessionDetailLoading: false 
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
  }
}));
