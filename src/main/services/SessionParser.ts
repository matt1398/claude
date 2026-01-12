/**
 * SessionParser service - Parses Claude Code session JSONL files.
 *
 * Responsibilities:
 * - List all sessions for a project
 * - Parse JSONL files and build message trees
 * - Identify chunks (user message → response cycles)
 * - Extract Task tool_use blocks for subagent linking
 * - Calculate token usage per chunk
 */

import * as fs from 'fs';
import * as path from 'path';
import { Session, SessionDetail, Message, Chunk, TokenUsage, MessageContent } from '../../renderer/types/data';
import { parseJsonlFile, getFirstMessage, countMessages } from '../utils/jsonl';
import { ProjectScanner } from './ProjectScanner';

export class SessionParser {
  private projectScanner: ProjectScanner;

  constructor(projectScanner: ProjectScanner) {
    this.projectScanner = projectScanner;
  }

  /**
   * Lists all sessions for a given project.
   * @param projectId - The encoded project directory name
   * @returns Promise that resolves to an array of sessions, sorted by date (newest first)
   */
  async listSessions(projectId: string): Promise<Session[]> {
    try {
      const sessionFiles = await this.projectScanner.listSessionFiles(projectId);
      const sessions: Session[] = [];

      for (const filePath of sessionFiles) {
        const sessionId = path.basename(filePath, '.jsonl');
        const session = await this.parseSessionMetadata(projectId, sessionId, filePath);

        if (session) {
          sessions.push(session);
        }
      }

      // Sort by date (newest first)
      sessions.sort((a, b) => b.date.getTime() - a.date.getTime());

      return sessions;
    } catch (error) {
      console.error(`Error listing sessions for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Parses basic session metadata without loading all messages.
   * @param projectId - The encoded project directory name
   * @param sessionId - The session UUID
   * @param filePath - Path to the session JSONL file
   * @returns Promise that resolves to a Session object, or null if parsing fails
   */
  private async parseSessionMetadata(
    projectId: string,
    sessionId: string,
    filePath: string
  ): Promise<Session | null> {
    try {
      // Get first message for preview
      const firstMsg = await getFirstMessage(filePath);
      const messageCount = await countMessages(filePath);

      // Get file stats for date
      const stats = fs.statSync(filePath);

      // Check if session has subagents
      const hasSubagents = await this.projectScanner.hasSubagents(projectId, sessionId);

      // Extract first user message text for preview
      let firstMessage = '';
      if (firstMsg && firstMsg.type === 'user' && firstMsg.message) {
        firstMessage = this.extractMessageText(firstMsg);
      }

      return {
        id: sessionId,
        projectId,
        date: stats.birthtime || stats.mtime, // Use birthtime if available, fallback to mtime
        firstMessage: firstMessage.substring(0, 100), // Limit preview length
        hasSubagents,
        messageCount,
      };
    } catch (error) {
      console.error(`Error parsing session metadata for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Parses full session detail including all messages and chunks.
   * @param projectId - The encoded project directory name
   * @param sessionId - The session UUID
   * @returns Promise that resolves to SessionDetail
   */
  async parseSessionDetail(projectId: string, sessionId: string): Promise<SessionDetail> {
    try {
      const sessionPath = this.projectScanner.getSessionPath(projectId, sessionId);

      // Parse all messages
      const messages = await parseJsonlFile(sessionPath);

      // Build message tree and identify chunks
      const chunks = this.buildChunks(messages);

      // Get session metadata
      const sessions = await this.listSessions(projectId);
      const session = sessions.find(s => s.id === sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Calculate total duration and tokens
      const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.duration, 0);
      const totalTokens = this.sumTokenUsage(chunks.map(c => c.totalTokens));

      return {
        session,
        chunks,
        totalDuration,
        totalTokens,
      };
    } catch (error) {
      console.error(`Error parsing session detail for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Builds chunks from messages.
   * A chunk consists of one user message and all responses until the next user message.
   * @param messages - Array of all messages in the session
   * @returns Array of chunks
   */
  private buildChunks(messages: Message[]): Chunk[] {
    const chunks: Chunk[] = [];
    const messageMap = new Map<string, Message>();

    // Build message lookup map
    for (const msg of messages) {
      messageMap.set(msg.uuid, msg);
    }

    // Find all user messages (these start chunks)
    const userMessages = messages.filter(m => m.type === 'user');

    for (let i = 0; i < userMessages.length; i++) {
      const userMsg = userMessages[i];
      const nextUserMsg = i < userMessages.length - 1 ? userMessages[i + 1] : null;

      // Collect all responses until next user message
      const responses: Message[] = [];
      const startTime = new Date(userMsg.timestamp);
      let endTime = startTime;

      for (const msg of messages) {
        // Skip if message is before current user message
        if (new Date(msg.timestamp) < startTime) {
          continue;
        }

        // Skip if message is after next user message
        if (nextUserMsg && new Date(msg.timestamp) >= new Date(nextUserMsg.timestamp)) {
          continue;
        }

        // Skip the user message itself
        if (msg.uuid === userMsg.uuid) {
          continue;
        }

        // Add assistant responses
        if (msg.type === 'assistant') {
          responses.push(msg);
          const msgTime = new Date(msg.timestamp);
          if (msgTime > endTime) {
            endTime = msgTime;
          }
        }
      }

      // Calculate token usage for this chunk
      const totalTokens = this.calculateChunkTokens([userMsg, ...responses]);

      chunks.push({
        id: userMsg.uuid,
        userMessage: userMsg,
        responses,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        totalTokens,
        subagents: [], // Will be populated by SubagentResolver
      });
    }

    return chunks;
  }

  /**
   * Calculates total token usage for a chunk.
   * @param messages - Messages in the chunk
   * @returns TokenUsage object
   */
  private calculateChunkTokens(messages: Message[]): TokenUsage {
    let inputTokens = 0;
    let cacheReadTokens = 0;
    let outputTokens = 0;

    for (const msg of messages) {
      if (msg.message?.usage) {
        inputTokens += msg.message.usage.input_tokens || 0;
        cacheReadTokens += msg.message.usage.cache_read_input_tokens || 0;
        outputTokens += msg.message.usage.output_tokens || 0;
      }
    }

    return {
      input_tokens: inputTokens,
      cache_read_input_tokens: cacheReadTokens,
      output_tokens: outputTokens,
    };
  }

  /**
   * Sums multiple TokenUsage objects.
   * @param usages - Array of TokenUsage objects
   * @returns Combined TokenUsage
   */
  private sumTokenUsage(usages: TokenUsage[]): TokenUsage {
    return usages.reduce(
      (sum, usage) => ({
        input_tokens: sum.input_tokens + (usage.input_tokens || 0),
        cache_read_input_tokens:
          (sum.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
        output_tokens: sum.output_tokens + (usage.output_tokens || 0),
      }),
      { input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 }
    );
  }

  /**
   * Extracts text content from a message.
   * Handles both string and array content formats.
   * @param message - The message to extract text from
   * @returns Extracted text
   */
  private extractMessageText(message: Message): string {
    if (!message.message) {
      return '';
    }

    const content = message.message.content;

    // Handle string content
    if (typeof content === 'string') {
      return content;
    }

    // Handle array content
    if (Array.isArray(content)) {
      const textParts: string[] = [];

      for (const part of content as MessageContent[]) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text);
        }
      }

      return textParts.join('\n');
    }

    return '';
  }

  /**
   * Extracts Task tool_use blocks from a message.
   * These indicate subagent invocations.
   * @param message - The assistant message to extract Task calls from
   * @returns Array of Task tool_use blocks
   */
  extractTaskCalls(message: Message): Array<{ id: string; type?: string; description?: string }> {
    if (!message.message || message.type !== 'assistant') {
      return [];
    }

    const content = message.message.content;

    if (!Array.isArray(content)) {
      return [];
    }

    const taskCalls: Array<{ id: string; type?: string; description?: string }> = [];

    for (const part of content as MessageContent[]) {
      if (part.type === 'tool_use' && part.name === 'Task') {
        const input = part.input as any;
        taskCalls.push({
          id: part.id || '',
          type: input?.type,
          description: input?.instruction || input?.description,
        });
      }
    }

    return taskCalls;
  }
}
