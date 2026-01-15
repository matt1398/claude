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
  const styles: Record<DiffLine['type'], { bg: string; text: string; border: string; prefix: string }> = {
    removed: {
      bg: 'bg-red-900/20',
      text: 'text-red-400',
      border: 'border-l-red-500',
      prefix: '-'
    },
    added: {
      bg: 'bg-green-900/20',
      text: 'text-green-400',
      border: 'border-l-green-500',
      prefix: '+'
    },
    context: {
      bg: '',
      text: 'text-zinc-400',
      border: 'border-l-transparent',
      prefix: ' '
    }
  };

  const style = styles[line.type];

  return (
    <div className={`flex min-w-full ${style.bg} border-l-[3px] ${style.border}`}>
      {/* Line number */}
      <span className="w-10 flex-shrink-0 px-2 text-right text-zinc-600 select-none bg-inherit">
        {line.lineNumber}
      </span>
      {/* Prefix */}
      <span className={`w-6 flex-shrink-0 ${style.text} select-none bg-inherit`}>
        {style.prefix}
      </span>
      {/* Content */}
      <span className={`flex-1 ${style.text} whitespace-pre bg-inherit`}>
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
  onToggle
}) => {
  // Support both controlled and uncontrolled expansion
  const [internalExpanded, setInternalExpanded] = useState(false);
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
    <div className="border border-zinc-700/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50">
        <Pencil className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="text-sm text-zinc-200 font-mono truncate">
          {displayName}
        </span>
        <span className="text-xs text-zinc-600 px-1.5 py-0.5 bg-zinc-800 rounded flex-shrink-0">
          {detectedLanguage}
        </span>
        <span className="text-zinc-500 text-sm">-</span>
        <span className="text-sm flex-shrink-0">
          {stats.added > 0 && (
            <span className="text-green-400 mr-1">+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-400">-{stats.removed}</span>
          )}
          {stats.added === 0 && stats.removed === 0 && (
            <span className="text-zinc-500">Changed</span>
          )}
        </span>
      </div>

      {/* Diff content */}
      <div className={`bg-zinc-900 font-mono text-xs overflow-x-auto ${isExpanded ? 'max-h-96 overflow-y-auto' : ''}`}>
        <div className="inline-block min-w-full">
          {displayLines.map((line, index) => (
            <DiffLineRow key={index} line={line} />
          ))}
          {diffLines.length === 0 && (
            <div className="px-3 py-2 text-zinc-500 italic">
              No changes detected
            </div>
          )}
        </div>
      </div>

      {/* Show more/less button */}
      {needsCollapse && (
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3
                     bg-zinc-800/30 hover:bg-zinc-800/50 border-t border-zinc-700/30
                     text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
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
