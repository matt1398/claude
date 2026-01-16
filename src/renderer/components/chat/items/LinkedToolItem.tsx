import React, { useRef, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import type { LinkedToolItem as LinkedToolItemType } from '../../../types/groups';
import { CodeBlockViewer } from './CodeBlockViewer';
import { DiffViewer } from './DiffViewer';

interface LinkedToolItemProps {
  linkedTool: LinkedToolItemType;
  onClick: () => void;
  isExpanded: boolean;
  /** Whether this item should be highlighted for error deep linking */
  isHighlighted?: boolean;
}

// =============================================================================
// Status Types and Components
// =============================================================================

type ToolStatus = 'ok' | 'error' | 'orphaned';

/**
 * Small status dot indicator.
 */
const StatusDot: React.FC<{ status: ToolStatus }> = ({ status }) => {
  const colors: Record<ToolStatus, string> = {
    ok: 'bg-green-500',
    error: 'bg-red-500',
    orphaned: 'bg-zinc-500'
  };
  return <span className={`w-1.5 h-1.5 rounded-full inline-block ${colors[status]}`} />;
};

/**
 * Gets the status of a tool execution.
 */
function getToolStatus(linkedTool: LinkedToolItemType): ToolStatus {
  if (linkedTool.isOrphaned) return 'orphaned';
  if (linkedTool.result?.isError) return 'error';
  return 'ok';
}

// =============================================================================
// Tool Summary Helpers
// =============================================================================

/**
 * Extracts filename from a file path.
 */
function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * Truncates a string to a maximum length with ellipsis.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Generates a human-readable summary for a tool call.
 */
function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Edit': {
      const filePath = input.file_path as string | undefined;
      const oldString = input.old_string as string | undefined;
      const newString = input.new_string as string | undefined;

      if (!filePath) return 'Edit';

      const fileName = getFileName(filePath);

      // Count line changes if we have old/new strings
      if (oldString && newString) {
        const oldLines = oldString.split('\n').length;
        const newLines = newString.split('\n').length;
        if (oldLines === newLines) {
          return `${fileName} - ${oldLines} line${oldLines > 1 ? 's' : ''}`;
        }
        return `${fileName} - ${oldLines} -> ${newLines} lines`;
      }

      return fileName;
    }

    case 'Read': {
      const filePath = input.file_path as string | undefined;
      const limit = input.limit as number | undefined;
      const offset = input.offset as number | undefined;

      if (!filePath) return 'Read';

      const fileName = getFileName(filePath);

      if (limit) {
        const start = offset ?? 1;
        return `${fileName} - lines ${start}-${start + limit - 1}`;
      }

      return fileName;
    }

    case 'Write': {
      const filePath = input.file_path as string | undefined;
      const content = input.content as string | undefined;

      if (!filePath) return 'Write';

      const fileName = getFileName(filePath);

      if (content) {
        const lineCount = content.split('\n').length;
        return `${fileName} - ${lineCount} lines`;
      }

      return fileName;
    }

    case 'Bash': {
      const command = input.command as string | undefined;
      const description = input.description as string | undefined;

      // Prefer description if available
      if (description) {
        return truncate(description, 50);
      }

      if (command) {
        return truncate(command, 50);
      }

      return 'Bash';
    }

    case 'Grep': {
      const pattern = input.pattern as string | undefined;
      const path = input.path as string | undefined;
      const glob = input.glob as string | undefined;

      if (!pattern) return 'Grep';

      const patternStr = `"${truncate(pattern, 30)}"`;

      if (glob) {
        return `${patternStr} in ${glob}`;
      }
      if (path) {
        return `${patternStr} in ${getFileName(path)}`;
      }

      return patternStr;
    }

    case 'Glob': {
      const pattern = input.pattern as string | undefined;
      const path = input.path as string | undefined;

      if (!pattern) return 'Glob';

      const patternStr = `"${truncate(pattern, 30)}"`;

      if (path) {
        return `${patternStr} in ${getFileName(path)}`;
      }

      return patternStr;
    }

    case 'Task': {
      const prompt = input.prompt as string | undefined;
      const subagentType = input.subagentType as string | undefined;
      const description = input.description as string | undefined;

      const desc = description || prompt;
      const typeStr = subagentType ? `${subagentType} - ` : '';

      if (desc) {
        return `${typeStr}${truncate(desc, 40)}`;
      }

      return subagentType || 'Task';
    }

    case 'LSP': {
      const operation = input.operation as string | undefined;
      const filePath = input.filePath as string | undefined;

      if (!operation) return 'LSP';

      if (filePath) {
        return `${operation} - ${getFileName(filePath)}`;
      }

      return operation;
    }

    case 'WebFetch': {
      const url = input.url as string | undefined;

      if (url) {
        try {
          const urlObj = new URL(url);
          return truncate(urlObj.hostname + urlObj.pathname, 50);
        } catch {
          return truncate(url, 50);
        }
      }

      return 'WebFetch';
    }

    case 'WebSearch': {
      const query = input.query as string | undefined;

      if (query) {
        return `"${truncate(query, 40)}"`;
      }

      return 'WebSearch';
    }

    case 'TodoWrite': {
      const todos = input.todos as unknown[] | undefined;

      if (todos && Array.isArray(todos)) {
        return `${todos.length} item${todos.length !== 1 ? 's' : ''}`;
      }

      return 'TodoWrite';
    }

    case 'NotebookEdit': {
      const notebookPath = input.notebook_path as string | undefined;
      const editMode = input.edit_mode as string | undefined;

      if (notebookPath) {
        const fileName = getFileName(notebookPath);
        return editMode ? `${editMode} - ${fileName}` : fileName;
      }

      return 'NotebookEdit';
    }

    default: {
      // For unknown tools, try to extract a meaningful summary
      const keys = Object.keys(input);
      if (keys.length === 0) return toolName;

      // Try common parameter names
      const nameField = input.name || input.path || input.file || input.query || input.command;
      if (typeof nameField === 'string') {
        return truncate(nameField, 50);
      }

      // Fallback to showing first parameter
      const firstValue = input[keys[0]];
      if (typeof firstValue === 'string') {
        return truncate(firstValue, 40);
      }

      return toolName;
    }
  }
}

// =============================================================================
// Duration Formatter
// =============================================================================

/**
 * Formats duration in milliseconds to a human-readable string.
 */
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '...';

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

// =============================================================================
// Expanded View Renderers
// =============================================================================

/**
 * Renders the input section based on tool type.
 */
function renderInput(toolName: string, input: Record<string, unknown>): React.ReactNode {
  // Special rendering for Edit tool - show diff-like format
  if (toolName === 'Edit') {
    const filePath = input.file_path as string | undefined;
    const oldString = input.old_string as string | undefined;
    const newString = input.new_string as string | undefined;
    const replaceAll = input.replace_all as boolean | undefined;

    return (
      <div className="space-y-2">
        {filePath && (
          <div className="text-zinc-400 text-xs mb-2">
            {filePath}
            {replaceAll && <span className="ml-2 text-zinc-500">(replace all)</span>}
          </div>
        )}
        {oldString && (
          <div className="text-red-400/80 whitespace-pre-wrap break-all">
            {oldString.split('\n').map((line, i) => (
              <div key={i}>- {line}</div>
            ))}
          </div>
        )}
        {newString && (
          <div className="text-green-400/80 whitespace-pre-wrap break-all">
            {newString.split('\n').map((line, i) => (
              <div key={i}>+ {line}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Special rendering for Bash tool
  if (toolName === 'Bash') {
    const command = input.command as string | undefined;
    const description = input.description as string | undefined;

    return (
      <div className="space-y-2">
        {description && (
          <div className="text-zinc-400 text-xs mb-1">{description}</div>
        )}
        {command && (
          <code className="text-zinc-300 whitespace-pre-wrap break-all">{command}</code>
        )}
      </div>
    );
  }

  // Special rendering for Read tool
  if (toolName === 'Read') {
    const filePath = input.file_path as string | undefined;
    const offset = input.offset as number | undefined;
    const limit = input.limit as number | undefined;

    return (
      <div className="text-zinc-300">
        <div>{filePath}</div>
        {(offset !== undefined || limit !== undefined) && (
          <div className="text-zinc-500 text-xs mt-1">
            {offset !== undefined && `offset: ${offset}`}
            {offset !== undefined && limit !== undefined && ', '}
            {limit !== undefined && `limit: ${limit}`}
          </div>
        )}
      </div>
    );
  }

  // Default: JSON format
  return (
    <pre className="whitespace-pre-wrap break-all">
      {JSON.stringify(input, null, 2)}
    </pre>
  );
}

/**
 * Renders the output section.
 */
function renderOutput(content: string | unknown[]): React.ReactNode {
  if (typeof content === 'string') {
    return <pre className="whitespace-pre-wrap break-all">{content}</pre>;
  }

  return <pre className="whitespace-pre-wrap break-all">{JSON.stringify(content, null, 2)}</pre>;
}

// =============================================================================
// Specialized Tool Viewers
// =============================================================================

/**
 * Renders the Read tool result using CodeBlockViewer.
 * Prefers enriched toolUseResult data which has cleaner content without line number prefixes.
 */
const ReadToolViewer: React.FC<{ linkedTool: LinkedToolItemType }> = ({ linkedTool }) => {
  const filePath = linkedTool.input.file_path as string;

  // Prefer enriched toolUseResult data
  const toolUseResult = linkedTool.result?.toolUseResult as Record<string, unknown> | undefined;
  const fileData = toolUseResult?.file as {
    content?: string;
    startLine?: number;
    totalLines?: number;
    numLines?: number;
  } | undefined;

  // Get content: prefer enriched file data, fall back to raw result content
  let content: string;
  if (fileData?.content) {
    content = fileData.content;
  } else {
    const resultContent = linkedTool.result?.content;
    content = typeof resultContent === 'string'
      ? resultContent
      : Array.isArray(resultContent)
        ? resultContent.map((item: unknown) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n')
        : JSON.stringify(resultContent, null, 2);
  }

  // Get line range: prefer enriched data, fall back to input params
  const startLine = fileData?.startLine || (linkedTool.input.offset as number) || 1;
  const totalLines = fileData?.totalLines || fileData?.numLines;
  const limit = linkedTool.input.limit as number | undefined;

  const endLine = totalLines
    ? startLine + totalLines - 1
    : (limit ? startLine + limit - 1 : undefined);

  return (
    <CodeBlockViewer
      fileName={filePath}
      content={content}
      startLine={startLine}
      endLine={endLine}
    />
  );
};

/**
 * Renders the Write tool result.
 * Shows the created file path and a preview of the content.
 */
const WriteToolViewer: React.FC<{ linkedTool: LinkedToolItemType }> = ({ linkedTool }) => {
  const toolUseResult = linkedTool.result?.toolUseResult as Record<string, unknown> | undefined;

  // Get file path from toolUseResult or input
  const filePath = (toolUseResult?.filePath as string) || (linkedTool.input.file_path as string);

  // Get content from toolUseResult or input
  const content = (toolUseResult?.content as string) || (linkedTool.input.content as string) || '';

  // Check if this is a create operation
  const isCreate = toolUseResult?.type === 'create';

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500 mb-1">
        {isCreate ? 'Created file' : 'Wrote to file'}
      </div>
      <CodeBlockViewer
        fileName={filePath}
        content={content}
        startLine={1}
      />
    </div>
  );
};

/**
 * Renders the Edit tool with DiffViewer.
 * Uses enriched toolUseResult data when available.
 */
const EditToolViewer: React.FC<{ linkedTool: LinkedToolItemType; status: ToolStatus }> = ({ linkedTool, status }) => {
  const toolUseResult = linkedTool.result?.toolUseResult as Record<string, unknown> | undefined;

  // Get file path from toolUseResult or input
  const filePath = (toolUseResult?.filePath as string) || (linkedTool.input.file_path as string);

  // Get old/new strings: prefer toolUseResult, fall back to input
  const oldString = (toolUseResult?.oldString as string) || (linkedTool.input.old_string as string) || '';
  const newString = (toolUseResult?.newString as string) || (linkedTool.input.new_string as string) || '';

  return (
    <div className="space-y-3">
      <DiffViewer
        fileName={filePath}
        oldString={oldString}
        newString={newString}
      />

      {/* Show result status if available */}
      {!linkedTool.isOrphaned && linkedTool.result != null && (
        <div>
          <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
            Result
            <StatusDot status={status} />
          </div>
          <div className={`bg-zinc-900 rounded p-3 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto ${
            status === 'error' ? 'text-red-400' : 'text-zinc-300'
          }`}>
            {renderOutput(linkedTool.result.content)}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Content Check Helpers
// =============================================================================

/**
 * Checks if Read tool has displayable content.
 * Considers both result.content and toolUseResult.file.content.
 */
function hasReadContent(linkedTool: LinkedToolItemType): boolean {
  if (!linkedTool.result) return false;

  // Check toolUseResult first
  const toolUseResult = linkedTool.result.toolUseResult as Record<string, unknown> | undefined;
  const fileData = toolUseResult?.file as { content?: string } | undefined;
  if (fileData?.content) return true;

  // Fall back to result.content
  if (linkedTool.result.content != null) {
    if (typeof linkedTool.result.content === 'string' && linkedTool.result.content.length > 0) return true;
    if (Array.isArray(linkedTool.result.content) && linkedTool.result.content.length > 0) return true;
  }

  return false;
}

/**
 * Checks if Edit tool has displayable content.
 * Considers both input and toolUseResult.
 */
function hasEditContent(linkedTool: LinkedToolItemType): boolean {
  // Check input for old_string
  if (linkedTool.input.old_string != null) return true;

  // Check toolUseResult
  const toolUseResult = linkedTool.result?.toolUseResult as Record<string, unknown> | undefined;
  if (toolUseResult?.oldString != null || toolUseResult?.newString != null) return true;

  return false;
}

/**
 * Checks if Write tool has displayable content.
 * Considers both input.content and toolUseResult.content.
 */
function hasWriteContent(linkedTool: LinkedToolItemType): boolean {
  // Check input for content
  if (linkedTool.input.content != null || linkedTool.input.file_path != null) return true;

  // Check toolUseResult
  const toolUseResult = linkedTool.result?.toolUseResult as Record<string, unknown> | undefined;
  if (toolUseResult?.content != null || toolUseResult?.filePath != null) return true;

  return false;
}

// =============================================================================
// Main Component
// =============================================================================

export const LinkedToolItem: React.FC<LinkedToolItemProps> = ({ linkedTool, onClick, isExpanded, isHighlighted }) => {
  const status = getToolStatus(linkedTool);
  const summary = getToolSummary(linkedTool.name, linkedTool.input);
  const elementRef = useRef<HTMLDivElement>(null);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isHighlighted && elementRef.current) {
      // Small delay to allow UI to expand first
      const timer = setTimeout(() => {
        elementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  // Highlight animation classes for error deep linking
  const highlightClasses = isHighlighted
    ? 'ring-2 ring-red-500 bg-red-500/10 animate-pulse'
    : '';

  return (
    <div ref={elementRef} className={`rounded transition-all duration-300 ${highlightClasses}`}>
      {/* Collapsed: One-liner view */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800/50 cursor-pointer rounded group"
      >
        <Wrench className={`w-4 h-4 flex-shrink-0 ${isHighlighted ? 'text-red-400' : 'text-zinc-400'}`} />
        <span className="font-mono text-sm text-zinc-200">
          {linkedTool.name}
        </span>
        <span className="text-zinc-500 text-sm">-</span>
        <span className="text-sm text-zinc-400 truncate flex-1">
          {summary}
        </span>
        <StatusDot status={status} />
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {formatDuration(linkedTool.durationMs)}
        </span>
      </div>

      {/* Expanded: Full content */}
      {isExpanded && (
        <div className="border-l-2 border-zinc-600 pl-4 ml-2 mt-2 space-y-3">
          {/* Special rendering for Read tool with CodeBlockViewer */}
          {linkedTool.name === 'Read' && hasReadContent(linkedTool) && !linkedTool.result?.isError && (
            <ReadToolViewer linkedTool={linkedTool} />
          )}

          {/* Special rendering for Edit tool with DiffViewer */}
          {linkedTool.name === 'Edit' && hasEditContent(linkedTool) && (
            <EditToolViewer linkedTool={linkedTool} status={status} />
          )}

          {/* Special rendering for Write tool */}
          {linkedTool.name === 'Write' && hasWriteContent(linkedTool) && !linkedTool.result?.isError && (
            <WriteToolViewer linkedTool={linkedTool} />
          )}

          {/* Default rendering for other tools or fallback cases */}
          {!(linkedTool.name === 'Read' && hasReadContent(linkedTool) && !linkedTool.result?.isError) &&
           !(linkedTool.name === 'Edit' && hasEditContent(linkedTool)) &&
           !(linkedTool.name === 'Write' && hasWriteContent(linkedTool) && !linkedTool.result?.isError) && (
            <>
              {/* Input Section */}
              <div>
                <div className="text-xs text-zinc-500 mb-1">Input</div>
                <div className="bg-zinc-900 rounded p-3 font-mono text-xs text-zinc-300 overflow-x-auto max-h-96 overflow-y-auto">
                  {renderInput(linkedTool.name, linkedTool.input)}
                </div>
              </div>

              {/* Output Section */}
              {!linkedTool.isOrphaned && linkedTool.result && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                    Output
                    <StatusDot status={status} />
                  </div>
                  <div className={`bg-zinc-900 rounded p-3 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto ${
                    status === 'error' ? 'text-red-400' : 'text-zinc-300'
                  }`}>
                    {renderOutput(linkedTool.result.content)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Output section for Read tool errors */}
          {linkedTool.name === 'Read' && linkedTool.result?.isError && (
            <div>
              <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                Error
                <StatusDot status="error" />
              </div>
              <div className="bg-zinc-900 rounded p-3 font-mono text-xs text-red-400 overflow-x-auto max-h-96 overflow-y-auto">
                {renderOutput(linkedTool.result.content)}
              </div>
            </div>
          )}

          {/* Output section for Write tool errors */}
          {linkedTool.name === 'Write' && linkedTool.result?.isError && (
            <div>
              <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                Error
                <StatusDot status="error" />
              </div>
              <div className="bg-zinc-900 rounded p-3 font-mono text-xs text-red-400 overflow-x-auto max-h-96 overflow-y-auto">
                {renderOutput(linkedTool.result.content)}
              </div>
            </div>
          )}

          {/* Orphaned indicator */}
          {linkedTool.isOrphaned && (
            <div className="text-xs text-zinc-500 italic flex items-center gap-2">
              <StatusDot status="orphaned" />
              No result received
            </div>
          )}

          {/* Timing */}
          <div className="text-xs text-zinc-500">
            Duration: {formatDuration(linkedTool.durationMs)}
          </div>
        </div>
      )}
    </div>
  );
};
