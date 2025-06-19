/**
 * Turso implementation of board configuration repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq, and, gte, desc } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { boardConfigurations } from '../schemas/turso-schema';
import type { IBoardConfigurationRepository, BoardConfiguration } from './interfaces';

/**
 * Turso-based implementation of board configuration repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoBoardConfigurationRepository implements IBoardConfigurationRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves board configuration
   * Following Clean Code: Command-Query Separation (command)
   */
  async saveBoardConfiguration(config: BoardConfiguration): Promise<void> {
    try {
      await this.db.insert(boardConfigurations).values({
        id: config.id,
        name: config.name,
        type: config.type,
        projectKey: config.projectKey || null,
        doneStatusIds: JSON.stringify(config.doneStatusIds),
        storyPointsField: config.storyPointsField || null,
        customFields: null, // Will be implemented when needed
        lastFetched: config.lastFetched || null,
        isActive: true,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: boardConfigurations.id,
        set: {
          name: config.name,
          type: config.type,
          projectKey: config.projectKey || null,
          doneStatusIds: JSON.stringify(config.doneStatusIds),
          storyPointsField: config.storyPointsField || null,
          lastFetched: config.lastFetched || null,
          updatedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      throw new Error(`Failed to save board configuration ${config.id}: ${error}`);
    }
  }

  /**
   * Gets board configuration by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  async getBoardConfiguration(boardId: string): Promise<BoardConfiguration | null> {
    try {
      const results = await this.db
        .select()
        .from(boardConfigurations)
        .where(eq(boardConfigurations.id, boardId))
        .limit(1);

      return results.length > 0 ? this.mapToBoardConfiguration(results[0]) : null;
    } catch (error) {
      throw new Error(`Failed to get board configuration: ${error}`);
    }
  }

  /**
   * Updates board configuration
   * Following Clean Code: Single responsibility
   */
  async updateBoardConfiguration(boardId: string, config: Partial<BoardConfiguration>): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (config.name !== undefined) updateData.name = config.name;
      if (config.type !== undefined) updateData.type = config.type;
      if (config.projectKey !== undefined) updateData.projectKey = config.projectKey;
      if (config.doneStatusIds !== undefined) updateData.doneStatusIds = JSON.stringify(config.doneStatusIds);
      if (config.storyPointsField !== undefined) updateData.storyPointsField = config.storyPointsField;
      if (config.lastFetched !== undefined) updateData.lastFetched = config.lastFetched;

      await this.db
        .update(boardConfigurations)
        .set(updateData)
        .where(eq(boardConfigurations.id, boardId));
    } catch (error) {
      throw new Error(`Failed to update board configuration: ${error}`);
    }
  }

  /**
   * Checks if board configuration is stale
   * Following Clean Code: Express intent, business logic
   */
  async isBoardConfigurationStale(boardId: string, maxAgeHours: number): Promise<boolean> {
    try {
      const config = await this.getBoardConfiguration(boardId);
      
      if (!config || !config.lastFetched) {
        return true; // No config or never fetched = stale
      }

      const lastFetchedTime = new Date(config.lastFetched).getTime();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const ageMs = Date.now() - lastFetchedTime;

      return ageMs > maxAgeMs;
    } catch (error) {
      throw new Error(`Failed to check board configuration staleness: ${error}`);
    }
  }

  /**
   * Maps Turso entity to domain object
   * Following Clean Code: Single responsibility, immutability
   */
  private mapToBoardConfiguration(entity: any): BoardConfiguration {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      projectKey: entity.projectKey,
      doneStatusIds: entity.doneStatusIds ? JSON.parse(entity.doneStatusIds) : [],
      storyPointsField: entity.storyPointsField,
      lastFetched: entity.lastFetched,
    };
  }
}
