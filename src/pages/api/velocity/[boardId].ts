/**
 * API endpoint for fetching velocity data for a specific board
 * Following Clean Code: Single responsibility, parameter validation
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../lib/mcp/atlassian';

import {
  createEnhancedVelocityData
} from '../../../lib/velocity/mock-calculator';
import { getVelocityCacheService } from '../../../lib/services/velocity-cache-service';

export const GET: APIRoute = async ({ params, request }) => {
  const boardId = params.boardId;
  
  // Validate required parameter
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ 
        error: 'Board ID is required' 
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Use MCP client for consistent API
    const mcpClient = getMcpAtlassianClient();
    const velocityCacheService = getVelocityCacheService();

    // Check for force refresh parameter
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    
    // Handle Kanban boards that don't have sprints
    if (sprintsResponse.success && sprintsResponse.data.length === 0) {
      const boardResponse = await mcpClient.getBoardInfo(boardId);
      const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;
      
      return new Response(
        JSON.stringify({
          boardId,
          boardName,
          sprints: [],
          averageVelocity: 0,
          trend: 'no-data',
          predictability: 0,
          message: 'This board does not support velocity tracking (likely a Kanban board)',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!sprintsResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: sprintsResponse.error || 'Failed to fetch sprints' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get board info for real board name
    const boardResponse = await mcpClient.getBoardInfo(boardId);
    const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

    // Get velocity data with intelligent caching
    let cachedVelocityData;

    if (forceRefresh) {
      // Force refresh: fetch from JIRA and update cache
      cachedVelocityData = await velocityCacheService.fetchAndCacheClosedSprintsData(
        boardId,
        mcpClient
      );
    } else {
      // Smart caching: try cache first, then fallback to JIRA API
      cachedVelocityData = await velocityCacheService.getClosedSprintsWithCache(
        boardId,
        mcpClient
      );
    }

    // Create enhanced velocity data for response
    const velocityData = createEnhancedVelocityData(
      boardId,
      boardName,
      cachedVelocityData.velocities
    );

    return new Response(
      JSON.stringify({
        ...velocityData,
        fromCache: cachedVelocityData.fromCache,
        cacheAge: cachedVelocityData.cacheAge,
        lastUpdated: cachedVelocityData.lastUpdated,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cachedVelocityData.fromCache
            ? 'public, max-age=3600, stale-while-revalidate=300'
            : 'public, max-age=300'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
