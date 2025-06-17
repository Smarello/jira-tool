/**
 * Debug endpoint for cache monitoring
 * Following Clean Code: Single responsibility, observability
 */

import type { APIRoute } from 'astro';
import { getBoardCacheStats, clearBoardDoneStatusCache } from '../../../lib/velocity/board-cache';

export const GET: APIRoute = async ({ url }) => {
  try {
    const cacheStats = getBoardCacheStats();
    
    return new Response(
      JSON.stringify({
        boardDoneStatusCache: {
          ...cacheStats,
          oldestEntryAge: cacheStats.oldestEntry 
            ? Math.round((Date.now() - cacheStats.oldestEntry) / 1000 / 60) + ' minutes'
            : null,
          newestEntryAge: cacheStats.newestEntry
            ? Math.round((Date.now() - cacheStats.newestEntry) / 1000 / 60) + ' minutes'
            : null,
          hitRatePercent: cacheStats.hitRate + '%'
        },
        summary: {
          totalApiCallsSaved: cacheStats.hits,
          efficiency: cacheStats.apiCalls > 0 
            ? `${cacheStats.apiCalls} API calls instead of ${cacheStats.hits + cacheStats.apiCalls}` 
            : 'No requests yet'
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get cache stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

export const DELETE: APIRoute = async () => {
  try {
    clearBoardDoneStatusCache();
    
    return new Response(
      JSON.stringify({
        message: 'Board cache cleared successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 