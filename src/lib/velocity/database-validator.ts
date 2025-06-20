/**
 * Database-first validation using completion dates (NO API CALLS)
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { JiraSprint } from '../jira/boards';
import type { AdvancedValidationResult } from './advanced-validator';

/**
 * Validates if an issue should be counted for velocity using completion date from database
 * Following Clean Code: Express intent, single responsibility, NO API CALLS
 */
export function validateIssueWithCompletionDate(
  issue: JiraIssueWithPoints,
  sprint: JiraSprint
): AdvancedValidationResult {
  // Only check issues with story points
  if ((issue.storyPoints || 0) <= 0) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Must have completion date from database
  if (!issue.completionDate) {
    return {
      isValidForVelocity: false,
      reason: 'not_valid'
    };
  }

  // Check if completion happened before or at sprint end
  const completionDateTime = new Date(issue.completionDate);
  const sprintEndDateTime = new Date(sprint.endDate);
  const wasCompletedAtSprintEnd = completionDateTime <= sprintEndDateTime;

  return {
    isValidForVelocity: wasCompletedAtSprintEnd,
    reason: wasCompletedAtSprintEnd ? 'done_at_sprint_end' : 'not_valid',
    doneTransitionDate: issue.completionDate
  };
}

/**
 * Validates multiple issues using completion dates from database (NO API CALLS)
 * Following Clean Code: Batch operations, performance optimization
 */
export function validateIssuesWithCompletionDates(
  issues: readonly JiraIssueWithPoints[],
  sprint: JiraSprint
): readonly AdvancedValidationResult[] {
  console.log(`[DatabaseValidator] Validating ${issues.length} issues using completion dates (NO API CALLS)`);
  
  const results = issues.map(issue => validateIssueWithCompletionDate(issue, sprint));
  
  const validIssues = results.filter(r => r.isValidForVelocity).length;
  console.log(`[DatabaseValidator] Validated ${issues.length} issues: ${validIssues} valid, ${issues.length - validIssues} invalid`);
  
  return results;
}

/**
 * Calculates validated story points using completion dates from database
 * Following Clean Code: Express intent, single responsibility
 */
export function calculateValidatedStoryPointsWithCompletion(
  issues: readonly JiraIssueWithPoints[],
  validationResults: readonly AdvancedValidationResult[]
): number {
  let totalPoints = 0;
  
  for (let i = 0; i < issues.length; i++) {
    if (validationResults[i].isValidForVelocity && issues[i].storyPoints) {
      totalPoints += issues[i].storyPoints!;
    }
  }
  
  return totalPoints;
}

/**
 * Checks if issues have completion dates (indicating they came from database)
 * Following Clean Code: Express intent, type guard
 */
export function issuesHaveCompletionDates(issues: readonly JiraIssueWithPoints[]): boolean {
  // Check if at least one issue has a completion date (indicating database source)
  // Issues from API won't have completion dates initially
  return issues.some(issue => issue.completionDate !== undefined);
}

/**
 * Calculates sprint velocity using database validation (NO API CALLS)
 * Following Clean Code: Express intent, single responsibility
 */
export function calculateSprintVelocityWithDatabase(
  sprint: JiraSprint,
  issues: readonly JiraIssueWithPoints[]
): {
  totalPoints: number;
  validPoints: number;
  validationResults: readonly AdvancedValidationResult[];
} {
  console.log(`[DatabaseValidator] Calculating velocity for sprint ${sprint.name} using database validation`);
  
  // Calculate total committed points
  const totalPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  
  // Validate using completion dates (NO API CALLS)
  const validationResults = validateIssuesWithCompletionDates(issues, sprint);
  
  // Calculate valid points
  const validPoints = calculateValidatedStoryPointsWithCompletion(issues, validationResults);
  
  console.log(`[DatabaseValidator] Sprint ${sprint.name}: ${totalPoints} total points, ${validPoints} valid points`);
  
  return {
    totalPoints,
    validPoints,
    validationResults
  };
}

/**
 * Batch calculates velocity for multiple sprints using database validation (NO API CALLS)
 * Following Clean Code: Batch operations, performance optimization
 */
export function batchCalculateSprintVelocityWithDatabase(
  sprintIssuesPairs: readonly { sprint: JiraSprint; issues: readonly JiraIssueWithPoints[] }[]
): readonly {
  sprintId: string;
  totalPoints: number;
  validPoints: number;
  validationResults: readonly AdvancedValidationResult[];
}[] {
  console.log(`[DatabaseValidator] Batch calculating velocity for ${sprintIssuesPairs.length} sprints using database validation (NO API CALLS)`);
  
  const results = sprintIssuesPairs.map(({ sprint, issues }) => {
    const calculation = calculateSprintVelocityWithDatabase(sprint, issues);
    
    return {
      sprintId: sprint.id,
      totalPoints: calculation.totalPoints,
      validPoints: calculation.validPoints,
      validationResults: calculation.validationResults
    };
  });
  
  const totalIssues = sprintIssuesPairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  const totalValidIssues = results.reduce((sum, result) => 
    sum + result.validationResults.filter(r => r.isValidForVelocity).length, 0
  );
  
  console.log(`[DatabaseValidator] Batch validation complete: ${totalIssues} total issues, ${totalValidIssues} valid issues (NO API CALLS)`);
  
  return results;
}
