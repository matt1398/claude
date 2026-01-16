/**
 * SearchHighlight - Highlights search query matches in text.
 * Used for Cmd+F in-session search functionality.
 */

import { useMemo } from 'react';
import { useStore } from '../../store';

interface SearchHighlightProps {
  /** The text to search and highlight within */
  text: string;
  /** The ID of the item containing this text (for matching current result) */
  itemId: string;
  /** Additional className for the wrapper */
  className?: string;
}

export function SearchHighlight({ text, itemId, className = '' }: SearchHighlightProps) {
  const { searchQuery, searchMatches, currentSearchIndex } = useStore();

  // Determine if this item has the current search result
  const currentMatch = currentSearchIndex >= 0 ? searchMatches[currentSearchIndex] : null;
  const isCurrentItem = currentMatch?.itemId === itemId;

  // Render text with highlighted matches
  const renderedParts = useMemo(() => {
    if (!text || !searchQuery || searchQuery.trim().length === 0) {
      return null;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let matchIndex = 0;
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      // Add text before match
      if (pos > lastIndex) {
        parts.push(text.slice(lastIndex, pos));
      }

      // Determine if this is the current highlighted result
      const isCurrentResult = isCurrentItem && currentMatch?.matchIndexInItem === matchIndex;

      // Use CSS custom properties for theme-aware highlighting
      const baseStyles: React.CSSProperties = {
        borderRadius: '0.125rem',
        padding: '0 0.125rem',
      };

      const highlightStyles: React.CSSProperties = isCurrentResult
        ? {
            ...baseStyles,
            backgroundColor: 'var(--highlight-bg)',
            color: 'var(--highlight-text)',
            boxShadow: '0 0 0 1px var(--highlight-ring)',
          }
        : {
            ...baseStyles,
            backgroundColor: 'var(--highlight-bg-inactive)',
            color: 'var(--highlight-text-inactive)',
          };

      parts.push(
        <mark
          key={`${pos}-${matchIndex}`}
          style={highlightStyles}
          data-search-result={isCurrentResult ? 'current' : 'match'}
        >
          {text.slice(pos, pos + searchQuery.length)}
        </mark>
      );

      lastIndex = pos + searchQuery.length;
      pos = lastIndex;
      matchIndex++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : null;
  }, [text, searchQuery, isCurrentItem, currentMatch?.matchIndexInItem]);

  // If no search or no matches, return original text
  if (!renderedParts) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{renderedParts}</span>;
}
