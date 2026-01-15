import { format } from 'date-fns';
import type { CompactGroup } from '../../types/groups';

interface CompactBoundaryProps {
  compactGroup: CompactGroup;
}

/**
 * CompactBoundary displays a visual marker indicating where
 * the conversation was compacted.
 *
 * Renders as a full-width dark rectangle with centered "Compacted" text.
 */
export function CompactBoundary({ compactGroup }: CompactBoundaryProps) {
  const { timestamp } = compactGroup;

  return (
    <div className="my-4">
      {/* Full-width dark rectangle */}
      <div className="bg-zinc-900 rounded-lg py-4 px-6 text-center border border-zinc-800">
        <span className="text-zinc-300 font-medium text-sm">
          Compacted
        </span>
        <span className="text-zinc-600 text-xs ml-2">
          {format(timestamp, 'h:mm:ss a')}
        </span>
      </div>
    </div>
  );
}
