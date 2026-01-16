import React from 'react';
import { Wrench } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';
import { STEP_ICONS } from '../../icons/StepIcons';

interface ToolCallBlockProps {
  step: SemanticStep;
  isExpanded: boolean;
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ step, isExpanded }) => {
  const toolName = step.content.toolName || 'Unknown Tool';
  const toolInput = step.content.toolInput;

  // Use tool-specific icon if available, otherwise default to Wrench
  const Icon = STEP_ICONS.tool_call || Wrench;

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: 'var(--tool-call-bg)',
        border: '1px solid var(--tool-call-border)',
        color: 'var(--tool-call-text)',
      }}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">Tool Call</div>
          <code
            className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
            style={{ backgroundColor: 'var(--tool-call-code-bg)' }}
          >
            {toolName}
          </code>
        </div>
      </div>

      {isExpanded && toolInput ? (
        <div
          className="px-3 py-2"
          style={{ borderTop: '1px solid var(--tool-call-content-border)' }}
        >
          <div className="text-xs font-medium mb-1" style={{ opacity: 0.8 }}>Input:</div>
          <pre
            className="text-xs p-2 rounded overflow-x-auto max-h-96 overflow-y-auto"
            style={{ backgroundColor: 'var(--code-bg)' }}
          >
            {JSON.stringify(toolInput as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
};
