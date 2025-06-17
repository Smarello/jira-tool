/**
 * Enhanced velocity calculations with realistic mock data generation
 * Following Clean Code: Pure functions, Express intent
 */

import type { JiraSprint } from '../jira/boards';

/**
 * Generates realistic story points for sprints based on historical patterns
 * Following Clean Code: Single responsibility, predictable behavior
 */
export function generateRealisticStoryPoints(sprint: JiraSprint, sprintIndex: number): {
  committed: number;
  completed: number;
} {
  // Base velocity that improves over time (learning curve)
  const baseVelocity = 25 + Math.floor(sprintIndex * 2.5); // 25, 27.5, 30, etc.
  const variationFactor = 0.2; // 20% variation
  console.error(`Generating story points for sprint ${sprint.name} (index ${sprintIndex}) with base velocity ${baseVelocity}`, sprint);
  
  let committed: number;
  let completed: number;
  
  switch (sprint.state) {
    case 'closed':
      // Closed sprints: show realistic completion patterns
      committed = Math.floor(baseVelocity + (Math.random() - 0.5) * baseVelocity * variationFactor);
      
      // Completion rate improves over time (team gets better)
      const baseCompletionRate = Math.min(0.95, 0.7 + (sprintIndex * 0.05)); // Starts at 70%, improves to 95%
      const completionVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const actualCompletionRate = Math.max(0.5, baseCompletionRate + completionVariation);
      
      completed = Math.floor(committed * actualCompletionRate);
      break;
      
    case 'active':
      // Active sprint: partially completed
      committed = Math.floor(baseVelocity + (Math.random() - 0.5) * baseVelocity * variationFactor);
      
      // Active sprint is typically 40-70% complete
      const activeProgress = 0.4 + Math.random() * 0.3;
      completed = Math.floor(committed * activeProgress);
      break;
      
    case 'future':
      // Future sprint: planned points only
      committed = Math.floor(baseVelocity + (Math.random() - 0.5) * baseVelocity * variationFactor);
      completed = 0;
      break;
      
    default:
      committed = baseVelocity;
      completed = 0;
  }
  
  return { committed, completed };
}

/**
 * Generates sprint velocity data with realistic patterns
 * Following Clean Code: Compose complex operations from simple functions
 */
export function generateSprintVelocityPattern(sprints: readonly JiraSprint[]): Array<{
  sprint: JiraSprint;
  points: { committed: number; completed: number };
}> {
  return sprints.map((sprint, index) => {
    const points = generateRealisticStoryPoints(sprint, index);
    return {
      sprint,
      points
    };
  });
}

/**
 * Calculates team velocity trend with seasonal adjustments
 * Following Clean Code: Express intent through naming
 */
export function calculateSeasonalVelocity(baseVelocity: number, sprintIndex: number): number {
  // Simulate seasonal effects (holidays, team changes, etc.)
  const seasonalFactors = [1.0, 0.95, 1.05, 1.0, 0.9, 1.1, 0.85, 0.9, 1.0, 1.05, 0.8, 0.7];
  const monthIndex = sprintIndex % 12;
  
  return Math.floor(baseVelocity * seasonalFactors[monthIndex]);
}

/**
 * Validates velocity data for consistency
 * Following Clean Code: Command-Query Separation - this answers a question
 */
export function isVelocityDataConsistent(committed: number, completed: number): boolean {
  return completed >= 0 && completed <= committed && committed > 0;
}

/**
 * Calculates velocity confidence based on historical performance
 * Following Clean Code: Single responsibility, clear return value
 */
export function calculateVelocityConfidence(
  recentVelocities: readonly number[], 
  targetVelocity: number
): number {
  if (recentVelocities.length === 0) return 50; // Default confidence
  
  const average = recentVelocities.reduce((sum, v) => sum + v, 0) / recentVelocities.length;
  const variance = recentVelocities.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / recentVelocities.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate how many standard deviations away the target is
  const deviations = Math.abs(targetVelocity - average) / (standardDeviation || 1);
  
  // Convert to confidence percentage (closer to average = higher confidence)
  const confidence = Math.max(10, 100 - (deviations * 25));
  
  return Math.round(confidence);
}
