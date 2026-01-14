# Chat Group Structure Skill

This skill provides knowledge about how chat messages are grouped and displayed to users in the Claude Code Visualizer.

## Visual Structure (What Users See)

```
┌─────────────────────────────────────────────────────────┐
│  ConversationTurn                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │              [You · 10:23:45 AM]                   │ │ ← UserChatGroup
│  │                    ┌─────────────────────────────┐ │ │   (right-aligned, blue bubble)
│  │                    │ Help me debug this function │ │ │
│  │                    └─────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🤖 Claude · 3 tool calls, 1 message    ▼          │ │ ← AIChatGroup header
│  │ ──────────────────────────────────────────────────│ │   (left-aligned, collapsible)
│  │  [Expandable: thinking, tools, subagents...]      │ │
│  │ ──────────────────────────────────────────────────│ │
│  │  ✓ Last Output (always visible)                   │ │ ← LastOutputDisplay
│  │  "The bug is in line 42 where..."                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Key Types

### Location: `src/renderer/types/groups.ts`

| Type | Purpose |
|------|---------|
| **UserGroup** | User's input message with parsed content (commands, images, @references) |
| **AIGroup** | AI response: steps (thinking, tools, output), tokens, subagents, status |
| **ConversationTurn** | Pairs one UserGroup with one AIGroup |
| **SessionConversation** | Array of all ConversationTurn objects |

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

### AIGroup Structure
```typescript
interface AIGroup {
  id: string;
  userGroupId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  steps: SemanticStep[];      // thinking, tool_call, tool_result, output, subagent
  tokens: { input, output, cached, thinking };
  summary: AIGroupSummary;
  status: 'complete' | 'interrupted' | 'error' | 'in_progress';
  subagents: Subagent[];
}
```

### EnhancedAIGroup (Display-Ready)
```typescript
interface EnhancedAIGroup extends AIGroup {
  lastOutput: AIGroupLastOutput | null;   // Always visible final output
  linkedTools: Map<string, LinkedToolItem>;
  displayItems: AIGroupDisplayItem[];     // Flattened chronological list
  itemsSummary: string;                   // "3 tool calls, 1 message"
}
```

## Data Transformation Pipeline

```
JSONL File
    ↓
SessionParser (src/main/services/SessionParser.ts)
    ↓
ParsedMessage[] + Subagent[]
    ↓
ChunkBuilder.buildChunks() (src/main/services/ChunkBuilder.ts)
    ↓
EnhancedChunk[] (with SemanticSteps)
    ↓
groupTransformer.transformChunksToConversation() (src/renderer/utils/groupTransformer.ts)
    ↓
SessionConversation { turns: ConversationTurn[] }
    ↓
Zustand Store (src/renderer/store/index.ts)
    ↓
ChatHistory → UserChatGroup + AIChatGroup
```

## Key Files

| File | Role |
|------|------|
| `src/renderer/types/groups.ts` | Type definitions for display groups |
| `src/renderer/utils/groupTransformer.ts` | Transforms chunks → conversation |
| `src/renderer/utils/aiGroupEnhancer.ts` | Enhances AIGroup with display-ready data |
| `src/renderer/components/chat/ChatHistory.tsx` | Entry point, maps turns to UI |
| `src/renderer/components/chat/UserChatGroup.tsx` | Right-aligned user bubble |
| `src/renderer/components/chat/AIChatGroup.tsx` | Collapsible AI response card |
| `src/renderer/components/chat/DisplayItemList.tsx` | Renders expanded items |
| `src/renderer/components/chat/LastOutputDisplay.tsx` | Always-visible last output |
| `src/main/services/ChunkBuilder.ts` | Groups messages into chunks |
| `src/main/services/SubagentResolver.ts` | Links Task calls to subagents |

## Grouping Logic

### Core Rules
1. **One AIGroup per user message** - Each user request gets exactly one toggleable AI response
2. **Trigger messages start groups** - Only `isTriggerMessage()` messages create new groups
3. **Internal messages are responses** - `isMeta: true` messages belong to the previous group
4. **Last output always visible** - The final text or tool result is never hidden

### Message Classification

```typescript
// REAL USER MESSAGE - starts new group
{ type: "user", isMeta: false, message: { content: "string" } }

// INTERNAL MESSAGE - part of AI response flow
{ type: "user", isMeta: true, message: { content: [tool_result] } }

// ASSISTANT MESSAGE - AI response
{ type: "assistant", message: { content: [text, thinking, tool_use] } }
```

### Type Guards (from `src/main/types/claude.ts`)
- `isTriggerMessage(msg)` - Real user input that starts a new group
- `isRealUserMessage(msg)` - isMeta: false, string content
- `isInternalUserMessage(msg)` - isMeta: true, tool results
- `isParsedNoiseMessage(msg)` - System metadata to filter out

## Display Items (Expanded View)

| Type | Component | Content |
|------|-----------|---------|
| `thinking` | ThinkingItem | Extended thinking text |
| `output` | TextItem | Intermediate text output |
| `tool` | LinkedToolItem | Tool call paired with result |
| `subagent` | SubagentItem | Nested agent execution |

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
}
```

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
4. **buildSummary()** - Generate "X thinking, Y tool calls, Z messages"

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
├── ConversationTurn[] map
│   ├── UserChatGroup
│   │   └── HighlightedText (commands, @paths)
│   └── AIChatGroup
│       ├── Header (Claude icon, summary, chevron)
│       ├── DisplayItemList (when expanded)
│       │   ├── ThinkingItem
│       │   ├── TextItem
│       │   ├── LinkedToolItem
│       │   └── SubagentItem
│       └── LastOutputDisplay (always visible)
```
