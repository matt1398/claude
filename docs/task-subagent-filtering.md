# Task/Subagent Filtering: Before & After

## The Problem

When Claude Code uses the Task tool to spawn subagents, both the Task tool_call and the resulting subagent execution were appearing in the Gantt chart, creating duplicate entries.

## Visual Comparison

### Before Filtering

```
Chunk: "Implement feature X"
├─ Thinking: "I should use subagents..."
├─ Task (tool_call): "Implement feature X"  ← Duplicate #1
│   └─ Duration: 0ms (instant call)
├─ Subagent: "Implement feature X"         ← Duplicate #2
│   └─ Duration: 45s (actual work)
├─ Output: "Feature implemented"
```

**Problem**: Two entries for the same work, confusing visualization.

### After Filtering

```
Chunk: "Implement feature X"
├─ Thinking: "I should use subagents..."
├─ Subagent: "Implement feature X"         ← Single entry
│   └─ Duration: 45s (actual work)
├─ Output: "Feature implemented"
```

**Result**: Clean, accurate representation of execution flow.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SessionParser: Parse JSONL Messages                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─► Extract Tool Calls
                     │   └─► Identify Task calls (isTask: true)
                     │
                     ├─► Extract Messages
                     │   └─► Preserve all message data
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ SubagentResolver: Parse Subagent Files                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─► Parse agent-{id}.jsonl files
                     │
                     ├─► Match to Task Calls (4-tier)
                     │   1. sourceToolUseID (primary)
                     │   2. Subagent type
                     │   3. Description similarity
                     │   4. Execution order
                     │
                     ├─► Set parentTaskId
                     │   └─► Subagent.parentTaskId = Task.id
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ChunkBuilder: Build Chunks with Subagents                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─► Link subagents to chunks (timing)
                     │
                     ├─► extractSemanticSteps()
                     │   │
                     │   ├─► Build taskIdsWithSubagents Set
                     │   │   └─► Set<string> of Task IDs that have subagents
                     │   │
                     │   ├─► Process content blocks
                     │   │   │
                     │   │   ├─► Thinking blocks → thinking steps
                     │   │   │
                     │   │   ├─► Tool_use blocks
                     │   │   │   ├─► Is Task? AND Has subagent?
                     │   │   │   │   YES → Filter out (skip)
                     │   │   │   │   NO  → Add as tool_call step
                     │   │   │   │
                     │   │   │   └─► Other tools → Add as tool_call step
                     │   │   │
                     │   │   └─► Text blocks → output steps
                     │   │
                     │   ├─► Process tool results
                     │   │   └─► Add as tool_result steps
                     │   │
                     │   └─► Add subagents
                     │       └─► All subagents → subagent steps
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Result: Clean Semantic Steps                                │
│ - No duplicate Task/Subagent entries                        │
│ - Orphaned Tasks preserved                                  │
│ - All subagents included                                    │
└─────────────────────────────────────────────────────────────┘
```

## Filtering Logic Details

### Step 1: Build taskIdsWithSubagents Set

```typescript
const taskIdsWithSubagents = new Set<string>(
  chunk.subagents
    .filter((s) => s.parentTaskId)  // Has parent Task
    .map((s) => s.parentTaskId!)     // Extract Task ID
);

// Example:
// taskIdsWithSubagents = Set {
//   "toolu_01MQrnkJuhjjKF...",
//   "toolu_015VgKjMWpv4iK...",
//   "toolu_011iKfMNnT1snm..."
// }
```

### Step 2: Filter Task Tool Calls

```typescript
for (const block of content) {
  if (block.type === 'tool_use' && block.id && block.name) {
    // Check if this is a Task WITH a subagent
    const isTaskWithSubagent =
      this.isTaskToolCall(block) &&           // Is Task tool?
      taskIdsWithSubagents.has(block.id);     // Has subagent?

    if (!isTaskWithSubagent) {
      // Add as semantic step (either non-Task or orphaned Task)
      steps.push({
        id: block.id,
        type: 'tool_call',
        content: {
          toolName: block.name,
          toolInput: block.input,
        },
        ...
      });
    }
    // Else: Skip (filtered out)
  }
}
```

### Step 3: Add Subagents

```typescript
for (const subagent of chunk.subagents) {
  steps.push({
    id: subagent.id,
    type: 'subagent',
    startTime: subagent.startTime,
    endTime: subagent.endTime,
    durationMs: subagent.durationMs,
    content: {
      subagentId: subagent.id,
      subagentDescription: subagent.description,
    },
    ...
  });
}
```

## Edge Cases Handled

### 1. Orphaned Task Calls

**Scenario**: Task call exists but no subagent file found

```
Task: "toolu_xyz" → No matching subagent
```

**Behavior**: Task appears in semantic steps as fallback

**Why**: Ensures visibility even if subagent file is missing/corrupted

### 2. Subagent Without Task Link

**Scenario**: Subagent file exists but no parentTaskId

```
Subagent: "abc123" (parentTaskId: undefined)
```

**Behavior**: Subagent appears in semantic steps

**Why**: Shows all work, even if linking failed

### 3. Task in Different Chunk

**Scenario**: Task call and subagent execution span chunk boundaries

```
Chunk 1: Task call "toolu_xyz"
Chunk 2: Subagent execution (linked via parentTaskId)
```

**Behavior**:
- Chunk 1: Task appears (no subagent in chunk)
- Chunk 2: Subagent appears (no Task in chunk)

**Why**: Chunk-scoped filtering prevents false matches

### 4. Multiple Subagents per Task

**Scenario**: One Task spawns multiple subagents (future feature)

```
Task: "toolu_xyz"
  ├─> Subagent 1 (parentTaskId: "toolu_xyz")
  └─> Subagent 2 (parentTaskId: "toolu_xyz")
```

**Behavior**:
- Task filtered out
- Both subagents appear

**Why**: All subagents are preserved, Task is deduplicated

## Test Coverage

### test-task-filtering.ts

Verifies:
1. ✓ Task->Subagent linkage via SubagentResolver
2. ✓ Only orphaned Tasks appear in semantic steps
3. ✓ All subagents in chunks appear in semantic steps
4. ✓ No Tasks with subagents appear in steps (correctly filtered)

### test-chunk-building.ts

Verifies:
1. ✓ Chunk count matches user messages
2. ✓ All chunks start with real user messages
3. ✓ Internal messages in responses
4. ✓ Tool executions linked correctly

## Performance Considerations

### Time Complexity

- **Building taskIdsWithSubagents Set**: O(S) where S = subagents in chunk
- **Filtering tool_use blocks**: O(B) where B = content blocks
- **Set lookup**: O(1) per lookup
- **Overall**: O(S + B) - Linear in chunk size

### Space Complexity

- **taskIdsWithSubagents Set**: O(S) where S = subagents in chunk
- **Semantic steps array**: O(B + S) where B = blocks, S = subagents
- **Overall**: O(B + S) - Linear in chunk content

### Typical Performance

- Session: 100 messages
- Chunks: 10 chunks
- Avg chunk size: 10 messages
- Avg subagents per chunk: 2-3
- **Result**: Negligible overhead (<1ms per chunk)

## Implementation Notes

### Why Chunk-Scoped?

Filtering is chunk-scoped (not session-scoped) because:

1. **Timing Boundaries**: Tasks and subagents may span chunk boundaries
2. **Accurate Representation**: Only filter when both Task and Subagent are in same chunk
3. **Fallback Safety**: Ensures orphaned Tasks remain visible in appropriate chunks
4. **Performance**: Avoids expensive cross-chunk lookups

### Why Set Over Array?

Using `Set<string>` instead of `Array<string>` because:

1. **Lookup Performance**: O(1) vs O(n)
2. **Unique IDs**: Automatically deduplicates
3. **Semantic Clarity**: Expresses "membership test" intent

### Why ContentBlock Import?

Added `ContentBlock` import to ChunkBuilder because:

1. **Type Safety**: Method parameter needs explicit type
2. **IDE Support**: Enables autocomplete and type checking
3. **Self-Documenting**: Clear what data structure is expected

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Full project documentation
- [claude-jsonl-spec.ts](./claude-jsonl-spec.ts) - JSONL format specification
- [PHASE1-TASK-FILTERING-SUMMARY.md](../PHASE1-TASK-FILTERING-SUMMARY.md) - Implementation summary

## Future Improvements

### Phase 2: Verbose Step Grouping

Group consecutive tool calls and results:
```
├─ Tool Sequence (collapsed)
│   ├─ Read file
│   ├─ Edit file
│   └─ Write file
```

### Phase 3: Subagent Drill-Down

Nested visualization of subagent internal steps:
```
├─ Subagent: "Implement feature"
│   ├─ Thinking: "Need to..."
│   ├─ Read file
│   └─ Edit file
```

### Phase 4: Parallel Execution

Visual grouping of parallel subagents:
```
├─ Parallel Group (3 subagents)
│   ├─ Subagent 1 ─────────
│   ├─ Subagent 2 ────────
│   └─ Subagent 3 ───────────
```
