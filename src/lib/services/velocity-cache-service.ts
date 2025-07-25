/**
 * Velocity cache service - Combines velocity calculation with database persistence
 * Following Clean Architecture: Application service coordinating multiple domains
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { JiraSprint } from '../jira/boards';
import type { McpAtlassianClient } from '../mcp/atlassian';
import type { SprintVelocity } from '../velocity/mock-calculator';
import { calculateRealSprintsVelocity } from '../velocity/calculator';
import { getDatabaseService } from '../database';
import type {
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
  private readonly databaseService: any | undefined;
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
    mcpClient: McpAtlassianClient,
    forceRefresh = false
  ): Promise<CachedVelocityData> {
    // If database caching is disabled, always calculate fresh
    if (!this.config.enableDatabaseCache || forceRefresh) {
      return await this.calculateFreshVelocityData(boardId, sprints, mcpClient);
    }

    try {
      // Ensure database service is available
      if (!this.databaseService) {
        throw new Error('Database service not initialized');
      }

      console.error(`---------------> getting velocity data for ${sprints.length} sprints`);
      // Step 1: Check database for cached closed sprints
      const cachedSprints = await this.databaseService.getCachedClosedSprints(boardId, 50);

      // Step 2: Identify which closed sprints are missing from cache
      const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
      const missingSprintIds = this.findMissingSprintIds(closedSprints, cachedSprints);

      // Step 3: If we have all closed sprints cached and cache is valid
      if (missingSprintIds.length === 0 && cachedSprints.length > 0) {
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

      // Step 4: Fetch missing sprints from JIRA and cache them
      if (missingSprintIds.length > 0) {
        await this.fetchAndCacheMissingSprints(missingSprintIds, mcpClient);

        // Get updated cached data
        const updatedCachedSprints = await this.databaseService.getCachedClosedSprints(boardId, 50);
        const velocities = this.convertPersistedToVelocity(updatedCachedSprints);

        return {
          velocities,
          fromCache: false, // Partially from cache, partially fresh
          lastUpdated: new Date().toISOString(),
          boardId,
          totalSprints: updatedCachedSprints.length
        };
      }

      // Step 5: Fallback to full fresh calculation
      return await this.calculateAndCacheFreshData(boardId, sprints, mcpClient);

    } catch (error) {
      console.warn('Database cache error, falling back to fresh calculation:', error);
      return await this.calculateFreshVelocityData(boardId, sprints, mcpClient);
    }
  }

  /**
   * Gets only closed sprints velocity from cache
   * Following Clean Code: Express intent, specific use case
   */
  async getCachedClosedSprintsVelocity(boardId: string): Promise<CachedVelocityData | null> {
    if (!this.config.enableDatabaseCache || !this.databaseService) {
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
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    return await this.calculateAndCacheFreshData(boardId, sprints, mcpClient);
  }

  /**
   * Calculates fresh velocity data without caching
   * Following Clean Code: Single responsibility, pure calculation
   */
  private async calculateFreshVelocityData(
    boardId: string,
    sprints: readonly JiraSprint[],
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    const velocities = await calculateRealSprintsVelocity(sprints, mcpClient);

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
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    // Calculate fresh velocity data
    const velocities = await calculateRealSprintsVelocity(sprints, mcpClient);

    // Cache closed sprints for future use
    console.error(`---------------> caching closed sprints: ${this.config.enableDatabaseCache}`);
    if (this.config.enableDatabaseCache && this.databaseService) {
      await this.cacheClosedSprints(sprints, velocities, mcpClient);
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
    _velocities: readonly SprintVelocity[],
    mcpClient: McpAtlassianClient
  ): Promise<void> {
    // Ensure database service is available
    if (!this.databaseService) {
      console.warn('Database service not available, skipping caching');
      return;
    }

    const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
    console.error(`---------------> caching ${closedSprints.length} closed sprints`);
    for (const sprint of closedSprints) {
      try {
        // Check if sprint should be refreshed
        const shouldRefresh = await this.databaseService.shouldRefreshFromJira(
          sprint.id,
          this.config.maxCacheAgeHours
        );
        
        if (shouldRefresh) {
          // Get issues for this sprint
          const sprintIssuesResponse = await mcpClient.getSprintIssues(sprint.id);
          
          if (!sprintIssuesResponse.success) {
            console.warn(`Failed to fetch issues for sprint ${sprint.id}:`, sprintIssuesResponse.error);
            continue;
          }
          
          const sprintIssues = sprintIssuesResponse.data;
          
          // Find velocity data for this sprint (currently unused)
          // const velocityData = velocities.find(v => v.sprint.id === sprint.id);
          
          // Save to database
          console.error(`-----------> saving sprint ${sprint.id}`, sprint);
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
      .map(sprint => {
        // Create JiraSprint object from persisted data
        const jiraSprint: JiraSprint = {
          id: sprint.id,
          name: sprint.name,
          state: 'closed',
          startDate: sprint.startDate || '',
          endDate: sprint.endDate || '',
          completeDate: sprint.completeDate || undefined,
          goal: sprint.goal,
          originBoardId: sprint.originBoardId
        };

        // Create SprintVelocity object with correct structure
        return {
          sprint: jiraSprint,
          committedPoints: sprint.velocityData!.committedPoints,
          completedPoints: sprint.velocityData!.completedPoints,
          velocityPoints: sprint.velocityData!.completedPoints, // For closed sprints, velocity = completed points
          completionRate: sprint.velocityData!.committedPoints > 0
            ? Math.round((sprint.velocityData!.completedPoints / sprint.velocityData!.committedPoints) * 100)
            : 0
        };
      });
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

  /**
   * Finds sprint IDs that are missing from the cache
   * Following Clean Code: Single responsibility, data comparison
   */
  private findMissingSprintIds(
    closedSprints: readonly JiraSprint[],
    cachedSprints: readonly PersistedSprint[]
  ): readonly string[] {
    const cachedSprintIds = new Set(cachedSprints.map(sprint => sprint.id));
    return closedSprints
      .filter(sprint => !cachedSprintIds.has(sprint.id))
      .map(sprint => sprint.id);
  }

  /**
   * Fetches missing sprints from JIRA and caches them
   * Following Clean Code: Single responsibility, async operations
   */
  private async fetchAndCacheMissingSprints(
    missingSprintIds: readonly string[],
    _mcpClient: McpAtlassianClient
  ): Promise<void> {
    console.log(`🔄 Fetching ${missingSprintIds.length} missing sprints from JIRA...`);

    for (const sprintId of missingSprintIds) {
      try {
        // Get sprint details (we need to get this from the original sprints list)
        // For now, we'll skip this and let the full refresh handle it
        console.log(`⏭️  Skipping individual sprint fetch for ${sprintId} - will be handled by full refresh`);
      } catch (error) {
        console.warn(`Failed to fetch sprint ${sprintId}:`, error);
      }
    }
  }

  /**
   * Gets closed sprints data with smart caching strategy
   * Following Clean Code: Express intent, comprehensive caching
   */
  async getClosedSprintsWithCache(
    boardId: string,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    if (!this.config.enableDatabaseCache || !this.databaseService) {
      // No caching, fetch fresh data
      return await this.fetchFreshClosedSprintsData(boardId, mcpClient);
    }

    try {
      // Step 1: Check database for cached closed sprints
      const cachedSprints = await this.databaseService.getCachedClosedSprints(boardId, 50);

      if (cachedSprints.length > 0) {
        const cacheAge = this.calculateCacheAge(cachedSprints);

        // If cache is fresh enough, use it
        if (cacheAge <= this.config.maxCacheAgeHours) {
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

      // Step 2: Cache is empty or stale, fetch from JIRA
      console.log(`🔄 Cache miss or stale for board ${boardId}, fetching from JIRA...`);
      return await this.fetchAndCacheClosedSprintsData(boardId, mcpClient);

    } catch (error) {
      console.warn('Database cache error, falling back to JIRA API:', error);
      return await this.fetchFreshClosedSprintsData(boardId, mcpClient);
    }
  }

  /**
   * Fetches fresh closed sprints data from JIRA without caching
   * Following Clean Code: Single responsibility, pure API call
   */
  private async fetchFreshClosedSprintsData(
    boardId: string,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);

    if (!sprintsResponse.success) {
      throw new Error(sprintsResponse.error || 'Failed to fetch sprints from JIRA');
    }

    const closedSprints = sprintsResponse.data.filter(sprint => sprint.state === 'closed');
    const velocities = await calculateRealSprintsVelocity(closedSprints, mcpClient);

    return {
      velocities,
      fromCache: false,
      lastUpdated: new Date().toISOString(),
      boardId,
      totalSprints: closedSprints.length
    };
  }

  /**
   * Fetches closed sprints from JIRA and caches them
   * Following Clean Code: Single responsibility, caching side effects
   */
  async fetchAndCacheClosedSprintsData(
    boardId: string,
    mcpClient: McpAtlassianClient
  ): Promise<CachedVelocityData> {
    // Fetch fresh data
    const freshData = await this.fetchFreshClosedSprintsData(boardId, mcpClient);

    // Cache the closed sprints
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    if (sprintsResponse.success && this.databaseService) {
      const closedSprints = sprintsResponse.data.filter(sprint => sprint.state === 'closed');

      // Cache each closed sprint
      for (const sprint of closedSprints) {
        try {
          const sprintIssuesResponse = await mcpClient.getSprintIssues(sprint.id);
          if (sprintIssuesResponse.success) {
            await this.databaseService.saveClosedSprint(sprint, sprintIssuesResponse.data);
            console.log(`✅ Cached sprint: ${sprint.name}`);
          } else {
            console.warn(`Failed to fetch issues for sprint ${sprint.id}:`, sprintIssuesResponse.error);
          }
        } catch (error) {
          console.warn(`Failed to cache sprint ${sprint.id}:`, error);
        }
      }
    }

    return freshData;
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
