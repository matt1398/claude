/**
 * Chart Data Transformation Helpers
 *
 * Transforms Chunk data into WaterfallData format for D3.js visualization
 */

import {
  Chunk,
  WaterfallData,
  WaterfallItem,
  TokenUsage,
  Process,
  isAIChunk,
} from '../types/data';
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
 * @param chunk Parsed chunk data with subagents (AIChunk)
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
    durationMs: chunk.durationMs,
    tokenUsage: {
      input_tokens: chunk.metrics.inputTokens,
      output_tokens: chunk.metrics.outputTokens,
      cache_read_input_tokens: chunk.metrics.cacheReadTokens,
    },
    level: 0,
    type: 'chunk',
    isParallel: false,
  };
  items.push(mainItem);

  // 2. Get subagents from chunk (only AIChunk has subagents)
  const subagents = isAIChunk(chunk) ? chunk.processes : [];

  // 3. Detect parallel groups among subagents
  const groups = detectParallelGroups(subagents);

  // 3. Create waterfall items for each subagent
  groups.forEach((group) => {
    group.agents.forEach((subagent: Process) => {
      const item: WaterfallItem = {
        id: subagent.id,
        label: subagent.description || subagent.subagentType || subagent.id,
        startTime: subagent.startTime,
        endTime: subagent.endTime,
        durationMs: subagent.durationMs,
        tokenUsage: {
          input_tokens: subagent.metrics.inputTokens,
          output_tokens: subagent.metrics.outputTokens,
          cache_read_input_tokens: subagent.metrics.cacheReadTokens,
        },
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
  const totalDurationMs = maxTime.getTime() - minTime.getTime();

  return {
    items,
    minTime,
    maxTime,
    totalDurationMs,
  };
}

/**
 * Generates a color based on item type and parallel status
 *
 * @param type Item type
 * @param isParallel Whether this is a parallel operation
 * @returns CSS color string
 */
export function getItemColor(
  type: 'chunk' | 'subagent' | 'tool',
  isParallel?: boolean
): string {
  if (type === 'chunk') {
    return '#3b82f6'; // Blue for main session
  }

  if (type === 'tool') {
    return '#f59e0b'; // Amber for tools
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
