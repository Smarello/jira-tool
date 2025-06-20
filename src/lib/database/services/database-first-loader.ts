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
   * Loads sprint data using database-first strategy
   * Following Clean Code: Express intent, single responsibility
   */
  async loadSprintsWithDatabaseFirst(
    sprints: readonly JiraSprint[]
  ): Promise<DatabaseFirstResult> {
    console.log(`[DatabaseFirst] Starting database-first loading for ${sprints.length} sprints`);

    const sprintsFromDatabase: SprintFromDatabase[] = [];
    const sprintsToLoadFromApi: JiraSprint[] = [];

    // Check each sprint in the database
    for (const sprint of sprints) {
      try {
        // Only check closed sprints in database
        if (sprint.state !== 'closed') {
          sprintsToLoadFromApi.push(sprint);
          continue;
        }

        const existsInDb = await this.sprintsRepository.sprintExists(sprint.id);
        
        if (existsInDb) {
          console.log(`[DatabaseFirst] Loading sprint ${sprint.name} from database`);
          const sprintFromDb = await this.loadSprintFromDatabase(sprint);
          
          if (sprintFromDb) {
            sprintsFromDatabase.push(sprintFromDb);
          } else {
            // Failed to load from database, fallback to API
            sprintsToLoadFromApi.push(sprint);
          }
        } else {
          console.log(`[DatabaseFirst] Sprint ${sprint.name} not found in database, will load from API`);
          sprintsToLoadFromApi.push(sprint);
        }
      } catch (error) {
        console.warn(`[DatabaseFirst] Error checking sprint ${sprint.id} in database:`, error);
        // On error, fallback to API loading
        sprintsToLoadFromApi.push(sprint);
      }
    }

    const databaseHitRate = sprints.length > 0 
      ? (sprintsFromDatabase.length / sprints.length) * 100 
      : 0;

    console.log(`[DatabaseFirst] Database hit rate: ${databaseHitRate.toFixed(1)}% (${sprintsFromDatabase.length}/${sprints.length})`);
    console.log(`[DatabaseFirst] Sprints to load from API: ${sprintsToLoadFromApi.length}`);

    return {
      sprintsFromDatabase,
      sprintsToLoadFromApi,
      databaseHitRate
    };
  }

  /**
   * Loads a single sprint from database with all related data
   * Following Clean Code: Single responsibility, null object pattern
   */
  private async loadSprintFromDatabase(sprint: JiraSprint): Promise<SprintFromDatabase | null> {
    try {
      // Load sprint data from database
      const persistedSprint = await this.sprintsRepository.getSprintById(sprint.id, true);
      
      if (!persistedSprint) {
        return null;
      }

      // Load issues if enabled
      let issues: readonly JiraIssueWithPoints[] = [];
      if (this.config.enableIssuesLoading) {
        try {
          issues = await this.issuesRepository.getSprintIssues(sprint.id);
          console.log(`[DatabaseFirst] Loaded ${issues.length} issues for sprint ${sprint.name} from database`);
        } catch (error) {
          console.warn(`[DatabaseFirst] Failed to load issues for sprint ${sprint.id}:`, error);
          // Continue without issues rather than failing completely
        }
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
        fromDatabase: true
      };

    } catch (error) {
      console.error(`[DatabaseFirst] Failed to load sprint ${sprint.id} from database:`, error);
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
    const pointsPerDay = sprintDurationDays > 0 ? completedPoints / sprintDurationDays : 0;

    return {
      sprint,
      committedPoints: velocityData?.committedPoints || 0,
      completedPoints,
      velocityPoints: completedPoints,
      completionRate: velocityData?.committedPoints
        ? (velocityData.completedPoints / velocityData.committedPoints) * 100
        : 0,
      issuesCount: velocityData?.issuesCount || sprintFromDb.issues.length,
      completedIssuesCount: velocityData?.completedIssuesCount || 0,
      averagePointsPerIssue: velocityData?.issuesCount
        ? velocityData.completedPoints / velocityData.issuesCount
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
