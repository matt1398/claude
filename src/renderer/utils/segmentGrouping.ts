/**
 * Segment grouping utilities for Gantt chart visualization.
 * Groups semantic steps into segments for compact display.
 */

import {
  SemanticStep,
  Chunk,
  EnhancedChunk,
  ConversationGroup,
  AIChunk,
  EnhancedAIChunk,
} from '../types/data';
import { TaskSegment } from '../types/gantt';

/**
 * Type guard to check if the input is a ConversationGroup.
 */
function isConversationGroup(input: Chunk | EnhancedChunk | ConversationGroup): input is ConversationGroup {
  return 'taskExecutions' in input;
}

/**
 * Type guard to check if chunk has subagents property (AIChunk variants).
 */
function hasSubagents(input: Chunk | EnhancedChunk | ConversationGroup): input is AIChunk | EnhancedAIChunk {
  return 'processes' in input && Array.isArray((input as AIChunk | EnhancedAIChunk).processes);
}

/**
 * Type guard to check if chunk has toolExecutions property.
 */
function hasToolExecutions(input: Chunk | EnhancedChunk | ConversationGroup): input is AIChunk | EnhancedAIChunk {
  return 'toolExecutions' in input && Array.isArray((input as AIChunk | EnhancedAIChunk).toolExecutions);
}

/**
 * Group semantic steps into segments for visualization.
 * - Task calls with subagents are grouped together
 * - Other consecutive steps are grouped into single bars
 */
export function groupIntoSegments(
  steps: SemanticStep[],
  chunk: Chunk | EnhancedChunk | ConversationGroup
): TaskSegment[] {
  if (steps.length === 0) {
    return [];
  }

  const segments: TaskSegment[] = [];
  let segmentIdCounter = 0;

  // Build mapping of subagent IDs to their parent Task tool use IDs
  const subagentToTaskId = new Map<string, string>();

  if (isConversationGroup(chunk)) {
    // For ConversationGroup, use taskExecutions to build the map
    for (const taskExec of chunk.taskExecutions) {
      if (taskExec.subagent.id && taskExec.taskCall.id) {
        subagentToTaskId.set(taskExec.subagent.id, taskExec.taskCall.id);
      }
    }
  } else if (hasSubagents(chunk)) {
    // For AIChunk/EnhancedAIChunk, use subagents' parentTaskId
    for (const subagent of chunk.processes) {
      if (subagent.parentTaskId && subagent.id) {
        subagentToTaskId.set(subagent.id, subagent.parentTaskId);
      }
    }
  }

  // Build set of step IDs that are subagents with Task parents
  const subagentStepIds = new Set(
    steps
      .filter(step => step.type === 'subagent' && step.content.subagentId && subagentToTaskId.has(step.content.subagentId))
      .map(step => step.id)
  );

  let i = 0;
  while (i < steps.length) {
    const step = steps[i];

    // Check if this is a subagent step that has a Task parent
    if (step.type === 'subagent' && subagentStepIds.has(step.id)) {
      // This is a Task+Subagent pair
      const subagentId = step.content.subagentId;
      const taskId = subagentId ? subagentToTaskId.get(subagentId) : undefined;

      // Find the Task tool call
      let label: string;
      if (isConversationGroup(chunk)) {
        // For ConversationGroup, use taskExecutions
        const taskExec = chunk.taskExecutions.find(
          exec => exec.taskCall.id === taskId
        );
        label = step.content.subagentDescription ||
                taskExec?.taskCall.taskDescription ||
                'Task Execution';
      } else if (hasToolExecutions(chunk)) {
        // For AIChunk/EnhancedAIChunk, use toolExecutions
        const taskExecution = chunk.toolExecutions.find(
          (exec: { toolCall: { id: string; name: string; taskDescription?: string } }) =>
            exec.toolCall.id === taskId && exec.toolCall.name === 'Task'
        );
        label = step.content.subagentDescription ||
                taskExecution?.toolCall.taskDescription ||
                'Task Execution';
      } else {
        // Fallback for UserChunk or other types
        label = step.content.subagentDescription || 'Task Execution';
      }

      // Create segment with just the subagent step
      // (The Task tool_use is already filtered in extractSemanticSteps)
      segments.push({
        id: `segment-${++segmentIdCounter}`,
        type: 'task-with-subagent',
        label,
        steps: [step],
        start: step.startTime,
        end: step.endTime || new Date(step.startTime.getTime() + step.durationMs),
        durationMs: step.durationMs,
        totalTokens: {
          input: step.tokens?.input || 0,
          output: step.tokens?.output || 0,
          cached: step.tokens?.cached || 0,
        },
      });

      i++;
    } else {
      // Group consecutive non-Task-with-subagent steps
      const groupedSteps: SemanticStep[] = [step];
      let j = i + 1;

      // Keep grouping until we hit a Task-with-subagent
      while (j < steps.length) {
        const nextStep = steps[j];
        if (nextStep.type === 'subagent' && subagentStepIds.has(nextStep.id)) {
          // Stop before Task-with-subagent
          break;
        }
        groupedSteps.push(nextStep);
        j++;
      }

      // Calculate segment bounds
      const startTimes = groupedSteps.map(s => s.startTime.getTime());
      const endTimes = groupedSteps.map(s =>
        (s.effectiveEndTime || s.endTime || new Date(s.startTime.getTime() + s.durationMs)).getTime()
      );
      const start = new Date(Math.min(...startTimes));
      const end = new Date(Math.max(...endTimes));

      // Calculate total tokens
      const totalTokens = groupedSteps.reduce(
        (acc, s) => ({
          input: acc.input + (s.tokens?.input || 0),
          output: acc.output + (s.tokens?.output || 0),
          cached: acc.cached + (s.tokens?.cached || 0),
        }),
        { input: 0, output: 0, cached: 0 }
      );

      // Create label
      const label = buildGroupedStepsLabel(groupedSteps);

      segments.push({
        id: `segment-${++segmentIdCounter}`,
        type: 'grouped-steps',
        label,
        steps: groupedSteps,
        start,
        end,
        durationMs: end.getTime() - start.getTime(),
        totalTokens,
      });

      i = j;
    }
  }

  return segments;
}

/**
 * Build a descriptive label for grouped steps.
 */
function buildGroupedStepsLabel(steps: SemanticStep[]): string {
  if (steps.length === 1) {
    const step = steps[0];
    switch (step.type) {
      case 'thinking':
        return 'Thinking';
      case 'output':
        return 'Output';
      case 'tool_call':
        return step.content.toolName || 'Tool';
      case 'tool_result':
        return `Result: ${step.content.isError ? '✗' : '✓'}`;
      case 'interruption':
        return 'Interruption';
      default:
        return 'Step';
    }
  }

  // Multiple steps - summarize
  const types = new Set(steps.map(s => s.type));
  const toolCalls = steps.filter(s => s.type === 'tool_call');

  if (toolCalls.length > 0) {
    const toolNames = toolCalls.map(s => s.content.toolName).filter(Boolean);
    if (toolNames.length === 1) {
      return toolNames[0]!;
    }
    return `Tools (${toolCalls.length})`;
  }

  if (types.has('thinking') && types.has('output')) {
    return 'Response';
  }

  if (types.has('thinking')) {
    return 'Thinking';
  }

  if (types.has('output')) {
    return 'Output';
  }

  return `${steps.length} steps`;
}
