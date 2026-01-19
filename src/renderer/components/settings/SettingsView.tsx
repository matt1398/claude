/**
 * SettingsView - Main settings panel with all app configuration options.
 * Provides UI for managing notifications, display settings, and advanced options.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  RefreshCw,
  Download,
  Upload,
  Loader2,
  Rocket,
  Monitor,
  Palette,
  Bell,
  BellOff,
  Volume2,
  Clock,
  FolderX,
  Eye,
  Minimize2,
  Code,
  Settings,
  Info,
  ChevronDown,
  Check,
} from 'lucide-react';
import { SettingsTabs, type SettingsSection } from './SettingsTabs';
import { NotificationTriggerSettings } from './NotificationTriggerSettings';
import type { AppConfig, NotificationTrigger } from '../../types/data';
import { useStore } from '../../store';

// Get the setState function from the store to update appConfig globally
const setStoreState = useStore.setState;

// Snooze duration options
const SNOOZE_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: -1, label: 'Until tomorrow' },
] as const;

// Default tab options
const DEFAULT_TAB_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'last-session', label: 'Last Session' },
] as const;

// Theme options
const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

/**
 * Toggle switch component for boolean settings.
 * Modern design with smooth animations and accessibility support.
 */
function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!enabled);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={handleClick}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-claude-dark-bg
        ${enabled ? 'bg-blue-500' : 'bg-claude-dark-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg
          transform transition-transform duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

/**
 * Setting row component for consistent layout.
 * Supports an optional icon for better visual hierarchy.
 */
function SettingRow({
  label,
  description,
  icon: Icon,
  children,
}: {
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 group">
      <div className="flex items-start gap-3 flex-1 min-w-0 mr-4">
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-claude-dark-text-secondary group-hover:text-claude-dark-text transition-colors" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-claude-dark-text">{label}</p>
          {description && (
            <p className="text-xs text-claude-dark-text-secondary mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * Section header component with optional icon.
 */
function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-claude-dark-border/50">
      {Icon && <Icon className="w-4 h-4 text-claude-dark-text-secondary" />}
      <h3 className="text-xs font-semibold text-claude-dark-text-secondary uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

/**
 * Custom dropdown select component with styled dropdown menu.
 * Avoids browser default select styling for a consistent dark theme experience.
 */
function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current label
  const currentLabel = options.find(opt => opt.value === value)?.label || 'Select...';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 min-w-[140px] px-3 py-2 text-sm rounded-lg
          border border-claude-dark-border bg-claude-dark-surface text-claude-dark-text
          transition-all duration-150
          hover:border-claude-dark-text-secondary
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}
        `}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-claude-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 min-w-[160px] py-1 rounded-lg border border-claude-dark-border bg-claude-dark-surface shadow-xl shadow-black/20 overflow-hidden">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left
                transition-colors duration-100
                ${value === option.value
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-claude-dark-text hover:bg-claude-dark-border/50'
                }
              `}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Custom project select dropdown for adding ignored projects.
 */
function ProjectSelect({
  projects,
  onSelect,
  disabled = false,
}: {
  projects: { id: string; name: string }[];
  onSelect: (projectId: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (projectId: string) => {
    onSelect(projectId);
    setIsOpen(false);
  };

  if (projects.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-lg
          border border-claude-dark-border bg-claude-dark-surface text-claude-dark-text-secondary
          transition-all duration-150
          hover:border-claude-dark-text-secondary hover:text-claude-dark-text
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}
        `}
      >
        <span>Select project to ignore...</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto py-1 rounded-lg border border-claude-dark-border bg-claude-dark-surface shadow-xl shadow-black/20">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => handleSelect(project.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-claude-dark-text transition-colors duration-100 hover:bg-claude-dark-border/50"
            >
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pattern/Project list item with remove button.
 */
function ListItem({
  value,
  onRemove,
  disabled = false,
}: {
  value: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-claude-dark-bg/50 border border-claude-dark-border/50 rounded-lg mb-2 group hover:border-claude-dark-border transition-colors">
      <code className="text-sm text-claude-dark-text font-mono truncate flex-1 mr-2">
        {value}
      </code>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={`
          p-1.5 rounded-md transition-all duration-150
          text-claude-dark-text-secondary hover:text-red-400 hover:bg-red-500/10
          opacity-0 group-hover:opacity-100
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label={`Remove ${value}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function SettingsView() {
  const { projects, fetchProjects } = useStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local optimistic state for immediate visual feedback on toggles
  const [optimisticConfig, setOptimisticConfig] = useState<AppConfig | null>(null);

  // Fetch config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedConfig = await window.electronAPI.config.get();
        setConfig(loadedConfig);
        setOptimisticConfig(loadedConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Fetch projects for ignored projects dropdown
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  // Update a config section with optimistic update for immediate UI feedback
  const updateConfig = useCallback(async (
    section: keyof AppConfig,
    data: Partial<AppConfig[keyof AppConfig]>
  ) => {
    // Optimistic update - immediately reflect the change in UI
    setOptimisticConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          ...data,
        },
      };
    });

    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.update(section, data);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      // Update global store so other components (like useTheme) see the change
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      // Revert optimistic update on error
      setOptimisticConfig(config);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [config]);

  // Handle toggle changes for notifications
  const handleNotificationToggle = useCallback((key: keyof AppConfig['notifications'], value: boolean) => {
    updateConfig('notifications', { [key]: value });
  }, [updateConfig]);

  // Handle toggle changes for general
  const handleGeneralToggle = useCallback((key: keyof AppConfig['general'], value: boolean) => {
    updateConfig('general', { [key]: value });
  }, [updateConfig]);

  // Handle toggle changes for display
  const handleDisplayToggle = useCallback((key: keyof AppConfig['display'], value: boolean) => {
    updateConfig('display', { [key]: value });
  }, [updateConfig]);

  // Handle default tab change
  const handleDefaultTabChange = useCallback((value: 'dashboard' | 'last-session') => {
    updateConfig('general', { defaultTab: value });
  }, [updateConfig]);

  // Handle theme change
  const handleThemeChange = useCallback((value: 'dark' | 'light' | 'system') => {
    updateConfig('general', { theme: value });
  }, [updateConfig]);

  // Handle snooze
  const handleSnooze = useCallback(async (minutes: number) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.snooze(minutes);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to snooze notifications');
    } finally {
      setSaving(false);
    }
  }, []);

  // Clear snooze
  const handleClearSnooze = useCallback(async () => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.clearSnooze();
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear snooze');
    } finally {
      setSaving(false);
    }
  }, []);

  // Add ignored project
  const handleAddIgnoredProject = useCallback(async (projectId: string) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.addIgnoreProject(projectId);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setSaving(false);
    }
  }, []);

  // Remove ignored project
  const handleRemoveIgnoredProject = useCallback(async (projectId: string) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.removeIgnoreProject(projectId);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project');
    } finally {
      setSaving(false);
    }
  }, []);

  // Add trigger
  const handleAddTrigger = useCallback(async (trigger: Omit<NotificationTrigger, 'isBuiltin'>) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.addTrigger(trigger);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add trigger');
    } finally {
      setSaving(false);
    }
  }, []);

  // Update trigger
  const handleUpdateTrigger = useCallback(async (triggerId: string, updates: Partial<NotificationTrigger>) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.updateTrigger(triggerId, updates);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trigger');
    } finally {
      setSaving(false);
    }
  }, []);

  // Remove trigger
  const handleRemoveTrigger = useCallback(async (triggerId: string) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.removeTrigger(triggerId);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove trigger');
    } finally {
      setSaving(false);
    }
  }, []);

  // Reset to defaults
  const handleResetToDefaults = useCallback(async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }
    try {
      setSaving(true);
      // Reset each section to defaults
      // Note: These default ignored patterns match ConfigManager's DEFAULT_IGNORED_REGEX
      const defaultIgnoredRegex = [
        "The user doesn't want to proceed with this tool use\\.",
      ];
      // Note: These default triggers match ConfigManager's DEFAULT_TRIGGERS
      const defaultTriggers: NotificationTrigger[] = [
        {
          id: 'builtin-tool-result-error',
          name: 'Tool Result Error',
          enabled: true,
          contentType: 'tool_result',
          requireError: true,
          // No matchField needed for requireError=true
          ignorePatterns: [
            "The user doesn't want to proceed with this tool use\\.",
          ],
          isBuiltin: true,
        },
        {
          id: 'builtin-bash-command',
          name: 'Bash Command Alert',
          enabled: false,
          contentType: 'tool_use',
          toolName: 'Bash',
          matchField: 'command',
          matchPattern: '',  // User sets pattern like 'npm|sudo|rm -rf'
          isBuiltin: true,
        },
      ];
      const defaultConfig: AppConfig = {
        notifications: {
          enabled: true,
          soundEnabled: true,
          ignoredRegex: defaultIgnoredRegex,
          ignoredProjects: [],
          snoozedUntil: null,
          snoozeMinutes: 30,
          triggers: defaultTriggers,
        },
        general: {
          launchAtLogin: false,
          showDockIcon: true,
          theme: 'dark',
          defaultTab: 'dashboard',
        },
        display: {
          showTimestamps: true,
          compactMode: false,
          syntaxHighlighting: true,
        },
      };

      await window.electronAPI.config.update('notifications', defaultConfig.notifications);
      await window.electronAPI.config.update('general', defaultConfig.general);
      const updatedConfig = await window.electronAPI.config.update('display', defaultConfig.display);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
      setStoreState({ appConfig: updatedConfig });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  }, []);

  // Export config
  const handleExportConfig = useCallback(() => {
    if (!config) return;
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'claude-viz-config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [config]);

  // Import config
  const handleImportConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setSaving(true);
        const text = await file.text();
        const importedConfig = JSON.parse(text) as AppConfig;

        // Validate and apply imported config
        if (importedConfig.notifications) {
          await window.electronAPI.config.update('notifications', importedConfig.notifications);
        }
        if (importedConfig.general) {
          await window.electronAPI.config.update('general', importedConfig.general);
        }
        if (importedConfig.display) {
          await window.electronAPI.config.update('display', importedConfig.display);
        }

        const updatedConfig = await window.electronAPI.config.get();
        setConfig(updatedConfig);
        setOptimisticConfig(updatedConfig);
        setStoreState({ appConfig: updatedConfig });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import config');
      } finally {
        setSaving(false);
      }
    };
    input.click();
  }, []);

  // Get project name by ID
  const getProjectName = useCallback((projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || projectId;
  }, [projects]);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-claude-dark-bg">
        <div className="flex items-center gap-3 text-claude-dark-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !config) {
    return (
      <div className="flex-1 flex items-center justify-center bg-claude-dark-bg">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-claude-dark-surface text-claude-dark-text rounded-md hover:bg-claude-dark-border transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) return null;

  // Use optimistic config for UI display (falls back to config if not set)
  const displayConfig = optimisticConfig || config;

  // Create safe config with defaults to prevent null reference errors
  // Uses optimisticConfig for immediate visual feedback on toggle changes
  const safeConfig = {
    general: {
      launchAtLogin: displayConfig?.general?.launchAtLogin ?? false,
      showDockIcon: displayConfig?.general?.showDockIcon ?? true,
      theme: displayConfig?.general?.theme ?? 'dark',
      defaultTab: displayConfig?.general?.defaultTab ?? 'dashboard',
    },
    notifications: {
      enabled: displayConfig?.notifications?.enabled ?? true,
      soundEnabled: displayConfig?.notifications?.soundEnabled ?? true,
      ignoredRegex: displayConfig?.notifications?.ignoredRegex ?? [],
      ignoredProjects: displayConfig?.notifications?.ignoredProjects ?? [],
      snoozedUntil: displayConfig?.notifications?.snoozedUntil ?? null,
      snoozeMinutes: displayConfig?.notifications?.snoozeMinutes ?? 30,
      triggers: displayConfig?.notifications?.triggers ?? [],
    },
    display: {
      showTimestamps: displayConfig?.display?.showTimestamps ?? true,
      compactMode: displayConfig?.display?.compactMode ?? false,
      syntaxHighlighting: displayConfig?.display?.syntaxHighlighting ?? true,
    },
  };

  // Get available projects for dropdown (not already ignored)
  const availableProjects = projects.filter(
    (p) => !safeConfig.notifications.ignoredProjects.includes(p.id)
  );

  // Check if snoozed
  const isSnoozed = safeConfig.notifications.snoozedUntil !== null &&
    safeConfig.notifications.snoozedUntil > Date.now();

  return (
    <div className="flex-1 overflow-auto bg-claude-dark-bg">
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claude-dark-surface to-claude-dark-border flex items-center justify-center">
              <Settings className="w-5 h-5 text-claude-dark-text" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-claude-dark-text">Settings</h1>
              <p className="text-sm text-claude-dark-text-secondary">Manage your app preferences</p>
            </div>
          </div>
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <SettingsTabs
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Content */}
        <div className="mt-6">
          {/* General Section */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Startup" icon={Rocket} />
                <div className="space-y-1">
                  <SettingRow
                    label="Launch at login"
                    description="Automatically start the app when you log in"
                    icon={Rocket}
                  >
                    <Toggle
                      enabled={safeConfig.general.launchAtLogin}
                      onChange={(v) => handleGeneralToggle('launchAtLogin', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Show dock icon"
                    description="Display the app icon in the dock (macOS)"
                    icon={Monitor}
                  >
                    <Toggle
                      enabled={safeConfig.general.showDockIcon}
                      onChange={(v) => handleGeneralToggle('showDockIcon', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                </div>
              </div>

              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Appearance" icon={Palette} />
                <div className="space-y-1">
                  <SettingRow
                    label="Theme"
                    description="Choose your preferred color theme"
                    icon={Palette}
                  >
                    <Select
                      value={safeConfig.general.theme}
                      options={THEME_OPTIONS}
                      onChange={handleThemeChange}
                      disabled={saving}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Default tab on launch"
                    description="The view shown when the app opens"
                    icon={Monitor}
                  >
                    <Select
                      value={safeConfig.general.defaultTab}
                      options={DEFAULT_TAB_OPTIONS}
                      onChange={handleDefaultTabChange}
                      disabled={saving}
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              {/* Notification Triggers */}
              <NotificationTriggerSettings
                triggers={safeConfig.notifications.triggers || []}
                saving={saving}
                onUpdateTrigger={handleUpdateTrigger}
                onAddTrigger={handleAddTrigger}
                onRemoveTrigger={handleRemoveTrigger}
              />

              {/* Notification Settings */}
              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Notification Settings" icon={Bell} />
                <div className="space-y-1">
                  <SettingRow
                    label="Enable notifications"
                    description="Show system notifications for errors and events"
                    icon={Bell}
                  >
                    <Toggle
                      enabled={safeConfig.notifications.enabled}
                      onChange={(v) => handleNotificationToggle('enabled', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Play sound"
                    description="Play a sound when notifications appear"
                    icon={Volume2}
                  >
                    <Toggle
                      enabled={safeConfig.notifications.soundEnabled}
                      onChange={(v) => handleNotificationToggle('soundEnabled', v)}
                      disabled={saving || !safeConfig.notifications.enabled}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Snooze notifications"
                    description={isSnoozed
                      ? `Snoozed until ${new Date(safeConfig.notifications.snoozedUntil!).toLocaleTimeString()}`
                      : 'Temporarily pause notifications'
                    }
                    icon={isSnoozed ? BellOff : Clock}
                  >
                    <div className="flex items-center gap-2">
                      {isSnoozed ? (
                        <button
                          onClick={handleClearSnooze}
                          disabled={saving}
                          className={`
                            px-3 py-2 text-sm font-medium rounded-lg
                            bg-red-500/20 text-red-400
                            transition-all duration-150
                            hover:bg-red-500/30 hover:text-red-300
                            ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          Clear Snooze
                        </button>
                      ) : (
                        <Select
                          value={0}
                          options={[{ value: 0, label: 'Select duration...' }, ...SNOOZE_OPTIONS]}
                          onChange={(v) => v !== 0 && handleSnooze(v)}
                          disabled={saving || !safeConfig.notifications.enabled}
                        />
                      )}
                    </div>
                  </SettingRow>
                </div>
              </div>
              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Ignored Projects" icon={FolderX} />
                <p className="text-xs text-claude-dark-text-secondary mb-4">
                  Notifications from these projects will be ignored
                </p>
                {safeConfig.notifications.ignoredProjects.length > 0 ? (
                  <div className="mb-4">
                    {safeConfig.notifications.ignoredProjects.map((projectId) => (
                      <ListItem
                        key={projectId}
                        value={getProjectName(projectId)}
                        onRemove={() => handleRemoveIgnoredProject(projectId)}
                        disabled={saving}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mb-4 py-4 text-center border border-dashed border-claude-dark-border rounded-lg">
                    <p className="text-sm text-claude-dark-text-secondary">
                      No projects ignored
                    </p>
                  </div>
                )}
                <ProjectSelect
                  projects={availableProjects}
                  onSelect={handleAddIgnoredProject}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {/* Display Section */}
          {activeSection === 'display' && (
            <div className="space-y-6">
              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Display Options" icon={Eye} />
                <div className="space-y-1">
                  <SettingRow
                    label="Show timestamps"
                    description="Display timestamps in message views"
                    icon={Clock}
                  >
                    <Toggle
                      enabled={safeConfig.display.showTimestamps}
                      onChange={(v) => handleDisplayToggle('showTimestamps', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Compact mode"
                    description="Use a more compact display for messages"
                    icon={Minimize2}
                  >
                    <Toggle
                      enabled={safeConfig.display.compactMode}
                      onChange={(v) => handleDisplayToggle('compactMode', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Syntax highlighting"
                    description="Enable syntax highlighting in code blocks"
                    icon={Code}
                  >
                    <Toggle
                      enabled={safeConfig.display.syntaxHighlighting}
                      onChange={(v) => handleDisplayToggle('syntaxHighlighting', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Section */}
          {activeSection === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="Configuration" icon={Settings} />
                <div className="space-y-3">
                  <button
                    onClick={handleResetToDefaults}
                    disabled={saving}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-3
                      text-sm font-medium rounded-lg border border-claude-dark-border
                      bg-claude-dark-bg/50 text-claude-dark-text
                      transition-all duration-150
                      hover:bg-claude-dark-border hover:border-claude-dark-text-secondary
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset to Defaults
                  </button>
                  <button
                    onClick={handleExportConfig}
                    disabled={saving}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-3
                      text-sm font-medium rounded-lg border border-claude-dark-border
                      bg-claude-dark-bg/50 text-claude-dark-text
                      transition-all duration-150
                      hover:bg-claude-dark-border hover:border-claude-dark-text-secondary
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Download className="w-4 h-4" />
                    Export Config
                  </button>
                  <button
                    onClick={handleImportConfig}
                    disabled={saving}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-3
                      text-sm font-medium rounded-lg border border-claude-dark-border
                      bg-claude-dark-bg/50 text-claude-dark-text
                      transition-all duration-150
                      hover:bg-claude-dark-border hover:border-claude-dark-text-secondary
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Upload className="w-4 h-4" />
                    Import Config
                  </button>
                </div>
              </div>

              <div className="bg-claude-dark-surface rounded-xl p-5 shadow-sm">
                <SectionHeader title="About" icon={Info} />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl font-bold">CV</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-claude-dark-text">
                      Claude Code Visualizer
                    </p>
                    <p className="text-xs text-claude-dark-text-secondary mt-1">
                      Version 1.0.0
                    </p>
                    <p className="text-xs text-claude-dark-text-secondary mt-2 leading-relaxed">
                      Visualize and analyze Claude Code session executions with interactive waterfall charts and detailed insights.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 bg-claude-dark-surface border border-claude-dark-border rounded-xl shadow-xl backdrop-blur-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-claude-dark-text">Saving changes...</span>
          </div>
        )}
      </div>
    </div>
  );
}
