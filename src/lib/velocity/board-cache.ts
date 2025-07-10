/**
 * Centralized board configuration cache
 * Following Clean Code: Single responsibility, express intent
 */

import type { McpAtlassianClient } from '../mcp/atlassian';

/**
 * Shared cache for board completion status IDs (last column) to avoid repeated API calls
 * Following Clean Code: Performance optimization, avoid repeated work
 */
const boardDoneStatusCache = new Map<string, readonly string[]>();

/**
 * Cache TTL in milliseconds (30 minutes)
 * Following Clean Code: Named constants, express intent
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Cache entry with timestamp for TTL management
 * Following Clean Code: Express intent, immutability
 */
interface CacheEntry {
  readonly data: readonly string[];
  readonly timestamp: number;
}

/**
 * Cache with TTL support
 * Following Clean Code: Single responsibility
 */
const boardDoneStatusCacheWithTtl = new Map<string, CacheEntry>();

/**
 * Cache statistics for monitoring
 * Following Clean Code: Observability
 */
let cacheStats = {
  hits: 0,
  misses: 0,
  apiCalls: 0
};

/**
 * Gets completion status IDs for a board (from last column) with shared caching and TTL
 * Following Clean Code: Performance optimization, avoid repeated API calls
 * Note: Returns status IDs from the last column, not just "Done" named columns
 */
export async function getDoneStatusIdsForBoard(
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<readonly string[]> {
  const now = Date.now();
  
  // Check TTL cache first
  const cachedEntry = boardDoneStatusCacheWithTtl.get(boardId);
  if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_TTL_MS) {
    cacheStats.hits++;
    console.log(`[BoardCache] Cache HIT for board ${boardId} (age: ${Math.round((now - cachedEntry.timestamp) / 1000)}s)`);
    return cachedEntry.data;
  }

  // Cache miss - need to fetch from API
  cacheStats.misses++;
  cacheStats.apiCalls++;
  
  console.log(`[BoardCache] Cache MISS for board ${boardId} - fetching from API`);
  console.log(`[BoardCache] Making API call to: /rest/agile/1.0/board/${boardId}/configuration`);

  try {
    const result = await mcpClient.getBoardDoneStatusIds(boardId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch board done status IDs');
    }
    
    const doneStatusIds = result.data;
    
    console.log(`[BoardCache] API call successful for board ${boardId} - found ${doneStatusIds.length} completion status IDs from last column`);
    
    // Cache the result with TTL
    boardDoneStatusCacheWithTtl.set(boardId, {
      data: doneStatusIds,
      timestamp: now
    });
    
    // Also update simple cache for backward compatibility
    boardDoneStatusCache.set(boardId, doneStatusIds);
    
    return doneStatusIds;
  } catch (error) {
    console.warn(`[BoardCache] Failed to get completion status IDs for board ${boardId}:`, error);
    return [];
  }
}

/**
 * Clears the board completion status cache
 * Following Clean Code: Explicit cache management
 */
export function clearBoardDoneStatusCache(): void {
  const entriesCleared = boardDoneStatusCacheWithTtl.size;
  boardDoneStatusCache.clear();
  boardDoneStatusCacheWithTtl.clear();
  
  console.log(`[BoardCache] Cache cleared - removed ${entriesCleared} entries`);
  
  // Reset stats
  cacheStats = {
    hits: 0,
    misses: 0,
    apiCalls: 0
  };
}

/**
 * Gets cache statistics for monitoring
 * Following Clean Code: Observability, express intent
 */
export function getBoardCacheStats(): {
  entriesCount: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  hits: number;
  misses: number;
  apiCalls: number;
  hitRate: number;
} {
  const entries = Array.from(boardDoneStatusCacheWithTtl.values());
  
  if (entries.length === 0) {
    return {
      entriesCount: 0,
      oldestEntry: null,
      newestEntry: null,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      apiCalls: cacheStats.apiCalls,
      hitRate: 0
    };
  }
  
  const timestamps = entries.map(entry => entry.timestamp);
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const hitRate = totalRequests > 0 ? Math.round((cacheStats.hits / totalRequests) * 100) : 0;
  
  return {
    entriesCount: entries.length,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    apiCalls: cacheStats.apiCalls,
    hitRate
  };
} 