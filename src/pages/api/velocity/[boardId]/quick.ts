/**
 * Quick velocity API endpoint - Ultra-fast response
 * Following Clean Code: Single responsibility, immediate feedback
 * Strategy 5: Multi-Stage Loading - Stage 1 (< 10s)
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
    // Ultra-aggressive caching for quick endpoint
    const cacheKey = `velocity:quick:${boardId}`;
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
            'Cache-Control': 'public, max-age=180' // 3 minutes aggressive cache
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
        isQuick: true,
        isKanban: true,
        stage: 'quick',
        message: 'Kanban board - no velocity data available'
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

    // QUICK STRATEGY: Only last 3 sprints for ultra-fast response
    // Following Clean Code: Magic numbers as named constants
    const QUICK_SPRINT_LIMIT = 3;
    const quickSprints = sprintsResponse.data.slice(-QUICK_SPRINT_LIMIT);

    // Calculate velocity for quick sprints only
    const issuesApi = mcpClient.getIssuesApi();
    const sprintVelocities = await calculateRealSprintsVelocity(
      quickSprints,
      issuesApi,
      mcpClient
    );

    // Create quick data with stage metadata
    const quickData = createEnhancedVelocityData(
      boardId,
      boardName,
      sprintVelocities
    );

    // Add quick-specific metadata
    const result = {
      ...quickData,
      isQuick: true,
      stage: 'quick',
      totalSprintsAvailable: sprintsResponse.data.length,
      sprintsAnalyzed: quickSprints.length,
      remainingSprints: sprintsResponse.data.length - quickSprints.length,
      nextStageAvailable: sprintsResponse.data.length > QUICK_SPRINT_LIMIT,
      stageSummary: {
        current: 'quick',
        next: sprintsResponse.data.length > QUICK_SPRINT_LIMIT ? 'batch1' : null,
        progress: {
          completed: quickSprints.length,
          total: sprintsResponse.data.length,
          percentage: Math.round((quickSprints.length / sprintsResponse.data.length) * 100)
        }
      },
      timestamp: new Date().toISOString()
    };

    // Cache aggressively for quick responses
    setCachedData(cacheKey, result, CACHE_TTL.SHORT);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=180, stale-while-revalidate=60'
        } 
      }
    );

  } catch (error) {
    console.error('Quick API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error while fetching quick velocity data',
        stage: 'quick',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 