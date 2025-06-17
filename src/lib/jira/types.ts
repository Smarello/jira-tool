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
