import { useMemo } from 'react';
import { scaleTime, scaleBand } from '@visx/scale';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { AxisBottom } from '@visx/axis';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';
import type { SemanticStepType, SemanticStepGroup } from '../../types/data';
import type { GanttTask } from '../../types/gantt';

const STEP_COLORS: Record<SemanticStepType, string> = {
  thinking: '#8b5cf6',    // Purple
  tool_call: '#f59e0b',   // Amber
  tool_result: '#d97706', // Amber darker
  subagent: '#10b981',    // Green
  output: '#3b82f6',      // Blue
  interruption: '#ef4444', // Red
};

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  height?: number;
  groups?: SemanticStepGroup[];
  collapsedGroups?: Set<string>;
}

const GanttChartInner: React.FC<GanttChartProps & { width: number }> = ({
  tasks, onTaskClick, width, height = 300, groups, collapsedGroups
}) => {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } = useTooltip<GanttTask>();

  const margin = { top: 20, right: 20, bottom: 40, left: 180 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Filter tasks based on collapsed groups
  const visibleTasks = useMemo(() => {
    if (!groups || !collapsedGroups || collapsedGroups.size === 0) {
      return tasks;
    }

    // Build a map of step IDs to their group IDs
    const stepToGroup = new Map<string, string>();
    for (const group of groups) {
      for (const step of group.steps) {
        stepToGroup.set(step.id, group.id);
      }
    }

    // Filter tasks: show only if their group is not collapsed
    return tasks.filter(task => {
      const groupId = stepToGroup.get(task.id);
      if (!groupId) return true; // Show tasks not in any group
      return !collapsedGroups.has(groupId); // Show if group is expanded
    });
  }, [tasks, groups, collapsedGroups]);

  // Time scale (X axis)
  const timeScale = useMemo(() => {
    const minTime = Math.min(...tasks.map(t => t.start.getTime()));
    const maxTime = Math.max(...tasks.map(t => t.end.getTime()));
    return scaleTime({
      domain: [new Date(minTime), new Date(maxTime)],
      range: [0, innerWidth],
    });
  }, [tasks, innerWidth]);

  // Band scale (Y axis - one row per visible task)
  const bandScale = useMemo(() => scaleBand({
    domain: visibleTasks.map(t => t.id),
    range: [0, innerHeight],
    padding: 0.2,
  }), [visibleTasks, innerHeight]);

  return (
    <div className="relative">
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {/* Grid lines */}
          {timeScale.ticks(6).map((tick, i) => (
            <line
              key={i}
              x1={timeScale(tick)}
              x2={timeScale(tick)}
              y1={0}
              y2={innerHeight}
              stroke="#374151"
              strokeDasharray="4,4"
            />
          ))}

          {/* Task bars */}
          {visibleTasks.map((task, idx) => {
            const barX = timeScale(task.start);
            const barWidth = timeScale(task.end) - timeScale(task.start);
            const barY = bandScale(task.id) || 0;
            const barHeight = bandScale.bandwidth();
            const color = STEP_COLORS[task.metadata?.stepType || 'output'];

            return (
              <Group key={task.id}>
                {/* Background row */}
                <rect
                  x={0}
                  y={barY}
                  width={innerWidth}
                  height={barHeight}
                  fill={idx % 2 === 0 ? '#1f2937' : '#111827'}
                />
                {/* Task bar */}
                <Bar
                  x={barX}
                  y={barY + 2}
                  width={Math.max(barWidth, 4)}
                  height={barHeight - 4}
                  fill={color}
                  rx={4}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onTaskClick?.(task)}
                  onMouseMove={(e) => showTooltip({
                    tooltipData: task,
                    tooltipLeft: e.clientX,
                    tooltipTop: e.clientY,
                  })}
                  onMouseLeave={hideTooltip}
                />
                {/* Token label on bar */}
                {barWidth > 60 && task.metadata?.tokens && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY + barHeight / 2 + 4}
                    fill="#fff"
                    fontSize={11}
                    textAnchor="middle"
                  >
                    {task.metadata.tokens.output.toLocaleString()} tok
                  </text>
                )}
              </Group>
            );
          })}

          {/* Time axis */}
          <AxisBottom
            top={innerHeight}
            scale={timeScale}
            stroke="#6b7280"
            tickStroke="#6b7280"
            tickLabelProps={() => ({
              fill: '#9ca3af',
              fontSize: 11,
              textAnchor: 'middle',
            })}
          />
        </Group>

        {/* Left labels */}
        <Group left={10} top={margin.top}>
          {visibleTasks.map((task) => (
            <text
              key={task.id}
              y={(bandScale(task.id) || 0) + bandScale.bandwidth() / 2 + 4}
              fill="#d1d5db"
              fontSize={12}
            >
              {task.name.length > 20 ? task.name.slice(0, 20) + '...' : task.name}
            </text>
          ))}
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <div className="bg-gray-800 text-white p-2 rounded shadow-lg text-xs">
            <div className="font-medium">{tooltipData.name}</div>
            <div className="text-gray-400">
              {tooltipData.metadata?.tokens?.output.toLocaleString()} output tokens
            </div>
            <div className="text-gray-400">
              {((tooltipData.end.getTime() - tooltipData.start.getTime()) / 1000).toFixed(2)}s
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

// Responsive wrapper
export const GanttChart: React.FC<GanttChartProps> = (props) => (
  <ParentSize>
    {({ width }) => <GanttChartInner {...props} width={width} />}
  </ParentSize>
);
