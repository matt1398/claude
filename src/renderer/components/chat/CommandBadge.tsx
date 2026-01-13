import { Terminal } from 'lucide-react';

interface CommandBadgeProps {
  command: string;  // e.g., "isolate-context"
  args?: string;    // Optional arguments
}

export function CommandBadge({ command, args }: CommandBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 bg-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded text-xs font-mono">
      <Terminal className="w-3 h-3" />
      <span>/{command}</span>
      {args && <span className="text-cyan-400/70">{args}</span>}
    </span>
  );
}
