/**
 * Velocity cache service - Combines velocity calculation with database persistence
 * Following Clean Architecture: Application service coordinating multiple domains
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../jira/boards';
import type { JiraIssuesApi } from '../jira/issues-api';
import type { McpAtlassianClient } from '../mcp/atlassian';
import type { SprintVelocity } from '../velocity/mock-calculator';
import { calculateRealSprintsVelocity } from '../velocity/calculator';
import { getDatabaseService } from '../database';
import type { 
  SprintVelocityData, 
  PersistedSprint,
  SprintPersistenceConfig 
} from '../database';

/**
 * Velocity cache configuration
 * Following Clean Code: Configuration object pattern
 */
export interface VelocityCacheConfig {
  readonly enableDatabaseCache: boolean;
  readonly maxCacheAgeHours: number;
  readonly enableIssuesStorage: boolean;
  readonly enableMetricsCalculation: boolean;
  readonly retentionDays: number;
}

/**
 * Velocity data with cache metadata
 * Following Clean Code: Express intent, metadata inclusion
 */
export interface CachedVelocityData {
  readonly velocities: readonly SprintVelocity[];
  readonly fromCache: boolean;
  readonly cacheAge?: number; // hours
  readonly lastUpdated: string;
  readonly boardId: string;
  readonly totalSprints: number;
}

/**
 * Velocity cache service
 * Following Clean Architecture: Application service in application layer
 */
export class VelocityCacheService {
  private readonly databaseService;
  private readonly config: VelocityCacheConfig;

  constructor(config?: Partial<VelocityCacheConfig>) {
    // Default configuration
    const defaultConfig: VelocityCacheConfig = {
      enableDatabaseCache: true,
      maxCacheAgeHours: 24,
      enableIssuesStorage: true,
      enableMetricsCalculation: true,
      retentionDays: 365
    };

    this.config = { ...defaultConfig, ...config };

    // Initialize database service if caching is enabled
    if (this.config.enableDatabaseCache) {
      const dbConfig: Partial<SprintPersistenceConfig> = {
        enableIssuesStorage: this.config.enableIssuesStorage,
        enableMetricsCalculation: this.config.enableMetricsCalculation,
        retentionDays: this.config.retentionDays,
        batchSize: 10
      };
      
      this.databaseService = getDatabaseService(dbConfig);
    }
  }

  /**
   * Gets velocity data with intelligent caching
   * Following Clean Code: Express intent, caching strategy
   */
  async getVelocityData(
    boardId: string,
    sprints: readonly JiraSprint[],
    issuesApi: JiraIssuesApi,
    mcpClient: McpAtlassianClient,
    forceRefresh = false
  ): Promise<CachedVelocityData> {
    // If database caching is disabled, always calculate fresh
    if (!this.config.enableDatabaseCache || forceRefresh) {
      return await this.calculateFreshVelocityData(boardId, sprints, issuesApi, mcpClient);
    }

    try {
      // Try to get cached closed sprints from database
      const cachedSprints = await this.databaseService.getCachedClosedSprints(boardId, 50);
      
      if (cachedSprints.length > 0) {
        // Check if cache is still valid
        const cacheAge = this.calculateCacheAge(cachedSprints);
        
        if (cacheAge <= this.config.maxCacheAgeHours) {
          // Use cached data
          const velocities = this.convertPersistedToVelocity(cachedSprints);
          
          return {
            velocities,
            fromCache: true,
            cacheAge,
            lastUpdated: this.getLatestUpdateTime(cachedSprints),
            boardId,
            totalSprints: cachedSprints.length
          };
        }
      }

      // Cache is stale or empty, calculate fresh data
      return await this.calculateAndCacheFreshData(boardId, sprints, issuesApi, mcpClient);

    } catch (error) {
      console.warn('Database cache error, falling back to fresh calculation:', error);
      return await this.calculateFreshVelocityData(boardId, sprints, issuesApi, mcpClient);
    }
  }

  /**
   * Gets only closed sprints velocity from cache
   * Following Clean Code: Express intent, specific use case
   */
  async getCachedClosedSprintsVelocity(boardId: string): Promise<CachedVelocityData | null> {
    if (!this.config.enableDatabaseCache) {
      return null;
    }

    try {
      const cachedSprints = await this.databaseService.getCachedClosedSprints(boardId, 50);
      
      if (cachedSprints.length === 0) {
        return null;
      }

      const velocities = this.convertPersistedToVelocity(cachedSprints);
      const cacheAge = this.calculateCacheAge(cachedSprints);

      return {
        velocities,
        fromCache: true,
        cacheAge,
        lastUpdated: this.getLatestUpdateTime(cachedSprints),
        boardId,
        totalSprints: cachedSprints.length
      };

    } catch (error) {
      console.warn('Failed to get cached velocity data:', error);
      return null;
    }
  }

  /**
   * Forces refresh of velocity data and updates cache
   * Following Clean Code: Express intent, cache invalidation
   */
  async refreshVelocityData(
    boardId: string,
    sprints: readonly JiraSprint[],
    issuesApi: JiraIssuesApi,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    return await this.calculateAndCacheFreshData(boardId, sprints, issuesApi, mcpClient);
  }

  /**
   * Calculates fresh velocity data without caching
   * Following Clean Code: Single responsibility, pure calculation
   */
  private async calculateFreshVelocityData(
    boardId: string,
    sprints: readonly JiraSprint[],
    issuesApi: JiraIssuesApi,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    const velocities = await calculateRealSprintsVelocity(sprints, issuesApi, mcpClient);

    return {
      velocities,
      fromCache: false,
      lastUpdated: new Date().toISOString(),
      boardId,
      totalSprints: sprints.length
    };
  }

  /**
   * Calculates fresh data and updates cache
   * Following Clean Code: Single responsibility, side effects clearly named
   */
  private async calculateAndCacheFreshData(
    boardId: string,
    sprints: readonly JiraSprint[],
    issuesApi: JiraIssuesApi,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    // Calculate fresh velocity data
    const velocities = await calculateRealSprintsVelocity(sprints, issuesApi, mcpClient);

    // Cache closed sprints for future use
    if (this.config.enableDatabaseCache) {
      await this.cacheClosedSprints(sprints, velocities, issuesApi);
    }

    return {
      velocities,
      fromCache: false,
      lastUpdated: new Date().toISOString(),
      boardId,
      totalSprints: sprints.length
    };
  }

  /**
   * Caches closed sprints with their velocity data
   * Following Clean Code: Single responsibility, async operations
   */
  private async cacheClosedSprints(
    sprints: readonly JiraSprint[],
    velocities: readonly SprintVelocity[],
    issuesApi: JiraIssuesApi
  ): Promise<void> {
    const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
    
    for (const sprint of closedSprints) {
      try {
        // Check if sprint should be refreshed
        const shouldRefresh = await this.databaseService.shouldRefreshFromJira(
          sprint.id, 
          this.config.maxCacheAgeHours
        );
        
        if (shouldRefresh) {
          // Get issues for this sprint
          const sprintIssues = await issuesApi.fetchSprintIssues(sprint.id);
          
          // Find velocity data for this sprint
          const velocityData = velocities.find(v => v.sprintId === sprint.id);
          
          // Save to database
          const result = await this.databaseService.saveClosedSprint(sprint, sprintIssues);
          
          if (!result.success) {
            console.warn(`Failed to cache sprint ${sprint.id}:`, result.error);
          }
        }
      } catch (error) {
        console.warn(`Error caching sprint ${sprint.id}:`, error);
      }
    }
  }

  /**
   * Converts persisted sprints to velocity data
   * Following Clean Code: Single responsibility, data transformation
   */
  private convertPersistedToVelocity(persistedSprints: readonly PersistedSprint[]): readonly SprintVelocity[] {
    return persistedSprints
      .filter(sprint => sprint.velocityData)
      .map(sprint => ({
        sprintId: sprint.id,
        sprintName: sprint.name,
        boardId: sprint.boardId,
        committedPoints: sprint.velocityData!.committedPoints,
        completedPoints: sprint.velocityData!.completedPoints,
        velocityPercentage: (sprint.velocityData!.completedPoints / sprint.velocityData!.committedPoints) * 100,
        startDate: sprint.startDate || '',
        endDate: sprint.endDate || '',
        completeDate: sprint.completeDate || '',
        goal: sprint.goal || ''
      }));
  }

  /**
   * Calculates cache age in hours
   * Following Clean Code: Single responsibility, time calculation
   */
  private calculateCacheAge(persistedSprints: readonly PersistedSprint[]): number {
    if (persistedSprints.length === 0) return Infinity;
    
    const latestUpdate = Math.max(
      ...persistedSprints.map(sprint => new Date(sprint.updatedAt).getTime())
    );
    
    return (Date.now() - latestUpdate) / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Gets latest update time from persisted sprints
   * Following Clean Code: Single responsibility, data extraction
   */
  private getLatestUpdateTime(persistedSprints: readonly PersistedSprint[]): string {
    if (persistedSprints.length === 0) return new Date().toISOString();
    
    const latestUpdate = Math.max(
      ...persistedSprints.map(sprint => new Date(sprint.updatedAt).getTime())
    );
    
    return new Date(latestUpdate).toISOString();
  }
}

/**
 * Singleton instance for application use
 * Following Clean Code: Singleton pattern
 */
let velocityCacheService: VelocityCacheService | null = null;

/**
 * Gets velocity cache service instance
 * Following Clean Code: Singleton access
 */
export function getVelocityCacheService(config?: Partial<VelocityCacheConfig>): VelocityCacheService {
  if (!velocityCacheService) {
    velocityCacheService = new VelocityCacheService(config);
  }
  return velocityCacheService;
}

/**
 * Resets velocity cache service (for testing)
 * Following Clean Code: Test isolation
 */
export function resetVelocityCacheService(): void {
  velocityCacheService = null;
}
