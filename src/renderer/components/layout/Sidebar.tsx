/**
 * Sidebar - Contains project dropdown and date-grouped session list.
 * Provides project-centric navigation for the tabbed layout.
 */

import { useEffect } from 'react';
import { useStore } from '../../store';
import { SidebarHeader } from './SidebarHeader';
import { DateGroupedSessions } from '../sidebar/DateGroupedSessions';

export function Sidebar() {
  const { projects, projectsLoading, fetchProjects } = useStore();

  // Fetch projects on mount if not loaded
  useEffect(() => {
    if (projects.length === 0 && !projectsLoading) {
      fetchProjects();
    }
  }, [projects.length, projectsLoading, fetchProjects]);

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-claude-dark-border flex flex-col bg-claude-dark-bg">
      {/* Sidebar header with project dropdown */}
      <SidebarHeader />

      {/* Date-grouped session list */}
      <div className="flex-1 overflow-hidden">
        <DateGroupedSessions />
      </div>
    </div>
  );
}
