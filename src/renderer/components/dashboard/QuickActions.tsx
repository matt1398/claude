/**
 * QuickActions - Displays action buttons with keyboard shortcut hints.
 * Provides quick access to common operations from the dashboard.
 */

import { FolderOpen, Clock, Search } from 'lucide-react';

interface QuickAction {
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  action: () => void;
  disabled?: boolean;
}

export function QuickActions() {
  const quickActions: QuickAction[] = [
    {
      label: 'Open Project',
      shortcut: '⌘O',
      icon: FolderOpen,
      description: 'Browse and select a project',
      action: () => {
        // This will be implemented via keyboard shortcuts
        // For now, users can use the project dropdown
      },
      disabled: true,
    },
    {
      label: 'Recent Sessions',
      shortcut: '⌘R',
      icon: Clock,
      description: 'View recent activity',
      action: () => {
        // This will show in the sidebar when a project is selected
      },
      disabled: true,
    },
    {
      label: 'Search',
      shortcut: '⌘K',
      icon: Search,
      description: 'Search across projects',
      action: () => {
        // This will be implemented via keyboard shortcuts
      },
      disabled: true,
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-claude-dark-text-secondary mb-4">
        Quick Actions
      </h2>
      <div className="flex gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            disabled={action.disabled}
            className={`flex items-center gap-3 px-4 py-3 bg-claude-dark-surface border border-claude-dark-border rounded-lg transition-colors group ${
              action.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-claude-dark-bg cursor-pointer'
            }`}
            title={action.disabled ? `${action.description} (Coming soon)` : action.description}
          >
            <action.icon className={`w-5 h-5 text-claude-dark-text-secondary ${!action.disabled && 'group-hover:text-claude-dark-text'}`} />
            <span className="text-sm text-claude-dark-text">{action.label}</span>
            <span className="text-xs text-claude-dark-text-secondary ml-2 opacity-60">
              {action.shortcut}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
