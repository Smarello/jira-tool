/**
 * Board operations client for Jira integration
 * Following Clean Code: Single Responsibility, Express Intent
 */

import type { JiraApiResponse } from './types';
import { getCachedData, setCachedData } from '../utils/cache';
import { getMcpAtlassianClient } from '../mcp/atlassian';

/**
 * Jira Board representation
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface JiraBoard {
  readonly id: string;
  readonly name: string;
  readonly type: 'scrum' | 'kanban' | 'simple';
  readonly projectKey: string;
  readonly projectName: string;
  readonly location: BoardLocation;
}

export interface BoardLocation {
  readonly projectId: string;
  readonly projectKey: string;
  readonly projectName: string;
}

/**
 * Sprint representation for velocity calculations
 * Following Clean Code: Immutable data structures
 */
export interface JiraSprint {
  readonly id: string;
  readonly name: string;
  readonly state: 'active' | 'closed' | 'future';
  readonly startDate: string;
  readonly endDate: string;
  readonly completeDate?: string;
  readonly goal?: string;
  readonly originBoardId: string;
}

/**
 * Fetches all boards for the configured project
 * Following Clean Code: Single responsibility - only board retrieval
 */
export async function getProjectBoards(): Promise<JiraApiResponse<readonly JiraBoard[]>> {
  const cacheKey = 'project-boards';
  
  // Try cache first - boards rarely change
  const cachedBoards = getCachedData<readonly JiraBoard[]>(cacheKey);
  if (cachedBoards) {
    return {
      data: cachedBoards,
      success: true
    };
  }

  try {
    const mcpClient = getMcpAtlassianClient();
    const projectKey = 'NP'; // Get from env or config
    
    const boardsResponse = await mcpClient.getProjectBoards(projectKey);
    
    if (boardsResponse.success) {
      // Cache the result for 30 minutes
      setCachedData(cacheKey, boardsResponse.data);
    }

    return boardsResponse;
  } catch (error) {
    return {
      data: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch boards'
    };
  }
}

/**
 * Fetches sprints for a specific board
 * Following Clean Code: Clear parameter names, single responsibility
 */
export async function getBoardSprints(boardId: string): Promise<JiraApiResponse<readonly JiraSprint[]>> {
  const cacheKey = `board-sprints-${boardId}`;
  
  const cachedSprints = getCachedData<readonly JiraSprint[]>(cacheKey);
  if (cachedSprints) {
    return {
      data: cachedSprints,
      success: true
    };
  }

  try {
    const mcpClient = getMcpAtlassianClient();
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    
    if (sprintsResponse.success) {
      setCachedData(cacheKey, sprintsResponse.data);
    }

    return sprintsResponse;
  } catch (error) {
    return {
      data: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sprints'
    };
  }
}

/**
 * Validates if board belongs to the configured project
 * Following Clean Code: Command-Query Separation - this function answers a question
 */
export function isBoardInProject(board: JiraBoard, projectKey: string): boolean {
  return board.projectKey === projectKey;
}
