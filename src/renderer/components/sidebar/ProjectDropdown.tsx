/**
 * ProjectDropdown - Dropdown component for switching between projects.
 * Shows list of available projects and allows selection.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FolderGit2, Check } from 'lucide-react';
import { useStore } from '../../store';

export function ProjectDropdown() {
  const { projects, activeProjectId, setActiveProject } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

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
          {projects.length === 0 ? (
            <div className="px-3 py-2 text-sm text-claude-dark-text-secondary">
              No projects found
            </div>
          ) : (
            projects.map((project) => {
              const isSelected = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-claude-dark-border/50 transition-colors ${
                    isSelected ? 'bg-claude-dark-border/30' : ''
                  }`}
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
                    </div>
                    <div className="text-xs text-claude-dark-text-secondary truncate">
                      {project.path}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
