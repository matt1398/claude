import { Settings, Bell, Monitor, Wrench } from 'lucide-react'

export type SettingsSection = 'general' | 'notifications' | 'display' | 'advanced'

export interface SettingsTabsProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

interface TabConfig {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const tabs: TabConfig[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'advanced', label: 'Advanced', icon: Wrench }
]

export function SettingsTabs({ activeSection, onSectionChange }: SettingsTabsProps) {
  return (
    <div className="flex border-b border-claude-dark-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeSection === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onSectionChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
              ${
                isActive
                  ? 'bg-claude-dark-surface text-claude-dark-text border-b-2 border-blue-500 -mb-px'
                  : 'text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface/50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
