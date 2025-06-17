/**
 * Simple in-memory cache for API responses
 * Following Clean Code: Single responsibility, immutability
 */

import { CACHE_TTL } from './constants';

interface CacheEntry<T> {
  readonly data: T;
  readonly timestamp: number;
  readonly ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Gets cached data if not expired
 * Command-Query Separation: this function answers a question
 */
export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  
  if (!entry) {
    return null;
  }

  const isExpired = Date.now() - entry.timestamp > entry.ttl;
  
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Sets data in cache with current timestamp and TTL
 * Command-Query Separation: this function does something
 */
export function setCachedData<T>(key: string, data: T, ttl: number = CACHE_TTL.MEDIUM): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Clears all cached data
 * Utility function for cache management
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Gets cache size for monitoring
 * Utility function: small, focused responsibility
 */
export function getCacheSize(): number {
  return cache.size;
}
