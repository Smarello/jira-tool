/**
 * Dashboard metrics API endpoint
 * Following Clean Architecture: API layer for dashboard aggregated metrics
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';
import { initializeRepositoryFactory } from '../../../lib/database/repository-factory';
import type { BoardMetrics } from '../../../lib/database/repositories/interfaces';

/**
 * Aggregated dashboard metrics interface
 * Following Clean Code: Express intent, clear data structure
 */
export interface DashboardMetrics {
  readonly boardsAnalyzed: number;
  readonly totalSprintsAnalyzed: number;
  readonly averageVelocity: number;
  readonly averagePredictability: number;
  readonly averageSprintCompletionRate: number;
  readonly lastUpdated: string;
  readonly boardDetails: BoardMetrics[];
}

/**
 * GET /api/dashboard/metrics
 * Returns aggregated metrics from all boards in board_metrics table
 * Following Clean Code: Command-Query Separation (query)
 */
export const GET: APIRoute = async () => {
  try {
    console.log('[DashboardAPI] Loading aggregated metrics from board_metrics table');

    // Initialize repository factory
    await initializeRepositoryFactory();
    const repositoryFactory = (await import('../../../lib/database/repository-factory')).getRepositoryFactory();

    if (!repositoryFactory) {
      throw new Error('Repository factory not initialized');
    }

    const boardMetricsRepo = repositoryFactory.createBoardMetricsRepository();

    // Get all board metrics for aggregation
    const allBoardMetrics = await boardMetricsRepo.getAllBoardMetrics();
    
    if (!allBoardMetrics || allBoardMetrics.length === 0) {
      console.log('[DashboardAPI] No board metrics found in database');
      
      // Return empty state when no data available
      const emptyMetrics: DashboardMetrics = {
        boardsAnalyzed: 0,
        totalSprintsAnalyzed: 0,
        averageVelocity: 0,
        averagePredictability: 0,
        averageSprintCompletionRate: 0,
        lastUpdated: new Date().toISOString(),
        boardDetails: []
      };

      return new Response(JSON.stringify(emptyMetrics), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Calculate aggregated metrics
    // Following Clean Code: Express intent, clear calculations
    const boardsAnalyzed = allBoardMetrics.length;
    const totalSprintsAnalyzed = allBoardMetrics.reduce((sum, board) => sum + board.sprintsAnalyzed, 0);
    
    // Calculate average velocity (weighted by number of sprints)
    const totalVelocityPoints = allBoardMetrics.reduce((sum, board) => 
      sum + (board.averageVelocity * board.sprintsAnalyzed), 0
    );
    const averageVelocity = totalSprintsAnalyzed > 0 
      ? Math.round(totalVelocityPoints / totalSprintsAnalyzed)
      : 0;

    // Calculate average predictability (weighted by number of sprints)
    const totalPredictabilityPoints = allBoardMetrics.reduce((sum, board) => 
      sum + (board.predictability * board.sprintsAnalyzed), 0
    );
    const averagePredictability = totalSprintsAnalyzed > 0 
      ? Math.round(totalPredictabilityPoints / totalSprintsAnalyzed)
      : 0;

    // Calculate average sprint completion rate (weighted by number of sprints)
    const totalCompletionRatePoints = allBoardMetrics.reduce((sum, board) => 
      sum + (board.averageSprintCompletionRate * board.sprintsAnalyzed), 0
    );
    const averageSprintCompletionRate = totalSprintsAnalyzed > 0 
      ? Math.round(totalCompletionRatePoints / totalSprintsAnalyzed)
      : 0;

    // Find most recent update
    const lastUpdated = allBoardMetrics.reduce((latest, board) => {
      return board.lastCalculated > latest ? board.lastCalculated : latest;
    }, allBoardMetrics[0].lastCalculated);

    const dashboardMetrics: DashboardMetrics = {
      boardsAnalyzed,
      totalSprintsAnalyzed,
      averageVelocity,
      averagePredictability,
      averageSprintCompletionRate,
      lastUpdated,
      boardDetails: allBoardMetrics
    };

    console.log(`[DashboardAPI] Aggregated metrics: ${boardsAnalyzed} boards, ${totalSprintsAnalyzed} sprints, avg velocity: ${averageVelocity}, avg predictability: ${averagePredictability}%, avg completion: ${averageSprintCompletionRate}%`);

    return new Response(JSON.stringify(dashboardMetrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('[DashboardAPI] Failed to load dashboard metrics:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to load dashboard metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
