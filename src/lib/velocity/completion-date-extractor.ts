/**
 * Completion date extraction utilities for velocity calculations
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards';
import type { McpAtlassianClient } from '../mcp/atlassian';
import { getDoneStatusIdsForBoard } from './board-cache';

/**
 * Issue with completion date extracted from changelog
 * Following Clean Code: Express intent, immutability
 */
export interface JiraIssueWithCompletion extends JiraIssueWithPoints {
  readonly completionDate: string | null; // When issue moved to last kanban column
}

/**
 * Extracts completion date for a single issue
 * Following Clean Code: Single responsibility, express intent
 */
export async function extractCompletionDate(
  issue: JiraIssueWithPoints,
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<string | null> {
  // Only extract for issues with story points
  if ((issue.storyPoints || 0) <= 0) {
    return null;
  }

  // Use pre-fetched Done status IDs - NO additional API CALL!
  if (doneStatusIds.length === 0) {
    return null;
  }

  // Get issue changelog and find transition date
  const changelogResponse = await mcpClient.getIssueChangelog(issue.key);
  
  if (!changelogResponse.success || !changelogResponse.data) {
    return null;
  }

  // Find transition date using business logic
  const changelog = changelogResponse.data;
  
  for (const statusId of doneStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      return changelog.statusTransitionIndex.get(statusId)!;
    }
  }

  return null;
}

/**
 * Extracts completion dates for multiple issues with board context
 * Following Clean Code: Batch operations, performance optimization
 */
export async function extractCompletionDatesForSprint(
  issues: readonly JiraIssueWithPoints[],
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<readonly JiraIssueWithCompletion[]> {
  console.log(`[CompletionExtractor] Extracting completion dates for ${issues.length} issues`);
  
  // SINGLE API CALL: Get Done status IDs once for ALL issues
  const doneStatusIds = await getDoneStatusIdsForBoard(boardId, mcpClient);
  
  console.log(`[CompletionExtractor] Using Done status IDs: [${doneStatusIds.join(', ')}]`);
  
  const results: JiraIssueWithCompletion[] = [];
  
  // Process issues sequentially with pre-fetched status IDs
  for (const issue of issues) {
    const completionDate = await extractCompletionDate(issue, doneStatusIds, mcpClient);
    
    results.push({
      ...issue,
      completionDate
    });
  }
  
  const completedIssues = results.filter(r => r.completionDate !== null).length;
  console.log(`[CompletionExtractor] Extracted completion dates: ${completedIssues}/${issues.length} issues completed`);
  
  return results;
}

/**
 * Validates if an issue should be counted for velocity using completion date
 * Following Clean Code: Express intent, single responsibility
 */
export function validateIssueWithCompletionDate(
  issue: JiraIssueWithCompletion,
  sprint: JiraSprint
): boolean {
  // Only count issues with story points
  if ((issue.storyPoints || 0) <= 0) {
    return false;
  }

  // Must have completion date
  if (!issue.completionDate) {
    return false;
  }

  // Check if completion happened before or at sprint end
  const completionDateTime = new Date(issue.completionDate);
  const sprintEndDateTime = new Date(sprint.endDate);
  
  return completionDateTime <= sprintEndDateTime;
}

/**
 * Validates multiple issues using completion dates (NO API CALLS)
 * Following Clean Code: Batch operations, performance optimization
 */
export function validateIssuesWithCompletionDates(
  issues: readonly JiraIssueWithCompletion[],
  sprint: JiraSprint
): readonly boolean[] {
  console.log(`[CompletionValidator] Validating ${issues.length} issues using completion dates (NO API CALLS)`);
  
  const results = issues.map(issue => validateIssueWithCompletionDate(issue, sprint));
  
  const validIssues = results.filter(r => r).length;
  console.log(`[CompletionValidator] Validated ${issues.length} issues: ${validIssues} valid, ${issues.length - validIssues} invalid`);
  
  return results;
}

/**
 * Calculates validated story points using completion dates
 * Following Clean Code: Express intent, single responsibility
 */
export function calculateValidatedStoryPointsWithCompletion(
  issues: readonly JiraIssueWithCompletion[],
  validationResults: readonly boolean[]
): number {
  let totalPoints = 0;
  
  for (let i = 0; i < issues.length; i++) {
    if (validationResults[i] && issues[i].storyPoints) {
      totalPoints += issues[i].storyPoints!;
    }
  }
  
  return totalPoints;
}
