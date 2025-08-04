/**
 * MCP Atlassian server client
 * Following Clean Code: Single responsibility, Express intent
 */

import type { JiraBoard } from '../jira/boards';
import type { JiraSprint } from '../jira/boards';
import type { JiraApiResponse } from '../jira/types';
import type { JiraIssueWithPoints } from '../jira/issues-api';
import type { IssueChangelog } from '../jira/changelog-api';
import { createJiraConfig } from '../jira/config.js';
import { JiraApiClient } from '../jira/api-client.js';
import { JiraBoardsApi } from '../jira/boards-api.js';
import { JiraSprintsApi } from '../jira/sprints-api.js';
import { JiraIssuesApi } from '../jira/issues-api.js';
import { JiraChangelogApi } from '../jira/changelog-api.js';


/**
 * MCP Atlassian client interface
 * Following Clean Code: Dependency inversion, testability
 */
export interface McpAtlassianClient {
  getProjectBoards(projectKey: string): Promise<JiraApiResponse<readonly JiraBoard[]>>;
  getBoardSprints(boardId: string): Promise<JiraApiResponse<readonly JiraSprint[]>>;
  getBoardInfo(boardId: string): Promise<JiraApiResponse<JiraBoard>>;
  getSprintDetails(sprintId: string): Promise<JiraApiResponse<JiraSprint>>;
  getSprintIssues(sprintId: string): Promise<JiraApiResponse<readonly JiraIssueWithPoints[]>>;
  getBoardIssues(boardId: string, updatedSince?: string): Promise<JiraApiResponse<readonly JiraIssueWithPoints[]>>;
  getBoardDoneStatusIds(boardId: string): Promise<JiraApiResponse<readonly string[]>>;
  getBoardToDoStatusIds(boardId: string): Promise<JiraApiResponse<readonly string[]>>;
  getIssueChangelog(issueKey: string): Promise<JiraApiResponse<IssueChangelog>>;
}

/**
 * Real implementation using Jira REST API
 * Following Clean Code: Single responsibility, dependency injection
 */
class McpAtlassianClientImpl implements McpAtlassianClient {
  private readonly boardsApi: JiraBoardsApi;
  private readonly sprintsApi: JiraSprintsApi;
  private readonly issuesApi: JiraIssuesApi;
  private readonly changelogApi: JiraChangelogApi;
  
  constructor() {
    // Dependency injection following Clean Code principles
    const config = createJiraConfig();
    const apiClient = new JiraApiClient(config);
    
    this.boardsApi = new JiraBoardsApi(apiClient);
    this.sprintsApi = new JiraSprintsApi(apiClient);
    this.issuesApi = new JiraIssuesApi(apiClient);
    this.changelogApi = new JiraChangelogApi(apiClient);
  }
  
  async getProjectBoards(projectKey: string): Promise<JiraApiResponse<readonly JiraBoard[]>> {
    try {
      // Real API call using dependency-injected service
      const boards = await this.boardsApi.fetchProjectBoards(projectKey);
      
      return {
        data: boards,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to mock data
      console.warn('Jira API failed, using mock data:', error);
      
      return {
        data: this.createMockBoards(projectKey),
        success: false,
        error: error instanceof Error ? error.message : 'API failed, using mock data'
      };
    }
  }

  async getBoardSprints(boardId: string): Promise<JiraApiResponse<readonly JiraSprint[]>> {
    try {
      // Real API call using dependency-injected service
      const sprints = await this.sprintsApi.fetchBoardSprintsByOriginId(boardId);
      
      return {
        data: sprints,
        success: true
      };
    } catch (error) {
      // Special handling for Kanban boards that don't support sprints
      if (error instanceof Error && error.message.includes('does not support sprints')) {
        console.info(`Board ${boardId} is Kanban and has no sprints`);
        return {
          data: [],
          success: true
        };
      }
      
      // Graceful degradation: fallback to mock data for other errors
      console.warn('Jira API failed, using mock data:', error);
      
      return {
        data: this.createMockSprints(boardId),
        success: false,
        error: error instanceof Error ? error.message : 'API failed, using mock data'
      };
    }
  }

  /**
   * Creates mock boards for fallback
   * Following Clean Code: Express intent, single responsibility
   */
  private createMockBoards(projectKey: string): readonly JiraBoard[] {
    return [
      {
        id: '1',
        name: `${projectKey} Scrum Board`,
        type: 'scrum',
        projectKey,
        projectName: 'New Project',
        location: {
          projectId: '10001',
          projectKey,
          projectName: 'New Project'
        }
      },
      {
        id: '2', 
        name: `${projectKey} Kanban Board`,
        type: 'kanban',
        projectKey,
        projectName: 'New Project',
        location: {
          projectId: '10001',
          projectKey, 
          projectName: 'New Project'
        }
      }
    ];
  }

  /**
   * Creates mock sprints for fallback
   * Following Clean Code: Express intent, single responsibility
   */
  private createMockSprints(boardId: string): readonly JiraSprint[] {
    return [
      {
        id: `${boardId}-sprint-1`,
        name: 'Sprint 1 - Foundation',
        state: 'closed',
        startDate: '2025-01-01T09:00:00.000Z',
        endDate: '2025-01-14T17:00:00.000Z',
        completeDate: '2025-01-14T16:30:00.000Z',
        goal: 'Establish project foundation and basic setup',
        originBoardId: boardId
      },
      {
        id: `${boardId}-sprint-2`,
        name: 'Sprint 2 - Core Features',
        state: 'active',
        startDate: '2025-01-15T09:00:00.000Z',
        endDate: '2025-01-28T17:00:00.000Z',
        goal: 'Implement core functionality and user interface',
        originBoardId: boardId
      }
    ];
  }

  /**
   * Creates mock sprint details for fallback
   * Following Clean Code: Express intent, single responsibility
   */
  private createMockSprintDetails(sprintId: string): JiraSprint {
    return {
      id: sprintId,
      name: `Mock Sprint ${sprintId}`,
      state: 'closed',
      startDate: '2025-01-01T09:00:00.000Z',
      endDate: '2025-01-14T17:00:00.000Z',
      completeDate: '2025-01-14T16:30:00.000Z',
      goal: 'Mock sprint for testing purposes',
      originBoardId: '1'
    };
  }

  async getBoardInfo(boardId: string): Promise<JiraApiResponse<JiraBoard>> {
    try {
      // Real API call using dependency-injected service
      const board = await this.boardsApi.fetchBoardDetails(boardId);
      
      return {
        data: board,
        success: true
      };
    } catch (error) {
      // Graceful degradation: try from boards list
      console.warn('Board details API failed, trying boards list:', error);
      
      try {
        const boards = await this.getProjectBoards('NP');
        
        if (!boards.success) {
          throw new Error(boards.error);
        }

        const board = boards.data.find(b => b.id === boardId);
        
        if (!board) {
          throw new Error('Board not found');
        }

        return {
          data: board,
          success: true
        };
      } catch (fallbackError) {
        return {
          data: {} as JiraBoard,
          success: false,
          error: fallbackError instanceof Error ? fallbackError.message : 'Failed to fetch board info'
        };
      }
    }
  }

  async getSprintDetails(sprintId: string): Promise<JiraApiResponse<JiraSprint>> {
    try {
      // Real API call using dependency-injected service
      const sprint = await this.sprintsApi.fetchSprintDetails(sprintId);
      
      return {
        data: sprint,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to mock data
      console.warn('Jira API failed, using mock data:', error);
      
      return {
        data: this.createMockSprintDetails(sprintId),
        success: false,
        error: error instanceof Error ? error.message : 'API failed, using mock data'
      };
    }
  }

  async getSprintIssues(sprintId: string): Promise<JiraApiResponse<readonly JiraIssueWithPoints[]>> {
    try {
      // Real API call using dependency-injected service
      const issues = await this.issuesApi.fetchSprintIssues(sprintId);
      
      return {
        data: issues,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to empty array
      console.warn('Jira API failed, returning empty issues array:', error);
      
      return {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'API failed to fetch sprint issues'
      };
    }
  }

  async getBoardIssues(boardId: string, updatedSince?: string): Promise<JiraApiResponse<readonly JiraIssueWithPoints[]>> {
    try {
      // Real API call using dependency-injected service
      const issues = await this.issuesApi.fetchBoardIssues(boardId, updatedSince);
      
      return {
        data: issues,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to empty array
      console.warn('Jira API failed, returning empty board issues array:', error);
      
      return {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'API failed to fetch board issues'
      };
    }
  }

  async getBoardDoneStatusIds(boardId: string): Promise<JiraApiResponse<readonly string[]>> {
    try {
      // Real API call using dependency-injected service
      const statusIds = await this.boardsApi.getDoneColumnStatusIds(boardId);
      
      return {
        data: statusIds,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to empty array
      console.warn('Jira API failed to fetch board done status IDs:', error);
      
      return {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'API failed to fetch board done status IDs'
      };
    }
  }

  async getBoardToDoStatusIds(boardId: string): Promise<JiraApiResponse<readonly string[]>> {
    try {
      // Real API call using dependency-injected service
      const statusIds = await this.boardsApi.getToDoColumnStatusIds(boardId);
      
      return {
        data: statusIds,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to empty array
      console.warn('Jira API failed to fetch board To Do status IDs:', error);
      
      return {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'API failed to fetch board To Do status IDs'
      };
    }
  }

  async getIssueChangelog(issueKey: string): Promise<JiraApiResponse<IssueChangelog>> {
    try {
      // Real API call using dependency-injected service
      const changelog = await this.changelogApi.fetchIssueChangelog(issueKey);
      
      return {
        data: changelog,
        success: true
      };
    } catch (error) {
      // Graceful degradation: fallback to empty changelog
      console.warn('Jira Changelog API failed, returning empty changelog:', error);
      
      return {
        data: {
          issueKey,
          histories: [],
          statusTransitionIndex: new Map()
        },
        success: false,
        error: error instanceof Error ? error.message : 'API failed to fetch issue changelog'
      };
    }
  }
}

/**
 * Singleton instance for MCP client
 * Following Clean Code: Avoid globals where possible, but practical for connections
 */
let mcpClientInstance: McpAtlassianClient | null = null;

/**
 * Gets or creates MCP client instance
 * Following Clean Code: Factory pattern, lazy initialization
 */
export function getMcpAtlassianClient(): McpAtlassianClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new McpAtlassianClientImpl();
  }
  return mcpClientInstance;
}

/**
 * Sets custom MCP client (for testing)
 * Following Clean Code: Dependency injection, testability
 */
export function setMcpAtlassianClient(client: McpAtlassianClient): void {
  mcpClientInstance = client;
}
