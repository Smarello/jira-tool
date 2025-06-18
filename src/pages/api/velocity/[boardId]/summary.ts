/**
 * Fast velocity summary API endpoint
 * Following Clean Code: Single responsibility, quick response for UX
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

export const GET: APIRoute = async ({ params }) => {
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

  try {
    // Check cache first for faster response
    const cacheKey = `velocity:summary:${boardId}`;
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
            'Cache-Control': 'public, max-age=300' // 5 minutes cache
          } 
        }
      );
    }

    // Initialize MCP client
    const mcpClient = getMcpAtlassianClient();
    
    // Fetch sprints (fast operation)
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

    // Handle Kanban boards
    if (sprintsResponse.data.length === 0) {
      const boardResponse = await mcpClient.getBoardInfo(boardId);
      const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;
      
      const kanbanResult = {
        boardId,
        boardName,
        sprints: [],
        averageVelocity: 0,
        trend: 'no-data' as const,
        predictability: 0,
        totalSprintsAnalyzed: 0,
        lastSprints: [],
        isKanban: true,
        message: 'This board does not support velocity tracking (likely a Kanban board)'
      };

      return new Response(
        JSON.stringify(kanbanResult),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=900' // 15 minutes for Kanban
          } 
        }
      );
    }

    // Get board info
    const boardResponse = await mcpClient.getBoardInfo(boardId);
    const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

    // For summary: only process last 5 sprints for speed
    // Following Clean Code: Magic numbers as named constants
    const SUMMARY_SPRINT_LIMIT = 5;
    const recentSprints = sprintsResponse.data.slice(-SUMMARY_SPRINT_LIMIT);

    // Calculate velocity for recent sprints only
    const issuesApi = mcpClient.getIssuesApi();
    const sprintVelocities = await calculateRealSprintsVelocity(
      recentSprints,
      issuesApi,
      mcpClient
    );

    // Create summary data with limited scope
    const summaryData = createEnhancedVelocityData(
      boardId,
      boardName,
      sprintVelocities
    );

    // Add summary-specific metadata
    const result = {
      ...summaryData,
      isSummary: true,
      totalSprintsAvailable: sprintsResponse.data.length,
      sprintsAnalyzed: recentSprints.length,
      lastSprints: sprintVelocities.slice(-3), // Last 3 for quick display
      timestamp: new Date().toISOString()
    };

    // Cache the result for faster subsequent requests
    setCachedData(cacheKey, result, CACHE_TTL.MEDIUM);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
        } 
      }
    );

  } catch (error) {
    console.error('Summary API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error while fetching velocity summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 