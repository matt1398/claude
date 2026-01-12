/**
 * Chart Data Transformation Helpers
 *
 * Transforms Chunk data into WaterfallData format for D3.js visualization
 */

import { Chunk, WaterfallData, WaterfallItem, TokenUsage } from '../types/data';
import { detectParallelGroups } from './parallelDetection';

/**
 * Formats token usage as a display string
 *
 * @param usage Token usage object
 * @returns Formatted string (e.g., "8.0K tokens")
 */
export function formatTokens(usage: TokenUsage): string {
  const total =
    usage.input_tokens + (usage.cache_read_input_tokens || 0) + usage.output_tokens;

  if (total >= 1000) {
    return `${(total / 1000).toFixed(1)}K tokens`;
  }
  return `${total} tokens`;
}

/**
 * Formats duration in milliseconds to human-readable string
 *
 * @param ms Duration in milliseconds
 * @returns Formatted string (e.g., "5.2s", "1.5m")
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Transforms a Chunk into WaterfallData for visualization
 *
 * Creates a hierarchical structure:
 * - Level 0: Main session bar (entire chunk duration)
 * - Level 1: Subagent bars (indented, with parallel grouping)
 *
 * @param chunk Parsed chunk data with subagents
 * @returns Waterfall data ready for D3.js rendering
 */
export function chunkToWaterfallData(chunk: Chunk): WaterfallData {
  const items: WaterfallItem[] = [];

  // 1. Main session bar - spans entire chunk
  const mainItem: WaterfallItem = {
    id: `main-${chunk.id}`,
    label: 'Main Session',
    startTime: chunk.startTime,
    endTime: chunk.endTime,
    duration: chunk.duration,
    tokenUsage: chunk.totalTokens,
    level: 0,
    type: 'main',
  };
  items.push(mainItem);

  // 2. Detect parallel groups among subagents
  const groups = detectParallelGroups(chunk.subagents);

  // 3. Create waterfall items for each subagent
  groups.forEach((group) => {
    group.agents.forEach((subagent) => {
      const item: WaterfallItem = {
        id: subagent.agentId,
        label: subagent.description || subagent.agentId,
        startTime: new Date(subagent.startTime),
        endTime: new Date(subagent.endTime),
        duration: subagent.duration,
        tokenUsage: subagent.tokenUsage,
        level: 1, // All subagents at level 1 (indented under main)
        type: 'subagent',
        isParallel: group.isParallel,
        groupId: group.groupId,
      };
      items.push(item);
    });
  });

  // 4. Calculate overall time bounds
  const allTimes = items.flatMap((item) => [item.startTime, item.endTime]);
  const minTime = new Date(Math.min(...allTimes.map((t) => t.getTime())));
  const maxTime = new Date(Math.max(...allTimes.map((t) => t.getTime())));
  const totalDuration = maxTime.getTime() - minTime.getTime();

  return {
    items,
    minTime,
    maxTime,
    totalDuration,
  };
}

/**
 * Generates a color based on item type and parallel status
 *
 * @param type Item type ('main' or 'subagent')
 * @param isParallel Whether this is a parallel operation
 * @returns CSS color string
 */
export function getItemColor(type: 'main' | 'subagent', isParallel?: boolean): string {
  if (type === 'main') {
    return '#3b82f6'; // Blue for main session
  }

  if (isParallel) {
    return '#10b981'; // Green for parallel subagents
  }

  return '#8b5cf6'; // Purple for sequential subagents
}

/**
 * Calculates appropriate chart dimensions based on number of items
 *
 * @param itemCount Number of waterfall items
 * @returns Object with recommended width and height
 */
export function calculateChartDimensions(itemCount: number): {
  width: number;
  height: number;
} {
  const ROW_HEIGHT = 40;
  const PADDING = 80; // Space for axes and labels
  const MIN_HEIGHT = 200;
  const MAX_HEIGHT = 600;

  const calculatedHeight = itemCount * ROW_HEIGHT + PADDING;
  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, calculatedHeight));

  return {
    width: 1000, // Fixed width, can be made responsive
    height,
  };
}
