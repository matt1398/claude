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
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-zinc-800/50 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-400 text-sm">
          <p className="font-semibold mb-1 text-zinc-300">Error loading projects</p>
          <p>{projectsError}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-4">
        <div className="text-zinc-400 text-sm text-center py-8">
          <p className="mb-2">No projects found</p>
          <p className="text-xs text-zinc-500">
            Projects will appear here once you use Claude Code
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">Projects</h2>
        <p className="text-xs text-zinc-600 mt-0.5">{projects.length} total</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => selectProject(project.id)}
            className={`
              w-full text-left px-4 py-3 transition-colors duration-150
              ${selectedProjectId === project.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${selectedProjectId === project.id ? 'text-zinc-100' : 'text-zinc-300'}`}>
                  {project.name.split('/').pop() || project.name}
                </h3>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {project.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                  {project.sessions.length}
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
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
