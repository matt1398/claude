import React, { useState, useMemo } from 'react';
import { FileCode, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface CodeBlockViewerProps {
  fileName: string;           // e.g., "src/components/Header.tsx"
  content: string;            // The actual file content
  language?: string;          // Inferred from file extension if not provided
  startLine?: number;         // If partial read, starting line
  endLine?: number;           // If partial read, ending line
  maxPreviewLines?: number;   // Default 15 - show this many before collapse
  isExpanded?: boolean;       // Initial expansion state
  onToggle?: () => void;      // Optional expansion callback
  forceExpanded?: boolean;    // Force expand for search results (overrides internal state)
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
// Syntax Highlighting (Basic Token-based)
// =============================================================================

// Basic keyword sets for common languages
const KEYWORDS: Record<string, Set<string>> = {
  typescript: new Set([
    'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class',
    'interface', 'type', 'enum', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'new', 'this', 'super', 'extends', 'implements', 'async', 'await',
    'public', 'private', 'protected', 'static', 'readonly', 'abstract',
    'as', 'typeof', 'instanceof', 'in', 'of', 'keyof', 'void', 'never',
    'unknown', 'any', 'null', 'undefined', 'true', 'false', 'default'
  ]),
  javascript: new Set([
    'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
    'extends', 'async', 'await', 'typeof', 'instanceof', 'in', 'of', 'void',
    'null', 'undefined', 'true', 'false', 'default'
  ]),
  python: new Set([
    'import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else',
    'for', 'while', 'break', 'continue', 'try', 'except', 'finally', 'raise',
    'with', 'as', 'pass', 'lambda', 'yield', 'global', 'nonlocal', 'assert',
    'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await',
    'self', 'cls'
  ]),
  rust: new Set([
    'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait',
    'pub', 'mod', 'use', 'crate', 'self', 'super', 'where', 'for', 'loop',
    'while', 'if', 'else', 'match', 'return', 'break', 'continue', 'move',
    'ref', 'as', 'in', 'unsafe', 'async', 'await', 'dyn', 'true', 'false',
    'type', 'extern'
  ]),
  go: new Set([
    'package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface',
    'map', 'chan', 'go', 'defer', 'return', 'if', 'else', 'for', 'range',
    'switch', 'case', 'default', 'break', 'continue', 'fallthrough', 'select',
    'nil', 'true', 'false'
  ])
};

// Extend tsx/jsx to use typescript/javascript keywords
KEYWORDS.tsx = KEYWORDS.typescript;
KEYWORDS.jsx = KEYWORDS.javascript;

/**
 * Very basic tokenization for syntax highlighting.
 * This is a simple approach without a full parser.
 */
function highlightLine(line: string, language: string): React.ReactNode {
  const keywords = KEYWORDS[language] || new Set();

  // If no highlighting support, return plain text
  if (keywords.size === 0 && !['json', 'css', 'html', 'bash', 'markdown'].includes(language)) {
    return line;
  }

  const segments: React.ReactNode[] = [];
  let currentPos = 0;
  const lineLength = line.length;

  while (currentPos < lineLength) {
    const remaining = line.slice(currentPos);

    // Check for string (double quote)
    if (remaining[0] === '"') {
      const endQuote = remaining.indexOf('"', 1);
      if (endQuote !== -1) {
        const str = remaining.slice(0, endQuote + 1);
        segments.push(
          <span key={currentPos} style={{ color: 'var(--syntax-string)' }}>{str}</span>
        );
        currentPos += str.length;
        continue;
      }
    }

    // Check for string (single quote)
    if (remaining[0] === "'") {
      const endQuote = remaining.indexOf("'", 1);
      if (endQuote !== -1) {
        const str = remaining.slice(0, endQuote + 1);
        segments.push(
          <span key={currentPos} style={{ color: 'var(--syntax-string)' }}>{str}</span>
        );
        currentPos += str.length;
        continue;
      }
    }

    // Check for template literal (backtick)
    if (remaining[0] === '`') {
      const endQuote = remaining.indexOf('`', 1);
      if (endQuote !== -1) {
        const str = remaining.slice(0, endQuote + 1);
        segments.push(
          <span key={currentPos} style={{ color: 'var(--syntax-string)' }}>{str}</span>
        );
        currentPos += str.length;
        continue;
      }
    }

    // Check for comment (// style)
    if (remaining.startsWith('//')) {
      segments.push(
        <span key={currentPos} style={{ color: 'var(--syntax-comment)', fontStyle: 'italic' }}>{remaining}</span>
      );
      break;
    }

    // Check for comment (# style for Python/Shell)
    if ((language === 'python' || language === 'bash') && remaining[0] === '#') {
      segments.push(
        <span key={currentPos} style={{ color: 'var(--syntax-comment)', fontStyle: 'italic' }}>{remaining}</span>
      );
      break;
    }

    // Check for numbers
    const numberMatch = remaining.match(/^(\d+\.?\d*)/);
    if (numberMatch && (currentPos === 0 || /\W/.test(line[currentPos - 1]))) {
      segments.push(
        <span key={currentPos} style={{ color: 'var(--syntax-number)' }}>{numberMatch[1]}</span>
      );
      currentPos += numberMatch[1].length;
      continue;
    }

    // Check for keywords and identifiers
    const wordMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (wordMatch) {
      const word = wordMatch[1];
      if (keywords.has(word)) {
        segments.push(
          <span key={currentPos} style={{ color: 'var(--syntax-keyword)', fontWeight: 500 }}>{word}</span>
        );
      } else if (word[0] === word[0].toUpperCase() && word.length > 1) {
        // Likely a type/class name
        segments.push(
          <span key={currentPos} style={{ color: 'var(--syntax-type)' }}>{word}</span>
        );
      } else {
        segments.push(word);
      }
      currentPos += word.length;
      continue;
    }

    // Check for operators and punctuation
    const opMatch = remaining.match(/^([=<>!+\-*/%&|^~?:;,.{}()[\]])/);
    if (opMatch) {
      segments.push(
        <span key={currentPos} style={{ color: 'var(--syntax-operator)' }}>{opMatch[1]}</span>
      );
      currentPos += 1;
      continue;
    }

    // Default: just add the character
    segments.push(remaining[0]);
    currentPos += 1;
  }

  return <>{segments}</>;
}

// =============================================================================
// Component
// =============================================================================

export const CodeBlockViewer: React.FC<CodeBlockViewerProps> = ({
  fileName,
  content,
  language,
  startLine = 1,
  endLine,
  maxPreviewLines = 15,
  isExpanded: initialExpanded = false,
  onToggle,
  forceExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded || forceExpanded);

  // Update expansion state when forceExpanded changes
  React.useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);
  const [isCopied, setIsCopied] = useState(false);

  // Infer language from file extension if not provided
  const detectedLanguage = language || inferLanguage(fileName);

  // Split content into lines
  const lines = useMemo(() => content.split('\n'), [content]);
  const totalLines = lines.length;

  // Determine if content needs collapsing
  const needsCollapse = totalLines > maxPreviewLines;

  // Lines to display based on expansion state
  const displayLines = useMemo(() => {
    if (!needsCollapse || isExpanded) {
      return lines;
    }
    return lines.slice(0, maxPreviewLines);
  }, [lines, needsCollapse, isExpanded, maxPreviewLines]);

  // Calculate the actual line range for display
  const actualEndLine = endLine ?? (startLine + totalLines - 1);

  // Handle toggle
  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  // Handle copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  // Extract just the filename for display
  const displayFileName = fileName.split('/').pop() || fileName;

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--code-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: 'var(--code-header-bg)',
          borderBottom: '1px solid var(--code-border)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <span
            className="font-mono text-sm truncate"
            title={fileName}
            style={{ color: 'var(--code-filename)' }}
          >
            {displayFileName}
          </span>
          {(startLine > 1 || endLine) && (
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              (lines {startLine}-{actualEndLine})
            </span>
          )}
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
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="p-1 rounded transition-colors hover:opacity-80"
          title="Copy to clipboard"
          style={{ backgroundColor: 'transparent' }}
        >
          {isCopied ? (
            <Check className="w-4 h-4" style={{ color: 'var(--badge-success-bg)' }} />
          ) : (
            <Copy className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          )}
        </button>
      </div>

      {/* Code content */}
      <div className={`overflow-x-auto ${isExpanded ? 'max-h-96 overflow-y-auto' : ''}`}>
        <pre className="p-0 m-0 bg-transparent">
          <code className="block font-mono text-xs leading-relaxed">
            {displayLines.map((line, index) => {
              const lineNumber = startLine + index;
              return (
                <div
                  key={index}
                  className="flex"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Line number */}
                  <span
                    className="flex-shrink-0 w-12 px-3 py-0.5 text-right select-none"
                    style={{
                      color: 'var(--code-line-number)',
                      borderRight: '1px solid var(--code-border)',
                    }}
                  >
                    {lineNumber}
                  </span>
                  {/* Code line */}
                  <span
                    className="flex-1 px-4 py-0.5 whitespace-pre"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {highlightLine(line, detectedLanguage)}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
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
