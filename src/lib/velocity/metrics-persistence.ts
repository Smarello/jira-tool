/**
 * Utility for persisting calculated velocity metrics to database
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { BoardMetrics } from '../database';
import type { CombinedVelocityData } from './multi-stage-loader';

/**
 * Saves calculated velocity metrics via API endpoint
 * Following Clean Code: Express intent, error handling, client-server separation
 */
export async function saveBoardMetrics(velocityData: CombinedVelocityData): Promise<void> {
  try {
    // Only save metrics if we have meaningful data (at least one closed sprint)
    if (velocityData.closedSprints.length === 0) {
      console.log(`[MetricsPersistence] Skipping metrics save for board ${velocityData.boardId} - no closed sprints`);
      return;
    }

    const metrics: BoardMetrics = {
      boardId: velocityData.boardId,
      boardName: velocityData.boardName,
      averageVelocity: velocityData.averageVelocity,
      predictability: velocityData.predictability,
      trend: velocityData.trend,
      sprintsAnalyzed: velocityData.summary.totalSprintsAnalyzed,
      averageSprintCompletionRate: velocityData.averageSprintCompletionRate,
      lastCalculated: new Date().toISOString(),
    };

    // Call server-side API to save metrics
    // Following Clean Code: Client-server separation, dependency inversion
    const response = await fetch('/api/velocity/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metrics),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error ${response.status}: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API returned failure status');
    }

    console.log(`[MetricsPersistence] Saved metrics for board ${velocityData.boardId}: avg=${metrics.averageVelocity}, predictability=${metrics.predictability}, trend=${metrics.trend}, sprints=${metrics.sprintsAnalyzed}`);

  } catch (error) {
    // Log error but don't fail the main operation
    console.error(`[MetricsPersistence] Failed to save metrics for board ${velocityData.boardId}:`, error);
  }
}

/**
 * Gets cached board metrics from database
 * Following Clean Code: Express intent, graceful degradation
 * TODO: Implement via API endpoint when needed
 */
export async function getCachedBoardMetrics(boardId: string): Promise<BoardMetrics | null> {
  try {
    // TODO: Implement API call to GET /api/velocity/metrics/[boardId]
    // For now, return null to indicate no cached data available
    console.log(`[MetricsPersistence] getCachedBoardMetrics not implemented via API yet for board ${boardId}`);
    return null;
  } catch (error) {
    console.error(`[MetricsPersistence] Failed to get cached metrics for board ${boardId}:`, error);
    return null;
  }
}

/**
 * Checks if cached metrics are still fresh (within specified hours)
 * Following Clean Code: Express intent, business logic
 */
export function areMetricsFresh(metrics: BoardMetrics, maxAgeHours: number = 24): boolean {
  const lastCalculated = new Date(metrics.lastCalculated);
  const now = new Date();
  const ageHours = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
  
  return ageHours <= maxAgeHours;
}
