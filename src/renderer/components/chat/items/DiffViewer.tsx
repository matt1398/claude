import React, { useState } from 'react';
import { Pencil, ChevronRight, ChevronDown } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface DiffViewerProps {
  fileName: string;           // The file being edited
  oldString: string;          // The original text being replaced
  newString: string;          // The new text
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

  // Format summary
  const displayName = getFileName(fileName);

  return (
    <div className="border border-zinc-700/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        )}
        <Pencil className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="text-sm text-zinc-200 font-mono truncate">
          {displayName}
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
      {isExpanded && (
        <div className="bg-zinc-900 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
          <div className="inline-block min-w-full">
            {diffLines.map((line, index) => (
              <DiffLineRow key={index} line={line} />
            ))}
            {diffLines.length === 0 && (
              <div className="px-3 py-2 text-zinc-500 italic">
                No changes detected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && (
        <div className="px-3 py-1.5 text-xs text-zinc-500 bg-zinc-900/50">
          Click to expand diff view
        </div>
      )}
    </div>
  );
};

// Export for use in tool rendering
export default DiffViewer;
