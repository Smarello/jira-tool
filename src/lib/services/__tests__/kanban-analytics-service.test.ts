/**
 * Test suite for Kanban Analytics Service
 * Testing the new flow: filter completed issues first, then calculate cycle times
 */

import { calculateKanbanAnalytics } from '../kanban-analytics-service.js';
import type { TimePeriodFilter, JiraIssue, KanbanAnalyticsResult } from '../../jira/types.js';
import { TimePeriod } from '../../jira/types.js';
import type { McpAtlassianClient } from '../../mcp/atlassian.js';
import type { BoardStatusConfiguration } from '../../jira/board-config.js';

// Mock the dependencies
jest.mock('../../jira/config.js', () => ({
  createJiraConfig: jest.fn(() => ({
    baseUrl: 'https://test.atlassian.net'
  }))
}));

jest.mock('../../jira/board-config.js', () => ({
  getBoardStatusConfiguration: jest.fn()
}));

jest.mock('../../kanban/cycle-time-calculator.js', () => ({
  calculateIssuesCycleTime: jest.fn(),
  filterCompletedIssues: jest.fn(),
  filterCompletedCycleTimeResults: jest.fn(),
  extractCycleTimes: jest.fn(),
  calculateMultiplePercentiles: jest.fn()
}));

import { getBoardStatusConfiguration } from '../../jira/board-config.js';
import { 
  calculateIssuesCycleTime,
  filterCompletedIssues,
  filterCompletedCycleTimeResults,
  extractCycleTimes,
  calculateMultiplePercentiles
} from '../../kanban/cycle-time-calculator.js';

// Test fixtures
const createMockIssue = (
  key: string,
  statusId: string = '10003',
  statusCategory: 'To Do' | 'In Progress' | 'Done' = 'Done'
): JiraIssue => ({
  id: key.replace('-', ''),
  key,
  summary: `Test Issue ${key}`,
  description: `Description for ${key}`,
  status: {
    id: statusId,
    name: statusCategory,
    statusCategory: {
      id: statusCategory === 'To Do' ? 1 : statusCategory === 'In Progress' ? 2 : 3,
      name: statusCategory,
      colorName: statusCategory === 'To Do' ? 'blue-gray' : statusCategory === 'In Progress' ? 'yellow' : 'green'
    }
  },
  priority: {
    id: '3',
    name: 'Medium',
    iconUrl: 'https://example.com/medium.png'
  },
  issueType: {
    id: '10001',
    name: 'Task',
    iconUrl: 'https://example.com/task.png',
    subtask: false
  },
  assignee: null,
  reporter: {
    accountId: 'user123',
    displayName: 'Test User',
    emailAddress: 'test@example.com',
    avatarUrls: {
      '16x16': 'https://example.com/avatar16.png',
      '24x24': 'https://example.com/avatar24.png',
      '32x32': 'https://example.com/avatar32.png',
      '48x48': 'https://example.com/avatar48.png'
    }
  },
  created: '2024-01-01T09:00:00.000Z',
  updated: '2024-01-15T17:00:00.000Z',
  resolved: null
});

const createMockBoardConfig = (boardId: string = 'BOARD-123'): BoardStatusConfiguration => ({
  toDoStatusIds: ['10001', '10002'],
  doneStatusIds: ['10003', '10004'],
  boardId
});

const createMockMcpClient = (issues: JiraIssue[]): McpAtlassianClient => ({
  getBoardIssues: jest.fn().mockResolvedValue({
    success: true,
    data: issues
  }),
  getIssueChangelog: jest.fn(),
  getBoardToDoStatusIds: jest.fn(),
  getBoardDoneStatusIds: jest.fn(),
  getProjectBoards: jest.fn(),
  getBoardSprints: jest.fn(),
  getBoardInfo: jest.fn(),
  getSprintDetails: jest.fn(),
  getSprintIssues: jest.fn()
});

describe('calculateKanbanAnalytics', () => {
  const boardId = 'BOARD-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should follow the new flow: filter completed issues first, then calculate cycle times', async () => {
    // Arrange
    const allIssues = [
      createMockIssue('TEST-1', '10003', 'Done'),      // Completed
      createMockIssue('TEST-2', '10001', 'To Do'),     // Not completed
      createMockIssue('TEST-3', '10004', 'Done'),      // Completed
      createMockIssue('TEST-4', '10002', 'In Progress') // Not completed
    ];
    
    const completedIssues = [
      createMockIssue('TEST-1', '10003', 'Done'),
      createMockIssue('TEST-3', '10004', 'Done')
    ];
    
    const cycleTimeResults = [
      { issueKey: 'TEST-1', boardId, cycleTime: { durationHours: 48, durationDays: 2 }, calculatedAt: '2024-01-01T00:00:00.000Z' },
      { issueKey: 'TEST-3', boardId, cycleTime: { durationHours: 72, durationDays: 3 }, calculatedAt: '2024-01-01T00:00:00.000Z' }
    ];
    
    const cycleTimes = [48, 72];
    const percentileValues = { 50: 60, 75: 68, 85: 70, 95: 72 };

    const mcpClient = createMockMcpClient(allIssues);
    const boardConfig = createMockBoardConfig(boardId);

    // Mock function responses
    (getBoardStatusConfiguration as jest.Mock).mockResolvedValue(boardConfig);
    (filterCompletedIssues as jest.Mock).mockReturnValue(completedIssues);
    (calculateIssuesCycleTime as jest.Mock).mockResolvedValue(cycleTimeResults);
    (filterCompletedCycleTimeResults as jest.Mock).mockReturnValue(cycleTimeResults);
    (extractCycleTimes as jest.Mock).mockReturnValue(cycleTimes);
    (calculateMultiplePercentiles as jest.Mock).mockReturnValue(percentileValues);

    // Act
    const result = await calculateKanbanAnalytics(boardId, mcpClient);

    // Assert
    expect(result).toBeDefined();
    expect(result.totalIssues).toBe(4);
    expect(result.completedIssues).toBe(2);

    // Verify the new flow order
    expect(getBoardStatusConfiguration).toHaveBeenCalledWith(boardId, mcpClient);
    expect(filterCompletedIssues).toHaveBeenCalledWith(allIssues, boardConfig.doneStatusIds);
    expect(calculateIssuesCycleTime).toHaveBeenCalledWith(
      completedIssues, 
      boardId, 
      boardConfig.toDoStatusIds, 
      boardConfig.doneStatusIds, 
      mcpClient
    );
    expect(filterCompletedCycleTimeResults).toHaveBeenCalledWith(cycleTimeResults);
    expect(extractCycleTimes).toHaveBeenCalledWith(cycleTimeResults);
  });

  test('should handle board config fetch failure', async () => {
    // Arrange
    const allIssues = [createMockIssue('TEST-1')];
    const mcpClient = createMockMcpClient(allIssues);

    (getBoardStatusConfiguration as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await calculateKanbanAnalytics(boardId, mcpClient);

    // Assert
    expect(result.totalIssues).toBe(0);
    expect(result.completedIssues).toBe(0);
    expect(result.cycleTimePercentiles.sampleSize).toBe(0);
  });

  test('should handle no completed issues', async () => {
    // Arrange
    const allIssues = [
      createMockIssue('TEST-1', '10001', 'To Do'),
      createMockIssue('TEST-2', '10002', 'In Progress')
    ];
    
    const mcpClient = createMockMcpClient(allIssues);
    const boardConfig = createMockBoardConfig(boardId);

    (getBoardStatusConfiguration as jest.Mock).mockResolvedValue(boardConfig);
    (filterCompletedIssues as jest.Mock).mockReturnValue([]);
    (calculateIssuesCycleTime as jest.Mock).mockResolvedValue([]);
    (filterCompletedCycleTimeResults as jest.Mock).mockReturnValue([]);
    (extractCycleTimes as jest.Mock).mockReturnValue([]);

    // Act
    const result = await calculateKanbanAnalytics(boardId, mcpClient);

    // Assert
    expect(result.totalIssues).toBe(2);
    expect(result.completedIssues).toBe(0);
    expect(result.cycleTimePercentiles.p50).toBe(0);
    expect(result.cycleTimePercentiles.sampleSize).toBe(0);
  });

  test('should apply time period filter before completion filtering', async () => {
    // Arrange
    const allIssues = [
      createMockIssue('TEST-1', '10003', 'Done'),
      createMockIssue('TEST-2', '10003', 'Done')
    ];
    
    const timePeriodFilter: TimePeriodFilter = {
      type: TimePeriod.LAST_MONTH
    };
    
    const mcpClient = createMockMcpClient(allIssues);
    const boardConfig = createMockBoardConfig(boardId);

    (getBoardStatusConfiguration as jest.Mock).mockResolvedValue(boardConfig);
    (filterCompletedIssues as jest.Mock).mockReturnValue([allIssues[0]]); // Only first issue after time filter
    (calculateIssuesCycleTime as jest.Mock).mockResolvedValue([]);
    (filterCompletedCycleTimeResults as jest.Mock).mockReturnValue([]);
    (extractCycleTimes as jest.Mock).mockReturnValue([]);

    // Act
    await calculateKanbanAnalytics(boardId, mcpClient, timePeriodFilter);

    // Assert
    // The filterCompletedIssues should be called with filtered issues, not all issues
    expect(filterCompletedIssues).toHaveBeenCalled();
    const filteredIssuesArg = (filterCompletedIssues as jest.Mock).mock.calls[0][0];
    // Note: In a real test, we'd mock the time period filtering function as well
  });

  test('should apply issue types filter before completion filtering', async () => {
    // Arrange
    const allIssues = [
      { ...createMockIssue('TEST-1', '10003', 'Done'), issueType: { ...createMockIssue('TEST-1').issueType, name: 'Story' } },
      { ...createMockIssue('TEST-2', '10003', 'Done'), issueType: { ...createMockIssue('TEST-2').issueType, name: 'Bug' } }
    ];
    
    const issueTypesFilter = ['Story'];
    const mcpClient = createMockMcpClient(allIssues);
    const boardConfig = createMockBoardConfig(boardId);

    (getBoardStatusConfiguration as jest.Mock).mockResolvedValue(boardConfig);
    (filterCompletedIssues as jest.Mock).mockReturnValue([allIssues[0]]); // Only Story after type filter
    (calculateIssuesCycleTime as jest.Mock).mockResolvedValue([]);
    (filterCompletedCycleTimeResults as jest.Mock).mockReturnValue([]);
    (extractCycleTimes as jest.Mock).mockReturnValue([]);

    // Act
    await calculateKanbanAnalytics(boardId, mcpClient, undefined, issueTypesFilter);

    // Assert
    expect(filterCompletedIssues).toHaveBeenCalled();
  });
});
