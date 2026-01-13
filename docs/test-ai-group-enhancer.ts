/**
 * Test suite for AI Group Enhancer - Phase 1
 *
 * Validates the core functionality of:
 * - findLastOutput
 * - linkToolCallsToResults
 * - buildDisplayItems
 * - enhanceAIGroup
 */

import type { AIGroup } from './src/renderer/types/groups';
import type { SemanticStep, SessionMetrics } from './src/renderer/types/data';
import {
  findLastOutput,
  linkToolCallsToResults,
  buildDisplayItems,
  enhanceAIGroup
} from './src/renderer/utils/aiGroupEnhancer';

// Test data
const mockMetrics: SessionMetrics = {
  durationMs: 1000,
  totalTokens: 100,
  inputTokens: 50,
  outputTokens: 50,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  messageCount: 3,
};

const mockSteps: SemanticStep[] = [
  {
    id: 'step-1',
    type: 'thinking',
    startTime: new Date('2025-01-01T10:00:00Z'),
    durationMs: 100,
    content: {
      thinkingText: 'Let me analyze this...',
    },
    context: 'main',
  },
  {
    id: 'toolu_abc123',  // Tool call ID
    type: 'tool_call',
    startTime: new Date('2025-01-01T10:00:01Z'),
    durationMs: 500,
    content: {
      toolName: 'Read',
      toolInput: { file_path: '/test.txt' },
    },
    context: 'main',
  },
  {
    id: 'toolu_abc123',  // Same ID as tool call (this is how ChunkBuilder sets it)
    type: 'tool_result',
    startTime: new Date('2025-01-01T10:00:02Z'),
    durationMs: 50,
    content: {
      toolName: 'Read',
      toolResultContent: 'File contents: Hello World',
      isError: false,
    },
    context: 'main',
  },
  {
    id: 'step-4',
    type: 'output',
    startTime: new Date('2025-01-01T10:00:03Z'),
    durationMs: 200,
    content: {
      outputText: 'The file contains "Hello World"',
    },
    context: 'main',
  },
];

const mockAIGroup: AIGroup = {
  id: 'ai-group-1',
  userGroupId: 'user-group-1',
  responseIndex: 0,
  startTime: new Date('2025-01-01T10:00:00Z'),
  endTime: new Date('2025-01-01T10:00:03Z'),
  durationMs: 3000,
  steps: mockSteps,
  tokens: {
    input: 50,
    output: 50,
    cached: 0,
  },
  summary: {
    toolCallCount: 1,
    outputMessageCount: 1,
    subagentCount: 0,
    totalDurationMs: 3000,
    totalTokens: 100,
    outputTokens: 50,
    cachedTokens: 0,
  },
  status: 'complete',
  subagents: [],
  chunkId: 'chunk-1',
  metrics: mockMetrics,
};

// Test 1: findLastOutput
console.log('\n=== Test 1: findLastOutput ===');
const lastOutput = findLastOutput(mockSteps);
console.log('Last output:', lastOutput);
console.assert(lastOutput !== null, 'Should find last output');
console.assert(lastOutput?.type === 'text', 'Should be text output');
console.assert(lastOutput?.text === 'The file contains "Hello World"', 'Should have correct text');
console.log('✓ findLastOutput works correctly');

// Test 2: linkToolCallsToResults
console.log('\n=== Test 2: linkToolCallsToResults ===');
const linkedTools = linkToolCallsToResults(mockSteps);
console.log('Linked tools:', Array.from(linkedTools.entries()));
console.assert(linkedTools.size === 1, 'Should have 1 linked tool');
const toolItem = linkedTools.get('toolu_abc123');
console.assert(toolItem !== undefined, 'Should find tool by ID');
console.assert(toolItem?.name === 'Read', 'Should have correct tool name');
console.assert(toolItem?.isOrphaned === false, 'Should not be orphaned');
console.assert(toolItem?.inputPreview.includes('file_path'), 'Should have input preview');
console.assert(toolItem?.outputPreview?.includes('Hello World'), 'Should have output preview');
console.log('✓ linkToolCallsToResults works correctly');

// Test 3: buildDisplayItems
console.log('\n=== Test 3: buildDisplayItems ===');
const displayItems = buildDisplayItems(mockSteps, lastOutput, []);
console.log('Display items:', displayItems);
console.assert(displayItems.length === 2, 'Should have 2 display items (thinking + tool, excluding last output)');
console.assert(displayItems[0].type === 'thinking', 'First item should be thinking');
console.assert(displayItems[1].type === 'tool', 'Second item should be tool');
console.log('✓ buildDisplayItems works correctly');

// Test 4: enhanceAIGroup
console.log('\n=== Test 4: enhanceAIGroup ===');
const enhanced = enhanceAIGroup(mockAIGroup);
console.log('Enhanced AI Group:', {
  lastOutput: enhanced.lastOutput,
  displayItemCount: enhanced.displayItems.length,
  linkedToolCount: enhanced.linkedTools.size,
});
console.assert(enhanced.lastOutput !== null, 'Should have last output');
console.assert(enhanced.displayItems.length === 2, 'Should have 2 display items');
console.assert(enhanced.linkedTools.size === 1, 'Should have 1 linked tool');
console.assert('id' in enhanced, 'Should still have all AIGroup properties');
console.log('✓ enhanceAIGroup works correctly');

// Test 5: Orphaned tool call
console.log('\n=== Test 5: Orphaned tool call ===');
const orphanedSteps: SemanticStep[] = [
  {
    id: 'orphan-1',
    type: 'tool_call',
    startTime: new Date('2025-01-01T10:00:00Z'),
    durationMs: 1000,
    content: {
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    },
    context: 'main',
  },
  {
    id: 'orphan-2',
    type: 'output',
    startTime: new Date('2025-01-01T10:00:01Z'),
    durationMs: 100,
    content: {
      outputText: 'Command was interrupted',
    },
    context: 'main',
  },
];
const orphanedLinked = linkToolCallsToResults(orphanedSteps);
const orphanedTool = orphanedLinked.get('orphan-1');
console.assert(orphanedTool?.isOrphaned === true, 'Should detect orphaned tool');
console.assert(orphanedTool?.outputPreview === undefined, 'Orphaned tool should have no output preview');
console.log('✓ Orphaned tool detection works correctly');

// Test 6: No output case
console.log('\n=== Test 6: No output case ===');
const noOutputSteps: SemanticStep[] = [
  {
    id: 'no-output-1',
    type: 'thinking',
    startTime: new Date('2025-01-01T10:00:00Z'),
    durationMs: 100,
    content: {
      thinkingText: 'Just thinking...',
    },
    context: 'main',
  },
];
const noOutput = findLastOutput(noOutputSteps);
console.assert(noOutput === null, 'Should return null when no output exists');
console.log('✓ No output case handled correctly');

// Test 7: Tool result as last output
console.log('\n=== Test 7: Tool result as last output ===');
const toolResultLastSteps: SemanticStep[] = [
  {
    id: 'tool-last-1',
    type: 'tool_call',
    startTime: new Date('2025-01-01T10:00:00Z'),
    durationMs: 100,
    content: {
      toolName: 'Grep',
      toolInput: { pattern: 'test' },
    },
    context: 'main',
  },
  {
    id: 'tool-last-2',
    type: 'tool_result',
    startTime: new Date('2025-01-01T10:00:01Z'),
    durationMs: 50,
    content: {
      toolName: 'Grep',
      toolResultContent: 'Found 3 matches',
      isError: false,
    },
    context: 'main',
  },
];
const toolResultLast = findLastOutput(toolResultLastSteps);
console.assert(toolResultLast?.type === 'tool_result', 'Should use tool result as last output');
console.assert(toolResultLast?.toolName === 'Grep', 'Should have correct tool name');
console.log('✓ Tool result as last output works correctly');

console.log('\n=== All tests passed! ===\n');
