/**
 * Data transformation utilities for velocity calculations
 * Following Clean Code: Single responsibility, pure functions, express intent
 */

import type { JiraSprint } from '../../jira/boards.js';
import type { JiraIssueWithPoints } from '../../jira/issues-api.js';
import type { SprintVelocity } from '../mock-calculator.js';
import type { SprintFromDatabase } from '../../database/services/database-first-loader.js';

/**
 * Sprint issues pair for internal processing
 */
export interface SprintIssuesPair {
  readonly sprint: JiraSprint;
  readonly issues: readonly JiraIssueWithPoints[];
}

/**
 * Transforms database sprint data to SprintVelocity format
 * Following Clean Code: Pure function, single responsibility, express intent
 */
export class VelocityDataTransformer {
  /**
   * Converts SprintFromDatabase to SprintVelocity
   */
  static sprintFromDatabaseToVelocity(sprintFromDb: SprintFromDatabase): SprintVelocity {
    const committedPoints = sprintFromDb.velocityData?.committedPoints || 0;
    const completedPoints = sprintFromDb.velocityData?.completedPoints || 0;
    
    return {
      sprint: sprintFromDb.sprint,
      committedPoints,
      completedPoints,
      velocityPoints: completedPoints,
      completionRate: this.calculateCompletionRate(committedPoints, completedPoints)
    };
  }

  /**
   * Converts multiple database sprints to velocity format
   */
  static batchSprintsFromDatabaseToVelocity(
    sprintsFromDb: readonly SprintFromDatabase[]
  ): readonly SprintVelocity[] {
    return sprintsFromDb.map(sprint => this.sprintFromDatabaseToVelocity(sprint));
  }

  /**
   * Creates SprintIssuesPair from database sprint
   */
  static sprintFromDatabaseToIssuesPair(sprintFromDb: SprintFromDatabase): SprintIssuesPair {
    return {
      sprint: sprintFromDb.sprint,
      issues: sprintFromDb.issues
    };
  }

  /**
   * Converts multiple database sprints to SprintIssuesPair format
   */
  static batchSprintsFromDatabaseToIssuesPairs(
    sprintsFromDb: readonly SprintFromDatabase[]
  ): readonly SprintIssuesPair[] {
    return sprintsFromDb.map(sprint => this.sprintFromDatabaseToIssuesPair(sprint));
  }

  /**
   * Calculates completion rate from committed and completed points
   * Following Clean Code: Pure function, single responsibility
   */
  static calculateCompletionRate(committedPoints: number, completedPoints: number): number {
    if (committedPoints <= 0) {
      return 0;
    }
    return Math.round((completedPoints / committedPoints) * 100);
  }

  /**
   * Creates SprintVelocity from batch validation result
   * Following Clean Code: Express intent, immutability
   */
  static createVelocityFromBatchResult(
    sprint: JiraSprint,
    totalPoints: number,
    validPoints: number
  ): SprintVelocity {
    return {
      sprint,
      committedPoints: totalPoints,
      completedPoints: validPoints,
      velocityPoints: validPoints,
      completionRate: this.calculateCompletionRate(totalPoints, validPoints)
    };
  }

  /**
   * Safely extracts sprint from SprintIssuesPair by ID
   * Following Clean Code: Null object pattern, safe navigation
   */
  static findSprintInPairs(
    pairs: readonly SprintIssuesPair[],
    sprintId: string
  ): JiraSprint | null {
    const pair = pairs.find(p => p.sprint.id === sprintId);
    return pair?.sprint || null;
  }

  /**
   * Counts total issues across all sprint pairs
   * Following Clean Code: Pure function, express intent
   */
  static countTotalIssues(pairs: readonly SprintIssuesPair[]): number {
    return pairs.reduce((sum, pair) => sum + pair.issues.length, 0);
  }

  /**
   * Creates a Map of sprint ID to issues for quick lookup
   * Following Clean Code: Data structure optimization, express intent
   */
  static createSprintIssuesMap(
    pairs: readonly SprintIssuesPair[]
  ): ReadonlyMap<string, readonly JiraIssueWithPoints[]> {
    const map = new Map<string, readonly JiraIssueWithPoints[]>();
    for (const pair of pairs) {
      map.set(pair.sprint.id, pair.issues);
    }
    return map;
  }

  /**
   * Merges two sprint issues maps into one
   * Following Clean Code: Immutability, express intent
   */
  static mergeSprintIssuesMaps(
    map1: ReadonlyMap<string, readonly JiraIssueWithPoints[]>,
    map2: ReadonlyMap<string, readonly JiraIssueWithPoints[]>
  ): Map<string, readonly JiraIssueWithPoints[]> {
    const merged = new Map(map1);
    for (const [sprintId, issues] of map2.entries()) {
      merged.set(sprintId, issues);
    }
    return merged;
  }

  /**
   * Validates that a SprintIssuesPair has valid data
   * Following Clean Code: Input validation, defensive programming
   */
  static isValidSprintIssuesPair(pair: SprintIssuesPair): boolean {
    return (
      pair?.sprint?.id !== undefined &&
      pair.sprint.name !== undefined &&
      Array.isArray(pair.issues)
    );
  }

  /**
   * Filters out invalid SprintIssuesPairs
   * Following Clean Code: Data sanitization, express intent
   */
  static filterValidSprintIssuesPairs(
    pairs: readonly SprintIssuesPair[]
  ): readonly SprintIssuesPair[] {
    return pairs.filter(pair => this.isValidSprintIssuesPair(pair));
  }
}