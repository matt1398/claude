/**
 * ProjectDropdown - Dropdown component for switching between projects.
 * Shows list of available projects grouped by repository/worktree.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, FolderGit2, Check, GitBranch } from 'lucide-react';
import { useStore } from '../../store';
import type { ProjectGroup } from '../../types/data';

export function ProjectDropdown() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    projectGroups,
    fetchProjectGroups,
    toggleProjectGroupExpansion,
    expandedProjectGroupIds
  } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Fetch project groups on mount if empty
  useEffect(() => {
    if (projectGroups.length === 0) {
      fetchProjectGroups();
    }
  }, [projectGroups.length, fetchProjectGroups]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (projectId: string) => {
    setActiveProject(projectId);
    setIsOpen(false);
  };

  const handleGroupToggle = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    toggleProjectGroupExpansion(groupId);
  };

  /**
   * Extract worktree ID from project path if it's a worktree.
   * Worktrees typically have paths like: .../worktrees/vk-1116-support-git-work/ProjectName
   * Returns the worktree branch/ID portion or null if not a worktree.
   */
  const getWorktreeId = (projectPath: string, mainRepoPath?: string): string | null => {
    if (!mainRepoPath) return null;
    // If the project path doesn't start with main repo path, it's likely a worktree
    if (!projectPath.startsWith(mainRepoPath)) {
      // Try to extract worktree ID from path
      const worktreeMatch = projectPath.match(/worktrees\/([^/]+)/);
      if (worktreeMatch) {
        return worktreeMatch[1];
      }
    }
    return null;
  };

  /**
   * Render a single project item
   */
  const renderProjectItem = (
    project: typeof projects[0],
    isIndented: boolean = false,
    worktreeId: string | null = null
  ) => {
    const isSelected = project.id === activeProjectId;
    return (
      <button
        key={project.id}
        onClick={() => handleSelect(project.id)}
        className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-claude-dark-border/50 transition-colors ${
          isSelected ? 'bg-claude-dark-border/30' : ''
        } ${isIndented ? 'ml-4' : ''}`}
        title={project.path}
      >
        {isSelected ? (
          <Check className="w-4 h-4 text-claude-dark-text flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-claude-dark-text truncate">
            {project.name}
            {worktreeId && (
              <span className="text-claude-dark-text-secondary font-normal ml-1">
                ({worktreeId})
              </span>
            )}
          </div>
          <div className="text-xs text-claude-dark-text-secondary truncate">
            {project.path}
          </div>
        </div>
      </button>
    );
  };

  /**
   * Render a project group (either single project or expandable group)
   */
  const renderProjectGroup = (group: ProjectGroup) => {
    // Single-project group (no worktrees) - render same as individual project
    if (group.worktreeCount === 0 && group.projects.length === 1) {
      return renderProjectItem(group.projects[0], false, null);
    }

    // Multi-project group with worktrees
    const isExpanded = expandedProjectGroupIds.has(group.id);

    return (
      <div key={group.id}>
        {/* Group header */}
        <button
          onClick={(e) => handleGroupToggle(e, group.id)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-claude-dark-border/50 transition-colors bg-claude-dark-bg/50"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
          )}
          <GitBranch className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
          <span className="text-sm font-semibold text-claude-dark-text truncate flex-1">
            {group.displayName}
          </span>
          <span className="text-xs bg-claude-dark-border px-1.5 py-0.5 rounded text-claude-dark-text-secondary">
            {group.worktreeCount}
          </span>
        </button>

        {/* Expanded project list */}
        {isExpanded && (
          <div className="border-l border-claude-dark-border ml-3">
            {group.projects.map((project) => {
              const worktreeId = getWorktreeId(project.path, group.mainRepoPath);
              return renderProjectItem(project, true, worktreeId);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={dropdownRef} className="relative flex-1 min-w-0">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md hover:bg-claude-dark-surface transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title={activeProject?.path || 'Select a project'}
      >
        <FolderGit2 className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
        <span className="text-sm font-medium text-claude-dark-text truncate flex-1 text-left">
          {activeProject?.name || 'Select Project'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-claude-dark-text-secondary flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-claude-dark-surface border border-claude-dark-border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
          {projectGroups.length === 0 ? (
            <div className="px-3 py-2 text-sm text-claude-dark-text-secondary">
              No projects found
            </div>
          ) : (
            projectGroups.map((group) => renderProjectGroup(group))
          )}
        </div>
      )}
    </div>
  );
}
