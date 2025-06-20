/**
 * Database schema definition - Database agnostic
 * Following Clean Architecture: Domain entities reflected in persistence layer
 * Following Clean Code: Express intent, type safety, immutability
 */

/**
 * Database-agnostic schema definitions
 * These will be implemented by concrete database providers
 */

/**
 * Closed sprint entity structure
 * Following Clean Code: Express intent, immutability
 */
export interface ClosedSprintEntity {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly state: 'closed';
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly completeDate: string | null;
  readonly goal: string | null;
  readonly originBoardId: string;

  // JSON data serialized as text
  readonly velocityData: string | null; // Serialized SprintVelocityData
  readonly issuesData: string | null;   // Serialized issues array
  readonly metricsData: string | null;  // Serialized additional metrics

  // Audit fields
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * New closed sprint entity for insertions
 * Following Clean Code: Express intent, optional audit fields
 */
export interface NewClosedSprintEntity {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly state: 'closed';
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly completeDate?: string | null;
  readonly goal?: string | null;
  readonly originBoardId: string;
  readonly velocityData?: string | null;
  readonly issuesData?: string | null;
  readonly metricsData?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Board configuration entity structure
 * Following Clean Code: Single responsibility for board metadata
 */
export interface BoardConfigurationEntity {
  readonly id: string;
  readonly name: string;
  readonly type: 'scrum' | 'kanban';
  readonly projectKey: string | null;

  // Configuration data as JSON strings
  readonly doneStatusIds: string | null;    // JSON array of status IDs
  readonly storyPointsField: string | null; // Story points field name
  readonly customFields: string | null;     // Additional custom field mappings

  // Cache metadata
  readonly lastFetched: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * New board configuration entity for insertions
 * Following Clean Code: Express intent, optional fields
 */
export interface NewBoardConfigurationEntity {
  readonly id: string;
  readonly name: string;
  readonly type: 'scrum' | 'kanban';
  readonly projectKey?: string | null;
  readonly doneStatusIds?: string | null;
  readonly storyPointsField?: string | null;
  readonly customFields?: string | null;
  readonly lastFetched?: string | null;
  readonly isActive?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Sprint issues cache entity
 * Following Clean Code: Separate concern for issues data
 */
export interface SprintIssuesEntity {
  readonly id: string; // Composite: sprintId-issueKey
  readonly sprintId: string;
  readonly issueKey: string;
  readonly issueId: string;
  readonly summary: string;
  readonly status: string;
  readonly issueType: string;
  readonly storyPoints: number | null;
  readonly assignee: string | null;

  // Timestamps
  readonly created: string;
  readonly updated: string;
  readonly resolved: string | null;

  // Completion tracking for velocity validation
  readonly completionDate: string | null; // When issue moved to last kanban column

  // Additional data as JSON
  readonly customFields: string | null;
  readonly statusHistory: string | null; // JSON array of status changes

  // Audit fields
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * New sprint issues entity for insertions
 */
export interface NewSprintIssuesEntity {
  readonly id: string;
  readonly sprintId: string;
  readonly issueKey: string;
  readonly issueId: string;
  readonly summary: string;
  readonly status: string;
  readonly issueType: string;
  readonly storyPoints?: number | null;
  readonly assignee?: string | null;
  readonly created: string;
  readonly updated: string;
  readonly resolved?: string | null;
  readonly completionDate?: string | null; // When issue moved to last kanban column
  readonly customFields?: string | null;
  readonly statusHistory?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}
