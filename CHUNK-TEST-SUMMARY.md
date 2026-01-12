# Chunk Building Test - Quick Reference

## Running the Test

```bash
# Using npm
npm run test:chunks

# Using tsx directly
npx tsx test-chunk-building.ts
```

## What It Verifies

### ✅ Test 1: Chunk Count
- Number of chunks matches number of real user messages (isMeta: false)
- Validates: Each user request creates exactly one chunk

### ✅ Test 2: Chunk Start
- Every chunk starts with a real user message
- Validates: Chunks are properly initialized with user requests

### ✅ Test 3: Internal Messages
- Internal user messages (isMeta: true) appear in responses, not as new chunks
- Validates: Tool results and meta messages don't create spurious chunks

### ✅ Test 4: Tool Tracking
- Tool calls and results are properly tracked and linked
- Validates: ChunkBuilder matches tools via toolUseId

## Architecture Validated

```
┌─────────────────────────────────────────────┐
│ Chunk                                       │
├─────────────────────────────────────────────┤
│ userMessage: Real user msg (isMeta: false)  │
│                                             │
│ responses: [                                │
│   Assistant message 1                       │
│   Internal user msg (tool result)           │
│   Assistant message 2                       │
│   Internal user msg (tool result)           │
│   ...                                       │
│ ]                                           │
│                                             │
│ toolExecutions: [                           │
│   { toolCall, result, timing }              │
│   ...                                       │
│ ]                                           │
└─────────────────────────────────────────────┘
```

## Key Insight

**isMeta Flag is Critical:**
- `isMeta: false` → Real user message → Starts new chunk
- `isMeta: true` → Internal message → Part of response

## Sample Output

```
✓ Test 1: Chunk count matches real user message count (113)
✓ Test 2: All chunks start with real user messages
✓ Test 3: All 4 main-thread internal user messages are in responses
✓ Test 4: Tool results present (95) - ChunkBuilder matches by toolUseId

Session statistics:
  Total messages: 335
  Chunks created: 113
  Tool calls: 95
  Tool results: 95
```

## Files Tested

- `src/main/utils/jsonl.ts` - Parsing and type guards
- `src/main/services/ChunkBuilder.ts` - Chunk building logic
- `src/main/types/claude.ts` - Type definitions

## When to Run

- After modifying ChunkBuilder
- After changing message parsing
- Before committing visualization changes
- When debugging chunk-related issues

## Documentation

See `TEST-README.md` for detailed documentation.
