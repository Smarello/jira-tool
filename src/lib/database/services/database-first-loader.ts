/**
 * Database-first loading service
 * Following Clean Architecture: Application service for database-first strategy
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../../jira/boards';
import type { JiraIssueWithPoints } from '../../jira/issues-api';
import type { SprintVelocity } from '../../velocity/mock-calculator';
import type { IClosedSprintsRepository } from '../repositories/interfaces';
import type { ISprintIssuesRepository } from '../repositories/sprint-issues-repository';

/**
 * Extended sprint velocity interface for database-first loading
 * Following Clean Code: Express intent, extend base interface
 */
export interface ExtendedSprintVelocity extends SprintVelocity {
  readonly issuesCount?: number;
  readonly completedIssuesCount?: number;
  readonly averagePointsPerIssue?: number;
  readonly sprintDurationDays?: number;
  readonly pointsPerDay?: number;
  readonly trend?: 'increasing' | 'decreasing' | 'stable';
  readonly confidence?: 'high' | 'medium' | 'low';
  readonly fromCache?: boolean;
  readonly fromDatabase?: boolean;
}

/**
 * Result of database-first loading operation
 * Following Clean Code: Express intent, immutability
 */
export interface DatabaseFirstResult {
  readonly sprintsFromDatabase: readonly SprintFromDatabase[];
  readonly sprintsToLoadFromApi: readonly JiraSprint[];
  readonly databaseHitRate: number; // Percentage of sprints found in database
}

/**
 * Sprint data loaded from database with all related information
 * Following Clean Code: Express intent, data structure
 */
export interface SprintFromDatabase {
  readonly sprint: JiraSprint;
  readonly issues: readonly JiraIssueWithPoints[];
  readonly velocityData?: {
    readonly committedPoints: number;
    readonly completedPoints: number;
    readonly issuesCount: number;
    readonly completedIssuesCount: number;
  };
  readonly fromDatabase: true; // Marker to distinguish from API data
  readonly preValidated: true; // Issues have completion dates and can be validated without API calls
}

/**
 * Configuration for database-first loading
 * Following Clean Code: Configuration object pattern
 */
export interface DatabaseFirstConfig {
  readonly enableIssuesLoading: boolean;
  readonly enableVelocityDataLoading: boolean;
  readonly maxAgeHours?: number; // Optional: refresh data older than this
}

/**
 * Database-first loading service
 * Following Clean Architecture: Application service coordinating repositories
 */
export class DatabaseFirstLoader {
  constructor(
    private readonly sprintsRepository: IClosedSprintsRepository,
    private readonly issuesRepository: ISprintIssuesRepository,
    private readonly config: DatabaseFirstConfig
  ) {}

  /**
   * Loads sprint data using database-first strategy with batch operations
   * Following Clean Code: Express intent, single responsibility, batch optimization
   */
  async loadSprintsWithDatabaseFirst(
    sprints: readonly JiraSprint[]
  ): Promise<DatabaseFirstResult> {
    console.log(`[DatabaseFirst] Starting optimized database-first loading for ${sprints.length} sprints`);

    const sprintsFromDatabase: SprintFromDatabase[] = [];
    const sprintsToLoadFromApi: JiraSprint[] = [];

    // Separate closed sprints from non-closed sprints
    const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
    const nonClosedSprints = sprints.filter(sprint => sprint.state !== 'closed');

    // Non-closed sprints always go to API
    sprintsToLoadFromApi.push(...nonClosedSprints);

    if (closedSprints.length === 0) {
      console.log(`[DatabaseFirst] No closed sprints to check in database`);
      return {
        sprintsFromDatabase,
        sprintsToLoadFromApi,
        databaseHitRate: 0
      };
    }

    try {
      // BATCH OPTIMIZATION 1: Check existence of all closed sprints in one query
      console.log(`[DatabaseFirst] Batch checking existence of ${closedSprints.length} closed sprints...`);
      const closedSprintIds = closedSprints.map(sprint => sprint.id);
      const existingSprintIds = await this.sprintsRepository.checkMultipleSprintsExist(closedSprintIds);

      console.log(`[DatabaseFirst] Found ${existingSprintIds.size} existing sprints in database`);

      // Separate existing vs missing sprints
      const existingSprints: JiraSprint[] = [];
      const missingSprints: JiraSprint[] = [];

      for (const sprint of closedSprints) {
        if (existingSprintIds.has(sprint.id)) {
          existingSprints.push(sprint);
        } else {
          console.log(`[DatabaseFirst] Sprint ${sprint.name} not found in database, will load from API`);
          missingSprints.push(sprint);
        }
      }

      sprintsToLoadFromApi.push(...missingSprints);

      if (existingSprints.length > 0) {
        // BATCH OPTIMIZATION 2: Load all issues for existing sprints in one query
        console.log(`[DatabaseFirst] Batch loading issues for ${existingSprints.length} existing sprints...`);
        const existingSprintIds = existingSprints.map(sprint => sprint.id);

        let allIssuesMap = new Map<string, readonly JiraIssueWithPoints[]>();
        if (this.config.enableIssuesLoading) {
          allIssuesMap = await this.issuesRepository.getMultipleSprintIssues(existingSprintIds);
          console.log(`[DatabaseFirst] Loaded issues for ${allIssuesMap.size} sprints from database`);
        }

        // Build sprint data from database
        for (const sprint of existingSprints) {
          try {
            const sprintFromDb = await this.buildSprintFromDatabase(
              sprint,
              allIssuesMap.get(sprint.id) || []
            );

            if (sprintFromDb) {
              sprintsFromDatabase.push(sprintFromDb);
              console.log(`[DatabaseFirst] Loaded sprint ${sprint.name} from database with ${sprintFromDb.issues.length} issues`);
            } else {
              // Failed to build from database, fallback to API
              sprintsToLoadFromApi.push(sprint);
            }
          } catch (error) {
            console.warn(`[DatabaseFirst] Error building sprint ${sprint.id} from database:`, error);
            sprintsToLoadFromApi.push(sprint);
          }
        }
      }

    } catch (error) {
      console.error(`[DatabaseFirst] Batch database operations failed:`, error);
      // On batch error, fallback all closed sprints to API
      sprintsToLoadFromApi.push(...closedSprints);
    }

    const databaseHitRate = sprints.length > 0
      ? (sprintsFromDatabase.length / sprints.length) * 100
      : 0;

    console.log(`[DatabaseFirst] Optimized database hit rate: ${databaseHitRate.toFixed(1)}% (${sprintsFromDatabase.length}/${sprints.length})`);
    console.log(`[DatabaseFirst] Sprints to load from API: ${sprintsToLoadFromApi.length}`);

    return {
      sprintsFromDatabase,
      sprintsToLoadFromApi,
      databaseHitRate
    };
  }

  /**
   * Builds sprint data from database using pre-loaded issues (batch optimized)
   * Following Clean Code: Single responsibility, null object pattern
   */
  private async buildSprintFromDatabase(
    sprint: JiraSprint,
    issues: readonly JiraIssueWithPoints[]
  ): Promise<SprintFromDatabase | null> {
    try {
      // Load sprint metadata from database
      const persistedSprint = await this.sprintsRepository.getSprintById(sprint.id, true);

      if (!persistedSprint) {
        return null;
      }

      // Extract velocity data if available
      let velocityData: SprintFromDatabase['velocityData'];
      if (this.config.enableVelocityDataLoading && persistedSprint.velocityData) {
        try {
          const parsed = typeof persistedSprint.velocityData === 'string'
            ? JSON.parse(persistedSprint.velocityData)
            : persistedSprint.velocityData;

          velocityData = {
            committedPoints: parsed.committedPoints || 0,
            completedPoints: parsed.completedPoints || 0,
            issuesCount: parsed.issuesCount || issues.length,
            completedIssuesCount: parsed.completedIssuesCount || 0
          };
        } catch (error) {
          console.warn(`[DatabaseFirst] Failed to parse velocity data for sprint ${sprint.id}:`, error);
        }
      }

      return {
        sprint,
        issues,
        velocityData,
        fromDatabase: true,
        preValidated: true
      };

    } catch (error) {
      console.error(`[DatabaseFirst] Failed to build sprint ${sprint.id} from database:`, error);
      return null;
    }
  }



  /**
   * Converts database sprint data to velocity format
   * Following Clean Code: Data transformation, pure function
   */
  convertDatabaseSprintToVelocity(sprintFromDb: SprintFromDatabase): ExtendedSprintVelocity {
    const { sprint, velocityData } = sprintFromDb;

    const sprintDurationDays = this.calculateSprintDuration(sprint);
    const completedPoints = velocityData?.completedPoints || 0;
    const pointsPerDay = sprintDurationDays > 0 ? Math.round((completedPoints / sprintDurationDays) * 100) / 100 : 0;

    return {
      sprint,
      committedPoints: velocityData?.committedPoints || 0,
      completedPoints,
      velocityPoints: completedPoints,
      completionRate: velocityData?.committedPoints
        ? Math.round((velocityData.completedPoints / velocityData.committedPoints) * 100)
        : 0,
      issuesCount: velocityData?.issuesCount || sprintFromDb.issues.length,
      completedIssuesCount: velocityData?.completedIssuesCount || 0,
      averagePointsPerIssue: velocityData?.issuesCount
        ? Math.round((velocityData.completedPoints / velocityData.issuesCount) * 100) / 100
        : 0,
      sprintDurationDays,
      pointsPerDay,
      trend: 'stable' as const,
      confidence: 'high' as const, // Database data is considered high confidence
      fromCache: false,
      fromDatabase: true // Add marker for database source
    };
  }

  /**
   * Calculates sprint duration in days
   * Following Clean Code: Pure function, single responsibility
   */
  private calculateSprintDuration(sprint: JiraSprint): number {
    if (!sprint.startDate || !sprint.endDate) {
      return 14; // Default 2-week sprint
    }

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 14;
  }
}

/**
 * Factory function to create database-first loader
 * Following Clean Code: Factory pattern, dependency injection
 */
export function createDatabaseFirstLoader(
  sprintsRepository: IClosedSprintsRepository,
  issuesRepository: ISprintIssuesRepository,
  config: Partial<DatabaseFirstConfig> = {}
): DatabaseFirstLoader {
  const defaultConfig: DatabaseFirstConfig = {
    enableIssuesLoading: true,
    enableVelocityDataLoading: true,
    maxAgeHours: 24
  };

  return new DatabaseFirstLoader(
    sprintsRepository,
    issuesRepository,
    { ...defaultConfig, ...config }
  );
}
