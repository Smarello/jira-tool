/**
 * Jira Boards API wrapper
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraApiClient } from './api-client.js';
import type { JiraBoard } from './boards.js';
import { mapJiraBoard, mapBoardsArray } from './mappers.js';

/**
 * Board column configuration
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface BoardColumn {
  readonly name: string;
  readonly statuses: readonly BoardColumnStatus[];
}

export interface BoardColumnStatus {
  readonly id: string;
  readonly name: string;
}

export interface BoardConfiguration {
  readonly boardId: string;
  readonly columns: readonly BoardColumn[];
}

/**
 * High-level API for Jira boards operations
 * Following Clean Code: Single responsibility, dependency injection
 */
export class JiraBoardsApi {
  constructor(private readonly apiClient: JiraApiClient) {}

  /**
   * Fetches all boards for a project
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchProjectBoards(projectKey: string): Promise<readonly JiraBoard[]> {
    const endpoint = `/rest/agile/1.0/board?projectKeyOrId=${projectKey}`;
    const response = await this.apiClient.get(endpoint);
    
    // Jira returns boards in a 'values' array
    const boardsData = (response.data as any)?.values;
    
    if (!boardsData) {
      return [];
    }
    
    return mapBoardsArray(boardsData);
  }

  /**
   * Fetches details for a specific board
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchBoardDetails(boardId: string): Promise<JiraBoard> {
    const endpoint = `/rest/agile/1.0/board/${boardId}`;
    const response = await this.apiClient.get(endpoint);
    
    return mapJiraBoard(response.data as any);
  }

  /**
   * Filters boards by project key
   * Following Clean Code: Single responsibility, immutability
   */
  filterBoardsByProject(
    boards: readonly JiraBoard[], 
    projectKey: string
  ): readonly JiraBoard[] {
    return boards.filter(board => 
      board.projectKey === projectKey || 
      board.location?.projectKey === projectKey
    );
  }

  /**
   * Fetches board configuration including column mappings
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchBoardConfiguration(boardId: string): Promise<BoardConfiguration> {
    const endpoint = `/rest/agile/1.0/board/${boardId}/configuration`;
    const response = await this.apiClient.get(endpoint);
    
    const data = response.data as any;
    const columnConfig = data?.columnConfig;
    
    if (!columnConfig || !columnConfig.columns) {
      throw new Error(`Board ${boardId} configuration not found or invalid`);
    }

    const columns: BoardColumn[] = columnConfig.columns.map((column: any) => ({
      name: column.name,
      statuses: (column.statuses || []).map((status: any) => ({
        id: status.id,
        name: status.name
      }))
    }));

    return {
      boardId,
      columns
    };
  }

  /**
   * Gets status IDs that are mapped to the last column (completion column)
   * Following Clean Code: Express intent, single responsibility
   * Note: Uses last column instead of searching for "Done" name for better accuracy
   */
  async getDoneColumnStatusIds(boardId: string): Promise<readonly string[]> {
    const config = await this.fetchBoardConfiguration(boardId);
    
    if (config.columns.length === 0) {
      return [];
    }
    
    // Get the last column (rightmost) which represents completion
    const lastColumn = config.columns[config.columns.length - 1];
    
    console.log(`[BoardsApi] Board ${boardId} last column: "${lastColumn.name}" with ${lastColumn.statuses.length} statuses`);
    
    return lastColumn.statuses.map(status => status.id);
  }

  /**
   * Gets status IDs that are mapped to the first work column (To Do column)
   * Following Clean Code: Express intent, single responsibility
   * Note: Excludes "Backlog" column - if first column is "Backlog", uses second column instead
   */
  async getToDoColumnStatusIds(boardId: string): Promise<readonly string[]> {
    const config = await this.fetchBoardConfiguration(boardId);
    
    if (config.columns.length === 0) {
      return [];
    }
    
    // Check if first column is "Backlog" (case-insensitive)
    const firstColumn = config.columns[0];
    const isFirstColumnBacklog = firstColumn.name.toLowerCase() == 'backlog';
    
    let targetColumn: BoardColumn;
    
    if (isFirstColumnBacklog) {
      // If first column is Backlog, use second column
      if (config.columns.length < 2) {
        console.warn(`[BoardsApi] Board ${boardId} has only Backlog column, no work columns available`);
        return [];
      }
      targetColumn = config.columns[1];
      console.log(`[BoardsApi] Board ${boardId} skipping Backlog column, using second column: "${targetColumn.name}" with ${targetColumn.statuses.length} statuses`);
    } else {
      // Use first column as it's not Backlog
      targetColumn = firstColumn;
      console.log(`[BoardsApi] Board ${boardId} using first column: "${targetColumn.name}" with ${targetColumn.statuses.length} statuses`);
    }
    
    return targetColumn.statuses.map(status => status.id);
  }

  /**
   * Gets status names that are mapped to the last column (completion column)
   * Following Clean Code: Express intent, single responsibility
   * @deprecated Use getDoneColumnStatusIds instead for better reliability
   * Note: Uses last column instead of searching for "Done" name for better accuracy
   */
  async getDoneColumnStatusNames(boardId: string): Promise<readonly string[]> {
    const config = await this.fetchBoardConfiguration(boardId);
    
    if (config.columns.length === 0) {
      return [];
    }
    
    // Get the last column (rightmost) which represents completion
    const lastColumn = config.columns[config.columns.length - 1];
    
    return lastColumn.statuses.map(status => status.name);
  }

  // ...existing code...
}
