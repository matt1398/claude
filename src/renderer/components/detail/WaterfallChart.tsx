/**
 * Waterfall Chart Component
 *
 * D3.js-based visualization showing:
 * - Main session execution timeline
 * - Hierarchical subagent operations
 * - Parallel execution grouping
 * - Token usage labels
 * - Interactive tooltips
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WaterfallData, WaterfallItem } from '../../types/data';
import {
  formatTokens,
  formatDuration,
  getItemColor,
  calculateChartDimensions,
} from '../../utils/chartHelpers';

interface WaterfallChartProps {
  data: WaterfallData;
  width?: number;
  height?: number;
}

interface TooltipData {
  item: WaterfallItem;
  x: number;
  y: number;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Calculate dimensions based on data if not provided
  const dimensions = calculateChartDimensions(data.items.length);
  const chartWidth = width || dimensions.width;
  const chartHeight = height || dimensions.height;

  // Margins for axes and labels
  const margin = { top: 20, right: 100, bottom: 40, left: 200 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || data.items.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // Create main group with margins
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Time scale (X axis)
    const xScale = d3
      .scaleTime()
      .domain([data.minTime, data.maxTime])
      .range([0, innerWidth]);

    // Y scale (one row per item)
    const yScale = d3
      .scaleBand()
      .domain(data.items.map((d) => d.id))
      .range([0, innerHeight])
      .padding(0.2);

    // X axis with time formatting
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6b7280');

    // Grid lines for time axis
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(xScale.ticks(6))
      .join('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Render waterfall bars
    const bars = g
      .selectAll('.bar')
      .data(data.items)
      .enter()
      .append('g')
      .attr('class', 'bar-group');

    // Bar rectangles
    // Note: Properly typed event handlers to prevent runtime errors
    // D3 v7+ uses (event, datum) signature for all event handlers
    bars
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.startTime))
      .attr('y', (d) => yScale(d.id)!)
      .attr('width', (d) => {
        const width = xScale(d.endTime) - xScale(d.startTime);
        return Math.max(width, 2); // Minimum 2px width for visibility
      })
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => getItemColor(d.type, d.isParallel))
      .attr('rx', 4) // Rounded corners
      .attr('opacity', 0.8)
      .on('mouseover', function (event: MouseEvent, d: WaterfallItem) {
        // Ensure event is valid before accessing properties
        if (!event) return;

        // Highlight bar on hover
        d3.select(this).attr('opacity', 1).attr('stroke', '#1f2937').attr('stroke-width', 2);

        // Show tooltip with safe event access
        setTooltip({
          item: d,
          x: event.pageX || 0,
          y: event.pageY || 0,
        });
      })
      .on('mouseout', function (_event: MouseEvent, _d: WaterfallItem) {
        // Remove highlight
        d3.select(this).attr('opacity', 0.8).attr('stroke', 'none');

        // Hide tooltip
        setTooltip(null);
      });

    // Labels on the left (indented based on level)
    bars
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => -10 - d.level * 20) // Indent based on hierarchy level
      .attr('y', (d) => yScale(d.id)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', (d) => (d.type === 'chunk' ? '14px' : '12px'))
      .style('font-weight', (d) => (d.type === 'chunk' ? '600' : '400'))
      .style('fill', '#374151')
      .text((d) => {
        // Truncate long labels
        const maxLength = 25;
        return d.label.length > maxLength
          ? d.label.substring(0, maxLength) + '...'
          : d.label;
      });

    // Duration and token labels on the right
    bars
      .append('text')
      .attr('class', 'stats')
      .attr('x', innerWidth + 10)
      .attr('y', (d) => yScale(d.id)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('fill', '#6b7280')
      .text((d) => `${formatDuration(d.durationMs)} | ${formatTokens(d.tokenUsage)}`);

    // Parallel indicator brackets
    const parallelGroups = new Map<string, WaterfallItem[]>();
    data.items.forEach((item) => {
      if (item.isParallel && item.groupId) {
        if (!parallelGroups.has(item.groupId)) {
          parallelGroups.set(item.groupId, []);
        }
        parallelGroups.get(item.groupId)!.push(item);
      }
    });

    // Draw brackets for parallel groups
    parallelGroups.forEach((items) => {
      if (items.length < 2) return;

      const firstY = yScale(items[0].id)!;
      const lastY = yScale(items[items.length - 1].id)!;
      const bracketX = -15 - items[0].level * 20;

      g.append('line')
        .attr('x1', bracketX)
        .attr('x2', bracketX)
        .attr('y1', firstY)
        .attr('y2', lastY + yScale.bandwidth())
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2);

      // Add parallel indicator label
      g.append('text')
        .attr('x', bracketX - 5)
        .attr('y', (firstY + lastY + yScale.bandwidth()) / 2)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('fill', '#10b981')
        .style('font-weight', '600')
        .text('||');
    });
  }, [data, chartWidth, chartHeight, innerWidth, innerHeight, margin]);

  return (
    <div className="waterfall-chart-container" style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={chartWidth}
        height={chartHeight}
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            backgroundColor: '#1f2937',
            color: '#ffffff',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '300px',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>{tooltip.item.label}</div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ opacity: 0.7 }}>Type:</span>{' '}
            {tooltip.item.type === 'chunk' ? 'Main Session' : tooltip.item.type === 'tool' ? 'Tool' : 'Subagent'}
            {tooltip.item.isParallel && ' (Parallel)'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ opacity: 0.7 }}>Duration:</span>{' '}
            {formatDuration(tooltip.item.durationMs)}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ opacity: 0.7 }}>Tokens:</span> {formatTokens(tooltip.item.tokenUsage)}
          </div>
          <div style={{ opacity: 0.7, fontSize: '10px', marginTop: '8px' }}>
            {tooltip.item.startTime.toLocaleTimeString()} -{' '}
            {tooltip.item.endTime.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterfallChart;
