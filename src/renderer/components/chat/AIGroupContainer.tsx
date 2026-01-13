import React, { useMemo, useCallback } from 'react';
import type { AIGroup } from '../../types/groups';
import { useStore } from '../../store';
import { AIGroupHeader } from './AIGroupHeader';
import { ThinkingBlock } from '../detail/blocks/ThinkingBlock';
import { ToolCallBlock } from '../detail/blocks/ToolCallBlock';
import { ToolResultBlock } from '../detail/blocks/ToolResultBlock';
import { OutputBlock } from '../detail/blocks/OutputBlock';
import { SubagentBlock } from '../detail/blocks/SubagentBlock';
import { InterruptionBadge } from '../detail/blocks/InterruptionBadge';

interface AIGroupContainerProps {
  aiGroup: AIGroup;
  onSubagentClick?: (subagentId: string, description: string) => void;
}

export const AIGroupContainer: React.FC<AIGroupContainerProps> = ({
  aiGroup,
  onSubagentClick
}) => {
  // Get expansion state from store
  const expansionLevel = useStore(
    s => s.aiGroupExpansionLevels.get(aiGroup.id) || 'collapsed'
  );
  const expandedStepIds = useStore(s => s.expandedStepIds);

  // Get actions from store
  const setAIGroupExpansion = useStore(s => s.setAIGroupExpansion);
  const toggleStepExpansion = useStore(s => s.toggleStepExpansion);

  // Cycle through expansion levels: collapsed → items → full → collapsed
  const handleHeaderClick = useCallback(() => {
    const nextLevel =
      expansionLevel === 'collapsed' ? 'items' :
      expansionLevel === 'items' ? 'full' :
      'collapsed';
    setAIGroupExpansion(aiGroup.id, nextLevel);
  }, [expansionLevel, aiGroup.id, setAIGroupExpansion]);

  // Render individual step based on type
  const renderStep = useCallback((step: typeof aiGroup.steps[0]) => {
    const isExpanded = expandedStepIds.has(step.id);
    const stepKey = step.id;

    const handleStepClick = () => {
      if (expansionLevel === 'full') {
        toggleStepExpansion(step.id);
      }
    };

    const wrapperClasses = expansionLevel === 'full'
      ? 'cursor-pointer hover:opacity-80 transition-opacity'
      : '';

    switch (step.type) {
      case 'thinking':
        return (
          <div key={stepKey} className={wrapperClasses} onClick={handleStepClick}>
            <ThinkingBlock step={step} isExpanded={isExpanded} />
          </div>
        );

      case 'tool_call':
        return (
          <div key={stepKey} className={wrapperClasses} onClick={handleStepClick}>
            <ToolCallBlock step={step} isExpanded={isExpanded} />
          </div>
        );

      case 'tool_result':
        return (
          <div key={stepKey} className={wrapperClasses} onClick={handleStepClick}>
            <ToolResultBlock step={step} isExpanded={isExpanded} />
          </div>
        );

      case 'output':
        return (
          <div key={stepKey} className={wrapperClasses} onClick={handleStepClick}>
            <OutputBlock step={step} isExpanded={isExpanded} />
          </div>
        );

      case 'subagent':
        return (
          <div key={stepKey} className={wrapperClasses} onClick={handleStepClick}>
            <SubagentBlock
              step={step}
              isExpanded={isExpanded}
              onSubagentClick={onSubagentClick}
            />
          </div>
        );

      case 'interruption':
        return (
          <div key={stepKey}>
            <InterruptionBadge />
          </div>
        );

      default:
        return null;
    }
  }, [expandedStepIds, expansionLevel, toggleStepExpansion, onSubagentClick]);

  // Memoize rendered steps to avoid re-rendering on every state change
  const renderedSteps = useMemo(() => {
    if (expansionLevel === 'collapsed') {
      return null;
    }
    return aiGroup.steps.map(step => renderStep(step));
  }, [expansionLevel, aiGroup.steps, renderStep]);

  return (
    <div className="mr-auto max-w-[90%] w-full">
      {/* Header - always visible and clickable */}
      <AIGroupHeader
        summary={aiGroup.summary}
        status={aiGroup.status}
        expansionLevel={expansionLevel}
        onClick={handleHeaderClick}
      />

      {/* Content - shown based on expansion level */}
      {expansionLevel !== 'collapsed' && (
        <div className="mt-2 space-y-2">
          {renderedSteps}
        </div>
      )}
    </div>
  );
};
