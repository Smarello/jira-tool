/**
 * Real velocity calculations using actual Jira issue data
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../jira/boards.js';
import type { JiraIssuesApi, JiraIssueWithPoints } from '../jira/issues-api.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { calculateSprintVelocity, type SprintVelocity } from './mock-calculator.js';
import { batchValidateSprintVelocity } from './batch-validator.js';
import type { SprintFromDatabase } from '../database/services/database-first-loader.js';
import { extractCompletionDatesForSprint } from './completion-date-extractor.js';
import {
  batchCalculateSprintVelocityWithDatabase,
  issuesHaveCompletionDates
} from './database-validator.js';

/**
 * Extended result type that includes both velocity and issues data
 * Following Clean Code: Express intent, immutability
 */
export interface SprintVelocityWithIssues {
  readonly velocity: SprintVelocity;
  readonly issues: readonly JiraIssueWithPoints[];
}

/**
 * Batch calculation result with velocity and issues data
 * Following Clean Code: Express intent, type safety
 */
export interface BatchVelocityResult {
  readonly velocities: readonly SprintVelocity[];
  readonly sprintIssuesMap: ReadonlyMap<string, readonly JiraIssueWithPoints[]>;
}

/**
 * Calculates real sprint velocity from Jira issues
 * Following Clean Code: Express intent, single responsibility, ≤3 parameters
 */
export async function calculateRealSprintVelocity(
  sprint: JiraSprint,
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient
): Promise<SprintVelocity> {
  try {
    // Fetch real story points data from Jira issues
    console.log(`---------> Fetched ${sprint.name} for velocity calculation`);
    const storyPointsData = await issuesApi.calculateSprintStoryPoints(
      sprint.id, 
      sprint, 
      sprint.originBoardId,
      mcpClient
    );
    
    return calculateSprintVelocity(
      sprint,
      storyPointsData.committed,
      storyPointsData.completed
    );
  } catch (error) {
    // Graceful degradation: return zero points if issues can't be fetched
    console.warn(`Failed to fetch issues for sprint ${sprint.id}:`, error);
    
    return calculateSprintVelocity(sprint, 0, 0);
  }
}

/**
 * Calculates velocity for multiple sprints using real data
 * OPTIMIZED: Uses batch validation to minimize board configuration API calls
 * Following Clean Code: Compose operations, immutability, performance optimization
 */
export async function calculateRealSprintsVelocity(
  sprints: readonly JiraSprint[],
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient
): Promise<readonly SprintVelocity[]> {
  console.log(`[Calculator] Starting velocity calculation for ${sprints.length} sprints`);
  
  // Fetch issues for all sprints
  const sprintIssuesPairs = [];
  for (const sprint of sprints) {
    try {
      console.log(`[Calculator] Fetching issues for sprint ${sprint.name}`);
      const issues = await issuesApi.fetchSprintIssues(sprint.id);
      sprintIssuesPairs.push({ sprint, issues });
    } catch (error) {
      console.warn(`[Calculator] Failed to fetch issues for sprint ${sprint.id}:`, error);
      sprintIssuesPairs.push({ sprint, issues: [] });
    }
  }
  
  // BATCH VALIDATION: Single API call per board instead of per issue!
  const batchResults = await batchValidateSprintVelocity(sprintIssuesPairs, mcpClient);
  
  // Convert batch results to velocity data
  const velocities: SprintVelocity[] = [];
  
  for (const result of batchResults) {
    const sprint = sprintIssuesPairs.find(pair => pair.sprint.id === result.sprintId)?.sprint;
    if (!sprint) {
      console.warn(`[Calculator] Sprint not found for ID ${result.sprintId}`);
      continue;
    }
    
    const velocity = calculateSprintVelocity(
      sprint,
      result.totalPoints,
      result.validPoints
    );
    
    velocities.push(velocity);
  }
  
  const totalIssues = sprintIssuesPairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  console.log(`[Calculator] Velocity calculation complete: ${velocities.length} sprints, ${totalIssues} total issues`);
  
  return velocities;
}

/**
 * Calculates velocity for multiple sprints with real-time progress callbacks
 * Following Clean Code: Compose operations, immutability, progress reporting
 */
export async function calculateRealSprintsVelocityWithProgress(
  sprints: readonly JiraSprint[],
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient,
  progressCallback: (currentSprint: number, sprintName: string, phase: string) => void
): Promise<readonly SprintVelocity[]> {
  console.log(`[Calculator] Starting velocity calculation with progress for ${sprints.length} sprints`);
  
  // Phase 1: Fetch issues for all sprints (fast operation)
  progressCallback(0, '', 'fetching');
  const sprintIssuesPairs = [];
  
  for (let i = 0; i < sprints.length; i++) {
    const sprint = sprints[i];
    
    try {
      console.log(`[Calculator] Fetching issues for sprint ${sprint.name}`);
      const issues = await issuesApi.fetchSprintIssues(sprint.id);
      sprintIssuesPairs.push({ sprint, issues });
    } catch (error) {
      console.warn(`[Calculator] Failed to fetch issues for sprint ${sprint.id}:`, error);
      sprintIssuesPairs.push({ sprint, issues: [] });
    }
  }
  
  console.log(`[Calculator] Fetched issues for ${sprintIssuesPairs.length} sprints, starting validation...`);
  
  // Phase 2: Batch validation with progress (this is the slow part!)
  console.log(`[Calculator] Starting batch validation for ${sprintIssuesPairs.length} sprints`);
  
  const batchResults = await batchValidateSprintVelocity(
    sprintIssuesPairs, 
    mcpClient,
    (currentSprint: number, sprintName: string, phase: string) => {
      // Report progress during the actual slow operation (changelog validation)
      progressCallback(currentSprint, sprintName, phase);
    }
  );
  
  // Phase 3: Convert batch results to velocity data
  progressCallback(sprints.length, '', 'calculating');
  const velocities: SprintVelocity[] = [];
  
  for (const result of batchResults) {
    const sprint = sprintIssuesPairs.find(pair => pair.sprint.id === result.sprintId)?.sprint;
    if (!sprint) {
      console.warn(`[Calculator] Sprint not found for ID ${result.sprintId}`);
      continue;
    }
    
    const velocity = calculateSprintVelocity(
      sprint,
      result.totalPoints,
      result.validPoints
    );
    
    velocities.push(velocity);
  }
  
  const totalIssues = sprintIssuesPairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  console.log(`[Calculator] Velocity calculation complete: ${velocities.length} sprints, ${totalIssues} total issues`);
  
  return velocities;
}

/**
 * Calculates velocity for multiple sprints and returns both velocity and issues data
 * Following Clean Code: Compose operations, immutability, data preservation
 */
export async function calculateRealSprintsVelocityWithIssues(
  sprints: readonly JiraSprint[],
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient
): Promise<BatchVelocityResult> {
  console.log(`[Calculator] Starting velocity calculation with issues data for ${sprints.length} sprints`);

  // Fetch issues for all sprints and extract completion dates
  const sprintIssuesPairs = [];
  for (const sprint of sprints) {
    try {
      console.log(`[Calculator] Fetching issues for sprint ${sprint.name}`);
      const rawIssues = await issuesApi.fetchSprintIssues(sprint.id);

      // Extract completion dates for the issues
      const issuesWithCompletion = await extractCompletionDatesForSprint(
        rawIssues,
        sprint.originBoardId,
        mcpClient
      );

      // Convert back to JiraIssueWithPoints format (completion date is now included)
      const issues: JiraIssueWithPoints[] = issuesWithCompletion.map(issue => ({
        ...issue,
        completionDate: issue.completionDate
      }));

      sprintIssuesPairs.push({ sprint, issues });
    } catch (error) {
      console.warn(`[Calculator] Failed to fetch issues for sprint ${sprint.id}:`, error);
      sprintIssuesPairs.push({ sprint, issues: [] });
    }
  }

  // BATCH VALIDATION: Single API call per board instead of per issue!
  const batchResults = await batchValidateSprintVelocity(sprintIssuesPairs, mcpClient);

  // Convert batch results to velocity data
  const velocities: SprintVelocity[] = [];
  const sprintIssuesMap = new Map<string, readonly JiraIssueWithPoints[]>();

  for (const result of batchResults) {
    const sprintIssuesPair = sprintIssuesPairs.find(pair => pair.sprint.id === result.sprintId);
    if (!sprintIssuesPair) {
      console.warn(`[Calculator] Sprint not found for ID ${result.sprintId}`);
      continue;
    }

    const velocity = calculateSprintVelocity(
      sprintIssuesPair.sprint,
      result.totalPoints,
      result.validPoints
    );

    velocities.push(velocity);
    sprintIssuesMap.set(sprintIssuesPair.sprint.id, sprintIssuesPair.issues);
  }

  const totalIssues = sprintIssuesPairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  console.log(`[Calculator] Velocity calculation with issues complete: ${velocities.length} sprints, ${totalIssues} total issues`);

  return {
    velocities,
    sprintIssuesMap
  };
}

/**
 * Calculates velocity for mixed data sources (database + API)
 * Following Clean Code: Compose operations, database-first strategy
 */
export async function calculateMixedSprintsVelocityWithIssues(
  sprintsFromDatabase: readonly SprintFromDatabase[],
  sprintsToLoadFromApi: readonly JiraSprint[],
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient
): Promise<BatchVelocityResult> {
  console.log(`[Calculator] Starting mixed velocity calculation:`);
  console.log(`[Calculator] - Database sprints: ${sprintsFromDatabase.length}`);
  console.log(`[Calculator] - API sprints: ${sprintsToLoadFromApi.length}`);

  const allVelocities: SprintVelocity[] = [];
  const allSprintIssuesMap = new Map<string, readonly JiraIssueWithPoints[]>();

  // Process database sprints using optimized validation (NO API CALLS)
  if (sprintsFromDatabase.length > 0) {
    console.log(`[Calculator] Processing ${sprintsFromDatabase.length} database sprints with optimized validation (NO API CALLS)`);

    // Check if database sprints have completion dates for optimized validation
    const sprintIssuesPairs = sprintsFromDatabase.map(sprintFromDb => ({
      sprint: sprintFromDb.sprint,
      issues: sprintFromDb.issues
    }));

    // Use database validation if issues have completion dates
    const hasCompletionDates = sprintIssuesPairs.some(pair =>
      issuesHaveCompletionDates(pair.issues)
    );

    if (hasCompletionDates) {
      console.log(`[Calculator] Using database validation (NO API CALLS) for ${sprintsFromDatabase.length} sprints`);
      const databaseValidationResults = batchCalculateSprintVelocityWithDatabase(sprintIssuesPairs);

      for (const result of databaseValidationResults) {
        const sprintFromDb = sprintsFromDatabase.find(ds => ds.sprint.id === result.sprintId)!;
        const velocity: SprintVelocity = {
          sprint: sprintFromDb.sprint,
          committedPoints: result.totalPoints,
          completedPoints: result.validPoints,
          velocityPoints: result.validPoints,
          completionRate: result.totalPoints > 0 ? (result.validPoints / result.totalPoints) * 100 : 0
        };

        allVelocities.push(velocity);
        allSprintIssuesMap.set(sprintFromDb.sprint.id, sprintFromDb.issues);
      }
    } else {
      // Fallback to pre-calculated velocity data or basic calculation
      for (const sprintFromDb of sprintsFromDatabase) {
        console.log(`[Calculator] Processing database sprint: ${sprintFromDb.sprint.name}`);

        // Convert database sprint to velocity format
        const velocity: SprintVelocity = {
          sprint: sprintFromDb.sprint,
          committedPoints: sprintFromDb.velocityData?.committedPoints || 0,
          completedPoints: sprintFromDb.velocityData?.completedPoints || 0,
          velocityPoints: sprintFromDb.velocityData?.completedPoints || 0,
          completionRate: sprintFromDb.velocityData?.committedPoints
            ? (sprintFromDb.velocityData.completedPoints / sprintFromDb.velocityData.committedPoints) * 100
            : 0
        };

        allVelocities.push(velocity);
        allSprintIssuesMap.set(sprintFromDb.sprint.id, sprintFromDb.issues);
      }
    }
  }

  // Process API sprints (if any) - EXTRACT COMPLETION DATES!
  if (sprintsToLoadFromApi.length > 0) {
    console.log(`[Calculator] Loading ${sprintsToLoadFromApi.length} sprints from API with completion date extraction...`);

    // Use the version that extracts completion dates!
    const apiResult = await calculateRealSprintsVelocityWithIssues(
      sprintsToLoadFromApi,
      issuesApi,
      mcpClient
    );

    allVelocities.push(...apiResult.velocities);

    // Merge issues maps
    for (const [sprintId, issues] of apiResult.sprintIssuesMap.entries()) {
      allSprintIssuesMap.set(sprintId, issues);
    }
  }

  console.log(`[Calculator] Mixed calculation complete. Total velocities: ${allVelocities.length}`);

  return {
    velocities: allVelocities,
    sprintIssuesMap: allSprintIssuesMap
  };
}

/**
 * Legacy single-sprint calculation for backward compatibility
 * @deprecated Use calculateRealSprintsVelocity for better performance
 */
export async function calculateRealSprintVelocityLegacy(
  sprint: JiraSprint,
  issuesApi: JiraIssuesApi,
  mcpClient: McpAtlassianClient
): Promise<SprintVelocity> {
  return calculateRealSprintVelocity(sprint, issuesApi, mcpClient);
}
