/**
 * Kanban Analytics Service
 * Calculates cycle time percentiles and probability distributions for Kanban boards
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { KanbanAnalyticsResult, CycleTimePercentiles, CycleTimeProbabilityDistribution } from '../jira/types';
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
      cycleTimeProbability: calculateProbabilityDistribution(cycleTimes),
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
 */
function generateDayRanges(maxDays: number): Array<{ min: number; max: number }> {
  const ranges: Array<{ min: number; max: number }> = [];
  
  // Start with single day ranges for first few days
  for (let i = 0; i < Math.min(maxDays, 10); i+=4) {
    ranges.push({ min: i, max: i + 4 });
  }
  
  // Add broader ranges for higher values if needed
  if (maxDays > 10) {
    let current = 10;
    while (current < maxDays) {
      const rangeSize = current < 20 ? 2 : 5; // 2-day ranges up to 20, then 5-day ranges
      ranges.push({ min: current, max: Math.min(current + rangeSize, maxDays + 1) });
      current += rangeSize;
    }
  }
  console.error(ranges);
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
