/**
 * Test suite for Kanban cycle time calculation business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateIssueCycleTime,
  calculateIssuesCycleTime,
  filterCompletedIssues,
  extractCycleTimes,
  calculateCycleTimePercentile,
  calculateMultiplePercentiles
} from '../cycle-time-calculator.js';
import type { IssueCycleTimeResult } from '../cycle-time-calculator.js';
import type { JiraIssue, CycleTime } from '../../jira/types.js';
import { PercentileCalculationError } from '../../jira/types.js';
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
  getBoardIssues: jest.fn(),
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
  const toDoStatusIds = ['10001']; // To Do statuses
  const doneStatusIds = ['10003']; // Done statuses

  test('should calculate cycle time for multiple issues with provided status configuration', async () => {
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

    const mcpClient = createMockMcpClient(toDoStatusIds, doneStatusIds, changelogMap);

    // Act
    const results = await calculateIssuesCycleTime(issues, boardId, toDoStatusIds, doneStatusIds, mcpClient);

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

    // Verify NO API calls for board status configuration (status IDs provided directly)
    expect(mcpClient.getBoardToDoStatusIds).not.toHaveBeenCalled();
    expect(mcpClient.getBoardDoneStatusIds).not.toHaveBeenCalled();
  });

  test('should handle empty status arrays gracefully', async () => {
    // Arrange
    const issues = [createMockIssue('TEST-301')];
    const emptyToDoStatusIds: string[] = [];
    const emptyDoneStatusIds: string[] = [];
    const changelogMap = new Map([
      ['TEST-301', createMockChangelog('TEST-301', {
        '10001': '2024-01-02T10:00:00.000Z',
        '10003': '2024-01-04T15:00:00.000Z'
      })]
    ]);
    const mcpClient = createMockMcpClient(emptyToDoStatusIds, emptyDoneStatusIds, changelogMap);

    // Act
    const results = await calculateIssuesCycleTime(issues, boardId, emptyToDoStatusIds, emptyDoneStatusIds, mcpClient);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].issueKey).toBe('TEST-301');
    expect(results[0].cycleTime).toBeNull(); // No matching status IDs = no cycle time
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

describe('calculateCycleTimePercentile', () => {
  test('should calculate 50th percentile (median) correctly', () => {
    // Arrange
    const cycleTimes = [10, 20, 30, 40, 50];

    // Act
    const result = calculateCycleTimePercentile(cycleTimes, 50);

    // Assert
    expect(result).toBe(30); // Median of [10, 20, 30, 40, 50]
  });

  test('should calculate percentiles with linear interpolation', () => {
    // Arrange
    const cycleTimes = [10, 20, 30, 40];

    // Act
    const p25 = calculateCycleTimePercentile(cycleTimes, 25);
    const p75 = calculateCycleTimePercentile(cycleTimes, 75);

    // Assert
    expect(p25).toBe(17.5); // 25% between 10 and 20: 10 + 0.5 * (20-10) = 15, but it's index-based: 10 + 0.25 * (40-10) = 17.5
    expect(p75).toBe(32.5); // 75% between 30 and 40: 30 + 0.5 * (40-30) = 35, but index-based: 10 + 0.75 * (40-10) = 32.5
  });

  test('should handle edge case percentiles correctly', () => {
    // Arrange
    const cycleTimes = [5, 15, 25, 35, 45];

    // Act
    const p0 = calculateCycleTimePercentile(cycleTimes, 0);
    const p100 = calculateCycleTimePercentile(cycleTimes, 100);

    // Assert
    expect(p0).toBe(5);   // Minimum value
    expect(p100).toBe(45); // Maximum value
  });

  test('should handle single value array', () => {
    // Arrange
    const cycleTimes = [42];

    // Act
    const p50 = calculateCycleTimePercentile(cycleTimes, 50);
    const p90 = calculateCycleTimePercentile(cycleTimes, 90);

    // Assert
    expect(p50).toBe(42);
    expect(p90).toBe(42);
  });

  test('should sort unsorted array before calculation', () => {
    // Arrange
    const cycleTimes = [50, 10, 30, 20, 40]; // Unsorted

    // Act
    const p50 = calculateCycleTimePercentile(cycleTimes, 50);

    // Assert
    expect(p50).toBe(30); // Should sort to [10, 20, 30, 40, 50], median is 30
  });

  test('should throw error for empty array', () => {
    // Arrange
    const cycleTimes: number[] = [];

    // Act & Assert
    expect(() => calculateCycleTimePercentile(cycleTimes, 50))
      .toThrow(PercentileCalculationError);
    
    expect(() => calculateCycleTimePercentile(cycleTimes, 50))
      .toThrow('Cannot calculate percentile for empty cycle times array');
  });

  test('should throw error for invalid percentiles', () => {
    // Arrange
    const cycleTimes = [10, 20, 30];

    // Act & Assert
    expect(() => calculateCycleTimePercentile(cycleTimes, -1))
      .toThrow(PercentileCalculationError);
    
    expect(() => calculateCycleTimePercentile(cycleTimes, 101))
      .toThrow(PercentileCalculationError);
    
    expect(() => calculateCycleTimePercentile(cycleTimes, -1))
      .toThrow('Invalid percentile: -1. Must be between 0 and 100.');
  });

  test('should handle real-world cycle times', () => {
    // Arrange - Realistic cycle times in hours
    const cycleTimes = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80]; // 10 issues

    // Act
    const p50 = calculateCycleTimePercentile(cycleTimes, 50);
    const p85 = calculateCycleTimePercentile(cycleTimes, 85);
    const p95 = calculateCycleTimePercentile(cycleTimes, 95);

    // Assert
    expect(p50).toBeCloseTo(44);    // Median between 40 and 48
    expect(p85).toBeCloseTo(69.2);  // 85th percentile 
    expect(p95).toBeCloseTo(76.4);  // 95th percentile
  });
});

describe('calculateMultiplePercentiles', () => {
  test('should calculate multiple percentiles correctly', () => {
    // Arrange
    const cycleTimes = [10, 20, 30, 40, 50];
    const percentiles = [25, 50, 75];

    // Act
    const result = calculateMultiplePercentiles(cycleTimes, percentiles);

    // Assert
    expect(result).toEqual({
      25: 20,  // 25th percentile
      50: 30,  // 50th percentile (median)
      75: 40   // 75th percentile
    });
  });

  test('should return same result as single percentile function', () => {
    // Arrange
    const cycleTimes = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80];
    const percentiles = [50, 85, 95];

    // Act
    const multipleResult = calculateMultiplePercentiles(cycleTimes, percentiles);
    const singleResults = {
      50: calculateCycleTimePercentile(cycleTimes, 50),
      85: calculateCycleTimePercentile(cycleTimes, 85),
      95: calculateCycleTimePercentile(cycleTimes, 95)
    };

    // Assert
    expect(multipleResult).toEqual(singleResults);
  });

  test('should handle edge case percentiles in batch', () => {
    // Arrange
    const cycleTimes = [5, 15, 25, 35];
    const percentiles = [0, 33.33, 66.67, 100];

    // Act
    const result = calculateMultiplePercentiles(cycleTimes, percentiles);

    // Assert
    expect(result[0]).toBe(5);    // Minimum
    expect(result[100]).toBe(35); // Maximum
    expect(result[33.33]).toBeCloseTo(15, 1); // Approximately 15
    expect(result[66.67]).toBeCloseTo(25, 1); // Approximately 25
  });

  test('should throw error for empty array', () => {
    // Arrange
    const cycleTimes: number[] = [];
    const percentiles = [50, 85];

    // Act & Assert
    expect(() => calculateMultiplePercentiles(cycleTimes, percentiles))
      .toThrow(PercentileCalculationError);
    
    expect(() => calculateMultiplePercentiles(cycleTimes, percentiles))
      .toThrow('Cannot calculate percentiles for empty cycle times array');
  });

  test('should throw error for any invalid percentile', () => {
    // Arrange
    const cycleTimes = [10, 20, 30];
    const invalidPercentiles = [50, 101, 85]; // One invalid percentile

    // Act & Assert
    expect(() => calculateMultiplePercentiles(cycleTimes, invalidPercentiles))
      .toThrow(PercentileCalculationError);
    
    expect(() => calculateMultiplePercentiles(cycleTimes, invalidPercentiles))
      .toThrow('Invalid percentile: 101. All percentiles must be between 0 and 100.');
  });

  test('should validate all percentiles before processing', () => {
    // Arrange
    const cycleTimes = [10, 20, 30];
    const multipleInvalidPercentiles = [-1, 50, 150]; // Multiple invalid

    // Act & Assert
    expect(() => calculateMultiplePercentiles(cycleTimes, multipleInvalidPercentiles))
      .toThrow(PercentileCalculationError);
    
    // Should throw for the first invalid percentile encountered
    expect(() => calculateMultiplePercentiles(cycleTimes, multipleInvalidPercentiles))
      .toThrow('Invalid percentile: -1');
  });

  test('should handle large datasets efficiently', () => {
    // Arrange
    const cycleTimes = Array.from({ length: 1000 }, (_, i) => i + 1); // 1 to 1000
    const percentiles = [10, 25, 50, 75, 90, 95, 99];

    // Act
    const start = Date.now();
    const result = calculateMultiplePercentiles(cycleTimes, percentiles);
    const duration = Date.now() - start;

    // Assert
    expect(result[50]).toBeCloseTo(500.5); // Median
    expect(result[90]).toBeCloseTo(900.1); // 90th percentile
    expect(duration).toBeLessThan(100); // Should be fast (less than 100ms)
    expect(Object.keys(result)).toHaveLength(7); // All percentiles calculated
  });

  test('should handle SLA-focused percentiles for agile teams', () => {
    // Arrange - Real cycle times from a sprint (in hours)
    const cycleTimes = [
      12, 18, 24, 30, 36, 42, 48, 54, 60, 66,  // Stories
      72, 78, 84, 90, 96, 102, 108, 114, 120   // Larger features
    ];
    const slaPercentiles = [50, 85, 95]; // Common SLA targets

    // Act
    const result = calculateMultiplePercentiles(cycleTimes, slaPercentiles);

    // Assert
    expect(result[50]).toBeGreaterThan(0); // P50 should be reasonable
    expect(result[85]).toBeGreaterThan(result[50]); // P85 > P50
    expect(result[95]).toBeGreaterThan(result[85]); // P95 > P85
    
    // Practical assertions for agile planning
    expect(result[50]).toBeLessThan(result[95]); // Median should be significantly less than P95
    expect(result[95] / result[50]).toBeGreaterThan(1.5); // P95 should be at least 50% higher than median
  });
});
