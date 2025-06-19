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
export const closedSprints = sqliteTable(
  'closed_sprints',
  {
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
  },
  (table) => ({
    // Indexes for efficient queries on Turso
    boardIdIdx: index('idx_closed_sprints_board_id').on(table.boardId),
    completeDateIdx: index('idx_closed_sprints_complete_date').on(table.completeDate),
    stateIdx: index('idx_closed_sprints_state').on(table.state),
    originBoardIdIdx: index('idx_closed_sprints_origin_board_id').on(table.originBoardId),
    // Composite index for common queries
    boardDateIdx: index('idx_closed_sprints_board_date').on(table.boardId, table.completeDate),
  })
);

/**
 * Board configurations table for Turso
 * Following Clean Code: Single responsibility for board metadata
 */
export const boardConfigurations = sqliteTable(
  'board_configurations',
  {
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
  },
  (table) => ({
    // Indexes for board configuration queries
    projectKeyIdx: index('idx_board_configurations_project_key').on(table.projectKey),
    typeIdx: index('idx_board_configurations_type').on(table.type),
    isActiveIdx: index('idx_board_configurations_is_active').on(table.isActive),
  })
);

/**
 * Sprint issues table for detailed issue tracking
 * Following Clean Code: Separate concern for issues data
 */
export const sprintIssues = sqliteTable(
  'sprint_issues',
  {
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
    
    // Additional data as JSON
    customFields: text('custom_fields'),   // JSON: additional fields
    statusHistory: text('status_history'), // JSON: status change history
    
    // Audit fields
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => ({
    // Indexes for issue queries
    sprintIdIdx: index('idx_sprint_issues_sprint_id').on(table.sprintId),
    issueKeyIdx: index('idx_sprint_issues_issue_key').on(table.issueKey),
    statusIdx: index('idx_sprint_issues_status').on(table.status),
    issueTypeIdx: index('idx_sprint_issues_issue_type').on(table.issueType),
    assigneeIdx: index('idx_sprint_issues_assignee').on(table.assignee),
    resolvedIdx: index('idx_sprint_issues_resolved').on(table.resolved),
    // Composite indexes for common queries
    sprintStatusIdx: index('idx_sprint_issues_sprint_status').on(table.sprintId, table.status),
    sprintTypeIdx: index('idx_sprint_issues_sprint_type').on(table.sprintId, table.issueType),
  })
);

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
} as const;
