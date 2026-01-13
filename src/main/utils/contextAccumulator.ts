import { SemanticStep, ParsedMessage } from '../types/claude';

/**
 * Calculate context for each step using its source message's usage data.
 * Each step's context is calculated independently from its source message.
 */
export function calculateStepContext(steps: SemanticStep[], messages: ParsedMessage[]): void {
  for (const step of steps) {
    // Find source message for this step
    const msg = messages.find(m => m.uuid === step.sourceMessageId);

    // Calculate context from message usage
    if (msg?.usage) {
      const cacheRead = msg.usage.cache_read_input_tokens || 0;
      const cacheCreation = msg.usage.cache_creation_input_tokens || 0;
      const inputTokens = msg.usage.input_tokens || 0;

      // Context = input tokens sent to API (cache_read + cache_creation + regular input)
      step.accumulatedContext = inputTokens + cacheRead + cacheCreation;

      // DEBUG: Log context calculation for first 5 steps
      if (steps.indexOf(step) < 5) {
        console.log(`[DEBUG] Step ${steps.indexOf(step)} - ${step.type} (${step.id.substring(0, 20)}...):`, {
          sourceMessageId: step.sourceMessageId?.substring(0, 20),
          foundMessage: !!msg,
          messageType: msg?.type,
          inputTokens,
          cacheRead,
          cacheCreation,
          total: step.accumulatedContext
        });
      }
    } else if (step.tokens) {
      // For steps that already have token info (like subagents)
      step.accumulatedContext = (step.tokens.input || 0) + (step.tokens.cached || 0);

      // DEBUG: Log subagent context
      if (steps.indexOf(step) < 5) {
        console.log(`[DEBUG] Subagent step ${steps.indexOf(step)}:`, {
          input: step.tokens.input,
          cached: step.tokens.cached,
          total: step.accumulatedContext
        });
      }
    }

    // Individual step doesn't contribute tokens (message-level tracking)
    step.contextTokens = 0;
    step.tokenBreakdown = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0,
    };
  }
}
