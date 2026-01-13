import { useMemo } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { SemanticStep } from '../../types/data';

interface ContextLengthChartProps {
  steps: SemanticStep[];
  width?: number;
  height?: number;
}

const MAX_CONTEXT = 200000; // 200k tokens

export function ContextLengthChart({
  steps,
  width = 1000,
  height = 400
}: ContextLengthChartProps) {
  const margin = { top: 40, right: 200, bottom: 40, left: 200 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Filter out steps without context data, sort, and group consecutive steps with same context
  const { contextSteps, contextGroups } = useMemo(() => {
    const filtered = steps
      .filter(s => s.accumulatedContext !== undefined)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Group consecutive steps with the same context value (for main context)
    const groups: Array<{ context: number; steps: SemanticStep[]; startIndex: number }> = [];
    let currentGroup: { context: number; steps: SemanticStep[]; startIndex: number } | null = null;

    filtered.forEach((step, index) => {
      const context = step.accumulatedContext || 0;
      
      if (currentGroup && currentGroup.context === context) {
        // Same context, add to current group
        currentGroup.steps.push(step);
      } else {
        // Different context, start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          context,
          steps: [step],
          startIndex: index,
        };
      }
    });

    // Add last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return {
      contextSteps: filtered,
      contextGroups: groups,
    };
  }, [steps]);

  // Scales
  const xScale = scaleLinear({
    domain: [0, MAX_CONTEXT],
    range: [0, innerWidth],
  });

  const yScale = scaleBand({
    domain: contextSteps.map(s => s.id),
    range: [0, innerHeight],
    padding: 0.2,
  });

  if (contextSteps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No context data available
      </div>
    );
  }

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {/* Grid lines */}
        {[50000, 100000, 150000, 200000].map(tick => (
          <line
            key={tick}
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={0}
            y2={innerHeight}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        ))}

        {/* Bars */}
        {contextSteps.map(step => {
          const barWidth = xScale(step.accumulatedContext || 0);
          const barY = yScale(step.id) || 0;
          const barHeight = yScale.bandwidth();

          // Check if this is a subagent step
          const isSubagent = step.context === 'subagent' || step.type === 'subagent' || step.agentId;

          // Find which group this step belongs to
          const group = contextGroups.find(g => g.steps.includes(step));
          const isGrouped = group && group.steps.length > 1;
          const isFirstInGroup = group && group.steps[0] === step;

          // Color scheme: different for subagent vs main
          const percentage = (step.accumulatedContext || 0) / MAX_CONTEXT;
          let color: string;
          if (isSubagent) {
            // Subagent context: blue/indigo spectrum (cool colors)
            color = percentage > 0.8 ? '#6366f1' : // indigo at 80%+
                   percentage > 0.5 ? '#3b82f6' : // blue at 50%+
                   '#60a5fa'; // light blue below 50%
          } else {
            // Main context: green/emerald spectrum (warm but distinct)
            color = percentage > 0.8 ? '#ef4444' : // red at 80%+
                   percentage > 0.5 ? '#10b981' : // green at 50%+
                   '#22c55e'; // emerald below 50%
          }

          // Different opacity for grouped steps
          const opacity = isGrouped ? 0.5 : (isSubagent ? 0.8 : 0.7);

          return (
            <g key={step.id}>
              {/* Background highlight for subagent steps */}
              {isSubagent && (
                <rect
                  x={-5}
                  y={barY - 2}
                  width={innerWidth + 10}
                  height={barHeight + 4}
                  fill={color}
                  opacity={0.1}
                  rx={4}
                />
              )}

              <Bar
                x={0}
                y={barY}
                width={Math.max(barWidth, 2)}
                height={barHeight}
                fill={color}
                opacity={opacity}
                rx={4}
                stroke={isSubagent ? color : 'none'}
                strokeWidth={isSubagent ? 1.5 : 0}
                strokeOpacity={0.5}
              />

              {/* Show label only on first step of a group, or if not grouped */}
              {(isFirstInGroup || !isGrouped) && (
                <g>
                  {/* Main token count label */}
                  <text
                    x={barWidth + 10}
                    y={barY + barHeight / 2 - (isSubagent ? 6 : 0)}
                    fill={isSubagent ? color : '#d1d5db'}
                    fontSize={11}
                    fontWeight={isGrouped || isSubagent ? 'bold' : 'normal'}
                  >
                    {((step.accumulatedContext || 0) / 1000).toFixed(1)}k
                    ({(percentage * 100).toFixed(0)}%)
                    {isGrouped && ` [${group!.steps.length} steps]`}
                  </text>
                  {/* Subagent indicator badge - on separate line to avoid overlap */}
                  {isSubagent && (
                    <text
                      x={barWidth + 10}
                      y={barY + barHeight / 2 + 10}
                      fill={color}
                      fontSize={9}
                      fontWeight="bold"
                      opacity={0.9}
                    >
                      [Subagent Context]
                    </text>
                  )}
                </g>
              )}

              {/* Group bracket connecting steps with same context */}
              {isGrouped && isFirstInGroup && group!.steps.length > 1 && (
                <g>
                  {/* Vertical line on the right */}
                  <line
                    x1={barWidth + 5}
                    x2={barWidth + 5}
                    y1={barY}
                    y2={(yScale(group!.steps[group!.steps.length - 1].id) || 0) + yScale.bandwidth()}
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                  {/* Top bracket */}
                  <line
                    x1={barWidth}
                    x2={barWidth + 5}
                    y1={barY}
                    y2={barY}
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                  {/* Bottom bracket */}
                  <line
                    x1={barWidth}
                    x2={barWidth + 5}
                    y1={(yScale(group!.steps[group!.steps.length - 1].id) || 0) + yScale.bandwidth()}
                    y2={(yScale(group!.steps[group!.steps.length - 1].id) || 0) + yScale.bandwidth()}
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Left labels (step names) */}
        <Group left={-10}>
          {contextSteps.map(step => {
            const y = (yScale(step.id) || 0) + yScale.bandwidth() / 2;
            const isSubagent = step.context === 'subagent' || step.type === 'subagent' || step.agentId;

            return (
              <g key={`label-${step.id}`}>
                <text
                  x={0}
                  y={y + 4}
                  fill={isSubagent ? '#3b82f6' : '#d1d5db'}
                  fontSize={12}
                  fontWeight={isSubagent ? 'bold' : 'normal'}
                  textAnchor="end"
                >
                  {getStepLabel(step)}
                </text>
                {/* Subagent icon indicator */}
                {isSubagent && (
                  <text
                    x={-15}
                    y={y + 4}
                    fill="#3b82f6"
                    fontSize={10}
                    textAnchor="end"
                  >
                    🔷
                  </text>
                )}
              </g>
            );
          })}
        </Group>

        {/* X-axis */}
        <AxisBottom
          top={innerHeight}
          scale={xScale}
          tickFormat={v => `${(v as number) / 1000}k`}
          stroke="#6b7280"
          tickStroke="#6b7280"
          tickLabelProps={() => ({
            fill: '#9ca3af',
            fontSize: 11,
            textAnchor: 'middle',
          })}
        />
      </Group>

      {/* Title */}
      <text
        x={margin.left}
        y={20}
        fill="#d1d5db"
        fontSize={14}
        fontWeight="500"
      >
        Cumulative Context Growth (Max: 200k tokens)
      </text>
    </svg>
  );
}

function getStepLabel(step: SemanticStep): string {
  switch (step.type) {
    case 'thinking': return 'Thinking';
    case 'tool_call': return `Tool: ${step.content.toolName || 'Unknown'}`;
    case 'tool_result': return 'Result';
    case 'output': return 'Output';
    case 'subagent': return step.content.subagentDescription || 'Subagent';
    case 'interruption': return 'Interruption';
    default: return step.type;
  }
}
