import { useStore } from '../../store';
import { format, formatDistanceToNow } from 'date-fns';

export const SessionsList: React.FC = () => {
  const {
    sessions,
    selectedSessionId,
    selectedProjectId,
    sessionsLoading,
    sessionsError,
    selectSession
  } = useStore();

  if (!selectedProjectId) {
    return (
      <div className="p-4">
        <div className="text-zinc-500 text-sm text-center py-8">
          <p>Select a project to view sessions</p>
        </div>
      </div>
    );
  }

  if (sessionsLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-zinc-800/50 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-400 text-sm">
          <p className="font-semibold mb-1 text-zinc-300">Error loading sessions</p>
          <p>{sessionsError}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4">
        <div className="text-zinc-400 text-sm text-center py-8">
          <p className="mb-2">No sessions found</p>
          <p className="text-xs text-zinc-500">
            This project has no sessions yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">Sessions</h2>
        <p className="text-xs text-zinc-600 mt-0.5">{sessions.length} total</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => selectSession(session.id)}
            className={`
              w-full text-left px-4 py-3 transition-colors duration-150
              ${selectedSessionId === session.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 mb-1">
                  {format(new Date(session.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
                <p className={`text-sm line-clamp-2 ${selectedSessionId === session.id ? 'text-zinc-200' : 'text-zinc-300'}`}>
                  {session.firstMessage || 'Empty session'}
                </p>
              </div>
              {session.hasSubagents && (
                <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded flex-shrink-0">
                  Subagents
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span>{session.messageCount} messages</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
