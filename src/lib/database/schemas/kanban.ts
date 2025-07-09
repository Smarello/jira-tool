/**
 * Kanban-specific database schema definitions
 * Following Clean Architecture: Database agnostic entity definitions
 * Following Clean Code: Express intent, type safety, minimal interface
 * Simplified schema following PRD requirements exactly
 */

/**
 * Kanban Issue entity structure for persistence
 * Following PRD requirements: only essential fields for cycle time analytics
 */
export interface KanbanIssueEntity {
  readonly id: string;                    // Jira issue ID
  readonly key: string;                   // Jira issue key (e.g., PROJ-123)
  readonly summary: string;               // Issue summary/title
  readonly issueType: string;             // Issue type (Story, Bug, etc.)
  readonly status: string;                // Current Jira status (stato finale)
  readonly assignee: string | null;       // Assigned user
  readonly boardId: string;               // Kanban board ID
  readonly boardName: string;             // Board name for easier querying

  // Cycle time calculation fields (core PRD requirements)
  readonly boardEntryDate: string | null; // Date when issue entered board (or creation)
  readonly lastDoneDate: string | null;   // Last time issue entered "Done" column
  readonly cycleTimeDays: number | null;  // Calculated cycle time in days

  // Issue lifecycle dates (PRD requirements)
  readonly created: string;               // Issue creation date (data apertura)
  readonly resolved: string | null;       // Resolution date (data chiusura)

  // Issue reopened handling (PRD requirement: exclude reopened issues)
  readonly isReopened: boolean;           // Whether issue was reopened after being done
  readonly excludeFromMetrics: boolean;   // Whether to exclude from cycle time calculations

  // Audit fields
  readonly createdAt: string;             // Record creation timestamp
  readonly updatedAt: string;             // Record last update timestamp
}

/**
 * New Kanban Issue entity for insertions
 * Following Clean Code: Express intent, optional audit fields
 */
export interface NewKanbanIssueEntity {
  readonly id: string;
  readonly key: string;
  readonly summary: string;
  readonly issueType: string;
  readonly status: string;
  readonly assignee?: string | null;
  readonly boardId: string;
  readonly boardName: string;
  readonly boardEntryDate?: string | null;
  readonly lastDoneDate?: string | null;
  readonly cycleTimeDays?: number | null;
  readonly created: string;
  readonly resolved?: string | null;
  readonly isReopened?: boolean;
  readonly excludeFromMetrics?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Kanban Board Configuration entity
 * Stores board-specific configuration for cycle time calculations
 * Simplified to only essential PRD requirements
 */
export interface KanbanBoardConfigEntity {
  readonly boardId: string;              // Primary key - Jira board ID
  readonly boardName: string;            // Board name
  readonly projectKey: string;           // Project key
  
  // Column mapping configuration (core PRD requirement)
  readonly columnMappings: string;       // JSON: StatusMapping[] - column to status mappings
  readonly doneColumns: string;          // JSON: string[] - columns marked as "Done"
  
  // Audit fields
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * New Kanban Board Configuration entity for insertions
 */
export interface NewKanbanBoardConfigEntity {
  readonly boardId: string;
  readonly boardName: string;
  readonly projectKey: string;
  readonly columnMappings: string;
  readonly doneColumns: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}


