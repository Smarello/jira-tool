/**
 * Kanban Cycle Time Calculator
 * Calculates cycle time from first To Do status to first Done status
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssue, CycleTime } from '../jira/types';
import type { McpAtlassianClient } from '../mcp/atlassian';

/**
 * Result of cycle time calculation for a single issue
 * Database-ready structure with all necessary metadata
 * Following Clean Code: Express intent, immutability
 */
export interface IssueCycleTimeResult {
  readonly issueKey: string;
  readonly boardId: string;
  readonly cycleTime: CycleTime | null; // null if issue not completed
  readonly calculatedAt: string; // ISO timestamp
}

/**
 * Calculates cycle time for a single issue
 * Returns null cycle time if issue hasn't reached Done status
 * Following Clean Code: Single responsibility, dependency injection
 */
export async function calculateIssueCycleTime(
  issue: JiraIssue,
  boardId: string,
  toDoStatusIds: readonly string[],
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<IssueCycleTimeResult> {
  const calculatedAt = new Date().toISOString();
  
  // Get issue changelog
  const changelogResponse = await mcpClient.getIssueChangelog(issue.key);
  
  if (!changelogResponse.success || !changelogResponse.data) {
    console.warn(`[CycleTimeCalculator] Failed to get changelog for issue ${issue.key}`);
    return {
      issueKey: issue.key,
      boardId,
      cycleTime: null,
      calculatedAt
    };
  }

  const changelog = changelogResponse.data;
  
  // Find first transition to To Do status
  let toDoTransitionDate: string | null = null;
  for (const statusId of toDoStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      const candidateDate = changelog.statusTransitionIndex.get(statusId)!;
      if (!toDoTransitionDate || candidateDate < toDoTransitionDate) {
        toDoTransitionDate = candidateDate;
      }
    }
  }
  
  // Find first transition to Done status
  let doneTransitionDate: string | null = null;
  for (const statusId of doneStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      const candidateDate = changelog.statusTransitionIndex.get(statusId)!;
      if (!doneTransitionDate || candidateDate < doneTransitionDate) {
        doneTransitionDate = candidateDate;
      }
    }
  }

  // Issue not completed yet - return null cycle time
  if (!doneTransitionDate) {
    return {
      issueKey: issue.key,
      boardId,
      cycleTime: null,
      calculatedAt
    };
  }

  // Determine start date: use To Do transition or fall back to creation date
  const startDate = toDoTransitionDate || issue.created;
  const calculationMethod: 'board_entry' | 'creation_date' = toDoTransitionDate ? 'board_entry' : 'creation_date';
  const isEstimated = !toDoTransitionDate;

  // Calculate duration
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(doneTransitionDate);
  const durationMs = endDateTime.getTime() - startDateTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;

  const cycleTime: CycleTime = {
    startDate,
    endDate: doneTransitionDate,
    durationDays,
    durationHours,
    isEstimated,
    calculationMethod
  };

  console.log(`[CycleTimeCalculator] Issue ${issue.key}: ${durationHours.toFixed(1)}h (${calculationMethod})`);

  return {
    issueKey: issue.key,
    boardId,
    cycleTime,
    calculatedAt
  };
}

/**
 * Calculates cycle time for multiple issues with optimized API calls
 * Fetches board configuration ONCE for all issues - MASSIVE OPTIMIZATION!
 * Following Clean Code: Compose operations, performance optimization
 */
export async function calculateIssuesCycleTime(
  issues: readonly JiraIssue[],
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<readonly IssueCycleTimeResult[]> {
  console.log(`[CycleTimeCalculator] Starting cycle time calculation for ${issues.length} issues on board ${boardId}`);

  // OPTIMIZATION: Fetch board status IDs once for all issues
  const [toDoStatusResponse, doneStatusResponse] = await Promise.all([
    mcpClient.getBoardToDoStatusIds(boardId),
    mcpClient.getBoardDoneStatusIds(boardId)
  ]);

  if (!toDoStatusResponse.success || !doneStatusResponse.success) {
    console.error('[CycleTimeCalculator] Failed to fetch board status configuration');
    return issues.map(issue => ({
      issueKey: issue.key,
      boardId,
      cycleTime: null,
      calculatedAt: new Date().toISOString()
    }));
  }

  const toDoStatusIds = toDoStatusResponse.data;
  const doneStatusIds = doneStatusResponse.data;

  console.log(`[CycleTimeCalculator] Board ${boardId} config: To Do statuses [${toDoStatusIds.join(', ')}], Done statuses [${doneStatusIds.join(', ')}]`);

  // Process issues sequentially with pre-fetched status IDs
  const results: IssueCycleTimeResult[] = [];
  
  for (const issue of issues) {
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);
    results.push(result);
  }

  const completedCount = results.filter(r => r.cycleTime !== null).length;
  console.log(`[CycleTimeCalculator] Completed cycle time calculation: ${completedCount}/${issues.length} issues have cycle time data`);

  return results;
}

/**
 * Legacy wrapper for single issue calculation with board status fetching
 * @deprecated Use the optimized version with pre-fetched status IDs for batch processing
 * Following Clean Code: Backward compatibility
 */
export async function calculateIssueCycleTimeLegacy(
  issue: JiraIssue,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<IssueCycleTimeResult> {
  // Fetch board status IDs for single issue (less efficient)
  const [toDoStatusResponse, doneStatusResponse] = await Promise.all([
    mcpClient.getBoardToDoStatusIds(boardId),
    mcpClient.getBoardDoneStatusIds(boardId)
  ]);

  if (!toDoStatusResponse.success || !doneStatusResponse.success) {
    console.error('[CycleTimeCalculator] Failed to fetch board status configuration for single issue');
    return {
      issueKey: issue.key,
      boardId,
      cycleTime: null,
      calculatedAt: new Date().toISOString()
    };
  }

  return calculateIssueCycleTime(issue, boardId, toDoStatusResponse.data, doneStatusResponse.data, mcpClient);
}

/**
 * Filters issues that have completed cycle time (reached Done status)
 * Following Clean Code: Express intent, immutability
 */
export function filterCompletedIssues(
  results: readonly IssueCycleTimeResult[]
): readonly IssueCycleTimeResult[] {
  return results.filter(result => result.cycleTime !== null);
}

/**
 * Extracts cycle times from results for statistical analysis
 * Following Clean Code: Single responsibility, pure function
 */
export function extractCycleTimes(
  results: readonly IssueCycleTimeResult[]
): readonly number[] {
  return results
    .filter(result => result.cycleTime !== null)
    .map(result => result.cycleTime!.durationHours);
}
