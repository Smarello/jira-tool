/**
 * Real velocity calculations using actual Jira issue data
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../jira/boards.js';
import type { JiraIssuesApi } from '../jira/issues-api.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { calculateSprintVelocity, type SprintVelocity } from './mock-calculator.js';
import { batchValidateSprintVelocity } from './batch-validator.js';

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
