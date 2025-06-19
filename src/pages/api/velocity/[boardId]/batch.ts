/**
 * Batch velocity API endpoint - Safe chunked processing
 * Following Clean Code: Single responsibility, safe batch processing
 * Strategy 5: Multi-Stage Loading - Stages 2+ (15-45s each)
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian';
import {
  calculateRealSprintsVelocityWithIssues
} from '../../../../lib/velocity/calculator';
import { getCachedData, setCachedData } from '../../../../lib/utils/cache';
import { CACHE_TTL } from '../../../../lib/utils/constants';
import { initializeDatabaseService } from '../../../../lib/database';

// Load environment variables explicitly for Astro
import { config } from 'dotenv';
config();

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

    // Calculate velocity for safe batch with issues data
    const issuesApi = mcpClient.getIssuesApi();
    const batchResult = await calculateRealSprintsVelocityWithIssues(
      safeBatchSprints,
      issuesApi,
      mcpClient
    );

    const sprintVelocities = batchResult.velocities;

    // Persist closed sprints to database
    // Following Clean Code: Single responsibility, robust error handling
    let persistenceResults: { success: boolean; successful: number; failed: number; error?: string } | null = null;
    let persistenceError = null;

    console.log('[Batch] Starting database persistence process...');

    try {
      console.log('[Batch] Initializing database service...');
      const databaseService = await initializeDatabaseService();
      console.log('[Batch] Database service initialized successfully');

      // Prepare data for batch persistence (only closed sprints)
      console.log('[Batch] Filtering closed sprints from batch...');
      console.log('[Batch] Total sprints in batch:', safeBatchSprints.length);
      console.log('[Batch] Sprint states:', safeBatchSprints.map(s => `${s.name}: ${s.state}`));

      const closedSprintsWithIssues = safeBatchSprints
        .filter(sprint => sprint.state === 'closed')
        .map(sprint => ({
          sprint,
          issues: batchResult.sprintIssuesMap.get(sprint.id) || []
        }));

      console.log('[Batch] Closed sprints found:', closedSprintsWithIssues.length);

      if (closedSprintsWithIssues.length > 0) {
        console.log(`[Batch] Persisting ${closedSprintsWithIssues.length} closed sprints to database`);

        // Create velocity data map for persistence
        const velocityDataMap = new Map();
        sprintVelocities.forEach(velocity => {
          if (velocity.sprint.state === 'closed') {
            velocityDataMap.set(velocity.sprint.id, {
              sprintId: velocity.sprint.id,
              committedPoints: velocity.committedPoints,
              completedPoints: velocity.completedPoints,
              issuesCount: batchResult.sprintIssuesMap.get(velocity.sprint.id)?.length || 0,
              completedIssuesCount: velocity.velocityPoints > 0 ?
                Math.round(velocity.velocityPoints / velocity.completedPoints *
                  (batchResult.sprintIssuesMap.get(velocity.sprint.id)?.length || 0)) : 0,
              cycleTime: 0, // Will be calculated by persistence service
              averageLeadTime: 0 // Will be calculated by persistence service
            });
          }
        });

        // Persist to database with timeout (non-blocking - don't fail the response if DB fails)
        const persistencePromise = databaseService.saveClosedSprintsBatch(
          closedSprintsWithIssues,
          velocityDataMap
        );

        // Add timeout to prevent database operations from blocking the response
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database persistence timeout (10s)')), 10000);
        });

        try {
          const result = await Promise.race([persistencePromise, timeoutPromise]);
          persistenceResults = result as { success: boolean; successful: number; failed: number; error?: string };
          console.log(`[Batch] Database persistence completed successfully:`, {
            successful: persistenceResults.successful,
            failed: persistenceResults.failed,
            success: persistenceResults.success
          });
        } catch (timeoutOrDbError) {
          persistenceError = timeoutOrDbError instanceof Error ? timeoutOrDbError.message : 'Database operation failed';
          console.warn('[Batch] Database persistence failed or timed out:', persistenceError);

          persistenceResults = {
            success: false,
            error: persistenceError,
            successful: 0,
            failed: closedSprintsWithIssues.length
          };
        }
      } else {
        console.log('[Batch] No closed sprints to persist to database');
        console.log('[Batch] This means either:');
        console.log('[Batch] 1. No sprints in the batch are in "closed" state');
        console.log('[Batch] 2. All sprints are "active" or "future"');
      }
    } catch (initError) {
      persistenceError = initError instanceof Error ? initError.message : 'Database service initialization failed';
      console.warn('[Batch] Database service initialization failed:', persistenceError);

      persistenceResults = {
        success: false,
        error: persistenceError,
        successful: 0,
        failed: safeBatchSprints.filter(sprint => sprint.state === 'closed').length
      };
    }

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
      // Add database persistence info to response
      database: persistenceResults ? {
        persistedSprints: persistenceResults.successful || 0,
        failedSprints: persistenceResults.failed || 0,
        success: persistenceResults.success || false
      } : null,
      timestamp: new Date().toISOString()
    };

    // Log final result for debugging
    console.log('[Batch] Final response database info:', result.database);
    console.log('[Batch] Persistence results summary:', persistenceResults);

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