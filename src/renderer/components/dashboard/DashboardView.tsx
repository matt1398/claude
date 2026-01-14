/**
 * DashboardView - Main dashboard container component.
 * Combines GreetingBanner, QuickActions, and RecentProjectsGrid
 * to create the zero-state welcoming experience.
 */

import { useEffect } from 'react';
import { useStore } from '../../store';
import { GreetingBanner } from './GreetingBanner';
import { QuickActions } from './QuickActions';
import { RecentProjectsGrid } from './RecentProjectsGrid';

export function DashboardView() {
  const { projects, fetchProjects } = useStore();

  // Fetch projects on mount if not already loaded
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  return (
    <div className="flex-1 overflow-auto bg-claude-dark-bg">
      <div className="max-w-4xl mx-auto p-8">
        <GreetingBanner />
        <QuickActions />
        <RecentProjectsGrid />
      </div>
    </div>
  );
}
