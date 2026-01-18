/**
 * SessionClaudeMdPanel - Toggleable panel showing all CLAUDE.md files used in the session.
 * Displays injections grouped by source type with collapsible sections.
 */

import React, { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { ClaudeMdInjection, ClaudeMdSource } from '../../types/claudeMd';

interface SessionClaudeMdPanelProps {
  injections: ClaudeMdInjection[];
  onClose?: () => void;
  projectRoot?: string;
}

// Group category definitions
type GroupCategory = 'global' | 'project' | 'directory';

interface GroupConfig {
  label: string;
  sources: ClaudeMdSource[];
}

const GROUP_CONFIG: Record<GroupCategory, GroupConfig> = {
  global: {
    label: 'Global',
    sources: ['enterprise', 'user-memory'],
  },
  project: {
    label: 'Project',
    sources: ['project-memory', 'project-rules', 'project-local'],
  },
  directory: {
    label: 'Directory',
    sources: ['directory'],
  },
};

// Order of groups for display
const GROUP_ORDER: GroupCategory[] = ['global', 'project', 'directory'];

// NOTE: Source indicators ([E], [U], etc.) removed - paths shown without prefixes
// Grouping by category (Global, Project, Directory) is preserved via GROUP_CONFIG

/**
 * Format token count for display.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Tree node structure for directory hierarchy display.
 */
interface TreeNode {
  name: string;
  path: string;
  isFile: boolean; // true if this is CLAUDE.md
  tokens?: number;
  children: Map<string, TreeNode>;
}

/**
 * Build a tree structure from a list of directory CLAUDE.md injections.
 */
function buildDirectoryTree(injections: ClaudeMdInjection[], projectRoot: string): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: new Map() };

  for (const injection of injections) {
    // Get relative path
    let relativePath = injection.path;
    if (projectRoot && relativePath.startsWith(projectRoot)) {
      relativePath = relativePath.slice(projectRoot.length);
      if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
    }

    // Split into parts and build tree
    const parts = relativePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: isLast ? injection.path : '',
          isFile: isLast && part === 'CLAUDE.md',
          tokens: isLast ? injection.estimatedTokens : undefined,
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }
  }

  return root;
}

/**
 * Recursive component to render a tree node.
 */
function DirectoryTreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }): React.ReactElement | null {
  const [expanded, setExpanded] = useState(true);
  const indent = depth * 12; // pixels per level

  // Sort children: files first (like tree command), then directories
  const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile && !b.isFile) return -1;  // files BEFORE directories
    if (!a.isFile && b.isFile) return 1;
    return a.name.localeCompare(b.name);
  });

  if (node.isFile) {
    // Render CLAUDE.md file
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-center gap-1 text-xs py-0.5"
        title={node.path}
      >
        <span style={{ color: 'var(--color-text-secondary)' }}>{node.name}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          (~{formatTokens(node.tokens || 0)})
        </span>
      </div>
    );
  }

  // Render directory
  return (
    <div>
      {node.name && (
        <div
          style={{ paddingLeft: `${indent}px` }}
          className="flex items-center gap-1 text-xs py-0.5 cursor-pointer hover:opacity-80"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight
            className={`w-3 h-3 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            style={{ color: 'var(--color-text-muted)' }}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>{node.name}/</span>
        </div>
      )}
      {expanded &&
        sortedChildren.map((child) => (
          <DirectoryTreeNode
            key={child.name}
            node={child}
            depth={node.name ? depth + 1 : depth}
          />
        ))}
    </div>
  );
}

/**
 * Group injections by category (global, project, directory).
 */
function groupByCategory(
  injections: ClaudeMdInjection[]
): Map<GroupCategory, ClaudeMdInjection[]> {
  const groups = new Map<GroupCategory, ClaudeMdInjection[]>();

  // Initialize all groups as empty arrays
  for (const category of GROUP_ORDER) {
    groups.set(category, []);
  }

  // Group injections by their category
  for (const injection of injections) {
    for (const [category, config] of Object.entries(GROUP_CONFIG)) {
      if (config.sources.includes(injection.source)) {
        const group = groups.get(category as GroupCategory) || [];
        group.push(injection);
        groups.set(category as GroupCategory, group);
        break;
      }
    }
  }

  return groups;
}

/**
 * Collapsible section component for injection groups.
 */
interface CollapsibleSectionProps {
  title: string;
  count: number;
  tokenCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  tokenCount,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps): React.ReactElement {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors"
        style={{
          backgroundColor: isExpanded
            ? 'var(--color-surface-overlay)'
            : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: 'var(--color-text-secondary)' }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            {title}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--color-surface-overlay)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {count}
          </span>
        </div>
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ~{formatTokens(tokenCount)} tokens
        </span>
      </button>

      {isExpanded && (
        <div
          className="px-3 py-2 space-y-2"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Individual injection item component.
 */
interface InjectionItemProps {
  injection: ClaudeMdInjection;
}

function InjectionItem({ injection }: InjectionItemProps): React.ReactElement {
  return (
    <div
      className="py-1.5 px-2 rounded transition-colors"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      {/* Display name and details */}
      <div className="min-w-0">
        <div
          className="text-xs truncate"
          style={{ color: 'var(--color-text-secondary)' }}
          title={injection.path}
        >
          {injection.displayName}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ~{formatTokens(injection.estimatedTokens)} tokens
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
          >
            First: {injection.firstSeenInGroup}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SessionClaudeMdPanel({
  injections,
  onClose,
  projectRoot,
}: SessionClaudeMdPanelProps): React.ReactElement {
  // Track which sections are expanded (all expanded by default)
  const [expandedSections, setExpandedSections] = useState<Set<GroupCategory>>(
    new Set(GROUP_ORDER)
  );

  // Group injections by category
  const groupedInjections = useMemo(
    () => groupByCategory(injections),
    [injections]
  );

  // Calculate total tokens
  const totalTokens = useMemo(
    () => injections.reduce((sum, inj) => sum + inj.estimatedTokens, 0),
    [injections]
  );

  // Toggle section expansion
  const toggleSection = (category: GroupCategory) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Get non-empty groups in order
  const nonEmptyGroups = useMemo(
    () =>
      GROUP_ORDER.filter((category) => {
        const group = groupedInjections.get(category);
        return group && group.length > 0;
      }),
    [groupedInjections]
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            CLAUDE.md Files
          </h2>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--color-surface-overlay)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {injections.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ~{formatTokens(totalTokens)} tokens
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors hover:bg-opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {injections.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No CLAUDE.md files detected in this session
          </div>
        ) : (
          nonEmptyGroups.map((category) => {
            const group = groupedInjections.get(category) || [];
            const config = GROUP_CONFIG[category];
            const sectionTokens = group.reduce(
              (sum, inj) => sum + inj.estimatedTokens,
              0
            );

            return (
              <CollapsibleSection
                key={category}
                title={config.label}
                count={group.length}
                tokenCount={sectionTokens}
                isExpanded={expandedSections.has(category)}
                onToggle={() => toggleSection(category)}
              >
                {category === 'directory' ? (
                  <DirectoryTreeNode node={buildDirectoryTree(group, projectRoot || '')} />
                ) : (
                  group.map((injection) => (
                    <InjectionItem key={injection.id} injection={injection} />
                  ))
                )}
              </CollapsibleSection>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SessionClaudeMdPanel;
