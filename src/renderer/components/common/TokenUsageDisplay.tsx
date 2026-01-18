/**
 * TokenUsageDisplay - Compact token usage display with detailed breakdown on hover.
 * Shows total tokens with an info icon that reveals a popover with:
 * - Input tokens breakdown
 * - Cache read/write tokens
 * - Output tokens
 * - Optional model information
 */

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { getModelColorClass } from '../../../shared/utils/modelParser';
import type { ModelInfo } from '../../../shared/utils/modelParser';
import type { ClaudeMdStats } from '../../types/claudeMd';

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
  /** Optional CLAUDE.md injection statistics */
  claudeMdStats?: ClaudeMdStats;
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
  claudeMdStats,
}: TokenUsageDisplayProps) {
  const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens;
  const formattedTotal = formatTokens(totalTokens);

  // Size-based classes
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  // Model color based on family
  const modelColorClass = modelFamily ? getModelColorClass(modelFamily) : '';

  // Use React state for hover instead of CSS group-hover to avoid
  // interference with parent components that also use the 'group' class
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);

  // Check available space and determine popover position
  useEffect(() => {
    if (showPopover && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const popoverWidth = 220; // Approximate width of popover

      // If there's not enough space on the right, open to the left
      if (rect.left + popoverWidth > viewportWidth - 20) {
        setPopoverPosition('right');
      } else {
        setPopoverPosition('left');
      }
    }
  }, [showPopover]);

  return (
    <div
      className={`inline-flex items-center gap-1 ${textSize}`}
      style={{ color: 'var(--color-text-muted)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-medium">{formattedTotal}</span>
      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
      >
        <Info
          className={`${iconSize} cursor-help transition-colors`}
          style={{ color: 'var(--color-text-muted)' }}
        />
        {/* Popover - shown on hover over info icon only */}
        {showPopover && (
          <div
            className="absolute z-50 top-full mt-1 min-w-[200px] max-w-[280px] rounded-lg shadow-xl p-3"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              // Position based on available space
              ...(popoverPosition === 'left'
                ? { left: 0 }
                : { right: 0 }
              ),
            }}
          >
          {/* Arrow pointer - positioned based on popover alignment */}
          <div
            className="absolute -top-1 w-2 h-2 rotate-45"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              borderLeft: '1px solid var(--color-border)',
              borderTop: '1px solid var(--color-border)',
              ...(popoverPosition === 'left'
                ? { left: '8px' }
                : { right: '8px' }
              ),
            }}
          />

          <div className="space-y-2 text-xs">
            {/* Input Tokens */}
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-muted)' }}>Input Tokens</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTokensDetailed(inputTokens)}
              </span>
            </div>

            {/* Cache Read */}
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-muted)' }}>Cache Read</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTokensDetailed(cacheReadTokens)}
              </span>
            </div>

            {/* Cache Write/Creation */}
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-muted)' }}>Cache Write</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTokensDetailed(cacheCreationTokens)}
              </span>
            </div>

            {/* Output Tokens */}
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-muted)' }}>Output Tokens</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTokensDetailed(outputTokens)}
              </span>
            </div>

            {/* Divider before Total */}
            <div className="my-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }} />

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-primary, var(--color-text))' }}>
                {formatTokensDetailed(totalTokens)}
              </span>
            </div>

            {/* CLAUDE.md Breakdown - shown as part of total, not additional */}
            {claudeMdStats && (
              <div className="flex justify-between items-center text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                <span className="italic whitespace-nowrap">
                  incl. CLAUDE.md ×{claudeMdStats.accumulatedCount}
                </span>
                <span className="tabular-nums">
                  {totalTokens > 0 ? ((claudeMdStats.totalEstimatedTokens / totalTokens) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            )}

            {/* Model Info (optional) */}
            {modelName && (
              <>
                <div className="my-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-text-muted)' }}>Model</span>
                  <span className={`font-medium ${modelColorClass}`} style={!modelColorClass ? { color: 'var(--color-text-secondary)' } : {}}>
                    {modelName}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default TokenUsageDisplay;
