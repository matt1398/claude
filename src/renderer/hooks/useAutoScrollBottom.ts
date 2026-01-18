import { useRef, useEffect, useCallback } from 'react';

/**
 * Options for the auto-scroll hook.
 */
interface UseAutoScrollBottomOptions {
  /**
   * Threshold in pixels from bottom to consider "at bottom".
   * Default: 100px (generous threshold for better UX)
   */
  threshold?: number;

  /**
   * Smooth scroll duration in milliseconds.
   * Default: 300ms
   */
  smoothDuration?: number;

  /**
   * Whether auto-scroll is enabled.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Return type for the auto-scroll hook.
 */
interface UseAutoScrollBottomReturn {
  /**
   * Ref to attach to the scroll container element.
   */
  scrollContainerRef: React.RefObject<HTMLDivElement>;

  /**
   * Whether the user is currently at the bottom of the scroll container.
   */
  isAtBottom: boolean;

  /**
   * Manually scroll to bottom with smooth animation.
   */
  scrollToBottom: (behavior?: ScrollBehavior) => void;

  /**
   * Check and update the isAtBottom state.
   * Call this after content changes if needed.
   */
  checkIsAtBottom: () => boolean;
}

/**
 * Custom hook for managing auto-scroll-to-bottom behavior in chat-like interfaces.
 *
 * Features:
 * - Tracks whether user is at the bottom of the scroll container
 * - Automatically scrolls to bottom when content changes (if user was at bottom)
 * - Smooth scrolling animation
 * - Respects user's scroll position (doesn't force scroll if user scrolled up)
 *
 * @param dependencies - Array of dependencies that trigger scroll check (e.g., conversation items)
 * @param options - Configuration options
 * @returns Scroll management utilities
 *
 * @example
 * ```tsx
 * const { scrollContainerRef, isAtBottom, scrollToBottom } = useAutoScrollBottom(
 *   [conversation?.items.length],
 *   { threshold: 100 }
 * );
 *
 * return (
 *   <div ref={scrollContainerRef} className="overflow-y-auto">
 *     {items.map(renderItem)}
 *   </div>
 * );
 * ```
 */
export function useAutoScrollBottom(
  dependencies: unknown[],
  options: UseAutoScrollBottomOptions = {}
): UseAutoScrollBottomReturn {
  const {
    threshold = 100,
    smoothDuration = 300,
    enabled = true,
  } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true); // Start assuming at bottom
  const wasAtBottomBeforeUpdateRef = useRef(true);
  const isScrollingRef = useRef(false);

  /**
   * Check if the scroll container is at the bottom.
   */
  const checkIsAtBottom = useCallback((): boolean => {
    const container = scrollContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    return distanceFromBottom <= threshold;
  }, [threshold]);

  /**
   * Scroll to bottom with smooth animation.
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Prevent scroll event handler from updating isAtBottom during programmatic scroll
    isScrollingRef.current = true;

    const targetScrollTop = container.scrollHeight - container.clientHeight;

    if (behavior === 'smooth') {
      // Use native smooth scrolling
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      // Reset flag after animation completes
      setTimeout(() => {
        isScrollingRef.current = false;
        isAtBottomRef.current = true;
      }, smoothDuration);
    } else {
      container.scrollTop = targetScrollTop;
      isScrollingRef.current = false;
      isAtBottomRef.current = true;
    }
  }, [smoothDuration]);

  /**
   * Handle scroll events to track isAtBottom state.
   */
  const handleScroll = useCallback(() => {
    // Ignore scroll events during programmatic scrolling
    if (isScrollingRef.current) return;

    isAtBottomRef.current = checkIsAtBottom();
  }, [checkIsAtBottom]);

  /**
   * Set up scroll event listener.
   */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  /**
   * Before content updates, remember if we were at bottom.
   */
  useEffect(() => {
    wasAtBottomBeforeUpdateRef.current = isAtBottomRef.current;
  });

  /**
   * After content updates (dependencies change), scroll to bottom if we were at bottom.
   */
  useEffect(() => {
    if (!enabled) return;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      // Only auto-scroll if user was at bottom before the update
      if (wasAtBottomBeforeUpdateRef.current) {
        scrollToBottom('smooth');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    scrollContainerRef,
    isAtBottom: isAtBottomRef.current,
    scrollToBottom,
    checkIsAtBottom,
  };
}
