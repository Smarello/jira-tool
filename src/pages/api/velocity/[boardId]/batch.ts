/**
 * Batch velocity API endpoint - Safe chunked processing
 * Following Clean Code: Single responsibility, safe batch processing
 * Strategy 5: Multi-Stage Loading - Stages 2+ (15-45s each)
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

  // Parse batch parameters
  // Following Clean Code: Express intent, clear parameter validation
  const searchParams = url.searchParams;
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const maxIssuesParam = searchParams.get('maxIssues');
  
  const start = startParam ? parseInt(startParam, 10) : 0;
  const end = endParam ? parseInt(endParam, 10) : 5;
  const maxIssues = maxIssuesParam ? parseInt(maxIssuesParam, 10) : 150;
  
  // Validate batch parameters for safety
  if (start < 0 || end < start || (end - start) > 8) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid range: start must be ≥0, end > start, max 8 sprints per batch' 
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  if (maxIssues < 50 || maxIssues > 200) {
    return new Response(
      JSON.stringify({ 
        error: 'maxIssues must be between 50 and 200 for safety' 
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Granular caching per batch range
    const cacheKey = `velocity:batch:${boardId}:${start}-${end}:maxIssues-${maxIssues}`;
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
            'Cache-Control': 'public, max-age=300' // 5 minutes for batch data
          } 
        }
      );
    }

    // Initialize MCP client
    const mcpClient = getMcpAtlassianClient();
    
    // Fetch all sprints for range calculation
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
    
    // Handle empty board or invalid range
    if (allSprints.length === 0 || start >= allSprints.length) {
      return new Response(
        JSON.stringify({
          sprints: [],
          batch: {
            start,
            end,
            actual: { start: 0, end: 0 },
            sprintsInBatch: 0,
            totalSprints: allSprints.length,
            isEmpty: true
          },
          stage: 'batch',
          message: 'No sprints in requested range'
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate safe range with issue-based limiting
    // Following Clean Code: Immutability, clear transformations
    const actualEnd = Math.min(end, allSprints.length);
    let batchSprints = allSprints.slice(start, actualEnd);
    
    // SAFETY: Limit by issue count to prevent timeout
    let totalIssuesEstimate = 0;
    const safeBatchSprints = [];
    
    for (const sprint of batchSprints) {
      // Estimate issues per sprint (rough heuristic: 30-50 issues per sprint)
      const estimatedIssues = 40; // Conservative estimate
      
      if (totalIssuesEstimate + estimatedIssues > maxIssues) {
        console.log(`[Batch] Stopping at sprint ${sprint.name} to stay under ${maxIssues} issues limit`);
        break;
      }
      
      safeBatchSprints.push(sprint);
      totalIssuesEstimate += estimatedIssues;
    }

    // Get board info
    const boardResponse = await mcpClient.getBoardInfo(boardId);
    const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

    // Calculate velocity for safe batch
    const issuesApi = mcpClient.getIssuesApi();
    const sprintVelocities = await calculateRealSprintsVelocity(
      safeBatchSprints,
      issuesApi,
      mcpClient
    );

    // Create batch data structure
    const result = {
      boardId,
      boardName,
      sprints: sprintVelocities,
      batch: {
        requested: { start, end },
        actual: { 
          start, 
          end: start + safeBatchSprints.length 
        },
        sprintsInBatch: safeBatchSprints.length,
        totalSprints: allSprints.length,
        maxIssuesLimit: maxIssues,
        estimatedIssues: totalIssuesEstimate,
        limitApplied: safeBatchSprints.length < batchSprints.length
      },
      stage: 'batch',
      metadata: {
        dateRange: safeBatchSprints.length > 0 ? {
          from: safeBatchSprints[0].startDate,
          to: safeBatchSprints[safeBatchSprints.length - 1].endDate
        } : null,
        hasMore: start + safeBatchSprints.length < allSprints.length,
        nextBatchStart: start + safeBatchSprints.length,
        progress: {
          completed: start + safeBatchSprints.length,
          total: allSprints.length,
          percentage: Math.round(((start + safeBatchSprints.length) / allSprints.length) * 100)
        }
      },
      timestamp: new Date().toISOString()
    };

    // Cache the result
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
    console.error('Batch API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error while fetching batch velocity data',
        stage: 'batch',
        batch: { start, end },
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 