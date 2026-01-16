import React, { useState, useMemo } from 'react';
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface DiffViewerProps {
  fileName: string;           // The file being edited
  oldString: string;          // The original text being replaced
  newString: string;          // The new text
  maxPreviewLines?: number;   // Default 15 - show this many before collapse
  isExpanded?: boolean;       // Initial expansion state
  onToggle?: () => void;      // Optional expansion callback
  forceExpanded?: boolean;    // Force expand for search results (overrides internal state)
}

interface DiffLine {
  type: 'removed' | 'added' | 'context';
  content: string;
  lineNumber: number;
}

// =============================================================================
// Diff Algorithm (LCS-based)
// =============================================================================

/**
 * Computes the Longest Common Subsequence matrix for two arrays of strings.
 */
function computeLCSMatrix(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const matrix: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  return matrix;
}

/**
 * Backtrack through LCS matrix to generate diff lines.
 */
function generateDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const matrix = computeLCSMatrix(oldLines, newLines);
  const result: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;
  let lineNumber = 1;

  // Temporary storage for backtracking
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Lines are the same - context
      temp.push({ type: 'context', content: oldLines[i - 1], lineNumber: 0 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      // Line was added
      temp.push({ type: 'added', content: newLines[j - 1], lineNumber: 0 });
      j--;
    } else if (i > 0) {
      // Line was removed
      temp.push({ type: 'removed', content: oldLines[i - 1], lineNumber: 0 });
      i--;
    }
  }

  // Reverse and assign line numbers
  temp.reverse();
  for (const line of temp) {
    line.lineNumber = lineNumber++;
    result.push(line);
  }

  return result;
}

/**
 * Computes diff statistics.
 */
function computeStats(diffLines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of diffLines) {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
  }

  return { added, removed };
}

/**
 * Extracts filename from a file path.
 */
function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

// =============================================================================
// Language Detection
// =============================================================================

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyx': 'python',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',

  // Data formats
  '.json': 'json',
  '.jsonl': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',

  // Shell
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.fish': 'fish',

  // Systems
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'hpp',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',

  // Config
  '.env': 'env',
  '.gitignore': 'gitignore',
  '.dockerignore': 'dockerignore',
  '.md': 'markdown',
  '.mdx': 'mdx',

  // Other
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.rb': 'ruby',
  '.php': 'php',
  '.lua': 'lua',
  '.r': 'r',
  '.R': 'r',
};

/**
 * Infer language from file name/extension.
 */
function inferLanguage(fileName: string): string {
  // Check for dotfiles with specific names
  const baseName = fileName.split('/').pop() || '';
  if (baseName === 'Dockerfile') return 'dockerfile';
  if (baseName === 'Makefile') return 'makefile';
  if (baseName.startsWith('.env')) return 'env';

  // Extract extension
  const extMatch = fileName.match(/(\.[^./]+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] || 'text';
  }

  return 'text';
}

// =============================================================================
// Diff Line Component
// =============================================================================

interface DiffLineRowProps {
  line: DiffLine;
}

const DiffLineRow: React.FC<DiffLineRowProps> = ({ line }) => {
  // Theme-aware styles using CSS variables
  const getStyles = (type: DiffLine['type']) => {
    switch (type) {
      case 'removed':
        return {
          bg: 'var(--diff-removed-bg)',
          text: 'var(--diff-removed-text)',
          border: 'var(--diff-removed-border)',
          prefix: '-'
        };
      case 'added':
        return {
          bg: 'var(--diff-added-bg)',
          text: 'var(--diff-added-text)',
          border: 'var(--diff-added-border)',
          prefix: '+'
        };
      default:
        return {
          bg: 'transparent',
          text: 'var(--color-text-secondary)',
          border: 'transparent',
          prefix: ' '
        };
    }
  };

  const style = getStyles(line.type);

  return (
    <div
      className="flex min-w-full"
      style={{
        backgroundColor: style.bg,
        borderLeft: `3px solid ${style.border}`,
      }}
    >
      {/* Line number */}
      <span
        className="w-10 flex-shrink-0 px-2 text-right select-none"
        style={{ color: 'var(--code-line-number)' }}
      >
        {line.lineNumber}
      </span>
      {/* Prefix */}
      <span
        className="w-6 flex-shrink-0 select-none"
        style={{ color: style.text }}
      >
        {style.prefix}
      </span>
      {/* Content */}
      <span
        className="flex-1 whitespace-pre"
        style={{ color: style.text }}
      >
        {line.content || ' '}
      </span>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const DiffViewer: React.FC<DiffViewerProps> = ({
  fileName,
  oldString,
  newString,
  maxPreviewLines = 15,
  isExpanded: controlledExpanded,
  onToggle,
  forceExpanded = false
}) => {
  // Support both controlled and uncontrolled expansion
  const [internalExpanded, setInternalExpanded] = useState(forceExpanded);

  // Update expansion state when forceExpanded changes
  React.useEffect(() => {
    if (forceExpanded) {
      setInternalExpanded(true);
    }
  }, [forceExpanded]);

  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Compute diff
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const diffLines = generateDiff(oldLines, newLines);
  const stats = computeStats(diffLines);
  const totalLines = diffLines.length;

  // Determine if content needs collapsing
  const needsCollapse = totalLines > maxPreviewLines;

  // Lines to display based on expansion state
  const displayLines = useMemo(() => {
    if (!needsCollapse || isExpanded) {
      return diffLines;
    }
    return diffLines.slice(0, maxPreviewLines);
  }, [diffLines, needsCollapse, isExpanded, maxPreviewLines]);

  // Infer language from file extension
  const detectedLanguage = inferLanguage(fileName);

  // Format summary
  const displayName = getFileName(fileName);

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--code-border)',
      }}
    >
      {/* Header - matches CodeBlockViewer style */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          backgroundColor: 'var(--code-header-bg)',
          borderBottom: '1px solid var(--code-border)',
        }}
      >
        <Pencil className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <span
          className="text-sm font-mono truncate"
          style={{ color: 'var(--code-filename)' }}
        >
          {displayName}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            backgroundColor: 'var(--tag-bg)',
            color: 'var(--tag-text)',
            border: '1px solid var(--tag-border)',
          }}
        >
          {detectedLanguage}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
        <span className="text-sm flex-shrink-0">
          {stats.added > 0 && (
            <span className="mr-1" style={{ color: 'var(--diff-added-text)' }}>+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span style={{ color: 'var(--diff-removed-text)' }}>-{stats.removed}</span>
          )}
          {stats.added === 0 && stats.removed === 0 && (
            <span style={{ color: 'var(--color-text-muted)' }}>Changed</span>
          )}
        </span>
      </div>

      {/* Diff content */}
      <div className={`font-mono text-xs overflow-x-auto ${isExpanded ? 'max-h-96 overflow-y-auto' : ''}`}>
        <div className="inline-block min-w-full">
          {displayLines.map((line, index) => (
            <DiffLineRow key={index} line={line} />
          ))}
          {diffLines.length === 0 && (
            <div className="px-3 py-2 italic" style={{ color: 'var(--color-text-muted)' }}>
              No changes detected
            </div>
          )}
        </div>
      </div>

      {/* Show more/less button */}
      {needsCollapse && (
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-sm transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'var(--code-header-bg)',
            borderTop: '1px solid var(--code-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {totalLines - maxPreviewLines} more lines
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Export for use in tool rendering
export default DiffViewer;
