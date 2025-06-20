/**
 * Database integration service for the main application
 * Following Clean Architecture: Application layer integration
 * Following Clean Code: Facade pattern, dependency injection
 */

import type { JiraSprint } from '../jira/boards';
import type { JiraIssueWithPoints } from '../jira/issues-api';
import { getRepositoryFactory, initializeRepositoryFactory } from './repository-factory';
import {
  SprintPersistenceService,
  type SprintPersistenceConfig
} from './services/sprint-persistence-service';

/**
 * Database integration service for the main application
 * Following Clean Code: Facade pattern, single responsibility
 */
export class DatabaseIntegrationService {
  private readonly persistenceService: SprintPersistenceService;

  constructor(config?: Partial<SprintPersistenceConfig>) {
    // Get repository factory (configured via environment)
    const repositoryFactory = getRepositoryFactory();
    
    // Create repositories
    const sprintsRepo = repositoryFactory.createClosedSprintsRepository();
    const issuesRepo = repositoryFactory.createSprintIssuesRepository();

    // Default configuration
    const defaultConfig: SprintPersistenceConfig = {
      enableIssuesStorage: true,
      enableMetricsCalculation: true,
      retentionDays: 365,
      batchSize: 10
    };

    // Create persistence service
    this.persistenceService = new SprintPersistenceService(
      sprintsRepo,
      issuesRepo,
      { ...defaultConfig, ...config }
    );
  }

  /**
   * Saves a closed sprint to database
   * Following Clean Code: Express intent, error handling
   */
  async saveClosedSprint(
    sprint: JiraSprint,
    issues: readonly JiraIssueWithPoints[] = []
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const result = await this.persistenceService.persistClosedSprint(sprint, issues);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Saves multiple closed sprints to database in batch
   * Following Clean Code: Express intent, batch operations
   */
  async saveClosedSprintsBatch(
    sprintsWithIssues: readonly { sprint: JiraSprint; issues: readonly JiraIssueWithPoints[] }[],
    velocityDataMap?: Map<string, any>
  ): Promise<{ success: boolean; successful: number; failed: number; error?: string }> {
    try {
      const result = await this.persistenceService.persistClosedSprintsBatch(
        sprintsWithIssues,
        velocityDataMap
      );
      return {
        success: result.failed === 0,
        successful: result.successful,
        failed: result.failed,
        error: result.failed > 0 ? result.errors.join('; ') : undefined
      };
    } catch (error) {
      return {
        success: false,
        successful: 0,
        failed: sprintsWithIssues.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets cached closed sprints for a board
   * Following Clean Code: Express intent, caching strategy
   */
  async getCachedClosedSprints(boardId: string, limit = 10) {
    return await this.persistenceService.getRecentClosedSprints(boardId, limit);
  }

  /**
   * Checks if sprint data should be refreshed from JIRA API
   * Following Clean Code: Express intent, cache invalidation
   */
  async shouldRefreshFromJira(sprintId: string, maxAgeHours = 24): Promise<boolean> {
    return await this.persistenceService.shouldRefreshSprintData(sprintId, maxAgeHours);
  }

  /**
   * Performs database cleanup
   * Following Clean Code: Express intent, maintenance
   */
  async performMaintenance() {
    return await this.persistenceService.performCleanup();
  }
}

/**
 * Singleton instance for application use
 * Following Clean Code: Singleton pattern
 */
let databaseService: DatabaseIntegrationService | null = null;

/**
 * Gets database integration service instance
 * Following Clean Code: Singleton access
 */
export function getDatabaseService(config?: Partial<SprintPersistenceConfig>): DatabaseIntegrationService {
  if (!databaseService) {
    databaseService = new DatabaseIntegrationService(config);
  }
  return databaseService;
}

/**
 * Initializes database integration service with async setup
 * Following Clean Code: Async initialization
 */
export async function initializeDatabaseService(config?: Partial<SprintPersistenceConfig>): Promise<DatabaseIntegrationService> {
  // Initialize repository factory first
  await initializeRepositoryFactory();

  // Create new service instance
  databaseService = new DatabaseIntegrationService(config);

  return databaseService;
}

/**
 * Resets database service (for testing)
 * Following Clean Code: Test isolation
 */
export function resetDatabaseService(): void {
  databaseService = null;
}
