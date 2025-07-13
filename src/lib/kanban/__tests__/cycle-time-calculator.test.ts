/**
 * Test suite for Kanban cycle time calculation business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateIssueCycleTime,
  calculateIssuesCycleTime,
  filterCompletedIssues,
  extractCycleTimes
} from '../cycle-time-calculator.js';
import type { IssueCycleTimeResult } from '../cycle-time-calculator.js';
import type { JiraIssue, CycleTime } from '../../jira/types.js';
import type { McpAtlassianClient } from '../../mcp/atlassian.js';
import type { IssueChangelog } from '../../jira/changelog-api.js';

// Test fixtures
const createMockIssue = (
  key: string,
  created: string = '2024-01-01T09:00:00.000Z'
): JiraIssue => ({
  id: key.replace('-', ''),
  key,
  summary: `Test Issue ${key}`,
  description: `Description for ${key}`,
  status: {
    id: '10003',
    name: 'Done',
    statusCategory: {
      id: 3,
      name: 'Done',
      colorName: 'green'
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
  created,
  updated: '2024-01-15T17:00:00.000Z',
  resolved: null
});

const createMockChangelog = (
  issueKey: string,
  statusTransitions: Record<string, string>
): IssueChangelog => ({
  issueKey,
  histories: [],
  statusTransitionIndex: new Map(Object.entries(statusTransitions))
});

const createMockMcpClient = (
  toDoStatusIds: string[] = ['10001'],
  doneStatusIds: string[] = ['10003'],
  changelogMap: Map<string, IssueChangelog> = new Map()
): McpAtlassianClient => ({
  getBoardToDoStatusIds: jest.fn().mockResolvedValue({
    success: true,
    data: toDoStatusIds
  }),
  getBoardDoneStatusIds: jest.fn().mockResolvedValue({
    success: true,
    data: doneStatusIds
  }),
  getIssueChangelog: jest.fn().mockImplementation((issueKey: string) => {
    const changelog = changelogMap.get(issueKey);
    return Promise.resolve({
      success: !!changelog,
      data: changelog || null
    });
  }),
  // Other methods not used in cycle time calculation
  getProjectBoards: jest.fn(),
  getBoardSprints: jest.fn(),
  getBoardInfo: jest.fn(),
  getSprintDetails: jest.fn(),
  getSprintIssues: jest.fn()
});

const createCycleTimeResult = (
  issueKey: string,
  boardId: string,
  cycleTime: CycleTime | null,
  calculatedAt: string = '2024-01-20T10:00:00.000Z'
): IssueCycleTimeResult => ({
  issueKey,
  boardId,
  cycleTime,
  calculatedAt
});

describe('calculateIssueCycleTime', () => {
  const boardId = 'BOARD-123';
  const toDoStatusIds = ['10001', '10002']; // To Do, In Progress
  const doneStatusIds = ['10003', '10004']; // Done, Closed

  test('should calculate cycle time for completed issue with To Do transition', async () => {
    // Arrange
    const issue = createMockIssue('TEST-123');
    const changelog = createMockChangelog('TEST-123', {
      '10001': '2024-01-02T10:00:00.000Z', // To Do transition
      '10003': '2024-01-05T15:00:00.000Z'  // Done transition
    });
    const changelogMap = new Map([['TEST-123', changelog]]);
    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, changelogMap);

    // Act
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);

    // Assert
    expect(result.issueKey).toBe('TEST-123');
    expect(result.boardId).toBe(boardId);
    expect(result.cycleTime).not.toBeNull();
    expect(result.cycleTime!.startDate).toBe('2024-01-02T10:00:00.000Z');
    expect(result.cycleTime!.endDate).toBe('2024-01-05T15:00:00.000Z');
    expect(result.cycleTime!.durationHours).toBe(77); // 3 days + 5 hours
    expect(result.cycleTime!.calculationMethod).toBe('board_entry');
    expect(result.cycleTime!.isEstimated).toBe(false);
  });

  test('should use creation date when no To Do transition exists', async () => {
    // Arrange
    const issue = createMockIssue('TEST-124', '2024-01-01T08:00:00.000Z');
    const changelog = createMockChangelog('TEST-124', {
      '10003': '2024-01-03T16:00:00.000Z'  // Only Done transition
    });
    const changelogMap = new Map([['TEST-124', changelog]]);
    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, changelogMap);

    // Act
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);

    // Assert
    expect(result.cycleTime).not.toBeNull();
    expect(result.cycleTime!.startDate).toBe('2024-01-01T08:00:00.000Z'); // Creation date
    expect(result.cycleTime!.endDate).toBe('2024-01-03T16:00:00.000Z');
    expect(result.cycleTime!.calculationMethod).toBe('creation_date');
    expect(result.cycleTime!.isEstimated).toBe(true);
  });

  test('should find earliest To Do and Done transitions', async () => {
    // Arrange
    const issue = createMockIssue('TEST-125');
    const changelog = createMockChangelog('TEST-125', {
      '10001': '2024-01-02T10:00:00.000Z', // First To Do
      '10002': '2024-01-01T09:00:00.000Z', // Earlier To Do (should be used)
      '10003': '2024-01-05T15:00:00.000Z', // First Done (should be used)
      '10004': '2024-01-06T16:00:00.000Z'  // Later Done
    });
    const changelogMap = new Map([['TEST-125', changelog]]);
    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, changelogMap);

    // Act
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);

    // Assert
    expect(result.cycleTime!.startDate).toBe('2024-01-01T09:00:00.000Z'); // Earliest To Do
    expect(result.cycleTime!.endDate).toBe('2024-01-05T15:00:00.000Z');   // Earliest Done
  });

  test('should return null cycle time for incomplete issue', async () => {
    // Arrange
    const issue = createMockIssue('TEST-126');
    const changelog = createMockChangelog('TEST-126', {
      '10001': '2024-01-02T10:00:00.000Z' // Only To Do, no Done transition
    });
    const changelogMap = new Map([['TEST-126', changelog]]);
    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, changelogMap);

    // Act
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);

    // Assert
    expect(result.issueKey).toBe('TEST-126');
    expect(result.cycleTime).toBeNull();
  });

  test('should handle changelog fetch failure gracefully', async () => {
    // Arrange
    const issue = createMockIssue('TEST-127');
    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, new Map());

    // Act
    const result = await calculateIssueCycleTime(issue, boardId, toDoStatusIds, doneStatusIds, mcpClient);

    // Assert
    expect(result.issueKey).toBe('TEST-127');
    expect(result.cycleTime).toBeNull();
  });
});

describe('calculateIssuesCycleTime', () => {
  const boardId = 'BOARD-456';

  test('should calculate cycle time for multiple issues with single API call', async () => {
    // Arrange
    const issues = [
      createMockIssue('TEST-201'),
      createMockIssue('TEST-202'),
      createMockIssue('TEST-203')
    ];

    const changelogMap = new Map([
      ['TEST-201', createMockChangelog('TEST-201', {
        '10001': '2024-01-02T10:00:00.000Z',
        '10003': '2024-01-04T15:00:00.000Z'
      })],
      ['TEST-202', createMockChangelog('TEST-202', {
        '10001': '2024-01-03T11:00:00.000Z',
        '10003': '2024-01-06T14:00:00.000Z'
      })],
      ['TEST-203', createMockChangelog('TEST-203', {
        '10001': '2024-01-04T12:00:00.000Z'
        // No Done transition - incomplete issue
      })]
    ]);

    const mcpClient = createMockMcpClient(['10001'], ['10003'], changelogMap);

    // Act
    const results = await calculateIssuesCycleTime(issues, boardId, mcpClient);

    // Assert
    expect(results).toHaveLength(3);
    
    // First issue - completed
    expect(results[0].issueKey).toBe('TEST-201');
    expect(results[0].cycleTime).not.toBeNull();
    
    // Second issue - completed
    expect(results[1].issueKey).toBe('TEST-202');
    expect(results[1].cycleTime).not.toBeNull();
    
    // Third issue - incomplete
    expect(results[2].issueKey).toBe('TEST-203');
    expect(results[2].cycleTime).toBeNull();

    // Verify API calls were optimized (called once per status type)
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledTimes(1);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledTimes(1);
  });

  test('should handle board status fetch failure gracefully', async () => {
    // Arrange
    const issues = [createMockIssue('TEST-301')];
    const mcpClient: McpAtlassianClient = {
      getBoardToDoStatusIds: jest.fn().mockResolvedValue({ success: false }),
      getBoardDoneStatusIds: jest.fn().mockResolvedValue({ success: false }),
      getIssueChangelog: jest.fn(),
      getProjectBoards: jest.fn(),
      getBoardSprints: jest.fn(),
      getBoardInfo: jest.fn(),
      getSprintDetails: jest.fn(),
      getSprintIssues: jest.fn()
    };

    // Act
    const results = await calculateIssuesCycleTime(issues, boardId, mcpClient);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].issueKey).toBe('TEST-301');
    expect(results[0].cycleTime).toBeNull();
  });
});

describe('filterCompletedIssues', () => {
  test('should filter only issues with cycle time data', () => {
    // Arrange
    const mockCycleTime: CycleTime = {
      startDate: '2024-01-01T10:00:00.000Z',
      endDate: '2024-01-05T15:00:00.000Z',
      durationDays: 4.2,
      durationHours: 101,
      isEstimated: false,
      calculationMethod: 'board_entry'
    };

    const results = [
      createCycleTimeResult('TEST-401', 'BOARD-1', mockCycleTime),
      createCycleTimeResult('TEST-402', 'BOARD-1', null), // Incomplete
      createCycleTimeResult('TEST-403', 'BOARD-1', mockCycleTime)
    ];

    // Act
    const completedResults = filterCompletedIssues(results);

    // Assert
    expect(completedResults).toHaveLength(2);
    expect(completedResults[0].issueKey).toBe('TEST-401');
    expect(completedResults[1].issueKey).toBe('TEST-403');
  });

  test('should return empty array when no issues completed', () => {
    // Arrange
    const results = [
      createCycleTimeResult('TEST-501', 'BOARD-1', null),
      createCycleTimeResult('TEST-502', 'BOARD-1', null)
    ];

    // Act
    const completedResults = filterCompletedIssues(results);

    // Assert
    expect(completedResults).toHaveLength(0);
  });
});

describe('extractCycleTimes', () => {
  test('should extract duration hours from completed issues', () => {
    // Arrange
    const results = [
      createCycleTimeResult('TEST-601', 'BOARD-1', {
        startDate: '2024-01-01T10:00:00.000Z',
        endDate: '2024-01-03T15:00:00.000Z',
        durationDays: 2.2,
        durationHours: 53,
        isEstimated: false,
        calculationMethod: 'board_entry'
      }),
      createCycleTimeResult('TEST-602', 'BOARD-1', null), // Should be filtered out
      createCycleTimeResult('TEST-603', 'BOARD-1', {
        startDate: '2024-01-02T09:00:00.000Z',
        endDate: '2024-01-04T14:00:00.000Z',
        durationDays: 2.2,
        durationHours: 77,
        isEstimated: true,
        calculationMethod: 'creation_date'
      })
    ];

    // Act
    const cycleTimes = extractCycleTimes(results);

    // Assert
    expect(cycleTimes).toEqual([53, 77]);
  });

  test('should return empty array when no completed issues', () => {
    // Arrange
    const results = [
      createCycleTimeResult('TEST-701', 'BOARD-1', null),
      createCycleTimeResult('TEST-702', 'BOARD-1', null)
    ];

    // Act
    const cycleTimes = extractCycleTimes(results);

    // Assert
    expect(cycleTimes).toEqual([]);
  });
});
