import { useState, useMemo } from 'react';
import {
  Chunk,
  ContentBlock,
  EnhancedChunk,
  EnhancedAIChunk,
  EnhancedUserChunk,
  SemanticStep,
  ConversationGroup,
  ToolResult,
  isUserChunk,
  isAIChunk,
  isEnhancedAIChunk,
} from '../../types/data';
import { SemanticStepView } from './SemanticStepView';
import { groupIntoSegments } from '../../utils/segmentGrouping';

type ChunkType = Chunk | EnhancedChunk | ConversationGroup;

interface ChunkViewProps {
  chunk: ChunkType;
  index: number;
  onSubagentClick?: (subagentId: string, description: string) => void;
}

export const ChunkView: React.FC<ChunkViewProps> = ({ chunk, index, onSubagentClick }) => {
  // Type guard to check if chunk is a ConversationGroup
  const isConversationGroup = (c: ChunkType): c is ConversationGroup => {
    return 'type' in c && c.type === 'user-ai-exchange' && 'aiResponses' in c;
  };

  // Type guard to check if chunk is an EnhancedAIChunk (new separated chunks)
  // Uses 'chunkType' discriminator to avoid ConversationGroup confusion
  const isEnhancedAI = (c: ChunkType): c is EnhancedAIChunk => {
    return 'chunkType' in c && c.chunkType === 'ai' && 'semanticSteps' in c;
  };

  // Type guard to check if chunk is an EnhancedUserChunk
  const isEnhancedUser = (c: ChunkType): c is EnhancedUserChunk => {
    return 'chunkType' in c && c.chunkType === 'user' && 'userMessage' in c;
  };

  // Type guard for any chunk with semantic steps (only EnhancedAIChunk has them)
  const hasSemanticSteps = (c: ChunkType): c is EnhancedAIChunk => {
    return isEnhancedAI(c);
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [showToolResults, setShowToolResults] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<{ data: unknown; title: string } | null>(null);
  const [chartMode, setChartMode] = useState<'timeline' | 'context'>('timeline');

  // Group semantic steps into segments for visualization
  const segments = useMemo(() => {
    if (!hasSemanticSteps(chunk)) return [];
    return groupIntoSegments(chunk.semanticSteps, chunk);
  }, [chunk]);

  // Get responses array (handles all chunk types)
  const getResponses = () => {
    if (isConversationGroup(chunk)) {
      return chunk.aiResponses;
    }
    if (isAIChunk(chunk)) {
      return chunk.responses;
    }
    return [];
  };

  const responses = getResponses();

  // Get processes array (handles all chunk types)
  const getProcesses = () => {
    if (isConversationGroup(chunk)) {
      return chunk.processes;
    }
    if (isAIChunk(chunk)) {
      return chunk.processes;
    }
    return [];
  };

  const processes = getProcesses();

  // Filter to only processes that have subagentType (these are true subagents)
  const subagents = processes.filter((p: any) => p.subagentType);
  const hasSubagents = subagents.length > 0;
  const parallelSubagents = subagents.filter((s: any) => s.isParallel);

  // Get tool executions array (handles all chunk types)
  const getToolExecutions = () => {
    if (isConversationGroup(chunk)) {
      return chunk.toolExecutions;
    }
    if (isAIChunk(chunk)) {
      return chunk.toolExecutions;
    }
    return [];
  };

  // Get user message (if available)
  const getUserMessage = () => {
    if (isConversationGroup(chunk)) {
      return chunk.userMessage;
    }
    if (isUserChunk(chunk)) {
      return chunk.userMessage;
    }
    return null;
  };

  const userMessage = getUserMessage();

  // Helper to get step label
  const getStepLabel = (step: SemanticStep): string => {
    switch (step.type) {
      case 'thinking':
        return 'Thinking';
      case 'tool_call':
        return step.content.toolName || 'Tool Call';
      case 'tool_result':
        return `Result: ${step.content.isError ? '❌' : '✓'}`;
      case 'subagent':
        return step.content.subagentDescription || 'Subagent';
      case 'output':
        return 'Output';
      case 'interruption':
        return 'Interruption';
    }
  };

  // Toggle step expansion
  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatTokens = (inputTokens: number, outputTokens: number, cacheReadTokens?: number) => {
    const total = inputTokens + outputTokens;
    const cached = cacheReadTokens || 0;
    return `${total.toLocaleString()}${cached > 0 ? ` (${cached.toLocaleString()} cached)` : ''}`;
  };

  const extractTextContent = (content: ContentBlock[] | string): string => {
    if (typeof content === 'string') return content;

    const textBlocks = content
      .filter((block: ContentBlock) => block.type === 'text' && block.text)
      .map((block: ContentBlock) => block.text)
      .join(' ');

    return textBlocks || 'No text content';
  };

  // Get user message text (or empty for AI-only chunks)
  const userMessageText = userMessage ? extractTextContent(userMessage.content) : '';

  // Separate responses into assistant messages and tool results
  const assistantResponses = responses.filter((r: any) => r.type === 'assistant');
  const toolResults = responses.filter((r: any) => r.isMeta === true);


  // Check if this is a ConversationGroup with task executions
  const hasTaskExecutions = isConversationGroup(chunk) && chunk.taskExecutions.length > 0;
  const taskExecutionCount = isConversationGroup(chunk) ? chunk.taskExecutions.length : 0;

  // Determine chunk type label
  const getChunkTypeLabel = () => {
    if (isConversationGroup(chunk)) return 'Group';
    if (isUserChunk(chunk)) return 'User';
    if (isAIChunk(chunk)) return 'AI';
    return 'Chunk';
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/30">
      {/* Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-300">
                {getChunkTypeLabel()} {index + 1}
              </h3>
              {hasSubagents && (
                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">
                  {subagents.length} subagent{subagents.length !== 1 ? 's' : ''}
                </span>
              )}
              {parallelSubagents.length > 0 && (
                <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">
                  {parallelSubagents.length} parallel
                </span>
              )}
              {hasTaskExecutions && (
                <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded">
                  {taskExecutionCount} task{taskExecutionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {userMessageText && (
              <p className="text-sm text-gray-400 line-clamp-2">{userMessageText}</p>
            )}
            {isEnhancedAI(chunk) && !userMessageText && (
              <p className="text-sm text-gray-400 line-clamp-2">AI Response</p>
            )}
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
          <p className="text-sm font-medium text-gray-200">{responses.length}</p>
        </div>
        <div className="bg-gray-800/30 px-4 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Tokens</p>
          <p className="text-sm font-medium text-gray-200">
            {formatTokens(chunk.metrics.inputTokens, chunk.metrics.outputTokens, chunk.metrics.cacheReadTokens)}
          </p>
        </div>
      </div>

      {/* Timeline Visualization - Enhanced or Legacy */}
      {hasSemanticSteps(chunk) && chunk.semanticSteps.length > 0 ? (
        <div className="px-4 py-4 bg-gray-900/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">Execution Timeline</div>
            <button
              onClick={() => {
                const debugData = hasSemanticSteps(chunk) ? chunk.rawMessages : chunk;
                const debugTitle = isConversationGroup(chunk)
                  ? `Group ${index + 1} Data`
                  : `${getChunkTypeLabel()} ${index + 1} Raw Messages`;
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Debug JSON
            </button>
          </div>

          {/* Chart Overview with Mode Toggle */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-gray-300">Overview</div>
              <div className="flex gap-1 bg-gray-900/50 rounded p-0.5">
                <button
                  onClick={() => setChartMode('timeline')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    chartMode === 'timeline'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setChartMode('context')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    chartMode === 'context'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Context Length
                </button>
              </div>
            </div>
          </div>

          {/* Semantic Steps Detail - No groups, just individual steps */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-300 mb-2">
              Execution Steps ({chunk.semanticSteps.length})
            </div>
            {chunk.semanticSteps.map((step: SemanticStep) => (
              <SemanticStepView
                key={step.id}
                step={step}
                isExpanded={expandedSteps.has(step.id)}
                onToggle={() => toggleStep(step.id)}
                onSelect={() => {}}
                onSubagentClick={onSubagentClick}
              />
            ))}
          </div>
        </div>
      ) : hasSubagents ? (
        <div className="px-4 py-4 bg-gray-900/30">
          <div className="text-xs text-gray-400 mb-2">Execution Timeline (Legacy)</div>

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
          {subagents.map((subagent: any) => {
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
      ) : null}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-700 space-y-4">
          {/* User Message - only show if we have a user message (not for AI-only chunks) */}
          {userMessage && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">User Message</h4>
              <div className="bg-gray-900/50 rounded p-3">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{userMessageText}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(userMessage.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Assistant Responses */}
          {assistantResponses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">
                Assistant Responses ({assistantResponses.length})
              </h4>
              <div className="space-y-2">
                {assistantResponses.map((response: any, idx: number) => (
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
          )}

          {/* Tool Results */}
          {toolResults.length > 0 && (
            <div>
              <button
                onClick={() => setShowToolResults(!showToolResults)}
                className="w-full flex items-center justify-between text-left mb-2 hover:bg-gray-900/30 rounded p-2 transition-colors"
              >
                <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                  Tool Results
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    {toolResults.length}
                  </span>
                </h4>
                <svg
                  className={`w-4 h-4 text-gray-400 transform transition-transform ${showToolResults ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showToolResults && (
                <div className="space-y-2 bg-gray-900/30 rounded p-3">
                  {toolResults.map((result: any, idx: number) => {
                    // Get error status from toolUseResult or toolResults array
                    const hasError = result.toolUseResult?.success === false ||
                                   result.toolResults.some((tr: ToolResult) => tr.isError);

                    // Get command/tool name from toolUseResult or toolResults
                    const commandName = result.toolUseResult?.commandName ||
                                      (result.toolResults.length > 0 ? result.toolResults[0].toolUseId : undefined) ||
                                      result.sourceToolUseID;

                    return (
                      <div
                        key={result.uuid}
                        className="bg-gray-800/50 rounded p-3 border border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm ${hasError ? 'text-red-400' : 'text-green-400'}`}
                            >
                              {hasError ? '✗' : '✓'}
                            </span>
                            <span className="text-xs font-medium text-gray-300">
                              {commandName || `Tool ${idx + 1}`}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(result.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          <span className="text-gray-500">Status:</span>{' '}
                          <span className={hasError ? 'text-red-400' : 'text-green-400'}>
                            {hasError ? 'Error' : 'Success'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subagents Details */}
          {hasSubagents && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">
                Subagents ({subagents.length})
              </h4>
              <div className="space-y-2">
                {subagents.map((subagent: any) => (
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

          {/* Task Executions (ConversationGroup only) */}
          {hasTaskExecutions && isConversationGroup(chunk) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">
                Task Executions ({chunk.taskExecutions.length})
              </h4>
              <div className="space-y-2">
                {chunk.taskExecutions.map((taskExec: any) => (
                  <div key={taskExec.taskCall.id} className="bg-gray-900/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-300">
                        {taskExec.taskCall.taskDescription || taskExec.subagent.description || 'Task'}
                      </span>
                      {taskExec.subagent.isParallel && (
                        <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">
                          Parallel
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-gray-400">
                      <div>
                        <span className="text-gray-500">Type:</span>{' '}
                        {taskExec.taskCall.taskSubagentType || 'Unknown'}
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>{' '}
                        {(taskExec.durationMs / 1000).toFixed(2)}s
                      </div>
                      <div>
                        <span className="text-gray-500">Messages:</span>{' '}
                        {taskExec.subagent.messages.length}
                      </div>
                      <div>
                        <span className="text-gray-500">Tokens:</span>{' '}
                        {formatTokens(
                          taskExec.subagent.metrics.inputTokens,
                          taskExec.subagent.metrics.outputTokens,
                          taskExec.subagent.metrics.cacheReadTokens
                        )}
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
