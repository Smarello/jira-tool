/**
 * Test suite for calculateSprintStoryPoints business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import { calculateSprintStoryPoints } from '../calculator.js';
import type { JiraSprint } from '../../jira/boards.js';
import type { JiraIssueWithPoints, StoryPointsData } from '../../jira/issues-api.js';
import type { McpAtlassianClient } from '../../mcp/atlassian.js';
import type { JiraApiResponse } from '../../jira/types.js';
import type { AdvancedValidationResult } from '../advanced-validator.js';

// Mock the advanced-validator module
jest.mock('../advanced-validator.js', () => ({
  validateIssuesForVelocity: jest.fn(),
  calculateValidatedStoryPoints: jest.fn()
}));

import { validateIssuesForVelocity, calculateValidatedStoryPoints } from '../advanced-validator.js';

// Cast mocks for TypeScript
const mockValidateIssuesForVelocity = validateIssuesForVelocity as jest.MockedFunction<typeof validateIssuesForVelocity>;
const mockCalculateValidatedStoryPoints = calculateValidatedStoryPoints as jest.MockedFunction<typeof calculateValidatedStoryPoints>;

// Test fixtures
const createMockSprint = (id: string = 'sprint-1', name: string = 'Test Sprint'): JiraSprint => ({
  id,
  name,
  state: 'closed',
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-14T23:59:59.999Z',
  originBoardId: 'board-123',
  goal: `Goal for ${name}`
});

const createMockIssue = (
  id: string,
  storyPoints: number | null = null,
  key: string = `TEST-${id}`
): JiraIssueWithPoints => ({
  id,
  key,
  summary: `Test Issue ${id}`,
  description: null,
  storyPoints,
  status: {
    id: '10001',
    name: 'Done',
    statusCategory: {
      id: 3,
      name: 'Done',
      colorName: 'green'
    }
  },
  priority: {
    id: '10000',
    name: 'Medium',
    iconUrl: 'https://example.com/icon.png'
  },
  issueType: {
    id: '10001',
    name: 'Story',
    iconUrl: 'https://example.com/icon.png',
    subtask: false
  },
  assignee: null,
  reporter: {
    accountId: 'user-123',
    displayName: 'Test User',
    emailAddress: 'test@example.com',
    avatarUrls: {
      '16x16': 'https://example.com/avatar16.png',
      '24x24': 'https://example.com/avatar24.png',
      '32x32': 'https://example.com/avatar32.png',
      '48x48': 'https://example.com/avatar48.png'
    }
  },
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-02T00:00:00.000Z',
  resolved: null,
  statusCategoryChangedDate: null
});

const createMockValidationResult = (
  isValid: boolean = true
): AdvancedValidationResult => ({
  isValidForVelocity: isValid,
  reason: isValid ? 'done_at_sprint_end' : 'not_valid',
  doneTransitionDate: isValid ? '2024-01-10T12:00:00.000Z' : undefined
});

const createMockMcpClient = (
  issuesResponse: JiraApiResponse<readonly JiraIssueWithPoints[]>
): jest.Mocked<McpAtlassianClient> => ({
  getProjectBoards: jest.fn(),
  getBoardSprints: jest.fn(),
  getBoardInfo: jest.fn(),
  getSprintDetails: jest.fn(),
  getSprintIssues: jest.fn().mockResolvedValue(issuesResponse),
  getBoardDoneStatusIds: jest.fn(),
  getIssueChangelog: jest.fn(),
  getBoardToDoStatusIds: jest.fn()
});

describe('calculateSprintStoryPoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should calculate story points correctly for successful API response', async () => {
    // Arrange
    const sprint = createMockSprint();
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5, 'TEST-1'),
      createMockIssue('2', 3, 'TEST-2'),
      createMockIssue('3', 8, 'TEST-3'),
      createMockIssue('4', null, 'TEST-4') // Issue without story points
    ];
    
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: issues,
      success: true
    };
    
    const validationResults: AdvancedValidationResult[] = [
      createMockValidationResult(true),
      createMockValidationResult(true),
      createMockValidationResult(false), // Not completed in sprint
      createMockValidationResult(false)  // No story points
    ];

    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockResolvedValue(validationResults);
    mockCalculateValidatedStoryPoints.mockReturnValue(8); // 5 + 3 = 8 completed points

    // Act
    const result: StoryPointsData = await calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    );

    // Assert
    expect(result).toEqual({
      committed: 16, // 5 + 3 + 8 + 0 = 16 total committed points
      completed: 8,   // 5 + 3 = 8 completed points (from mock)
      issueCount: 4,
      completedIssueCount: 2
    });

    // Verify dependencies were called correctly
    expect(mcpClient.getSprintIssues).toHaveBeenCalledWith(sprint.id);
    expect(mockValidateIssuesForVelocity).toHaveBeenCalledWith(
      issues,
      sprint,
      sprint.originBoardId,
      mcpClient
    );
    expect(mockCalculateValidatedStoryPoints).toHaveBeenCalledWith(issues, validationResults);
  });

  test('should handle empty issues array', async () => {
    // Arrange
    const sprint = createMockSprint();
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: [],
      success: true
    };
    
    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockResolvedValue([]);
    mockCalculateValidatedStoryPoints.mockReturnValue(0);

    // Act
    const result = await calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    );

    // Assert
    expect(result).toEqual({
      committed: 0,
      completed: 0,
      issueCount: 0,
      completedIssueCount: 0
    });
  });

  test('should handle issues with only null story points', async () => {
    // Arrange
    const sprint = createMockSprint();
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', null, 'TEST-1'),
      createMockIssue('2', null, 'TEST-2')
    ];
    
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: issues,
      success: true
    };
    
    const validationResults: AdvancedValidationResult[] = [
      createMockValidationResult(true),
      createMockValidationResult(false)
    ];

    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockResolvedValue(validationResults);
    mockCalculateValidatedStoryPoints.mockReturnValue(0);

    // Act
    const result = await calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    );

    // Assert
    expect(result).toEqual({
      committed: 0, // null story points treated as 0
      completed: 0,
      issueCount: 2,
      completedIssueCount: 1 // One issue was validated as completed
    });
  });

  test('should throw error when API call fails', async () => {
    // Arrange
    const sprint = createMockSprint();
    const failureResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: [],
      success: false,
      error: 'API connection failed'
    };
    
    const mcpClient = createMockMcpClient(failureResponse);

    // Act & Assert
    await expect(calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    )).rejects.toThrow('Failed to fetch issues for sprint sprint-1: API connection failed');

    // Verify API was called but validation functions were not
    expect(mcpClient.getSprintIssues).toHaveBeenCalledWith(sprint.id);
    expect(mockValidateIssuesForVelocity).not.toHaveBeenCalled();
    expect(mockCalculateValidatedStoryPoints).not.toHaveBeenCalled();
  });

  test('should handle validation function failures gracefully', async () => {
    // Arrange
    const sprint = createMockSprint();
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5, 'TEST-1')
    ];
    
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: issues,
      success: true
    };
    
    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockRejectedValue(new Error('Validation failed'));

    // Act & Assert
    await expect(calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    )).rejects.toThrow('Validation failed');
  });

  test('should calculate completed issue count correctly', async () => {
    // Arrange
    const sprint = createMockSprint();
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5, 'TEST-1'),
      createMockIssue('2', 3, 'TEST-2'),
      createMockIssue('3', 8, 'TEST-3'),
      createMockIssue('4', 2, 'TEST-4')
    ];
    
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: issues,
      success: true
    };
    
    // Only 2 out of 4 issues are completed
    const validationResults: AdvancedValidationResult[] = [
      createMockValidationResult(true),  // Completed
      createMockValidationResult(false), // Not completed
      createMockValidationResult(true),  // Completed
      createMockValidationResult(false)  // Not completed
    ];

    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockResolvedValue(validationResults);
    mockCalculateValidatedStoryPoints.mockReturnValue(13); // 5 + 8 = 13

    // Act
    const result = await calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    );

    // Assert
    expect(result.completedIssueCount).toBe(2); // Only TEST-1 and TEST-3 are completed
    expect(result.issueCount).toBe(4); // Total issues
    expect(result.committed).toBe(18); // 5 + 3 + 8 + 2 = 18
    expect(result.completed).toBe(13); // From mock calculation
  });

  test('should handle mixed story points values correctly', async () => {
    // Arrange
    const sprint = createMockSprint();
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 0, 'TEST-1'),     // Zero story points
      createMockIssue('2', 1, 'TEST-2'),     // Minimum story points
      createMockIssue('3', 13, 'TEST-3'),    // Large story points
      createMockIssue('4', null, 'TEST-4')   // Null story points
    ];
    
    const successResponse: JiraApiResponse<readonly JiraIssueWithPoints[]> = {
      data: issues,
      success: true
    };
    
    const validationResults: AdvancedValidationResult[] = [
      createMockValidationResult(true),
      createMockValidationResult(true),
      createMockValidationResult(true),
      createMockValidationResult(true)
    ];

    const mcpClient = createMockMcpClient(successResponse);
    mockValidateIssuesForVelocity.mockResolvedValue(validationResults);
    mockCalculateValidatedStoryPoints.mockReturnValue(14); // 0 + 1 + 13 + 0 = 14

    // Act
    const result = await calculateSprintStoryPoints(
      sprint.id,
      sprint,
      sprint.originBoardId,
      mcpClient
    );

    // Assert
    expect(result.committed).toBe(14); // 0 + 1 + 13 + 0 = 14 (null treated as 0)
    expect(result.completed).toBe(14);
    expect(result.completedIssueCount).toBe(4);
  });

  test('should mock getBoardToDoStatusIds correctly', async () => {
    // Arrange
    const boardId = 'board-123';
    const toDoStatusIds = ['10000', '10001'];
    const successResponse: JiraApiResponse<readonly string[]> = {
      data: toDoStatusIds,
      success: true
    };
    
    const mcpClient = createMockMcpClient(successResponse);
    mcpClient.getBoardToDoStatusIds = jest.fn().mockResolvedValue(successResponse);

    // Act
    const result = await mcpClient.getBoardToDoStatusIds(boardId);

    // Assert
    expect(result).toEqual(successResponse);
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledWith(boardId);
  });
});
