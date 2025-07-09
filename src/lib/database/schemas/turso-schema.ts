/**
 * Turso database schema using Drizzle ORM
 * Following Clean Architecture: Infrastructure layer schema definition
 * Following Clean Code: Express intent, type safety, immutability
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Closed sprints table for Turso
 * Following Clean Code: Express intent, proper constraints
 */
export const closedSprints = sqliteTable('closed_sprints', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull(),
  name: text('name').notNull(),
  state: text('state').notNull().$type<'closed'>(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  completeDate: text('complete_date'),
  goal: text('goal'),
  originBoardId: text('origin_board_id').notNull(),

  // JSON data stored as text (SQLite/Turso limitation)
  velocityData: text('velocity_data'), // Serialized SprintVelocityData
  issuesData: text('issues_data'),     // Serialized JiraIssueWithPoints[]
  metricsData: text('metrics_data'),   // Serialized SprintMetricsData

  // Audit fields with SQLite datetime functions
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Indexes for closed sprints table
 * Following Clean Code: Separate concerns, efficient queries
 */
export const closedSprintsIndexes = {
  boardIdIdx: index('idx_closed_sprints_board_id').on(closedSprints.boardId),
  completeDateIdx: index('idx_closed_sprints_complete_date').on(closedSprints.completeDate),
  stateIdx: index('idx_closed_sprints_state').on(closedSprints.state),
  originBoardIdIdx: index('idx_closed_sprints_origin_board_id').on(closedSprints.originBoardId),
  // Composite index for common queries
  boardDateIdx: index('idx_closed_sprints_board_date').on(closedSprints.boardId, closedSprints.completeDate),
};

/**
 * Board configurations table for Turso
 * Following Clean Code: Single responsibility for board metadata
 */
export const boardConfigurations = sqliteTable('board_configurations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<'scrum' | 'kanban'>(),
  projectKey: text('project_key'),

  // Configuration data as JSON strings
  doneStatusIds: text('done_status_ids'),    // JSON array of status IDs
  storyPointsField: text('story_points_field'), // Story points field name
  customFields: text('custom_fields'),       // Additional custom field mappings

  // Cache metadata
  lastFetched: text('last_fetched'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),

  // Audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Board metrics table for storing calculated velocity metrics
 * Following Clean Code: Single responsibility for board velocity metrics
 */
export const boardMetrics = sqliteTable('board_metrics', {
  boardId: text('board_id').primaryKey(),
  boardName: text('board_name').notNull(),

  // Calculated velocity metrics
  averageVelocity: integer('average_velocity').notNull(),
  predictability: integer('predictability').notNull(),
  trend: text('trend').notNull().$type<'up' | 'down' | 'stable' | 'no-data'>(),
  sprintsAnalyzed: integer('sprints_analyzed').notNull(),
  averageSprintCompletionRate: integer('average_sprint_completion_rate').notNull().default(0),

  // Audit fields
  lastCalculated: text('last_calculated').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
});

/**
 * Indexes for board configurations table
 * Following Clean Code: Separate concerns, efficient queries
 */
export const boardConfigurationsIndexes = {
  projectKeyIdx: index('idx_board_configurations_project_key').on(boardConfigurations.projectKey),
  typeIdx: index('idx_board_configurations_type').on(boardConfigurations.type),
  isActiveIdx: index('idx_board_configurations_is_active').on(boardConfigurations.isActive),
};

/**
 * Indexes for board metrics table
 * Following Clean Code: Performance optimization for metrics queries
 */
export const boardMetricsIndexes = {
  lastCalculatedIdx: index('idx_board_metrics_last_calculated').on(boardMetrics.lastCalculated),
};

/**
 * Sprint issues table for detailed issue tracking
 * Following Clean Code: Separate concern for issues data
 */
export const sprintIssues = sqliteTable('sprint_issues', {
  id: text('id').primaryKey(), // Composite: sprintId-issueKey
  sprintId: text('sprint_id').notNull(),
  issueKey: text('issue_key').notNull(),
  issueId: text('issue_id').notNull(),
  summary: text('summary').notNull(),
  status: text('status').notNull(),
  issueType: text('issue_type').notNull(),
  storyPoints: integer('story_points'),
  assignee: text('assignee'),

  // Issue timestamps
  created: text('created').notNull(),
  updated: text('updated').notNull(),
  resolved: text('resolved'),

  // Completion tracking for velocity validation
  completionDate: text('completion_date'), // When issue moved to last kanban column

  // Additional data as JSON
  customFields: text('custom_fields'),   // JSON: additional fields
  statusHistory: text('status_history'), // JSON: status change history

  // Audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Indexes for sprint issues table
 * Following Clean Code: Separate concerns, efficient queries
 */
export const sprintIssuesIndexes = {
  sprintIdIdx: index('idx_sprint_issues_sprint_id').on(sprintIssues.sprintId),
  issueKeyIdx: index('idx_sprint_issues_issue_key').on(sprintIssues.issueKey),
  statusIdx: index('idx_sprint_issues_status').on(sprintIssues.status),
  issueTypeIdx: index('idx_sprint_issues_issue_type').on(sprintIssues.issueType),
  assigneeIdx: index('idx_sprint_issues_assignee').on(sprintIssues.assignee),
  resolvedIdx: index('idx_sprint_issues_resolved').on(sprintIssues.resolved),
  completionDateIdx: index('idx_sprint_issues_completion_date').on(sprintIssues.completionDate),
  // Composite indexes for common queries
  sprintStatusIdx: index('idx_sprint_issues_sprint_status').on(sprintIssues.sprintId, sprintIssues.status),
  sprintTypeIdx: index('idx_sprint_issues_sprint_type').on(sprintIssues.sprintId, sprintIssues.issueType),
  sprintCompletionIdx: index('idx_sprint_issues_sprint_completion').on(sprintIssues.sprintId, sprintIssues.completionDate),
};

/**
 * Kanban Issues table for Turso
 * Following PRD requirements: simplified schema with only essential fields
 */
export const kanbanIssues = sqliteTable('kanban_issues', {
  // Primary identifiers
  id: text('id').primaryKey(),          // Jira issue ID
  key: text('key').notNull().unique(),  // Jira issue key (e.g., PROJ-123)
  summary: text('summary').notNull(),
  issueType: text('issue_type').notNull(),
  status: text('status').notNull(),     // Current Jira status (stato finale)
  assignee: text('assignee'),
  boardId: text('board_id').notNull(),
  boardName: text('board_name').notNull(),

  // Cycle time calculation fields (core PRD requirements)
  boardEntryDate: text('board_entry_date'),       // Date when issue entered board (or creation)
  lastDoneDate: text('last_done_date'),           // Last time issue entered "Done" column
  cycleTimeDays: integer('cycle_time_days'),      // Calculated cycle time in days

  // Issue lifecycle dates (PRD requirements)
  created: text('created').notNull(),             // Issue creation date (data apertura)
  resolved: text('resolved'),                     // Resolution date (data chiusura)

  // Issue reopened handling (PRD requirement: exclude reopened issues)
  isReopened: integer('is_reopened', { mode: 'boolean' }).default(false).notNull(),
  excludeFromMetrics: integer('exclude_from_metrics', { mode: 'boolean' }).default(false).notNull(),

  // Audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Kanban Board Configurations table for Turso
 * Simplified to only essential PRD requirements
 */
export const kanbanBoardConfigs = sqliteTable('kanban_board_configs', {
  boardId: text('board_id').primaryKey(),
  boardName: text('board_name').notNull(),
  projectKey: text('project_key').notNull(),
  
  // Column mapping configuration (core PRD requirement)
  columnMappings: text('column_mappings').notNull(),    // JSON: StatusMapping[]
  doneColumns: text('done_columns').notNull(),          // JSON: string[]
  
  // Audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Indexes for Kanban Issues table
 * Following Clean Code: Performance optimization for common queries
 */
export const kanbanIssuesIndexes = {
  boardIdIdx: index('idx_kanban_issues_board_id').on(kanbanIssues.boardId),
  statusIdx: index('idx_kanban_issues_status').on(kanbanIssues.status),
  issueTypeIdx: index('idx_kanban_issues_issue_type').on(kanbanIssues.issueType),
  assigneeIdx: index('idx_kanban_issues_assignee').on(kanbanIssues.assignee),
  lastDoneDateIdx: index('idx_kanban_issues_last_done_date').on(kanbanIssues.lastDoneDate),
  boardEntryDateIdx: index('idx_kanban_issues_board_entry_date').on(kanbanIssues.boardEntryDate),
  cycleTimeDaysIdx: index('idx_kanban_issues_cycle_time_days').on(kanbanIssues.cycleTimeDays),
  excludeFromMetricsIdx: index('idx_kanban_issues_exclude_metrics').on(kanbanIssues.excludeFromMetrics),
  isReopenedIdx: index('idx_kanban_issues_is_reopened').on(kanbanIssues.isReopened),
  
  // Composite indexes for common query patterns
  boardStatusIdx: index('idx_kanban_issues_board_status').on(kanbanIssues.boardId, kanbanIssues.status),
  boardTypeIdx: index('idx_kanban_issues_board_type').on(kanbanIssues.boardId, kanbanIssues.issueType),
  boardDateRangeIdx: index('idx_kanban_issues_board_date_range').on(
    kanbanIssues.boardId, 
    kanbanIssues.lastDoneDate, 
    kanbanIssues.excludeFromMetrics
  ),
  
  // Analytics-specific indexes
  analyticsIdx: index('idx_kanban_issues_analytics').on(
    kanbanIssues.boardId,
    kanbanIssues.excludeFromMetrics,
    kanbanIssues.isReopened,
    kanbanIssues.cycleTimeDays
  ),
};

/**
 * Indexes for Kanban Board Configs table
 */
export const kanbanBoardConfigsIndexes = {
  projectKeyIdx: index('idx_kanban_board_configs_project_key').on(kanbanBoardConfigs.projectKey),
};

/**
 * Type definitions for Turso entities
 * Following Clean Code: Express intent through types
 */
export type TursoClosedSprintEntity = typeof closedSprints.$inferSelect;
export type TursoNewClosedSprintEntity = typeof closedSprints.$inferInsert;
export type TursoBoardConfigurationEntity = typeof boardConfigurations.$inferSelect;
export type TursoNewBoardConfigurationEntity = typeof boardConfigurations.$inferInsert;
export type TursoBoardMetricsEntity = typeof boardMetrics.$inferSelect;
export type TursoNewBoardMetricsEntity = typeof boardMetrics.$inferInsert;
export type TursoSprintIssuesEntity = typeof sprintIssues.$inferSelect;
export type TursoNewSprintIssuesEntity = typeof sprintIssues.$inferInsert;

/**
 * Type definitions for Kanban Turso entities
 * Following Clean Code: Express intent through types
 */
export type TursoKanbanIssueEntity = typeof kanbanIssues.$inferSelect;
export type TursoNewKanbanIssueEntity = typeof kanbanIssues.$inferInsert;
export type TursoKanbanBoardConfigEntity = typeof kanbanBoardConfigs.$inferSelect;
export type TursoNewKanbanBoardConfigEntity = typeof kanbanBoardConfigs.$inferInsert;

/**
 * Database schema export for Drizzle migrations
 * Following Clean Code: Single point of schema definition
 */
export const tursoSchema = {
  closedSprints,
  boardConfigurations,
  boardMetrics,
  sprintIssues,
  // Kanban tables
  kanbanIssues,
  kanbanBoardConfigs,
} as const;
