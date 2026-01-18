/**
 * RecentProjectsGrid - Displays a grid of recent projects with support for grouped display.
 * Single-project groups render as individual cards.
 * Multi-project groups (worktrees) show as expandable group cards.
 */

import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FolderGit2, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { useStore } from '../../store';
import type { ProjectGroup } from '../../types/data';

interface ProjectCardProps {
  id: string;
  name: string;
  path: string;
  lastOpened?: number;
  onClick: () => void;
  indented?: boolean;
}

function ProjectCard({ name, path, lastOpened, onClick, indented = false }: ProjectCardProps) {
  const lastActivity = lastOpened
    ? formatDistanceToNow(new Date(lastOpened), { addSuffix: true })
    : 'No recent activity';

  return (
    <button
      onClick={onClick}
      className={`flex flex-col p-4 bg-claude-dark-surface border border-claude-dark-border rounded-lg hover:border-claude-dark-text-secondary/50 transition-colors text-left group min-w-0 overflow-hidden ${indented ? 'ml-4' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <FolderGit2 className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
        <span className="text-sm font-medium text-claude-dark-text truncate min-w-0">
          {name}
        </span>
      </div>
      <span className="text-xs text-claude-dark-text-secondary mb-2 min-w-0 block break-all line-clamp-2" title={path}>
        {path}
      </span>
      <span className="text-xs text-claude-dark-text-secondary/70">
        {lastActivity}
      </span>
    </button>
  );
}

interface ProjectGroupCardProps {
  group: ProjectGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onProjectClick: (projectId: string) => void;
}

function ProjectGroupCard({ group, isExpanded, onToggle, onProjectClick }: ProjectGroupCardProps) {
  const lastActivity = group.mostRecentSession
    ? formatDistanceToNow(new Date(group.mostRecentSession), { addSuffix: true })
    : 'No recent activity';

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="col-span-1">
      {/* Group Header Card */}
      <button
        onClick={onToggle}
        className="w-full flex flex-col p-4 bg-claude-dark-surface border border-claude-dark-border rounded-lg hover:border-claude-dark-text-secondary/50 transition-colors text-left group min-w-0 overflow-hidden"
      >
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <ChevronIcon className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
          <FolderGit2 className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
          <span className="text-sm font-medium text-claude-dark-text truncate min-w-0">
            {group.displayName}
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-claude-dark-border rounded text-xs text-claude-dark-text-secondary flex-shrink-0">
            <GitBranch className="w-3 h-3" />
            +{group.worktreeCount}
          </span>
        </div>
        {group.mainRepoPath && (
          <span className="text-xs text-claude-dark-text-secondary mb-2 min-w-0 block break-all line-clamp-2" title={group.mainRepoPath}>
            {group.mainRepoPath}
          </span>
        )}
        <span className="text-xs text-claude-dark-text-secondary/70">
          {lastActivity}
        </span>
      </button>

      {/* Expanded Projects List */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {group.projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              path={project.path}
              lastOpened={project.mostRecentSession}
              onClick={() => onProjectClick(project.id)}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RecentProjectsGridProps {
  maxProjects?: number;
}

export function RecentProjectsGrid({ maxProjects = 6 }: RecentProjectsGridProps) {
  const {
    projectGroups,
    projectGroupsLoading,
    expandedProjectGroupIds,
    fetchProjectGroups,
    toggleProjectGroupExpansion,
    setActiveProject
  } = useStore();

  // Fetch project groups on mount
  useEffect(() => {
    fetchProjectGroups();
  }, [fetchProjectGroups]);

  // Slice to get recent groups (based on mostRecentSession)
  const recentGroups = projectGroups.slice(0, maxProjects);

  if (projectGroupsLoading) {
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

  if (recentGroups.length === 0) {
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-fr">
        {recentGroups.map((group) => {
          // Single-project groups (no worktrees): render as individual project card
          if (group.worktreeCount === 0 && group.projects.length === 1) {
            const project = group.projects[0];
            return (
              <ProjectCard
                key={group.id}
                id={project.id}
                name={project.name}
                path={project.path}
                lastOpened={project.mostRecentSession}
                onClick={() => setActiveProject(project.id)}
              />
            );
          }

          // Multi-project groups (with worktrees): render as expandable group card
          return (
            <ProjectGroupCard
              key={group.id}
              group={group}
              isExpanded={expandedProjectGroupIds.has(group.id)}
              onToggle={() => toggleProjectGroupExpansion(group.id)}
              onProjectClick={setActiveProject}
            />
          );
        })}
      </div>
    </div>
  );
}
