/**
 * Real velocity calculations using actual Jira issue data
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../jira/boards.js';
import type { JiraIssuesApi, JiraIssueWithPoints } from '../jira/issues-api.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { calculateSprintVelocity, type SprintVelocity } from './mock-calculator.js';
import { batchValidateSprintVelocity } from './batch-validator.js';

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
