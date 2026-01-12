import { create } from 'zustand';
import { Project, Session, SessionDetail } from '../types/data';

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

  // Actions
  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  fetchSessions: (projectId: string) => Promise<void>;
  selectSession: (id: string) => void;
  fetchSessionDetail: (projectId: string, sessionId: string) => Promise<void>;
  clearSelection: () => void;
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

  // Fetch all projects from main process
  fetchProjects: async () => {
    set({ projectsLoading: true, projectsError: null });
    try {
      const projects = await window.electronAPI.getProjects();
      // Sort by last accessed (descending)
      const sorted = projects.sort((a, b) => 
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
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
    const currentId = get().selectedProjectId;
    if (currentId === id) return; // Already selected
    
    set({ 
      selectedProjectId: id,
      selectedSessionId: null,
      sessionDetail: null,
      sessions: [],
      sessionsError: null
    });
    
    // Fetch sessions for this project
    get().fetchSessions(id);
  },

  // Fetch sessions for a specific project
  fetchSessions: async (projectId: string) => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await window.electronAPI.getSessions(projectId);
      // Sort by date (descending)
      const sorted = sessions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      set({ sessions: sorted, sessionsLoading: false });
    } catch (error) {
      set({ 
        sessionsError: error instanceof Error ? error.message : 'Failed to fetch sessions',
        sessionsLoading: false 
      });
    }
  },

  // Select a session and fetch its detail
  selectSession: (id: string) => {
    const currentId = get().selectedSessionId;
    if (currentId === id) return; // Already selected
    
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
  }
}));
