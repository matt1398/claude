import { Clock, Layers } from 'lucide-react';

interface ChartModeToggleProps {
  mode: 'timeline' | 'context';
  onChange: (mode: 'timeline' | 'context') => void;
}

export const ChartModeToggle = ({ mode, onChange }: ChartModeToggleProps) => {
  return (
    <div className="inline-flex rounded-lg border border-claude-dark-border overflow-hidden">
      <button
        onClick={() => onChange('timeline')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
          transition-colors
          ${
            mode === 'timeline'
              ? 'bg-blue-600 text-white'
              : 'bg-claude-dark-surface text-claude-dark-text-secondary hover:text-claude-dark-text'
          }
        `}
      >
        <Clock className="w-4 h-4" />
        <span>Timeline</span>
      </button>

      <button
        onClick={() => onChange('context')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
          transition-colors border-l border-claude-dark-border
          ${
            mode === 'context'
              ? 'bg-blue-600 text-white'
              : 'bg-claude-dark-surface text-claude-dark-text-secondary hover:text-claude-dark-text'
          }
        `}
      >
        <Layers className="w-4 h-4" />
        <span>Context</span>
      </button>
    </div>
  );
};
