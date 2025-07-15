/**
 * Sprint issues utilities and data structures
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards.js';
import type { AdvancedValidationResult } from './advanced-validator.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { validateIssuesForVelocity, calculateValidatedStoryPoints } from './advanced-validator.js';
import { filterNonSubTasks } from './calculator.js';

/**
 * Sprint issue for modal display
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface SprintIssueDisplay extends JiraIssueWithPoints {
  readonly jiraUrl: string;
  readonly statusColor: string;
  readonly priorityColor: string;
  readonly shouldShowWarning: boolean;
  readonly warningReason?: string;
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
 * Determines if an issue with story points should show warning
 * SIMPLE LOGIC: Show warning ONLY if issue has story points AND is not valid for velocity
 * Following Clean Code: Express intent, single responsibility
 */
export function getIssueValidationStatus(
  issue: JiraIssueWithPoints,
  validationResult: AdvancedValidationResult | undefined,
  sprint: JiraSprint
): { shouldShowWarning: boolean; warningReason?: string } {
  // Step 1: Must have story points
  if (!issue.storyPoints || issue.storyPoints <= 0) {
    return { shouldShowWarning: false };
  }

  // Step 2: Must have validation result indicating NOT valid
  if (!validationResult || validationResult.isValidForVelocity === true) {
    return { shouldShowWarning: false };
  }

  // Step 3: Issue has story points but is NOT valid for velocity - show warning
  // Determine the specific reason based on validation data
  if (!validationResult.doneTransitionDate) {
    return {
      shouldShowWarning: true,
      warningReason: "Issue con story points mai spostata nella colonna Done"
    };
  }

  // Check if moved to Done after sprint end
  const transitionDate = new Date(validationResult.doneTransitionDate);
  const sprintEndDate = new Date(sprint.endDate);
  
  if (transitionDate > sprintEndDate) {
    return {
      shouldShowWarning: true,
      warningReason: "Issue completata dopo la fine dello sprint"
    };
  }

  // Issue has Done transition but still not valid (shouldn't happen normally)
  return {
    shouldShowWarning: true,
    warningReason: "Issue con story points non valida per la velocity"
  };
}

/**
 * Transforms issues for modal display
 * Following Clean Code: Compose operations, immutability
 * FIXED: Map validation results BEFORE sorting to maintain index alignment
 */
export function transformIssuesForDisplay(
  issues: readonly JiraIssueWithPoints[],
  sprint: JiraSprint,
  validationResults?: readonly AdvancedValidationResult[],
  baseUrl?: string
): readonly SprintIssueDisplay[] {
  // First, map issues with validation results (maintaining original order/indices)
  const issuesWithValidation = issues.map((issue, index) => {
    const validationResult = validationResults?.[index];
    const validationStatus = getIssueValidationStatus(issue, validationResult, sprint);
    

    
    return {
      ...issue,
      jiraUrl: generateJiraIssueUrl(issue.key, baseUrl),
      statusColor: getStatusColor(issue.status.name),
      priorityColor: getPriorityColor(issue.priority.name),
      shouldShowWarning: validationStatus.shouldShowWarning,
      warningReason: validationStatus.warningReason,
      doneTransitionDate: validationResult?.doneTransitionDate,
    };
  });
  
  // Then sort by updated date (most recent first)
  return issuesWithValidation.sort((a, b) => {
    const dateA = new Date(a.updated);
    const dateB = new Date(b.updated);
    return dateB.getTime() - dateA.getTime();
  });
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
  // Filter out sub-tasks for Scrum board velocity calculation
  // Following Clean Code: Express intent, separate concerns
  const nonSubTaskIssues = filterNonSubTasks(issues);
  
  const totalIssues = nonSubTaskIssues.length;
  
  // Use the new validation logic (exclude sub-tasks)
  const validationResults = await validateIssuesForVelocity(
    nonSubTaskIssues, 
    sprint, 
    boardId, 
    mcpClient
  );
  
  const completedIssues = validationResults.filter(result => 
    result.isValidForVelocity
  ).length;
  
  const totalPoints = nonSubTaskIssues.reduce((sum, issue) => 
    sum + (issue.storyPoints || 0), 0
  );
  
  const completedPoints = calculateValidatedStoryPoints(nonSubTaskIssues, validationResults);
  
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