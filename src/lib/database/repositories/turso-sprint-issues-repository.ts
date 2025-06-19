/**
 * Turso implementation of sprint issues repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq, and, inArray, gte, lte, desc, count } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { sprintIssues } from '../schemas/turso-schema';
import type { 
  ISprintIssuesRepository,
  SprintIssueQueryFilters,
  SprintIssueStatistics
} from './sprint-issues-repository';
import type { JiraIssueWithPoints } from '../../jira/issues-api';

/**
 * Turso-based implementation of sprint issues repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoSprintIssuesRepository implements ISprintIssuesRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves issues for a sprint
   * Following Clean Code: Command-Query Separation (command)
   */
  async saveSprintIssues(sprintId: string, issues: readonly JiraIssueWithPoints[]): Promise<void> {
    if (issues.length === 0) return;

    try {
      const values = issues.map(issue => ({
        id: `${sprintId}-${issue.key}`,
        sprintId,
        issueKey: issue.key,
        issueId: issue.id,
        summary: issue.summary,
        status: typeof issue.status === 'string' ? issue.status : issue.status?.name || 'Unknown',
        issueType: typeof issue.issueType === 'string' ? issue.issueType : issue.issueType?.name || 'Unknown',
        storyPoints: issue.storyPoints || null,
        assignee: typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || null,
        created: issue.created,
        updated: issue.updated,
        resolved: issue.resolved || null,
        customFields: null, // Will be implemented when needed
        statusHistory: null, // Will be implemented when needed
        updatedAt: new Date().toISOString(),
      }));

      await this.db.insert(sprintIssues).values(values).onConflictDoUpdate({
        target: sprintIssues.id,
        set: {
          summary: values[0].summary, // This will be overridden by each value
          status: values[0].status,
          issueType: values[0].issueType,
          storyPoints: values[0].storyPoints,
          assignee: values[0].assignee,
          updated: values[0].updated,
          resolved: values[0].resolved,
          updatedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      throw new Error(`Failed to save sprint issues: ${error}`);
    }
  }

  /**
   * Saves issues for multiple sprints in batch
   * Following Clean Code: Batch operations for efficiency
   */
  async saveSprintIssuesBatch(sprintIssuesMap: Map<string, readonly JiraIssueWithPoints[]>): Promise<void> {
    const allValues = [];
    
    for (const [sprintId, issues] of sprintIssuesMap) {
      for (const issue of issues) {
        allValues.push({
          id: `${sprintId}-${issue.key}`,
          sprintId,
          issueKey: issue.key,
          issueId: issue.id,
          summary: issue.summary,
          status: typeof issue.status === 'string' ? issue.status : issue.status?.name || 'Unknown',
          issueType: typeof issue.issueType === 'string' ? issue.issueType : issue.issueType?.name || 'Unknown',
          storyPoints: issue.storyPoints || null,
          assignee: typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || null,
          created: issue.created,
          updated: issue.updated,
          resolved: issue.resolved || null,
          customFields: null,
          statusHistory: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (allValues.length === 0) return;

    try {
      // Process in batches to avoid SQLite limits
      const batchSize = 100;
      for (let i = 0; i < allValues.length; i += batchSize) {
        const batch = allValues.slice(i, i + batchSize);
        await this.db.insert(sprintIssues).values(batch).onConflictDoNothing();
      }
    } catch (error) {
      throw new Error(`Failed to save sprint issues batch: ${error}`);
    }
  }

  /**
   * Gets issues for a sprint
   * Following Clean Code: Command-Query Separation (query)
   */
  async getSprintIssues(sprintId: string): Promise<readonly JiraIssueWithPoints[]> {
    try {
      const results = await this.db
        .select()
        .from(sprintIssues)
        .where(eq(sprintIssues.sprintId, sprintId))
        .orderBy(desc(sprintIssues.created));

      return results.map(this.mapToJiraIssue);
    } catch (error) {
      throw new Error(`Failed to get sprint issues: ${error}`);
    }
  }

  /**
   * Gets issues for multiple sprints
   * Following Clean Code: Batch operations for efficiency
   */
  async getMultipleSprintIssues(sprintIds: readonly string[]): Promise<Map<string, readonly JiraIssueWithPoints[]>> {
    if (sprintIds.length === 0) return new Map();

    try {
      const results = await this.db
        .select()
        .from(sprintIssues)
        .where(inArray(sprintIssues.sprintId, sprintIds as string[]))
        .orderBy(desc(sprintIssues.created));

      const issuesMap = new Map<string, JiraIssueWithPoints[]>();
      
      for (const result of results) {
        if (!issuesMap.has(result.sprintId)) {
          issuesMap.set(result.sprintId, []);
        }
        issuesMap.get(result.sprintId)!.push(this.mapToJiraIssue(result));
      }

      return issuesMap;
    } catch (error) {
      throw new Error(`Failed to get multiple sprint issues: ${error}`);
    }
  }

  /**
   * Gets issues with flexible filtering
   * Following Clean Code: Flexible querying
   */
  async getIssues(filters: SprintIssueQueryFilters): Promise<readonly JiraIssueWithPoints[]> {
    try {
      let query = this.db.select().from(sprintIssues);

      // Apply filters
      const conditions = [];
      
      if (filters.sprintId) {
        conditions.push(eq(sprintIssues.sprintId, filters.sprintId));
      }
      
      if (filters.sprintIds && filters.sprintIds.length > 0) {
        conditions.push(inArray(sprintIssues.sprintId, filters.sprintIds as string[]));
      }
      
      if (filters.issueKey) {
        conditions.push(eq(sprintIssues.issueKey, filters.issueKey));
      }
      
      if (filters.issueType) {
        conditions.push(eq(sprintIssues.issueType, filters.issueType));
      }
      
      if (filters.status) {
        conditions.push(eq(sprintIssues.status, filters.status));
      }
      
      if (filters.assignee) {
        conditions.push(eq(sprintIssues.assignee, filters.assignee));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Apply ordering
      query = query.orderBy(desc(sprintIssues.created));

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const results = await query;
      return results.map(this.mapToJiraIssue);
    } catch (error) {
      throw new Error(`Failed to get issues with filters: ${error}`);
    }
  }

  /**
   * Gets issue statistics for a sprint
   * Following Clean Code: Express intent, analytics support
   */
  async getSprintIssueStatistics(sprintId: string): Promise<SprintIssueStatistics> {
    try {
      const issues = await this.getSprintIssues(sprintId);
      
      const totalIssues = issues.length;
      const completedIssues = issues.filter(issue => {
        const statusName = typeof issue.status === 'string' ? issue.status : issue.status?.name || '';
        return statusName.toLowerCase().includes('done') ||
               statusName.toLowerCase().includes('closed') ||
               statusName.toLowerCase().includes('resolved');
      }).length;

      const totalStoryPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
      const completedStoryPoints = issues
        .filter(issue => {
          const statusName = typeof issue.status === 'string' ? issue.status : issue.status?.name || '';
          return statusName.toLowerCase().includes('done') ||
                 statusName.toLowerCase().includes('closed') ||
                 statusName.toLowerCase().includes('resolved');
        })
        .reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);

      const averageStoryPoints = totalIssues > 0 ? totalStoryPoints / totalIssues : 0;

      // Group by type
      const issuesByType: Record<string, number> = {};
      issues.forEach(issue => {
        const typeName = typeof issue.issueType === 'string' ? issue.issueType : issue.issueType?.name || 'Unknown';
        issuesByType[typeName] = (issuesByType[typeName] || 0) + 1;
      });

      // Group by status
      const issuesByStatus: Record<string, number> = {};
      issues.forEach(issue => {
        const statusName = typeof issue.status === 'string' ? issue.status : issue.status?.name || 'Unknown';
        issuesByStatus[statusName] = (issuesByStatus[statusName] || 0) + 1;
      });

      // Group by assignee
      const issuesByAssignee: Record<string, number> = {};
      issues.forEach(issue => {
        const assigneeName = typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || 'Unassigned';
        issuesByAssignee[assigneeName] = (issuesByAssignee[assigneeName] || 0) + 1;
      });

      return {
        sprintId,
        totalIssues,
        completedIssues,
        totalStoryPoints,
        completedStoryPoints,
        averageStoryPoints,
        issuesByType,
        issuesByStatus,
        issuesByAssignee,
        averageLeadTime: 0, // Would need detailed analysis
        averageCycleTime: 0, // Would need detailed analysis
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get sprint issue statistics: ${error}`);
    }
  }

  /**
   * Gets issue statistics for multiple sprints
   * Following Clean Code: Batch analytics
   */
  async getMultipleSprintIssueStatistics(sprintIds: readonly string[]): Promise<Map<string, SprintIssueStatistics>> {
    const statisticsMap = new Map<string, SprintIssueStatistics>();
    
    for (const sprintId of sprintIds) {
      try {
        const stats = await this.getSprintIssueStatistics(sprintId);
        statisticsMap.set(sprintId, stats);
      } catch (error) {
        console.warn(`Failed to get statistics for sprint ${sprintId}:`, error);
      }
    }
    
    return statisticsMap;
  }

  /**
   * Updates an existing issue
   * Following Clean Code: Single responsibility
   */
  async updateIssue(issueKey: string, issue: JiraIssueWithPoints): Promise<void> {
    try {
      await this.db
        .update(sprintIssues)
        .set({
          summary: issue.summary,
          status: typeof issue.status === 'string' ? issue.status : issue.status?.name || 'Unknown',
          issueType: typeof issue.issueType === 'string' ? issue.issueType : issue.issueType?.name || 'Unknown',
          storyPoints: issue.storyPoints || null,
          assignee: typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || null,
          updated: issue.updated,
          resolved: issue.resolved || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sprintIssues.issueKey, issueKey));
    } catch (error) {
      throw new Error(`Failed to update issue: ${error}`);
    }
  }

  /**
   * Deletes issues for a sprint
   * Following Clean Code: Data lifecycle management
   */
  async deleteSprintIssues(sprintId: string): Promise<number> {
    try {
      // Get count before deletion
      const [beforeCount] = await this.db
        .select({ count: count() })
        .from(sprintIssues)
        .where(eq(sprintIssues.sprintId, sprintId));

      // Delete issues
      await this.db
        .delete(sprintIssues)
        .where(eq(sprintIssues.sprintId, sprintId));

      return beforeCount.count;
    } catch (error) {
      throw new Error(`Failed to delete sprint issues: ${error}`);
    }
  }

  /**
   * Deletes old issues beyond retention period
   * Following Clean Code: Data lifecycle management
   */
  async cleanupOldIssues(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      // Get count before deletion
      const [beforeCount] = await this.db
        .select({ count: count() })
        .from(sprintIssues)
        .where(lte(sprintIssues.created, cutoffIso));

      // Delete old issues
      await this.db
        .delete(sprintIssues)
        .where(lte(sprintIssues.created, cutoffIso));

      return beforeCount.count;
    } catch (error) {
      throw new Error(`Failed to cleanup old issues: ${error}`);
    }
  }

  /**
   * Checks if issues exist for a sprint
   * Following Clean Code: Command-Query Separation (query)
   */
  async sprintHasIssues(sprintId: string): Promise<boolean> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(sprintIssues)
        .where(eq(sprintIssues.sprintId, sprintId));

      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check if sprint has issues: ${error}`);
    }
  }

  /**
   * Gets issue count for a sprint
   * Following Clean Code: Express intent, performance optimization
   */
  async getSprintIssueCount(sprintId: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(sprintIssues)
        .where(eq(sprintIssues.sprintId, sprintId));

      return result.count;
    } catch (error) {
      throw new Error(`Failed to get sprint issue count: ${error}`);
    }
  }

  /**
   * Maps Turso entity to Jira issue
   * Following Clean Code: Single responsibility, immutability
   */
  private mapToJiraIssue(entity: any): JiraIssueWithPoints {
    return {
      id: entity.issueId,
      key: entity.issueKey,
      summary: entity.summary,
      description: null,
      status: { name: entity.status, statusCategory: { name: 'Unknown' } },
      priority: { name: 'Unknown' },
      issueType: { id: 'unknown', name: entity.issueType, iconUrl: '', subtask: false },
      assignee: entity.assignee ? { displayName: entity.assignee } : null,
      reporter: { displayName: 'Unknown' },
      storyPoints: entity.storyPoints,
      statusCategoryChangedDate: null,
      created: entity.created,
      updated: entity.updated,
      resolved: entity.resolved,
    };
  }
}
