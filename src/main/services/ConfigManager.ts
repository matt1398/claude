/**
 * ConfigManager service - Manages app configuration stored at ~/.claude/viz-config.json.
 *
 * Responsibilities:
 * - Load configuration from disk on initialization
 * - Provide default values for all configuration fields
 * - Save configuration changes to disk
 * - Manage notification settings (ignore patterns, projects, snooze)
 * - Handle JSON parse errors gracefully
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ===========================================================================
// Types
// ===========================================================================

export interface NotificationConfig {
  enabled: boolean;
  soundEnabled: boolean;
  ignoredRegex: string[];
  ignoredProjects: string[]; // Encoded project paths
  snoozedUntil: number | null; // Unix timestamp (ms) when snooze ends
  snoozeMinutes: number; // Default snooze duration
  /** Notification triggers - define when to generate notifications */
  triggers: NotificationTrigger[];
}

/**
 * Content types that can trigger notifications.
 */
export type TriggerContentType = 'tool_result' | 'tool_use' | 'thinking' | 'text';

/**
 * Tool names that can be filtered for tool_use triggers.
 */
export type TriggerToolName = 'Bash' | 'Task' | 'TodoWrite' | 'Read' | 'Write' | 'Edit' | 'Grep' | 'Glob' | 'WebFetch' | 'WebSearch' | 'LSP' | 'Skill' | 'NotebookEdit' | 'AskUserQuestion' | 'KillShell' | 'TaskOutput' | string;

/**
 * Match fields available for different content types and tools.
 */
export type MatchFieldForToolResult = 'content';
export type MatchFieldForBash = 'command' | 'description';
export type MatchFieldForTask = 'description' | 'prompt' | 'subagent_type';
export type MatchFieldForRead = 'file_path';
export type MatchFieldForWrite = 'file_path' | 'content';
export type MatchFieldForEdit = 'file_path' | 'old_string' | 'new_string';
export type MatchFieldForGlob = 'pattern' | 'path';
export type MatchFieldForGrep = 'pattern' | 'path' | 'glob';
export type MatchFieldForWebFetch = 'url' | 'prompt';
export type MatchFieldForWebSearch = 'query';
export type MatchFieldForTodoWrite = 'content';
export type MatchFieldForSkill = 'skill' | 'args';
export type MatchFieldForThinking = 'thinking';
export type MatchFieldForText = 'text';

/**
 * Combined type for all possible match fields.
 */
export type TriggerMatchField =
  | MatchFieldForToolResult
  | MatchFieldForBash
  | MatchFieldForTask
  | MatchFieldForRead
  | MatchFieldForWrite
  | MatchFieldForEdit
  | MatchFieldForGlob
  | MatchFieldForGrep
  | MatchFieldForWebFetch
  | MatchFieldForWebSearch
  | MatchFieldForTodoWrite
  | MatchFieldForSkill
  | MatchFieldForThinking
  | MatchFieldForText;

/**
 * Notification trigger configuration.
 * Defines when notifications should be generated.
 */
export interface NotificationTrigger {
  /** Unique identifier for this trigger */
  id: string;
  /** Human-readable name for this trigger */
  name: string;
  /** Whether this trigger is enabled */
  enabled: boolean;
  /** Content type to match */
  contentType: TriggerContentType;
  /** For tool_result triggers: require is_error to be true (no matchField needed when true) */
  requireError?: boolean;
  /** For tool_use/tool_result: specific tool name to match */
  toolName?: TriggerToolName;
  /** Field to match against - depends on contentType and toolName */
  matchField?: TriggerMatchField;
  /** Regex pattern to match (triggers if MATCHES) */
  matchPattern?: string;
  /** Regex patterns to IGNORE (skip notification if content matches any of these) */
  ignorePatterns?: string[];
  /** Whether this is a built-in trigger (cannot be deleted) */
  isBuiltin?: boolean;
}

export interface GeneralConfig {
  launchAtLogin: boolean;
  showDockIcon: boolean;
  theme: 'dark' | 'light' | 'system';
  defaultTab: 'dashboard' | 'last-session';
}

export interface DisplayConfig {
  showTimestamps: boolean;
  compactMode: boolean;
  syntaxHighlighting: boolean;
}

export interface AppConfig {
  notifications: NotificationConfig;
  general: GeneralConfig;
  display: DisplayConfig;
}

// Config section keys for type-safe updates
export type ConfigSection = keyof AppConfig;

// ===========================================================================
// Default Configuration
// ===========================================================================

// Default regex patterns for common non-actionable notifications
const DEFAULT_IGNORED_REGEX = [
  "The user doesn't want to proceed with this tool use\\.",
];

/**
 * Default built-in notification triggers.
 */
const DEFAULT_TRIGGERS: NotificationTrigger[] = [
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

const DEFAULT_CONFIG: AppConfig = {
  notifications: {
    enabled: true,
    soundEnabled: true,
    ignoredRegex: [...DEFAULT_IGNORED_REGEX],
    ignoredProjects: [],
    snoozedUntil: null,
    snoozeMinutes: 30,
    triggers: DEFAULT_TRIGGERS,
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

// ===========================================================================
// ConfigManager Class
// ===========================================================================

export class ConfigManager {
  private config: AppConfig;
  private readonly configPath: string;
  private static instance: ConfigManager | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.claude', 'viz-config.json');
    this.config = this.loadConfig();
  }

  // ===========================================================================
  // Singleton Pattern
  // ===========================================================================

  /**
   * Gets the singleton instance of ConfigManager.
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Resets the singleton instance (useful for testing).
   */
  static resetInstance(): void {
    ConfigManager.instance = null;
  }

  // ===========================================================================
  // Config Loading & Saving
  // ===========================================================================

  /**
   * Loads configuration from disk.
   * Returns default config if file doesn't exist or is invalid.
   */
  private loadConfig(): AppConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log('ConfigManager: No config file found, using defaults');
        return this.deepClone(DEFAULT_CONFIG);
      }

      const content = fs.readFileSync(this.configPath, 'utf8');
      const parsed = JSON.parse(content);

      // Merge with defaults to ensure all fields exist
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      console.error('ConfigManager: Error loading config, using defaults:', error);
      return this.deepClone(DEFAULT_CONFIG);
    }
  }

  /**
   * Saves the current configuration to disk.
   */
  private saveConfig(): void {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const content = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf8');
      console.log('ConfigManager: Config saved');
    } catch (error) {
      console.error('ConfigManager: Error saving config:', error);
    }
  }

  /**
   * Merges loaded config with defaults to ensure all fields exist.
   * Special handling for triggers array to preserve existing triggers
   * and add any missing builtin triggers.
   */
  private mergeWithDefaults(loaded: Partial<AppConfig>): AppConfig {
    const loadedNotifications = loaded.notifications || {} as Partial<NotificationConfig>;
    const loadedTriggers = loadedNotifications.triggers || [];

    // Merge triggers: preserve existing triggers, add missing builtin ones
    const mergedTriggers = this.mergeTriggers(loadedTriggers, DEFAULT_TRIGGERS);

    return {
      notifications: {
        ...DEFAULT_CONFIG.notifications,
        ...loadedNotifications,
        triggers: mergedTriggers,
      },
      general: {
        ...DEFAULT_CONFIG.general,
        ...(loaded.general || {}),
      },
      display: {
        ...DEFAULT_CONFIG.display,
        ...(loaded.display || {}),
      },
    };
  }

  /**
   * Merges loaded triggers with default triggers.
   * - Preserves all existing triggers (including user-modified builtin triggers)
   * - Adds any missing builtin triggers from defaults
   */
  private mergeTriggers(
    loaded: NotificationTrigger[],
    defaults: NotificationTrigger[]
  ): NotificationTrigger[] {
    // Start with all loaded triggers
    const merged = [...loaded];

    // Add any missing builtin triggers from defaults
    for (const defaultTrigger of defaults) {
      if (defaultTrigger.isBuiltin) {
        const existsInLoaded = loaded.some(t => t.id === defaultTrigger.id);
        if (!existsInLoaded) {
          merged.push(defaultTrigger);
        }
      }
    }

    return merged;
  }

  /**
   * Deep clones an object.
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // ===========================================================================
  // Config Access
  // ===========================================================================

  /**
   * Gets the full configuration object.
   */
  getConfig(): AppConfig {
    return this.deepClone(this.config);
  }

  /**
   * Gets the configuration file path.
   */
  getConfigPath(): string {
    return this.configPath;
  }

  // ===========================================================================
  // Config Updates
  // ===========================================================================

  /**
   * Updates a section of the configuration.
   * @param section - The config section to update ('notifications', 'general', 'display')
   * @param data - Partial data to merge into the section
   */
  updateConfig<K extends ConfigSection>(section: K, data: Partial<AppConfig[K]>): AppConfig {
    this.config[section] = {
      ...this.config[section],
      ...data,
    };
    this.saveConfig();
    return this.getConfig();
  }

  // ===========================================================================
  // Notification Ignore Regex Management
  // ===========================================================================

  /**
   * Adds a regex pattern to the ignore list.
   * @param pattern - Regex pattern string to add
   * @returns Updated config
   */
  addIgnoreRegex(pattern: string): AppConfig {
    if (!pattern || pattern.trim().length === 0) {
      return this.getConfig();
    }

    const trimmedPattern = pattern.trim();

    // Validate regex pattern
    try {
      new RegExp(trimmedPattern);
    } catch (error) {
      console.error('ConfigManager: Invalid regex pattern:', trimmedPattern);
      return this.getConfig();
    }

    // Check for duplicates
    if (this.config.notifications.ignoredRegex.includes(trimmedPattern)) {
      return this.getConfig();
    }

    this.config.notifications.ignoredRegex.push(trimmedPattern);
    this.saveConfig();
    return this.getConfig();
  }

  /**
   * Removes a regex pattern from the ignore list.
   * @param pattern - Regex pattern string to remove
   * @returns Updated config
   */
  removeIgnoreRegex(pattern: string): AppConfig {
    const index = this.config.notifications.ignoredRegex.indexOf(pattern);
    if (index !== -1) {
      this.config.notifications.ignoredRegex.splice(index, 1);
      this.saveConfig();
    }
    return this.getConfig();
  }

  // ===========================================================================
  // Notification Ignore Project Management
  // ===========================================================================

  /**
   * Adds a project to the ignore list.
   * @param projectId - Encoded project path to add
   * @returns Updated config
   */
  addIgnoreProject(projectId: string): AppConfig {
    if (!projectId || projectId.trim().length === 0) {
      return this.getConfig();
    }

    const trimmedProjectId = projectId.trim();

    // Check for duplicates
    if (this.config.notifications.ignoredProjects.includes(trimmedProjectId)) {
      return this.getConfig();
    }

    this.config.notifications.ignoredProjects.push(trimmedProjectId);
    this.saveConfig();
    return this.getConfig();
  }

  /**
   * Removes a project from the ignore list.
   * @param projectId - Encoded project path to remove
   * @returns Updated config
   */
  removeIgnoreProject(projectId: string): AppConfig {
    const index = this.config.notifications.ignoredProjects.indexOf(projectId);
    if (index !== -1) {
      this.config.notifications.ignoredProjects.splice(index, 1);
      this.saveConfig();
    }
    return this.getConfig();
  }

  // ===========================================================================
  // Trigger Management
  // ===========================================================================

  /**
   * Adds a new notification trigger.
   * @param trigger - The trigger configuration to add
   * @returns Updated config
   */
  addTrigger(trigger: NotificationTrigger): AppConfig {
    const current = this.config.notifications.triggers || [];

    // Check if trigger with same ID already exists
    if (current.some(t => t.id === trigger.id)) {
      throw new Error(`Trigger with ID "${trigger.id}" already exists`);
    }

    this.config.notifications.triggers = [...current, trigger];
    this.saveConfig();
    return this.deepClone(this.config);
  }

  /**
   * Updates an existing notification trigger.
   * @param triggerId - ID of the trigger to update
   * @param updates - Partial trigger configuration to apply
   * @returns Updated config
   */
  updateTrigger(triggerId: string, updates: Partial<NotificationTrigger>): AppConfig {
    const current = this.config.notifications.triggers || [];
    const index = current.findIndex(t => t.id === triggerId);

    if (index === -1) {
      throw new Error(`Trigger with ID "${triggerId}" not found`);
    }

    // Preserve isBuiltin flag - cannot be changed
    const { isBuiltin, ...allowedUpdates } = updates;

    this.config.notifications.triggers = current.map((t, i) =>
      i === index ? { ...t, ...allowedUpdates } : t
    );
    this.saveConfig();
    return this.deepClone(this.config);
  }

  /**
   * Removes a notification trigger.
   * Built-in triggers cannot be removed.
   * @param triggerId - ID of the trigger to remove
   * @returns Updated config
   */
  removeTrigger(triggerId: string): AppConfig {
    const current = this.config.notifications.triggers || [];
    const trigger = current.find(t => t.id === triggerId);

    if (!trigger) {
      throw new Error(`Trigger with ID "${triggerId}" not found`);
    }

    if (trigger.isBuiltin) {
      throw new Error('Cannot remove built-in triggers. Disable them instead.');
    }

    this.config.notifications.triggers = current.filter(t => t.id !== triggerId);
    this.saveConfig();
    return this.deepClone(this.config);
  }

  /**
   * Gets all notification triggers.
   * @returns Array of notification triggers
   */
  getTriggers(): NotificationTrigger[] {
    return this.deepClone(this.config.notifications.triggers || DEFAULT_TRIGGERS);
  }

  /**
   * Gets enabled notification triggers only.
   * @returns Array of enabled notification triggers
   */
  getEnabledTriggers(): NotificationTrigger[] {
    const triggers = this.config.notifications.triggers || DEFAULT_TRIGGERS;
    return this.deepClone(triggers.filter(t => t.enabled));
  }

  // ===========================================================================
  // Snooze Management
  // ===========================================================================

  /**
   * Sets the snooze period for notifications.
   * Alias: snooze()
   * @param minutes - Number of minutes to snooze (uses config default if not provided)
   * @returns Updated config
   */
  setSnooze(minutes?: number): AppConfig {
    const snoozeMinutes = minutes ?? this.config.notifications.snoozeMinutes;
    const snoozedUntil = Date.now() + snoozeMinutes * 60 * 1000;

    this.config.notifications.snoozedUntil = snoozedUntil;
    this.saveConfig();

    console.log(`ConfigManager: Notifications snoozed until ${new Date(snoozedUntil).toISOString()}`);
    return this.getConfig();
  }

  /**
   * Alias for setSnooze() for convenience.
   */
  snooze(minutes?: number): AppConfig {
    return this.setSnooze(minutes);
  }

  /**
   * Clears the snooze period, re-enabling notifications.
   * @returns Updated config
   */
  clearSnooze(): AppConfig {
    this.config.notifications.snoozedUntil = null;
    this.saveConfig();

    console.log('ConfigManager: Snooze cleared');
    return this.getConfig();
  }

  /**
   * Checks if notifications are currently snoozed.
   * Automatically clears expired snooze.
   * @returns true if currently snoozed, false otherwise
   */
  isSnoozed(): boolean {
    const snoozedUntil = this.config.notifications.snoozedUntil;

    if (snoozedUntil === null) {
      return false;
    }

    // Check if snooze has expired
    if (Date.now() >= snoozedUntil) {
      // Auto-clear expired snooze
      this.config.notifications.snoozedUntil = null;
      this.saveConfig();
      return false;
    }

    return true;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Resets configuration to defaults.
   * @returns Updated config
   */
  resetToDefaults(): AppConfig {
    this.config = this.deepClone(DEFAULT_CONFIG);
    this.saveConfig();
    console.log('ConfigManager: Config reset to defaults');
    return this.getConfig();
  }

  /**
   * Reloads configuration from disk.
   * Useful if config was modified externally.
   * @returns Updated config
   */
  reload(): AppConfig {
    this.config = this.loadConfig();
    console.log('ConfigManager: Config reloaded from disk');
    return this.getConfig();
  }
}

// ===========================================================================
// Singleton Export
// ===========================================================================

/** Singleton instance for convenience */
export const configManager = ConfigManager.getInstance();
