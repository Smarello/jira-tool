/**
 * Kanban Cycle Time Calculator
 * Calculates cycle time from first To Do status to first Done status
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssue, CycleTime } from '../jira/types';
import { PercentileCalculationError } from '../jira/types';
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
 * Result of calculating key dates for an issue
 * Contains the dates needed for filtering and cycle time calculation
 * Following Clean Code: Express intent, single responsibility
 */
export interface IssueKeyDates {
  readonly issueKey: string;
  readonly boardEntryDate: string | null; // First transition to To Do status
  readonly lastDoneDate: string | null;   // First transition to Done status
  readonly calculatedAt: string; // ISO timestamp
}

/**
 * Calculates key dates (board entry and last done) for a single issue
 * Single changelog pass for optimal performance
 * Following Clean Code: Single responsibility, dependency injection
 */
export async function calculateIssueKeyDates(
  issue: JiraIssue,
  toDoStatusIds: readonly string[],
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<IssueKeyDates> {
  const calculatedAt = new Date().toISOString();
  
  // Get issue changelog
  const changelogResponse = await mcpClient.getIssueChangelog(issue.key);
  
  if (!changelogResponse.success || !changelogResponse.data) {
    console.warn(`[CycleTimeCalculator] Failed to get changelog for issue ${issue.key}`);
    return {
      issueKey: issue.key,
      boardEntryDate: null,
      lastDoneDate: null,
      calculatedAt
    };
  }

  const changelog = changelogResponse.data;
  
  // Find first transition to To Do status (board entry)
  let boardEntryDate: string | null = null;
  for (const statusId of toDoStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      const candidateDate = changelog.statusTransitionIndex.get(statusId)!;
      if (!boardEntryDate || candidateDate < boardEntryDate) {
        boardEntryDate = candidateDate;
      }
    }
  }
  
  // Find first transition to Done status
  let lastDoneDate: string | null = null;
  for (const statusId of doneStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      const candidateDate = changelog.statusTransitionIndex.get(statusId)!;
      if (!lastDoneDate || candidateDate < lastDoneDate) {
        lastDoneDate = candidateDate;
      }
    }
  }

  return {
    issueKey: issue.key,
    boardEntryDate,
    lastDoneDate,
    calculatedAt
  };
}

/**
 * Calculates key dates for multiple issues with optimized changelog fetching
 * Following Clean Code: Single responsibility, batch processing
 */
export async function calculateIssuesKeyDates(
  issues: readonly JiraIssue[],
  toDoStatusIds: readonly string[],
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<readonly IssueKeyDates[]> {
  console.log(`[CycleTimeCalculator] Calculating key dates for ${issues.length} issues`);
  
  const results: IssueKeyDates[] = [];
  
  for (const issue of issues) {
    try {
      const keyDates = await calculateIssueKeyDates(issue, toDoStatusIds, doneStatusIds, mcpClient);
      results.push(keyDates);
    } catch (error) {
      console.error(`[CycleTimeCalculator] Error calculating key dates for issue ${issue.key}:`, error);
      // Add empty result to maintain array consistency
      results.push({
        issueKey: issue.key,
        boardEntryDate: null,
        lastDoneDate: null,
        calculatedAt: new Date().toISOString()
      });
    }
  }
  
  console.log(`[CycleTimeCalculator] Calculated key dates for ${results.length} issues`);
  return results;
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
 * Calculates cycle time for a single issue using pre-calculated key dates
 * Optimized version that avoids duplicate changelog fetching
 * Following Clean Code: Single responsibility, performance optimization
 */
export function calculateIssueCycleTimeFromDates(
  issue: JiraIssue,
  boardId: string,
  keyDates: IssueKeyDates
): IssueCycleTimeResult {
  const calculatedAt = new Date().toISOString();
  
  // Issue not completed yet - return null cycle time
  if (!keyDates.lastDoneDate) {
    return {
      issueKey: issue.key,
      boardId,
      cycleTime: null,
      calculatedAt
    };
  }

  // Determine start date: use board entry date or fall back to creation date
  const startDate = keyDates.boardEntryDate || issue.created;
  const calculationMethod: 'board_entry' | 'creation_date' = keyDates.boardEntryDate ? 'board_entry' : 'creation_date';
  const isEstimated = !keyDates.boardEntryDate;

  // Calculate duration
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(keyDates.lastDoneDate);
  const durationMs = endDateTime.getTime() - startDateTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;

  const cycleTime: CycleTime = {
    startDate,
    endDate: keyDates.lastDoneDate,
    durationDays,
    durationHours,
    isEstimated,
    calculationMethod
  };

  console.log(`[CycleTimeCalculator] Issue ${issue.key}: ${durationHours.toFixed(1)}h (${calculationMethod}, from pre-calculated dates)`);

  return {
    issueKey: issue.key,
    boardId,
    cycleTime,
    calculatedAt
  };
}

/**
 * Calculates cycle time for multiple issues with pre-fetched status configuration
 * No longer fetches board configuration - expects it to be provided from outside
 * Following Clean Code: Dependency injection, single responsibility
 */
export async function calculateIssuesCycleTime(
  issues: readonly JiraIssue[],
  boardId: string,
  toDoStatusIds: readonly string[],
  doneStatusIds: readonly string[],
  mcpClient: McpAtlassianClient
): Promise<readonly IssueCycleTimeResult[]> {
  console.log(`[CycleTimeCalculator] Starting cycle time calculation for ${issues.length} issues on board ${boardId}`);
  console.log(`[CycleTimeCalculator] Using status config: To Do [${toDoStatusIds.join(', ')}], Done [${doneStatusIds.join(', ')}]`);

  // Process issues sequentially with provided status IDs
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
 * Filters issues that are completed (in Done status or doneStatusIds)
 * Following Clean Code: Express intent, immutability
 */
export function filterCompletedIssues(
  issues: readonly JiraIssue[],
  doneStatusIds: readonly string[]
): readonly JiraIssue[] {
  return issues.filter(issue => {
    // Check if issue status ID is in doneStatusIds
    if (doneStatusIds.includes(issue.status.id)) {
      return true;
    }
    
    // Check if issue status category is "Done"
    return issue.status.statusCategory.name === 'Done';
  });
}

/**
 * Filters cycle time results that have completed cycle time (reached Done status)
 * Following Clean Code: Express intent, immutability
 */
export function filterCompletedCycleTimeResults(
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

/**
 * Calculates a specific percentile for cycle times
 * Uses linear interpolation for accurate percentile calculation
 * Following Clean Code: Single responsibility, express intent
 * 
 * @param cycleTimes Array of cycle times in hours
 * @param percentile Target percentile (0-100)
 * @returns Cycle time value at the specified percentile
 * @throws PercentileCalculationError for invalid inputs
 */
export function calculateCycleTimePercentile(
  cycleTimes: readonly number[],
  percentile: number
): number {
  // Validation
  if (percentile < 0 || percentile > 100) {
    throw new PercentileCalculationError(
      `Invalid percentile: ${percentile}. Must be between 0 and 100.`,
      'INVALID_PERCENTILE',
      { percentile }
    );
  }

  if (cycleTimes.length === 0) {
    throw new PercentileCalculationError(
      'Cannot calculate percentile for empty cycle times array',
      'EMPTY_DATASET',
      { sampleSize: 0 }
    );
  }

  // Sort cycle times for percentile calculation
  const sortedTimes = [...cycleTimes].sort((a, b) => a - b);
  
  // Handle edge cases
  if (percentile === 0) return sortedTimes[0];
  if (percentile === 100) return sortedTimes[sortedTimes.length - 1];

  // Calculate percentile using linear interpolation
  const index = (percentile / 100) * (sortedTimes.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  // If exact index, return that value
  if (lowerIndex === upperIndex) {
    return sortedTimes[lowerIndex];
  }

  // Linear interpolation between two values
  const lowerValue = sortedTimes[lowerIndex];
  const upperValue = sortedTimes[upperIndex];
  const fraction = index - lowerIndex;
  
  const result = lowerValue + (upperValue - lowerValue) * fraction;
  
  console.log(`[CycleTimeCalculator] P${percentile}: ${result.toFixed(1)}h (sample size: ${cycleTimes.length})`);
  
  return result;
}

/**
 * Calculates multiple percentiles in a single operation
 * More efficient than calling calculateCycleTimePercentile multiple times
 * Following Clean Code: Performance optimization, compose operations, DRY principle
 * 
 * @param cycleTimes Array of cycle times in hours
 * @param percentiles Array of target percentiles (0-100)
 * @returns Record mapping percentile to cycle time value
 * @throws PercentileCalculationError for invalid inputs
 */
export function calculateMultiplePercentiles(
  cycleTimes: readonly number[],
  percentiles: readonly number[]
): Record<number, number> {
  if (cycleTimes.length === 0) {
    throw new PercentileCalculationError(
      'Cannot calculate percentiles for empty cycle times array',
      'EMPTY_DATASET',
      { sampleSize: 0 }
    );
  }

  // Validate all percentiles first
  for (const p of percentiles) {
    if (p < 0 || p > 100) {
      throw new PercentileCalculationError(
        `Invalid percentile: ${p}. All percentiles must be between 0 and 100.`,
        'INVALID_PERCENTILE',
        { percentile: p, allPercentiles: percentiles }
      );
    }
  }

  // Use the single percentile function for each calculation
  // This ensures consistency and follows DRY principle
  const result: Record<number, number> = {};
  
  for (const percentile of percentiles) {
    result[percentile] = calculateCycleTimePercentile(cycleTimes, percentile);
  }

  console.log(`[CycleTimeCalculator] Calculated ${percentiles.length} percentiles for ${cycleTimes.length} cycle times`);
  
  return result;
}
