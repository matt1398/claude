#!/usr/bin/env tsx
/**
 * Test script to verify hasNonNoiseMessages() logic
 *
 * This script replicates the logic from ProjectScanner.hasNonNoiseMessages()
 * to understand why non-working.jsonl is being filtered out.
 *
 * Run with: npm run tsx test-session-filter.ts
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// Type definitions (simplified from src/main/types/claude.ts)
interface ChatHistoryEntry {
  type: string;
  uuid?: string;
  message?: {
    role: string;
    content: any;
  };
  subtype?: string;
}

interface UserEntry extends ChatHistoryEntry {
  type: 'user';
  message: {
    role: 'user';
    content: string | any[];
  };
}

interface SystemEntry extends ChatHistoryEntry {
  type: 'system';
  subtype?: string;
}

// Additional interface for isMeta check
interface UserEntryWithMeta extends UserEntry {
  isMeta?: boolean;
}

// Replicate isRealUserMessage function
function isRealUserMessage(entry: ChatHistoryEntry): entry is UserEntry {
  if (entry.type !== 'user') return false;

  const userEntry = entry as UserEntryWithMeta;

  // Must NOT be meta (internal/system-generated)
  if (userEntry.isMeta === true) return false;

  // Must have string content (real user messages always have string content)
  const content = userEntry.message?.content;
  return typeof content === 'string';
}

// Replicate isNoiseMessage function from src/main/types/claude.ts
function isNoiseMessage(entry: ChatHistoryEntry): boolean {
  // Store type to avoid TypeScript narrowing issues
  const entryType = entry.type;

  // Filter queue-operation entries
  if (entryType === 'queue-operation') return true;

  // Filter file-history-snapshot entries
  if (entryType === 'file-history-snapshot') return true;

  // Filter system entries with local_command subtype
  if (entry.type === 'system') {
    const systemEntry = entry as SystemEntry;
    return systemEntry.subtype === 'local_command';
  }

  // Filter user messages with system metadata tags
  if (entry.type === 'user') {
    const userEntry = entry as UserEntry;
    const content = userEntry.message?.content;

    if (typeof content === 'string') {
      // These are system-generated, not user input
      const noiseTags = [
        '<local-command-stdout>',
        '<local-command-caveat>',
        '<system-reminder>'
      ];

      // Filter if contains noise tags
      if (noiseTags.some(tag => content.includes(tag))) {
        return true;
      }
    }
  }

  return false;
}

// Replicate isTriggerMessage function
function isTriggerMessage(entry: ChatHistoryEntry): boolean {
  // Must be a real user message first
  if (!isRealUserMessage(entry)) return false;

  // Must not be noise
  return !isNoiseMessage(entry);
}

// Replicate hasNonNoiseMessages function from ProjectScanner
async function hasNonNoiseMessages(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let messagesWithUuid = 0;
  let noiseMessages = 0;
  let nonNoiseMessages = 0;
  let triggerMessages = 0;
  let realUserMessages = 0;

  try {
    for await (const line of rl) {
      lineNumber++;
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as ChatHistoryEntry;

        // Skip entries without uuid (queue-operation, etc.)
        if (!entry.uuid) {
          console.log(`Line ${lineNumber}: type="${entry.type}", uuid=NONE (skipped - no uuid)`);
          continue;
        }

        messagesWithUuid++;
        const isNoise = isNoiseMessage(entry);
        const isRealUser = isRealUserMessage(entry);
        const isTrigger = isTriggerMessage(entry);

        if (isRealUser) realUserMessages++;
        if (isTrigger) triggerMessages++;

        let statusLine = `Line ${lineNumber}: type="${entry.type}", uuid="${entry.uuid.substring(0, 8)}..."`;

        if (entry.type === 'user') {
          const userEntry = entry as UserEntryWithMeta;
          const contentType = typeof userEntry.message?.content === 'string' ? 'string' : 'array';
          const isMeta = userEntry.isMeta === true;
          statusLine += `, isMeta=${isMeta}, content=${contentType}`;

          if (isRealUser) {
            statusLine += ` → REAL_USER ✓`;
          }
          if (isTrigger) {
            statusLine += ` → TRIGGER ✓✓`;
          }
        }

        if (isNoise) {
          noiseMessages++;
          console.log(statusLine + ` → NOISE`);
        } else {
          nonNoiseMessages++;
          console.log(statusLine + ` → NOT_NOISE ✓`);

          // Show content preview for non-noise messages
          if (entry.type === 'user' && entry.message?.content) {
            const content = entry.message.content;
            if (typeof content === 'string') {
              const preview = content.substring(0, 80).replace(/\n/g, ' ');
              console.log(`  Content: "${preview}..."`);
            } else if (Array.isArray(content)) {
              const types = content.map((c: any) => c.type).join(', ');
              console.log(`  Content: [array with ${content.length} items] types: ${types}`);
            }
          } else if (entry.type === 'assistant' && entry.message?.content) {
            const content = entry.message.content;
            if (Array.isArray(content)) {
              const types = content.map((c: any) => c.type).join(', ');
              console.log(`  Content types: ${types}`);
            }
          }
        }
      } catch (error) {
        console.error(`Line ${lineNumber}: Failed to parse - ${error}`);
        continue;
      }
    }
  } catch (error) {
    console.error(`Error reading file: ${error}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total lines processed: ${lineNumber}`);
  console.log(`Messages with UUID: ${messagesWithUuid}`);
  console.log(`Noise messages: ${noiseMessages}`);
  console.log(`Non-noise messages: ${nonNoiseMessages}`);
  console.log(`Real user messages (isMeta=false, string content): ${realUserMessages}`);
  console.log(`Trigger messages (real user + not noise): ${triggerMessages}`);
  console.log(`\nResult: hasNonNoiseMessages = ${nonNoiseMessages > 0}`);
  console.log(`Result: hasTriggerMessages = ${triggerMessages > 0}`);
  console.log('='.repeat(80));

  // All messages were noise
  return nonNoiseMessages > 0;
}

// Main execution
async function main() {
  const filePath = path.join(process.cwd(), 'non-working.jsonl');

  console.log('='.repeat(80));
  console.log('Testing hasNonNoiseMessages() Logic');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log('='.repeat(80));
  console.log();

  const result = await hasNonNoiseMessages(filePath);

  console.log();
  if (result) {
    console.log('✓ Session SHOULD BE VISIBLE (has non-noise messages)');
    console.log();
    console.log('HOWEVER, note the following:');
    console.log('- If this session has 0 TRIGGER messages (real user messages with string content),');
    console.log('  the ChunkBuilder will create 0 chunks and the session may appear empty.');
    console.log('- Trigger messages are what start conversation chunks.');
    console.log('- User messages with array content (tool results) are NOT trigger messages.');
    console.log();
    console.log('POTENTIAL ISSUE DETECTED:');
    console.log('- The JSONL format may have changed!');
    console.log('- In newer Claude Code versions, even real user messages have ARRAY content,');
    console.log('  not string content as expected by isRealUserMessage().');
    console.log('- This means NO chunks will be created, making the session appear empty.');
    console.log();
    console.log('SOLUTION:');
    console.log('- Update isRealUserMessage() to accept both string AND array content.');
    console.log('- Use other fields (isMeta, parentUuid) to distinguish real user messages.');
    console.log('- Real user messages typically have: isMeta=false/null, parentUuid=null.');
  } else {
    console.log('✗ Session WILL BE FILTERED OUT (only noise messages)');
  }
}

main().catch(console.error);
