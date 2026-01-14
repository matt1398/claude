import React, { useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { ChunkView } from './ChunkView';
import { GanttChart } from './GanttChart';
import { groupIntoSegments } from '../../utils/segmentGrouping';
import { isEnhancedAIChunk, EnhancedAIChunk } from '../../types/data';

export const SubagentDetailModal: React.FC = () => {
  const {
    drillDownStack,
    currentSubagentDetail,
    subagentDetailLoading,
    subagentDetailError,
    selectedProjectId,
    selectedSessionId,
    drillDownSubagent,
    navigateToBreadcrumb,
    closeSubagentModal,
  } = useStore();

  // Modal is visible if there's a drill-down stack
  const isVisible = drillDownStack.length > 0;

  // Handler for nested subagent drill-down
  const handleNestedSubagentClick = (subagentId: string, description: string) => {
    if (selectedProjectId && selectedSessionId) {
      // For nested subagents, we use the current subagent's ID as the parent sessionId
      const parentSubagentId = currentSubagentDetail?.id || selectedSessionId;
      drillDownSubagent(selectedProjectId, parentSubagentId, subagentId, description);
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        closeSubagentModal();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible, closeSubagentModal]);

  // Create segments from all chunks for the timeline view
  const segments = useMemo(() => {
    if (!currentSubagentDetail || !currentSubagentDetail.chunks) return [];

    // Filter to only AI chunks (which have semanticSteps, subagents, toolExecutions)
    const aiChunks = currentSubagentDetail.chunks.filter(
      (c): c is EnhancedAIChunk => isEnhancedAIChunk(c)
    );

    if (aiChunks.length === 0) return [];

    // Combine all AI chunks' steps into a single timeline
    const allSteps = aiChunks.flatMap(c => c.semanticSteps);

    // Create a mock chunk for grouping
    const mockChunk = {
      ...aiChunks[0],
      semanticSteps: allSteps,
      subagents: aiChunks.flatMap(c => c.subagents),
      toolExecutions: aiChunks.flatMap(c => c.toolExecutions),
    };

    return groupIntoSegments(allSteps, mockChunk);
  }, [currentSubagentDetail]);

  if (!isVisible) return null;

  const formatTokens = (inputTokens: number, outputTokens: number, cached?: number) => {
    const total = inputTokens + outputTokens;
    return `${total.toLocaleString()}${cached && cached > 0 ? ` (${cached.toLocaleString()} cached)` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={closeSubagentModal}
      />

      {/* Modal Container */}
      <div className="relative w-[90vw] h-[90vh] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-100">Subagent Execution</h2>
            <button
              onClick={closeSubagentModal}
              className="text-gray-400 hover:text-gray-200 transition-colors p-1"
              title="Close (ESC)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <button
              onClick={() => navigateToBreadcrumb(0)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              Main Session
            </button>

            {drillDownStack.map((item, index) => (
              <React.Fragment key={item.id}>
                <span className="text-gray-500">›</span>
                {index === drillDownStack.length - 1 ? (
                  <span className="text-sm text-gray-300 font-medium whitespace-nowrap">
                    {item.description}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateToBreadcrumb(index + 1)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                  >
                    {item.description}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {subagentDetailLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-400">Loading subagent details...</p>
              </div>
            </div>
          )}

          {subagentDetailError && (
            <div className="p-6">
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
                <h3 className="font-semibold mb-2">Error loading subagent</h3>
                <p>{subagentDetailError}</p>
              </div>
            </div>
          )}

          {!subagentDetailLoading && !subagentDetailError && currentSubagentDetail && (
            <div className="p-6 space-y-6">
              {/* Metrics Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {(currentSubagentDetail.duration / 1000).toFixed(2)}s
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Chunks</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {currentSubagentDetail.chunks.length}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Messages</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {currentSubagentDetail.metrics.messageCount}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Tokens</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {formatTokens(
                      currentSubagentDetail.metrics.inputTokens,
                      currentSubagentDetail.metrics.outputTokens
                    )}
                  </p>
                </div>
              </div>

              {/* Gantt Chart Overview */}
              {segments.length > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-300 mb-3">Execution Timeline</div>
                  <GanttChart
                    segments={segments}
                    height={Math.max(300, segments.length * 40)}
                  />
                </div>
              )}

              {/* Chunks Detail */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200">
                  Execution Details ({currentSubagentDetail.chunks.length} chunks)
                </h3>
                {currentSubagentDetail.chunks.map((chunk, index) => (
                  <ChunkView
                    key={chunk.id}
                    chunk={chunk}
                    index={index}
                    onSubagentClick={handleNestedSubagentClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer (optional) */}
        {currentSubagentDetail && (
          <div className="flex-shrink-0 px-6 py-3 border-t border-gray-700 bg-gray-800/50 text-xs text-gray-500">
            Subagent ID: {currentSubagentDetail.id}
          </div>
        )}
      </div>
    </div>
  );
};
