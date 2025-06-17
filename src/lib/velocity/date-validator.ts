/**
 * Date validation utilities for velocity calculations
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards';
import type { McpAtlassianClient } from '../mcp/atlassian';
import { getDoneStatusIdsForBoard, clearBoardDoneStatusCache } from './board-cache';

/**
 * Verifies if an issue was completed within sprint timeframe
 * Done status IDs are passed as parameter to avoid repeated API calls
 * Following Clean Code: Express intent, single responsibility, dependency injection
 */
export async function isIssueCompletedWithinSprint(
  issue: JiraIssueWithPoints, 
  sprint: JiraSprint,
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<boolean> {
  // Use pre-fetched Done status IDs - NO API CALL!
  if (doneStatusIds.length === 0) {
    return false;
  }

  // Check if issue was in Done column at sprint end using status IDs
  const changelogApi = mcpClient.getChangelogApi();
  return await changelogApi.wasIssueInDoneAtDateById(
    issue.key,
    doneStatusIds,
    sprint.endDate
  );
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use the new signature with doneStatusIds parameter
 */
export async function isIssueCompletedWithinSprintLegacy(
  issue: JiraIssueWithPoints, 
  sprint: JiraSprint,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<boolean> {
  // Fetch Done status IDs for backward compatibility
  const doneStatusIds = await getDoneStatusIdsForBoard(boardId, mcpClient);
  return isIssueCompletedWithinSprint(issue, sprint, doneStatusIds, mcpClient);
}

// Re-export cache management for backward compatibility
export { clearBoardDoneStatusCache }; 