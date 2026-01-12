# Chunk Building Verification Test

## Overview

This test script verifies that the chunk building logic in the Claude Code Execution Visualizer works correctly. It tests the core assumption that governs how messages are grouped into chunks for visualization.

## What It Tests

The test verifies four critical aspects of chunk building:

### 1. Real User Messages Create New Chunks
- **Test**: Confirms that each real user message (isMeta: false) starts a new chunk
- **Expected**: Number of chunks equals number of real user messages
- **Why**: Real user messages represent new user requests/commands and should start new chunks

### 2. All Chunks Start with Real User Messages
- **Test**: Verifies every chunk's first message is a real user message
- **Expected**: All chunks begin with isMeta: false user messages
- **Why**: Ensures chunks are properly initialized with user requests

### 3. Internal User Messages Are in Responses
- **Test**: Confirms internal user messages (isMeta: true) are included in responses, not as chunk starters
- **Expected**: All main-thread internal messages appear in chunk responses
- **Why**: Internal messages (like tool results) are part of the response flow, not new user requests

### 4. Tool Executions Are Tracked and Linked
- **Test**: Verifies tool calls are tracked and matched with their results
- **Expected**: Tool calls and results are present and can be matched via toolUseId
- **Why**: Tool execution tracking is essential for visualizing the execution flow

## Running the Test

```bash
npx tsx test-chunk-building.ts
```

## Test Output

The test provides comprehensive output including:

### Step 1: File Selection and Parsing
- Automatically selects a session file (preferring ones with tool results)
- Shows file size and parse results

### Step 2: Message Type Analysis
- Counts real user messages, internal user messages, and assistant messages
- Shows messages with tool results and sourceToolUseID
- Displays examples of each message type

### Step 3: Chunk Building
- Reports number of chunks created

### Step 4: Verification Tests
- Runs 4 verification tests with detailed statistics
- Shows internal message analysis
- Displays tool execution statistics

### Step 5: Detailed Chunk Analysis
- Shows first 5 chunks with:
  - User message preview
  - Response count breakdown
  - Tool execution details
  - Duration and token usage

### Step 6: Tool Result Linkage Example
- Demonstrates actual tool call/result linkage
- Shows how toolUseId connects calls to results

### Final Summary
- Pass/fail count
- Key findings confirmation
- Session statistics

## Sample Output

```
================================================================================
Chunk Building Verification Test
================================================================================

Using session file: /Users/user/.claude/projects/.../session.jsonl
File size: 1216.14 KB

Step 1: Parsing JSONL file
--------------------------------------------------------------------------------
✓ Parsed 335 messages

Step 2: Analyzing message types
--------------------------------------------------------------------------------
Real user messages (isMeta: false):     113
Internal user messages (isMeta: true):  4
Assistant messages:                     212
Messages with tool results:             95
Messages with sourceToolUseID:          2

...

================================================================================
Test Summary
================================================================================

Total tests: 4
Passed: 4

Key findings:
✓ Real user messages (isMeta: false) create new chunks
✓ Internal user messages (isMeta: true) are included in responses, NOT as new chunks
✓ Tool executions are tracked and matched with results via toolUseId
✓ ChunkBuilder properly groups messages into user-request chunks

Session statistics:
  Total messages: 335
  Chunks created: 113
  Tool calls: 95
  Tool results: 95
```

## What the Test Validates

### Message Categorization
The test confirms that the type guards (`isRealUserMessage`, `isInternalUserMessage`, `isAssistantMessage`) correctly identify different message types based on the `isMeta` flag.

### Chunk Structure
Verifies that chunks follow the expected structure:
```
Chunk = {
  userMessage: Real user message (isMeta: false)
  responses: [
    Assistant messages,
    Internal user messages (isMeta: true, tool results)
  ]
}
```

### Tool Execution Tracking
Confirms that:
- Tool calls from assistant messages are captured
- Tool results from user messages are extracted
- The ChunkBuilder tracks tool executions correctly
- Tool calls can be matched to results via `toolUseId`

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## Files Tested

The test imports and validates:
- `/src/main/utils/jsonl.ts` - JSONL parsing and type guards
- `/src/main/services/ChunkBuilder.ts` - Chunk building logic
- `/src/main/types/claude.ts` - Type definitions and type guards

## Implementation Details

### Session File Selection
The test automatically finds a suitable session file by:
1. Looking in `~/.claude/projects/-Users-bskim-ClaudeContext/`
2. Filtering files > 10KB for meaningful tests
3. Preferring files with tool results for comprehensive testing
4. Selecting the one with the most tool results

### Message Filtering
The ChunkBuilder correctly filters messages:
- Main thread only (non-sidechain)
- Real user messages start chunks
- Internal user messages and assistant messages are responses

### Tool Result Matching
Tool results are matched to calls via:
- `toolUseId` in content blocks
- `sourceToolUseID` field in internal messages
- The ChunkBuilder's `buildToolExecutions` method

## Troubleshooting

### "No suitable session files found"
Make sure you have Claude Code session files in `~/.claude/projects/` with some activity.

### "Failed: X tests"
Check the detailed output to see which test failed and examine the specific failure message.

### Test runs but shows warnings
Yellow warnings (⊘) indicate missing data but don't fail the test. For example, a session without tool results will show a warning but pass.

## Integration with Development

This test should be run:
- After modifying chunk building logic
- After changing message parsing
- Before committing changes to ChunkBuilder or SessionParser
- When debugging chunk visualization issues

## Architecture Insights

This test validates the core architectural decision:

**User messages with `isMeta: false` represent discrete user interactions** and should create new chunks, while **internal messages with `isMeta: true` are system-generated responses** (like tool results) and should be part of the response flow within a chunk.

This distinction is critical for:
1. Proper visualization of user request/response cycles
2. Accurate tool execution tracking
3. Correct metric aggregation per user interaction
4. Meaningful waterfall chart generation
