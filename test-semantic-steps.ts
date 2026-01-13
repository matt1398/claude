/**
 * Test script for semantic step extraction in EnhancedChunk
 *
 * This script:
 * 1. Reads a sample session JSONL file
 * 2. Parses it using SessionParser
 * 3. Builds EnhancedChunks with semantic steps using ChunkBuilder
 * 4. Analyzes and reports on the extracted semantic steps
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionParser } from './src/main/services/SessionParser';
import { ChunkBuilder } from './src/main/services/ChunkBuilder';
import { ProjectScanner } from './src/main/services/ProjectScanner';
import type { EnhancedChunk } from './src/main/types/claude';

// Color helpers for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function header(text: string): void {
  console.log('\n' + colorize('═'.repeat(80), 'dim'));
  console.log(colorize(text, 'bright'));
  console.log(colorize('═'.repeat(80), 'dim'));
}

function subheader(text: string): void {
  console.log('\n' + colorize(text, 'cyan'));
  console.log(colorize('─'.repeat(text.length), 'dim'));
}

// Test session files (ordered by size for testing)
const testSessions = [
  '378ae6de-abb0-428f-9d62-2df65011c487', // 15K - small
  '0036453d-c9a5-4d18-bde2-b88ed351bf47', // 227K - medium
  '3243efde-4ff6-414a-a7f0-c10bc107f135', // 184K - medium
];

interface ChunkStats {
  chunkIndex: number;
  userMessage: string;
  totalSteps: number;
  stepsByType: Record<string, number>;
  duration: number;
}

function analyzeChunks(chunks: EnhancedChunk[]): void {
  header('CHUNK ANALYSIS');

  console.log(colorize(`Total chunks: ${chunks.length}`, 'bright'));

  // Overall statistics
  let totalSteps = 0;
  const stepTypeCount: Record<string, number> = {};
  const stepTypeDuration: Record<string, number> = {};
  const chunkStats: ChunkStats[] = [];

  chunks.forEach((chunk, index) => {
    const steps = chunk.semanticSteps;
    totalSteps += steps.length;

    const chunkStepsByType: Record<string, number> = {};
    let chunkDuration = 0;

    steps.forEach(step => {
      stepTypeCount[step.type] = (stepTypeCount[step.type] || 0) + 1;
      chunkStepsByType[step.type] = (chunkStepsByType[step.type] || 0) + 1;

      if (step.durationMs !== undefined) {
        stepTypeDuration[step.type] = (stepTypeDuration[step.type] || 0) + step.durationMs;
        chunkDuration += step.durationMs;
      }
    });

    // Truncate user message for display
    let msgText = 'No user message';
    if (chunk.userMessage && chunk.userMessage.content) {
      const userMsg = chunk.userMessage.content;
      msgText = typeof userMsg === 'string'
        ? userMsg
        : JSON.stringify(userMsg).substring(0, 100);
    }

    chunkStats.push({
      chunkIndex: index + 1,
      userMessage: msgText.substring(0, 60),
      totalSteps: steps.length,
      stepsByType: chunkStepsByType,
      duration: chunkDuration,
    });
  });

  subheader('Overall Statistics');
  console.log(`Total semantic steps: ${colorize(totalSteps.toString(), 'green')}`);
  console.log(`Average steps per chunk: ${colorize((totalSteps / chunks.length).toFixed(2), 'green')}`);

  subheader('Step Type Distribution');
  const sortedTypes = Object.entries(stepTypeCount).sort((a, b) => b[1] - a[1]);
  sortedTypes.forEach(([type, count]) => {
    const avgDuration = stepTypeDuration[type] ? (stepTypeDuration[type] / count / 1000).toFixed(2) : 'N/A';
    console.log(
      `  ${colorize(type.padEnd(20), 'yellow')}: ` +
      `${colorize(count.toString().padStart(4), 'bright')} occurrences, ` +
      `avg ${colorize(avgDuration, 'blue')}s`
    );
  });

  subheader('Per-Chunk Breakdown');
  chunkStats.forEach(stat => {
    console.log(`\n${colorize(`Chunk ${stat.chunkIndex}`, 'magenta')}: "${stat.userMessage}..."`);
    console.log(`  Total steps: ${stat.totalSteps}, Duration: ${(stat.duration / 1000).toFixed(2)}s`);

    Object.entries(stat.stepsByType).forEach(([type, count]) => {
      console.log(`    • ${type}: ${count}`);
    });
  });
}

function inspectSampleSteps(chunks: EnhancedChunk[], limit: number = 3): void {
  header('SAMPLE SEMANTIC STEPS');

  // Find chunks with steps
  const chunksWithSteps = chunks.filter(c => c.semanticSteps.length > 0);

  chunksWithSteps.slice(0, limit).forEach((chunk) => {
    subheader(`Chunk ${chunks.indexOf(chunk) + 1} Steps (${chunk.semanticSteps.length} steps)`);

    chunk.semanticSteps.slice(0, 5).forEach((step, stepIdx) => {
      console.log(`\n${colorize(`Step ${stepIdx + 1}: ${step.type}`, 'yellow')}`);
      console.log(`  ID: ${step.id}`);
      console.log(`  Start: ${new Date(step.startTime).toLocaleTimeString()}`);
      if (step.endTime) {
        console.log(`  End: ${new Date(step.endTime).toLocaleTimeString()}`);
      }
      console.log(`  Duration: ${step.durationMs}ms`);
      console.log(`  Context: ${step.context}`);

      if (step.content) {
        const contentKeys = Object.keys(step.content);
        console.log(`  Content fields: ${contentKeys.join(', ')}`);

        // Show specific content based on type
        if (step.content.thinkingText) {
          console.log(`  Thinking: ${step.content.thinkingText.substring(0, 80)}...`);
        }
        if (step.content.toolName) {
          console.log(`  Tool: ${step.content.toolName}`);
        }
        if (step.content.outputText) {
          console.log(`  Output: ${step.content.outputText.substring(0, 80)}...`);
        }
      }

      if (step.tokens) {
        console.log(`  Tokens: ${step.tokens.input} in, ${step.tokens.output} out`);
      }
    });

    if (chunk.semanticSteps.length > 5) {
      console.log(colorize(`\n  ... and ${chunk.semanticSteps.length - 5} more steps`, 'dim'));
    }
  });

  if (chunksWithSteps.length === 0) {
    console.log(colorize('No chunks with semantic steps found', 'yellow'));
  }
}

async function testSession(sessionId: string): Promise<void> {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const projectDir = path.join(claudeDir, '-Users-bskim-ClaudeContext');
  const sessionPath = path.join(projectDir, `${sessionId}.jsonl`);

  header(`TESTING SESSION: ${sessionId}`);

  // Check if file exists
  if (!fs.existsSync(sessionPath)) {
    console.log(colorize(`❌ Session file not found: ${sessionPath}`, 'yellow'));
    return;
  }

  const fileSize = fs.statSync(sessionPath).size;
  console.log(`File: ${sessionPath}`);
  console.log(`Size: ${colorize((fileSize / 1024).toFixed(2) + ' KB', 'blue')}`);

  try {
    // Parse session
    subheader('Parsing Session');
    const projectScanner = new ProjectScanner();
    const parser = new SessionParser(projectScanner);
    const sessionDetail = await parser.parseSessionFile(sessionPath);

    if (!sessionDetail) {
      console.log(colorize('❌ Failed to parse session', 'yellow'));
      return;
    }

    console.log(colorize('✓ Session parsed successfully', 'green'));
    console.log(`Total messages: ${sessionDetail.messages.length}`);
    console.log(`Token usage: ${sessionDetail.metrics.inputTokens} in, ${sessionDetail.metrics.outputTokens} out`);

    // Count message types
    const msgTypes = sessionDetail.messages.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`Message types:`, msgTypes);

    // Build chunks with semantic steps
    subheader('Building Enhanced Chunks');
    const builder = new ChunkBuilder();
    const chunks = builder.buildChunks(sessionDetail.messages);

    console.log(colorize(`✓ Built ${chunks.length} enhanced chunks`, 'green'));

    // Verify semantic steps exist
    const totalSteps = chunks.reduce((sum, chunk) => sum + chunk.semanticSteps.length, 0);
    if (totalSteps === 0) {
      console.log(colorize('⚠️  No semantic steps extracted!', 'yellow'));
      return;
    }

    console.log(colorize(`✓ Extracted ${totalSteps} semantic steps`, 'green'));

    // Analyze chunks
    analyzeChunks(chunks);

    // Inspect sample steps
    inspectSampleSteps(chunks, 2);

    // Verify data structure matches UI expectations
    subheader('Data Structure Validation');

    const validationChecks = [
      {
        name: 'All chunks have semanticSteps array',
        pass: chunks.every(c => Array.isArray(c.semanticSteps)),
      },
      {
        name: 'All steps have required fields',
        pass: chunks.every(c => c.semanticSteps.every(s =>
          s.type && s.id && s.startTime
        )),
      },
      {
        name: 'Step timestamps are chronological within chunks',
        pass: chunks.every(c => {
          for (let i = 1; i < c.semanticSteps.length; i++) {
            if (c.semanticSteps[i].startTime < c.semanticSteps[i - 1].startTime) {
              return false;
            }
          }
          return true;
        }),
      },
      {
        name: 'All steps have valid types',
        pass: chunks.every(c => c.semanticSteps.every(s =>
          ['thinking', 'tool_call', 'tool_result', 'subagent', 'output', 'interruption'].includes(s.type)
        )),
      },
    ];

    validationChecks.forEach(check => {
      const status = check.pass
        ? colorize('✓', 'green')
        : colorize('✗', 'yellow');
      console.log(`${status} ${check.name}`);
    });

  } catch (error) {
    console.log(colorize(`❌ Error: ${error instanceof Error ? error.message : String(error)}`, 'yellow'));
    if (error instanceof Error && error.stack) {
      console.log(colorize(error.stack, 'dim'));
    }
  }
}

async function main(): Promise<void> {
  console.log(colorize('\n🧪 SEMANTIC STEP EXTRACTION TEST SUITE\n', 'bright'));

  for (const sessionId of testSessions) {
    await testSession(sessionId);
    console.log('\n');
  }

  header('TEST COMPLETE');
  console.log(colorize('All sessions tested. Review results above.', 'green'));
}

main().catch(error => {
  console.error(colorize('Fatal error:', 'yellow'), error);
  process.exit(1);
});
