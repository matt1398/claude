/**
 * RecentProjectsGrid - Displays a grid of recent projects.
 * Each card shows project name, path, and last activity time.
 */

import { formatDistanceToNow } from 'date-fns';
import { FolderGit2 } from 'lucide-react';
import { useStore } from '../../store';

interface ProjectCardProps {
  id: string;
  name: string;
  path: string;
  lastOpened?: number;
  onClick: () => void;
}

function ProjectCard({ name, path, lastOpened, onClick }: ProjectCardProps) {
  const lastActivity = lastOpened
    ? formatDistanceToNow(new Date(lastOpened), { addSuffix: true })
    : 'No recent activity';

  return (
    <button
      onClick={onClick}
      className="flex flex-col p-4 bg-claude-dark-surface border border-claude-dark-border rounded-lg hover:border-claude-dark-text-secondary/50 transition-colors text-left group"
    >
      <div className="flex items-center gap-2 mb-2">
        <FolderGit2 className="w-4 h-4 text-claude-dark-text-secondary" />
        <span className="text-sm font-medium text-claude-dark-text truncate">
          {name}
        </span>
      </div>
      <span className="text-xs text-claude-dark-text-secondary truncate mb-2" title={path}>
        {path}
      </span>
      <span className="text-xs text-claude-dark-text-secondary/70">
        {lastActivity}
      </span>
    </button>
  );
}

interface RecentProjectsGridProps {
  maxProjects?: number;
}

export function RecentProjectsGrid({ maxProjects = 6 }: RecentProjectsGridProps) {
  const { projects, projectsLoading, setActiveProject } = useStore();

  const recentProjects = projects.slice(0, maxProjects);

  if (projectsLoading) {
    return (
      <div>
        <h2 className="text-sm font-medium text-claude-dark-text-secondary mb-4">
          Recent Projects
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-claude-dark-surface border border-claude-dark-border rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (recentProjects.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-medium text-claude-dark-text-secondary mb-4">
          Recent Projects
        </h2>
        <div className="p-8 text-center border border-dashed border-claude-dark-border rounded-lg">
          <FolderGit2 className="w-8 h-8 text-claude-dark-text-secondary mx-auto mb-2" />
          <p className="text-sm text-claude-dark-text-secondary">
            No projects found
          </p>
          <p className="text-xs text-claude-dark-text-secondary/70 mt-1">
            Projects from ~/.claude/projects/ will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-claude-dark-text-secondary mb-4">
        Recent Projects
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {recentProjects.map((project) => (
          <ProjectCard
            key={project.id}
            id={project.id}
            name={project.name}
            path={project.path}
            lastOpened={project.mostRecentSession}
            onClick={() => setActiveProject(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
