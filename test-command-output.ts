#!/usr/bin/env tsx
/**
 * Test script to verify command output message handling
 *
 * This script tests that messages with <local-command-stdout> are:
 * 1. NOT classified as real user messages (don't start chunks)
 * 2. ARE classified as response user messages (included in AI responses)
 * 3. Content is properly extracted by sanitizeDisplayContent
 *
 * Run with: npx tsx test-command-output.ts
 */

import {
  isParsedRealUserMessage,
  isParsedResponseUserMessage,
  isParsedCommandOutputMessage,
  ParsedMessage,
} from './src/main/types/claude';
import { sanitizeDisplayContent } from './src/shared/utils/contentSanitizer';

// Test message 1: Command output message
const commandOutputMsg: ParsedMessage = {
  uuid: 'test-1',
  parentUuid: null,
  type: 'user',
  timestamp: new Date(),
  content: '<local-command-stdout>Set model to \u001b[1msonnet (claude-sonnet-4-5-20250929)\u001b[22m</local-command-stdout>',
  isSidechain: false,
  isMeta: false,
  toolCalls: [],
  toolResults: [],
};

// Test message 2: Real user message
const realUserMsg: ParsedMessage = {
  uuid: 'test-2',
  parentUuid: null,
  type: 'user',
  timestamp: new Date(),
  content: 'Please help me with this task',
  isSidechain: false,
  isMeta: false,
  toolCalls: [],
  toolResults: [],
};

// Test message 3: Internal user message (tool result)
const internalUserMsg: ParsedMessage = {
  uuid: 'test-3',
  parentUuid: null,
  type: 'user',
  timestamp: new Date(),
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_123',
      content: 'File content here',
    },
  ],
  isSidechain: false,
  isMeta: true,
  toolCalls: [],
  toolResults: [],
};

console.log('=== Command Output Message Tests ===\n');

console.log('Test 1: Command output message classification');
console.log('Content:', commandOutputMsg.content);
console.log('isParsedCommandOutputMessage:', isParsedCommandOutputMessage(commandOutputMsg));
console.log('isParsedRealUserMessage:', isParsedRealUserMessage(commandOutputMsg), '(should be FALSE)');
console.log('isParsedResponseUserMessage:', isParsedResponseUserMessage(commandOutputMsg), '(should be TRUE)');
console.log('Sanitized content:', sanitizeDisplayContent(commandOutputMsg.content as string));
console.log('');

console.log('Test 2: Real user message classification');
console.log('Content:', realUserMsg.content);
console.log('isParsedCommandOutputMessage:', isParsedCommandOutputMessage(realUserMsg));
console.log('isParsedRealUserMessage:', isParsedRealUserMessage(realUserMsg), '(should be TRUE)');
console.log('isParsedResponseUserMessage:', isParsedResponseUserMessage(realUserMsg), '(should be FALSE)');
console.log('Sanitized content:', sanitizeDisplayContent(realUserMsg.content as string));
console.log('');

console.log('Test 3: Internal user message (tool result) classification');
console.log('isParsedCommandOutputMessage:', isParsedCommandOutputMessage(internalUserMsg));
console.log('isParsedRealUserMessage:', isParsedRealUserMessage(internalUserMsg), '(should be FALSE)');
console.log('isParsedResponseUserMessage:', isParsedResponseUserMessage(internalUserMsg), '(should be TRUE)');
console.log('');

console.log('=== Summary ===');
const test1Pass = !isParsedRealUserMessage(commandOutputMsg) && isParsedResponseUserMessage(commandOutputMsg);
const test2Pass = isParsedRealUserMessage(realUserMsg) && !isParsedResponseUserMessage(realUserMsg);
const test3Pass = !isParsedRealUserMessage(internalUserMsg) && isParsedResponseUserMessage(internalUserMsg);

console.log('✓ Test 1 (command output):', test1Pass ? 'PASS' : 'FAIL');
console.log('✓ Test 2 (real user):', test2Pass ? 'PASS' : 'FAIL');
console.log('✓ Test 3 (internal user):', test3Pass ? 'PASS' : 'FAIL');
console.log('');
console.log('All tests:', (test1Pass && test2Pass && test3Pass) ? '✓ PASSED' : '✗ FAILED');
