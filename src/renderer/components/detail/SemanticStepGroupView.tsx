import React from 'react';
import type { SemanticStepGroup } from '../../types/data';

interface SemanticStepGroupViewProps {
  group: SemanticStepGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const SemanticStepGroupView: React.FC<SemanticStepGroupViewProps> = ({
  group,
  isCollapsed,
  onToggle,
  children,
}) => {
  const stepCount = group.steps.length;
  const durationSec = (group.totalDuration / 1000).toFixed(2);

  // Calculate total tokens
  const totalTokens = group.steps.reduce((sum, step) => {
    return sum + (step.tokens?.output || 0);
  }, 0);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Chevron icon */}
          <svg
            className={`w-4 h-4 text-gray-400 transform transition-transform ${
              isCollapsed ? 'rotate-0' : 'rotate-90'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Group label */}
          <span className="font-medium text-gray-300">{group.label}</span>

          {/* Step count badge */}
          {group.isGrouped && (
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
              {stepCount} step{stepCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Duration and token info */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {totalTokens > 0 && (
            <span>{totalTokens.toLocaleString()} tokens</span>
          )}
          <span>{durationSec}s</span>
        </div>
      </button>

      {/* Children (individual steps) */}
      {!isCollapsed && (
        <div className="px-2 pb-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};
