import { useStore } from '../../store';
import { ChartModeToggle } from './ChartModeToggle';
// Import for future use when transformation is implemented
// import { GanttChart } from '../detail/GanttChart';
// import { ContextLengthChart } from '../detail/ContextLengthChart';

interface GanttPanelProps {
  // No props needed - reads from store
}

export const GanttPanel = (_props: GanttPanelProps) => {
  const selectedAIGroup = useStore(s => s.selectedAIGroup);
  const ganttChartMode = useStore(s => s.ganttChartMode);
  const setGanttChartMode = useStore(s => s.setGanttChartMode);

  return (
    <div className="flex flex-col h-full bg-claude-dark-surface rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-claude-dark-border">
        <h2 className="text-lg font-semibold text-claude-dark-text">
          Execution Timeline
        </h2>
        <ChartModeToggle mode={ganttChartMode} onChange={setGanttChartMode} />
      </div>

      {/* Chart Content */}
      <div className="flex-1 p-4 overflow-auto">
        {!selectedAIGroup ? (
          <div className="flex items-center justify-center h-full text-claude-dark-text-secondary">
            Select a message to view execution timeline
          </div>
        ) : (
          <div className="h-full">
            {ganttChartMode === 'timeline' ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-claude-dark-text-secondary mb-2">
                    Timeline Chart
                  </div>
                  <div className="text-sm text-claude-dark-text-secondary">
                    Coming soon - Transforming {selectedAIGroup.steps.length} steps
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-claude-dark-text-secondary mb-2">
                    Context Growth Chart
                  </div>
                  <div className="text-sm text-claude-dark-text-secondary">
                    Coming soon - Analyzing {selectedAIGroup.steps.length} steps
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
