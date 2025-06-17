/**
 * Cache monitoring endpoint
 * Following Clean Code: Single responsibility, clear intent
 */

import type { APIRoute } from 'astro';
import { getCacheSize, clearCache } from '../../lib/utils/cache';

export const GET: APIRoute = () => {
  const cacheInfo = {
    size: getCacheSize(),
    timestamp: new Date().toISOString()
  };

  return new Response(
    JSON.stringify(cacheInfo),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};

export const DELETE: APIRoute = () => {
  clearCache();
  
  return new Response(
    JSON.stringify({ message: 'Cache cleared successfully' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
