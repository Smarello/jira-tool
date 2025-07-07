/**
 * API endpoint for saving board velocity metrics
 * Following Clean Architecture: Presentation layer with proper error handling
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { APIRoute } from 'astro';
import { initializeRepositoryFactory } from '../../../lib/database';
import type { BoardMetrics } from '../../../lib/database';

/**
 * POST endpoint to save board velocity metrics
 * Following Clean Code: Command pattern, error handling
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate request content type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Content-Type must be application/json' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    let metricsData: BoardMetrics;
    try {
      metricsData = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate required fields
    const requiredFields = ['boardId', 'boardName', 'averageVelocity', 'predictability', 'trend', 'sprintsAnalyzed', 'averageSprintCompletionRate'];
    const missingFields = requiredFields.filter(field => 
      metricsData[field as keyof BoardMetrics] === undefined || 
      metricsData[field as keyof BoardMetrics] === null
    );

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize repository factory for database operations
    // Following Clean Code: Dependency initialization, fail-fast principle
    await initializeRepositoryFactory();
    const repositoryFactory = await import('../../../lib/database').then(m => m.getRepositoryFactory());
    const metricsRepository = repositoryFactory.createBoardMetricsRepository();

    // Add server-side timestamp if not provided
    if (!metricsData.lastCalculated) {
      metricsData.lastCalculated = new Date().toISOString();
    }

    // Save metrics to database
    // Following Clean Code: Single responsibility, error propagation
    await metricsRepository.saveBoardMetrics(metricsData);

    console.log(`[MetricsAPI] Saved metrics for board ${metricsData.boardId}: avg=${metricsData.averageVelocity}, predictability=${metricsData.predictability}, trend=${metricsData.trend}, sprints=${metricsData.sprintsAnalyzed}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Metrics saved successfully for board ${metricsData.boardId}` 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[MetricsAPI] Failed to save metrics:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error while saving metrics' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

/**
 * Handle unsupported HTTP methods
 * Following Clean Code: Explicit error handling
 */
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ 
      success: false,
      error: 'Method not allowed. Use POST to save metrics.' 
    }),
    { 
      status: 405, 
      headers: { 
        'Content-Type': 'application/json',
        'Allow': 'POST'
      } 
    }
  );
};
