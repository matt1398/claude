/**
 * Utilities for parsing JSONL (JSON Lines) files used by Claude Code sessions.
 *
 * JSONL format: One JSON object per line
 * - Each line is a complete, valid JSON object
 * - Lines are separated by newline characters
 * - Empty lines should be skipped
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { Message } from '../../renderer/types/data';

/**
 * Parse a JSONL file line by line using streaming.
 * This avoids loading the entire file into memory.
 *
 * @param filePath - Path to the JSONL file
 * @returns Promise that resolves to an array of parsed messages
 */
export async function parseJsonlFile(filePath: string): Promise<Message[]> {
  const messages: Message[] = [];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return messages;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Treat \r\n as a single line break
  });

  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as Message;
      messages.push(parsed);
    } catch (error) {
      // Log parsing errors but continue processing
      console.error(`Error parsing line in ${filePath}:`, error);
      console.error(`Line content: ${line.substring(0, 100)}...`);
    }
  }

  return messages;
}

/**
 * Parse a JSONL file and call a callback for each parsed line.
 * Useful for processing large files without accumulating all messages in memory.
 *
 * @param filePath - Path to the JSONL file
 * @param callback - Function to call for each parsed message
 */
export async function streamJsonlFile(
  filePath: string,
  callback: (message: Message) => void | Promise<void>
): Promise<void> {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as Message;
      await callback(parsed);
    } catch (error) {
      console.error(`Error parsing line in ${filePath}:`, error);
    }
  }
}

/**
 * Get the first message from a JSONL file without reading the entire file.
 * Useful for getting session previews.
 *
 * @param filePath - Path to the JSONL file
 * @returns Promise that resolves to the first message, or null if file is empty
 */
export async function getFirstMessage(filePath: string): Promise<Message | null> {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as Message;
      fileStream.close(); // Close stream early since we only need first line
      return parsed;
    } catch (error) {
      console.error(`Error parsing first line in ${filePath}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * Count the number of messages in a JSONL file without parsing all content.
 * Simply counts non-empty lines.
 *
 * @param filePath - Path to the JSONL file
 * @returns Promise that resolves to the message count
 */
export async function countMessages(filePath: string): Promise<number> {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  let count = 0;
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      count++;
    }
  }

  return count;
}
