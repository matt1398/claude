/**
 * ClaudeMdBadge - Displays a compact badge showing CLAUDE.md injections.
 * Shows count of NEW injections in a group with hover popover for details.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ClaudeMdStats, ClaudeMdSource } from '../../types/claudeMd';

interface ClaudeMdBadgeProps {
  stats: ClaudeMdStats;
}

/**
 * Get the icon/prefix indicator for a source type.
 */
function getSourceIndicator(source: ClaudeMdSource): string {
  switch (source) {
    case 'enterprise':
      return '[E]';
    case 'user-memory':
      return '[U]';
    case 'project-memory':
      return '[P]';
    case 'project-rules':
      return '[R]';
    case 'project-local':
      return '[L]';
    case 'directory':
      return '[D]';
    default:
      return '[?]';
  }
}

/**
 * Get label for a source type.
 */
function getSourceLabel(source: ClaudeMdSource): string {
  switch (source) {
    case 'enterprise':
      return 'Enterprise';
    case 'user-memory':
      return 'User Memory';
    case 'project-memory':
      return 'Project Memory';
    case 'project-rules':
      return 'Project Rules';
    case 'project-local':
      return 'Project Local';
    case 'directory':
      return 'Directory';
    default:
      return 'Unknown';
  }
}

/**
 * Check if a source is global (blue tint) vs directory-based (green tint).
 */
function isGlobalSource(source: ClaudeMdSource): boolean {
  return source === 'enterprise' || source === 'user-memory';
}

/**
 * Format token count for display.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function ClaudeMdBadge({ stats }: ClaudeMdBadgeProps): React.ReactElement | null {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);

  // Only render if there are new injections
  if (stats.newCount === 0) {
    return null;
  }

  // Check if we have any global sources (for badge color)
  const hasGlobalSources = stats.newInjections.some(inj => isGlobalSource(inj.source));
  const hasDirectorySources = stats.newInjections.some(inj => !isGlobalSource(inj.source));

  // Determine badge color based on source types
  // If mixed, use a neutral color; otherwise blue for global, green for directory
  let badgeStyle: React.CSSProperties;
  if (hasGlobalSources && hasDirectorySources) {
    // Mixed sources - use neutral/purple tint
    badgeStyle = {
      backgroundColor: 'rgba(139, 92, 246, 0.15)',
      border: '1px solid rgba(139, 92, 246, 0.4)',
      color: '#c4b5fd',
    };
  } else if (hasGlobalSources) {
    // Global sources only - blue tint
    badgeStyle = {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      color: '#93c5fd',
    };
  } else {
    // Directory sources only - green tint
    badgeStyle = {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      color: '#86efac',
    };
  }

  // Check available space and determine popover position
  useEffect(() => {
    if (showPopover && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const popoverWidth = 280; // Approximate width of popover

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
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Badge */}
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-help"
        style={badgeStyle}
      >
        <span>CLAUDE.md</span>
        <span className="font-semibold">+{stats.newCount}</span>
      </span>

      {/* Popover */}
      {showPopover && (
        <div
          className="absolute z-50 top-full mt-1 min-w-[240px] max-w-[320px] rounded-lg shadow-xl p-3"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            ...(popoverPosition === 'left' ? { left: 0 } : { right: 0 }),
          }}
        >
          {/* Arrow pointer */}
          <div
            className="absolute -top-1 w-2 h-2 rotate-45"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              borderLeft: '1px solid var(--color-border)',
              borderTop: '1px solid var(--color-border)',
              ...(popoverPosition === 'left' ? { left: '12px' } : { right: '12px' }),
            }}
          />

          {/* Title */}
          <div
            className="text-xs font-semibold mb-2 pb-2"
            style={{
              color: 'var(--color-text)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            CLAUDE.md Injected
          </div>

          {/* Injection list */}
          <div className="space-y-2">
            {stats.newInjections.map((injection) => {
              const isGlobal = isGlobalSource(injection.source);
              const indicatorColor = isGlobal
                ? 'rgba(96, 165, 250, 0.9)' // Blue for global
                : 'rgba(74, 222, 128, 0.9)'; // Green for directory

              return (
                <div key={injection.id} className="flex items-start gap-2">
                  {/* Source indicator */}
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: indicatorColor }}
                    title={getSourceLabel(injection.source)}
                  >
                    {getSourceIndicator(injection.source)}
                  </span>

                  {/* Display name and token info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs truncate"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title={injection.path}
                    >
                      {injection.displayName}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      ~{formatTokens(injection.estimatedTokens)} tokens
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total tokens footer */}
          {stats.newInjections.length > 1 && (
            <div
              className="mt-2 pt-2 flex justify-between items-center text-xs"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                ~{formatTokens(stats.newInjections.reduce((sum, inj) => sum + inj.estimatedTokens, 0))} tokens
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClaudeMdBadge;
