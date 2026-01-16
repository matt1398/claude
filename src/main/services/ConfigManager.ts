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

const DEFAULT_CONFIG: AppConfig = {
  notifications: {
    enabled: true,
    soundEnabled: true,
    ignoredRegex: [...DEFAULT_IGNORED_REGEX],
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
   */
  private mergeWithDefaults(loaded: Partial<AppConfig>): AppConfig {
    return {
      notifications: {
        ...DEFAULT_CONFIG.notifications,
        ...(loaded.notifications || {}),
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
