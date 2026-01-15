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
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-medium text-zinc-300">System</span>
          <span>·</span>
          <span>{format(timestamp, 'h:mm:ss a')}</span>
        </div>

        {/* Content - neutral/gray styling */}
        <div className="bg-zinc-800/50 rounded-2xl rounded-bl-sm px-4 py-3">
          <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-mono">
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
