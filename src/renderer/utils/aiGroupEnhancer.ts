/**
 * AI Group Enhancer - Phase 1 of ChatGroup UI Revamp
 *
 * This module transforms raw AIGroup data into EnhancedAIGroup with display-ready
 * properties for the new chat-style UI. It handles:
 * - Finding the last visible output (text or tool result)
 * - Linking tool calls to their results
 * - Building a flat chronological list of display items
 */

import type {
  AIGroup,
  EnhancedAIGroup,
  AIGroupLastOutput,
  LinkedToolItem,
  AIGroupDisplayItem
} from '../types/groups';
import type { SemanticStep, Subagent } from '../types/data';

/**
 * Truncates text to a maximum length and adds ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Converts tool input object to a preview string.
 */
function formatToolInput(input: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(input, null, 2);
    return truncateText(json, 100);
  } catch (e) {
    return '[Invalid JSON]';
  }
}

/**
 * Converts tool result content to a preview string.
 */
function formatToolResult(content: string | unknown[]): string {
  try {
    if (typeof content === 'string') {
      return truncateText(content, 200);
    }
    const json = JSON.stringify(content, null, 2);
    return truncateText(json, 200);
  } catch (e) {
    return '[Invalid content]';
  }
}

/**
 * Find the last visible output in the AI Group.
 *
 * Strategy:
 * 1. Iterate through steps in reverse order
 * 2. Find the last 'output' step with outputText
 * 3. If no output found, find the last 'tool_result' step
 * 4. Return null if neither exists
 *
 * @param steps - Semantic steps from the AI Group
 * @returns The last output or null
 */
export function findLastOutput(steps: SemanticStep[]): AIGroupLastOutput | null {
  // First pass: look for last 'output' step with outputText
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === 'output' && step.content.outputText) {
      return {
        type: 'text',
        text: step.content.outputText,
        timestamp: step.startTime,
      };
    }
  }

  // Second pass: look for last 'tool_result' step
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === 'tool_result' && step.content.toolResultContent) {
      return {
        type: 'tool_result',
        toolName: step.content.toolName,
        toolResult: step.content.toolResultContent,
        isError: step.content.isError || false,
        timestamp: step.startTime,
      };
    }
  }

  return null;
}

/**
 * Link tool calls to their results and build a map of LinkedToolItems.
 *
 * Strategy:
 * 1. Iterate through steps to find all tool_call steps
 * 2. For each tool call, search for matching tool_result by ID
 *    - Tool result step IDs are set to the tool_use_id, matching the call's ID
 * 3. Build LinkedToolItem with preview text
 * 4. Include orphaned calls (calls without results)
 *
 * @param steps - Semantic steps from the AI Group
 * @returns Map of tool call ID to LinkedToolItem
 */
export function linkToolCallsToResults(steps: SemanticStep[]): Map<string, LinkedToolItem> {
  const linkedTools = new Map<string, LinkedToolItem>();

  // First pass: collect all tool calls
  const toolCalls = steps.filter(step => step.type === 'tool_call');

  // Build a map of result steps by their ID for fast lookup
  const resultStepsById = new Map<string, SemanticStep>();
  for (const step of steps) {
    if (step.type === 'tool_result') {
      resultStepsById.set(step.id, step);
    }
  }

  for (const callStep of toolCalls) {
    const toolCallId = callStep.id;
    const toolName = callStep.content.toolName || 'Unknown';
    const toolInput = callStep.content.toolInput || {};

    // Search for matching tool result by ID
    // Tool result steps have their ID set to the tool_use_id (same as call ID)
    const resultStep = resultStepsById.get(toolCallId);

    const linkedItem: LinkedToolItem = {
      id: toolCallId,
      name: toolName,
      input: toolInput as Record<string, unknown>,
      result: resultStep ? {
        content: resultStep.content.toolResultContent || '',
        isError: resultStep.content.isError || false,
      } : undefined,
      inputPreview: formatToolInput(toolInput as Record<string, unknown>),
      outputPreview: resultStep ? formatToolResult(resultStep.content.toolResultContent || '') : undefined,
      startTime: callStep.startTime,
      endTime: resultStep?.startTime,
      durationMs: resultStep
        ? resultStep.startTime.getTime() - callStep.startTime.getTime()
        : undefined,
      isOrphaned: !resultStep,
    };

    linkedTools.set(toolCallId, linkedItem);
  }

  return linkedTools;
}

/**
 * Build a flat chronological list of display items for the AI Group.
 *
 * Strategy:
 * 1. Skip the step that represents lastOutput (to avoid duplication)
 * 2. For tool_call steps, use the LinkedToolItem (which includes the result)
 * 3. Skip standalone tool_result steps (already linked to calls)
 * 4. Include thinking, subagent, and output steps
 * 5. Return items in chronological order
 *
 * @param steps - Semantic steps from the AI Group
 * @param lastOutput - The last output to skip
 * @param subagents - Subagents associated with this group
 * @returns Flat array of display items
 */
export function buildDisplayItems(
  steps: SemanticStep[],
  lastOutput: AIGroupLastOutput | null,
  subagents: Subagent[]
): AIGroupDisplayItem[] {
  const displayItems: AIGroupDisplayItem[] = [];
  const linkedTools = linkToolCallsToResults(steps);

  // Build a set of result step IDs to skip (they're already in LinkedToolItem)
  const resultStepIds = new Set<string>();
  for (const step of steps) {
    if (step.type === 'tool_result') {
      resultStepIds.add(step.id);
    }
  }

  // Find the step ID of lastOutput to skip it
  let lastOutputStepId: string | undefined;
  if (lastOutput) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (lastOutput.type === 'text' && step.type === 'output' && step.content.outputText === lastOutput.text) {
        lastOutputStepId = step.id;
        break;
      }
      if (lastOutput.type === 'tool_result' && step.type === 'tool_result' && step.content.toolResultContent === lastOutput.toolResult) {
        lastOutputStepId = step.id;
        break;
      }
    }
  }

  // Build display items
  for (const step of steps) {
    // Skip the last output step
    if (lastOutputStepId && step.id === lastOutputStepId) {
      continue;
    }

    switch (step.type) {
      case 'thinking':
        if (step.content.thinkingText) {
          displayItems.push({
            type: 'thinking',
            content: step.content.thinkingText,
            timestamp: step.startTime,
          });
        }
        break;

      case 'tool_call': {
        const linkedTool = linkedTools.get(step.id);
        if (linkedTool) {
          displayItems.push({
            type: 'tool',
            tool: linkedTool,
          });
        }
        break;
      }

      case 'tool_result':
        // Skip - these are already included in LinkedToolItem
        break;

      case 'subagent': {
        const subagentId = step.content.subagentId;
        const subagent = subagents.find(s => s.id === subagentId);
        if (subagent) {
          displayItems.push({
            type: 'subagent',
            subagent: subagent,
          });
        }
        break;
      }

      case 'output':
        if (step.content.outputText) {
          displayItems.push({
            type: 'output',
            content: step.content.outputText,
            timestamp: step.startTime,
          });
        }
        break;

      case 'interruption':
        // Could add interruption handling here if needed
        break;
    }
  }

  return displayItems;
}

/**
 * Main enhancement function - transforms AIGroup into EnhancedAIGroup.
 *
 * This is the primary entry point that ties together all the helper functions
 * to produce a display-ready enhanced group.
 *
 * @param aiGroup - Base AI Group to enhance
 * @returns Enhanced AI Group with display data
 */
export function enhanceAIGroup(aiGroup: AIGroup): EnhancedAIGroup {
  const lastOutput = findLastOutput(aiGroup.steps);
  const linkedTools = linkToolCallsToResults(aiGroup.steps);
  const displayItems = buildDisplayItems(aiGroup.steps, lastOutput, aiGroup.subagents);

  return {
    ...aiGroup,
    lastOutput,
    linkedTools,
    displayItems,
  };
}
