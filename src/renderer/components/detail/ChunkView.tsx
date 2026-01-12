import { useState } from 'react';
import { Chunk, ContentBlock } from '../../types/data';

interface ChunkViewProps {
  chunk: Chunk;
  index: number;
}

export const ChunkView: React.FC<ChunkViewProps> = ({ chunk, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTokens = (inputTokens: number, outputTokens: number, cacheReadTokens?: number) => {
    const total = inputTokens + outputTokens;
    const cached = cacheReadTokens || 0;
    return `${total.toLocaleString()}${cached > 0 ? ` (${cached.toLocaleString()} cached)` : ''}`;
  };

  const extractTextContent = (content: ContentBlock[] | string): string => {
    if (typeof content === 'string') return content;

    const textBlocks = content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join(' ');

    return textBlocks || 'No text content';
  };

  const userMessageText = extractTextContent(chunk.userMessage.content);

  const hasSubagents = chunk.subagents.length > 0;
  const parallelSubagents = chunk.subagents.filter((s) => s.isParallel);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/30">
      {/* Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-300">Chunk {index + 1}</h3>
              {hasSubagents && (
                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">
                  {chunk.subagents.length} subagent{chunk.subagents.length !== 1 ? 's' : ''}
                </span>
              )}
              {parallelSubagents.length > 0 && (
                <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">
                  {parallelSubagents.length} parallel
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{userMessageText}</p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-px bg-gray-700">
        <div className="bg-gray-800/30 px-4 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Duration</p>
          <p className="text-sm font-medium text-gray-200">
            {(chunk.durationMs / 1000).toFixed(2)}s
          </p>
        </div>
        <div className="bg-gray-800/30 px-4 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Responses</p>
          <p className="text-sm font-medium text-gray-200">{chunk.responses.length}</p>
        </div>
        <div className="bg-gray-800/30 px-4 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Tokens</p>
          <p className="text-sm font-medium text-gray-200">
            {formatTokens(chunk.metrics.inputTokens, chunk.metrics.outputTokens, chunk.metrics.cacheReadTokens)}
          </p>
        </div>
      </div>

      {/* Timeline Visualization */}
      {hasSubagents && (
        <div className="px-4 py-4 bg-gray-900/30">
          <div className="text-xs text-gray-400 mb-2">Execution Timeline</div>

          {/* Main execution bar */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">Main Session</span>
              <span className="text-xs text-gray-500">{(chunk.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="h-6 bg-blue-600 rounded relative">
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                {formatTokens(chunk.metrics.inputTokens, chunk.metrics.outputTokens, chunk.metrics.cacheReadTokens)} tokens
              </div>
            </div>
          </div>

          {/* Subagent bars */}
          {chunk.subagents.map((subagent) => {
            const startOffset =
              ((subagent.startTime.getTime() - chunk.startTime.getTime()) / chunk.durationMs) * 100;
            const width = (subagent.durationMs / chunk.durationMs) * 100;

            return (
              <div key={subagent.id} className="mb-2 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">
                    {subagent.description || subagent.subagentType || subagent.id}
                  </span>
                  <span className="text-xs text-gray-500">{(subagent.durationMs / 1000).toFixed(1)}s</span>
                  {subagent.isParallel && <span className="text-xs text-blue-400">parallel</span>}
                </div>
                <div className="h-5 bg-gray-700 rounded relative">
                  <div
                    className="absolute h-full bg-green-600 rounded"
                    style={{
                      left: `${Math.max(0, Math.min(startOffset, 100))}%`,
                      width: `${Math.max(0, Math.min(width, 100 - startOffset))}%`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white">
                      {formatTokens(subagent.metrics.inputTokens, subagent.metrics.outputTokens, subagent.metrics.cacheReadTokens)} tokens
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-700 space-y-4">
          {/* User Message */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">User Message</h4>
            <div className="bg-gray-900/50 rounded p-3">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{userMessageText}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(chunk.userMessage.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Assistant Responses */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">
              Responses ({chunk.responses.length})
            </h4>
            <div className="space-y-2">
              {chunk.responses.map((response, idx) => (
                <div key={response.uuid} className="bg-gray-900/50 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Response {idx + 1}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(response.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {response.usage && (
                    <p className="text-xs text-gray-400">
                      Tokens:{' '}
                      {formatTokens(
                        response.usage.input_tokens,
                        response.usage.output_tokens,
                        response.usage.cache_read_input_tokens
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Subagents Details */}
          {hasSubagents && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">
                Subagents ({chunk.subagents.length})
              </h4>
              <div className="space-y-2">
                {chunk.subagents.map((subagent) => (
                  <div key={subagent.id} className="bg-gray-900/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-300">
                        {subagent.description || subagent.subagentType || subagent.id}
                      </span>
                      {subagent.isParallel && (
                        <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">
                          Parallel
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                      <div>
                        <span className="text-gray-500">Duration:</span>{' '}
                        {(subagent.durationMs / 1000).toFixed(2)}s
                      </div>
                      <div>
                        <span className="text-gray-500">Messages:</span> {subagent.messages.length}
                      </div>
                      <div>
                        <span className="text-gray-500">Tokens:</span>{' '}
                        {formatTokens(subagent.metrics.inputTokens, subagent.metrics.outputTokens, subagent.metrics.cacheReadTokens)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
