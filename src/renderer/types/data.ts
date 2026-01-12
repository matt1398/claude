// Type definitions for the application

// Electron API exposed via preload script
export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  getSessions: (projectId: string) => Promise<Session[]>
  getSessionDetail: (projectId: string, sessionId: string) => Promise<SessionDetail | null>
}

// Project information
export interface Project {
  id: string              // Encoded directory name
  name: string            // Decoded path
  path: string            // Full path
  lastAccessed: Date
  sessionCount: number
}

// Session summary
export interface Session {
  id: string              // UUID
  projectId: string
  date: Date
  firstMessage: string
  hasSubagents: boolean
  messageCount: number    // Total number of messages in session
}

// Token usage statistics
export interface TokenUsage {
  input_tokens: number
  cache_read_input_tokens?: number
  output_tokens: number
}

// Message content types
export type MessageContent = TextContent | ToolUseContent | ToolResultContent

export interface TextContent {
  type: 'text'
  text?: string
}

export interface ToolUseContent {
  type: 'tool_use'
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export interface ToolResultContent {
  type: 'tool_result'
  tool_use_id?: string
  content?: string | unknown[]
  is_error?: boolean
}

// Message structure
export interface Message {
  uuid: string
  parentUuid: string | null
  type: 'user' | 'assistant' | 'system' | 'file-history-snapshot' | 'summary'
  timestamp: string
  sessionId?: string
  agentId?: string
  isSidechain?: boolean
  message?: {
    role: string
    content: MessageContent[] | string
    usage?: TokenUsage
  }
}

// Resolved subagent data
export interface ResolvedSubagent {
  agentId: string
  messages: Message[]
  startTime: string
  endTime: string
  duration: number
  tokenUsage: TokenUsage
  description?: string
  type?: string           // Subagent type (e.g., "explore", "plan")
  isParallel?: boolean    // Whether executed in parallel with others
}

// Chunk - a user message and its responses
export interface Chunk {
  id: string
  userMessage: Message
  responses: Message[]
  startTime: Date
  endTime: Date
  duration: number
  totalTokens: TokenUsage
  subagents: ResolvedSubagent[]
}

// Full session detail
export interface SessionDetail {
  session: Session
  chunks: Chunk[]
  totalDuration: number
  totalTokens: TokenUsage
}

// Waterfall chart item
export interface WaterfallItem {
  id: string
  label: string
  startTime: Date
  endTime: Date
  duration: number
  tokenUsage: TokenUsage
  level: number           // Hierarchy depth
  type: 'main' | 'subagent'
  isParallel?: boolean
  parentId?: string       // Parent item ID for hierarchy
  groupId?: string        // Group ID for parallel operations
}

// Waterfall chart data structure
export interface WaterfallData {
  items: WaterfallItem[]
  minTime: Date
  maxTime: Date
  totalDuration: number
}

// Subagent group for parallel detection
export interface SubagentGroup {
  agents: ResolvedSubagent[]
  isParallel: boolean
  groupId: string
}

// Extend Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
