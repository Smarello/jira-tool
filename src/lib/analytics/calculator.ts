/**
 * Analytics calculator for dashboard metrics
 * Following Clean Code: Pure functions, Single Responsibility
 */

import type { 
  JiraIssue, 
  DashboardMetrics, 
  PriorityCount, 
  TypeCount 
} from '../jira/types.js';

/**
 * Calculates comprehensive dashboard metrics from issues
 * Pure function: no side effects, predictable output
 */
export function calculateDashboardMetrics(
  issues: readonly JiraIssue[]
): DashboardMetrics {
  const totalIssues = issues.length;
  
  return {
    totalIssues,
    openIssues: countIssuesByStatus(issues, 'To Do'),
    inProgressIssues: countIssuesByStatus(issues, 'In Progress'),
    resolvedIssues: countIssuesByStatus(issues, 'Done'),
    averageResolutionDays: calculateAverageResolutionDays(issues),
    issuesByPriority: groupIssuesByPriority(issues),
    issuesByType: groupIssuesByType(issues)
  };
}

/**
 * Counts issues by status category
 * Single responsibility: only status counting
 */
function countIssuesByStatus(
  issues: readonly JiraIssue[], 
  statusCategory: string
): number {
  return issues.filter(issue => 
    issue.status.statusCategory.name === statusCategory
  ).length;
}

/**
 * Calculates average resolution time in days
 * Returns 0 for no resolved issues (avoiding division by zero)
 */
function calculateAverageResolutionDays(
  issues: readonly JiraIssue[]
): number {
  const resolvedIssues = issues.filter(issue => issue.resolved !== null);
  
  if (resolvedIssues.length === 0) {
    return 0;
  }

  const totalDays = resolvedIssues.reduce((sum, issue) => {
    const created = new Date(issue.created);
    const resolved = new Date(issue.resolved!);
    const diffDays = Math.ceil(
      (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
    return sum + diffDays;
  }, 0);

  return Math.round(totalDays / resolvedIssues.length);
}

/**
 * Groups issues by priority and counts them
 * Returns read-only array following immutability
 */
function groupIssuesByPriority(
  issues: readonly JiraIssue[]
): readonly PriorityCount[] {
  const priorityCounts = new Map<string, number>();

  issues.forEach(issue => {
    const priority = issue.priority.name;
    priorityCounts.set(priority, (priorityCounts.get(priority) || 0) + 1);
  });

  return Array.from(priorityCounts.entries())
    .map(([priority, count]) => ({ priority, count }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

/**
 * Groups issues by type and counts them
 * Returns read-only array following immutability
 */
function groupIssuesByType(
  issues: readonly JiraIssue[]
): readonly TypeCount[] {
  const typeCounts = new Map<string, number>();

  issues.forEach(issue => {
    const type = issue.issueType.name;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

/**
 * Calculates percentage with safe division
 * Utility function: small, focused responsibility
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}
