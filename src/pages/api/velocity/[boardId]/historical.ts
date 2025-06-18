/**
 * Historical velocity data API endpoint with pagination
 * Following Clean Code: Single responsibility, pagination for performance
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian';
import { calculateRealSprintsVelocity } from '../../../../lib/velocity/calculator';
import { 
  createEnhancedVelocityData,
  type SprintVelocity 
} from '../../../../lib/velocity/mock-calculator';
import { getCachedData, setCachedData } from '../../../../lib/utils/cache';
import { CACHE_TTL } from '../../../../lib/utils/constants';

export const GET: APIRoute = async ({ params, url }) => {
  const boardId = params.boardId;
  
  // Validate required parameter
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Board ID is required' }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  // Parse pagination parameters
  // Following Clean Code: Express intent, clear parameter validation
  const searchParams = url.searchParams;
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  // Validate pagination parameters
  if (page < 1 || page > 100) {
    return new Response(
      JSON.stringify({ error: 'Page must be between 1 and 100' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  if (limit < 1 || limit > 20) {
    return new Response(
      JSON.stringify({ error: 'Limit must be between 1 and 20' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Cache key includes pagination for granular caching
    const cacheKey = `velocity:historical:${boardId}:page-${page}:limit-${limit}`;
    const cached = getCachedData<any>(cacheKey);
    
    if (cached) {
      return new Response(
        JSON.stringify({
          ...cached,
          fromCache: true,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=600' // 10 minutes cache for historical
          } 
        }
      );
    }

    // Initialize MCP client
    const mcpClient = getMcpAtlassianClient();
    
    // Fetch all sprints for pagination
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    
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

    const allSprints = sprintsResponse.data;
    
    // Handle empty board
    if (allSprints.length === 0) {
      return new Response(
        JSON.stringify({
          sprints: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false
          },
          isEmpty: true
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate pagination
    // Following Clean Code: Immutability, clear calculations
    const totalSprints = allSprints.length;
    const totalPages = Math.ceil(totalSprints / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalSprints);
    
    // Get sprints for current page (oldest first for historical view)
    const sprintsForPage = allSprints.slice(startIndex, endIndex);

    // Get board info
    const boardResponse = await mcpClient.getBoardInfo(boardId);
    const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

    // Calculate velocity for requested page
    const issuesApi = mcpClient.getIssuesApi();
    const sprintVelocities = await calculateRealSprintsVelocity(
      sprintsForPage,
      issuesApi,
      mcpClient
    );

    // Create historical data structure
    const result = {
      boardId,
      boardName,
      sprints: sprintVelocities,
      pagination: {
        page,
        limit,
        total: totalSprints,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      },
      metadata: {
        isHistorical: true,
        sprintsInPage: sprintVelocities.length,
        dateRange: sprintVelocities.length > 0 ? {
          from: sprintVelocities[0].sprint.startDate,
          to: sprintVelocities[sprintVelocities.length - 1].sprint.endDate
        } : null
      },
      timestamp: new Date().toISOString()
    };

    // Cache the result
    setCachedData(cacheKey, result, CACHE_TTL.LONG);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600, stale-while-revalidate=120'
        } 
      }
    );

  } catch (error) {
    console.error('Historical API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error while fetching historical velocity data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 