/**
 * Kanban Analytics Service
 * Calculates cycle time percentiles and probability distributions for Kanban boards
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { KanbanAnalyticsResult, CycleTimePercentiles, CycleTimeProbabilityDistribution, TimePeriodFilter, IssueDetail } from '../jira/types';
import { TimePeriod } from '../jira/types';
import type { McpAtlassianClient } from '../mcp/atlassian';
import type { JiraIssue } from '../jira/types';
import { createJiraConfig } from '../jira/config.js';
import { getBoardStatusConfiguration } from '../jira/board-config.js';
import { 
  calculateIssuesCycleTime, 
  filterCompletedIssues,
  filterCompletedCycleTimeResults,
  extractCycleTimes, 
  calculateMultiplePercentiles,
  type IssueCycleTimeResult
} from '../kanban/cycle-time-calculator';

/**
 * Calculates Kanban analytics for a specific board
 * Returns cycle time percentiles for completed issues
 * Following Clean Code: Pure business logic, clear dependencies
 */
export async function calculateKanbanAnalytics(
  boardId: string,
  mcpClient: McpAtlassianClient,
  timePeriodFilter?: TimePeriodFilter,
  issueTypesFilter?: string[]
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

    // Apply time period filter if specified
    let filteredIssues = timePeriodFilter ? filterIssuesByTimePeriod(allIssues, timePeriodFilter) : allIssues;
    console.log(`[KanbanAnalyticsService] After time period filter: ${filteredIssues.length} issues`);

    // Apply issue types filter if specified
    if (issueTypesFilter && issueTypesFilter.length > 0) {
      filteredIssues = filterIssuesByType(filteredIssues, issueTypesFilter);
      console.log(`[KanbanAnalyticsService] After issue types filter [${issueTypesFilter.join(', ')}]: ${filteredIssues.length} issues`);
    }

    // Get board status configuration for cycle time calculation
    const boardConfig = await getBoardStatusConfiguration(boardId, mcpClient);
    
    if (!boardConfig) {
      console.error(`[KanbanAnalyticsService] Failed to fetch board status configuration for board ${boardId}`);
      return createEmptyAnalyticsResult(boardId, calculatedAt);
    }

    // First, filter completed issues (those in Done status)
    const completedIssues = filterCompletedIssues(filteredIssues, boardConfig.doneStatusIds);
    console.log(`[KanbanAnalyticsService] Found ${completedIssues.length} completed issues out of ${filteredIssues.length} filtered`);

    // Calculate cycle times only for completed issues
    const cycleTimeResults = await calculateIssuesCycleTime(
      completedIssues, 
      boardId, 
      boardConfig.toDoStatusIds, 
      boardConfig.doneStatusIds, 
      mcpClient
    );
    
    // Filter results with valid cycle times and extract cycle times
    const completedResults = filterCompletedCycleTimeResults(cycleTimeResults);
    const cycleTimes = extractCycleTimes(completedResults);

    console.log(`[KanbanAnalyticsService] Found ${completedResults.length} issues with valid cycle times out of ${completedIssues.length} completed issues`);

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

    // Create issue details for the analytics result
    const issuesDetails = createIssueDetails(completedResults, completedIssues);

    const result: KanbanAnalyticsResult = {
      boardId,
      totalIssues: allIssues.length,
      completedIssues: completedIssues.length,
      cycleTimePercentiles: percentiles,
      cycleTimeProbability: calculateProbabilityDistribution(cycleTimes),
      issuesDetails,
      calculatedAt
    };

    console.log(`[KanbanAnalyticsService] Analytics calculation completed for board ${boardId}:`);
    console.log(`  - Total issues: ${result.totalIssues}`);
    console.log(`  - Completed issues: ${result.completedIssues}`);
    console.log(`  - Issues with valid cycle times: ${completedResults.length}`);
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
    issuesDetails: [],
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

/**
 * Calculates probability distribution for cycle times
 * Following Clean Code: Pure function, single responsibility
 */
function calculateProbabilityDistribution(cycleTimes: readonly number[]): CycleTimeProbabilityDistribution | undefined {
  if (cycleTimes.length === 0) {
    return undefined;
  }

  // Convert hours to days and sort
  const cycleTimeDays = cycleTimes.map(hours => hours / 24).sort((a, b) => a - b);
  
  // Determine dynamic day ranges based on data distribution
  const maxDays = Math.ceil(Math.max(...cycleTimeDays));
  const dayRanges = generateDayRanges(maxDays);
  
  // Calculate distribution for each range
  const rangeData = dayRanges.map((range, index) => {
    const issuesInRange = cycleTimeDays.filter(days => 
      days >= range.min && days < range.max
    ).length;
    
    const probability = Math.round((issuesInRange / cycleTimes.length) * 100);
    
    return {
      range: `${range.min}-${range.max}`,
      probability,
      count: issuesInRange,
      minDays: range.min,
      maxDays: range.max,
      confidence: 0, // Will be calculated in next step
      isRecommended: false // Will be determined based on probability
    };
  });
  
  // Validate no overlapping ranges and correct total count
  const totalCountInRanges = rangeData.reduce((sum, range) => sum + range.count, 0);
  if (totalCountInRanges !== cycleTimes.length) {
    console.warn(`[KanbanAnalyticsService] Range count mismatch: ${totalCountInRanges} in ranges vs ${cycleTimes.length} total issues`);
    console.warn(`[KanbanAnalyticsService] Ranges:`, dayRanges.map(r => `${r.min}-${r.max}`));
    
    // Log individual issue distributions for debugging
    rangeData.forEach(range => {
      if (range.count > 0) {
        console.warn(`  Range ${range.range}: ${range.count} issues`);
      }
    });
  }
  
  // Calculate cumulative confidence levels
  let cumulativeCount = 0;
  rangeData.forEach(range => {
    cumulativeCount += range.count;
    range.confidence = Math.round((cumulativeCount / cycleTimes.length) * 100);
  });
  
  // Identify recommended ranges (sweet spots)
  // Ranges with highest probability and reasonable confidence (35-85%)
  const sortedByProbability = [...rangeData].sort((a, b) => b.probability - a.probability);
  const topRanges = sortedByProbability.slice(0, 2); // Top 2 most probable ranges
  
  rangeData.forEach(range => {
    range.isRecommended = topRanges.includes(range) && 
                         range.confidence >= 35 && 
                         range.confidence <= 85 &&
                         range.probability >= 5; // At least 5% probability
  });
  
  // Generate recommendations
  const recommendations = generateRecommendations(rangeData, cycleTimeDays);
  
  return {
    dayRanges: rangeData,
    recommendations
  };
}

/**
 * Generates dynamic day ranges based on data distribution
 * Following Clean Code: Pure function, clear algorithm
 * Fixed: Ensures non-overlapping ranges to avoid double counting
 */
function generateDayRanges(maxDays: number): Array<{ min: number; max: number }> {
  const ranges: Array<{ min: number; max: number }> = [];
  
  let currentMin = 0;
  // Start with smaller ranges for the first 15 days (more granular)
  while (currentMin < Math.min(maxDays, 10)) {
    const rangeSize = 3;
    const currentMax = currentMin + rangeSize;
    
    ranges.push({ 
      min: currentMin, 
      max: Math.min(currentMax, maxDays + 1) 
    });
    
    currentMin = currentMax; // No overlap: next range starts where previous ends
  }
  
  // Add broader ranges for higher values if needed
  while (currentMin < maxDays) {
    const rangeSize = currentMin < 30 ? 5 : 10; // 5-day ranges up to 30, then 10-day ranges
    const currentMax = currentMin + rangeSize;
    
    ranges.push({ 
      min: currentMin, 
      max: Math.min(currentMax, maxDays + 1) 
    });
    
    currentMin = currentMax; // No overlap: next range starts where previous ends
  }
  
  return ranges;
}

/**
 * Generates actionable recommendations based on probability distribution
 * Following Clean Code: Business logic extraction, clear intent
 */
function generateRecommendations(
  ranges: Array<{ range: string; confidence: number; isRecommended: boolean; minDays: number; maxDays: number }>,
  cycleTimeDays: number[]
): { minDays: number; maxDays: number; confidenceLevel: number } {
  // Find the range that gives us around 70-80% confidence
  const targetConfidenceRange = ranges.find(r => r.confidence >= 70 && r.confidence <= 85);
  
  if (targetConfidenceRange) {
    return {
      minDays: targetConfidenceRange.minDays,
      maxDays: targetConfidenceRange.maxDays,
      confidenceLevel: targetConfidenceRange.confidence
    };
  }
  
  // Fallback: use percentiles approach
  const p75Index = Math.floor(cycleTimeDays.length * 0.75);
  const p75Days = cycleTimeDays[p75Index] || 1;
  
  return {
    minDays: Math.floor(p75Days * 0.5), // Conservative minimum
    maxDays: Math.ceil(p75Days),
    confidenceLevel: 75
  };
}

/**
 * Filters issues by time period based on entry date or creation date
 * Following Clean Code: Pure function, single responsibility
 */
function filterIssuesByTimePeriod(issues: readonly any[], timePeriodFilter: TimePeriodFilter): readonly any[] {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (timePeriodFilter.type) {
    case TimePeriod.LAST_15_DAYS:
      startDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
      break;
    case TimePeriod.LAST_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case TimePeriod.LAST_3_MONTHS:
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case TimePeriod.CUSTOM:
      if (!timePeriodFilter.customRange) {
        return issues; // No filter if custom range not specified
      }
      startDate = new Date(timePeriodFilter.customRange.start);
      endDate = new Date(timePeriodFilter.customRange.end);
      break;
    default:
      return issues; // No filter for unknown types
  }

  return issues.filter(issue => {
    // Use entry date if available, otherwise creation date
    // Note: This assumes the issue object has these fields - may need adjustment based on actual structure
    const referenceDate = issue.boardEntryDate || issue.created;
    
    if (!referenceDate) {
      return true; // Include issues without date information
    }

    const issueDate = new Date(referenceDate);
    return issueDate >= startDate && issueDate <= endDate;
  });
}

/**
 * Filters issues by issue type
 * Following Clean Code: Pure function, single responsibility
 */
function filterIssuesByType(issues: readonly any[], issueTypesFilter: string[]): readonly any[] {
  return issues.filter(issue => {
    if (!issue.issueType || !issue.issueType.name) {
      return false; // Exclude issues without issue type
    }
    
    return issueTypesFilter.includes(issue.issueType.name);
  });
}

/**
 * Creates Jira issue URL
 * Following Clean Code: Single responsibility, pure function
 */
function createJiraIssueUrl(issueKey: string): string {
  try {
    const config = createJiraConfig();
    return `${config.baseUrl}/browse/${issueKey}`;
  } catch (error) {
    // Fallback if config is not available
    console.warn('Could not create Jira URL, config not available:', error);
    return `#${issueKey}`;
  }
}

/**
 * Creates issue details from completed issues and their cycle time results
 * Following Clean Code: Single responsibility, pure function
 */
function createIssueDetails(
  completedResults: readonly IssueCycleTimeResult[],
  allIssues: readonly JiraIssue[]
): readonly IssueDetail[] {
  // Create a map for fast issue lookup
  const issueMap = new Map(allIssues.map(issue => [issue.key, issue]));
  
  return completedResults
    .filter(result => result.cycleTime !== null) // Only completed issues
    .map(result => {
      const issue = issueMap.get(result.issueKey);
      if (!issue) {
        console.warn(`Issue ${result.issueKey} not found in issues list`);
        return null;
      }
      
      return {
        key: issue.key,
        summary: issue.summary,
        issueType: {
          name: issue.issueType.name,
          iconUrl: issue.issueType.iconUrl
        },
        status: {
          name: issue.status.name,
          statusCategory: issue.status.statusCategory
        },
        jiraUrl: createJiraIssueUrl(issue.key),
        cycleTimeDays: result.cycleTime!.durationDays
      } as IssueDetail;
    })
    .filter((detail): detail is IssueDetail => detail !== null)
    .sort((a, b) => a.key.localeCompare(b.key)); // Sort by issue key
}
