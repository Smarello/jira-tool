/**
 * Advanced velocity validation with Kanban board column checking
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards';
import type { McpAtlassianClient } from '../mcp/atlassian';
import { getDoneStatusIdsForBoard, clearBoardDoneStatusCache } from './board-cache';

/**
 * Advanced issue validation result
 * Following Clean Code: Express intent, immutability
 */
export interface AdvancedValidationResult {
  readonly isValidForVelocity: boolean;
  readonly reason: 'done_at_sprint_end' | 'not_valid';
  readonly doneTransitionDate?: string;
}

/**
 * Validates if an issue should be counted in velocity calculation
 * Done status IDs are passed as parameter to avoid repeated API calls
 * Following Clean Code: Express intent, single responsibility, dependency injection
 */
export async function validateIssueForVelocity(
  issue: JiraIssueWithPoints,
  sprint: JiraSprint,
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<AdvancedValidationResult> {
  // Only check issues with story points
  if ((issue.storyPoints || 0) <= 0) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Use pre-fetched Done status IDs - NO API CALL!
  if (doneStatusIds.length === 0) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Get changelog and check transition date in one operation
  const changelogApi = mcpClient.getChangelogApi();
  const doneTransitionDate = await changelogApi.findDoneColumnTransitionDateById(
    issue.key,
    doneStatusIds
  );

  if (!doneTransitionDate) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Check if transition happened before or at sprint end
  const transitionDateTime = new Date(doneTransitionDate);
  const sprintEndDateTime = new Date(sprint.endDate);
  const wasInDoneAtSprintEnd = transitionDateTime <= sprintEndDateTime;

  return {
    isValidForVelocity: wasInDoneAtSprintEnd,
    reason: wasInDoneAtSprintEnd ? 'done_at_sprint_end' : 'not_valid',
    doneTransitionDate
  };
}

/**
 * Validates multiple issues for velocity calculation
 * Fetches board configuration ONCE for all issues - MASSIVE OPTIMIZATION!
 * Following Clean Code: Compose operations, immutability, performance optimization
 */
export async function validateIssuesForVelocity(
  issues: readonly JiraIssueWithPoints[],
  sprint: JiraSprint,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<readonly AdvancedValidationResult[]> {
  // SINGLE API CALL: Get Done status IDs once for ALL issues
  const doneStatusIds = await getDoneStatusIdsForBoard(boardId, mcpClient);
  
  console.log(`[AdvancedValidator] Processing ${issues.length} issues with pre-fetched Done status IDs: [${doneStatusIds.join(', ')}]`);
  
  const results: AdvancedValidationResult[] = [];
  
  // Clear changelog cache at the start of validation
  // const changelogApi = mcpClient.getChangelogApi();
  //changelogApi.clearCache();
  
  // Process issues sequentially with pre-fetched status IDs - NO MORE API CALLS!
  for (const issue of issues) {
    const result = await validateIssueForVelocity(issue, sprint, doneStatusIds, mcpClient);
    results.push(result);
  }
  
  console.log(`[AdvancedValidator] Completed validation for ${issues.length} issues with 1 board API call (instead of ${issues.length})`);
  
  return results;
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use the new signature with doneStatusIds parameter
 */
export async function validateIssueForVelocityLegacy(
  issue: JiraIssueWithPoints,
  sprint: JiraSprint,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<AdvancedValidationResult> {
  // Fetch Done status IDs for backward compatibility
  const doneStatusIds = await getDoneStatusIdsForBoard(boardId, mcpClient);
  return validateIssueForVelocity(issue, sprint, doneStatusIds, mcpClient);
}

/**
 * Filters issues that are valid for velocity calculation
 * Following Clean Code: Express intent, immutability
 */
export function filterValidIssuesForVelocity(
  issues: readonly JiraIssueWithPoints[],
  validationResults: readonly AdvancedValidationResult[]
): readonly JiraIssueWithPoints[] {
  return issues.filter((_, index) => 
    validationResults[index]?.isValidForVelocity === true
  );
}

/**
 * Calculates story points from validated issues
 * Following Clean Code: Single responsibility, pure function
 */
export function calculateValidatedStoryPoints(
  issues: readonly JiraIssueWithPoints[],
  validationResults: readonly AdvancedValidationResult[]
): number {
  const validIssues = filterValidIssuesForVelocity(issues, validationResults);
  return validIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
}

// Re-export cache management for backward compatibility
export { clearBoardDoneStatusCache }; 