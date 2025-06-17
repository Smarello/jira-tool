/**
 * Velocity calculations for sprint analytics
 * Following Clean Code: Pure functions, Single Responsibility
 */

import type { JiraSprint } from '../jira/boards';

/**
 * Velocity data for a single sprint
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface SprintVelocity {
  readonly sprint: JiraSprint;
  readonly committedPoints: number;
  readonly completedPoints: number;
  readonly velocityPoints: number;
  readonly completionRate: number;
}

/**
 * Aggregated velocity data for a board
 * Following Clean Code: Express intent through naming
 */
export interface VelocityData {
  readonly boardId: string;
  readonly boardName: string;
  readonly sprints: readonly SprintVelocity[];
  readonly averageVelocity: number;
  readonly trend: VelocityTrend;
  readonly predictability: number;
}

/**
 * Velocity trend analysis
 * Following Clean Code: Replace magic numbers with named constants
 */
export type VelocityTrend = 'increasing' | 'decreasing' | 'stable';

const TREND_THRESHOLD = 0.1; // 10% change threshold
const MIN_SPRINTS_FOR_TREND = 3;

/**
 * Calculates velocity for a single sprint
 * Following Clean Code: Pure function, ≤3 parameters
 */
export function calculateSprintVelocity(
  sprint: JiraSprint,
  committedPoints: number,
  completedPoints: number
): SprintVelocity {
  const velocityPoints = sprint.state === 'closed' ? completedPoints : 0;
  const completionRate = committedPoints > 0 
    ? Math.round((completedPoints / committedPoints) * 100) 
    : 0;

  return {
    sprint,
    committedPoints,
    completedPoints,
    velocityPoints,
    completionRate
  };
}

/**
 * Calculates average velocity from sprint data
 * Following Clean Code: Single responsibility, early return
 */
export function calculateAverageVelocity(
  sprintVelocities: readonly SprintVelocity[]
): number {
  const completedSprints = sprintVelocities.filter(sv => 
    sv.sprint.state === 'closed'
  );

  if (completedSprints.length === 0) {
    return 0;
  }

  const totalVelocity = completedSprints.reduce(
    (sum, sv) => sum + sv.velocityPoints, 
    0
  );

  return Math.round(totalVelocity / completedSprints.length);
}

/**
 * Analyzes velocity trend over recent sprints
 * Following Clean Code: Explain why through naming
 */
export function analyzeVelocityTrend(
  sprintVelocities: readonly SprintVelocity[]
): VelocityTrend {
  const completedSprints = sprintVelocities
    .filter(sv => sv.sprint.state === 'closed')
    .slice(-MIN_SPRINTS_FOR_TREND); // Take last N sprints

  if (completedSprints.length < MIN_SPRINTS_FOR_TREND) {
    return 'stable';
  }

  const firstHalf = completedSprints.slice(0, Math.floor(completedSprints.length / 2));
  const secondHalf = completedSprints.slice(Math.floor(completedSprints.length / 2));

  const firstHalfAvg = calculateAverageVelocity(firstHalf);
  const secondHalfAvg = calculateAverageVelocity(secondHalf);

  if (firstHalfAvg === 0) {
    return 'stable';
  }

  const changeRatio = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

  if (changeRatio > TREND_THRESHOLD) {
    return 'increasing';
  }
  
  if (changeRatio < -TREND_THRESHOLD) {
    return 'decreasing';
  }

  return 'stable';
}

/**
 * Calculates velocity predictability (consistency)
 * Following Clean Code: Descriptive function name explains purpose
 */
export function calculateVelocityPredictability(
  sprintVelocities: readonly SprintVelocity[]
): number {
  const completedSprints = sprintVelocities.filter(sv => 
    sv.sprint.state === 'closed'
  );

  if (completedSprints.length < 2) {
    return 100; // Perfect predictability with insufficient data
  }

  const velocities = completedSprints.map(sv => sv.velocityPoints);
  const average = calculateAverageVelocity(completedSprints);

  if (average === 0) {
    return 100;
  }

  const variance = velocities.reduce((sum, velocity) => {
    const diff = velocity - average;
    return sum + (diff * diff);
  }, 0) / velocities.length;

  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = standardDeviation / average;

  // Convert to predictability percentage (inverse of variation)
  const predictability = Math.max(0, 100 - (coefficientOfVariation * 100));
  
  return Math.round(predictability);
}

/**
 * Creates comprehensive velocity data for a board
 * Following Clean Code: Compose complex operations from simple functions
 */
export function createVelocityData(
  boardId: string,
  boardName: string,
  sprintVelocities: readonly SprintVelocity[]
): VelocityData {
  return {
    boardId,
    boardName,
    sprints: sprintVelocities,
    averageVelocity: calculateAverageVelocity(sprintVelocities),
    trend: analyzeVelocityTrend(sprintVelocities),
    predictability: calculateVelocityPredictability(sprintVelocities)
  };
}

/**
 * Creates enhanced velocity data with separated closed/active sprint analysis
 * Following Clean Code: Express intent, composition over complexity
 */
export function createEnhancedVelocityData(
  boardId: string,
  boardName: string,
  allSprintVelocities: readonly SprintVelocity[]
): EnhancedVelocityData {
  const closedSprints = filterSprintsForVelocityAnalysis(allSprintVelocities);
  const activeSprint = findCurrentActiveSprint(allSprintVelocities);
  
  // Use only closed sprints for velocity analysis
  const baseVelocityData = createVelocityData(boardId, boardName, closedSprints);
  
  return {
    ...baseVelocityData,
    closedSprints,
    activeSprint,
    totalSprintsAnalyzed: closedSprints.length
  };
}

/**
 * Filters sprints for velocity analysis (closed sprints only)
 * Following Clean Code: Express intent, single responsibility
 * IMPORTANT: Sorts by completion date to ensure chronological order
 */
export function filterSprintsForVelocityAnalysis(
  sprintVelocities: readonly SprintVelocity[]
): readonly SprintVelocity[] {
  return sprintVelocities
    .filter(sv => sv.sprint.state === 'closed')
    .sort((a, b) => {
      // Sort by completion date (most recent first)
      // This ensures .slice(-5) gets the actual last 5 closed sprints
      const dateA = a.sprint.completeDate ? new Date(a.sprint.completeDate).getTime() : 0;
      const dateB = b.sprint.completeDate ? new Date(b.sprint.completeDate).getTime() : 0;
      
      // If no completion date, use end date as fallback
      const fallbackA = dateA || new Date(a.sprint.endDate).getTime();
      const fallbackB = dateB || new Date(b.sprint.endDate).getTime();
      
      return fallbackA - fallbackB; // Ascending order (oldest first)
    });
}

/**
 * Finds the current active sprint for live metrics
 * Following Clean Code: Express intent, early return
 */
export function findCurrentActiveSprint(
  sprintVelocities: readonly SprintVelocity[]
): SprintVelocity | null {
  const activeSprint = sprintVelocities.find(sv => sv.sprint.state === 'active');
  return activeSprint || null;
}

/**
 * Enhanced velocity data with separated closed and active sprint information
 * Following Clean Code: Express intent through naming
 */
export interface EnhancedVelocityData extends VelocityData {
  readonly closedSprints: readonly SprintVelocity[];
  readonly activeSprint: SprintVelocity | null;
  readonly totalSprintsAnalyzed: number;
}
