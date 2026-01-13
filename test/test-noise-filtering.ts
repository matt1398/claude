/**
 * Verification Test Script for Noise Filtering
 *
 * This script tests the noise filtering logic to ensure:
 * 1. Local commands (like /usage, /mcp, /exit, etc.) are correctly identified as noise
 * 2. System messages with <command-name> tags are filtered out
 * 3. Messages with <local-command-caveat> are properly handled
 * 4. Noise messages do NOT create chunks (chunks should only be created for real user input)
 * 5. A session with only noise messages produces zero chunks
 */

import * as path from 'path';
import * as fs from 'fs';
import { parseJsonlFile, isRealUserMessage, isInternalUserMessage, isAssistantMessage } from '../src/main/utils/jsonl';
import { ChunkBuilder } from '../src/main/services/ChunkBuilder';
import { ParsedMessage } from '../src/main/types/claude';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color?: keyof typeof colors) {
  const c = color ? colors[color] : colors.reset;
  console.log(`${c}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logSubsection(title: string) {
  log(`\n${title}`, 'cyan');
  console.log('-'.repeat(80));
}

/**
 * Detects if a message is a noise message that should not trigger chunks.
 * This includes:
 * - System messages with <command-name> tags (local commands)
 * - Messages with <local-command-caveat> or <local-command-stdout>
 * - isMeta: true messages
 */
function isNoiseMessage(msg: ParsedMessage): boolean {
  // isMeta: true messages are always noise
  if (msg.isMeta) {
    return true;
  }

  // System messages are noise
  if (msg.type === 'system') {
    return true;
  }

  // Check content for noise indicators
  const content = typeof msg.content === 'string' ? msg.content : '';

  // Local command indicators
  if (content.includes('<command-name>') ||
      content.includes('<local-command-caveat>') ||
      content.includes('<local-command-stdout>') ||
      content.includes('<local-command-message>') ||
      content.includes('<command-args>')) {
    return true;
  }

  return false;
}

/**
 * Detects if a message is a real trigger message that should create a chunk.
 * This is the opposite of noise - it's actual user input.
 */
function isTriggerMessage(msg: ParsedMessage): boolean {
  return isRealUserMessage(msg) && !isNoiseMessage(msg);
}

function extractTextContent(msg: ParsedMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content.substring(0, 100);
  }

  const textBlocks = msg.content
    .filter(block => block.type === 'text' && block.text)
    .map(block => block.text || '');

  const text = textBlocks.join(' ');
  return text.substring(0, 100);
}

async function runTests() {
  logSection('Noise Filtering Verification Test');

  // Test file with only noise (local commands)
  const noiseOnlyFile = path.join(__dirname, 'example_jsonl', 'agent', 'example_4.jsonl');

  if (!fs.existsSync(noiseOnlyFile)) {
    log(`Error: Test file not found: ${noiseOnlyFile}`, 'red');
    log('Expected location: example_jsonl/agent/example_4.jsonl', 'red');
    process.exit(1);
  }

  log(`Using test file: ${noiseOnlyFile}`, 'gray');
  const fileSize = fs.statSync(noiseOnlyFile).size;
  log(`File size: ${(fileSize / 1024).toFixed(2)} KB`, 'gray');

  // Parse the session file
  logSubsection('Step 1: Parsing JSONL file');
  const messages = await parseJsonlFile(noiseOnlyFile);
  log(`✓ Parsed ${messages.length} messages`, 'green');

  // Analyze message types
  logSubsection('Step 2: Analyzing message types');

  const realUserMessages = messages.filter(isRealUserMessage);
  const internalUserMessages = messages.filter(isInternalUserMessage);
  const assistantMessages = messages.filter(isAssistantMessage);
  const systemMessages = messages.filter(m => m.type === 'system');
  const metaMessages = messages.filter(m => m.isMeta);

  log(`Total messages:                         ${messages.length}`, 'blue');
  log(`Real user messages (string content):    ${realUserMessages.length}`, 'blue');
  log(`Internal user messages (isMeta: true):  ${internalUserMessages.length}`, 'blue');
  log(`Assistant messages:                     ${assistantMessages.length}`, 'blue');
  log(`System messages:                        ${systemMessages.length}`, 'blue');
  log(`Meta messages (isMeta: true):           ${metaMessages.length}`, 'blue');

  // Identify noise vs trigger messages
  logSubsection('Step 3: Identifying noise vs trigger messages');

  const noiseMessages = messages.filter(isNoiseMessage);
  const triggerMessages = messages.filter(isTriggerMessage);

  log(`Noise messages (should not create chunks):     ${noiseMessages.length}`, 'yellow');
  log(`Trigger messages (should create chunks):       ${triggerMessages.length}`, 'magenta');

  // Show examples of noise messages
  if (noiseMessages.length > 0) {
    log(`\nExamples of noise messages:`, 'gray');

    for (let i = 0; i < Math.min(noiseMessages.length, 5); i++) {
      const msg = noiseMessages[i];
      log(`\n  Noise Message ${i + 1}:`, 'gray');
      log(`    UUID: ${msg.uuid}`, 'gray');
      log(`    Type: ${msg.type}`, 'gray');
      log(`    isMeta: ${msg.isMeta}`, 'gray');
      log(`    Content type: ${typeof msg.content}`, 'gray');

      const content = extractTextContent(msg);
      log(`    Content: ${content}${content.length >= 100 ? '...' : ''}`, 'gray');

      // Identify why it's noise
      if (msg.isMeta) {
        log(`    → Noise reason: isMeta=true`, 'yellow');
      } else if (msg.type === 'system') {
        log(`    → Noise reason: system message`, 'yellow');
      } else {
        const contentStr = typeof msg.content === 'string' ? msg.content : '';
        if (contentStr.includes('<command-name>')) {
          log(`    → Noise reason: contains <command-name>`, 'yellow');
        } else if (contentStr.includes('<local-command-caveat>')) {
          log(`    → Noise reason: contains <local-command-caveat>`, 'yellow');
        } else if (contentStr.includes('<local-command-stdout>')) {
          log(`    → Noise reason: contains <local-command-stdout>`, 'yellow');
        }
      }
    }
  }

  if (triggerMessages.length > 0) {
    log(`\nExamples of trigger messages (real user input):`, 'gray');

    for (let i = 0; i < Math.min(triggerMessages.length, 3); i++) {
      const msg = triggerMessages[i];
      log(`\n  Trigger Message ${i + 1}:`, 'gray');
      log(`    UUID: ${msg.uuid}`, 'gray');
      log(`    Type: ${msg.type}`, 'gray');
      log(`    isMeta: ${msg.isMeta}`, 'gray');
      log(`    Content: ${extractTextContent(msg)}...`, 'gray');
    }
  }

  // Build chunks
  logSubsection('Step 4: Building chunks from messages');
  const chunkBuilder = new ChunkBuilder();
  const chunks = chunkBuilder.buildChunks(messages);
  log(`✓ Created ${chunks.length} chunks`, 'green');

  // Verify noise filtering
  logSubsection('Step 5: Verifying noise filtering');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Noise-only file should produce zero chunks
  log(`\nTest 1: Noise-only file produces zero chunks`, 'bright');
  log(`  Total messages: ${messages.length}`, 'gray');
  log(`  Noise messages: ${noiseMessages.length}`, 'gray');
  log(`  Trigger messages: ${triggerMessages.length}`, 'gray');
  log(`  Chunks created: ${chunks.length}`, 'gray');

  if (chunks.length === 0) {
    log(`✓ Test 1 PASSED: Noise-only file correctly produces 0 chunks`, 'green');
    passedTests++;
  } else {
    log(`✗ Test 1 FAILED: Expected 0 chunks, got ${chunks.length}`, 'red');
    log(`  This means noise messages are incorrectly triggering chunk creation`, 'red');
    failedTests++;

    // Show which messages started chunks
    if (chunks.length > 0) {
      log(`\n  Messages that incorrectly started chunks:`, 'red');
      for (const chunk of chunks) {
        const msg = chunk.userMessage;
        log(`    - ${msg.uuid}: ${extractTextContent(msg)}`, 'red');
        log(`      Type: ${msg.type}, isMeta: ${msg.isMeta}`, 'red');
      }
    }
  }

  // Test 2: All messages should be identified as noise
  log(`\nTest 2: All messages identified as noise`, 'bright');
  const nonNoiseCount = messages.length - noiseMessages.length;

  if (nonNoiseCount === 0) {
    log(`✓ Test 2 PASSED: All ${messages.length} messages correctly identified as noise`, 'green');
    passedTests++;
  } else {
    log(`✗ Test 2 FAILED: ${nonNoiseCount} messages not identified as noise`, 'red');
    failedTests++;
  }

  // Test 3: No trigger messages should exist
  log(`\nTest 3: No trigger messages in noise-only file`, 'bright');

  if (triggerMessages.length === 0) {
    log(`✓ Test 3 PASSED: No trigger messages found (all filtered as noise)`, 'green');
    passedTests++;
  } else {
    log(`✗ Test 3 FAILED: Found ${triggerMessages.length} trigger messages`, 'red');
    log(`  These messages should have been filtered as noise:`, 'red');
    for (const msg of triggerMessages) {
      log(`    - ${msg.uuid}: ${extractTextContent(msg)}`, 'red');
    }
    failedTests++;
  }

  // Test 4: Verify specific command types are filtered
  logSubsection('Step 6: Verifying specific command type filtering');

  const commandTypes = {
    '/usage': 0,
    '/mcp': 0,
    '/model': 0,
    '/exit': 0,
    '<command-name>': 0,
    '<local-command-caveat>': 0,
    '<local-command-stdout>': 0,
  };

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';

    if (content.includes('/usage')) commandTypes['/usage']++;
    if (content.includes('/mcp')) commandTypes['/mcp']++;
    if (content.includes('/model')) commandTypes['/model']++;
    if (content.includes('/exit')) commandTypes['/exit']++;
    if (content.includes('<command-name>')) commandTypes['<command-name>']++;
    if (content.includes('<local-command-caveat>')) commandTypes['<local-command-caveat>']++;
    if (content.includes('<local-command-stdout>')) commandTypes['<local-command-stdout>']++;
  }

  log(`\nCommand type breakdown:`, 'gray');
  for (const [type, count] of Object.entries(commandTypes)) {
    if (count > 0) {
      log(`  ${type}: ${count} occurrences`, 'gray');
    }
  }

  const totalCommandMessages = Object.values(commandTypes).reduce((sum, count) => sum + count, 0);
  log(`\nTotal command-related messages: ${totalCommandMessages}`, 'blue');

  if (totalCommandMessages > 0 && chunks.length === 0) {
    log(`✓ Test 4 PASSED: All command messages filtered correctly`, 'green');
    passedTests++;
  } else if (totalCommandMessages === 0) {
    log(`⊘ Test 4 SKIPPED: No command messages found in file`, 'yellow');
  } else {
    log(`✗ Test 4 FAILED: Command messages present but chunks were created`, 'red');
    failedTests++;
  }

  // Summary
  logSection('Test Summary');

  log(`Total tests: ${passedTests + failedTests}`, 'bright');
  log(`Passed: ${passedTests}`, 'green');
  if (failedTests > 0) {
    log(`Failed: ${failedTests}`, 'red');
  }

  log(`\nKey findings:`, 'bright');
  if (chunks.length === 0) {
    log(`✓ Noise filtering works correctly`, 'green');
    log(`✓ Local commands (${noiseMessages.length} messages) do not trigger chunk creation`, 'green');
    log(`✓ System messages with <command-name> tags are properly filtered`, 'green');
    log(`✓ Messages with <local-command-caveat> are ignored`, 'green');
    log(`✓ ChunkBuilder correctly produces 0 chunks for noise-only sessions`, 'green');
  } else {
    log(`✗ Noise filtering is not working correctly`, 'red');
    log(`✗ Some noise messages are incorrectly creating chunks`, 'red');
    log(`✗ ChunkBuilder needs to be updated to filter these messages`, 'red');
  }

  log(`\nFile statistics:`, 'bright');
  log(`  Total messages: ${messages.length}`, 'blue');
  log(`  Noise messages: ${noiseMessages.length}`, 'blue');
  log(`  Trigger messages: ${triggerMessages.length}`, 'blue');
  log(`  Chunks created: ${chunks.length}`, 'blue');
  log(`  System messages: ${systemMessages.length}`, 'blue');
  log(`  Meta messages: ${metaMessages.length}`, 'blue');

  if (passedTests === 4) {
    log(`\n🎉 All tests passed! Noise filtering is working correctly.`, 'green');
  }

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  log(`\nError running tests: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
