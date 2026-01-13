# Semantic Steps API Reference

Quick reference for using semantic steps in UI components.

## Getting Semantic Steps

### From IPC (Renderer Process)

```typescript
// In renderer component
import { useStore } from '../store';

const { sessionDetail } = useStore();

// sessionDetail contains EnhancedChunk[]
const chunks = sessionDetail?.chunks || [];

// Each chunk has semanticSteps
chunks.forEach(chunk => {
  console.log(`Chunk has ${chunk.semanticSteps.length} steps`);

  chunk.semanticSteps.forEach(step => {
    // Use step data...
  });
});
```

### Directly from ChunkBuilder (Main Process)

```typescript
import { ChunkBuilder } from './services/ChunkBuilder';
import { SessionParser } from './services/SessionParser';

const parser = new SessionParser();
const session = await parser.parseSessionFile(sessionPath);

const builder = new ChunkBuilder();
const chunks = builder.buildChunks(session.messages);

// chunks is EnhancedChunk[]
chunks.forEach(chunk => {
  console.log(chunk.semanticSteps);
});
```

## Type Definitions

### EnhancedChunk

```typescript
interface EnhancedChunk extends Chunk {
  /** Semantic steps extracted from messages */
  semanticSteps: SemanticStep[];

  /** Raw messages for debug sidebar */
  rawMessages: ParsedMessage[];

  // Also includes all Chunk fields:
  id: string;
  userMessage: ParsedMessage;
  responses: ParsedMessage[];
  startTime: Date;
  endTime: Date;
  durationMs: number;
  metrics: SessionMetrics;
  subagents: Subagent[];
  toolExecutions: ToolExecution[];
}
```

### SemanticStep

```typescript
interface SemanticStep {
  /** Unique step identifier */
  id: string;

  /** Step type */
  type: SemanticStepType;

  /** When the step started */
  startTime: Date;

  /** When the step ended (optional) */
  endTime?: Date;

  /** Duration in milliseconds */
  durationMs: number;

  /** Content varies by type */
  content: {
    thinkingText?: string;        // For thinking
    toolName?: string;            // For tool_call/result
    toolInput?: unknown;          // For tool_call
    toolResultContent?: string;   // For tool_result
    isError?: boolean;            // For tool_result
    subagentId?: string;          // For subagent
    subagentDescription?: string; // For subagent
    outputText?: string;          // For output
  };

  /** Token attribution (optional) */
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };

  /** Execution context */
  context: 'main' | 'subagent';

  /** Agent ID if subagent context */
  agentId?: string;
}
```

### SemanticStepType

```typescript
type SemanticStepType =
  | 'thinking'      // Extended thinking content
  | 'tool_call'     // Tool invocation
  | 'tool_result'   // Tool result received
  | 'subagent'      // Subagent execution
  | 'output'        // Main text output
  | 'interruption'; // User interruption
```

## Usage Examples

### Display Step Timeline

```typescript
import type { SemanticStep } from '../types/data';

interface StepTimelineProps {
  steps: SemanticStep[];
}

const StepTimeline: React.FC<StepTimelineProps> = ({ steps }) => {
  return (
    <div className="space-y-2">
      {steps.map(step => (
        <div key={step.id} className="flex items-center gap-2">
          <StepIcon type={step.type} />
          <span className="text-sm">
            {formatStepLabel(step)}
          </span>
          <span className="text-xs text-gray-500">
            {step.durationMs}ms
          </span>
        </div>
      ))}
    </div>
  );
};

function formatStepLabel(step: SemanticStep): string {
  switch (step.type) {
    case 'thinking':
      return 'Thinking...';
    case 'tool_call':
      return `Tool: ${step.content.toolName}`;
    case 'output':
      return 'Response';
    default:
      return step.type;
  }
}
```

### Step Type Icons

```typescript
function StepIcon({ type }: { type: SemanticStepType }) {
  const colors = {
    thinking: 'text-blue-500',
    tool_call: 'text-purple-500',
    tool_result: 'text-green-500',
    output: 'text-gray-500',
    subagent: 'text-orange-500',
    interruption: 'text-red-500',
  };

  const icons = {
    thinking: '🧠',
    tool_call: '🔧',
    tool_result: '✓',
    output: '💬',
    subagent: '🤖',
    interruption: '⚠️',
  };

  return (
    <span className={colors[type]}>
      {icons[type]}
    </span>
  );
}
```

### Step Details Panel

```typescript
interface StepDetailProps {
  step: SemanticStep;
}

const StepDetail: React.FC<StepDetailProps> = ({ step }) => {
  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">
          <StepIcon type={step.type} />
          {' '}
          {step.type}
        </h3>
        <span className="text-sm text-gray-500">
          {new Date(step.startTime).toLocaleTimeString()}
        </span>
      </div>

      <div className="text-sm space-y-2">
        <div>
          <span className="font-medium">Duration:</span>
          {' '}
          {step.durationMs}ms
        </div>

        <div>
          <span className="font-medium">Context:</span>
          {' '}
          {step.context}
        </div>

        {step.content.thinkingText && (
          <div>
            <span className="font-medium">Thinking:</span>
            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded">
              {step.content.thinkingText}
            </pre>
          </div>
        )}

        {step.content.toolName && (
          <div>
            <span className="font-medium">Tool:</span>
            {' '}
            {step.content.toolName}
          </div>
        )}

        {step.content.outputText && (
          <div>
            <span className="font-medium">Output:</span>
            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded">
              {step.content.outputText}
            </pre>
          </div>
        )}

        {step.tokens && (
          <div>
            <span className="font-medium">Tokens:</span>
            {' '}
            {step.tokens.input} in, {step.tokens.output} out
          </div>
        )}
      </div>
    </div>
  );
};
```

### Filter Steps by Type

```typescript
function getStepsByType(steps: SemanticStep[], type: SemanticStepType) {
  return steps.filter(s => s.type === type);
}

// Usage
const thinkingSteps = getStepsByType(chunk.semanticSteps, 'thinking');
const toolSteps = getStepsByType(chunk.semanticSteps, 'tool_call');
```

### Calculate Step Statistics

```typescript
function calculateStepStats(steps: SemanticStep[]) {
  const stats = {
    total: steps.length,
    byType: {} as Record<SemanticStepType, number>,
    totalDuration: 0,
    avgDuration: 0,
  };

  steps.forEach(step => {
    stats.byType[step.type] = (stats.byType[step.type] || 0) + 1;
    stats.totalDuration += step.durationMs;
  });

  stats.avgDuration = stats.totalDuration / steps.length;

  return stats;
}

// Usage
const stats = calculateStepStats(chunk.semanticSteps);
console.log(`${stats.total} steps, ${stats.totalDuration}ms total`);
console.log(`${stats.byType.thinking} thinking steps`);
```

### Sort Steps by Duration

```typescript
function getSlowestSteps(steps: SemanticStep[], limit: number = 5) {
  return [...steps]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, limit);
}

// Usage
const slowest = getSlowestSteps(chunk.semanticSteps);
slowest.forEach(step => {
  console.log(`${step.type}: ${step.durationMs}ms`);
});
```

### Group Sequential Steps

```typescript
function groupSequentialSteps(steps: SemanticStep[]) {
  const groups: SemanticStep[][] = [];
  let currentGroup: SemanticStep[] = [];

  steps.forEach((step, i) => {
    currentGroup.push(step);

    // Start new group if next step is thinking (indicates new response cycle)
    if (i < steps.length - 1 && steps[i + 1].type === 'thinking') {
      groups.push(currentGroup);
      currentGroup = [];
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// Usage - shows thinking → tool_call → output sequences
const sequences = groupSequentialSteps(chunk.semanticSteps);
sequences.forEach((seq, i) => {
  console.log(`Sequence ${i + 1}:`, seq.map(s => s.type).join(' → '));
});
```

## Accessing from Store

```typescript
// In a React component
import { useStore } from '../store';

function MyComponent() {
  const sessionDetail = useStore(state => state.sessionDetail);

  if (!sessionDetail) return null;

  return (
    <div>
      {sessionDetail.chunks.map(chunk => (
        <div key={chunk.id}>
          <h3>Chunk {chunk.id}</h3>
          <StepTimeline steps={chunk.semanticSteps} />
        </div>
      ))}
    </div>
  );
}
```

## Type Guards

```typescript
// Check if step is thinking
function isThinkingStep(step: SemanticStep): boolean {
  return step.type === 'thinking';
}

// Check if step is tool-related
function isToolStep(step: SemanticStep): boolean {
  return step.type === 'tool_call' || step.type === 'tool_result';
}

// Check if step is from subagent
function isSubagentStep(step: SemanticStep): boolean {
  return step.context === 'subagent';
}
```

## Common Patterns

### Render Step Timeline with D3

```typescript
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

function D3StepTimeline({ steps }: { steps: SemanticStep[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || steps.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = steps.length * 40;

    svg.attr('width', width).attr('height', height);

    const yScale = d3.scaleBand()
      .domain(steps.map((_, i) => i.toString()))
      .range([0, height])
      .padding(0.2);

    const xScale = d3.scaleTime()
      .domain([
        d3.min(steps, s => s.startTime)!,
        d3.max(steps, s => s.endTime || s.startTime)!,
      ])
      .range([0, width]);

    svg.selectAll('rect')
      .data(steps)
      .enter()
      .append('rect')
      .attr('y', (_, i) => yScale(i.toString())!)
      .attr('x', d => xScale(d.startTime))
      .attr('width', d => {
        const end = d.endTime || new Date(d.startTime.getTime() + d.durationMs);
        return xScale(end) - xScale(d.startTime);
      })
      .attr('height', yScale.bandwidth())
      .attr('fill', d => getStepColor(d.type));
  }, [steps]);

  return <svg ref={svgRef} />;
}

function getStepColor(type: SemanticStepType): string {
  const colors: Record<SemanticStepType, string> = {
    thinking: '#3b82f6',
    tool_call: '#8b5cf6',
    tool_result: '#10b981',
    output: '#6b7280',
    subagent: '#f97316',
    interruption: '#ef4444',
  };
  return colors[type];
}
```

## Testing

```bash
# Run semantic step tests
npm run test:semantic

# Build and verify types
npm run build

# Type check only
npm run typecheck
```

## Troubleshooting

### No steps extracted
- Check that chunk has assistant messages
- Verify messages have content blocks
- Check `chunk.semanticSteps.length`

### Wrong step types
- Verify SemanticStepType enum matches implementation
- Check ChunkBuilder.extractSemanticSteps() logic

### Missing step content
- Check that content blocks exist in messages
- Verify block.type matches expected values
- Inspect raw message data in `chunk.rawMessages`

### Performance issues
- Use virtual scrolling for large step lists
- Lazy load step details on demand
- Consider memoizing step calculations

## Resources

- Full test results: `/Users/bskim/ClaudeContext/TEST-SEMANTIC-STEPS-RESULTS.md`
- Implementation summary: `/Users/bskim/ClaudeContext/SEMANTIC-STEPS-SUMMARY.md`
- Type definitions: `/Users/bskim/ClaudeContext/src/main/types/claude.ts`
- Extraction logic: `/Users/bskim/ClaudeContext/src/main/services/ChunkBuilder.ts`
