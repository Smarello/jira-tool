/**
 * Jira Sprints API wrapper
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraApiClient } from './api-client.js';
import type { JiraSprint } from './boards.js';
import { mapJiraSprint, mapSprintsArray } from './mappers.js';

/**
 * High-level API for Jira sprints operations
 * Following Clean Code: Single responsibility, dependency injection
 */
export class JiraSprintsApi {
  constructor(private readonly apiClient: JiraApiClient) {}

  /**
   * Fetches all sprints for a board
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchBoardSprints(boardId: string): Promise<readonly JiraSprint[]> {
    try {
      const endpoint = `/rest/agile/1.0/board/${boardId}/sprint`;
      const response = await this.apiClient.get(endpoint);
      // Jira returns sprints in a 'values' array
      const sprintsData = (response.data as any)?.values;
      
      if (!sprintsData) {
        return [];
      }
      
      return mapSprintsArray(sprintsData);
    } catch (error) {
      // Handle boards that don't support sprints (Kanban boards)
      if (error instanceof Error && error.message.includes('does not support sprints')) {
        console.info(`Board ${boardId} does not support sprints (likely Kanban)`);
        return [];
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Fetches details for a specific sprint
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchSprintDetails(sprintId: string): Promise<JiraSprint> {
    const endpoint = `/rest/agile/1.0/sprint/${sprintId}`;
    const response = await this.apiClient.get(endpoint);
    
    return mapJiraSprint(response.data as any);
  }



  /**
   * Filters sprints by state
   * Following Clean Code: Single responsibility, immutability
   */
  filterSprintsByState(
    sprints: readonly JiraSprint[], 
    state: 'active' | 'closed' | 'future'
  ): readonly JiraSprint[] {
    return sprints.filter(sprint => sprint.state === state);
  }

  /**
   * Filters sprints by origin board ID
   * Following Clean Code: Single responsibility, immutability
   */
  filterSprintsByBoard(
    sprints: readonly JiraSprint[], 
    boardId: string
  ): readonly JiraSprint[] {
    return sprints.filter(sprint => sprint.originBoardId === boardId);
  }

  /**
   * Gets most recent closed sprints
   * Following Clean Code: Express intent, immutability
   */
  getRecentClosedSprints(
    sprints: readonly JiraSprint[], 
    count = 5
  ): readonly JiraSprint[] {
    return sprints
      .filter(sprint => sprint.state === 'closed' && sprint.completeDate)
      .sort((a, b) => {
        const dateA = new Date(a.completeDate!);
        const dateB = new Date(b.completeDate!);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, count);
  }

  /**
   * Fetches sprints for a board using originBoardId filtering
   * Following Clean Code: Express intent, combining endpoint call with validation
   */
  async fetchBoardSprintsByOriginId(boardId: string): Promise<readonly JiraSprint[]> {
    try {
      // Use board-specific endpoint (most efficient)
      const boardSprints = await this.fetchBoardSprints(boardId);
      
      // Apply originBoardId filter as additional validation
      // This ensures data integrity and acts as a safeguard
      return this.filterSprintsByBoard(boardSprints, boardId);
    } catch (error) {
      // Handle error and provide context
      throw new Error(`Failed to fetch sprints for board ${boardId}: ${error}`);
    }
  }
}
