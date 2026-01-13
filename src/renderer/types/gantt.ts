/**
 * Type definitions for Gantt chart visualization.
 * Used to transform semantic steps into Gantt-compatible data structures.
 */

import type { SemanticStep, SemanticStepType } from './data';

// Re-export SemanticStepType for convenience
export type { SemanticStepType };

/**
 * Gantt task representation for visualization.
 */
export interface GanttTask {
  /** Unique task identifier */
  id: string;
  /** Display name for the task */
  name: string;
  /** Task start time */
  start: Date;
  /** Task end time */
  end: Date;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Array of task IDs this task depends on */
  dependencies?: string[];
  /** Custom CSS class for styling by step type */
  custom_class?: string;

  /** Custom metadata for enhanced visualization */
  metadata?: {
    /** Type of semantic step this task represents */
    stepType: SemanticStepType;
    /** Token usage for this task */
    tokens: {
      input: number;
      output: number;
      cached?: number;
    };
    /** Execution context */
    context: 'main' | 'subagent';
    /** Whether executed in parallel */
    isParallel?: boolean;
    /** Whether this task's timing was gap-filled */
    isGapFilled?: boolean;
  };
}

/**
 * A segment groups related semantic steps into a single Gantt chart row.
 * Segments can be either:
 * 1. Task+Subagent pairs (Task tool call + its subagent execution)
 * 2. Grouped consecutive steps (thinking, output, other tool calls)
 */
export interface TaskSegment {
  /** Unique segment identifier */
  id: string;
  /** Segment type */
  type: 'task-with-subagent' | 'grouped-steps';
  /** Display label for the segment row */
  label: string;
  /** All steps in this segment */
  steps: SemanticStep[];
  /** Segment start time (earliest step) */
  start: Date;
  /** Segment end time (latest step) */
  end: Date;
  /** Total duration */
  durationMs: number;
  /** Total tokens for this segment */
  totalTokens: {
    input: number;
    output: number;
    cached: number;
  };
}
