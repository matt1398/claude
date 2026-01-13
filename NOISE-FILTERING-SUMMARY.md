# Noise Filtering Test - Quick Reference

## Running the Test

```bash
# Using npm
npm run test:noise

# Using tsx directly
npx tsx test-noise-filtering.ts
```

## What It Verifies

### ❌ Test 1: Zero Chunks from Noise (Currently Failing)
- A file with only local commands should produce 0 chunks
- Validates: Noise messages don't trigger chunk creation
- **Current**: 6 chunks created (should be 0)

### ✅ Test 2: Noise Detection
- All messages correctly identified as noise
- Validates: `isNoiseMessage()` helper works correctly

### ✅ Test 3: Trigger Detection
- No trigger messages in noise-only file
- Validates: `isTriggerMessage()` correctly filters noise

### ❌ Test 4: Command Filtering (Currently Failing)
- Command-related messages should not create chunks
- Validates: `/usage`, `/mcp`, `/model`, `/exit` are filtered
- **Current**: Commands still create chunks

## Noise Message Indicators

Messages are considered noise if they contain:

```typescript
// isMeta flag
isMeta: true

// System messages
type: "system"

// Content indicators
<command-name>         // Local command wrapper
<local-command-caveat> // Caveat about local commands
<local-command-stdout> // Command output
<local-command-message>
<command-args>
```

## Expected Behavior

### Before Fix (Current)
```
Total messages: 13
Noise messages: 13
Trigger messages: 0
Chunks created: 6 ❌ (should be 0)
```

### After Fix (Target)
```
Total messages: 13
Noise messages: 13
Trigger messages: 0
Chunks created: 0 ✅
```

## Example Noise Messages

### Local Command
```json
{
  "type": "user",
  "isMeta": false,
  "content": "<command-name>/mcp</command-name>\n<command-message>mcp</command-message>"
}
```
→ **Noise**: Contains `<command-name>`

### Command Output
```json
{
  "type": "user",
  "isMeta": false,
  "content": "<local-command-stdout>No MCP servers configured...</local-command-stdout>"
}
```
→ **Noise**: Contains `<local-command-stdout>`

### Caveat Message
```json
{
  "type": "user",
  "isMeta": true,
  "content": "<local-command-caveat>Caveat: The messages below...</local-command-caveat>"
}
```
→ **Noise**: `isMeta: true` AND contains `<local-command-caveat>`

## Architecture Impact

```
WITHOUT NOISE FILTERING:
┌─────────────────────┐
│ Chunk 1 (/usage)    │  ← Should not exist
├─────────────────────┤
│ Chunk 2 (/mcp)      │  ← Should not exist
├─────────────────────┤
│ Chunk 3 (/model)    │  ← Should not exist
└─────────────────────┘

WITH NOISE FILTERING:
┌─────────────────────┐
│ (no chunks)         │  ✓ Correct
└─────────────────────┘
```

## Sample Output (Current - Failing)

```
================================================================================
Noise Filtering Verification Test
================================================================================

✓ Parsed 13 messages
  Noise messages: 13
  Trigger messages: 0
  Chunks created: 6

✗ Test 1 FAILED: Expected 0 chunks, got 6
  Messages that incorrectly started chunks:
    - /mcp command
    - /model command
    - /exit command

✓ Test 2 PASSED: All 13 messages correctly identified as noise
✓ Test 3 PASSED: No trigger messages found
✗ Test 4 FAILED: Command messages present but chunks were created

Summary:
  Passed: 2
  Failed: 2

Key findings:
✗ Noise filtering is not working correctly
✗ ChunkBuilder needs to be updated to filter these messages
```

## Files Involved

- `test-noise-filtering.ts` - This test file
- `src/main/services/ChunkBuilder.ts` - Needs noise filtering
- `src/main/utils/jsonl.ts` - Message type guards
- `example_jsonl/agent/example_4.jsonl` - Test data (noise-only)

## When to Run

- After implementing noise filtering in ChunkBuilder
- After modifying message parsing logic
- When debugging chunk count issues
- Before committing visualization changes

## Fix Required

ChunkBuilder needs to filter noise messages:

```typescript
// Add noise detection
function isNoiseMessage(msg: ParsedMessage): boolean {
  if (msg.isMeta) return true;
  if (msg.type === 'system') return true;

  const content = typeof msg.content === 'string' ? msg.content : '';
  return content.includes('<command-name>') ||
         content.includes('<local-command-caveat>') ||
         content.includes('<local-command-stdout>');
}

// Filter before building chunks
buildChunks(messages: ParsedMessage[]): Chunk[] {
  const triggers = messages.filter(msg =>
    isRealUserMessage(msg) && !isNoiseMessage(msg)
  );
  // Build chunks from triggers only
}
```

## Success Criteria

All 4 tests pass:
- ✅ Noise-only file produces 0 chunks
- ✅ All messages identified as noise
- ✅ No trigger messages found
- ✅ Command messages don't create chunks

## Documentation

See `NOISE-FILTERING-TEST.md` for detailed documentation.
