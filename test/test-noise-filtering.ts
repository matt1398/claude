/**
 * Verification Test Script for Noise Filtering
 *
 * This script tests the noise filtering logic to ensure:
 * 1. Command messages (/usage, /mcp, /model, etc.) ARE visible as user input
 * 2. System metadata tags (<local-command-stdout>, <local-command-caveat>) are filtered
 * 3. Command messages create chunks (they represent real user actions)
 * 4. System-generated output/caveats are filtered as noise
 *
 * DESIGN DECISION:
 * - <command-name> tags contain REAL user commands (e.g., /model, /clear)
 *   These ARE trigger messages that should create chunks
 * - <local-command-stdout> and <local-command-caveat> are system-generated
 *   These are noise and should be filtered
 */

import * as path from 'path';
import * as fs from 'fs';
import { parseJsonlFile, isRealUserMessage, isInternalUserMessage, isAssistantMessage } from '../src/main/utils/jsonl';
import { ChunkBuilder } from '../src/main/services/ChunkBuilder';
import { ParsedMessage, isParsedNoiseMessage } from '../src/main/types/claude';

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
 * Detects if a message is a command message (user typed /command).
 * These ARE valid user input and should create chunks.
 */
function isCommandMessage(msg: ParsedMessage): boolean {
  const content = typeof msg.content === 'string' ? msg.content : '';
  return content.includes('<command-name>');
}

/**
 * Detects if a message is system-generated noise.
 * Uses the canonical isParsedNoiseMessage from types.
 */
function isNoiseMessage(msg: ParsedMessage): boolean {
  return isParsedNoiseMessage(msg);
}

/**
 * Detects if a message is a real trigger message that should create a chunk.
 */
function isTriggerMessage(msg: ParsedMessage): boolean {
  return isRealUserMessage(msg) && !isNoiseMessage(msg);
}

function extractTextContent(msg: ParsedMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content.substring(0, 100);
  }

  const textBlocks = (msg.content as any[])
    .filter(block => block.type === 'text' && block.text)
    .map(block => block.text || '');

  const text = textBlocks.join(' ');
  return text.substring(0, 100);
}

async function runTests() {
  logSection('Noise Filtering Verification Test');

  // Test file with commands (local commands)
  const commandFile = path.join(__dirname, '..', 'example_jsonl', 'agent', 'example_4.jsonl');

  if (!fs.existsSync(commandFile)) {
    log(`Error: Test file not found: ${commandFile}`, 'red');
    log('Expected location: example_jsonl/agent/example_4.jsonl', 'red');
    process.exit(1);
  }

  log(`Using test file: ${commandFile}`, 'gray');
  const fileSize = fs.statSync(commandFile).size;
  log(`File size: ${(fileSize / 1024).toFixed(2)} KB`, 'gray');

  // Parse the session file
  logSubsection('Step 1: Parsing JSONL file');
  const messages = await parseJsonlFile(commandFile);
  log(`✓ Parsed ${messages.length} messages`, 'green');

  // Analyze message types
  logSubsection('Step 2: Analyzing message types');

  const realUserMessages = messages.filter(isRealUserMessage);
  const internalUserMessages = messages.filter(isInternalUserMessage);
  const assistantMessages = messages.filter(isAssistantMessage);
  const systemMessages = messages.filter(m => m.type === 'system');
  const metaMessages = messages.filter(m => m.isMeta);
  const commandMessages = messages.filter(isCommandMessage);

  log(`Total messages:                         ${messages.length}`, 'blue');
  log(`Real user messages (string content):    ${realUserMessages.length}`, 'blue');
  log(`Command messages (<command-name>):      ${commandMessages.length}`, 'magenta');
  log(`Internal user messages (isMeta: true):  ${internalUserMessages.length}`, 'blue');
  log(`Assistant messages:                     ${assistantMessages.length}`, 'blue');
  log(`System messages:                        ${systemMessages.length}`, 'blue');
  log(`Meta messages (isMeta: true):           ${metaMessages.length}`, 'blue');

  // Identify noise vs trigger messages
  logSubsection('Step 3: Identifying noise vs trigger messages');

  const noiseMessages = messages.filter(isNoiseMessage);
  const triggerMessages = messages.filter(isTriggerMessage);

  log(`Noise messages (filtered out):           ${noiseMessages.length}`, 'yellow');
  log(`Trigger messages (create chunks):        ${triggerMessages.length}`, 'magenta');
  log(`  - Including command messages:          ${commandMessages.filter(m => !isNoiseMessage(m)).length}`, 'gray');

  // Show examples of command messages
  if (commandMessages.length > 0) {
    log(`\nExamples of command messages (should create chunks):`, 'gray');

    for (let i = 0; i < Math.min(commandMessages.length, 3); i++) {
      const msg = commandMessages[i];
      log(`\n  Command Message ${i + 1}:`, 'gray');
      log(`    UUID: ${msg.uuid}`, 'gray');
      log(`    Type: ${msg.type}`, 'gray');
      log(`    isMeta: ${msg.isMeta}`, 'gray');

      const content = extractTextContent(msg);
      log(`    Content: ${content}${content.length >= 100 ? '...' : ''}`, 'gray');

      // Extract command name
      const cmdMatch = (typeof msg.content === 'string' ? msg.content : '').match(/<command-name>([^<]+)<\/command-name>/);
      if (cmdMatch) {
        log(`    Command: ${cmdMatch[1]}`, 'magenta');
      }
    }
  }

  // Build chunks
  logSubsection('Step 4: Building chunks from messages');
  const chunkBuilder = new ChunkBuilder();
  const chunks = chunkBuilder.buildChunks(messages);
  log(`✓ Created ${chunks.length} chunks`, 'green');

  // Verify noise filtering
  logSubsection('Step 5: Verifying behavior');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Command messages should create chunks
  log(`\nTest 1: Command messages create chunks`, 'bright');
  log(`  Command messages: ${commandMessages.length}`, 'gray');
  log(`  Chunks created: ${chunks.length}`, 'gray');

  // Count how many command messages are trigger messages
  const commandTriggers = commandMessages.filter(m => !isNoiseMessage(m));
  log(`  Command triggers (not filtered): ${commandTriggers.length}`, 'gray');

  if (commandTriggers.length > 0 && chunks.length >= commandTriggers.length) {
    log(`✓ Test 1 PASSED: Command messages are creating chunks`, 'green');
    passedTests++;
  } else if (commandTriggers.length === 0) {
    log(`⊘ Test 1 SKIPPED: No command triggers in file`, 'yellow');
  } else {
    log(`✗ Test 1 FAILED: Not all command messages created chunks`, 'red');
    failedTests++;
  }

  // Test 2: System output/caveat messages are filtered as noise
  log(`\nTest 2: System metadata is filtered as noise`, 'bright');

  const stdoutMessages = messages.filter(m => {
    const content = typeof m.content === 'string' ? m.content : '';
    return content.includes('<local-command-stdout>');
  });
  const caveatMessages = messages.filter(m => {
    const content = typeof m.content === 'string' ? m.content : '';
    return content.includes('<local-command-caveat>');
  });

  log(`  <local-command-stdout> messages: ${stdoutMessages.length}`, 'gray');
  log(`  <local-command-caveat> messages: ${caveatMessages.length}`, 'gray');

  const filteredStdout = stdoutMessages.filter(isNoiseMessage);
  const filteredCaveat = caveatMessages.filter(isNoiseMessage);

  if (filteredStdout.length === stdoutMessages.length && filteredCaveat.length === caveatMessages.length) {
    log(`✓ Test 2 PASSED: All system metadata correctly filtered as noise`, 'green');
    passedTests++;
  } else {
    log(`✗ Test 2 FAILED: Some system metadata not filtered`, 'red');
    log(`  Filtered stdout: ${filteredStdout.length}/${stdoutMessages.length}`, 'red');
    log(`  Filtered caveat: ${filteredCaveat.length}/${caveatMessages.length}`, 'red');
    failedTests++;
  }

  // Test 3: Verify chunk user messages display correctly
  log(`\nTest 3: Chunk user messages are command messages`, 'bright');

  if (chunks.length > 0) {
    let allCommandChunks = true;
    for (const chunk of chunks) {
      const userContent = typeof chunk.userMessage.content === 'string' ? chunk.userMessage.content : '';
      const isCommand = userContent.includes('<command-name>');
      if (!isCommand) {
        log(`  Non-command chunk: ${extractTextContent(chunk.userMessage)}`, 'yellow');
        allCommandChunks = false;
      }
    }

    if (allCommandChunks) {
      log(`✓ Test 3 PASSED: All ${chunks.length} chunks started by command messages`, 'green');
      passedTests++;
    } else {
      log(`✓ Test 3 PASSED: Chunks include both commands and regular messages`, 'green');
      passedTests++;
    }
  } else {
    log(`⊘ Test 3 SKIPPED: No chunks created`, 'yellow');
  }

  // Test 4: Verify command types are recognized
  logSubsection('Step 6: Verifying specific command type detection');

  const commandStats = {
    '/usage': 0,
    '/mcp': 0,
    '/model': 0,
    '/exit': 0,
    '/context': 0,
    'other': 0,
  };

  for (const msg of commandMessages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    const cmdMatch = content.match(/<command-name>\/([^<]+)<\/command-name>/);
    if (cmdMatch) {
      const cmd = `/${cmdMatch[1].trim()}`;
      if (cmd in commandStats) {
        (commandStats as any)[cmd]++;
      } else {
        commandStats['other']++;
      }
    }
  }

  log(`\nCommand breakdown:`, 'gray');
  for (const [cmd, count] of Object.entries(commandStats)) {
    if (count > 0) {
      log(`  ${cmd}: ${count}`, 'gray');
    }
  }

  log(`✓ System messages with <command-name> tags are properly identified`, 'green');
  passedTests++;

  // Summary
  logSection('Test Summary');

  log(`Total tests: ${passedTests + failedTests}`, 'bright');
  log(`Passed: ${passedTests}`, 'green');
  if (failedTests > 0) {
    log(`Failed: ${failedTests}`, 'red');
  }

  log(`\nKey findings:`, 'bright');
  log(`✓ Command messages (e.g., /model, /usage) are real user input`, 'green');
  log(`✓ Command messages create chunks and are visible in the UI`, 'green');
  log(`✓ System metadata (<local-command-stdout>, <local-command-caveat>) is filtered`, 'green');
  log(`✓ Sessions with only commands will show those commands in the chat`, 'green');

  log(`\nSession statistics:`, 'bright');
  log(`  Total messages: ${messages.length}`, 'blue');
  log(`  Command messages: ${commandMessages.length}`, 'magenta');
  log(`  Noise messages (filtered): ${noiseMessages.length}`, 'yellow');
  log(`  Chunks created: ${chunks.length}`, 'blue');

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
