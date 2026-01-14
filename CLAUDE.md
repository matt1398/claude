# CLAUDE.md - AI Assistant Guide

## Project Overview

**Claude Code Execution Visualizer** (`claude-viz`) is an Electron desktop application that visualizes Claude Code session execution. It parses JSONL session files from `~/.claude/projects/` and displays execution flow, parallel operations, and resource usage through an interactive waterfall chart.

## Technology Stack

- **Electron** 28.x - Desktop app framework
- **electron-vite** - Build system optimized for Electron
- **React** 18.x + **TypeScript** 5.x - UI framework
- **Tailwind CSS** 3.x - Styling (dark theme)
- **D3.js** 7.x - Waterfall chart visualization
- **Zustand** 4.x - State management
- **@tanstack/react-virtual** - Virtual scrolling
- **lru-cache** - Session caching
- **date-fns** - Date formatting

## Project Structure

```
claude-viz/
├── src/
│   ├── main/                     # Main process (Node.js)
│   │   ├── index.ts              # Entry point, app lifecycle
│   │   ├── ipc/
│   │   │   └── handlers.ts       # IPC API endpoints
│   │   ├── services/
│   │   │   ├── ProjectScanner.ts # Scans ~/.claude/projects/
│   │   │   ├── SessionParser.ts  # Parses JSONL files
│   │   │   ├── ChunkBuilder.ts   # Groups messages into chunks
│   │   │   ├── SubagentResolver.ts # Links Tasks to subagents
│   │   │   ├── DataCache.ts      # LRU cache with TTL
│   │   │   └── FileWatcher.ts    # Watches for file changes
│   │   ├── types/
│   │   │   └── claude.ts         # Complete type definitions (JSONL format & app types)
│   │   └── utils/
│   │       ├── jsonl.ts          # JSONL parsing & metrics
│   │       └── pathDecoder.ts    # Path encoding/decoding
│   │
│   ├── preload/
│   │   └── index.ts              # Secure IPC bridge
│   │
│   └── renderer/                 # React application
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Root layout component
│       ├── index.css             # Global styles with Tailwind
│       ├── types/
│       │   └── data.ts           # Renderer type definitions
│       ├── store/
│       │   └── index.ts          # Zustand store
│       ├── components/
│       │   ├── projects/
│       │   │   └── ProjectsList.tsx
│       │   ├── sessions/
│       │   │   └── SessionsList.tsx
│       │   └── detail/
│       │       ├── SessionDetail.tsx
│       │       ├── ChunkView.tsx
│       │       └── WaterfallChart.tsx
│       └── utils/
│           ├── chartHelpers.ts
│           └── parallelDetection.ts
│
├── docs/                         # Documentation
│
├── test-chunk-building.ts        # Test suite for chunk logic
└── Configuration files
```

## Development Commands

```bash
# Install dependencies
npm install
# or with pnpm (recommended - see packageManager in package.json)
pnpm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Run chunk building tests
npm run test:chunks
```

## Architecture Patterns

### Three-Process Model

1. **Main Process** (`src/main/`) - Node.js runtime
   - Handles file system operations
   - Manages IPC communication
   - Controls app lifecycle

2. **Preload Script** (`src/preload/`) - Secure bridge
   - Exposes limited API to renderer via `contextBridge`
   - Type-safe IPC invocation

3. **Renderer Process** (`src/renderer/`) - React/Chromium
   - UI components and state management
   - D3.js visualization

### IPC Communication

Exposed API via `window.electronAPI`:
```typescript
getProjects(): Promise<Project[]>
getSessions(projectId: string): Promise<Session[]>
getSessionDetail(projectId: string, sessionId: string): Promise<SessionDetail | null>
getSessionMetrics(projectId: string, sessionId: string): Promise<SessionMetrics | null>
getWaterfallData(projectId: string, sessionId: string): Promise<WaterfallData | null>
```

### State Management (Zustand)

```typescript
// Key state slices
projects: Project[]
selectedProjectId: string | null
sessions: Session[]
selectedSessionId: string | null
sessionDetail: SessionDetail | null

// Each slice has loading and error states
projectsLoading, projectsError
sessionsLoading, sessionsError
sessionDetailLoading, sessionDetailError
```

## Critical Concepts

### Message Type Distinction (isMeta Flag)

The most important concept - distinguishes real user input from system messages:

```typescript
// REAL USER MESSAGE - creates new chunks
{
  type: "user",
  isMeta: false,        // ← User actually typed this
  message: {
    role: "user",
    content: "Help me debug this"  // string content
  }
}

// INTERNAL USER MESSAGE - tool results, part of response flow
{
  type: "user",
  isMeta: true,         // ← System-generated
  message: {
    role: "user",
    content: [{ type: "tool_result", ... }]  // array content
  },
  sourceToolUseID: "toolu_xyz"  // Links to tool call
}
```

### Chunk Structure

Chunks group a user request with all its responses:

```typescript
Chunk = {
  userMessage: ParsedMessage  // Real user message (isMeta: false)
  responses: [
    // Assistant messages
    // Internal user messages (tool results)
  ]
  toolExecutions: ToolExecution[]  // Linked call/result pairs
  subagents: Subagent[]  // Nested agent executions
}
```

### Type Guards

Use these to classify messages:
```typescript
isRealUserMessage(msg)      // isMeta: false, string content
isInternalUserMessage(msg)  // isMeta: true, array content
isAssistantMessage(msg)     // type: "assistant"
```

### Task/Subagent Relationship

Task tool calls spawn async subagents that execute in separate sessions. To avoid duplicate entries in the Gantt chart, we filter out Task tool_use blocks when extracting semantic steps:

```typescript
// Task tool call in main session
{
  type: "tool_use",
  name: "Task",
  id: "toolu_abc123",
  input: {
    prompt: "Implement feature X",
    subagentType: "Explore"
  }
}

// Spawns subagent file: agent-abc123.jsonl
// Subagent metadata
{
  id: "abc123",
  parentTaskId: "toolu_abc123",  // Links back to Task call
  description: "Implement feature X",
  subagentType: "Explore"
}
```

**Filtering Logic:**
1. When extracting semantic steps, build a set of Task IDs that have corresponding subagents: `taskIdsWithSubagents`
2. Filter out tool_use blocks where `name === 'Task'` AND the tool ID exists in `taskIdsWithSubagents`
3. Keep orphaned Task calls (without matching subagents) as fallback to ensure visibility
4. Add subagents as separate semantic steps with their full execution context

This ensures the Gantt chart shows only the subagent execution, not duplicate Task + Subagent entries for the same work.

## Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Services | PascalCase | `ProjectScanner.ts` |
| Components | PascalCase | `ChunkView.tsx` |
| Utilities | camelCase | `pathDecoder.ts` |
| Constants | UPPER_SNAKE_CASE | `PARALLEL_WINDOW_MS` |
| Type Guards | isXxx | `isRealUserMessage()` |
| Builders | buildXxx | `buildChunks()` |
| Getters | getXxx | `getResponses()` |

## File Locations

### Data Sources
```
~/.claude/projects/
├── {encoded-project-name}/
│   ├── {sessionId}.jsonl          # Main session file
│   └── subagents/
│       └── agent-{agentId}.jsonl  # Subagent sessions

~/.claude/todos/
└── {sessionId}.json               # Todo data per session
```

### Path Encoding
Project paths are encoded: `/Users/name/project` → `-Users-name-project`

## Key Services

### ProjectScanner
- Scans `~/.claude/projects/` directory
- Returns projects sorted by most recent activity
- Extracts metadata from JSONL files

### SessionParser
- Parses JSONL session files
- Extracts messages, metrics, tool calls
- Calculates token usage and duration

### ChunkBuilder
- Groups messages into user request/response chunks
- Builds tool execution linkage
- Generates waterfall data

### SubagentResolver
- Parses subagent JSONL files
- Detects parallel execution (100ms window)
- Links subagents to Task calls (4-tier matching)

### DataCache
- LRU cache for parsed SessionDetail objects
- Default: 50 entries, 10 min TTL
- Auto-cleanup every 5 minutes

## Testing

### Chunk Building Test
```bash
npm run test:chunks
```

Verifies:
1. Chunk count matches real user message count
2. All chunks start with real user messages
3. Internal messages are in responses, not chunk starters
4. Tool calls/results are properly linked

Run after modifying:
- `ChunkBuilder.ts`
- `SessionParser.ts`
- Message type guards in `claude.ts`

## Common Development Tasks

### Adding a New IPC Handler
1. Add handler in `src/main/ipc/handlers.ts`
2. Add type in `src/preload/index.ts`
3. Implement in appropriate service

### Modifying Chunk Logic
1. Update `src/main/services/ChunkBuilder.ts`
2. Run `npm run test:chunks` to verify
3. Check waterfall visualization

### Adding UI Components
1. Create in `src/renderer/components/`
2. Use Tailwind with `claude-dark` theme colors
3. Connect to Zustand store if needed

## Theme Colors

Tailwind configured with Claude dark theme:
```css
claude-dark-bg: #1a1a1a
claude-dark-surface: #2d2d2d
claude-dark-border: #404040
claude-dark-text: #e5e5e5
claude-dark-text-secondary: #a3a3a3
```

## Error Handling

- Main process: try/catch with console.error, return safe defaults
- Renderer: error state in Zustand store, displayed to user
- IPC: parameter validation, graceful degradation

## Performance Considerations

- **LRU Cache**: Avoid re-parsing large JSONL files
- **Streaming JSONL**: Line-by-line processing
- **Virtual Scrolling**: For large session/message lists
- **Debounced File Watching**: 100ms debounce
- **Auto Cache Cleanup**: Expires old entries

## Documentation

- `README.md` - Project overview and setup
- `TEST-README.md` - Detailed test documentation
- `CHUNK-TEST-SUMMARY.md` - Quick test reference
- `src/main/types/claude.ts` - Complete type definitions (JSONL format & application types)

## Troubleshooting

### Build Issues
```bash
# Clear build artifacts
rm -rf dist dist-electron node_modules
npm install
npm run build
```

### Type Errors
```bash
npm run typecheck
```

### Test Failures
Check for changes in message parsing or chunk building logic. See test output for specific failures.

## Active Technologies
- TypeScript 5.5, React 18.3, Node.js (Electron 28.x main process) + Zustand 4.5 (state), React 18.3 (UI), Tailwind CSS 3.4 (styling), Lucide React (icons), date-fns 3.6 (date grouping) (001-tabbed-layout-dashboard)
- N/A (state is in-memory via Zustand; session data comes from existing IPC handlers) (001-tabbed-layout-dashboard)

## Recent Changes
- 001-tabbed-layout-dashboard: Added TypeScript 5.5, React 18.3, Node.js (Electron 28.x main process) + Zustand 4.5 (state), React 18.3 (UI), Tailwind CSS 3.4 (styling), Lucide React (icons), date-fns 3.6 (date grouping)
