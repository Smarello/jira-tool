/**
 * Batch velocity validation - Zero repeated board configuration API calls
 * Following Clean Code: Single responsibility, performance optimization
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards';
import type { McpAtlassianClient } from '../mcp/atlassian';
import type { AdvancedValidationResult } from './advanced-validator';
import { getDoneStatusIdsForBoard } from './board-cache';

/**
 * Sprint validation context - contains pre-fetched board configuration
 * Following Clean Code: Express intent, immutability
 */
export interface SprintValidationContext {
  readonly sprint: JiraSprint;
  readonly boardId: string;
  readonly doneStatusIds: readonly string[];
}

/**
 * Batch validation result for multiple sprints
 * Following Clean Code: Express intent, immutability
 */
export interface BatchValidationResult {
  readonly sprintId: string;
  readonly issueValidations: readonly AdvancedValidationResult[];
  readonly totalIssues: number;
  readonly validIssues: number;
  readonly totalPoints: number;
  readonly validPoints: number;
}

/**
 * Sprint-issues pair type for internal processing
 * Following Clean Code: Express intent, type safety
 */
type SprintIssuesPair = { sprint: JiraSprint; issues: readonly JiraIssueWithPoints[] };

/**
 * Creates validation context with pre-fetched board configuration
 * SINGLE API CALL per board - massive optimization!
 * Following Clean Code: Express intent, performance optimization
 */
export async function createSprintValidationContext(
  sprint: JiraSprint,
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<SprintValidationContext> {
  console.log(`[BatchValidator] Pre-fetching Done status IDs for board ${boardId}`);
  
  // SINGLE API CALL: Get board configuration once
  const doneStatusIds = await getDoneStatusIdsForBoard(boardId, mcpClient);
  
  console.log(`[BatchValidator] Board ${boardId} Done status IDs: [${doneStatusIds.join(', ')}]`);
  
  return {
    sprint,
    boardId,
    doneStatusIds
  };
}

/**
 * Validates issues using pre-fetched board configuration with progress tracking
 * ZERO board configuration API calls - uses context data!
 * Following Clean Code: Express intent, dependency injection, progress reporting
 */
export async function validateIssuesWithContext(
  issues: readonly JiraIssueWithPoints[],
  context: SprintValidationContext,
  mcpClient: McpAtlassianClient,
  progressCallback?: (currentIssue: number, totalIssues: number, _issueKey: string) => void
): Promise<readonly AdvancedValidationResult[]> {
  console.log(`[BatchValidator] Validating ${issues.length} issues with pre-fetched context (NO API CALLS)`);
  
  const results: AdvancedValidationResult[] = [];
  
  // Process each issue with pre-fetched Done status IDs
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    
    // Report progress on issue validation (this is where changelog API calls happen)
    if (progressCallback) {
      progressCallback(i + 1, issues.length, issue.key);
    }
    
    const result = await validateSingleIssue(issue, context, mcpClient);
    results.push(result);
  }
  
  const validIssues = results.filter(r => r.isValidForVelocity).length;
  console.log(`[BatchValidator] Validated ${issues.length} issues: ${validIssues} valid, ${issues.length - validIssues} invalid`);
  
  return results;
}

/**
 * Validates a single issue using pre-fetched context
 * Following Clean Code: Single responsibility, pure logic
 */
async function validateSingleIssue(
  issue: JiraIssueWithPoints,
  context: SprintValidationContext,
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
  if (context.doneStatusIds.length === 0) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Get changelog and check transition date
  const changelogApi = mcpClient.getChangelogApi();
  const doneTransitionDate = await changelogApi.findDoneColumnTransitionDateById(
    issue.key,
    context.doneStatusIds
  );

  if (!doneTransitionDate) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Check if transition happened before or at sprint end
  const transitionDateTime = new Date(doneTransitionDate);
  const sprintEndDateTime = new Date(context.sprint.endDate);
  const wasInDoneAtSprintEnd = transitionDateTime <= sprintEndDateTime;

  return {
    isValidForVelocity: wasInDoneAtSprintEnd,
    reason: wasInDoneAtSprintEnd ? 'done_at_sprint_end' : 'not_valid',
    doneTransitionDate
  };
}

/**
 * Batch validates multiple sprints with optimal API usage and progress tracking
 * Creates context once per board, validates all issues for that board
 * Following Clean Code: Compose operations, performance optimization, progress reporting
 */
export async function batchValidateSprintVelocity(
  sprintIssuesPairs: readonly SprintIssuesPair[],
  mcpClient: McpAtlassianClient,
  progressCallback?: (currentSprint: number, sprintName: string, phase: string) => void
): Promise<readonly BatchValidationResult[]> {
  console.log(`[BatchValidator] Starting batch validation for ${sprintIssuesPairs.length} sprints`);
  
  const results: BatchValidationResult[] = [];
  
  // Group sprints by board to minimize API calls - use mutable array for push operations
  const sprintsByBoard = new Map<string, SprintIssuesPair[]>();
  
  for (const pair of sprintIssuesPairs) {
    const boardId = pair.sprint.originBoardId;
    if (!sprintsByBoard.has(boardId)) {
      sprintsByBoard.set(boardId, []);
    }
    sprintsByBoard.get(boardId)!.push(pair);
  }
  
  console.log(`[BatchValidator] Processing ${sprintsByBoard.size} unique boards`);
  
  // Process each board's sprints with shared context
  for (const [boardId, boardSprints] of sprintsByBoard) {
    console.log(`[BatchValidator] Processing ${boardSprints.length} sprints for board ${boardId}`);
    
    // Single API call per board for configuration
    const firstSprint = boardSprints[0].sprint;
    const context = await createSprintValidationContext(firstSprint, boardId, mcpClient);
    
    // Validate all sprints for this board using shared context
    let currentSprintIndex = 0;
    for (const { sprint, issues } of boardSprints) {
      currentSprintIndex++;
      
      // Report progress for the current sprint being validated
      if (progressCallback) {
        const globalSprintIndex = sprintIssuesPairs.findIndex(pair => pair.sprint.id === sprint.id) + 1;
        progressCallback(globalSprintIndex, sprint.name, 'validating');
      }
      
      const sprintContext = { ...context, sprint }; // Update sprint while keeping board config
      
      // Pass a more detailed progress callback for issue-level tracking
      const issueValidations = await validateIssuesWithContext(
        issues, 
        sprintContext, 
        mcpClient,
        (currentIssue: number, totalIssues: number, _issueKey: string) => {
          if (progressCallback) {
            const globalSprintIndex = sprintIssuesPairs.findIndex(pair => pair.sprint.id === sprint.id) + 1;
            progressCallback(
              globalSprintIndex, 
              `${sprint.name} (${currentIssue}/${totalIssues} issues)`, 
              'validating'
            );
          }
        }
      );
      
      const validIssues = issueValidations.filter(r => r.isValidForVelocity).length;
      const totalPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
      const validPoints = issues
        .filter((_, index) => issueValidations[index]?.isValidForVelocity)
        .reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
      
      results.push({
        sprintId: sprint.id,
        issueValidations,
        totalIssues: issues.length,
        validIssues,
        totalPoints,
        validPoints
      });
    }
  }
  
  // const totalApiCalls = sprintsByBoard.size;
  // const totalIssues = sprintIssuesPairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  
  return results;
} 