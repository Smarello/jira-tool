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
 * Indexes for board configurations table
 * Following Clean Code: Separate concerns, efficient queries
 */
export const boardConfigurationsIndexes = {
  projectKeyIdx: index('idx_board_configurations_project_key').on(boardConfigurations.projectKey),
  typeIdx: index('idx_board_configurations_type').on(boardConfigurations.type),
  isActiveIdx: index('idx_board_configurations_is_active').on(boardConfigurations.isActive),
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
 * Type definitions for Turso entities
 * Following Clean Code: Express intent through types
 */
export type TursoClosedSprintEntity = typeof closedSprints.$inferSelect;
export type TursoNewClosedSprintEntity = typeof closedSprints.$inferInsert;
export type TursoBoardConfigurationEntity = typeof boardConfigurations.$inferSelect;
export type TursoNewBoardConfigurationEntity = typeof boardConfigurations.$inferInsert;
export type TursoSprintIssuesEntity = typeof sprintIssues.$inferSelect;
export type TursoNewSprintIssuesEntity = typeof sprintIssues.$inferInsert;

/**
 * Database schema export for Drizzle migrations
 * Following Clean Code: Single point of schema definition
 */
export const tursoSchema = {
  closedSprints,
  boardConfigurations,
  sprintIssues,
  // Indexes are now separate exports for the new Drizzle API
  closedSprintsIndexes,
  boardConfigurationsIndexes,
  sprintIssuesIndexes,
} as const;
