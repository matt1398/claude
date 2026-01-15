# Chat Group Structure Skill

This skill provides knowledge about how chat messages are grouped and displayed to users in the Claude Code Visualizer.

## Visual Structure (What Users See)

```
┌─────────────────────────────────────────────────────────┐
│  ChatHistory (flat list of independent items)           │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              [You · 10:23:45 AM]                   │ │ ← UserChatGroup
│  │                    ┌─────────────────────────────┐ │ │   (RIGHT side, blue bubble)
│  │                    │ Help me debug this function │ │ │
│  │                    └─────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ⚙ System · /model                                  │ │ ← SystemChatGroup (NEW!)
│  │ ──────────────────────────────────────────────────│ │   (LEFT side, gray styling)
│  │  Set model to claude-sonnet-4-20250514             │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Claude · Opus 4.5 · 3 tool calls, 1 message    ▼  │ │ ← AIChatGroup header
│  │ ──────────────────────────────────────────────────│ │   (LEFT side, collapsible)
│  │  [Expandable: thinking, tools, subagents...]      │ │
│  │ ──────────────────────────────────────────────────│ │
│  │  ✓ Last Output (always visible)                   │ │ ← LastOutputDisplay
│  │  "The bug is in line 42 where..."                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Key Architecture Change: Flat ChatItem List

**OLD Architecture (REMOVED):**
```typescript
// ConversationTurn paired UserGroup + AIGroup
interface ConversationTurn {
  userGroup: UserGroup;
  aiGroup: AIGroup;
}
SessionConversation { turns: ConversationTurn[] }
```

**NEW Architecture (CURRENT):**
```typescript
// Flat list of independent items
type ChatItem =
  | { type: 'user'; group: UserGroup }
  | { type: 'system'; group: SystemGroup }
  | { type: 'ai'; group: AIGroup };

interface SessionConversation {
  sessionId: string;
  items: ChatItem[];
  totalUserGroups: number;
  totalSystemGroups: number;
  totalAIGroups: number;
}
```

**Key difference:** Each item is independent - no pairing between user and AI chunks.

## 4-Category Message Classification

Messages are classified into exactly 4 categories:

### 1. USER Messages (create UserChunks)
- **Detection:** `isParsedUserChunkMessage(msg)`
- **Criteria:**
  - `type='user'`
  - `isMeta!=true`
  - Has text/image content
  - Content does NOT contain: `<local-command-stdout>`, `<local-command-caveat>`, `<system-reminder>`
  - Content MAY contain: `<command-name>` (slash commands ARE user input)
- **Rendering:** RIGHT side, blue styling
- **Examples:**
  ```
  "Help me debug this code"
  "<command-name>/model</command-name> Switch to sonnet"
  ```

### 2. SYSTEM Messages (create SystemChunks)
- **Detection:** `isParsedSystemChunkMessage(msg)`
- **Criteria:**
  - `type='user'` (confusingly, command output comes as user entries in JSONL)
  - Contains `<local-command-stdout>` tag
- **Rendering:** LEFT side, gray styling
- **Examples:**
  ```json
  {
    "type": "user",
    "content": "<local-command-stdout>Set model to sonnet...</local-command-stdout>"
  }
  ```

### 3. HARD NOISE Messages (filtered out)
- **Detection:** `isParsedHardNoiseMessage(msg)`
- **Criteria:**
  - Entry types: `system`, `summary`, `file-history-snapshot`, `queue-operation`
  - User messages with ONLY `<local-command-caveat>` or `<system-reminder>` tags
  - Synthetic assistant messages with `model='<synthetic>'`
- **Rendering:** NEVER rendered - completely invisible
- **Examples:**
  ```json
  {"type": "summary", "summary": "..."}
  {"type": "user", "content": "<local-command-caveat>...</local-command-caveat>"}
  {"type": "assistant", "message": {"model": "<synthetic>", ...}}
  ```

### 4. AI Messages (create AIChunks)
- **Detection:** Everything else that's not User/System/HardNoise
- **Includes:** Assistant messages, tool results, interruptions, internal messages
- **Grouping:** Consecutive AI messages are buffered and grouped into single AIChunk
- **Rendering:** LEFT side, existing dark styling
- **Independence:** AIChunks are INDEPENDENT - no longer paired with UserChunks

## Key Types

### Location: `src/renderer/types/groups.ts`

| Type | Purpose |
|------|---------|
| **UserGroup** | User's input message with parsed content (commands, images, @references) |
| **SystemGroup** | Command output from slash commands (NEW!) |
| **AIGroup** | AI response: steps (thinking, tools, output), tokens, subagents, status |
| **ChatItem** | Discriminated union: user \| system \| ai |
| **SessionConversation** | Flat list of ChatItem objects |

### UserGroup Structure
```typescript
interface UserGroup {
  id: string;
  message: ParsedMessage;
  timestamp: Date;
  content: UserGroupContent;  // text, commands, images, fileRefs
  index: number;
}
```

### SystemGroup Structure (NEW!)
```typescript
interface SystemGroup {
  id: string;
  message: ParsedMessage;
  timestamp: Date;
  commandOutput: string;  // Extracted from <local-command-stdout>
  commandName?: string;   // Optional: extracted command name
}
```

### AIGroup Structure
```typescript
interface AIGroup {
  id: string;
  // NOTE: No userChunkId - AIGroups are independent!
  startTime: Date;
  endTime: Date;
  durationMs: number;
  steps: SemanticStep[];
  tokens: AIGroupTokens;
  summary: AIGroupSummary;
  status: AIGroupStatus;
  processes: Process[];
  chunkId: string;
  metrics: SessionMetrics;
}
```

### EnhancedAIGroup (Display-Ready with Model Info)
```typescript
interface EnhancedAIGroup extends AIGroup {
  lastOutput: AIGroupLastOutput | null;
  displayItems: AIGroupDisplayItem[];
  linkedTools: Map<string, LinkedToolItem>;
  itemsSummary: string;
  // Model information (NEW!)
  mainModel: ModelInfo | null;      // Model used by main agent
  subagentModels: ModelInfo[];      // Unique models used by subagents
}
```

## Data Transformation Pipeline

```
JSONL File
    ↓
SessionParser (src/main/services/SessionParser.ts)
    ↓
ParsedMessage[] + Process[]
    ↓
ChunkBuilder.buildChunks() (src/main/services/ChunkBuilder.ts)
    ↓
EnhancedChunk[] (independent: EnhancedUserChunk, EnhancedSystemChunk, EnhancedAIChunk)
    ↓
groupTransformer.transformChunksToConversation() (src/renderer/utils/groupTransformer.ts)
    ↓
SessionConversation { items: ChatItem[] }
    ↓
Zustand Store (src/renderer/store/index.ts)
    ↓
ChatHistory → UserChatGroup / SystemChatGroup / AIChatGroup
```

### Chunk Types

```typescript
// User Chunk - single user input (RIGHT side)
interface UserChunk {
  chunkType: 'user';
  id: string;
  userMessage: ParsedMessage;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  metrics: SessionMetrics;
}

// System Chunk - command output (LEFT side)
interface SystemChunk {
  chunkType: 'system';
  id: string;
  message: ParsedMessage;
  commandOutput: string;  // Extracted from <local-command-stdout>
  startTime: Date;
  endTime: Date;
  durationMs: number;
  metrics: SessionMetrics;
}

// AI Chunk - assistant responses (LEFT side)
// NOTE: No userChunkId - independent!
interface AIChunk {
  chunkType: 'ai';
  id: string;
  responses: ParsedMessage[];
  processes: Process[];
  sidechainMessages: ParsedMessage[];
  toolExecutions: ToolExecution[];
  startTime: Date;
  endTime: Date;
  durationMs: number;
  metrics: SessionMetrics;
}

// EnhancedChunk = EnhancedUserChunk | EnhancedSystemChunk | EnhancedAIChunk
```

## Key Type Guards

### Current Type Guards (4-Category System)

| Guard | Purpose | Detects |
|-------|---------|---------|
| `isParsedUserChunkMessage(msg)` | User chunks | Real user input starting User chunks |
| `isParsedSystemChunkMessage(msg)` | System chunks | Command output with `<local-command-stdout>` |
| `isParsedHardNoiseMessage(msg)` | Filtered noise | System metadata to exclude |
| `isParsedAssistantMessage(msg)` | AI messages | Assistant responses |
| `isParsedInternalUserMessage(msg)` | AI flow | Tool results (isMeta: true) |

### Removed Type Guards (OLD)

These are NO LONGER used in the 4-category system:
- ~~`isParsedTriggerMessage`~~ - replaced by `isParsedUserChunkMessage`
- ~~`isParsedNoiseMessage`~~ - replaced by `isParsedHardNoiseMessage`
- ~~`isParsedSoftNoiseMessage`~~ - removed (all noise is now "hard")

### Chunk Type Guards

| Guard | Purpose |
|-------|---------|
| `isUserChunk(chunk)` | UserChunk with `chunkType: 'user'` |
| `isAIChunk(chunk)` | AIChunk with `chunkType: 'ai'` |
| `isSystemChunk(chunk)` | SystemChunk with `chunkType: 'system'` |
| `isEnhancedUserChunk(chunk)` | EnhancedUserChunk (has rawMessages) |
| `isEnhancedAIChunk(chunk)` | EnhancedAIChunk (has semanticSteps) |
| `isEnhancedSystemChunk(chunk)` | EnhancedSystemChunk (has rawMessages) |

## Key Files

| File | Role |
|------|------|
| `src/renderer/types/groups.ts` | Type definitions for display groups |
| `src/renderer/types/data.ts` | Renderer type definitions + type guards |
| `src/main/types/claude.ts` | Complete type definitions (JSONL + app types) |
| `src/renderer/utils/groupTransformer.ts` | Transforms chunks → conversation |
| `src/renderer/utils/aiGroupEnhancer.ts` | Enhances AIGroup with display-ready data |
| `src/renderer/components/chat/ChatHistory.tsx` | Entry point, maps items to UI |
| `src/renderer/components/chat/UserChatGroup.tsx` | Right-aligned user bubble |
| `src/renderer/components/chat/SystemChatGroup.tsx` | Left-aligned system output (NEW!) |
| `src/renderer/components/chat/AIChatGroup.tsx` | Collapsible AI response card |
| `src/renderer/components/chat/DisplayItemList.tsx` | Renders expanded items |
| `src/renderer/components/chat/LastOutputDisplay.tsx` | Always-visible last output |
| `src/main/services/ChunkBuilder.ts` | Groups messages into chunks |
| `src/main/services/SubagentResolver.ts` | Links Task calls to subagents |
| `src/shared/utils/modelParser.ts` | Parses model strings into ModelInfo |

## Grouping Logic

### Core Rules (NEW 4-Category System)
1. **User messages START UserChunks** - Render on RIGHT side
2. **System messages START SystemChunks** - Render on LEFT side
3. **AI messages are GROUPED into independent AIChunks** - Render on LEFT side
4. **Hard noise messages are FILTERED OUT** - Never rendered
5. **AIChunks are INDEPENDENT** - No longer paired with UserChunks

### Message Classification Flow

```typescript
// Classification priority (checked in order):
if (isParsedHardNoiseMessage(msg)) → FILTER OUT (invisible)
if (isParsedUserChunkMessage(msg)) → USER CHUNK (right side)
if (isParsedSystemChunkMessage(msg)) → SYSTEM CHUNK (left side)
// Everything else → buffer into AI CHUNK (left side)
```

### Example Classification

```
Input: "Help me debug this code"
→ USER CHUNK (right)

Input: "<command-name>/model</command-name>"
→ USER CHUNK (right) - slash commands ARE user input

Output: "<local-command-stdout>Set model to sonnet...</local-command-stdout>"
→ SYSTEM CHUNK (left)

Entry: {"type": "summary", "summary": "..."}
→ HARD NOISE (filtered)

Entry: "<local-command-caveat>Long messages may be truncated</local-command-caveat>"
→ HARD NOISE (filtered)

Entry: {"type": "assistant", "message": {"model": "<synthetic>", ...}}
→ HARD NOISE (filtered)

Assistant responses, tool results, interruptions
→ AI CHUNK (left, grouped with consecutive messages)
```

## Display Items (Expanded View)

| Type | Component | Content |
|------|-----------|---------|
| `thinking` | ThinkingItem | Extended thinking text |
| `output` | TextItem | Intermediate text output |
| `tool` | LinkedToolItem | Tool call paired with result |
| `subagent` | SubagentItem | Nested agent execution (with model info) |

### LinkedToolItem Structure
```typescript
interface LinkedToolItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: { content, isError, toolUseResult };
  inputPreview: string;
  outputPreview?: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  isOrphaned: boolean;
  sourceModel?: string;  // Model used for the tool call
}
```

## Model Information Display

### Model Info Structure
```typescript
interface ModelInfo {
  displayName: string;    // "Opus 4.5", "Sonnet 4"
  fullId: string;         // "claude-opus-4-5-20250514"
  isOpus: boolean;
  isSonnet: boolean;
  isHaiku: boolean;
}
```

### Where Model is Displayed
- **AIChatGroup Header:** Shows main model + "(+ N subagent models)" if different
- **SubagentItem Header:** Shows subagent's model
- **SubagentItem Metrics:** Shows model info alongside tokens/duration

## Task/Subagent Deduplication

Task tool calls spawn subagents in separate JSONL files. To avoid duplicate entries:

1. Build set of Task IDs that have corresponding subagents: `taskIdsWithSubagents`
2. Filter out `tool_use` blocks where `name === 'Task'` AND ID is in `taskIdsWithSubagents`
3. Keep orphaned Task calls (without matching subagents) as fallback
4. Show subagent execution as a separate display item

## AI Group Enhancement Flow

`enhanceAIGroup()` in `src/renderer/utils/aiGroupEnhancer.ts`:

1. **findLastOutput()** - Search steps in reverse for last 'output' or 'tool_result'
2. **linkToolCallsToResults()** - Map tool calls to results using step IDs
3. **buildDisplayItems()** - Flatten steps into chronological list
   - Skip last output step (shown separately)
   - Skip orphaned result steps (already in LinkedToolItem)
   - Filter Task calls with subagents
4. **extractModelInfo()** - Extract main model and subagent models
5. **buildSummary()** - Generate "X thinking, Y tool calls, Z messages"

## Content Parsing

### User Commands
- Pattern: `/([a-z-]+)(?:\s+(.+?))?`
- Example: `/model sonnet` → command: "model", args: "sonnet"

### File References
- Pattern: `@(path/to/file)`
- Highlighted inline in user messages

### Command Message Sanitization
- Raw: `<command-name>/model</command-name><command-args>sonnet</command-args>`
- Cleaned: `/model sonnet`

## State Management

```typescript
// Zustand store (src/renderer/store/index.ts)
{
  conversation: SessionConversation | null;
  visibleAIGroupId: string | null;

  fetchSessionDetail(projectId, sessionId): void;
  setVisibleAIGroup(aiGroupId): void;
}
```

## Component Hierarchy

```
ChatHistory
├── ChatItem[] map
│   ├── UserChatGroup (type === 'user')
│   │   └── HighlightedText (commands, @paths)
│   ├── SystemChatGroup (type === 'system')  ← NEW!
│   │   └── CommandOutput text
│   └── AIChatGroup (type === 'ai')
│       ├── Header (Claude icon, model, summary, chevron)
│       ├── DisplayItemList (when expanded)
│       │   ├── ThinkingItem
│       │   ├── TextItem
│       │   ├── LinkedToolItem
│       │   └── SubagentItem (with model info)
│       └── LastOutputDisplay (always visible)
```

## Visual Layout Summary

| Chat Type | Side | Styling | Component |
|-----------|------|---------|-----------|
| User | RIGHT | Blue bubble | UserChatGroup |
| System | LEFT | Gray/neutral | SystemChatGroup |
| AI | LEFT | Dark card | AIChatGroup |