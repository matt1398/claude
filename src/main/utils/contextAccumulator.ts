import { SemanticStep, ParsedMessage } from '../types/claude';

const INITIAL_CONTEXT = 10000; // Claude Code base context

interface ContextAccumulatorInput {
  steps: SemanticStep[];
  messages: ParsedMessage[];
  isSubagent: boolean; // If true, context resets to 10k
}

/**
 * Calculate accumulated context for each step.
 * Uses step-level estimation by distributing message tokens across steps.
 */
export function calculateAccumulatedContext(input: ContextAccumulatorInput): SemanticStep[] {
  const { steps, messages, isSubagent } = input;

  let accumulated = INITIAL_CONTEXT;

  for (const step of steps) {
    // Find source message
    const msg = messages.find(m => m.uuid === step.sourceMessageId);

    if (msg?.usage) {
      // Extract token data
      const cacheRead = msg.usage.cache_read_input_tokens || 0;
      const cacheCreation = msg.usage.cache_creation_input_tokens || 0;
      const input = msg.usage.input_tokens || 0;
      const output = msg.usage.output_tokens || 0;

      // For step-level estimation, distribute based on content length
      const stepsFromMessage = steps.filter(s => s.sourceMessageId === msg.uuid);
      const stepWeight = estimateStepWeight(step, stepsFromMessage);

      // Distribute tokens proportionally
      const stepInput = Math.round(input * stepWeight);
      const stepCacheRead = Math.round(cacheRead * stepWeight);
      const stepCacheCreation = Math.round(cacheCreation * stepWeight);
      const stepOutput = Math.round(output * stepWeight);

      // Context = input tokens sent to API (not output)
      const stepContext = stepInput + stepCacheRead + stepCacheCreation;

      step.contextTokens = stepContext;
      step.tokenBreakdown = {
        input: stepInput,
        output: stepOutput,
        cacheRead: stepCacheRead,
        cacheCreation: stepCacheCreation,
      };

      accumulated += stepContext;
    } else {
      // No usage data - use 0
      step.contextTokens = 0;
      step.tokenBreakdown = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheCreation: 0,
      };
    }

    step.accumulatedContext = accumulated;
  }

  return steps;
}

/**
 * Estimate step weight based on content length.
 * Used to distribute message-level tokens across steps.
 */
function estimateStepWeight(step: SemanticStep, allSteps: SemanticStep[]): number {
  const contentLength = getStepContentLength(step);
  const totalLength = allSteps.reduce((sum, s) => sum + getStepContentLength(s), 0);

  if (totalLength === 0) return 1 / allSteps.length; // Equal distribution

  return contentLength / totalLength;
}

function getStepContentLength(step: SemanticStep): number {
  switch (step.type) {
    case 'thinking':
      return step.content.thinkingText?.length || 0;
    case 'output':
      return step.content.outputText?.length || 0;
    case 'tool_call':
      return JSON.stringify(step.content.toolInput || '').length;
    case 'tool_result':
      return step.content.toolResultContent?.length || 0;
    case 'subagent':
      return step.tokens?.input || 0; // Use actual tokens if available
    default:
      return 100; // Default weight
  }
}
