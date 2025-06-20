/**
 * Sprint persistence service - Application layer service
 * Following Clean Architecture: Application service coordinating repositories
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../../jira/boards';
import type { JiraIssueWithPoints } from '../../jira/issues-api';
import type {
  IClosedSprintsRepository,
  CreateSprintData,
  SprintQueryFilters,
  PersistedSprint,
  SprintVelocityData,
  SprintMetricsData
} from '../repositories/interfaces';
import type { ISprintIssuesRepository } from '../repositories/sprint-issues-repository';
import { SprintEntity } from '../domain/sprint-domain';

/**
 * Sprint persistence service configuration
 * Following Clean Code: Configuration object pattern
 */
export interface SprintPersistenceConfig {
  readonly enableIssuesStorage: boolean;
  readonly enableMetricsCalculation: boolean;
  readonly retentionDays: number;
  readonly batchSize: number;
}

/**
 * Sprint persistence result
 * Following Clean Code: Express intent, result object
 */
export interface SprintPersistenceResult {
  readonly success: boolean;
  readonly sprintId: string;
  readonly message?: string;
  readonly error?: string;
}

/**
 * Batch persistence result
 * Following Clean Code: Express intent, batch result
 */
export interface BatchPersistenceResult {
  readonly totalProcessed: number;
  readonly successful: number;
  readonly failed: number;
  readonly results: readonly SprintPersistenceResult[];
  readonly errors: readonly string[];
}

/**
 * Sprint persistence service
 * Following Clean Architecture: Application service in application layer
 */
export class SprintPersistenceService {
  constructor(
    private readonly sprintsRepository: IClosedSprintsRepository,
    private readonly issuesRepository: ISprintIssuesRepository,
    private readonly config: SprintPersistenceConfig
  ) {}

  /**
   * Persists a closed sprint with all related data
   * Following Clean Code: Single responsibility, comprehensive persistence
   */
  async persistClosedSprint(
    sprint: JiraSprint,
    issues: readonly JiraIssueWithPoints[] = [],
    velocityData?: SprintVelocityData
  ): Promise<SprintPersistenceResult> {
    try {
      // Validate sprint is closed
      if (sprint.state !== 'closed') {
        return {
          success: false,
          sprintId: sprint.id,
          error: 'Only closed sprints can be persisted'
        };
      }

      // Check if sprint already exists
      const exists = await this.sprintsRepository.sprintExists(sprint.id);
      if (exists) {
        return {
          success: false,
          sprintId: sprint.id,
          error: 'Sprint already exists in database'
        };
      }

      // Calculate metrics if enabled
      let metricsData: SprintMetricsData | undefined;
      if (this.config.enableMetricsCalculation && issues.length > 0) {
        metricsData = this.calculateSprintMetrics(sprint, issues, velocityData);
      }

      // Prepare sprint data
      const createData: CreateSprintData = {
        sprint,
        velocityData,
        metricsData,
        issuesData: this.config.enableIssuesStorage ? issues : undefined
      };

      // Persist sprint
      await this.sprintsRepository.saveSprint(createData);

      // Persist issues separately if enabled
      if (this.config.enableIssuesStorage && issues.length > 0) {
        await this.issuesRepository.saveSprintIssues(sprint.id, issues);
      }

      return {
        success: true,
        sprintId: sprint.id,
        message: `Sprint ${sprint.name} persisted successfully`
      };

    } catch (error) {
      return {
        success: false,
        sprintId: sprint.id,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Persists multiple closed sprints in batch
   * Following Clean Code: Batch operations for efficiency, conditional persistence
   */
  async persistClosedSprintsBatch(
    sprintsWithIssues: readonly { sprint: JiraSprint; issues: readonly JiraIssueWithPoints[] }[],
    velocityDataMap?: Map<string, SprintVelocityData>
  ): Promise<BatchPersistenceResult> {
    const results: SprintPersistenceResult[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    // Filter only closed sprints
    const closedSprints = sprintsWithIssues.filter(item => item.sprint.state === 'closed');

    // Check which sprints already exist (batch existence check)
    const existingSprintIds = new Set<string>();
    for (const item of closedSprints) {
      try {
        const exists = await this.sprintsRepository.sprintExists(item.sprint.id);
        if (exists) {
          existingSprintIds.add(item.sprint.id);
          results.push({
            success: false,
            sprintId: item.sprint.id,
            error: 'Sprint already exists in database'
          });
          failed++;
        }
      } catch (error) {
        results.push({
          success: false,
          sprintId: item.sprint.id,
          error: `Failed to check sprint existence: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        failed++;
      }
    }

    // Filter out existing sprints
    const newSprints = closedSprints.filter(item => !existingSprintIds.has(item.sprint.id));

    if (newSprints.length === 0) {
      console.log('[SprintPersistence] No new sprints to persist');
      return {
        totalProcessed: closedSprints.length,
        successful,
        failed,
        results,
        errors
      };
    }

    console.log(`[SprintPersistence] Persisting ${newSprints.length} new sprints (${existingSprintIds.size} already exist)`);

    // Process new sprints in batches
    for (let i = 0; i < newSprints.length; i += this.config.batchSize) {
      const batch = newSprints.slice(i, i + this.config.batchSize);

      try {
        // Prepare batch data
        const batchData: CreateSprintData[] = batch.map(item => {
          const velocityData = velocityDataMap?.get(item.sprint.id);
          const metricsData = this.config.enableMetricsCalculation
            ? this.calculateSprintMetrics(item.sprint, item.issues, velocityData)
            : undefined;

          return {
            sprint: item.sprint,
            velocityData,
            metricsData,
            issuesData: this.config.enableIssuesStorage ? item.issues : undefined
          };
        });

        // Persist sprint batch
        await this.sprintsRepository.saveSprintsBatch(batchData);

        // Persist issues batch if enabled
        if (this.config.enableIssuesStorage) {
          const issuesMap = new Map<string, readonly JiraIssueWithPoints[]>();
          batch.forEach(item => {
            if (item.issues.length > 0) {
              issuesMap.set(item.sprint.id, item.issues);
            }
          });

          if (issuesMap.size > 0) {
            await this.issuesRepository.saveSprintIssuesBatch(issuesMap);
          }
        }

        // Mark batch as successful
        batch.forEach(item => {
          results.push({
            success: true,
            sprintId: item.sprint.id,
            message: `Sprint ${item.sprint.name} persisted in batch`
          });
          successful++;
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
        errors.push(`Batch ${i / this.config.batchSize + 1}: ${errorMessage}`);

        // Mark batch items as failed
        batch.forEach(item => {
          results.push({
            success: false,
            sprintId: item.sprint.id,
            error: errorMessage
          });
          failed++;
        });
      }
    }

    return {
      totalProcessed: closedSprints.length,
      successful,
      failed,
      results,
      errors
    };
  }

  /**
   * Retrieves closed sprints with flexible filtering
   * Following Clean Code: Flexible querying, caching consideration
   */
  async getClosedSprints(filters: SprintQueryFilters): Promise<readonly PersistedSprint[]> {
    return await this.sprintsRepository.getClosedSprints(filters);
  }

  /**
   * Retrieves recent closed sprints for a board
   * Following Clean Code: Express intent, common use case
   */
  async getRecentClosedSprints(boardId: string, limit = 10): Promise<readonly PersistedSprint[]> {
    return await this.sprintsRepository.getRecentClosedSprints(boardId, limit);
  }

  /**
   * Checks if sprint data should be refreshed
   * Following Clean Code: Express intent, business logic
   */
  async shouldRefreshSprintData(sprintId: string, maxAgeHours = 24): Promise<boolean> {
    const sprint = await this.sprintsRepository.getSprintById(sprintId);
    if (!sprint) return true;

    const ageHours = (Date.now() - new Date(sprint.updatedAt).getTime()) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }

  /**
   * Performs cleanup of old data
   * Following Clean Code: Data lifecycle management
   */
  async performCleanup(): Promise<{ sprintsDeleted: number; issuesDeleted: number }> {
    const sprintsDeleted = await this.sprintsRepository.cleanupOldSprints(this.config.retentionDays);
    const issuesDeleted = await this.issuesRepository.cleanupOldIssues(this.config.retentionDays);

    return { sprintsDeleted, issuesDeleted };
  }

  /**
   * Calculates comprehensive sprint metrics
   * Following Clean Code: Single responsibility, business logic
   */
  private calculateSprintMetrics(
    sprint: JiraSprint,
    issues: readonly JiraIssueWithPoints[],
    velocityData?: SprintVelocityData
  ): SprintMetricsData {
    const sprintEntity = SprintEntity.fromJiraSprint(sprint, issues);
    
    // Calculate basic velocity if not provided
    const velocity = velocityData || {
      sprintId: sprint.id,
      committedPoints: sprintEntity.totalStoryPoints,
      completedPoints: sprintEntity.completedStoryPoints,
      issuesCount: issues.length,
      completedIssuesCount: sprintEntity.completedIssues.length,
      cycleTime: this.calculateAverageCycleTime(issues),
      averageLeadTime: this.calculateAverageLeadTime(issues)
    };

    // Calculate additional metrics
    const defectRate = this.calculateDefectRate(issues);
    const scopeChangeRate = this.calculateScopeChangeRate(sprint, issues);

    return {
      sprintId: sprint.id,
      boardId: sprint.originBoardId,
      velocity,
      defectRate,
      reworkRate: this.calculateReworkRate(issues),
      scopeChangeRate,
      throughput: sprintEntity.completedIssues.length,
      workInProgress: issues.length - sprintEntity.completedIssues.length,
      flowEfficiency: this.calculateFlowEfficiency(issues),
      commitmentReliability: velocity.completedPoints / velocity.committedPoints * 100,
      deliveryReliability: sprintEntity.completedIssues.length / issues.length * 100,
      teamCapacity: this.calculateTeamCapacity(issues),
      teamUtilization: this.calculateTeamUtilization(issues),
      calculatedAt: new Date().toISOString()
    };
  }

  // Helper methods for metrics calculation
  private calculateAverageCycleTime(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would calculate actual cycle time from issue history
    return 0; // Placeholder
  }

  private calculateAverageLeadTime(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would calculate actual lead time from issue history
    return 0; // Placeholder
  }

  private calculateDefectRate(issues: readonly JiraIssueWithPoints[]): number {
    const bugs = issues.filter(issue =>
      issue.issueType?.name?.toLowerCase() === 'bug'
    );
    return issues.length === 0 ? 0 : (bugs.length / issues.length) * 100;
  }

  private calculateScopeChangeRate(_sprint: JiraSprint, _issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would track scope changes during sprint
    return 0; // Placeholder
  }

  private calculateReworkRate(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would track rework from issue history
    return 0; // Placeholder
  }

  private calculateFlowEfficiency(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would calculate flow efficiency from status transitions
    return 0; // Placeholder
  }

  private calculateTeamCapacity(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would calculate team capacity
    return 0; // Placeholder
  }

  private calculateTeamUtilization(_issues: readonly JiraIssueWithPoints[]): number {
    // Implementation would calculate team utilization
    return 0; // Placeholder
  }
}
