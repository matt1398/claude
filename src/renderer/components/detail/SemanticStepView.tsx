import React from 'react';
import type { SemanticStep } from '../../types/data';
import { STEP_ICONS, STEP_COLORS } from '../icons/StepIcons';

interface SemanticStepViewProps {
  step: SemanticStep;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void; // For debug sidebar
  onSubagentClick?: (subagentId: string, description: string) => void; // For drill-down
}

export const SemanticStepView: React.FC<SemanticStepViewProps> = ({
  step,
  isExpanded,
  onToggle,
  onSelect,
  onSubagentClick
}) => {
  // Get the icon component and color for this step type
  const Icon = STEP_ICONS[step.type];
  const iconColor = STEP_COLORS[step.type];

  const colors: Record<SemanticStep['type'], string> = {
    thinking: 'bg-purple-900/40 text-purple-300',
    tool_call: 'bg-amber-900/40 text-amber-300',
    tool_result: 'bg-amber-900/30 text-amber-200',
    subagent: 'bg-green-900/40 text-green-300',
    output: 'bg-blue-900/40 text-blue-300',
    interruption: 'bg-red-900/40 text-red-300',
  };

  // Determine if this is a clickable subagent step
  const isClickableSubagent = step.type === 'subagent' && onSubagentClick && step.content.subagentId;

  return (
    <div className={`rounded-lg border border-gray-700 ${colors[step.type]} ${isClickableSubagent ? 'cursor-pointer' : ''}`}>
      <button
        onClick={() => {
          if (isClickableSubagent) {
            // If it's a clickable subagent, trigger drill-down
            onSubagentClick(
              step.content.subagentId!,
              step.content.subagentDescription || 'Subagent'
            );
          } else {
            // Otherwise, toggle expansion
            onToggle();
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-2 transition-opacity ${
          isClickableSubagent ? 'hover:bg-green-900/20' : 'hover:opacity-80'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} color={iconColor} className="mt-0.5 flex-shrink-0" />
          <span className="font-medium capitalize">{step.type.replace('_', ' ')}</span>
          {step.content.toolName && (
            <code className="text-xs bg-gray-800 px-1 rounded">
              {step.content.toolName}
            </code>
          )}
          {isClickableSubagent && (
            <span className="text-xs text-green-400" title="Click to drill down">
              🔍 Click to view
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {step.tokens && (
            <span>{step.tokens.output.toLocaleString()} tokens</span>
          )}
          <span>{step.durationMs}ms</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="hover:text-gray-200 transition-colors"
            title="Show debug info"
          >
            🔍
          </button>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-gray-700/50 text-sm">
          {step.type === 'thinking' && step.content.thinkingText && (
            <pre className="whitespace-pre-wrap text-gray-300 font-mono text-xs">
              {step.content.thinkingText}
            </pre>
          )}

          {step.type === 'output' && step.content.outputText && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-gray-300 whitespace-pre-wrap">
                {step.content.outputText}
              </div>
            </div>
          )}

          {step.type === 'tool_call' && (
            <div className="space-y-2">
              {step.content.toolName && (
                <div>
                  <span className="text-gray-400 text-xs font-medium">Tool:</span>{' '}
                  <code className="text-amber-300 text-xs">{step.content.toolName}</code>
                </div>
              )}
              {step.content.toolInput ? (
                <div>
                  <div className="text-gray-400 text-xs font-medium mb-1">Input:</div>
                  <pre className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(step.content.toolInput as Record<string, unknown>, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}

          {step.type === 'tool_result' && (
            <div className="space-y-2">
              {step.content.isError && (
                <div className="text-red-400 text-xs font-medium">Error</div>
              )}
              {step.content.toolResultContent && (
                <div>
                  <div className="text-gray-400 text-xs font-medium mb-1">Result:</div>
                  <pre className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto">
                    {step.content.toolResultContent}
                  </pre>
                </div>
              )}
            </div>
          )}

          {step.type === 'subagent' && (
            <div className="space-y-2">
              {step.content.subagentId && (
                <div>
                  <span className="text-gray-400 text-xs font-medium">Agent ID:</span>{' '}
                  <code className="text-green-300 text-xs">{step.content.subagentId}</code>
                </div>
              )}
              {step.content.subagentDescription && (
                <div>
                  <div className="text-gray-400 text-xs font-medium mb-1">Description:</div>
                  <p className="text-gray-300 text-xs">{step.content.subagentDescription}</p>
                </div>
              )}
              {step.tokens && (
                <div className="text-gray-400 text-xs">
                  <span className="font-medium">Tokens:</span>{' '}
                  {step.tokens.input.toLocaleString()} in / {step.tokens.output.toLocaleString()} out
                  {step.tokens.cached && step.tokens.cached > 0 && (
                    <span> ({step.tokens.cached.toLocaleString()} cached)</span>
                  )}
                </div>
              )}
              {step.isParallel && (
                <div className="text-green-400 text-xs font-medium">
                  ⚡ Executed in parallel
                </div>
              )}
            </div>
          )}

          {step.type === 'interruption' && (
            <div className="text-red-300 text-xs">
              User interrupted the execution
            </div>
          )}
        </div>
      )}
    </div>
  );
};
