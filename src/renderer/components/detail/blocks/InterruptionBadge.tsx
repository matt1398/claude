import React from 'react';
import { Zap } from 'lucide-react';

export const InterruptionBadge: React.FC = () => {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: 'var(--interruption-bg)',
        border: '1px solid var(--interruption-border)',
        color: 'var(--interruption-text)',
      }}
    >
      <div className="flex items-center gap-2">
        <Zap size={16} className="flex-shrink-0" />
        <span className="font-medium text-sm">INTERRUPTED BY USER</span>
      </div>
    </div>
  );
};
