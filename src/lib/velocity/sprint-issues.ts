/**
 * Sprint issues utilities and data structures
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards.js';
import type { AdvancedValidationResult } from './advanced-validator.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { isIssueCompletedWithinSprint } from './date-validator.js';
import { validateIssuesForVelocity, calculateValidatedStoryPoints } from './advanced-validator.js';

/**
 * Sprint issue for modal display
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface SprintIssueDisplay extends JiraIssueWithPoints {
  readonly jiraUrl: string;
  readonly statusColor: string;
  readonly priorityColor: string;
  readonly isClosedAfterSprintEnd: boolean;
  readonly validationReason?: 'done_at_sprint_end' | 'not_valid';
  readonly doneTransitionDate?: string;
}

/**
 * Generates Jira issue URL
 * Following Clean Code: Pure function, single responsibility
 */
export function generateJiraIssueUrl(issueKey: string, baseUrl?: string): string {
  // Use environment variable or fallback to common Jira URL pattern
  const jiraBaseUrl = baseUrl || process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
  return `${jiraBaseUrl}/browse/${issueKey}`;
}

/**
 * Maps status to display color
 * Following Clean Code: Express intent, consistent mapping
 */
export function getStatusColor(statusName: string): string {
  const statusLower = statusName.toLowerCase();
  
  if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) {
    return 'text-green-600 bg-green-100';
  }
  
  if (statusLower.includes('progress') || statusLower.includes('review') || statusLower.includes('testing')) {
    return 'text-blue-600 bg-blue-100';
  }
  
  if (statusLower.includes('blocked') || statusLower.includes('failed')) {
    return 'text-red-600 bg-red-100';
  }
  
  // Default for new, open, to do, etc.
  return 'text-gray-600 bg-gray-100';
}

/**
 * Maps priority to display color
 * Following Clean Code: Express intent, DRY principle
 */
export function getPriorityColor(priorityName: string): string {
  const priorityLower = priorityName.toLowerCase();
  
  switch (priorityLower) {
    case 'highest':
    case 'blocker':
      return 'text-red-600';
    case 'high':
    case 'critical':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
    case 'lowest':
    case 'trivial':
      return 'text-gray-500';
    default:
      return 'text-gray-600';
  }
}

/**
 * Sorts issues by last updated date (most recent first)
 * Following Clean Code: Pure function, express intent
 */
export function sortIssuesByUpdated(issues: readonly JiraIssueWithPoints[]): readonly JiraIssueWithPoints[] {
  return [...issues].sort((a, b) => {
    const dateA = new Date(a.updated);
    const dateB = new Date(b.updated);
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });
}

/**
 * Transforms issues for modal display with advanced validation info
 * Following Clean Code: Compose operations, immutability
 */
export function transformIssuesForDisplay(
  issues: readonly JiraIssueWithPoints[],
  sprint: JiraSprint,
  validationResults?: readonly AdvancedValidationResult[],
  baseUrl?: string
): readonly SprintIssueDisplay[] {
  const sortedIssues = sortIssuesByUpdated(issues);
  
  return sortedIssues.map((issue, index) => ({
    ...issue,
    jiraUrl: generateJiraIssueUrl(issue.key, baseUrl),
    statusColor: getStatusColor(issue.status.name),
    priorityColor: getPriorityColor(issue.priority.name),
    isClosedAfterSprintEnd: isIssueClosedAfterSprintEnd(issue, sprint),
    validationReason: validationResults?.[index]?.reason,
    doneTransitionDate: validationResults?.[index]?.doneTransitionDate
  }));
}

/**
 * Determines if an issue was closed after sprint end
 * Following Clean Code: Express intent, single responsibility
 */
function isIssueClosedAfterSprintEnd(issue: JiraIssueWithPoints, sprint: JiraSprint): boolean {
  // Issue must have a status category changed date
  if (!issue.statusCategoryChangedDate) {
    return false;
  }
  
  // Check if status changed date is after sprint end date
  const statusChangedDate = new Date(issue.statusCategoryChangedDate);
  const sprintEndDate = new Date(sprint.endDate);
  
  return statusChangedDate > sprintEndDate;
}

/**
 * Formats story points for display
 * Following Clean Code: Express intent, handle null values
 */
export function formatStoryPoints(points: number | null): string {
  if (points === null || points === undefined) {
    return '-';
  }
  
  return points.toString();
}

/**
 * Truncates summary text for display
 * Following Clean Code: Single responsibility, configurable
 */
export function truncateSummary(summary: string, maxLength: number = 60): string {
  if (summary.length <= maxLength) {
    return summary;
  }
  
  return summary.substring(0, maxLength - 3) + '...';
}

/**
 * Calculates sprint completion metrics for display
 * Following Clean Code: Pure function, express intent
 */
export async function calculateSprintMetrics(
  issues: readonly JiraIssueWithPoints[], 
  sprint: JiraSprint,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<{
  totalIssues: number;
  completedIssues: number;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
}> {
  const totalIssues = issues.length;
  
  // Use the new validation logic
  const validationResults = await validateIssuesForVelocity(
    issues, 
    sprint, 
    boardId, 
    mcpClient
  );
  
  const completedIssues = validationResults.filter(result => 
    result.isValidForVelocity
  ).length;
  
  const totalPoints = issues.reduce((sum, issue) => 
    sum + (issue.storyPoints || 0), 0
  );
  
  const completedPoints = calculateValidatedStoryPoints(issues, validationResults);
  
  const completionRate = totalPoints > 0 
    ? Math.round((completedPoints / totalPoints) * 100)
    : 0;
  
  return {
    totalIssues,
    completedIssues,
    totalPoints,
    completedPoints,
    completionRate
  };
} 