/**
 * TokenUsageDisplay - Compact token usage display with detailed breakdown on hover.
 * Shows total tokens with an info icon that reveals a popover with:
 * - Input tokens breakdown
 * - Cache read/write tokens
 * - Output tokens
 * - Optional model information
 */

import { Info } from 'lucide-react';
import { getModelColorClass } from '../../../shared/utils/modelParser';
import type { ModelInfo } from '../../../shared/utils/modelParser';

export interface TokenUsageDisplayProps {
  /** Input tokens count */
  inputTokens: number;
  /** Output tokens count */
  outputTokens: number;
  /** Cache read tokens count */
  cacheReadTokens: number;
  /** Cache creation/write tokens count */
  cacheCreationTokens: number;
  /** Optional model name for display */
  modelName?: string;
  /** Optional model family for color styling */
  modelFamily?: ModelInfo['family'];
  /** Size variant - 'sm' for compact, 'md' for slightly larger */
  size?: 'sm' | 'md';
}

/**
 * Format token counts with 'k' suffix for thousands.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Format token counts with locale-aware separators for the popover detail view.
 */
function formatTokensDetailed(tokens: number): string {
  return tokens.toLocaleString();
}

export function TokenUsageDisplay({
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
  modelName,
  modelFamily,
  size = 'sm',
}: TokenUsageDisplayProps) {
  const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens;
  const formattedTotal = formatTokens(totalTokens);

  // Size-based classes
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  // For md size in metrics cards, match the text-zinc-300 styling of other metric values
  const textColor = size === 'sm' ? 'text-zinc-400' : 'text-zinc-300';

  // Model color based on family
  const modelColorClass = modelFamily ? getModelColorClass(modelFamily) : 'text-zinc-400';

  return (
    <div
      className={`inline-flex items-center gap-1 ${textSize} ${textColor}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-medium">{formattedTotal}</span>
      <div className="relative group">
        <Info
          className={`${iconSize} cursor-help text-zinc-500 hover:text-zinc-400 transition-colors`}
        />
        {/* Popover - shown on hover, positioned to the left to avoid sidebar overlap */}
        <div
          className="
            absolute z-50 hidden group-hover:block
            left-0 top-full mt-1
            min-w-[200px] max-w-[280px]
            bg-zinc-900 border border-zinc-700 rounded-lg
            shadow-xl shadow-black/50
            p-3
          "
        >
          {/* Arrow pointer - positioned on left side to match popover alignment */}
          <div className="absolute -top-1 left-2 w-2 h-2 bg-zinc-900 border-l border-t border-zinc-700 rotate-45" />

          <div className="space-y-2 text-xs">
            {/* Input Tokens */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Input Tokens</span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {formatTokensDetailed(inputTokens)}
              </span>
            </div>

            {/* Cache Read */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Cache Read</span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {formatTokensDetailed(cacheReadTokens)}
              </span>
            </div>

            {/* Cache Write/Creation */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Cache Write</span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {formatTokensDetailed(cacheCreationTokens)}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-700/50 my-1" />

            {/* Output Tokens */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Output Tokens</span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {formatTokensDetailed(outputTokens)}
              </span>
            </div>

            {/* Model Info (optional) */}
            {modelName && (
              <>
                <div className="border-t border-zinc-700/50 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Model</span>
                  <span className={`font-medium ${modelColorClass}`}>
                    {modelName}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenUsageDisplay;
