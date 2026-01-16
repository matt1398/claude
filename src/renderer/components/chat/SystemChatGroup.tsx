import { format } from 'date-fns';
import { Terminal } from 'lucide-react';
import type { SystemGroup } from '../../types/groups';
import { SearchHighlight } from './SearchHighlight';
import { useStore } from '../../store';

interface SystemChatGroupProps {
  systemGroup: SystemGroup;
}

/**
 * SystemChatGroup displays command output (e.g., /model response).
 * Renders on LEFT side like AI, but with neutral/gray styling.
 */
export function SystemChatGroup({ systemGroup }: SystemChatGroupProps) {
  const { commandOutput, timestamp, id: groupId } = systemGroup;
  const searchQuery = useStore((s) => s.searchQuery);

  // Clean ANSI escape codes from output
  const cleanOutput = commandOutput.replace(/\u001b\[[0-9;]*m/g, '');

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {/* Header - system icon */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>System</span>
          <span>·</span>
          <span>{format(timestamp, 'h:mm:ss a')}</span>
        </div>

        {/* Content - theme-aware neutral styling */}
        <div
          className="rounded-2xl rounded-bl-sm px-4 py-3"
          style={{ backgroundColor: 'var(--chat-system-bg)' }}
        >
          <pre
            className="text-sm whitespace-pre-wrap font-mono"
            style={{ color: 'var(--chat-system-text)' }}
          >
            {searchQuery ? (
              <SearchHighlight text={cleanOutput} itemId={groupId} />
            ) : (
              cleanOutput
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
