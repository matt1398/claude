import React from 'react';
import { Zap } from 'lucide-react';

export const InterruptionBadge: React.FC = () => {
  return (
    <div className="rounded-lg border bg-red-900/30 border-red-700 text-red-400 px-3 py-2">
      <div className="flex items-center gap-2">
        <Zap size={16} className="flex-shrink-0" />
        <span className="font-medium text-sm">INTERRUPTED BY USER</span>
      </div>
    </div>
  );
};
