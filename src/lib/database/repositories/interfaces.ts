/**
 * Repository interfaces for database abstraction
 * Following Clean Architecture: Dependency Inversion Principle
 * Following Clean Code: Interface Segregation Principle
 */

import type { JiraSprint } from '../../jira/boards';
import type { JiraIssueWithPoints } from '../../jira/issues-api';
import type { 
  KanbanIssueEntity, 
  NewKanbanIssueEntity, 
  KanbanBoardConfigEntity, 
  NewKanbanBoardConfigEntity 
} from '../schemas/kanban';

/**
 * Sprint velocity data for persistence
 * Following Clean Code: Express intent, immutability
 */
export interface SprintVelocityData {
  readonly sprintId: string;
  readonly committedPoints: number;
  readonly completedPoints: number;
  readonly issuesCount: number;
  readonly completedIssuesCount: number;
  readonly cycleTime: number;
  readonly averageLeadTime: number;
  readonly burndownData?: readonly number[];
  readonly velocityTrend?: readonly number[];
}

/**
 * Sprint metrics data for comprehensive analysis
 * Following Clean Code: Express intent, comprehensive metrics
 */
export interface SprintMetricsData {
  readonly sprintId: string;
  readonly boardId: string;

  // Velocity metrics
  readonly velocity: SprintVelocityData;

  // Quality metrics
  readonly defectRate: number;
  readonly reworkRate: number;
  readonly scopeChangeRate: number;

  // Flow metrics
  readonly throughput: number;
  readonly workInProgress: number;
  readonly flowEfficiency: number;

  // Predictability metrics
  readonly commitmentReliability: number;
  readonly deliveryReliability: number;

  // Team metrics
  readonly teamCapacity: number;
  readonly teamUtilization: number;

  // Calculated at
  readonly calculatedAt: string;
}

/**
 * Persisted sprint entity
 * Following Clean Architecture: Domain entity for persistence layer
 */
export interface PersistedSprint {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly state: 'closed';
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly completeDate: string | null;
  readonly goal?: string;
  readonly originBoardId: string;
  readonly velocityData?: SprintVelocityData;
  readonly metricsData?: SprintMetricsData;
  readonly issuesData?: readonly JiraIssueWithPoints[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Sprint creation data
 * Following Clean Code: Express intent, data transfer object
 */
export interface CreateSprintData {
  readonly sprint: JiraSprint;
  readonly velocityData?: SprintVelocityData;
  readonly metricsData?: SprintMetricsData;
  readonly issuesData?: readonly JiraIssueWithPoints[];
}

/**
 * Sprint query filters
 * Following Clean Code: Express intent, query object pattern
 */
export interface SprintQueryFilters {
  readonly boardId?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly includeVelocityData?: boolean;
  readonly includeMetricsData?: boolean;
  readonly includeIssuesData?: boolean;
}

/**
 * Repository interface for closed sprints
 * Following Clean Architecture: Abstract repository in domain layer
 */
export interface IClosedSprintsRepository {
  /**
   * Saves a closed sprint with comprehensive data
   * Following Clean Code: Command-Query Separation (command)
   */
  saveSprint(data: CreateSprintData): Promise<void>;

  /**
   * Saves multiple closed sprints in a batch operation
   * Following Clean Code: Batch operations for efficiency
   */
  saveSprintsBatch(sprintsData: readonly CreateSprintData[]): Promise<void>;

  /**
   * Gets closed sprints with flexible filtering
   * Following Clean Code: Command-Query Separation (query)
   */
  getClosedSprints(filters: SprintQueryFilters): Promise<readonly PersistedSprint[]>;

  /**
   * Gets all closed sprints for a board
   * Following Clean Code: Command-Query Separation (query)
   */
  getClosedSprintsByBoard(boardId: string): Promise<readonly PersistedSprint[]>;

  /**
   * Gets closed sprints for a board within date range
   * Following Clean Code: Express intent, optional parameters
   */
  getClosedSprintsByBoardAndDateRange(
    boardId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<readonly PersistedSprint[]>;

  /**
   * Gets most recent closed sprints for a board
   * Following Clean Code: Express intent, default parameter
   */
  getRecentClosedSprints(boardId: string, limit?: number): Promise<readonly PersistedSprint[]>;

  /**
   * Checks if a sprint exists in the database
   * Following Clean Code: Command-Query Separation (query)
   */
  sprintExists(sprintId: string): Promise<boolean>;

  /**
   * Checks which sprints exist in the database (batch operation)
   * Following Clean Code: Batch operations for efficiency
   */
  checkMultipleSprintsExist(sprintIds: readonly string[]): Promise<Set<string>>;

  /**
   * Gets sprint by ID with optional data inclusion
   * Following Clean Code: Single responsibility
   */
  getSprintById(sprintId: string, includeAllData?: boolean): Promise<PersistedSprint | null>;

  /**
   * Updates velocity data for an existing sprint
   * Following Clean Code: Single responsibility
   */
  updateSprintVelocityData(sprintId: string, velocityData: SprintVelocityData): Promise<void>;

  /**
   * Updates metrics data for an existing sprint
   * Following Clean Code: Single responsibility
   */
  updateSprintMetricsData(sprintId: string, metricsData: SprintMetricsData): Promise<void>;

  /**
   * Updates issues data for an existing sprint
   * Following Clean Code: Single responsibility
   */
  updateSprintIssuesData(sprintId: string, issuesData: readonly JiraIssueWithPoints[]): Promise<void>;

  /**
   * Gets sprint statistics for a board
   * Following Clean Code: Express intent, analytics support
   */
  getSprintStatistics(boardId: string, fromDate?: string, toDate?: string): Promise<SprintStatistics>;

  /**
   * Deletes old sprints beyond retention period
   * Following Clean Code: Express intent, data lifecycle management
   */
  cleanupOldSprints(retentionDays: number): Promise<number>;
}

/**
 * Sprint statistics aggregation
 * Following Clean Code: Express intent, analytics data
 */
export interface SprintStatistics {
  readonly boardId: string;
  readonly totalSprints: number;
  readonly averageVelocity: number;
  readonly averageCycleTime: number;
  readonly averageLeadTime: number;
  readonly completionRate: number;
  readonly defectRate: number;
  readonly dateRange: {
    readonly from: string;
    readonly to: string;
  };
  readonly calculatedAt: string;
}

/**
 * Board configuration for caching board metadata
 * Following Clean Code: Express intent, immutability
 */
export interface BoardConfiguration {
  readonly id: string;
  readonly name: string;
  readonly type: 'scrum' | 'kanban';
  readonly projectKey?: string;
  readonly doneStatusIds: readonly string[];
  readonly storyPointsField?: string;
  readonly lastFetched: string;
}

/**
 * Repository interface for board configurations
 * Following Clean Architecture: Separate concerns
 */
export interface IBoardConfigurationRepository {
  /**
   * Saves board configuration
   * Following Clean Code: Command-Query Separation (command)
   */
  saveBoardConfiguration(config: BoardConfiguration): Promise<void>;

  /**
   * Gets board configuration by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  getBoardConfiguration(boardId: string): Promise<BoardConfiguration | null>;

  /**
   * Updates board configuration
   * Following Clean Code: Single responsibility
   */
  updateBoardConfiguration(boardId: string, config: Partial<BoardConfiguration>): Promise<void>;

  /**
   * Checks if board configuration is stale
   * Following Clean Code: Express intent, business logic
   */
  isBoardConfigurationStale(boardId: string, maxAgeHours: number): Promise<boolean>;
}

/**
 * Board velocity metrics for persistence
 * Following Clean Code: Express intent, immutability
 */
export interface BoardMetrics {
  readonly boardId: string;
  readonly boardName: string;
  readonly averageVelocity: number;
  readonly predictability: number;
  readonly trend: 'up' | 'down' | 'stable' | 'no-data';
  readonly sprintsAnalyzed: number;
  readonly averageSprintCompletionRate: number;
  readonly lastCalculated: string;
}

/**
 * Repository interface for board velocity metrics
 * Following Clean Architecture: Separate concerns
 */
export interface IBoardMetricsRepository {
  /**
   * Saves or updates board velocity metrics
   * Following Clean Code: Command-Query Separation (command)
   */
  saveBoardMetrics(metrics: BoardMetrics): Promise<void>;

  /**
   * Gets board velocity metrics by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  getBoardMetrics(boardId: string): Promise<BoardMetrics | null>;

  /**
   * Deletes board metrics
   * Following Clean Code: Single responsibility
   */
  deleteBoardMetrics(boardId: string): Promise<void>;

  /**
   * Lists all board metrics
   * Following Clean Code: Express intent
   */
  listAllBoardMetrics(): Promise<readonly BoardMetrics[]>;

  /**
   * Gets all board metrics for aggregation
   * Following Clean Code: Express intent, dashboard aggregation
   */
  getAllBoardMetrics(): Promise<BoardMetrics[]>;
}

/**
 * Repository interface for Kanban Issue persistence
 * Following Clean Architecture: Dependency Inversion Principle
 * Following Clean Code: Interface Segregation - focused on Kanban issues only
 */
export interface KanbanIssueRepository {
  /**
   * Saves a single Kanban issue
   * Following Clean Code: Single responsibility
   */
  saveIssue(issue: NewKanbanIssueEntity): Promise<KanbanIssueEntity>;

  /**
   * Saves multiple Kanban issues in batch
   * Following Clean Code: Performance optimization for large datasets
   */
  saveIssuesBatch(issues: readonly NewKanbanIssueEntity[]): Promise<readonly KanbanIssueEntity[]>;

  /**
   * Gets Kanban issue by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  getIssueById(issueId: string): Promise<KanbanIssueEntity | null>;

  /**
   * Gets Kanban issue by key
   * Following Clean Code: Express intent, common query pattern
   */
  getIssueByKey(issueKey: string): Promise<KanbanIssueEntity | null>;

  /**
   * Gets all issues for a specific board
   * Following Clean Code: Express intent, board-specific queries
   */
  getIssuesByBoardId(boardId: string): Promise<readonly KanbanIssueEntity[]>;

  /**
   * Gets completed issues for cycle time analysis
   * Following Clean Code: Express intent, filtering for metrics calculation
   */
  getCompletedIssues(boardId: string, excludeReopened?: boolean): Promise<readonly KanbanIssueEntity[]>;

  /**
   * Gets issues filtered by type and date range
   * Following Clean Code: Express intent, advanced filtering for analytics
   */
  getIssuesFiltered(
    boardId: string, 
    options?: {
      issueTypes?: readonly string[];
      startDate?: string;
      endDate?: string;
      excludeReopened?: boolean;
    }
  ): Promise<readonly KanbanIssueEntity[]>;

  /**
   * Updates issue cycle time data
   * Following Clean Code: Single responsibility, specific update operation
   */
  updateIssueCycleTime(
    issueId: string, 
    cycleTimeData: {
      boardEntryDate?: string | null;
      lastDoneDate?: string | null;
      cycleTimeDays?: number | null;
      isReopened?: boolean;
      excludeFromMetrics?: boolean;
    }
  ): Promise<KanbanIssueEntity | null>;

  /**
   * Deletes issue by ID
   * Following Clean Code: Single responsibility
   */
  deleteIssue(issueId: string): Promise<void>;

  /**
   * Deletes all issues for a board
   * Following Clean Code: Bulk operation for cleanup
   */
  deleteIssuesByBoardId(boardId: string): Promise<void>;
}

/**
 * Repository interface for Kanban Board Configuration persistence
 * Following Clean Architecture: Dependency Inversion Principle
 * Following Clean Code: Single responsibility - board configuration only
 */
export interface KanbanBoardConfigRepository {
  /**
   * Saves board configuration
   * Following Clean Code: Single responsibility
   */
  saveBoardConfig(config: NewKanbanBoardConfigEntity): Promise<KanbanBoardConfigEntity>;

  /**
   * Gets board configuration by board ID
   * Following Clean Code: Command-Query Separation (query)
   */
  getBoardConfig(boardId: string): Promise<KanbanBoardConfigEntity | null>;

  /**
   * Updates board configuration
   * Following Clean Code: Express intent, configuration updates
   */
  updateBoardConfig(
    boardId: string,
    updates: Partial<Omit<NewKanbanBoardConfigEntity, 'boardId'>>
  ): Promise<KanbanBoardConfigEntity | null>;

  /**
   * Gets all board configurations
   * Following Clean Code: Express intent, list all configurations
   */
  getAllBoardConfigs(): Promise<readonly KanbanBoardConfigEntity[]>;

  /**
   * Gets board configurations by project key
   * Following Clean Code: Express intent, project-specific queries
   */
  getBoardConfigsByProject(projectKey: string): Promise<readonly KanbanBoardConfigEntity[]>;

  /**
   * Deletes board configuration
   * Following Clean Code: Single responsibility
   */
  deleteBoardConfig(boardId: string): Promise<void>;
}


