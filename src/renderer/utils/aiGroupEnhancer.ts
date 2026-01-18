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
import type { SemanticStep, Process, ParsedMessage, ContentBlock } from '../types/data';
import type { ClaudeMdStats } from '../types/claudeMd';
import { parseModelString, type ModelInfo } from '../../shared/utils/modelParser';

/**
 * Safely converts a timestamp to a Date object.
 * Handles both Date objects and ISO string timestamps (from IPC serialization).
 */
export function toDate(timestamp: Date | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

/**
 * Truncates text to a maximum length and adds ellipsis if needed.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Converts tool input object to a preview string.
 */
export function formatToolInput(input: Record<string, unknown>): string {
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
export function formatToolResult(content: string | unknown[]): string {
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
 * 1. If isOngoing is true, return 'ongoing' type (session still in progress)
 * 2. Iterate through steps in reverse order
 * 3. Find the last 'output' step with outputText
 * 4. If no output found, find the last 'tool_result' step
 * 5. If no tool_result found, find the last 'interruption' step
 * 6. Return null if none exists
 *
 * @param steps - Semantic steps from the AI Group
 * @param isOngoing - Whether this AI group is still in progress
 * @returns The last output or null
 */
export function findLastOutput(steps: SemanticStep[], isOngoing: boolean = false): AIGroupLastOutput | null {
  // Check for interruption first - interruption takes precedence over ongoing status
  // This ensures user interruptions are always visible even if session appears ongoing
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === 'interruption') {
      return {
        type: 'interruption',
        timestamp: step.startTime,
      };
    }
  }

  // If session is ongoing (and no interruption), return 'ongoing' type
  if (isOngoing) {
    return {
      type: 'ongoing',
      timestamp: steps.length > 0 ? toDate(steps[steps.length - 1].startTime) : new Date(),
    };
  }

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

  // Third pass: look for last 'interruption' step
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === 'interruption' && step.content.interruptionText) {
      return {
        type: 'interruption',
        interruptionMessage: step.content.interruptionText,
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

    // Convert timestamps to proper Date objects (handles IPC serialization)
    const callStartTime = toDate(callStep.startTime);
    const resultStartTime = resultStep ? toDate(resultStep.startTime) : undefined;

    const linkedItem: LinkedToolItem = {
      id: toolCallId,
      name: toolName,
      input: toolInput as Record<string, unknown>,
      result: resultStep ? {
        content: resultStep.content.toolResultContent || '',
        isError: resultStep.content.isError || false,
        toolUseResult: resultStep.content.toolUseResult,
      } : undefined,
      inputPreview: formatToolInput(toolInput as Record<string, unknown>),
      outputPreview: resultStep ? formatToolResult(resultStep.content.toolResultContent || '') : undefined,
      startTime: callStartTime,
      endTime: resultStartTime,
      durationMs: resultStartTime
        ? resultStartTime.getTime() - callStartTime.getTime()
        : undefined,
      isOrphaned: !resultStep,
    };

    linkedTools.set(toolCallId, linkedItem);
  }

  return linkedTools;
}

/**
 * Build a human-readable summary of display items.
 *
 * Strategy:
 * 1. Count items by type (thinking, tool, output, subagent)
 * 2. Format as "X thinking, Y tool calls, Z messages, N subagents"
 * 3. Skip counts that are zero
 * 4. Return formatted string
 *
 * @param items - Display items to summarize
 * @returns Formatted summary string
 */
export function buildSummary(items: AIGroupDisplayItem[]): string {
  const counts = {
    thinking: 0,
    tool: 0,
    output: 0,
    subagent: 0,
  };

  for (const item of items) {
    counts[item.type]++;
  }

  const parts: string[] = [];

  if (counts.thinking > 0) {
    parts.push(`${counts.thinking} thinking`);
  }
  if (counts.tool > 0) {
    parts.push(`${counts.tool} tool ${counts.tool === 1 ? 'call' : 'calls'}`);
  }
  if (counts.output > 0) {
    parts.push(`${counts.output} ${counts.output === 1 ? 'message' : 'messages'}`);
  }
  if (counts.subagent > 0) {
    parts.push(`${counts.subagent} ${counts.subagent === 1 ? 'subagent' : 'subagents'}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No items';
}

/**
 * Extract the main model used in an AI Group.
 *
 * Strategy:
 * 1. Look through semantic steps to find tool_call steps with sourceModel
 * 2. Count occurrences of each model
 * 3. Return the most common model (in case of mixed usage)
 *
 * @param steps - Semantic steps from the AI Group
 * @returns The most common model info, or null if no models found
 */
export function extractMainModel(steps: SemanticStep[]): ModelInfo | null {
  const modelCounts = new Map<string, { count: number; info: ModelInfo }>();

  for (const step of steps) {
    // Tool call steps have sourceModel set from the assistant message
    if (step.type === 'tool_call' && step.content.sourceModel) {
      const model = step.content.sourceModel;
      if (model && model !== '<synthetic>') {
        const info = parseModelString(model);
        if (info) {
          const existing = modelCounts.get(info.name);
          if (existing) {
            existing.count++;
          } else {
            modelCounts.set(info.name, { count: 1, info });
          }
        }
      }
    }
  }

  // Find most common model
  let maxCount = 0;
  let mainModel: ModelInfo | null = null;

  for (const { count, info } of modelCounts.values()) {
    if (count > maxCount) {
      maxCount = count;
      mainModel = info;
    }
  }

  return mainModel;
}

/**
 * Extract unique models used by subagents that differ from the main model.
 *
 * Strategy:
 * 1. Iterate through all processes (subagents)
 * 2. Find the first assistant message with a valid model in each process
 * 3. Parse and collect unique models that differ from mainModel
 *
 * @param processes - Subagent processes from the AI Group
 * @param mainModel - The main agent's model (to filter out)
 * @returns Array of unique model infos used by subagents
 */
export function extractSubagentModels(processes: Process[], mainModel: ModelInfo | null): ModelInfo[] {
  const uniqueModels = new Map<string, ModelInfo>();

  for (const process of processes) {
    // Find first assistant message with a valid model
    const assistantMsg = process.messages?.find(
      m => m.type === 'assistant' && m.model && m.model !== '<synthetic>'
    );

    if (assistantMsg?.model) {
      const modelInfo = parseModelString(assistantMsg.model);
      if (modelInfo && modelInfo.name !== mainModel?.name) {
        uniqueModels.set(modelInfo.name, modelInfo);
      }
    }
  }

  return Array.from(uniqueModels.values());
}

/**
 * Build a flat chronological list of display items for the AI Group.
 *
 * Strategy:
 * 1. Skip the step that represents lastOutput (to avoid duplication)
 * 2. For tool_call steps, use the LinkedToolItem (which includes the result)
 * 3. Skip standalone tool_result steps (already linked to calls)
 * 4. Skip Task tool_call steps that have associated subagents (avoid duplication)
 * 5. Include thinking, subagent, and output steps
 * 6. Return items in chronological order
 *
 * @param steps - Semantic steps from the AI Group
 * @param lastOutput - The last output to skip
 * @param subagents - Subagents associated with this group
 * @returns Flat array of display items
 */
export function buildDisplayItems(
  steps: SemanticStep[],
  lastOutput: AIGroupLastOutput | null,
  subagents: Process[]
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

  // Build set of Task IDs that have associated subagents
  // This prevents duplicate display of Task tool calls when subagents are shown
  const taskIdsWithSubagents = new Set<string>(
    subagents.map(s => s.parentTaskId).filter((id): id is string => !!id)
  );

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
      if (lastOutput.type === 'interruption' && step.type === 'interruption' && step.content.interruptionText === lastOutput.interruptionMessage) {
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
          // Skip Task tool calls that have associated subagents
          // The subagent will be shown separately, so showing the Task call is redundant
          const isTaskWithSubagent = linkedTool.name === 'Task' && taskIdsWithSubagents.has(step.id);
          if (!isTaskWithSubagent) {
            displayItems.push({
              type: 'tool',
              tool: linkedTool,
            });
          }
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
        if (step.content.interruptionText) {
          displayItems.push({
            type: 'output',
            content: step.content.interruptionText,
            timestamp: step.startTime,
          });
        }
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
 * @param claudeMdStats - Optional CLAUDE.md injection stats for this group
 * @returns Enhanced AI Group with display data
 */
export function enhanceAIGroup(
  aiGroup: AIGroup,
  claudeMdStats?: ClaudeMdStats
): EnhancedAIGroup {
  // Pass isOngoing to findLastOutput - if ongoing, it returns 'ongoing' type instead of forcing a last output
  const lastOutput = findLastOutput(aiGroup.steps, aiGroup.isOngoing ?? false);
  const linkedTools = linkToolCallsToResults(aiGroup.steps);
  const displayItems = buildDisplayItems(aiGroup.steps, lastOutput, aiGroup.processes);
  const summary = buildSummary(displayItems);
  const mainModel = extractMainModel(aiGroup.steps);
  const subagentModels = extractSubagentModels(aiGroup.processes, mainModel);

  return {
    ...aiGroup,
    lastOutput,
    linkedTools,
    displayItems,
    itemsSummary: summary,
    mainModel,
    subagentModels,
    claudeMdStats: claudeMdStats || null,
  };
}

/**
 * Build display items from raw ParsedMessages (used by subagents).
 * This mirrors the logic of buildDisplayItems but works with messages instead of SemanticSteps.
 *
 * Strategy:
 * 1. Extract thinking blocks from assistant messages
 * 2. Extract tool_use blocks from assistant messages → collect in a Map by ID
 * 3. Extract text output blocks from assistant messages
 * 4. Extract tool_result blocks from user messages (isMeta or toolResults exist)
 * 5. Link tool calls with their results using LinkedToolItem structure
 * 6. Filter Task tool calls that have matching subagents
 * 7. Include subagents as separate items
 * 8. Sort all items chronologically
 *
 * @param messages - Raw ParsedMessages to process
 * @param subagents - Subagents associated with these messages
 * @returns Flat array of display items
 */
export function buildDisplayItemsFromMessages(
  messages: ParsedMessage[],
  subagents: Process[] = []
): AIGroupDisplayItem[] {
  const displayItems: AIGroupDisplayItem[] = [];

  // Maps for tool call/result linking
  const toolCallsById = new Map<string, {
    id: string;
    name: string;
    input: Record<string, unknown>;
    timestamp: Date;
    sourceMessageId: string;
    sourceModel?: string;
  }>();

  const toolResultsById = new Map<string, {
    content: string | unknown[];
    isError: boolean;
    toolUseResult?: Record<string, unknown>;
    timestamp: Date;
  }>();

  // Build set of Task IDs that have associated subagents
  // This prevents duplicate display of Task tool calls when subagents are shown
  const taskIdsWithSubagents = new Set<string>(
    subagents.map(s => s.parentTaskId).filter((id): id is string => !!id)
  );

  // First pass: collect tool calls and tool results from messages
  for (const msg of messages) {
    const msgTimestamp = toDate(msg.timestamp);

    if (msg.type === 'assistant' && Array.isArray(msg.content)) {
      // Process assistant message content blocks
      for (const block of msg.content as ContentBlock[]) {
        if (block.type === 'thinking' && block.thinking) {
          // Add thinking block
          displayItems.push({
            type: 'thinking',
            content: block.thinking,
            timestamp: msgTimestamp,
          });
        } else if (block.type === 'tool_use' && block.id && block.name) {
          // Collect tool call for later linking
          toolCallsById.set(block.id, {
            id: block.id,
            name: block.name,
            input: (block.input || {}) as Record<string, unknown>,
            timestamp: msgTimestamp,
            sourceMessageId: msg.uuid,
            sourceModel: msg.model,
          });
        } else if (block.type === 'text' && block.text) {
          // Add text output
          displayItems.push({
            type: 'output',
            content: block.text,
            timestamp: msgTimestamp,
          });
        }
      }
    } else if (msg.type === 'user' && (msg.isMeta || msg.toolResults.length > 0)) {
      // Process tool results from internal user messages
      if (Array.isArray(msg.content)) {
        for (const block of msg.content as ContentBlock[]) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            // Collect tool result for linking
            toolResultsById.set(block.tool_use_id, {
              content: block.content || '',
              isError: block.is_error || false,
              toolUseResult: msg.toolUseResult,
              timestamp: msgTimestamp,
            });
          }
        }
      }

      // Also check msg.toolResults array (pre-extracted results)
      for (const result of msg.toolResults) {
        if (!toolResultsById.has(result.toolUseId)) {
          toolResultsById.set(result.toolUseId, {
            content: result.content,
            isError: result.isError,
            toolUseResult: msg.toolUseResult,
            timestamp: msgTimestamp,
          });
        }
      }
    }
  }

  // Second pass: Build LinkedToolItems by matching calls with results
  for (const [toolId, call] of toolCallsById.entries()) {
    const result = toolResultsById.get(toolId);

    // Skip Task tool calls that have associated subagents
    // The subagent will be shown separately, so showing the Task call is redundant
    const isTaskWithSubagent = call.name === 'Task' && taskIdsWithSubagents.has(toolId);
    if (isTaskWithSubagent) {
      continue;
    }

    const linkedItem: LinkedToolItem = {
      id: toolId,
      name: call.name,
      input: call.input,
      result: result ? {
        content: result.content,
        isError: result.isError,
        toolUseResult: result.toolUseResult,
      } : undefined,
      inputPreview: formatToolInput(call.input),
      outputPreview: result ? formatToolResult(result.content) : undefined,
      startTime: call.timestamp,
      endTime: result?.timestamp,
      durationMs: result?.timestamp
        ? result.timestamp.getTime() - call.timestamp.getTime()
        : undefined,
      isOrphaned: !result,
      sourceModel: call.sourceModel,
    };

    displayItems.push({
      type: 'tool',
      tool: linkedItem,
    });
  }

  // Add subagents as display items
  for (const subagent of subagents) {
    displayItems.push({
      type: 'subagent',
      subagent: subagent,
    });
  }

  // Sort all items chronologically
  displayItems.sort((a, b) => {
    const getTimestamp = (item: AIGroupDisplayItem): Date => {
      switch (item.type) {
        case 'thinking':
        case 'output':
          return toDate(item.timestamp);
        case 'tool':
          return toDate(item.tool.startTime);
        case 'subagent':
          return toDate(item.subagent.startTime);
      }
    };
    return getTimestamp(a).getTime() - getTimestamp(b).getTime();
  });

  return displayItems;
}
