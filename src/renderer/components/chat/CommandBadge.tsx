import { Terminal } from 'lucide-react';

// Ghost badge variant types
export type GhostBadgeVariant = 'blue' | 'green' | 'red' | 'purple' | 'cyan';

// Ghost badge style configurations
export const ghostBadgeStyles: Record<GhostBadgeVariant, string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

// Base ghost badge classes (shared across all variants)
export const ghostBadgeBase = 'inline-flex items-center border rounded-md font-mono text-xs px-2 py-0.5';

/**
 * Get complete ghost badge className for a given variant
 * @param variant - The color variant (blue, green, red, purple, cyan)
 * @returns Complete Tailwind className string
 */
export function getGhostBadgeClassName(variant: GhostBadgeVariant = 'blue'): string {
  return `${ghostBadgeBase} ${ghostBadgeStyles[variant]}`;
}

interface CommandBadgeProps {
  command: string;  // e.g., "isolate-context"
  args?: string;    // Optional arguments
  variant?: GhostBadgeVariant;
}

export function CommandBadge({ command, args, variant = 'cyan' }: CommandBadgeProps) {
  return (
    <span className={`${getGhostBadgeClassName(variant)} gap-1`}>
      <Terminal className="w-3 h-3" />
      <span>/{command}</span>
      {args && <span className="opacity-70">{args}</span>}
    </span>
  );
}

// Generic GhostBadge component for reuse across the app
interface GhostBadgeProps {
  children: React.ReactNode;
  variant?: GhostBadgeVariant;
  className?: string;
}

export function GhostBadge({ children, variant = 'blue', className = '' }: GhostBadgeProps) {
  return (
    <span className={`${getGhostBadgeClassName(variant)} ${className}`}>
      {children}
    </span>
  );
}
