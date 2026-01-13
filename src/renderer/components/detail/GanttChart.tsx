import { useMemo } from 'react';
import { scaleTime, scaleBand } from '@visx/scale';
import { Group } from '@visx/group';
import { AxisBottom } from '@visx/axis';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';
import type { TaskSegment } from '../../types/gantt';
import type { SemanticStep } from '../../types/data';
import { STEP_ICON_PATHS, STEP_COLORS } from '../icons/StepIcons';

interface GanttChartProps {
  segments: TaskSegment[];
  onSegmentClick?: (segment: TaskSegment) => void;
  height?: number;
}

interface TooltipData {
  segment: TaskSegment;
  step?: SemanticStep;
}

const GanttChartInner: React.FC<GanttChartProps & { width: number }> = ({
  segments,
  onSegmentClick,
  width,
  height = 300,
}) => {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } =
    useTooltip<TooltipData>();

  const margin = { top: 20, right: 20, bottom: 40, left: 200 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Time scale (X axis)
  const timeScale = useMemo(() => {
    if (segments.length === 0) {
      return scaleTime({
        domain: [new Date(), new Date()],
        range: [0, innerWidth],
      });
    }
    const minTime = Math.min(...segments.map((s) => s.start.getTime()));
    const maxTime = Math.max(...segments.map((s) => s.end.getTime()));
    return scaleTime({
      domain: [new Date(minTime), new Date(maxTime)],
      range: [0, innerWidth],
    });
  }, [segments, innerWidth]);

  // Band scale (Y axis - one row per segment)
  const bandScale = useMemo(
    () =>
      scaleBand({
        domain: segments.map((s) => s.id),
        range: [0, innerHeight],
        padding: 0.2,
      }),
    [segments, innerHeight]
  );

  // Early return if no width
  if (width === 0) {
    return <div className="text-gray-500 text-sm">Measuring...</div>;
  }

  // Early return if no segments
  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        No timeline data available
      </div>
    );
  }

  /**
   * Get color for a step type with subtle variations for similar types
   */
  const getStepColor = (step: SemanticStep): string => {
    const baseColor = STEP_COLORS[step.type] || STEP_COLORS.output;

    // For tool calls, create subtle variations based on tool name
    if (step.type === 'tool_call' && step.content.toolName) {
      const toolName = step.content.toolName;
      const hash = toolName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const variation = hash % 3;

      // Create subtle variations of the base orange color
      const toolColors = {
        0: '#d97706', // Base
        1: '#ea580c', // Slightly more red
        2: '#c2410c', // Darker
      };
      return toolColors[variation as keyof typeof toolColors] || baseColor;
    }

    return baseColor;
  };

  /**
   * Get label for a step
   */
  const getStepLabel = (step: SemanticStep): string => {
    switch (step.type) {
      case 'thinking':
        return 'Thinking';
      case 'tool_call':
        return step.content.toolName || 'Tool';
      case 'tool_result':
        return step.content.isError ? '✗' : '✓';
      case 'subagent':
        return step.content.subagentDescription || 'Subagent';
      case 'output':
        return 'Output';
      case 'interruption':
        return 'Interruption';
    }
  };

  /**
   * Get icon type for segment label
   */
  const getSegmentIconType = (segment: TaskSegment): keyof typeof STEP_ICON_PATHS => {
    if (segment.type === 'task-with-subagent') {
      return 'subagent';
    }

    // Use the first significant step type
    const firstStep = segment.steps[0];
    if (firstStep.type === 'tool_call') {
      return 'tool_call';
    }
    return firstStep.type;
  };

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

          {/* Segment rows */}
          {segments.map((segment, segmentIdx) => {
            const rowY = bandScale(segment.id) || 0;
            const rowHeight = bandScale.bandwidth();

            return (
              <Group key={segment.id}>
                {/* Background row */}
                <rect
                  x={0}
                  y={rowY}
                  width={innerWidth}
                  height={rowHeight}
                  fill={segmentIdx % 2 === 0 ? '#1f2937' : '#111827'}
                />

                {/* Render each step as a colored block within the row */}
                {segment.steps.map((step) => {
                  const stepStart = step.startTime;
                  const stepEnd =
                    step.effectiveEndTime ||
                    step.endTime ||
                    new Date(step.startTime.getTime() + step.durationMs);

                  const blockX = timeScale(stepStart);
                  const blockWidth = Math.max(timeScale(stepEnd) - blockX, 4);
                  const blockY = rowY + 2;
                  const blockHeight = rowHeight - 4;

                  const color = getStepColor(step);
                  const opacity = step.isGapFilled ? 0.5 : 0.8;

                  // Only show label if block is wide enough
                  const showLabel = blockWidth > 60;
                  const label = getStepLabel(step);

                  return (
                    <Group key={step.id}>
                      <rect
                        x={blockX}
                        y={blockY}
                        width={blockWidth}
                        height={blockHeight}
                        fill={color}
                        opacity={opacity}
                        rx={4}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSegmentClick?.(segment)}
                        onMouseMove={(e) =>
                          showTooltip({
                            tooltipData: { segment, step },
                            tooltipLeft: e.clientX,
                            tooltipTop: e.clientY,
                          })
                        }
                        onMouseLeave={hideTooltip}
                      />

                      {/* Label inside block */}
                      {showLabel && (
                        <text
                          x={blockX + blockWidth / 2}
                          y={blockY + blockHeight / 2 + 4}
                          fill="#fff"
                          fontSize={10}
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {label}
                        </text>
                      )}
                    </Group>
                  );
                })}
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
          {segments.map((segment) => {
            const yPos = (bandScale(segment.id) || 0) + bandScale.bandwidth() / 2;
            const iconType = getSegmentIconType(segment);

            return (
              <Group key={segment.id}>
                <path
                  d={STEP_ICON_PATHS[iconType]}
                  fill={STEP_COLORS[iconType]}
                  transform={`translate(5, ${yPos - 8}) scale(0.6)`}
                />
                <text x={30} y={yPos + 4} fill="#d1d5db" fontSize={12}>
                  {segment.label.length > 20
                    ? segment.label.slice(0, 20) + '...'
                    : segment.label}
                </text>
              </Group>
            );
          })}
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <div className="bg-gray-800 text-white p-2 rounded shadow-lg text-xs">
            <div className="font-medium">{tooltipData.segment.label}</div>
            {tooltipData.step && (
              <>
                <div className="text-gray-400 mt-1">
                  {getStepLabel(tooltipData.step)}
                </div>
                {tooltipData.step.tokens && (
                  <div className="text-gray-400">
                    {tooltipData.step.tokens.output.toLocaleString()} output tokens
                  </div>
                )}
                <div className="text-gray-400">
                  {(tooltipData.step.durationMs / 1000).toFixed(2)}s
                </div>
              </>
            )}
            <div className="text-gray-400 mt-1">
              Total: {tooltipData.segment.totalTokens.output.toLocaleString()} tokens
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

// Responsive wrapper
export const GanttChart: React.FC<GanttChartProps> = (props) => (
  <div style={{ width: '100%', minHeight: props.height || 300 }}>
    <ParentSize>
      {({ width }) => <GanttChartInner {...props} width={width} />}
    </ParentSize>
  </div>
);
