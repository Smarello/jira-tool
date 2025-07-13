/**
 * Kanban Analytics Service
 * Calculates cycle time percentiles for Kanban boards
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { KanbanAnalyticsResult, CycleTimePercentiles } from '../jira/types';
import type { McpAtlassianClient } from '../mcp/atlassian';
import { 
  calculateIssuesCycleTime, 
  filterCompletedIssues, 
  extractCycleTimes, 
  calculateMultiplePercentiles 
} from '../kanban/cycle-time-calculator';

/**
 * Calculates Kanban analytics for a specific board
 * Returns cycle time percentiles for completed issues
 * Following Clean Code: Pure business logic, clear dependencies
 */
export async function calculateKanbanAnalytics(
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<KanbanAnalyticsResult> {
  console.log(`[KanbanAnalyticsService] Starting analytics calculation for board ${boardId}`);
  
  const calculatedAt = new Date().toISOString();
  
  try {
    // Fetch board issues
    const boardIssuesResponse = await mcpClient.getBoardIssues(boardId);
    
    if (!boardIssuesResponse.success || !boardIssuesResponse.data) {
      console.error(`[KanbanAnalyticsService] Failed to fetch issues for board ${boardId}`);
      return createEmptyAnalyticsResult(boardId, calculatedAt);
    }

    const allIssues = boardIssuesResponse.data;
    console.log(`[KanbanAnalyticsService] Fetched ${allIssues.length} issues for board ${boardId}`);

    // Calculate cycle times for all issues
    const cycleTimeResults = await calculateIssuesCycleTime(allIssues, boardId, mcpClient);
    
    // Filter completed issues and extract cycle times
    const completedResults = filterCompletedIssues(cycleTimeResults);
    const cycleTimes = extractCycleTimes(completedResults);

    console.log(`[KanbanAnalyticsService] Found ${completedResults.length} completed issues out of ${allIssues.length} total`);

    // Calculate percentiles if we have completed issues
    let percentiles: CycleTimePercentiles;
    
    if (cycleTimes.length === 0) {
      percentiles = createEmptyPercentiles();
    } else {
      const percentileValues = calculateMultiplePercentiles(cycleTimes, [50, 75, 85, 95]);
      percentiles = {
        p50: percentileValues[50],
        p75: percentileValues[75],
        p85: percentileValues[85],
        p95: percentileValues[95],
        sampleSize: cycleTimes.length
      };
    }

    const result: KanbanAnalyticsResult = {
      boardId,
      totalIssues: allIssues.length,
      completedIssues: completedResults.length,
      cycleTimePercentiles: percentiles,
      calculatedAt
    };

    console.log(`[KanbanAnalyticsService] Analytics calculation completed for board ${boardId}:`);
    console.log(`  - Total issues: ${result.totalIssues}`);
    console.log(`  - Completed issues: ${result.completedIssues}`);
    console.log(`  - P50: ${percentiles.p50.toFixed(1)}h`);
    console.log(`  - P95: ${percentiles.p95.toFixed(1)}h`);

    return result;

  } catch (error) {
    console.error(`[KanbanAnalyticsService] Error calculating analytics for board ${boardId}:`, error);
    return createEmptyAnalyticsResult(boardId, calculatedAt);
  }
}

/**
 * Creates empty analytics result for error cases
 * Following Clean Code: Express intent, consistent error handling
 */
function createEmptyAnalyticsResult(boardId: string, calculatedAt: string): KanbanAnalyticsResult {
  return {
    boardId,
    totalIssues: 0,
    completedIssues: 0,
    cycleTimePercentiles: createEmptyPercentiles(),
    calculatedAt
  };
}

/**
 * Creates empty percentiles structure
 * Following Clean Code: Single responsibility, immutable data
 */
function createEmptyPercentiles(): CycleTimePercentiles {
  return {
    p50: 0,
    p75: 0,
    p85: 0,
    p95: 0,
    sampleSize: 0
  };
}
