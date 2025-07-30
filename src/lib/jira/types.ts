/**
 * Core Jira types for the Jira Tool dashboard
 * Following Clean Architecture: Domain entities and value objects
 */

export interface JiraIssue {
  readonly id: string;
  readonly key: string;
  readonly summary: string;
  readonly description: string | null;
  readonly status: IssueStatus;
  readonly priority: IssuePriority;
  readonly issueType: IssueType;
  readonly assignee: JiraUser | null;
  readonly reporter: JiraUser;
  readonly created: string;
  readonly updated: string;
  readonly resolved: string | null;
}

export interface IssueStatus {
  readonly id: string;
  readonly name: string;
  readonly statusCategory: StatusCategory;
}

export interface StatusCategory {
  readonly id: number;
  readonly name: 'To Do' | 'In Progress' | 'Done';
  readonly colorName: string;
}

export interface IssuePriority {
  readonly id: string;
  readonly name: string;
  readonly iconUrl: string;
}

export interface IssueType {
  readonly id: string;
  readonly name: string;
  readonly iconUrl: string;
  readonly subtask: boolean;
}

export interface JiraUser {
  readonly accountId: string;
  readonly displayName: string;
  readonly emailAddress: string;
  readonly avatarUrls: AvatarUrls;
}

export interface AvatarUrls {
  readonly '16x16': string;
  readonly '24x24': string;
  readonly '32x32': string;
  readonly '48x48': string;
}

export interface JiraProject {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly lead: JiraUser;
}

/**
 * Dashboard metrics - calculated data
 */
export interface DashboardMetrics {
  readonly totalIssues: number;
  readonly openIssues: number;
  readonly inProgressIssues: number;
  readonly resolvedIssues: number;
  readonly averageResolutionDays: number;
  readonly issuesByPriority: readonly PriorityCount[];
  readonly issuesByType: readonly TypeCount[];
}

export interface PriorityCount {
  readonly priority: string;
  readonly count: number;
}

export interface TypeCount {
  readonly type: string;
  readonly count: number;
}

/**
 * API response wrapper
 */
export interface JiraApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Environment configuration
 */
export interface JiraConfig {
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
  readonly projectKey: string;
}

/**
 * Kanban Domain Entities - Following Clean Architecture principles
 * These entities represent the core business concepts for Kanban analytics
 */

/**
 * Kanban Board entity with dynamic column-status mapping
 * Represents a Jira Kanban board with its configuration and metadata
 */
export interface KanbanBoard {
  readonly id: string;
  readonly name: string;
  readonly type: 'kanban';
  readonly projectId: string;
  readonly projectKey: string;
  readonly location: BoardLocation;
  readonly columnConfig: ColumnConfiguration;
  readonly filter: BoardFilter;
  readonly canEdit: boolean;
  readonly isPrivate: boolean;
}

/**
 * Board location information
 */
export interface BoardLocation {
  readonly type: 'project' | 'user';
  readonly projectId?: string;
  readonly userId?: string;
  readonly displayName: string;
}

/**
 * Column configuration for Kanban board
 * Maps board columns to Jira statuses dynamically
 */
export interface ColumnConfiguration {
  readonly columns: readonly BoardColumn[];
  readonly constraintType: 'issueCount' | 'none';
}

/**
 * Individual board column with status mapping
 */
export interface BoardColumn {
  readonly name: string;
  readonly statuses: readonly ColumnStatus[];
  readonly min?: number;
  readonly max?: number;
}

/**
 * Status within a column - maps Jira status to board column
 */
export interface ColumnStatus {
  readonly id: string;
  readonly self: string;
  readonly name: string;
  readonly statusCategory: StatusCategory;
}

/**
 * Board filter configuration
 */
export interface BoardFilter {
  readonly id: string;
  readonly name: string;
  readonly query: string;
  readonly description: string;
  readonly owner: JiraUser;
  readonly jql: string;
}

/**
 * Enhanced Kanban Issue - extends base JiraIssue with Kanban-specific data
 * Includes cycle time tracking and board-specific metadata
 */
export interface KanbanIssue extends JiraIssue {
  readonly boardId: string;
  readonly boardEntryDate: string | null; // Date when issue entered the board
  readonly lastDoneDate: string | null;   // Last time issue entered "Done" column
  readonly cycleTime: CycleTime | null;   // Calculated cycle time
  readonly isReopened: boolean;           // Whether issue was reopened after being done
  readonly currentColumn: string | null;  // Current board column name
  readonly columnHistory: readonly ColumnTransition[]; // History of column movements
}

/**
 * CycleTime Value Object - immutable representation of cycle time calculation
 * Following Domain-Driven Design principles
 */
export interface CycleTime {
  readonly startDate: string;      // Board entry date (or creation date if no entry)
  readonly endDate: string;        // Last "Done" date
  readonly durationDays: number;   // Calculated cycle time in days
  readonly durationHours: number;  // Calculated cycle time in hours
  readonly isEstimated: boolean;   // True if startDate was estimated (using creation date)
  readonly calculationMethod: 'board_entry' | 'creation_date';
}

/**
 * Column transition tracking for issue history
 */
export interface ColumnTransition {
  readonly fromColumn: string | null;
  readonly toColumn: string;
  readonly transitionDate: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
}

/**
 * Column Mapping Value Object - maps board columns to status categories
 * Used for dynamic board configuration and validation
 */
export interface ColumnMapping {
  readonly boardId: string;
  readonly mappings: readonly StatusMapping[];
  readonly doneColumns: readonly string[]; // Columns that represent "Done" state
  readonly inProgressColumns: readonly string[]; // Columns that represent work in progress
  readonly todoColumns: readonly string[]; // Columns that represent backlog/todo
}

/**
 * Individual status mapping within column configuration
 */
export interface StatusMapping {
  readonly columnName: string;
  readonly statusId: string;
  readonly statusName: string;
  readonly statusCategory: StatusCategory;
  readonly isRequired: boolean; // Whether this status is required for the column
}

/**
 * Repository interfaces following Clean Architecture dependency inversion
 */

/**
 * Kanban Board Repository interface
 * Defines contract for board data access without implementation details
 */
export interface KanbanBoardRepository {
  readonly findById: (id: string) => Promise<KanbanBoard | null>;
  readonly findAll: () => Promise<readonly KanbanBoard[]>;
  readonly findByProjectId: (projectId: string) => Promise<readonly KanbanBoard[]>;
  readonly findByProjectKey: (projectKey: string) => Promise<readonly KanbanBoard[]>;
  readonly getColumnConfiguration: (boardId: string) => Promise<ColumnConfiguration | null>;
  readonly validateBoardConfiguration: (board: KanbanBoard) => Promise<ValidationResult>;
}

/**
 * Kanban Issue Repository interface
 * Defines contract for issue data access and cycle time calculations
 */
export interface KanbanIssueRepository {
  readonly findByBoardId: (boardId: string, filters?: IssueFilters) => Promise<readonly KanbanIssue[]>;
  readonly findCompletedIssues: (boardId: string, filters?: IssueFilters) => Promise<readonly KanbanIssue[]>;
  readonly calculateCycleTime: (issue: JiraIssue, board: KanbanBoard) => Promise<CycleTime | null>;
  readonly getIssueColumnHistory: (issueId: string, boardId: string) => Promise<readonly ColumnTransition[]>;
  readonly isIssueReopened: (issueId: string, boardId: string) => Promise<boolean>;
  readonly save: (issue: KanbanIssue) => Promise<void>;
  readonly saveMany: (issues: readonly KanbanIssue[]) => Promise<void>;
}

/**
 * Predefined time periods for analytics filtering
 * Following Clean Code: Express intent, clear enumeration
 */
export enum TimePeriod {
  LAST_15_DAYS = 'last-15-days',
  LAST_MONTH = 'last-month', 
  LAST_3_MONTHS = 'last-3-months',
  CUSTOM = 'custom'
}

/**
 * Time period filter for analytics
 * Following Clean Code: Value object, immutable
 */
export interface TimePeriodFilter {
  readonly type: TimePeriod;
  readonly customRange?: DateRange;
}

/**
 * Issue filters for repository queries
 */
export interface IssueFilters {
  readonly issueTypes?: readonly string[];
  readonly assignees?: readonly string[];
  readonly dateRange?: DateRange;
  readonly timePeriod?: TimePeriodFilter;
  readonly excludeReopened?: boolean;
  readonly jqlFilter?: string;
}

/**
 * Date range filter
 */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/**
 * Validation result for board configuration
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Validation warning details  
 */
export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly suggestion?: string;
}

/**
 * Cycle Time Percentile Analysis Types
 * Following Clean Architecture: Domain entities for statistical analysis
 */

/**
 * Result of percentile calculation
 */
export interface PercentileResult {
  readonly percentile: number;
  readonly cycleTimeHours: number;
  readonly sampleSize: number;
  readonly calculatedAt: string;
}

/**
 * Multiple percentiles calculation result
 */
export interface MultiplePercentilesResult {
  readonly percentiles: Record<number, number>;
  readonly sampleSize: number;
  readonly calculatedAt: string;
}

/**
 * Time spent in a specific status
 * Following Clean Code: Express intent, immutability
 */
export interface StatusTimeSpent {
  readonly statusId: string;
  readonly statusName: string;
  readonly timeSpentHours: number;
  readonly timeSpentDays: number;
  readonly entryDate: string;
  readonly exitDate: string | null; // null if still in this status
}

/**
 * Issue detail for analytics display
 * Contains essential information for showing issue details in analytics tables
 * Following Clean Code: Value object, expressing UI intent
 */
export interface IssueDetail {
  readonly key: string;
  readonly summary: string;
  readonly issueType: {
    readonly name: string;
    readonly iconUrl: string;
  };
  readonly status: {
    readonly name: string;
    readonly statusCategory: StatusCategory;
  };
  readonly jiraUrl: string; // Direct link to the issue in Jira
  readonly cycleTimeDays?: number; // Cycle time in days if completed
  readonly openedDate?: string; // Date when issue was created or entered the board
  readonly lastDoneDate?: string; // Date when issue was last completed
  readonly statusTimes?: readonly StatusTimeSpent[]; // Time spent in each column status
}

/**
 * Kanban Analytics Result - contains cycle time percentiles for a board
 * Following Clean Code: Express intent, immutable data structure
 */
export interface KanbanAnalyticsResult {
  readonly boardId: string;
  readonly totalIssues: number;
  readonly completedIssues: number;
  readonly cycleTimePercentiles: CycleTimePercentiles;
  readonly cycleTimeProbability?: CycleTimeProbabilityDistribution;
  readonly issuesDetails: readonly IssueDetail[]; // Details of issues used for percentile calculation
  readonly calculatedAt: string; // ISO timestamp
}

/**
 * Cycle Time Probability Distribution - statistical breakdown by day ranges
 * Following Clean Code: Value object, expressing domain concept
 */
export interface CycleTimeProbabilityDistribution {
  readonly dayRanges: readonly CycleTimeProbabilityRange[];
  readonly recommendations: CycleTimeRecommendations;
}

/**
 * Cycle Time Probability Range - single day range with statistics
 * Following Clean Code: Value object, immutable
 */
export interface CycleTimeProbabilityRange {
  readonly range: string;           // "0-1", "1-2", etc.
  readonly probability: number;     // Percentage for this range (0-100)
  readonly confidence: number;      // Cumulative percentage (0-100)
  readonly isRecommended: boolean;  // Sweet spot ranges for planning
  readonly count: number;          // Number of issues in this range
  readonly minDays: number;        // Lower bound of range
  readonly maxDays: number;        // Upper bound of range
}

/**
 * Cycle Time Recommendations - actionable insights for planning
 * Following Clean Code: Value object, expressing business intent
 */
export interface CycleTimeRecommendations {
  readonly minDays: number;        // Recommended minimum days for planning
  readonly maxDays: number;        // Recommended maximum days for planning
  readonly confidenceLevel: number; // Confidence level for recommendation (0-100)
}

/**
 * Cycle Time Percentiles - statistical distribution of cycle times
 * Following Clean Code: Value object, immutable
 */
export interface CycleTimePercentiles {
  readonly p50: number; // 50th percentile (median) in hours
  readonly p75: number; // 75th percentile in hours  
  readonly p85: number; // 85th percentile in hours
  readonly p95: number; // 95th percentile in hours
  readonly sampleSize: number; // Number of completed issues used for calculation
}

/**
 * Custom exception for percentile calculation errors
 */
export class PercentileCalculationError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'PercentileCalculationError';
    this.code = code;
    this.context = context;
  }
}
