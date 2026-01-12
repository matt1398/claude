import { useEffect } from 'react';
import { useStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';

export const ProjectsList: React.FC = () => {
  const { 
    projects, 
    selectedProjectId,
    projectsLoading, 
    projectsError,
    fetchProjects,
    selectProject 
  } = useStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (projectsLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
          <p className="font-semibold mb-1">Error loading projects</p>
          <p>{projectsError}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-4">
        <div className="text-gray-400 text-sm text-center py-8">
          <p className="mb-2">No projects found</p>
          <p className="text-xs text-gray-500">
            Projects will appear here once you use Claude Code
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Projects</h2>
        <p className="text-xs text-gray-500 mt-1">{projects.length} total</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => selectProject(project.id)}
            className={`
              w-full text-left px-4 py-3 transition-colors duration-150
              hover:bg-gray-800/50 border-l-2
              ${selectedProjectId === project.id 
                ? 'bg-gray-800/70 border-blue-500' 
                : 'border-transparent'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-200 truncate">
                  {project.name.split('/').pop() || project.name}
                </h3>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {project.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                  {project.sessions.length}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {project.mostRecentSession
                ? `Last used ${formatDistanceToNow(new Date(project.mostRecentSession), { addSuffix: true })}`
                : 'No recent activity'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
