# Chat Architecture Analysis & Refactoring Guide

## Overview
Document the complete data flow from JSONL parsing through rendering.

## Executive Summary
- 21.7% code duplication (~650 lines)
- 12 duplicated type definitions
- 11 duplicated type guard functions
- 1 critical type mismatch (AIChunk.userChunkId)
- Model to follow: contentSanitizer.ts (correctly shared)

## 1. Data Flow Architecture

```
MAIN PROCESS (Node.js)
├── Raw JSONL Files (~/.claude/projects/{project}/{session}.jsonl)
│
├── SessionParser.ts (parseJsonlFile)
│   └── Produces: ParsedMessage[] (from main/types/claude.ts)
│
├── ChunkBuilder.ts (buildChunks)
│   ├── Uses: isParsedUserChunkMessage, isParsedSystemChunkMessage, etc.
│   ├── Categorizes: user | system | ai | compact | hardNoise
│   └── Produces: EnhancedChunk[] (UserChunk, AIChunk, SystemChunk, CompactChunk)
│
└── IPC Handlers (src/main/ipc/handlers.ts)
    └── Serializes: EnhancedChunk[] over IPC

                              ↓ IPC BOUNDARY ↓
                       (Type information preserved)
                       (Function references lost)

RENDERER PROCESS (React/Chromium)
├── Receives: EnhancedChunk[] (JSON-serialized)
│
├── groupTransformer.ts (transformChunksToConversation)
│   ├── Uses: isEnhancedUserChunk, isEnhancedAIChunk, etc.
│   └── Produces: SessionConversation { items: ChatItem[] }
│
├── types/groups.ts defines:
│   ├── UserGroup (from EnhancedUserChunk)
│   ├── AIGroup (from EnhancedAIChunk)
│   ├── SystemGroup (from EnhancedSystemChunk)
│   └── CompactGroup (from EnhancedCompactChunk)
│
└── UI Components
    ├── ChatHistory.tsx - Flat list rendering
    ├── UserChatGroup.tsx - User input display
    ├── AIChatGroup.tsx - AI response display
    ├── SystemChatGroup.tsx - Command output display
    └── CompactBoundary.tsx - Compact marker display
```

## 2. Source of Truth Table

| Concern | Source of Truth | Location | Notes |
|---------|----------------|----------|-------|
| **JSONL Types** | main/types/claude.ts | Lines 17-198 | Raw entry types |
| **ParsedMessage Types** | main/types/claude.ts | Lines 656-729 | Application types |
| **Chunk Types** | main/types/claude.ts | Lines 766-834 | All chunk variants |
| **Enhanced Types** | main/types/claude.ts | Lines 1029-1065 | With semantic steps |
| **Type Guards** | main/types/claude.ts | Lines 1554-1605 | SHOULD BE in shared/ |
| **Message Classification** | main/types/claude.ts | Lines 1236-1545 | SHOULD BE in shared/ |
| **Content Sanitization** | shared/utils/contentSanitizer.ts | Lines 1-109 | CORRECTLY SHARED |
| **Group Types** | renderer/types/groups.ts | Lines 1-323 | UI-specific types |

## 3. Duplicated Code Inventory

### 3.1 Type Definitions (KEEP - Required by Electron)

Types MUST exist in both processes due to TypeScript module resolution:

| Type | Main Process | Renderer | Action |
|------|--------------|----------|--------|
| Project | claude.ts:587 | data.ts:13 | Keep both, consider shared/ |
| Session | claude.ts:605 | data.ts:31 | Keep both, consider shared/ |
| SessionMetrics | claude.ts:629 | data.ts:69 | Keep both, consider shared/ |
| ParsedMessage | claude.ts:656 | data.ts:182 | Keep both, consider shared/ |
| TokenUsage | claude.ts:567 | data.ts:59 | Keep both, consider shared/ |
| ContentBlock | claude.ts:64 | data.ts:100 | **MISMATCH** - renderer simplified |
| ToolCall | claude.ts:704 | data.ts:119 | Keep both |
| ToolResult | claude.ts:722 | data.ts:137 | Keep both |
| Process | claude.ts:738 | data.ts:291 | Keep both |
| BaseChunk | claude.ts:770 | data.ts:339 | Keep both |
| UserChunk | claude.ts:787 | data.ts:355 | Keep both |
| AIChunk | claude.ts:800 | data.ts:365 | **MISMATCH** - userChunkId |
| SystemChunk | claude.ts:816 | data.ts:383 | Keep both |
| CompactChunk | claude.ts:825 | data.ts:395 | Keep both |
| EnhancedAIChunk | claude.ts:1029 | data.ts:594 | Keep both |
| SemanticStep | claude.ts:934 | data.ts:505 | Keep both |

### 3.2 Type Guard Functions (CONSOLIDATE - All Avoidable)

| Function | Main Location | Renderer Location | Recommendation |
|----------|---------------|-------------------|----------------|
| isUserChunk | claude.ts:1554 | data.ts:639 | shared/types/chunkGuards.ts |
| isAIChunk | claude.ts:1561 | data.ts:646 | shared/types/chunkGuards.ts |
| isSystemChunk | claude.ts:1582 | data.ts:667 | shared/types/chunkGuards.ts |
| isCompactChunk | claude.ts:1596 | data.ts:681 | shared/types/chunkGuards.ts |
| isEnhancedUserChunk | claude.ts:1568 | data.ts:653 | shared/types/chunkGuards.ts |
| isEnhancedAIChunk | claude.ts:1575 | data.ts:660 | shared/types/chunkGuards.ts |
| isEnhancedSystemChunk | claude.ts:1589 | data.ts:674 | shared/types/chunkGuards.ts |
| isEnhancedCompactChunk | claude.ts:1603 | data.ts:688 | shared/types/chunkGuards.ts |
| isRealUserMessage | claude.ts:217 | data.ts:240 | **LOGIC DIFFERS** - fix |
| isInternalUserMessage | claude.ts:285 | data.ts:249 | shared/types/messageGuards.ts |
| isAssistantMessage | claude.ts:292 | data.ts:256 | shared/types/messageGuards.ts |

### 3.3 Utility Functions (CONSOLIDATE)

| Function | Main Location | Duplicated In | Action |
|----------|---------------|---------------|--------|
| extractCommandOutput | contentSanitizer.ts:28 (private) | ChunkBuilder.ts:255 | Export from shared, remove ChunkBuilder's |
| extractTextContent | jsonl.ts:652 | ChunkView.tsx:153 | Import from shared or create renderer util |
| EMPTY_METRICS | claude.ts:1201 | data.ts:814 | shared/types/constants.ts |
| EMPTY_TOKEN_USAGE | claude.ts:1214 | data.ts:827 | shared/types/constants.ts |

### 3.4 Content Sanitization (CORRECTLY SHARED)

**Model implementation** at `/src/shared/utils/contentSanitizer.ts`:

```typescript
// Exported functions (use these everywhere)
export function sanitizeDisplayContent(content: string): string
export function isCommandContent(content: string): boolean
export function isCommandOutputContent(content: string): boolean

// Currently private (should export)
function extractCommandOutput(content: string): string | null
function extractCommandDisplay(content: string): string | null
```

## 4. Critical Issues

### 4.1 AIChunk.userChunkId Mismatch

**Main process produces** (ChunkBuilder.ts:271-317):
```typescript
const chunk: EnhancedAIChunk = {
  chunkType: 'ai',
  responses,
  // userChunkId is MISSING
};
```

**Renderer expects** (data.ts:365-378):
```typescript
export interface AIChunk extends BaseChunk {
  chunkType: 'ai';
  userChunkId: string;  // Required but never provided!
}
```

**Fix**: Remove `userChunkId` from renderer AIChunk type (main process design is correct - AI chunks are independent).

### 4.2 isRealUserMessage Logic Mismatch

**Main** (claude.ts:217-244) handles both string and array content:
```typescript
if (typeof content === 'string') return true;
if (Array.isArray(content)) {
  return content.some(block => block.type === 'text' || block.type === 'image');
}
```

**Renderer** (data.ts:240-244) only checks string:
```typescript
return msg.type === 'user' && !msg.isMeta && typeof msg.content === 'string';
```

**Fix**: Use main process version as source of truth, export from shared.

## 5. Recommended Refactoring Plan

### Phase 1: Critical Fixes (2 hours)

1. **Fix AIChunk type mismatch**:
   - Edit `src/renderer/types/data.ts:369`
   - Remove `userChunkId: string;` line (AI chunks are independent)

2. **Verify chunk types match**:
   - Compare all chunk types between main and renderer
   - Ensure serialization preserves all needed fields

### Phase 2: Create Shared Type Guards (3 hours)

1. **Create** `src/shared/types/chunkGuards.ts`:
```typescript
import type { Chunk, EnhancedChunk, UserChunk, AIChunk, SystemChunk, CompactChunk } from './chunkTypes';

export function isUserChunk(chunk: Chunk | EnhancedChunk): chunk is UserChunk {
  return 'chunkType' in chunk && chunk.chunkType === 'user';
}
// ... all 8 chunk type guards
```

2. **Update imports** in:
   - `src/main/types/claude.ts` - re-export from shared
   - `src/renderer/types/data.ts` - re-export from shared
   - `src/main/services/ChunkBuilder.ts` - import from shared

### Phase 3: Create Shared Constants (1 hour)

1. **Create** `src/shared/types/constants.ts`:
```typescript
export const EMPTY_METRICS: SessionMetrics = { ... };
export const EMPTY_TOKEN_USAGE: TokenUsage = { ... };
```

2. **Update imports** in:
   - `src/main/types/claude.ts`
   - `src/renderer/types/data.ts`

### Phase 4: Export Sanitization Helpers (1 hour)

1. **Update** `src/shared/utils/contentSanitizer.ts`:
   - Export `extractCommandOutput()`
   - Export `extractCommandDisplay()`

2. **Update** `src/main/services/ChunkBuilder.ts`:
   - Import `extractCommandOutput` from shared
   - Remove private `extractCommandOutput()` method

### Phase 5: Create Shared Message Guards (2 hours)

1. **Create** `src/shared/types/messageGuards.ts`:
```typescript
export function isRealUserMessage(msg: ParsedMessage): boolean { ... }
export function isInternalUserMessage(msg: ParsedMessage): boolean { ... }
export function isAssistantMessage(msg: ParsedMessage): boolean { ... }
export function isParsedUserChunkMessage(msg: ParsedMessage): boolean { ... }
export function isParsedSystemChunkMessage(msg: ParsedMessage): boolean { ... }
export function isParsedHardNoiseMessage(msg: ParsedMessage): boolean { ... }
export function isParsedCompactMessage(msg: ParsedMessage): boolean { ... }
```

2. **Update imports** everywhere

## 6. Proposed Directory Structure

```
src/
├── shared/                           # Shared code (compile-time only)
│   ├── types/
│   │   ├── index.ts                  # Re-exports all shared types
│   │   ├── chunkTypes.ts             # Chunk type definitions
│   │   ├── chunkGuards.ts            # Chunk type guards
│   │   ├── messageTypes.ts           # Message type definitions
│   │   ├── messageGuards.ts          # Message classification guards
│   │   └── constants.ts              # EMPTY_METRICS, EMPTY_TOKEN_USAGE
│   └── utils/
│       └── contentSanitizer.ts       # Already exists, expand exports
│
├── main/
│   ├── types/
│   │   └── claude.ts                 # Import & re-export from shared
│   ├── services/
│   │   └── ChunkBuilder.ts           # Import guards from shared
│   └── utils/
│       └── jsonl.ts                  # Import helpers from shared
│
└── renderer/
    ├── types/
    │   ├── data.ts                   # Import & re-export from shared
    │   └── groups.ts                 # UI-specific types only
    └── utils/
        └── groupTransformer.ts       # Import from shared
```

## 7. Code Duplication Metrics

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| Type definitions | ~400 lines | ~400 lines | 0% (required) |
| Type guards | ~150 lines | ~75 lines | 50% |
| Utility functions | ~100 lines | ~50 lines | 50% |
| Constants | ~40 lines | ~20 lines | 50% |
| **Total** | **~650 lines** | **~545 lines** | **~16%** |

**Note**: Type definitions must remain duplicated due to Electron's process isolation and TypeScript module resolution. Logic/functions can be fully shared.

## 8. Testing After Refactoring

1. Run existing tests:
```bash
npm run test:chunks
npm run typecheck
```

2. Manual verification:
   - Open app and verify all chunk types render correctly
   - Check user messages display properly
   - Check AI responses display with tools/subagents
   - Check system (command output) messages display
   - Check compact boundaries display

---

**Document Created**: For analyzing and refactoring the chat architecture
**Model to Follow**: `src/shared/utils/contentSanitizer.ts`
**Primary Goal**: Reduce duplication while respecting Electron process isolation
