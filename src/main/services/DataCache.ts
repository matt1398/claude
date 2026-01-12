/**
 * DataCache service - LRU cache for parsed session data.
 *
 * Responsibilities:
 * - Cache parsed SessionDetail objects to avoid re-parsing
 * - LRU eviction policy with max 50 sessions
 * - Provide cache invalidation for file changes
 */

import { SessionDetail } from '../../renderer/types/data';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class DataCache {
  private cache: Map<string, CacheEntry<SessionDetail>>;
  private maxSize: number;
  private ttl: number; // Time-to-live in milliseconds

  constructor(maxSize: number = 50, ttlMinutes: number = 10) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Gets a cached session detail.
   * @param key - Cache key in format "projectId:sessionId"
   * @returns The cached SessionDetail, or undefined if not found or expired
   */
  get(key: string): SessionDetail | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Sets a value in the cache.
   * @param key - Cache key in format "projectId:sessionId"
   * @param value - The SessionDetail to cache
   */
  set(key: string, value: SessionDetail): void {
    // If at max size, remove least recently used (first entry)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Checks if a key exists in the cache and is not expired.
   * @param key - Cache key to check
   * @returns true if key exists and is valid, false otherwise
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Invalidates a specific cache entry.
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidates all cache entries for a project.
   * @param projectId - The project ID
   */
  invalidateProject(projectId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets current cache size.
   * @returns Number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Gets cache statistics.
   * @returns Object with cache stats
   */
  stats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Removes expired entries from the cache.
   * Should be called periodically to prevent memory bloat.
   */
  cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`DataCache: Cleaned ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Starts automatic cleanup of expired entries.
   * @param intervalMinutes - How often to run cleanup (default: 5 minutes)
   * @returns Timer handle that can be used to stop cleanup
   */
  startAutoCleanup(intervalMinutes: number = 5): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;
    return setInterval(() => {
      this.cleanExpired();
    }, intervalMs);
  }
}
