/**
 * Turso implementation of board metrics repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { boardMetrics } from '../schemas/turso-schema';
import type { IBoardMetricsRepository, BoardMetrics } from './interfaces';

/**
 * Turso-based implementation of board metrics repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoBoardMetricsRepository implements IBoardMetricsRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves or updates board velocity metrics
   * Following Clean Code: Command-Query Separation (command)
   */
  async saveBoardMetrics(metrics: BoardMetrics): Promise<void> {
    try {
      await this.db.insert(boardMetrics).values({
        boardId: metrics.boardId,
        boardName: metrics.boardName,
        averageVelocity: metrics.averageVelocity,
        predictability: metrics.predictability,
        trend: metrics.trend,
        sprintsAnalyzed: metrics.sprintsAnalyzed,
        averageSprintCompletionRate: metrics.averageSprintCompletionRate,
        lastCalculated: metrics.lastCalculated,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: boardMetrics.boardId,
        set: {
          boardName: metrics.boardName,
          averageVelocity: metrics.averageVelocity,
          predictability: metrics.predictability,
          trend: metrics.trend,
          sprintsAnalyzed: metrics.sprintsAnalyzed,
          averageSprintCompletionRate: metrics.averageSprintCompletionRate,
          lastCalculated: metrics.lastCalculated,
          updatedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      throw new Error(`Failed to save board metrics for ${metrics.boardId}: ${error}`);
    }
  }

  /**
   * Gets board velocity metrics by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  async getBoardMetrics(boardId: string): Promise<BoardMetrics | null> {
    try {
      const results = await this.db
        .select()
        .from(boardMetrics)
        .where(eq(boardMetrics.boardId, boardId))
        .limit(1);

      return results.length > 0 ? this.mapToBoardMetrics(results[0]) : null;
    } catch (error) {
      throw new Error(`Failed to get board metrics for ${boardId}: ${error}`);
    }
  }

  /**
   * Deletes board metrics
   * Following Clean Code: Single responsibility
   */
  async deleteBoardMetrics(boardId: string): Promise<void> {
    try {
      await this.db
        .delete(boardMetrics)
        .where(eq(boardMetrics.boardId, boardId));
    } catch (error) {
      throw new Error(`Failed to delete board metrics for ${boardId}: ${error}`);
    }
  }

  /**
   * Lists all board metrics
   * Following Clean Code: Express intent
   */
  async listAllBoardMetrics(): Promise<readonly BoardMetrics[]> {
    try {
      const results = await this.db
        .select()
        .from(boardMetrics);

      return results.map(row => this.mapToBoardMetrics(row));
    } catch (error) {
      throw new Error(`Failed to list board metrics: ${error}`);
    }
  }

  /**
   * Gets all board metrics for aggregation
   * Following Clean Code: Command-Query Separation (query), dashboard aggregation
   */
  async getAllBoardMetrics(): Promise<BoardMetrics[]> {
    try {
      const results = await this.db
        .select()
        .from(boardMetrics)
        .orderBy(boardMetrics.lastCalculated);

      return results.map(row => this.mapToBoardMetrics(row));
    } catch (error) {
      throw new Error(`Failed to get all board metrics for aggregation: ${error}`);
    }
  }

  /**
   * Maps database row to BoardMetrics domain object
   * Following Clean Code: Single responsibility, data transformation
   */
  private mapToBoardMetrics(row: any): BoardMetrics {
    return {
      boardId: row.boardId,
      boardName: row.boardName,
      averageVelocity: row.averageVelocity,
      predictability: row.predictability,
      trend: row.trend,
      sprintsAnalyzed: row.sprintsAnalyzed,
      averageSprintCompletionRate: row.averageSprintCompletionRate || 0,
      lastCalculated: row.lastCalculated,
    };
  }
}
