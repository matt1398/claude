import { useState, useEffect, useMemo } from 'react';

interface HighlightedTextProps {
  text: string;
  projectPath?: string;
  className?: string;
}

// Patterns
const SKILL_PATTERN = /\/([a-zA-Z][a-zA-Z0-9-]*)/g;
const PATH_PATTERN = /@([^\s,)}\]]+)/g;

export function HighlightedText({ text, projectPath, className = '' }: HighlightedTextProps) {
  const [validatedMentions, setValidatedMentions] = useState<Record<string, boolean>>({});

  // Extract all mentions from text
  const mentions = useMemo(() => {
    if (!text) {
      return [];
    }

    const result: { type: 'skill' | 'path'; value: string; raw: string }[] = [];

    let match;
    SKILL_PATTERN.lastIndex = 0;
    while ((match = SKILL_PATTERN.exec(text)) !== null) {
      result.push({ type: 'skill', value: match[1], raw: match[0] });
    }

    PATH_PATTERN.lastIndex = 0;
    while ((match = PATH_PATTERN.exec(text)) !== null) {
      result.push({ type: 'path', value: match[1], raw: match[0] });
    }

    return result;
  }, [text]);

  // Validate mentions when text or projectPath changes
  useEffect(() => {
    if (!projectPath || mentions.length === 0) {
      setValidatedMentions({});
      return;
    }

    const validateAll = async () => {
      try {
        const toValidate = mentions.map(m => ({ type: m.type, value: m.value }));
        const results = await window.electronAPI.validateMentions(toValidate, projectPath);
        setValidatedMentions(results);
      } catch (err) {
        console.error('Validation failed:', err);
        setValidatedMentions({});
      }
    };

    validateAll();
  }, [text, projectPath, mentions]);

  // Render text with highlights
  const renderedParts = useMemo(() => {
    if (!text) {
      return [];
    }

    // Combined pattern for both types
    const COMBINED_PATTERN = /(\/[a-zA-Z][a-zA-Z0-9-]*)|(@[^\s,)}\]]+)/g;

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    COMBINED_PATTERN.lastIndex = 0;
    while ((match = COMBINED_PATTERN.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const fullMatch = match[0];
      const isSkill = fullMatch.startsWith('/');
      const key = fullMatch; // e.g., "/isolate-context" or "@src/main"
      const isValid = validatedMentions[key] === true;

      if (isValid) {
        // Only highlight if validated
        const highlightClass = isSkill
          ? 'bg-amber-900/30 text-amber-200 px-0.5 rounded'
          : 'bg-orange-900/30 text-orange-300 px-0.5 rounded';

        parts.push(
          <span key={match.index} className={highlightClass}>
            {fullMatch}
          </span>
        );
      } else {
        // Not valid or not yet validated - render as plain text
        parts.push(fullMatch);
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [text, validatedMentions]);

  // Handle empty text case
  if (!text) {
    return <span className={className}></span>;
  }

  // If no matches found, return original text
  if (renderedParts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{renderedParts}</span>;
}
