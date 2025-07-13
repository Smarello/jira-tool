/**
 * Turso implementation of Kanban Issues repository
 * Following Clean Architecture: Infrastructure layer implementation
 * Following Clean Code: Single responsibility, dependency injection
 */

import { eq, and, inArray, gte, lte, desc, count, sql } from 'drizzle-orm';
import type { DatabaseConnection } from '../connection-factory';
import { kanbanIssues } from '../schemas/turso-schema';
import type { 
  KanbanIssueRepository
} from './interfaces';
import type { 
  KanbanIssueEntity, 
  NewKanbanIssueEntity 
} from '../schemas/kanban';

/**
 * Turso-based implementation of Kanban issues repository
 * Following Clean Architecture: Concrete implementation in infrastructure layer
 */
export class TursoKanbanIssueRepository implements KanbanIssueRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /**
   * Saves a single Kanban issue
   * Following Clean Code: Command-Query Separation (command)
   */
  async saveIssue(issue: NewKanbanIssueEntity): Promise<KanbanIssueEntity> {
    const now = new Date().toISOString();
    
    const issueToInsert = {
      id: issue.id,
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      assignee: issue.assignee || null,
      boardId: issue.boardId,
      boardName: issue.boardName,
      boardEntryDate: issue.boardEntryDate || null,
      lastDoneDate: issue.lastDoneDate || null,
      cycleTimeDays: issue.cycleTimeDays || null,
      created: issue.created,
      resolved: issue.resolved || null,
      isReopened: issue.isReopened || false,
      excludeFromMetrics: issue.excludeFromMetrics || false,
      createdAt: issue.createdAt || now,
      updatedAt: issue.updatedAt || now,
    };

    const result = await this.db
      .insert(kanbanIssues)
      .values(issueToInsert)
      .returning();

    if (!result[0]) {
      throw new Error(`Failed to save Kanban issue: ${issue.key}`);
    }

    return this.mapToEntity(result[0]);
  }

  /**
   * Saves multiple Kanban issues in batch
   * Following Clean Code: Performance optimization for large datasets
   */
  async saveIssuesBatch(issues: readonly NewKanbanIssueEntity[]): Promise<readonly KanbanIssueEntity[]> {
    if (issues.length === 0) return [];

    const now = new Date().toISOString();
    
    const issuesToInsert = issues.map(issue => ({
      id: issue.id,
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      assignee: issue.assignee || null,
      boardId: issue.boardId,
      boardName: issue.boardName,
      boardEntryDate: issue.boardEntryDate || null,
      lastDoneDate: issue.lastDoneDate || null,
      cycleTimeDays: issue.cycleTimeDays || null,
      created: issue.created,
      resolved: issue.resolved || null,
      isReopened: issue.isReopened || false,
      excludeFromMetrics: issue.excludeFromMetrics || false,
      createdAt: issue.createdAt || now,
      updatedAt: issue.updatedAt || now,
    }));

    try {
      const result = await this.db
        .insert(kanbanIssues)
        .values(issuesToInsert)
        .returning();

      return result.map(this.mapToEntity);
    } catch (error) {
      console.error('Failed to save Kanban issues batch:', error);
      throw new Error(`Failed to save ${issues.length} Kanban issues in batch`);
    }
  }

  /**
   * Gets Kanban issue by ID
   * Following Clean Code: Command-Query Separation (query)
   */
  async getIssueById(issueId: string): Promise<KanbanIssueEntity | null> {
    const result = await this.db
      .select()
      .from(kanbanIssues)
      .where(eq(kanbanIssues.id, issueId))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Gets Kanban issue by key
   * Following Clean Code: Express intent, common query pattern
   */
  async getIssueByKey(issueKey: string): Promise<KanbanIssueEntity | null> {
    const result = await this.db
      .select()
      .from(kanbanIssues)
      .where(eq(kanbanIssues.key, issueKey))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Gets all issues for a specific board
   * Following Clean Code: Express intent, board-specific queries
   */
  async getIssuesByBoardId(boardId: string): Promise<readonly KanbanIssueEntity[]> {
    const result = await this.db
      .select()
      .from(kanbanIssues)
      .where(eq(kanbanIssues.boardId, boardId))
      .orderBy(desc(kanbanIssues.lastDoneDate), desc(kanbanIssues.updatedAt));

    return result.map(this.mapToEntity);
  }

  /**
   * Gets completed issues for cycle time analysis
   * Following Clean Code: Express intent, filtering for metrics calculation
   */
  async getCompletedIssues(boardId: string, excludeReopened: boolean = true): Promise<readonly KanbanIssueEntity[]> {
    const conditions = [
      eq(kanbanIssues.boardId, boardId),
      sql`${kanbanIssues.lastDoneDate} IS NOT NULL`,
      sql`${kanbanIssues.cycleTimeDays} IS NOT NULL`
    ];

    if (excludeReopened) {
      conditions.push(eq(kanbanIssues.excludeFromMetrics, false));
    }

    const result = await this.db
      .select()
      .from(kanbanIssues)
      .where(and(...conditions))
      .orderBy(desc(kanbanIssues.lastDoneDate));

    return result.map(this.mapToEntity);
  }

  /**
   * Gets issues filtered by type and date range
   * Following Clean Code: Express intent, advanced filtering for analytics
   */
  async getIssuesFiltered(
    boardId: string, 
    options?: {
      issueTypes?: readonly string[];
      startDate?: string;
      endDate?: string;
      excludeReopened?: boolean;
    }
  ): Promise<readonly KanbanIssueEntity[]> {
    const conditions = [eq(kanbanIssues.boardId, boardId)];

    if (options?.issueTypes && options.issueTypes.length > 0) {
      conditions.push(inArray(kanbanIssues.issueType, options.issueTypes as string[]));
    }

    if (options?.startDate) {
      conditions.push(gte(kanbanIssues.lastDoneDate, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(kanbanIssues.lastDoneDate, options.endDate));
    }

    if (options?.excludeReopened !== false) {
      conditions.push(eq(kanbanIssues.excludeFromMetrics, false));
    }

    const result = await this.db
      .select()
      .from(kanbanIssues)
      .where(and(...conditions))
      .orderBy(desc(kanbanIssues.lastDoneDate));

    return result.map(this.mapToEntity);
  }

  /**
   * Updates issue cycle time data
   * Following Clean Code: Single responsibility, specific update operation
   */
  async updateIssueCycleTime(
    issueId: string, 
    cycleTimeData: {
      boardEntryDate?: string | null;
      lastDoneDate?: string | null;
      cycleTimeDays?: number | null;
      isReopened?: boolean;
      excludeFromMetrics?: boolean;
    }
  ): Promise<KanbanIssueEntity | null> {
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (cycleTimeData.boardEntryDate !== undefined) {
      updates.boardEntryDate = cycleTimeData.boardEntryDate;
    }
    if (cycleTimeData.lastDoneDate !== undefined) {
      updates.lastDoneDate = cycleTimeData.lastDoneDate;
    }
    if (cycleTimeData.cycleTimeDays !== undefined) {
      updates.cycleTimeDays = cycleTimeData.cycleTimeDays;
    }
    if (cycleTimeData.isReopened !== undefined) {
      updates.isReopened = cycleTimeData.isReopened;
    }
    if (cycleTimeData.excludeFromMetrics !== undefined) {
      updates.excludeFromMetrics = cycleTimeData.excludeFromMetrics;
    }

    const result = await this.db
      .update(kanbanIssues)
      .set(updates)
      .where(eq(kanbanIssues.id, issueId))
      .returning();

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Deletes issue by ID
   * Following Clean Code: Single responsibility
   */
  async deleteIssue(issueId: string): Promise<void> {
    await this.db
      .delete(kanbanIssues)
      .where(eq(kanbanIssues.id, issueId));
  }

  /**
   * Deletes all issues for a board
   * Following Clean Code: Bulk operation for cleanup
   */
  async deleteIssuesByBoardId(boardId: string): Promise<void> {
    await this.db
      .delete(kanbanIssues)
      .where(eq(kanbanIssues.boardId, boardId));
  }

  /**
   * Maps database result to domain entity
   * Following Clean Code: Single responsibility, data transformation
   */
  private mapToEntity(dbResult: any): KanbanIssueEntity {
    return {
      id: dbResult.id,
      key: dbResult.key,
      summary: dbResult.summary,
      issueType: dbResult.issueType,
      status: dbResult.status,
      assignee: dbResult.assignee,
      boardId: dbResult.boardId,
      boardName: dbResult.boardName,
      boardEntryDate: dbResult.boardEntryDate,
      lastDoneDate: dbResult.lastDoneDate,
      cycleTimeDays: dbResult.cycleTimeDays,
      created: dbResult.created,
      resolved: dbResult.resolved,
      isReopened: dbResult.isReopened,
      excludeFromMetrics: dbResult.excludeFromMetrics,
      createdAt: dbResult.createdAt,
      updatedAt: dbResult.updatedAt,
    };
  }
}
