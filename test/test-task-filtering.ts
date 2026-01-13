/**
 * Verification Test for Task Tool Call Filtering
 *
 * This script verifies that Task tool_use blocks are filtered out when
 * corresponding subagents exist, preventing duplicate entries in the Gantt chart.
 */

import * as path from 'path';
import * as os from 'os';
import { parseJsonlFile } from '../src/main/utils/jsonl';
import { ChunkBuilder } from '../src/main/services/ChunkBuilder';
import { SubagentResolver } from '../src/main/services/SubagentResolver';
import { ProjectScanner } from '../src/main/services/ProjectScanner';
import { ToolCall } from '../src/main/types/claude';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
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

async function runTest() {
  logSection('Task Tool Call Filtering Verification');

  // Use the session from the plan: ac48c596-8aff-45f5-97d2-94617d5c688b.jsonl
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  const projectId = '-Users-bskim-ClaudeContext';
  const sessionId = 'ac48c596-8aff-45f5-97d2-94617d5c688b';
  const sessionFile = path.join(projectsDir, projectId, `${sessionId}.jsonl`);

  log(`Session: ${sessionId}`, 'cyan');
  log(`File: ${sessionFile}`, 'gray');

  // Parse session
  const messages = await parseJsonlFile(sessionFile);
  log(`\nParsed ${messages.length} messages`, 'green');

  // Extract Task tool calls
  const taskCalls: ToolCall[] = [];
  for (const msg of messages) {
    taskCalls.push(...msg.toolCalls.filter((tc) => tc.isTask));
  }
  log(`Found ${taskCalls.length} Task tool calls`, 'yellow');

  // Resolve subagents
  const projectScanner = new ProjectScanner();
  const resolver = new SubagentResolver(projectScanner);
  const subagents = await resolver.resolveSubagents(projectId, sessionId, taskCalls);
  log(`Found ${subagents.length} subagents`, 'yellow');

  // Show Task -> Subagent linkage
  log('\n' + '-'.repeat(80), 'gray');
  log('Task -> Subagent Linkage:', 'cyan');
  log('-'.repeat(80), 'gray');

  for (const task of taskCalls) {
    const linkedSubagent = subagents.find((s) => s.parentTaskId === task.id);
    if (linkedSubagent) {
      log(`✓ Task ${task.id.substring(0, 20)}... → Subagent ${linkedSubagent.id}`, 'green');
      log(`  Description: ${task.taskDescription || 'N/A'}`, 'gray');
    } else {
      log(`✗ Task ${task.id.substring(0, 20)}... → No subagent (orphaned)`, 'yellow');
    }
  }

  // Build chunks with semantic steps
  const chunkBuilder = new ChunkBuilder();
  const chunks = chunkBuilder.buildChunks(messages, subagents);
  log(`\nBuilt ${chunks.length} chunks`, 'green');

  // Show which subagents are in each chunk
  log('\n' + '-'.repeat(80), 'gray');
  log('Subagents per Chunk:', 'cyan');
  log('-'.repeat(80), 'gray');
  for (const chunk of chunks) {
    log(`Chunk ${chunk.id}: ${chunk.subagents.length} subagents`, 'bright');
    for (const sub of chunk.subagents) {
      log(`  - ${sub.id}: ${sub.description}`, 'gray');
    }
  }

  // Analyze semantic steps
  log('\n' + '-'.repeat(80), 'gray');
  log('Semantic Steps Analysis:', 'cyan');
  log('-'.repeat(80), 'gray');

  let totalSteps = 0;
  let taskSteps = 0;
  let subagentSteps = 0;

  for (const chunk of chunks) {
    const steps = chunk.semanticSteps;
    totalSteps += steps.length;

    const taskToolSteps = steps.filter(
      (s) => s.type === 'tool_call' && s.content.toolName === 'Task'
    );
    const subagentStepsInChunk = steps.filter((s) => s.type === 'subagent');

    taskSteps += taskToolSteps.length;
    subagentSteps += subagentStepsInChunk.length;

    if (taskToolSteps.length > 0 || subagentStepsInChunk.length > 0) {
      log(`\nChunk ${chunk.id}:`, 'bright');
      log(`  Task tool_call steps: ${taskToolSteps.length}`, 'yellow');
      log(`  Subagent steps: ${subagentStepsInChunk.length}`, 'yellow');

      // Show which Task calls are orphaned
      for (const taskStep of taskToolSteps) {
        log(`    ✓ Orphaned Task preserved: ${taskStep.id.substring(0, 20)}...`, 'green');
      }

      // Show subagent steps
      for (const subagentStep of subagentStepsInChunk) {
        log(
          `    ✓ Subagent step: ${subagentStep.content.subagentDescription || subagentStep.id}`,
          'green'
        );
      }
    }
  }

  // Summary
  logSection('Test Summary');
  log(`Total semantic steps: ${totalSteps}`, 'bright');
  log(`Task tool_call steps (orphaned only): ${taskSteps}`, 'yellow');
  log(`Subagent steps: ${subagentSteps}`, 'yellow');
  log(`Total Task calls in messages: ${taskCalls.length}`, 'gray');
  log(`Total subagents resolved: ${subagents.length}`, 'gray');

  // Verification
  log('\n' + '-'.repeat(80), 'gray');

  // Calculate expected values based on what's actually in chunks
  const subagentsInChunks = chunks.flatMap((c) => c.subagents);
  const taskCallsInChunks = new Set<string>();

  for (const chunk of chunks) {
    for (const msg of [chunk.userMessage, ...chunk.responses]) {
      for (const tc of msg.toolCalls) {
        if (tc.isTask) {
          taskCallsInChunks.add(tc.id);
        }
      }
    }
  }

  const tasksInChunksWithSubagents = Array.from(taskCallsInChunks).filter((tcId) =>
    subagentsInChunks.some((s) => s.parentTaskId === tcId)
  );
  const orphanedTasksInChunks = Array.from(taskCallsInChunks).filter(
    (tcId) => !subagentsInChunks.some((s) => s.parentTaskId === tcId)
  );

  log(`Total Task calls in session: ${taskCalls.length}`, 'cyan');
  log(`Total subagents in session: ${subagents.length}`, 'cyan');
  log(`Task calls in chunks: ${taskCallsInChunks.size}`, 'cyan');
  log(`Subagents in chunks: ${subagentsInChunks.length}`, 'cyan');
  log(`Tasks in chunks with subagents (should be filtered): ${tasksInChunksWithSubagents.length}`, 'cyan');
  log(`Orphaned tasks in chunks (should appear as steps): ${orphanedTasksInChunks.length}`, 'cyan');

  if (taskSteps === orphanedTasksInChunks.length) {
    log('✓ PASS: Only orphaned Task calls in chunks appear in semantic steps', 'green');
  } else {
    log(
      `✗ FAIL: Expected ${orphanedTasksInChunks.length} Task steps, got ${taskSteps}`,
      'yellow'
    );
  }

  if (subagentSteps === subagentsInChunks.length) {
    log('✓ PASS: All subagents in chunks appear in semantic steps', 'green');
  } else {
    log(
      `✗ FAIL: Expected ${subagentsInChunks.length} subagent steps, got ${subagentSteps}`,
      'yellow'
    );
  }

  // Additional verification: check that Tasks with subagents are NOT in steps
  const tasksWithSubagentsInSteps = taskSteps > 0 ?
    chunks.flatMap(c =>
      c.semanticSteps.filter(s =>
        s.type === 'tool_call' &&
        s.content.toolName === 'Task' &&
        subagentsInChunks.some(sub => sub.parentTaskId === s.id)
      )
    ).length : 0;

  if (tasksWithSubagentsInSteps === 0) {
    log('✓ PASS: No Task calls with subagents appear in semantic steps (correctly filtered)', 'green');
  } else {
    log(
      `✗ FAIL: Found ${tasksWithSubagentsInSteps} Task calls with subagents in steps (should be 0)`,
      'yellow'
    );
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
