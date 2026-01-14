/**
 * SearchBar - In-session search interface component.
 * Appears at the top of the chat view when Cmd+F is pressed.
 */

import { useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useStore } from '../../store';

export function SearchBar() {
  const {
    searchQuery,
    searchVisible,
    searchResultCount,
    currentSearchIndex,
    setSearchQuery,
    hideSearch,
    nextSearchResult,
    previousSearchResult,
  } = useStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when search becomes visible
  useEffect(() => {
    if (searchVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [searchVisible]);

  // Handle keyboard shortcuts within search bar
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      hideSearch();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        previousSearchResult();
      } else {
        nextSearchResult();
      }
    }
  };

  if (!searchVisible) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-claude-dark-bg border-b border-claude-dark-border">
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in conversation..."
        className="flex-1 bg-claude-dark-surface text-claude-dark-text text-sm px-3 py-1.5 rounded border border-claude-dark-border focus:outline-none focus:border-claude-dark-text-secondary"
      />

      {/* Result count */}
      {searchQuery && (
        <span className="text-xs text-claude-dark-text-secondary whitespace-nowrap">
          {searchResultCount > 0
            ? `${currentSearchIndex + 1} of ${searchResultCount}`
            : 'No results'}
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-1">
        <button
          onClick={previousSearchResult}
          disabled={searchResultCount === 0}
          className="p-1.5 text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous result (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={nextSearchResult}
          disabled={searchResultCount === 0}
          className="p-1.5 text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next result (Enter)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={hideSearch}
        className="p-1.5 text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface rounded transition-colors"
        title="Close (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
