/**
 * Multi-Stage Velocity Data Loader
 * Following Clean Code: Strategy pattern, Single Responsibility Principle
 * Strategy 5: Multi-Stage Loading Implementation
 */

import type { SprintVelocity } from './mock-calculator';
import { saveBoardMetrics } from './metrics-persistence';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MultiStageConfig {
  /** Maximum issues per batch to prevent timeouts */
  maxIssuesPerBatch: number;
  /** Maximum sprints per batch for safety */
  maxSprintsPerBatch: number;
  /** Enable parallel batch loading */
  enableParallelBatches: boolean;
  /** Timeout for each stage in milliseconds */
  stageTimeoutMs: number;
}

export interface StageResult {
  stage: 'quick' | 'batch';
  boardId: string;
  boardName: string;
  sprints: SprintVelocity[];
  activeSprint?: SprintVelocity | null; // NEW: Direct active sprint access
  closedSprintsList?: any[]; // NEW: List for batch processing (JiraSprint[])
  success: boolean;
  error?: string;
  metadata: {
    sprintsAnalyzed: number;
    totalSprints: number;
    totalClosedSprints?: number; // NEW
    hasActiveSprint?: boolean; // NEW
    progress: {
      completed: number;
      total: number;
      percentage: number;
    };
    hasMore: boolean;
    nextBatchStart?: number;
  };
  timing: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
  fromCache?: boolean;
}

export interface CombinedVelocityData {
  boardId: string;
  boardName: string;
  closedSprints: readonly SprintVelocity[];  // Only closed sprints for velocity metrics
  activeSprint: SprintVelocity | null;       // Current active sprint for display only
  averageVelocity: number;
  trend: 'up' | 'down' | 'stable' | 'no-data';
  predictability: number;
  summary: {
    totalSprintsAnalyzed: number;
    totalSprintsAvailable: number;
    completionPercentage: number;
    loadingStrategy: 'quick-only' | 'quick-plus-batches' | 'complete';
  };
  timestamp: string;
}

export type ProgressCallback = (progress: {
  stage: string;
  completed: number;
  total: number;
  percentage: number;
  message: string;
}) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MultiStageConfig = {
  maxIssuesPerBatch: 150,
  maxSprintsPerBatch: 6,
  enableParallelBatches: false, // Safe default for Vercel
  stageTimeoutMs: 45000 // 45 seconds per stage
};

// ============================================================================
// MULTI-STAGE VELOCITY LOADER CLASS
// ============================================================================

export class MultiStageVelocityLoader {
  private config: MultiStageConfig;
  private abortController: AbortController | null = null;

  constructor(config: Partial<MultiStageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: Load velocity data using multi-stage strategy
   * Following Clean Code: Clear public interface, predictable behavior
   */
  async loadVelocityData(
    boardId: string,
    onProgress?: ProgressCallback
  ): Promise<CombinedVelocityData> {
    this.abortController = new AbortController();
    const stages: StageResult[] = [];

    try {
      // STAGE 1: Quick loading for immediate feedback (< 5s)
      onProgress?.({
        stage: 'quick',
        completed: 0,
        total: 100,
        percentage: 10,
        message: 'Loading active sprint data...'
      });

      const quickResult = await this.loadQuickStage(boardId);
      stages.push(quickResult);

      if (!quickResult.success) {
        throw new Error(quickResult.error || 'Quick stage failed');
      }

      // Early return only for Kanban boards (no sprints)
      if (quickResult.metadata.totalSprints === 0) {
        const combinedData = this.createCombinedResult(quickResult.boardId, quickResult.boardName, stages, 'quick-only');

        // Save calculated metrics to database (async, non-blocking)
        // Following Clean Code: Separation of concerns, fire-and-forget pattern
        saveBoardMetrics(combinedData).catch(error => {
          console.error(`[MultiStageLoader] Failed to save metrics for board ${boardId}:`, error);
        });

        return combinedData;
      }

      // Always call at least one batch stage for database persistence
      // This ensures closed sprints are saved to database even for small boards

      onProgress?.({
        stage: 'quick',
        completed: 25,
        total: 100,
        percentage: 25,
        message: quickResult.metadata.hasActiveSprint
          ? `Loaded active sprint, loading ${quickResult.metadata.totalClosedSprints} closed sprints...`
          : `No active sprint, loading ${quickResult.metadata.totalClosedSprints} closed sprints...`
      });

      // STAGE 2+: Batch loading for closed sprints only
      const batchResults = await this.loadBatchStages(
        boardId,
        quickResult.metadata.nextBatchStart || 0,
        quickResult.metadata.totalClosedSprints || 0,
        onProgress
      );

      stages.push(...batchResults);

      const strategy = batchResults.length > 0 ? 'quick-plus-batches' : 'quick-only';
      const combinedData = this.createCombinedResult(quickResult.boardId, quickResult.boardName, stages, strategy);

      // Save calculated metrics to database (async, non-blocking)
      // Following Clean Code: Separation of concerns, fire-and-forget pattern
      saveBoardMetrics(combinedData).catch(error => {
        console.error(`[MultiStageLoader] Failed to save metrics for board ${boardId}:`, error);
      });

      return combinedData;

    } catch (error) {
      console.error('Multi-stage loading error:', error);
      
      // Graceful degradation: return quick data if available
      if (stages.length > 0 && stages[0].success) {
        const combinedData = this.createCombinedResult(
          stages[0].boardId,
          stages[0].boardName,
          stages,
          'quick-only'
        );

        // Save calculated metrics to database (async, non-blocking)
        // Following Clean Code: Separation of concerns, fire-and-forget pattern
        saveBoardMetrics(combinedData).catch(error => {
          console.error(`[MultiStageLoader] Failed to save metrics for board ${boardId}:`, error);
        });

        return combinedData;
      }

      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel ongoing loading operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Load quick stage data (active sprint metrics + closed sprints list)
   */
  private async loadQuickStage(boardId: string): Promise<StageResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`/api/velocity/${boardId}/quick`, {
        signal: this.abortController?.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Quick API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const endTime = Date.now();

      return {
        stage: 'quick',
        boardId: data.boardId,
        boardName: data.boardName,
        sprints: data.sprints || [],
        activeSprint: data.activeSprint, // NEW: Direct access
        closedSprintsList: data.closedSprintsList || [], // NEW: For batch processing
        success: true,
        metadata: {
          sprintsAnalyzed: data.sprintsAnalyzed || 0,
          totalSprints: data.totalSprintsAvailable || 0,
          totalClosedSprints: data.totalClosedSprints || 0, // NEW
          hasActiveSprint: data.hasActiveSprint || false, // NEW
          progress: data.stageSummary?.progress || {
            completed: data.sprintsAnalyzed || 0,
            total: data.totalSprintsAvailable || 0,
            percentage: 0
          },
          hasMore: data.nextStageAvailable || false,
          nextBatchStart: 0 // Always start from beginning for closed sprints
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        },
        fromCache: data.fromCache || false
      };

    } catch (error) {
      const endTime = Date.now();
      return {
        stage: 'quick',
        boardId,
        boardName: `Board ${boardId}`,
        sprints: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown quick stage error',
        metadata: {
          sprintsAnalyzed: 0,
          totalSprints: 0,
          progress: { completed: 0, total: 0, percentage: 0 },
          hasMore: false
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    }
  }

  /**
   * Load batch stages with safe chunking
   */
  private async loadBatchStages(
    boardId: string,
    startSprint: number,
    totalSprints: number,
    onProgress?: ProgressCallback
  ): Promise<StageResult[]> {
    const batchResults: StageResult[] = [];
    let currentStart = startSprint;
    const maxSprints = Math.min(totalSprints, 30); // Hard limit for safety

    while (currentStart < maxSprints && !this.abortController?.signal.aborted) {
      const batchEnd = Math.min(
        currentStart + this.config.maxSprintsPerBatch,
        maxSprints
      );

      onProgress?.({
        stage: 'batch',
        completed: currentStart,
        total: maxSprints,
        percentage: 25 + Math.round(((currentStart / maxSprints) * 70)),
        message: `Loading sprints ${currentStart + 1}-${batchEnd}...`
      });

      try {
        const batchResult = await this.loadSingleBatch(
          boardId,
          currentStart,
          batchEnd
        );

        batchResults.push(batchResult);

        if (!batchResult.success || !batchResult.metadata.hasMore) {
          break;
        }

        currentStart = batchResult.metadata.nextBatchStart || batchEnd;

      } catch (error) {
        console.warn(`Batch ${currentStart}-${batchEnd} failed:`, error);
        // Continue with next batch on error
        currentStart = batchEnd;
      }
    }

    return batchResults;
  }

  /**
   * Load a single batch with timeout protection
   */
  private async loadSingleBatch(
    boardId: string,
    start: number,
    end: number
  ): Promise<StageResult> {
    const startTime = Date.now();

    try {
      const url = new URL(`/api/velocity/${boardId}/batch`, window.location.origin);
      url.searchParams.set('start', start.toString());
      url.searchParams.set('end', end.toString());
      url.searchParams.set('maxIssues', this.config.maxIssuesPerBatch.toString());

      const response = await fetch(url.toString(), {
        signal: this.abortController?.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Batch API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const endTime = Date.now();

      return {
        stage: 'batch',
        boardId: data.boardId,
        boardName: data.boardName,
        sprints: data.sprints || [],
        success: true,
        metadata: {
          sprintsAnalyzed: data.batch?.sprintsInBatch || 0,
          totalSprints: data.batch?.totalSprints || 0,
          progress: data.metadata?.progress || {
            completed: end,
            total: data.batch?.totalSprints || 0,
            percentage: 0
          },
          hasMore: data.metadata?.hasMore || false,
          nextBatchStart: data.metadata?.nextBatchStart
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        },
        fromCache: data.fromCache || false
      };

    } catch (error) {
      const endTime = Date.now();
      return {
        stage: 'batch',
        boardId,
        boardName: `Board ${boardId}`,
        sprints: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown batch error',
        metadata: {
          sprintsAnalyzed: 0,
          totalSprints: 0,
          progress: { completed: start, total: 0, percentage: 0 },
          hasMore: false
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    }
  }

  /**
   * Combine all stage results into final velocity data
   */
  private createCombinedResult(
    boardId: string,
    boardName: string,
    stages: StageResult[],
    strategy: 'quick-only' | 'quick-plus-batches' | 'complete'
  ): CombinedVelocityData {
    // Find active sprint from quick stage (preserve it explicitly)
    const quickStage = stages.find(stage => stage.stage === 'quick' && stage.success);
    const batchStages = stages.filter(stage => stage.stage === 'batch' && stage.success);
    const activeSprint = quickStage?.activeSprint || null;

    // Collect ONLY closed sprints from all successful stages
    const allClosedSprints = batchStages
      .flatMap(stage => stage.sprints)
      .filter(sprint => sprint.sprint.state === 'closed');

    // Remove duplicates by sprint ID
    const uniqueClosedSprints = Array.from(
      new Map(allClosedSprints.map(sprint => [sprint.sprint.id, sprint])).values()
    );

    // Sort by start date
    uniqueClosedSprints.sort((a, b) =>
      new Date(a.sprint.startDate).getTime() - new Date(b.sprint.startDate).getTime()
    );

    // Calculate aggregate metrics ONLY on closed sprints - round to integer for better display
    const averageVelocity = uniqueClosedSprints.length > 0
      ? Math.round(uniqueClosedSprints.reduce((sum, sprint) => sum + sprint.velocityPoints, 0) / uniqueClosedSprints.length)
      : 0;

    // Calculate trend ONLY on closed sprints
    const trend = this.calculateTrend(uniqueClosedSprints);

    // Calculate predictability ONLY on closed sprints
    const predictability = this.calculatePredictability(uniqueClosedSprints);

    const totalAnalyzed = batchStages.reduce((sum, stage) =>
      stage.success ? sum + stage.metadata.sprintsAnalyzed : sum, 0
    );

    const totalAvailable = batchStages.length > 0
      ? batchStages[0].metadata.totalSprints
      : 0;

    const combinedData: CombinedVelocityData = {
      boardId,
      boardName,
      closedSprints: uniqueClosedSprints,
      activeSprint,
      averageVelocity,
      trend,
      predictability,
      summary: {
        totalSprintsAnalyzed: totalAnalyzed,
        totalSprintsAvailable: totalAvailable,
        completionPercentage: totalAvailable > 0
          ? Math.round((totalAnalyzed / totalAvailable) * 100)
          : 0,
        loadingStrategy: strategy
      },
      timestamp: new Date().toISOString()
    };

    return combinedData;
  }

  /**
   * Calculate velocity trend from sprint data
   * Following Clean Code: Use consistent terminology with existing codebase
   * Note: Now receives only closed sprints, no need to filter again
   */
  private calculateTrend(closedSprints: SprintVelocity[]): 'up' | 'down' | 'stable' | 'no-data' {
    if (closedSprints.length < 2) return 'no-data';

    const recentSprints = closedSprints.slice(-3);
    const earlierSprints = closedSprints.slice(0, closedSprints.length - 3);

    if (earlierSprints.length === 0) return 'stable';

    const recentAvg = recentSprints.reduce((sum, s) => sum + s.velocityPoints, 0) / recentSprints.length;
    const earlierAvg = earlierSprints.reduce((sum, s) => sum + s.velocityPoints, 0) / earlierSprints.length;

    // Avoid division by zero
    if (earlierAvg === 0) return recentAvg > 0 ? 'up' : 'stable';

    const changeThreshold = 0.1; // 10% change threshold
    const change = (recentAvg - earlierAvg) / earlierAvg;

    if (change > changeThreshold) return 'up';
    if (change < -changeThreshold) return 'down';
    return 'stable';
  }

  /**
   * Calculate velocity predictability (consistency metric)
   * Following Clean Code: Improved algorithm with closed sprints only
   * Note: Now receives only closed sprints, no need to filter again
   */
  private calculatePredictability(closedSprints: SprintVelocity[]): number {
    if (closedSprints.length < 2) return 100; // Perfect predictability with insufficient data

    const velocities = closedSprints.map(s => s.velocityPoints);
    const avg = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    
    if (avg === 0) return 100; // If average is 0, consider it perfectly predictable

    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / velocities.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation inverted to percentage (lower variation = higher predictability)
    const cv = stdDev / avg;
    
    // Improved formula: use exponential decay for coefficient of variation
    const predictability = Math.round(100 * Math.exp(-cv));
    
    return Math.max(0, Math.min(100, predictability));
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Factory function for easy instantiation
 */
export function createMultiStageLoader(config?: Partial<MultiStageConfig>): MultiStageVelocityLoader {
  return new MultiStageVelocityLoader(config);
}

/**
 * Simple one-shot loading function
 */
export async function loadVelocityDataMultiStage(
  boardId: string,
  config?: Partial<MultiStageConfig>,
  onProgress?: ProgressCallback
): Promise<CombinedVelocityData> {
  const loader = createMultiStageLoader(config);
  return loader.loadVelocityData(boardId, onProgress);
} 