/**
 * Centralized error handling for velocity calculations
 * Following Clean Code: Single responsibility, express intent
 */

/**
 * Custom error class for velocity calculation failures
 */
export class VelocityCalculationError extends Error {
  constructor(
    public readonly sprintId: string,
    public readonly sprintName: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Velocity calculation failed for sprint ${sprintName} (${sprintId}): ${message}`);
    this.name = 'VelocityCalculationError';
  }
}

/**
 * Error handler for sprint issues fetching
 */
export class SprintIssuesFetchError extends VelocityCalculationError {
  constructor(sprintId: string, sprintName: string, cause: unknown) {
    super(sprintId, sprintName, 'Failed to fetch issues', cause);
    this.name = 'SprintIssuesFetchError';
  }
}

/**
 * Error handler for batch validation failures
 */
export class BatchValidationError extends Error {
  constructor(
    public readonly failedSprints: string[],
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Batch validation failed for ${failedSprints.length} sprints: ${message}`);
    this.name = 'BatchValidationError';
  }
}

/**
 * Safely executes a sprint operation with error handling and logging
 * Following Clean Code: Single responsibility, error handling
 */
export async function safeExecuteSprintOperation<T>(
  operation: () => Promise<T>,
  sprintId: string,
  sprintName: string,
  fallback: T,
  operationName: string = 'operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`[VelocityCalculator] Failed ${operationName} for sprint ${sprintName} (${sprintId}):`, error);
    return fallback;
  }
}

/**
 * Safely executes an operation with generic error handling
 * Following Clean Code: Single responsibility, reusability
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`[VelocityCalculator] ${errorContext}:`, error);
    return fallback;
  }
}

/**
 * Creates a standardized velocity calculation error
 */
export function createVelocityError(
  sprintId: string,
  sprintName: string,
  operation: string,
  cause: unknown
): VelocityCalculationError {
  return new VelocityCalculationError(
    sprintId,
    sprintName,
    `Failed during ${operation}`,
    cause
  );
}