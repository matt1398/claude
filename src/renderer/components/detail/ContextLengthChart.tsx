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
  const margin = { top: 40, right: 100, bottom: 40, left: 200 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Filter out steps without context data and sort
  const contextSteps = useMemo(() => {
    return steps
      .filter(s => s.accumulatedContext !== undefined)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
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
        {contextSteps.map((step) => {
          const barWidth = xScale(step.accumulatedContext || 0);
          const barY = yScale(step.id) || 0;
          const barHeight = yScale.bandwidth();

          // Gradient color based on percentage
          const percentage = (step.accumulatedContext || 0) / MAX_CONTEXT;
          const color = percentage > 0.8 ? '#ef4444' : // red at 80%+
                       percentage > 0.5 ? '#f59e0b' : // amber at 50%+
                       '#10b981'; // green below 50%

          return (
            <g key={step.id}>
              <Bar
                x={0}
                y={barY}
                width={Math.max(barWidth, 2)}
                height={barHeight}
                fill={color}
                opacity={0.7}
                rx={4}
              />

              {/* Label on right */}
              <text
                x={barWidth + 10}
                y={barY + barHeight / 2 + 4}
                fill="#d1d5db"
                fontSize={11}
              >
                {((step.accumulatedContext || 0) / 1000).toFixed(1)}k
                ({(percentage * 100).toFixed(0)}%)
              </text>
            </g>
          );
        })}

        {/* Left labels (step names) */}
        <Group left={-10}>
          {contextSteps.map(step => {
            const y = (yScale(step.id) || 0) + yScale.bandwidth() / 2;

            return (
              <text
                key={`label-${step.id}`}
                x={0}
                y={y + 4}
                fill="#d1d5db"
                fontSize={12}
                textAnchor="end"
              >
                {getStepLabel(step)}
              </text>
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
