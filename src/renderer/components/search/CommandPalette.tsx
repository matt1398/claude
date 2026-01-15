/**
 * CommandPalette - Spotlight/Alfred-like search modal.
 * Triggered by Cmd+K, searches across all sessions in the current project.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X, FileText, User, Bot, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import type { SearchResult } from '../../types/data';

export function CommandPalette() {
  const {
    commandPaletteOpen,
    closeCommandPalette,
    selectedProjectId,
    navigateToSession,
  } = useStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  // Focus input when palette opens
  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  // Search with debounce
  useEffect(() => {
    if (!commandPaletteOpen || !selectedProjectId || query.trim().length < 2) {
      setResults([]);
      setTotalMatches(0);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResult = await window.electronAPI.searchSessions(
          selectedProjectId,
          query.trim(),
          50
        );
        setResults(searchResult.results);
        setTotalMatches(searchResult.totalMatches);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setTotalMatches(0);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, selectedProjectId, commandPaletteOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        handleResultClick(selected);
      }
      return;
    }
  }, [results, selectedIndex, closeCommandPalette]);

  // Handle result click
  const handleResultClick = useCallback((result: SearchResult) => {
    closeCommandPalette();
    navigateToSession(result.projectId, result.sessionId);
  }, [closeCommandPalette, navigateToSession]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeCommandPalette();
    }
  }, [closeCommandPalette]);

  // Highlight matched text in context
  const highlightMatch = useCallback((context: string, matchedText: string) => {
    const lowerContext = context.toLowerCase();
    const lowerMatch = matchedText.toLowerCase();
    const matchIndex = lowerContext.indexOf(lowerMatch);

    if (matchIndex === -1) {
      return <span>{context}</span>;
    }

    const before = context.slice(0, matchIndex);
    const match = context.slice(matchIndex, matchIndex + matchedText.length);
    const after = context.slice(matchIndex + matchedText.length);

    return (
      <>
        <span>{before}</span>
        <mark className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{match}</mark>
        <span>{after}</span>
      </>
    );
  }, []);

  if (!commandPaletteOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl bg-claude-dark-bg border border-claude-dark-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-claude-dark-border">
          <Search className="w-5 h-5 text-claude-dark-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-claude-dark-text text-base placeholder:text-claude-dark-text-secondary/50 focus:outline-none"
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-claude-dark-text-secondary animate-spin" />
          )}
          <button
            onClick={closeCommandPalette}
            className="p-1 text-claude-dark-text-secondary hover:text-claude-dark-text rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!selectedProjectId ? (
            <div className="px-4 py-8 text-center text-claude-dark-text-secondary text-sm">
              Select a project first to search
            </div>
          ) : query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-claude-dark-text-secondary text-sm">
              Type at least 2 characters to search
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-claude-dark-text-secondary text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.sessionId}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-claude-dark-surface'
                      : 'hover:bg-claude-dark-surface/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 ${
                      result.messageType === 'user'
                        ? 'text-blue-400'
                        : 'text-green-400'
                    }`}>
                      {result.messageType === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Session title */}
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3 h-3 text-claude-dark-text-secondary" />
                        <span className="text-xs text-claude-dark-text-secondary truncate">
                          {result.sessionTitle.slice(0, 60)}
                          {result.sessionTitle.length > 60 ? '...' : ''}
                        </span>
                      </div>

                      {/* Context with highlighted match */}
                      <div className="text-sm text-claude-dark-text leading-relaxed">
                        {highlightMatch(result.context, result.matchedText)}
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-claude-dark-text-secondary/60 mt-1">
                        {new Date(result.timestamp).toLocaleDateString()} {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-claude-dark-border text-xs text-claude-dark-text-secondary flex items-center justify-between">
            <span>{totalMatches} result{totalMatches !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-claude-dark-surface rounded text-[10px]">↑↓</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-claude-dark-surface rounded text-[10px]">↵</kbd> open</span>
              <span><kbd className="px-1.5 py-0.5 bg-claude-dark-surface rounded text-[10px]">esc</kbd> close</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
