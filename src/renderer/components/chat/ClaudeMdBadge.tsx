/**
 * ClaudeMdBadge - Displays a compact badge showing CLAUDE.md injections.
 * Shows count of NEW injections in a group with hover popover for details.
 * Groups injections by category (Global, Project, Directory) like SessionClaudeMdPanel.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ClaudeMdStats, ClaudeMdSource, ClaudeMdInjection } from '../../types/claudeMd';

interface ClaudeMdBadgeProps {
  stats: ClaudeMdStats;
  projectRoot?: string;
}

// Group category definitions (same as SessionClaudeMdPanel)
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

/**
 * Convert an absolute path to a path relative to the project root.
 */
function toRelativePath(path: string, projectRoot: string | undefined): string {
  if (!projectRoot) return path;
  if (path.startsWith(projectRoot)) {
    const relative = path.slice(projectRoot.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return path;
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
 * Check if a source is global (blue tint) vs directory-based (green tint).
 */
function isGlobalSource(source: ClaudeMdSource): boolean {
  return source === 'enterprise' || source === 'user-memory';
}

/**
 * Format token count for display.
 */
function formatTokens(tokens: number): string {
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

export function ClaudeMdBadge({ stats, projectRoot }: ClaudeMdBadgeProps): React.ReactElement | null {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);

  // Group injections by category
  const groupedInjections = useMemo(
    () => groupByCategory(stats.newInjections),
    [stats.newInjections]
  );

  // Get non-empty groups in order
  const nonEmptyGroups = useMemo(
    () =>
      GROUP_ORDER.filter((category) => {
        const group = groupedInjections.get(category);
        return group && group.length > 0;
      }),
    [groupedInjections]
  );

  // Only render if there are new injections
  if (stats.newCount === 0) {
    return null;
  }

  // Check if we have any global sources (for badge color)
  const hasGlobalSources = stats.newInjections.some(inj => isGlobalSource(inj.source));
  const hasDirectorySources = stats.newInjections.some(inj => !isGlobalSource(inj.source));

  // Determine badge color based on source types
  // If mixed, use a neutral color; otherwise blue for global, green for directory
  let badgeStyle: React.CSSProperties;
  if (hasGlobalSources && hasDirectorySources) {
    // Mixed sources - use neutral/purple tint
    badgeStyle = {
      backgroundColor: 'rgba(139, 92, 246, 0.15)',
      border: '1px solid rgba(139, 92, 246, 0.4)',
      color: '#c4b5fd',
    };
  } else if (hasGlobalSources) {
    // Global sources only - blue tint
    badgeStyle = {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      color: '#93c5fd',
    };
  } else {
    // Directory sources only - green tint
    badgeStyle = {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      color: '#86efac',
    };
  }

  // Check available space and determine popover position
  useEffect(() => {
    if (showPopover && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const popoverWidth = 280; // Approximate width of popover

      // If there's not enough space on the right, open to the left
      if (rect.left + popoverWidth > viewportWidth - 20) {
        setPopoverPosition('right');
      } else {
        setPopoverPosition('left');
      }
    }
  }, [showPopover]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!showPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onClick={(e) => {
        e.stopPropagation();
        setShowPopover(!showPopover);
      }}
    >
      {/* Badge */}
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer"
        style={badgeStyle}
      >
        <span>CLAUDE.md</span>
        <span className="font-semibold">+{stats.newCount}</span>
      </span>

      {/* Popover */}
      {showPopover && (
        <div
          className="absolute z-50 top-full mt-1 min-w-[240px] max-w-[320px] rounded-lg shadow-xl p-3"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            ...(popoverPosition === 'left' ? { left: 0 } : { right: 0 }),
          }}
        >
          {/* Arrow pointer */}
          <div
            className="absolute -top-1 w-2 h-2 rotate-45"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              borderLeft: '1px solid var(--color-border)',
              borderTop: '1px solid var(--color-border)',
              ...(popoverPosition === 'left' ? { left: '12px' } : { right: '12px' }),
            }}
          />

          {/* Title */}
          <div
            className="text-xs font-semibold mb-2 pb-2"
            style={{
              color: 'var(--color-text)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            CLAUDE.md Injected
          </div>

          {/* Grouped injection list */}
          <div className="space-y-3">
            {nonEmptyGroups.map((category) => {
              const group = groupedInjections.get(category) || [];
              const config = GROUP_CONFIG[category];
              const isGlobal = category === 'global';

              return (
                <div key={category}>
                  {/* Group header */}
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {config.label}
                  </div>
                  {/* Group items - tree view for directory, flat list for others */}
                  {category === 'directory' ? (
                    <div className="pl-2">
                      <DirectoryTreeNode node={buildDirectoryTree(group, projectRoot || '')} />
                    </div>
                  ) : (
                    <div className="space-y-1.5 pl-2">
                      {group.map((injection) => {
                        // For global sources, show full path; for project/directory, show relative
                        const displayPath = isGlobal
                          ? injection.displayName
                          : toRelativePath(injection.path, projectRoot) || injection.displayName;

                        return (
                          <div key={injection.id} className="min-w-0">
                            <div
                              className="text-xs truncate"
                              style={{ color: 'var(--color-text-secondary)' }}
                              title={injection.path}
                            >
                              {displayPath}
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              ~{formatTokens(injection.estimatedTokens)} tokens
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total tokens footer */}
          {stats.newInjections.length > 1 && (
            <div
              className="mt-2 pt-2 flex justify-between items-center text-xs"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                ~{formatTokens(stats.newInjections.reduce((sum, inj) => sum + inj.estimatedTokens, 0))} tokens
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClaudeMdBadge;
