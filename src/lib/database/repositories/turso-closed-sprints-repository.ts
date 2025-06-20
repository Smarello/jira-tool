/**
 * Turso implementation of closed sprints repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq, and, gte, lte, desc, sql, count, inArray } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { closedSprints } from '../schemas/turso-schema';
import type { 
  IClosedSprintsRepository, 
  PersistedSprint, 
  SprintVelocityData,
  SprintMetricsData,
  CreateSprintData,
  SprintQueryFilters,
  SprintStatistics
} from './interfaces';
import type { JiraSprint } from '../../jira/boards';
import type { JiraIssueWithPoints } from '../../jira/issues-api';

/**
 * Turso-based implementation of closed sprints repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoClosedSprintsRepository implements IClosedSprintsRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves a closed sprint with comprehensive data
   * Following Clean Code: Single responsibility, error handling
   */
  async saveSprint(data: CreateSprintData): Promise<void> {
    try {
      const { sprint, velocityData, metricsData, issuesData } = data;
      console.error(`----> saving sprint ${sprint.id}`, sprint);
      
      await this.db.insert(closedSprints).values({
        id: sprint.id,
        boardId: sprint.originBoardId,
        name: sprint.name,
        state: 'closed',
        startDate: sprint.startDate || null,
        endDate: sprint.endDate || null,
        completeDate: sprint.completeDate || null,
        goal: sprint.goal || null,
        originBoardId: sprint.originBoardId,
        velocityData: velocityData ? JSON.stringify(velocityData) : null,
        metricsData: metricsData ? JSON.stringify(metricsData) : null,
        issuesData: issuesData ? JSON.stringify(issuesData) : null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      throw new Error(`Failed to save sprint ${data.sprint.id}: ${error}`);
    }
  }

  /**
   * Saves multiple closed sprints in a batch operation
   * Following Clean Code: Batch operations for efficiency
   */
  async saveSprintsBatch(sprintsData: readonly CreateSprintData[]): Promise<void> {
    if (sprintsData.length === 0) return;

    try {
      const values = sprintsData.map(data => {
        const { sprint, velocityData, metricsData, issuesData } = data;
        return {
          id: sprint.id,
          boardId: sprint.originBoardId,
          name: sprint.name,
          state: 'closed' as const,
          startDate: sprint.startDate || null,
          endDate: sprint.endDate || null,
          completeDate: sprint.completeDate || null,
          goal: sprint.goal || null,
          originBoardId: sprint.originBoardId,
          velocityData: velocityData ? JSON.stringify(velocityData) : null,
          metricsData: metricsData ? JSON.stringify(metricsData) : null,
          issuesData: issuesData ? JSON.stringify(issuesData) : null,
          updatedAt: new Date().toISOString(),
        };
      });

      await this.db.insert(closedSprints).values(values);
    } catch (error) {
      throw new Error(`Failed to save sprints batch: ${error}`);
    }
  }

  /**
   * Gets closed sprints with flexible filtering
   * Following Clean Code: Command-Query Separation, flexible querying
   */
  async getClosedSprints(filters: SprintQueryFilters): Promise<readonly PersistedSprint[]> {
    try {
      let query = this.db.select().from(closedSprints);

      // Apply filters
      const conditions = [];
      
      if (filters.boardId) {
        conditions.push(eq(closedSprints.boardId, filters.boardId));
      }
      
      if (filters.fromDate) {
        conditions.push(gte(closedSprints.completeDate, filters.fromDate));
      }
      
      if (filters.toDate) {
        conditions.push(lte(closedSprints.completeDate, filters.toDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Apply ordering
      query = query.orderBy(desc(closedSprints.completeDate));

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const results = await query;
      return results.map(this.mapToPersistedSprint);
    } catch (error) {
      throw new Error(`Failed to get closed sprints: ${error}`);
    }
  }

  /**
   * Gets all closed sprints for a board
   * Following Clean Code: Command-Query Separation, immutability
   */
  async getClosedSprintsByBoard(boardId: string): Promise<readonly PersistedSprint[]> {
    return this.getClosedSprints({ boardId });
  }

  /**
   * Gets closed sprints within date range
   * Following Clean Code: Express intent, optional parameters
   */
  async getClosedSprintsByBoardAndDateRange(
    boardId: string, 
    fromDate?: string, 
    toDate?: string
  ): Promise<readonly PersistedSprint[]> {
    return this.getClosedSprints({ boardId, fromDate, toDate });
  }

  /**
   * Gets most recent closed sprints for a board
   * Following Clean Code: Express intent, default parameter
   */
  async getRecentClosedSprints(boardId: string, limit = 5): Promise<readonly PersistedSprint[]> {
    return this.getClosedSprints({ boardId, limit });
  }

  /**
   * Checks if a sprint exists in the database
   * Following Clean Code: Command-Query Separation, boolean return
   */
  async sprintExists(sprintId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: closedSprints.id })
        .from(closedSprints)
        .where(eq(closedSprints.id, sprintId))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      throw new Error(`Failed to check sprint existence: ${error}`);
    }
  }

  /**
   * Checks which sprints exist in the database (batch operation)
   * Following Clean Code: Batch operations for efficiency
   */
  async checkMultipleSprintsExist(sprintIds: readonly string[]): Promise<Set<string>> {
    if (sprintIds.length === 0) return new Set();

    try {
      const results = await this.db
        .select({ id: closedSprints.id })
        .from(closedSprints)
        .where(inArray(closedSprints.id, sprintIds as string[]));

      return new Set(results.map(result => result.id));
    } catch (error) {
      throw new Error(`Failed to check multiple sprints existence: ${error}`);
    }
  }

  /**
   * Gets sprint by ID with optional data inclusion
   * Following Clean Code: Single responsibility, null object pattern
   */
  async getSprintById(sprintId: string, includeAllData = true): Promise<PersistedSprint | null> {
    try {
      const results = await this.db
        .select()
        .from(closedSprints)
        .where(eq(closedSprints.id, sprintId))
        .limit(1);

      return results.length > 0 ? this.mapToPersistedSprint(results[0]) : null;
    } catch (error) {
      throw new Error(`Failed to get sprint by ID: ${error}`);
    }
  }

  /**
   * Updates velocity data for an existing sprint
   * Following Clean Code: Single responsibility, immutability
   */
  async updateSprintVelocityData(sprintId: string, velocityData: SprintVelocityData): Promise<void> {
    try {
      await this.db
        .update(closedSprints)
        .set({
          velocityData: JSON.stringify(velocityData),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(closedSprints.id, sprintId));
    } catch (error) {
      throw new Error(`Failed to update velocity data: ${error}`);
    }
  }

  /**
   * Updates metrics data for an existing sprint
   * Following Clean Code: Single responsibility
   */
  async updateSprintMetricsData(sprintId: string, metricsData: SprintMetricsData): Promise<void> {
    try {
      await this.db
        .update(closedSprints)
        .set({
          metricsData: JSON.stringify(metricsData),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(closedSprints.id, sprintId));
    } catch (error) {
      throw new Error(`Failed to update metrics data: ${error}`);
    }
  }

  /**
   * Updates issues data for an existing sprint
   * Following Clean Code: Single responsibility
   */
  async updateSprintIssuesData(sprintId: string, issuesData: readonly JiraIssueWithPoints[]): Promise<void> {
    try {
      await this.db
        .update(closedSprints)
        .set({
          issuesData: JSON.stringify(issuesData),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(closedSprints.id, sprintId));
    } catch (error) {
      throw new Error(`Failed to update issues data: ${error}`);
    }
  }

  /**
   * Gets sprint statistics for a board
   * Following Clean Code: Express intent, analytics support
   */
  async getSprintStatistics(boardId: string, fromDate?: string, toDate?: string): Promise<SprintStatistics> {
    try {
      // Build conditions
      const conditions = [eq(closedSprints.boardId, boardId)];
      
      if (fromDate) {
        conditions.push(gte(closedSprints.completeDate, fromDate));
      }
      
      if (toDate) {
        conditions.push(lte(closedSprints.completeDate, toDate));
      }

      // Get basic statistics
      const [statsResult] = await this.db
        .select({
          totalSprints: count(),
        })
        .from(closedSprints)
        .where(and(...conditions));

      // Get sprints with velocity data for calculations
      const sprintsWithData = await this.db
        .select()
        .from(closedSprints)
        .where(and(...conditions));

      // Calculate averages
      const sprintsWithVelocity = sprintsWithData
        .filter(sprint => sprint.velocityData)
        .map(sprint => JSON.parse(sprint.velocityData!) as SprintVelocityData);

      const averageVelocity = sprintsWithVelocity.length > 0
        ? sprintsWithVelocity.reduce((sum, v) => sum + v.completedPoints, 0) / sprintsWithVelocity.length
        : 0;

      const averageCycleTime = sprintsWithVelocity.length > 0
        ? sprintsWithVelocity.reduce((sum, v) => sum + v.cycleTime, 0) / sprintsWithVelocity.length
        : 0;

      const averageLeadTime = sprintsWithVelocity.length > 0
        ? sprintsWithVelocity.reduce((sum, v) => sum + v.averageLeadTime, 0) / sprintsWithVelocity.length
        : 0;

      const completionRate = sprintsWithVelocity.length > 0
        ? sprintsWithVelocity.reduce((sum, v) => sum + (v.completedPoints / v.committedPoints * 100), 0) / sprintsWithVelocity.length
        : 0;

      return {
        boardId,
        totalSprints: statsResult.totalSprints,
        averageVelocity,
        averageCycleTime,
        averageLeadTime,
        completionRate,
        defectRate: 0, // Would need issues data analysis
        dateRange: {
          from: fromDate || '',
          to: toDate || ''
        },
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get sprint statistics: ${error}`);
    }
  }

  /**
   * Deletes old sprints beyond retention period
   * Following Clean Code: Express intent, data lifecycle management
   */
  async cleanupOldSprints(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      // Get count before deletion
      const [beforeCount] = await this.db
        .select({ count: count() })
        .from(closedSprints)
        .where(lte(closedSprints.completeDate, cutoffIso));

      // Delete old sprints
      await this.db
        .delete(closedSprints)
        .where(lte(closedSprints.completeDate, cutoffIso));

      // Get count after deletion
      const [afterCount] = await this.db
        .select({ count: count() })
        .from(closedSprints);

      return beforeCount.count - afterCount.count;
    } catch (error) {
      throw new Error(`Failed to cleanup old sprints: ${error}`);
    }
  }

  /**
   * Maps Turso entity to domain object
   * Following Clean Code: Single responsibility, immutability
   */
  private mapToPersistedSprint(entity: any): PersistedSprint {
    return {
      id: entity.id,
      boardId: entity.boardId,
      name: entity.name,
      state: 'closed',
      startDate: entity.startDate,
      endDate: entity.endDate,
      completeDate: entity.completeDate,
      goal: entity.goal,
      originBoardId: entity.originBoardId,
      velocityData: entity.velocityData ? JSON.parse(entity.velocityData) : undefined,
      metricsData: entity.metricsData ? JSON.parse(entity.metricsData) : undefined,
      issuesData: entity.issuesData ? JSON.parse(entity.issuesData) : undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
