/**
 * Sprint issues repository interface
 * Following Clean Architecture: Separate concern for issues data
 * Following Clean Code: Interface segregation, single responsibility
 */

import type { JiraIssueWithPoints } from '../../jira/issues-api';


/**
 * Sprint issue query filters
 * Following Clean Code: Express intent, query object pattern
 */
export interface SprintIssueQueryFilters {
  readonly sprintId?: string;
  readonly sprintIds?: readonly string[];
  readonly issueKey?: string;
  readonly issueType?: string;
  readonly status?: string;
  readonly assignee?: string;
  readonly hasStoryPoints?: boolean;
  readonly minStoryPoints?: number;
  readonly maxStoryPoints?: number;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly resolvedAfter?: string;
  readonly resolvedBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Sprint issue statistics
 * Following Clean Code: Express intent, analytics data
 */
export interface SprintIssueStatistics {
  readonly sprintId: string;
  readonly totalIssues: number;
  readonly completedIssues: number;
  readonly totalStoryPoints: number;
  readonly completedStoryPoints: number;
  readonly averageStoryPoints: number;
  readonly issuesByType: Record<string, number>;
  readonly issuesByStatus: Record<string, number>;
  readonly issuesByAssignee: Record<string, number>;
  readonly averageLeadTime: number;
  readonly averageCycleTime: number;
  readonly calculatedAt: string;
}

/**
 * Repository interface for sprint issues
 * Following Clean Architecture: Abstract repository in domain layer
 */
export interface ISprintIssuesRepository {
  /**
   * Saves issues for a sprint
   * Following Clean Code: Command-Query Separation (command)
   */
  saveSprintIssues(sprintId: string, issues: readonly JiraIssueWithPoints[]): Promise<void>;

  /**
   * Saves issues for multiple sprints in batch
   * Following Clean Code: Batch operations for efficiency
   */
  saveSprintIssuesBatch(sprintIssuesMap: Map<string, readonly JiraIssueWithPoints[]>): Promise<void>;

  /**
   * Gets issues for a sprint
   * Following Clean Code: Command-Query Separation (query)
   */
  getSprintIssues(sprintId: string): Promise<readonly JiraIssueWithPoints[]>;

  /**
   * Gets issues for multiple sprints
   * Following Clean Code: Batch operations for efficiency
   */
  getMultipleSprintIssues(sprintIds: readonly string[]): Promise<Map<string, readonly JiraIssueWithPoints[]>>;

  /**
   * Gets issues with flexible filtering
   * Following Clean Code: Flexible querying
   */
  getIssues(filters: SprintIssueQueryFilters): Promise<readonly JiraIssueWithPoints[]>;

  /**
   * Gets issue statistics for a sprint
   * Following Clean Code: Express intent, analytics support
   */
  getSprintIssueStatistics(sprintId: string): Promise<SprintIssueStatistics>;

  /**
   * Gets issue statistics for multiple sprints
   * Following Clean Code: Batch analytics
   */
  getMultipleSprintIssueStatistics(sprintIds: readonly string[]): Promise<Map<string, SprintIssueStatistics>>;

  /**
   * Updates an existing issue
   * Following Clean Code: Single responsibility
   */
  updateIssue(issueKey: string, issue: JiraIssueWithPoints): Promise<void>;

  /**
   * Deletes issues for a sprint
   * Following Clean Code: Data lifecycle management
   */
  deleteSprintIssues(sprintId: string): Promise<number>;

  /**
   * Deletes old issues beyond retention period
   * Following Clean Code: Data lifecycle management
   */
  cleanupOldIssues(retentionDays: number): Promise<number>;

  /**
   * Checks if issues exist for a sprint
   * Following Clean Code: Command-Query Separation (query)
   */
  sprintHasIssues(sprintId: string): Promise<boolean>;

  /**
   * Gets issue count for a sprint
   * Following Clean Code: Express intent, performance optimization
   */
  getSprintIssueCount(sprintId: string): Promise<number>;
}
