/**
 * Parallel Execution Detection Utility
 *
 * Detects and groups parallel subagents based on their start times.
 * Operations that start within 500ms of each other are considered parallel.
 */

import { ResolvedSubagent, SubagentGroup } from '../types/data';

/**
 * Groups subagents that were launched in parallel
 *
 * Logic:
 * - Subagents with start times within 500ms are grouped together
 * - This indicates they were called in the same Task invocation
 * - Groups with multiple agents are marked as parallel
 *
 * @param subagents Array of resolved subagent data
 * @returns Array of subagent groups with parallel detection
 */
export function detectParallelGroups(subagents: ResolvedSubagent[]): SubagentGroup[] {
  if (subagents.length === 0) {
    return [];
  }

  // Sort by start time for proper grouping
  const sortedSubagents = [...subagents].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const groups: SubagentGroup[] = [];
  const PARALLEL_THRESHOLD_MS = 500; // 500ms window for parallel detection

  // Group subagents by start time proximity
  const groupMap = new Map<number, ResolvedSubagent[]>();

  sortedSubagents.forEach(agent => {
    const startMs = new Date(agent.startTime).getTime();

    // Round to 500ms bucket to group parallel operations
    const groupKey = Math.floor(startMs / PARALLEL_THRESHOLD_MS) * PARALLEL_THRESHOLD_MS;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(agent);
  });

  // Convert map to groups array with parallel detection
  let groupIndex = 0;
  for (const [_, agents] of Array.from(groupMap.entries())) {
    groups.push({
      agents,
      isParallel: agents.length > 1,
      groupId: `group-${groupIndex++}`,
    });
  }

  return groups;
}

/**
 * Checks if two time ranges overlap
 *
 * @param start1 Start time of first range
 * @param end1 End time of first range
 * @param start2 Start time of second range
 * @param end2 End time of second range
 * @returns True if the ranges overlap
 */
export function timeRangesOverlap(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();

  return s1 <= e2 && s2 <= e1;
}

/**
 * Calculates the overlap duration between two time ranges
 *
 * @param start1 Start time of first range
 * @param end1 End time of first range
 * @param start2 Start time of second range
 * @param end2 End time of second range
 * @returns Overlap duration in milliseconds, or 0 if no overlap
 */
export function calculateOverlapDuration(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): number {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();

  if (!timeRangesOverlap(start1, end1, start2, end2)) {
    return 0;
  }

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  return overlapEnd - overlapStart;
}
