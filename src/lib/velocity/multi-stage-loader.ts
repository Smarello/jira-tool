/**
 * Multi-Stage Velocity Data Loader
 * Following Clean Code: Strategy pattern, Single Responsibility Principle
 * Strategy 5: Multi-Stage Loading Implementation
 */

import type { SprintVelocity } from './mock-calculator';

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
  success: boolean;
  error?: string;
  metadata: {
    sprintsAnalyzed: number;
    totalSprints: number;
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
  sprints: SprintVelocity[];
  averageVelocity: number;
  trend: 'up' | 'down' | 'stable' | 'no-data';
  predictability: number;
  stages: StageResult[];
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
      // STAGE 1: Quick loading for immediate feedback (< 10s)
      onProgress?.({
        stage: 'quick',
        completed: 0,
        total: 100,
        percentage: 10,
        message: 'Loading recent velocity data...'
      });

      const quickResult = await this.loadQuickStage(boardId);
      stages.push(quickResult);

      if (!quickResult.success) {
        throw new Error(quickResult.error || 'Quick stage failed');
      }

      // Early return only for Kanban boards (no sprints)
      if (quickResult.metadata.totalSprints === 0) {
        return this.createCombinedResult(quickResult.boardId, quickResult.boardName, stages, 'quick-only');
      }

      // Always call at least one batch stage for database persistence
      // This ensures closed sprints are saved to database even for small boards

      onProgress?.({
        stage: 'quick',
        completed: 25,
        total: 100,
        percentage: 25,
        message: `Loaded ${quickResult.metadata.sprintsAnalyzed} recent sprints, loading historical data...`
      });

      // STAGE 2+: Batch loading for comprehensive data
      const batchResults = await this.loadBatchStages(
        boardId,
        quickResult.metadata.nextBatchStart || 3,
        quickResult.metadata.totalSprints,
        onProgress
      );

      stages.push(...batchResults);

      const strategy = batchResults.length > 0 ? 'quick-plus-batches' : 'quick-only';
      return this.createCombinedResult(quickResult.boardId, quickResult.boardName, stages, strategy);

    } catch (error) {
      console.error('Multi-stage loading error:', error);
      
      // Graceful degradation: return quick data if available
      if (stages.length > 0 && stages[0].success) {
        return this.createCombinedResult(
          stages[0].boardId,
          stages[0].boardName,
          stages,
          'quick-only'
        );
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
   * Load quick stage data (last 3 sprints for immediate feedback)
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
        success: true,
        metadata: {
          sprintsAnalyzed: data.sprintsAnalyzed || 0,
          totalSprints: data.totalSprintsAvailable || 0,
          progress: data.stageSummary?.progress || {
            completed: data.sprintsAnalyzed || 0,
            total: data.totalSprintsAvailable || 0,
            percentage: 0
          },
          hasMore: data.nextStageAvailable || false,
          nextBatchStart: data.sprintsAnalyzed || 3
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
    // Combine all successful sprints
    const allSprints = stages
      .filter(stage => stage.success)
      .flatMap(stage => stage.sprints);

    // Remove duplicates by sprint ID
    const uniqueSprints = Array.from(
      new Map(allSprints.map(sprint => [sprint.sprint.id, sprint])).values()
    );

    // Sort by start date
    uniqueSprints.sort((a, b) => 
      new Date(a.sprint.startDate).getTime() - new Date(b.sprint.startDate).getTime()
    );

    // Calculate aggregate metrics - round to integer for better display
    const averageVelocity = uniqueSprints.length > 0
      ? Math.round(uniqueSprints.reduce((sum, sprint) => sum + sprint.velocityPoints, 0) / uniqueSprints.length)
      : 0;

    // Calculate trend
    const trend = this.calculateTrend(uniqueSprints);

    // Calculate predictability
    const predictability = this.calculatePredictability(uniqueSprints);

    const totalAnalyzed = stages.reduce((sum, stage) => 
      stage.success ? sum + stage.metadata.sprintsAnalyzed : sum, 0
    );

    const totalAvailable = stages.length > 0 
      ? stages[0].metadata.totalSprints 
      : 0;

    return {
      boardId,
      boardName,
      sprints: uniqueSprints,
      averageVelocity,
      trend,
      predictability,
      stages,
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
  }

  /**
   * Calculate velocity trend from sprint data
   * Following Clean Code: Use consistent terminology with existing codebase
   */
  private calculateTrend(sprints: SprintVelocity[]): 'up' | 'down' | 'stable' | 'no-data' {
    if (sprints.length < 2) return 'no-data';

    // Filter only closed sprints for trend analysis
    const closedSprints = sprints.filter(s => s.sprint.state === 'closed');
    
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
   */
  private calculatePredictability(sprints: SprintVelocity[]): number {
    // Only use closed sprints for predictability calculation
    const closedSprints = sprints.filter(s => s.sprint.state === 'closed');
    
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