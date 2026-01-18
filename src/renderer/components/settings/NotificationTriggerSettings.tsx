/**
 * NotificationTriggerSettings - Component for managing notification triggers.
 * Allows users to configure when notifications should be generated.
 */

import { useState, useCallback } from 'react';
import { Plus, X, Loader2, AlertCircle, Terminal, ChevronDown, ChevronUp, Shield, Pencil } from 'lucide-react';
import type { NotificationTrigger, TriggerContentType, TriggerToolName, TriggerMatchField, TriggerTestResult } from '../../types/data';
import { useStore } from '../../store';

interface NotificationTriggerSettingsProps {
  triggers: NotificationTrigger[];
  saving: boolean;
  onUpdateTrigger: (triggerId: string, updates: Partial<NotificationTrigger>) => Promise<void>;
  onAddTrigger: (trigger: Omit<NotificationTrigger, 'isBuiltin'>) => Promise<void>;
  onRemoveTrigger: (triggerId: string) => Promise<void>;
}

// Content type options for dropdown
const CONTENT_TYPE_OPTIONS: { value: TriggerContentType; label: string }[] = [
  { value: 'tool_result', label: 'Tool Result' },
  { value: 'tool_use', label: 'Tool Use' },
  { value: 'thinking', label: 'Thinking' },
  { value: 'text', label: 'Text Output' },
];

// Tool name options for dropdown
const TOOL_NAME_OPTIONS: { value: TriggerToolName | ''; label: string }[] = [
  { value: '', label: 'Any Tool' },
  { value: 'Bash', label: 'Bash' },
  { value: 'Task', label: 'Task' },
  { value: 'Read', label: 'Read' },
  { value: 'Write', label: 'Write' },
  { value: 'Edit', label: 'Edit' },
  { value: 'Grep', label: 'Grep' },
  { value: 'Glob', label: 'Glob' },
  { value: 'WebFetch', label: 'WebFetch' },
  { value: 'WebSearch', label: 'WebSearch' },
  { value: 'LSP', label: 'LSP' },
  { value: 'TodoWrite', label: 'TodoWrite' },
  { value: 'Skill', label: 'Skill' },
  { value: 'NotebookEdit', label: 'NotebookEdit' },
  { value: 'AskUserQuestion', label: 'AskUserQuestion' },
  { value: 'KillShell', label: 'KillShell' },
  { value: 'TaskOutput', label: 'TaskOutput' },
];

/**
 * Get available match fields based on content type and tool name.
 */
function getAvailableMatchFields(contentType: TriggerContentType, toolName?: string): { value: string; label: string }[] {
  if (contentType === 'tool_result') {
    return [{ value: 'content', label: 'Content' }];
  }

  if (contentType === 'thinking') {
    return [{ value: 'thinking', label: 'Thinking Content' }];
  }

  if (contentType === 'text') {
    return [{ value: 'text', label: 'Text Content' }];
  }

  if (contentType === 'tool_use') {
    switch (toolName) {
      case 'Bash':
        return [
          { value: 'command', label: 'Command' },
          { value: 'description', label: 'Description' },
        ];
      case 'Task':
        return [
          { value: 'description', label: 'Description' },
          { value: 'prompt', label: 'Prompt' },
          { value: 'subagent_type', label: 'Subagent Type' },
        ];
      case 'Read':
      case 'Write':
        return [{ value: 'file_path', label: 'File Path' }];
      case 'Edit':
        return [
          { value: 'file_path', label: 'File Path' },
          { value: 'old_string', label: 'Old String' },
          { value: 'new_string', label: 'New String' },
        ];
      case 'Glob':
        return [
          { value: 'pattern', label: 'Pattern' },
          { value: 'path', label: 'Path' },
        ];
      case 'Grep':
        return [
          { value: 'pattern', label: 'Pattern' },
          { value: 'path', label: 'Path' },
          { value: 'glob', label: 'Glob Filter' },
        ];
      case 'WebFetch':
        return [
          { value: 'url', label: 'URL' },
          { value: 'prompt', label: 'Prompt' },
        ];
      case 'WebSearch':
        return [{ value: 'query', label: 'Query' }];
      case 'Skill':
        return [
          { value: 'skill', label: 'Skill Name' },
          { value: 'args', label: 'Arguments' },
        ];
      default:
        return [];
    }
  }

  return [];
}

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
 * Generates a UUID v4 for new triggers.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Preview result state for a trigger test.
 */
interface PreviewResult {
  loading: boolean;
  totalCount: number;
  errors: TriggerTestResult['errors'];
}

/**
 * Individual trigger card component.
 */
function TriggerCard({
  trigger,
  saving,
  onUpdate,
  onRemove,
}: {
  trigger: NotificationTrigger;
  saving: boolean;
  onUpdate: (updates: Partial<NotificationTrigger>) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(trigger.name);
  const [localPattern, setLocalPattern] = useState(trigger.matchPattern || '');
  const [patternError, setPatternError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  // Get navigateToError from store for View Session functionality
  const navigateToError = useStore(state => state.navigateToError);

  // Validate regex pattern
  const validatePattern = (pattern: string): boolean => {
    if (!pattern) {
      setPatternError(null);
      return true;
    }
    try {
      new RegExp(pattern);
      setPatternError(null);
      return true;
    } catch {
      setPatternError('Invalid regex pattern');
      return false;
    }
  };

  const handleToggleEnabled = useCallback(() => {
    onUpdate({ enabled: !trigger.enabled });
  }, [trigger.enabled, onUpdate]);

  const handleNameSave = useCallback(() => {
    if (localName.trim() && localName !== trigger.name) {
      onUpdate({ name: localName.trim() });
    }
    setEditingName(false);
  }, [localName, trigger.name, onUpdate]);

  const handlePatternBlur = useCallback(() => {
    if (validatePattern(localPattern) && localPattern !== trigger.matchPattern) {
      onUpdate({ matchPattern: localPattern });
    }
  }, [localPattern, trigger.matchPattern, onUpdate]);

  const handleContentTypeChange = useCallback((value: TriggerContentType) => {
    onUpdate({ contentType: value });
  }, [onUpdate]);

  const handleToolNameChange = useCallback((value: string) => {
    onUpdate({ toolName: value || undefined });
  }, [onUpdate]);

  const handleMatchFieldChange = useCallback((value: string) => {
    onUpdate({ matchField: value as TriggerMatchField });
  }, [onUpdate]);

  const handleAddIgnorePattern = useCallback((pattern: string) => {
    const newPatterns = [...(trigger.ignorePatterns || []), pattern];
    onUpdate({ ignorePatterns: newPatterns });
  }, [trigger.ignorePatterns, onUpdate]);

  const handleRemoveIgnorePattern = useCallback((index: number) => {
    const newPatterns = [...(trigger.ignorePatterns || [])];
    newPatterns.splice(index, 1);
    onUpdate({ ignorePatterns: newPatterns });
  }, [trigger.ignorePatterns, onUpdate]);

  // Get available match fields based on content type and tool name
  const availableMatchFields = getAvailableMatchFields(trigger.contentType, trigger.toolName);

  // Check if this is a tool_result trigger with requireError (no match field needed)
  const isErrorOnlyTrigger = trigger.contentType === 'tool_result' && trigger.requireError;

  const handleRequireErrorToggle = useCallback(() => {
    onUpdate({ requireError: !trigger.requireError });
  }, [trigger.requireError, onUpdate]);

  // Test trigger against historical data
  const handleTestTrigger = useCallback(async () => {
    setPreviewResult({ loading: true, totalCount: 0, errors: [] });

    try {
      const result = await window.electronAPI.config.testTrigger(trigger);
      setPreviewResult({
        loading: false,
        totalCount: result.totalCount,
        errors: result.errors,
      });
    } catch (error) {
      console.error('Failed to test trigger:', error);
      setPreviewResult(null);
    }
  }, [trigger]);

  // Handle View Session click - navigate to the error location
  const handleViewSession = useCallback((error: TriggerTestResult['errors'][0]) => {
    // Convert to DetectedError format for navigation
    navigateToError({
      id: error.id,
      sessionId: error.sessionId,
      projectId: error.projectId,
      message: error.message,
      timestamp: error.timestamp,
      source: error.source,
      filePath: '',
      context: error.context,
      isRead: true,
      createdAt: error.timestamp,
    });
  }, [navigateToError]);

  return (
    <div className="bg-claude-dark-surface rounded-lg border border-claude-dark-border overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Toggle */}
        <Toggle
          enabled={trigger.enabled}
          onChange={handleToggleEnabled}
          disabled={saving}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          {editingName && !trigger.isBuiltin ? (
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setLocalName(trigger.name);
                  setEditingName(false);
                }
              }}
              autoFocus
              className="w-full px-2 py-1 text-sm rounded border border-claude-dark-border bg-claude-dark-bg text-claude-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-claude-dark-text truncate">
                {trigger.name}
              </span>
              {trigger.isBuiltin && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                  <Shield className="w-3 h-3" />
                  Builtin
                </span>
              )}
              {!trigger.isBuiltin && (
                <button
                  onClick={() => setEditingName(true)}
                  disabled={saving}
                  className="p-1 rounded hover:bg-claude-dark-border transition-colors text-claude-dark-text-secondary hover:text-claude-dark-text"
                  aria-label="Edit name"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content type badge */}
        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-claude-dark-border text-claude-dark-text-secondary">
          <Terminal className="w-3 h-3" />
          {CONTENT_TYPE_OPTIONS.find(o => o.value === trigger.contentType)?.label || trigger.contentType}
        </span>

        {/* Expand/collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-claude-dark-border transition-colors text-claude-dark-text-secondary hover:text-claude-dark-text"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Delete button (only for custom triggers) */}
        {!trigger.isBuiltin && (
          <button
            onClick={onRemove}
            disabled={saving}
            className={`
              p-1 rounded hover:bg-red-500/20 transition-colors
              text-claude-dark-text-secondary hover:text-red-400
              ${saving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            aria-label="Delete trigger"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-claude-dark-border p-4 space-y-4 bg-claude-dark-bg/50">
          {/* Content Type */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-claude-dark-text-secondary">Content Type</label>
            <select
              value={trigger.contentType}
              onChange={(e) => handleContentTypeChange(e.target.value as TriggerContentType)}
              disabled={saving}
              className={`
                px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                bg-claude-dark-surface text-claude-dark-text
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tool Name (for tool_use and tool_result) */}
          {(trigger.contentType === 'tool_use' || trigger.contentType === 'tool_result') && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-claude-dark-text-secondary">Tool Name</label>
              <select
                value={trigger.toolName || ''}
                onChange={(e) => handleToolNameChange(e.target.value)}
                disabled={saving}
                className={`
                  px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                  bg-claude-dark-surface text-claude-dark-text
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {TOOL_NAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Require Error (for tool_result) */}
          {trigger.contentType === 'tool_result' && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-claude-dark-text">Require Error</label>
                <p className="text-xs text-claude-dark-text-secondary">Only trigger when is_error is true</p>
              </div>
              <Toggle
                enabled={trigger.requireError || false}
                onChange={handleRequireErrorToggle}
                disabled={saving}
              />
            </div>
          )}

          {/* Error-only trigger description */}
          {isErrorOnlyTrigger && (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-400">
                Triggers on any tool result with is_error: true
              </p>
            </div>
          )}

          {/* Match Field - only show when not error-only and when options are available */}
          {!isErrorOnlyTrigger && availableMatchFields.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-claude-dark-text-secondary">Match Field</label>
              <select
                value={trigger.matchField || availableMatchFields[0]?.value || ''}
                onChange={(e) => handleMatchFieldChange(e.target.value)}
                disabled={saving}
                className={`
                  px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                  bg-claude-dark-surface text-claude-dark-text
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {availableMatchFields.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Match Pattern - only show when match field is set and not error-only */}
          {!isErrorOnlyTrigger && trigger.matchField && (
            <div className="space-y-2">
              <label className="text-sm text-claude-dark-text-secondary">Match Pattern (Regex)</label>
              <input
                type="text"
                value={localPattern}
                onChange={(e) => {
                  setLocalPattern(e.target.value);
                  validatePattern(e.target.value);
                }}
                onBlur={handlePatternBlur}
                placeholder="e.g., error|failed|exception"
                disabled={saving}
                className={`
                  w-full px-3 py-1.5 text-sm rounded-md border font-mono
                  bg-claude-dark-surface text-claude-dark-text placeholder-claude-dark-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${patternError ? 'border-red-500' : 'border-claude-dark-border'}
                  ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              />
              {patternError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {patternError}
                </p>
              )}
              <p className="text-xs text-claude-dark-text-secondary">
                Leave empty to match all content. Uses JavaScript regex syntax.
              </p>
            </div>
          )}

          {/* Ignore Patterns Section */}
          <div className="mt-3">
            <label className="text-xs text-claude-dark-text-secondary block mb-2">
              Ignore Patterns (skip if matches)
            </label>
            {(trigger.ignorePatterns || []).map((pattern, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <code className="flex-1 text-xs px-2 py-1 bg-claude-dark-bg rounded truncate font-mono">
                  {pattern}
                </code>
                <button
                  type="button"
                  onClick={() => handleRemoveIgnorePattern(idx)}
                  disabled={saving}
                  className={`
                    p-1 text-red-400 hover:bg-red-500/20 rounded
                    ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  aria-label="Remove ignore pattern"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {/* Add ignore pattern input */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Add ignore regex..."
                disabled={saving}
                className={`
                  flex-1 px-2 py-1 text-xs rounded border border-claude-dark-border
                  bg-claude-dark-bg text-claude-dark-text font-mono
                  placeholder-claude-dark-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    // Validate regex before adding
                    try {
                      new RegExp(e.currentTarget.value.trim());
                      handleAddIgnorePattern(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    } catch {
                      // Invalid regex - could show an error here if desired
                    }
                  }
                }}
              />
            </div>
            <p className="text-xs text-claude-dark-text-secondary mt-1">
              Press Enter to add. Notification is skipped if any pattern matches.
            </p>
          </div>

          {/* Preview Section */}
          <div className="mt-4 pt-4 border-t border-claude-dark-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-claude-dark-text-secondary">Preview</span>
              <button
                onClick={handleTestTrigger}
                disabled={previewResult?.loading}
                className={`
                  text-xs px-2 py-1 rounded bg-claude-dark-bg hover:bg-claude-dark-border
                  text-claude-dark-text transition-colors
                  ${previewResult?.loading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {previewResult?.loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Testing...
                  </span>
                ) : (
                  'Test Trigger'
                )}
              </button>
            </div>

            {previewResult && !previewResult.loading && (
              <div className="space-y-2">
                <p className="text-sm text-claude-dark-text">
                  <span className="font-medium text-blue-400">
                    {previewResult.totalCount}
                  </span>{' '}
                  errors would have been detected
                </p>

                {previewResult.errors.slice(0, 10).map((error, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-claude-dark-bg rounded text-xs"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="text-claude-dark-text-secondary">
                        {error.context.projectName}
                      </span>
                      <span className="mx-1 text-claude-dark-border">|</span>
                      <span className="text-claude-dark-text truncate">
                        {error.message.length > 60
                          ? `${error.message.slice(0, 60)}...`
                          : error.message}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewSession(error)}
                      className="flex-shrink-0 px-2 py-1 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                    >
                      View Session
                    </button>
                  </div>
                ))}

                {previewResult.totalCount > 10 && (
                  <p className="text-xs text-claude-dark-text-secondary">
                    ...and {previewResult.totalCount - 10} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Form to add a new custom trigger.
 */
function AddTriggerForm({
  saving,
  onAdd,
}: {
  saving: boolean;
  onAdd: (trigger: Omit<NotificationTrigger, 'isBuiltin'>) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState('');
  const [contentType, setContentType] = useState<TriggerContentType>('tool_result');
  const [toolName, setToolName] = useState<string>('');
  const [matchField, setMatchField] = useState<string>('content');
  const [matchPattern, setMatchPattern] = useState('');
  const [requireError, setRequireError] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);

  // Get available match fields based on content type and tool name
  const availableMatchFields = getAvailableMatchFields(contentType, toolName || undefined);

  // Check if this is an error-only trigger
  const isErrorOnlyTrigger = contentType === 'tool_result' && requireError;

  const validatePattern = (pattern: string): boolean => {
    if (!pattern) {
      setPatternError(null);
      return true;
    }
    try {
      new RegExp(pattern);
      setPatternError(null);
      return true;
    } catch {
      setPatternError('Invalid regex pattern');
      return false;
    }
  };

  const resetForm = () => {
    setName('');
    setContentType('tool_result');
    setToolName('');
    setMatchField('content');
    setMatchPattern('');
    setRequireError(false);
    setPatternError(null);
    setIgnorePatterns([]);
  };

  // When content type changes, reset matchField to first available option
  const handleContentTypeChange = (newContentType: TriggerContentType) => {
    setContentType(newContentType);
    const newMatchFields = getAvailableMatchFields(newContentType, toolName || undefined);
    setMatchField(newMatchFields[0]?.value || '');
    // Reset tool name if not applicable
    if (newContentType !== 'tool_use' && newContentType !== 'tool_result') {
      setToolName('');
    }
    // Reset require error if not tool_result
    if (newContentType !== 'tool_result') {
      setRequireError(false);
    }
  };

  // When tool name changes, reset matchField to first available option
  const handleToolNameChange = (newToolName: string) => {
    setToolName(newToolName);
    const newMatchFields = getAvailableMatchFields(contentType, newToolName || undefined);
    setMatchField(newMatchFields[0]?.value || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!validatePattern(matchPattern)) return;

    const newTrigger: Omit<NotificationTrigger, 'isBuiltin'> = {
      id: `custom-${generateId()}`,
      name: name.trim(),
      enabled: true,
      contentType,
      ...(matchField && !isErrorOnlyTrigger && { matchField: matchField as TriggerMatchField }),
      ...(matchPattern && !isErrorOnlyTrigger && { matchPattern }),
      ...((contentType === 'tool_use' || contentType === 'tool_result') && toolName && { toolName }),
      ...(contentType === 'tool_result' && { requireError }),
      ...(ignorePatterns.length > 0 && { ignorePatterns }),
    };

    await onAdd(newTrigger);
    resetForm();
    setIsExpanded(false);
  };

  return (
    <div className="bg-claude-dark-surface rounded-lg border border-claude-dark-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-claude-dark-border/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-claude-dark-text">Add Custom Trigger</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-claude-dark-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-claude-dark-text-secondary" />
        )}
      </button>

      {/* Form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="border-t border-claude-dark-border p-4 space-y-4 bg-claude-dark-bg/50">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm text-claude-dark-text-secondary">Trigger Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Build Failure Alert"
              disabled={saving}
              required
              className={`
                w-full px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                bg-claude-dark-surface text-claude-dark-text placeholder-claude-dark-text-secondary
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${saving ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />
          </div>

          {/* Content Type */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-claude-dark-text-secondary">Content Type</label>
            <select
              value={contentType}
              onChange={(e) => handleContentTypeChange(e.target.value as TriggerContentType)}
              disabled={saving}
              className={`
                px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                bg-claude-dark-surface text-claude-dark-text
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tool Name (for tool_use and tool_result) */}
          {(contentType === 'tool_use' || contentType === 'tool_result') && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-claude-dark-text-secondary">Tool Name</label>
              <select
                value={toolName}
                onChange={(e) => handleToolNameChange(e.target.value)}
                disabled={saving}
                className={`
                  px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                  bg-claude-dark-surface text-claude-dark-text
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {TOOL_NAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Require Error (for tool_result) */}
          {contentType === 'tool_result' && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-claude-dark-text">Require Error</label>
                <p className="text-xs text-claude-dark-text-secondary">Only trigger when is_error is true</p>
              </div>
              <Toggle
                enabled={requireError}
                onChange={setRequireError}
                disabled={saving}
              />
            </div>
          )}

          {/* Error-only trigger description */}
          {isErrorOnlyTrigger && (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-400">
                Will trigger on any tool result with is_error: true
              </p>
            </div>
          )}

          {/* Match Field - only show when options are available and not error-only */}
          {!isErrorOnlyTrigger && availableMatchFields.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-claude-dark-text-secondary">Match Field</label>
              <select
                value={matchField || availableMatchFields[0]?.value || ''}
                onChange={(e) => setMatchField(e.target.value)}
                disabled={saving}
                className={`
                  px-3 py-1.5 text-sm rounded-md border border-claude-dark-border
                  bg-claude-dark-surface text-claude-dark-text
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {availableMatchFields.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Match Pattern - only show when not error-only */}
          {!isErrorOnlyTrigger && (
            <div className="space-y-2">
              <label className="text-sm text-claude-dark-text-secondary">Match Pattern (Regex)</label>
              <input
                type="text"
                value={matchPattern}
                onChange={(e) => {
                  setMatchPattern(e.target.value);
                  validatePattern(e.target.value);
                }}
                placeholder="e.g., error|failed|exception"
                disabled={saving}
                className={`
                  w-full px-3 py-1.5 text-sm rounded-md border font-mono
                  bg-claude-dark-surface text-claude-dark-text placeholder-claude-dark-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${patternError ? 'border-red-500' : 'border-claude-dark-border'}
                  ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              />
              {patternError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {patternError}
                </p>
              )}
              <p className="text-xs text-claude-dark-text-secondary">
                Leave empty to match all content. Uses JavaScript regex syntax.
              </p>
            </div>
          )}

          {/* Ignore Patterns Section */}
          <div className="mt-3">
            <label className="text-xs text-claude-dark-text-secondary block mb-2">
              Ignore Patterns (skip if matches)
            </label>
            {ignorePatterns.map((pattern, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <code className="flex-1 text-xs px-2 py-1 bg-claude-dark-bg rounded truncate font-mono">
                  {pattern}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const newPatterns = [...ignorePatterns];
                    newPatterns.splice(idx, 1);
                    setIgnorePatterns(newPatterns);
                  }}
                  disabled={saving}
                  className={`
                    p-1 text-red-400 hover:bg-red-500/20 rounded
                    ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  aria-label="Remove ignore pattern"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {/* Add ignore pattern input */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Add ignore regex..."
                disabled={saving}
                className={`
                  flex-1 px-2 py-1 text-xs rounded border border-claude-dark-border
                  bg-claude-dark-bg text-claude-dark-text font-mono
                  placeholder-claude-dark-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    // Validate regex before adding
                    try {
                      new RegExp(e.currentTarget.value.trim());
                      setIgnorePatterns([...ignorePatterns, e.currentTarget.value.trim()]);
                      e.currentTarget.value = '';
                    } catch {
                      // Invalid regex - could show an error here if desired
                    }
                  }
                }}
              />
            </div>
            <p className="text-xs text-claude-dark-text-secondary mt-1">
              Press Enter to add. Notification is skipped if any pattern matches.
            </p>
          </div>

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsExpanded(false);
              }}
              disabled={saving}
              className={`
                px-4 py-2 text-sm rounded-md
                bg-claude-dark-border text-claude-dark-text hover:bg-claude-dark-border/80 transition-colors
                ${saving ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !!patternError}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm rounded-md
                bg-blue-500 text-white hover:bg-blue-600 transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                focus:ring-offset-claude-dark-bg
                ${(saving || !name.trim() || !!patternError) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Trigger
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Main component for managing notification triggers.
 */
export function NotificationTriggerSettings({
  triggers,
  saving,
  onUpdateTrigger,
  onAddTrigger,
  onRemoveTrigger,
}: NotificationTriggerSettingsProps) {
  // Separate builtin and custom triggers
  const builtinTriggers = triggers.filter((t) => t.isBuiltin);
  const customTriggers = triggers.filter((t) => !t.isBuiltin);

  return (
    <div className="space-y-6">
      {/* Builtin Triggers */}
      {builtinTriggers.length > 0 && (
        <div className="bg-claude-dark-surface rounded-lg p-4">
          <SectionHeader title="Built-in Triggers" />
          <p className="text-xs text-claude-dark-text-secondary mb-4">
            Default triggers that come with the application. You can enable/disable them and customize their patterns.
          </p>
          <div className="space-y-3">
            {builtinTriggers.map((trigger) => (
              <TriggerCard
                key={trigger.id}
                trigger={trigger}
                saving={saving}
                onUpdate={(updates) => onUpdateTrigger(trigger.id, updates)}
                onRemove={() => Promise.resolve()} // No-op for builtin
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Triggers */}
      <div className="bg-claude-dark-surface rounded-lg p-4">
        <SectionHeader title="Custom Triggers" />
        <p className="text-xs text-claude-dark-text-secondary mb-4">
          Create your own triggers to get notified for specific patterns or tool outputs.
        </p>

        {customTriggers.length > 0 && (
          <div className="space-y-3 mb-4">
            {customTriggers.map((trigger) => (
              <TriggerCard
                key={trigger.id}
                trigger={trigger}
                saving={saving}
                onUpdate={(updates) => onUpdateTrigger(trigger.id, updates)}
                onRemove={() => onRemoveTrigger(trigger.id)}
              />
            ))}
          </div>
        )}

        {customTriggers.length === 0 && (
          <p className="text-sm text-claude-dark-text-secondary mb-4 italic">
            No custom triggers configured yet.
          </p>
        )}

        <AddTriggerForm saving={saving} onAdd={onAddTrigger} />
      </div>
    </div>
  );
}
