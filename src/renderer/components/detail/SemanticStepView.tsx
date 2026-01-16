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

// Theme-aware step colors using CSS variables
const getStepStyles = (type: SemanticStep['type']) => {
  switch (type) {
    case 'thinking':
      return {
        bg: 'var(--thinking-bg)',
        text: 'var(--thinking-text)',
        border: 'var(--thinking-border)',
      };
    case 'tool_call':
      return {
        bg: 'var(--tool-call-bg)',
        text: 'var(--tool-call-text)',
        border: 'var(--tool-call-border)',
      };
    case 'tool_result':
      return {
        bg: 'var(--tool-result-success-bg)',
        text: 'var(--tool-result-success-text)',
        border: 'var(--tool-result-success-border)',
      };
    case 'subagent':
      return {
        bg: 'var(--tool-result-success-bg)',
        text: 'var(--tool-result-success-text)',
        border: 'var(--tool-result-success-border)',
      };
    case 'output':
      return {
        bg: 'var(--output-bg)',
        text: 'var(--output-text)',
        border: 'var(--output-border)',
      };
    case 'interruption':
      return {
        bg: 'var(--interruption-bg)',
        text: 'var(--interruption-text)',
        border: 'var(--interruption-border)',
      };
    default:
      return {
        bg: 'var(--color-surface-raised)',
        text: 'var(--color-text)',
        border: 'var(--color-border)',
      };
  }
};

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
  const stepStyles = getStepStyles(step.type);

  // Determine if this is a clickable subagent step
  const isClickableSubagent = step.type === 'subagent' && onSubagentClick && step.content.subagentId;

  return (
    <div
      className={`rounded-lg ${isClickableSubagent ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: stepStyles.bg,
        color: stepStyles.text,
        border: `1px solid ${stepStyles.border}`,
      }}
    >
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
          isClickableSubagent ? 'hover:opacity-80' : 'hover:opacity-80'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} color={iconColor} className="mt-0.5 flex-shrink-0" />
          <span className="font-medium capitalize">{step.type.replace('_', ' ')}</span>
          {step.content.toolName && (
            <code
              className="text-xs px-1 rounded"
              style={{
                backgroundColor: 'var(--tag-bg)',
                color: 'var(--tag-text)',
                border: '1px solid var(--tag-border)',
              }}
            >
              {step.content.toolName}
            </code>
          )}
          {isClickableSubagent && (
            <span className="text-xs" style={{ color: 'var(--tool-result-success-text)' }} title="Click to drill down">
              Click to view
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {step.tokens && (
            <span>{step.tokens.output.toLocaleString()} tokens</span>
          )}
          <span>{step.durationMs}ms</span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="hover:opacity-70 transition-colors cursor-pointer"
            title="Show debug info"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSelect();
              }
            }}
          >
            🔍
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          className="px-3 py-2 text-sm"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          {step.type === 'thinking' && step.content.thinkingText && (
            <pre
              className="whitespace-pre-wrap font-mono text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {step.content.thinkingText}
            </pre>
          )}

          {step.type === 'output' && step.content.outputText && (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap" style={{ color: 'var(--prose-body)' }}>
                {step.content.outputText}
              </div>
            </div>
          )}

          {step.type === 'tool_call' && (
            <div className="space-y-2">
              {step.content.toolName && (
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Tool:</span>{' '}
                  <code className="text-xs" style={{ color: 'var(--tool-call-text)' }}>{step.content.toolName}</code>
                </div>
              )}
              {step.content.toolInput ? (
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Input:</div>
                  <pre
                    className="text-xs p-2 rounded overflow-x-auto"
                    style={{
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--code-bg)',
                      border: '1px solid var(--code-border)',
                    }}
                  >
                    {JSON.stringify(step.content.toolInput as Record<string, unknown>, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}

          {step.type === 'tool_result' && (
            <div className="space-y-2">
              {step.content.isError && (
                <div className="text-xs font-medium" style={{ color: 'var(--tool-result-error-text)' }}>Error</div>
              )}
              {step.content.toolResultContent && (
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Result:</div>
                  <pre
                    className="text-xs p-2 rounded overflow-x-auto max-h-64 overflow-y-auto"
                    style={{
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--code-bg)',
                      border: '1px solid var(--code-border)',
                    }}
                  >
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
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Agent ID:</span>{' '}
                  <code className="text-xs" style={{ color: 'var(--tool-result-success-text)' }}>{step.content.subagentId}</code>
                </div>
              )}
              {step.content.subagentDescription && (
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Description:</div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{step.content.subagentDescription}</p>
                </div>
              )}
              {step.tokens && (
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-medium">Tokens:</span>{' '}
                  {step.tokens.input.toLocaleString()} in / {step.tokens.output.toLocaleString()} out
                  {step.tokens.cached && step.tokens.cached > 0 && (
                    <span> ({step.tokens.cached.toLocaleString()} cached)</span>
                  )}
                </div>
              )}
              {step.isParallel && (
                <div className="text-xs font-medium" style={{ color: 'var(--tool-result-success-text)' }}>
                  Executed in parallel
                </div>
              )}
            </div>
          )}

          {step.type === 'interruption' && (
            <div className="text-xs" style={{ color: 'var(--interruption-text)' }}>
              User interrupted the execution
            </div>
          )}
        </div>
      )}
    </div>
  );
};
