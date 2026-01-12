import { useStore } from '../../store';
import { ChunkView } from './ChunkView';
import { formatDuration } from 'date-fns';

export const SessionDetail: React.FC = () => {
  const { 
    sessionDetail,
    selectedSessionId,
    sessionDetailLoading, 
    sessionDetailError 
  } = useStore();

  if (!selectedSessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <svg 
            className="w-16 h-16 mx-auto mb-4 text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <p className="text-lg mb-2">Select a session to view details</p>
          <p className="text-sm text-gray-500">
            Choose a session from the sidebar to see its execution timeline
          </p>
        </div>
      </div>
    );
  }

  if (sessionDetailLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionDetailError) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          <h3 className="font-semibold mb-2 text-lg">Error loading session</h3>
          <p>{sessionDetailError}</p>
        </div>
      </div>
    );
  }

  if (!sessionDetail) {
    return null;
  }

  const { session, chunks, totalDuration, totalTokens } = sessionDetail;

  const formatTokens = (tokens: typeof totalTokens) => {
    const total = tokens.input_tokens + tokens.output_tokens;
    const cached = tokens.cache_read_input_tokens || 0;
    return `${total.toLocaleString()} tokens${cached > 0 ? ` (${cached.toLocaleString()} cached)` : ''}`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              Session Detail
            </h1>
            <p className="text-sm text-gray-400">
              {session.firstMessage}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Total Duration</p>
            <p className="text-lg font-semibold text-gray-200">
              {(totalDuration / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Chunks</p>
            <p className="text-lg font-semibold text-gray-200">
              {chunks.length}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token Usage</p>
            <p className="text-lg font-semibold text-gray-200">
              {formatTokens(totalTokens)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {chunks.map((chunk, index) => (
          <ChunkView key={chunk.id} chunk={chunk} index={index} />
        ))}
      </div>
    </div>
  );
};
