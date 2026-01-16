/**
 * SettingsView - Main settings panel with all app configuration options.
 * Provides UI for managing notifications, display settings, and advanced options.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, RefreshCw, Download, Upload, Loader2 } from 'lucide-react';
import { SettingsTabs, type SettingsSection } from './SettingsTabs';
import type { AppConfig } from '../../types/data';
import { useStore } from '../../store';

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
 * Uses inline styles for the dynamic parts to ensure immediate visual feedback.
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
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-claude-dark-bg"
      style={{
        backgroundColor: enabled ? '#3b82f6' : '#404040',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        style={{
          transform: enabled ? 'translateX(1.25rem)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

/**
 * Setting row component for consistent layout.
 */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-claude-dark-text">{label}</p>
        {description && (
          <p className="text-xs text-claude-dark-text-secondary mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * Section header component.
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-claude-dark-text-secondary uppercase tracking-wider mb-3">
      {title}
    </h3>
  );
}

/**
 * Dropdown select component.
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
  return (
    <select
      value={value}
      onChange={(e) => {
        const newValue = typeof value === 'number'
          ? Number(e.target.value) as T
          : e.target.value as T;
        onChange(newValue);
      }}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
        bg-claude-dark-surface text-claude-dark-text
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
    <div className="flex items-center justify-between py-2 px-3 bg-claude-dark-surface rounded-md mb-2">
      <code className="text-sm text-claude-dark-text font-mono truncate flex-1 mr-2">
        {value}
      </code>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={`
          p-1 rounded hover:bg-claude-dark-border transition-colors
          text-claude-dark-text-secondary hover:text-claude-dark-text
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label={`Remove ${value}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Add pattern input with button.
 */
function AddPatternInput({
  placeholder,
  onAdd,
  disabled = false,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          flex-1 px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
          bg-claude-dark-surface text-claude-dark-text placeholder-claude-dark-text-secondary
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={`
          flex items-center gap-1 px-3 py-1.5 text-sm rounded-md
          bg-blue-500 text-white hover:bg-blue-600 transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          focus:ring-offset-claude-dark-bg
          ${(disabled || !value.trim()) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <Plus className="w-4 h-4" />
        Add
      </button>
    </form>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear snooze');
    } finally {
      setSaving(false);
    }
  }, []);

  // Add ignored regex
  const handleAddIgnoredRegex = useCallback(async (pattern: string) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.addIgnoreRegex(pattern);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pattern');
    } finally {
      setSaving(false);
    }
  }, []);

  // Remove ignored regex
  const handleRemoveIgnoredRegex = useCallback(async (pattern: string) => {
    try {
      setSaving(true);
      const updatedConfig = await window.electronAPI.config.removeIgnoreRegex(pattern);
      setConfig(updatedConfig);
      setOptimisticConfig(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove pattern');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project');
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
      const defaultConfig: AppConfig = {
        notifications: {
          enabled: true,
          soundEnabled: true,
          ignoredRegex: [],
          ignoredProjects: [],
          snoozedUntil: null,
          snoozeMinutes: 30,
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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-claude-dark-text">Settings</h1>
          {error && (
            <p className="text-sm text-red-400 mt-2">{error}</p>
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
              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Startup" />
                <div className="divide-y divide-claude-dark-border">
                  <SettingRow
                    label="Launch at login"
                    description="Automatically start the app when you log in"
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
                  >
                    <Toggle
                      enabled={safeConfig.general.showDockIcon}
                      onChange={(v) => handleGeneralToggle('showDockIcon', v)}
                      disabled={saving}
                    />
                  </SettingRow>
                </div>
              </div>

              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Appearance" />
                <div className="divide-y divide-claude-dark-border">
                  <SettingRow
                    label="Theme"
                    description="Choose your preferred color theme"
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
              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Notification Settings" />
                <div className="divide-y divide-claude-dark-border">
                  <SettingRow
                    label="Enable notifications"
                    description="Show system notifications for errors and events"
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
                  >
                    <div className="flex items-center gap-2">
                      {isSnoozed ? (
                        <button
                          onClick={handleClearSnooze}
                          disabled={saving}
                          className={`
                            px-3 py-1.5 text-sm rounded-md
                            bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors
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

              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Ignored Patterns" />
                <p className="text-xs text-claude-dark-text-secondary mb-3">
                  Errors matching these regex patterns will be ignored
                </p>
                {safeConfig.notifications.ignoredRegex.length > 0 ? (
                  <div className="mb-3">
                    {safeConfig.notifications.ignoredRegex.map((pattern) => (
                      <ListItem
                        key={pattern}
                        value={pattern}
                        onRemove={() => handleRemoveIgnoredRegex(pattern)}
                        disabled={saving}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-claude-dark-text-secondary mb-3 italic">
                    No patterns configured
                  </p>
                )}
                <AddPatternInput
                  placeholder="Enter regex pattern (e.g., warning|deprecated)"
                  onAdd={handleAddIgnoredRegex}
                  disabled={saving}
                />
              </div>

              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Ignored Projects" />
                <p className="text-xs text-claude-dark-text-secondary mb-3">
                  Notifications from these projects will be ignored
                </p>
                {safeConfig.notifications.ignoredProjects.length > 0 ? (
                  <div className="mb-3">
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
                  <p className="text-sm text-claude-dark-text-secondary mb-3 italic">
                    No projects ignored
                  </p>
                )}
                {availableProjects.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddIgnoredProject(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      disabled={saving}
                      className={`
                        flex-1 px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                        bg-claude-dark-surface text-claude-dark-text
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <option value="">Select project to ignore...</option>
                      {availableProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Display Section */}
          {activeSection === 'display' && (
            <div className="space-y-6">
              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Display Options" />
                <div className="divide-y divide-claude-dark-border">
                  <SettingRow
                    label="Show timestamps"
                    description="Display timestamps in message views"
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
              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="Configuration" />
                <div className="space-y-3">
                  <button
                    onClick={handleResetToDefaults}
                    disabled={saving}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-2.5
                      text-sm rounded-md border border-claude-dark-border
                      bg-claude-dark-bg text-claude-dark-text
                      hover:bg-claude-dark-border transition-colors
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
                      w-full flex items-center justify-center gap-2 px-4 py-2.5
                      text-sm rounded-md border border-claude-dark-border
                      bg-claude-dark-bg text-claude-dark-text
                      hover:bg-claude-dark-border transition-colors
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
                      w-full flex items-center justify-center gap-2 px-4 py-2.5
                      text-sm rounded-md border border-claude-dark-border
                      bg-claude-dark-bg text-claude-dark-text
                      hover:bg-claude-dark-border transition-colors
                      ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Upload className="w-4 h-4" />
                    Import Config
                  </button>
                </div>
              </div>

              <div className="bg-claude-dark-surface rounded-lg p-4">
                <SectionHeader title="About" />
                <p className="text-sm text-claude-dark-text-secondary">
                  Claude Code Visualizer v1.0.0
                </p>
                <p className="text-xs text-claude-dark-text-secondary mt-1">
                  Visualize and analyze Claude Code session executions
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-claude-dark-surface rounded-lg shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-claude-dark-text">Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}
