/**
 * Turso implementation of Kanban Board Configuration repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { kanbanBoardConfigs } from '../schemas/turso-schema';
import type { 
  KanbanBoardConfigRepository
} from './interfaces';
import type { 
  KanbanBoardConfigEntity, 
  NewKanbanBoardConfigEntity 
} from '../schemas/kanban';

/**
 * Turso-based implementation of Kanban board configuration repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoKanbanBoardConfigRepository implements KanbanBoardConfigRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves board configuration
   * Following Clean Code: Command-Query Separation (command)
   */
  async saveBoardConfig(config: NewKanbanBoardConfigEntity): Promise<KanbanBoardConfigEntity> {
    const now = new Date().toISOString();
    
    const configToInsert = {
      boardId: config.boardId,
      boardName: config.boardName,
      projectKey: config.projectKey,
      columnMappings: config.columnMappings,
      doneColumns: config.doneColumns,
      createdAt: config.createdAt || now,
      updatedAt: config.updatedAt || now,
    };

    const result = await this.db
      .insert(kanbanBoardConfigs)
      .values(configToInsert)
      .onConflictDoUpdate({
        target: kanbanBoardConfigs.boardId,
        set: {
          boardName: configToInsert.boardName,
          projectKey: configToInsert.projectKey,
          columnMappings: configToInsert.columnMappings,
          doneColumns: configToInsert.doneColumns,
          updatedAt: now,
        }
      })
      .returning();

    if (!result[0]) {
      throw new Error(`Failed to save board configuration: ${config.boardId}`);
    }

    return this.mapToEntity(result[0]);
  }

  /**
   * Gets board configuration by board ID
   * Following Clean Code: Command-Query Separation (query)
   */
  async getBoardConfig(boardId: string): Promise<KanbanBoardConfigEntity | null> {
    const result = await this.db
      .select()
      .from(kanbanBoardConfigs)
      .where(eq(kanbanBoardConfigs.boardId, boardId))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Updates board configuration
   * Following Clean Code: Express intent, configuration updates
   */
  async updateBoardConfig(
    boardId: string,
    updates: Partial<Omit<NewKanbanBoardConfigEntity, 'boardId'>>
  ): Promise<KanbanBoardConfigEntity | null> {
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (updates.boardName !== undefined) {
      updateData.boardName = updates.boardName;
    }
    if (updates.projectKey !== undefined) {
      updateData.projectKey = updates.projectKey;
    }
    if (updates.columnMappings !== undefined) {
      updateData.columnMappings = updates.columnMappings;
    }
    if (updates.doneColumns !== undefined) {
      updateData.doneColumns = updates.doneColumns;
    }

    const result = await this.db
      .update(kanbanBoardConfigs)
      .set(updateData)
      .where(eq(kanbanBoardConfigs.boardId, boardId))
      .returning();

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Gets all board configurations
   * Following Clean Code: Express intent, list all configurations
   */
  async getAllBoardConfigs(): Promise<readonly KanbanBoardConfigEntity[]> {
    const result = await this.db
      .select()
      .from(kanbanBoardConfigs)
      .orderBy(kanbanBoardConfigs.boardName);

    return result.map(this.mapToEntity);
  }

  /**
   * Gets board configurations by project key
   * Following Clean Code: Express intent, project-specific queries
   */
  async getBoardConfigsByProject(projectKey: string): Promise<readonly KanbanBoardConfigEntity[]> {
    const result = await this.db
      .select()
      .from(kanbanBoardConfigs)
      .where(eq(kanbanBoardConfigs.projectKey, projectKey))
      .orderBy(kanbanBoardConfigs.boardName);

    return result.map(this.mapToEntity);
  }

  /**
   * Deletes board configuration
   * Following Clean Code: Single responsibility
   */
  async deleteBoardConfig(boardId: string): Promise<void> {
    await this.db
      .delete(kanbanBoardConfigs)
      .where(eq(kanbanBoardConfigs.boardId, boardId));
  }

  /**
   * Maps database result to domain entity
   * Following Clean Code: Single responsibility, data transformation
   */
  private mapToEntity(dbResult: any): KanbanBoardConfigEntity {
    return {
      boardId: dbResult.boardId,
      boardName: dbResult.boardName,
      projectKey: dbResult.projectKey,
      columnMappings: dbResult.columnMappings,
      doneColumns: dbResult.doneColumns,
      createdAt: dbResult.createdAt,
      updatedAt: dbResult.updatedAt,
    };
  }
}
