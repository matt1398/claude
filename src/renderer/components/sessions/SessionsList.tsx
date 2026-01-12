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

  console.log('[SessionsList] Render - selectedProjectId:', selectedProjectId);
  console.log('[SessionsList] Render - sessions:', sessions);
  console.log('[SessionsList] Render - sessions.length:', sessions.length);
  console.log('[SessionsList] Render - sessionsLoading:', sessionsLoading);
  console.log('[SessionsList] Render - sessionsError:', sessionsError);

  if (!selectedProjectId) {
    console.log('[SessionsList] Returning: No project selected');
    return (
      <div className="p-4">
        <div className="text-gray-400 text-sm text-center py-8">
          <p>Select a project to view sessions</p>
        </div>
      </div>
    );
  }

  if (sessionsLoading) {
    console.log('[SessionsList] Returning: Loading skeleton');
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-gray-800 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionsError) {
    console.log('[SessionsList] Returning: Error state -', sessionsError);
    return (
      <div className="p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
          <p className="font-semibold mb-1">Error loading sessions</p>
          <p>{sessionsError}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    console.log('[SessionsList] Returning: Empty sessions list');
    return (
      <div className="p-4">
        <div className="text-gray-400 text-sm text-center py-8">
          <p className="mb-2">No sessions found</p>
          <p className="text-xs text-gray-500">
            This project has no sessions yet
          </p>
        </div>
      </div>
    );
  }

  console.log('[SessionsList] Returning: Sessions list with', sessions.length, 'sessions');
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Sessions</h2>
        <p className="text-xs text-gray-500 mt-1">{sessions.length} total</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => selectSession(session.id)}
            className={`
              w-full text-left px-4 py-3
              transition-colors duration-150 hover:bg-gray-800/50
              border-l-2
              ${selectedSessionId === session.id
                ? 'bg-gray-800/70 border-green-500'
                : 'border-transparent'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-1">
                  {format(new Date(session.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-sm text-gray-300 line-clamp-2">
                  {session.firstMessage || 'Empty session'}
                </p>
              </div>
              {session.hasSubagents && (
                <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded flex-shrink-0">
                  Subagents
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
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
