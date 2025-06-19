/**
 * Cache management API endpoint for velocity data
 * Following Clean Code: Single responsibility, cache management
 */

import type { APIRoute } from 'astro';
import { getVelocityCacheService } from '../../../../lib/services/velocity-cache-service';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian';

export const GET: APIRoute = async ({ params }) => {
  const boardId = params.boardId;
  
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Board ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const velocityCacheService = getVelocityCacheService();
    
    // Get cached velocity data only (no API calls)
    const cachedData = await velocityCacheService.getCachedClosedSprintsVelocity(boardId);
    
    if (!cachedData) {
      return new Response(
        JSON.stringify({ 
          message: 'No cached data available for this board',
          boardId,
          cached: false
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        boardId,
        cached: true,
        cacheAge: cachedData.cacheAge,
        lastUpdated: cachedData.lastUpdated,
        totalSprints: cachedData.totalSprints,
        velocities: cachedData.velocities.map(v => ({
          sprintId: v.sprintId,
          sprintName: v.sprintName,
          completedPoints: v.completedPoints,
          committedPoints: v.committedPoints,
          velocityPercentage: v.velocityPercentage
        }))
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to retrieve cache information',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  const boardId = params.boardId;
  
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Board ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const mcpClient = getMcpAtlassianClient();
    const velocityCacheService = getVelocityCacheService();
    
    // Get sprints for the board
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    
    if (!sprintsResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: sprintsResponse.error || 'Failed to fetch sprints' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Force refresh velocity data and update cache
    const issuesApi = mcpClient.getIssuesApi();
    const refreshedData = await velocityCacheService.refreshVelocityData(
      boardId,
      sprintsResponse.data,
      issuesApi,
      mcpClient
    );

    return new Response(
      JSON.stringify({
        message: 'Cache refreshed successfully',
        boardId,
        refreshed: true,
        totalSprints: refreshedData.totalSprints,
        lastUpdated: refreshedData.lastUpdated,
        velocitiesCount: refreshedData.velocities.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to refresh cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
