/**
 * Tests for status time calculation functionality
 * Verifies that time spent in each column status is calculated correctly
 * Following Clean Code: Comprehensive test coverage, clear test names
 */

// Jest globals are available without import
import type { JiraIssue, StatusTimeSpent } from '../../jira/types';
import type { McpAtlassianClient } from '../../mcp/atlassian';
import { 
  calculateIssueStatusTimes,
  calculateIssuesStatusTimes,
  extractAllColumnStatusIds,
  type IssueStatusTimeResult 
} from '../cycle-time-calculator';

// Mock MCP client for testing
function createMockMcpClient(changelogData?: any): McpAtlassianClient {
  return {
    getIssueChangelog: async (issueKey: string) => {
      if (changelogData && changelogData[issueKey]) {
        return {
          success: true,
          data: changelogData[issueKey]
        };
      }
      return {
        success: false,
        error: 'Changelog not found'
      };
    },
    
    // Add missing properties to satisfy McpAtlassianClient interface
    getBoardIssues: async (boardId: string) => ({
      success: true,
      data: []
    }),
    
    getBoardToDoStatusIds: async (boardId: string) => ({
      success: true,
      data: []
    }),
    
    getBoardDoneStatusIds: async (boardId: string) => ({
      success: true,
      data: []
    }),
    
    getProjectBoards: async (projectKey: string) => ({
      success: true,
      data: []
    }),
    
    getBoardSprints: async (boardId: string) => ({
      success: true,
      data: []
    }),
    
    getBoardInfo: async (boardId: string) => ({
      success: true,
      data: {} as any
    }),
    
    getSprintDetails: async (sprintId: string) => ({
      success: true,
      data: {} as any
    }),
    
    getSprintIssues: async (sprintId: string) => ({
      success: true,
      data: []
    })
  } as McpAtlassianClient;
}

// Helper function to create mock issue
function createMockIssue(key: string, statusId: string, statusName: string, created: string): JiraIssue {
  // Determine status category based on status name or ID
  let statusCategory: { id: number; name: 'To Do' | 'In Progress' | 'Done'; colorName: string };
  
  if (statusName === 'Done' || statusId === '10003') {
    statusCategory = { id: 3, name: 'Done', colorName: 'green' };
  } else if (statusName === 'In Progress' || statusId === '10002') {
    statusCategory = { id: 2, name: 'In Progress', colorName: 'yellow' };
  } else {
    statusCategory = { id: 1, name: 'To Do', colorName: 'blue-gray' };
  }

  return {
    id: key,
    key,
    summary: `Test issue ${key}`,
    description: null,
    status: {
      id: statusId,
      name: statusName,
      statusCategory
    },
    priority: {
      id: '3',
      name: 'Medium',
      iconUrl: 'https://example.com/medium.png'
    },
    issueType: {
      id: '1',
      name: 'Story',
      iconUrl: 'https://example.com/story.png',
      subtask: false
    },
    assignee: null,
    reporter: {
      accountId: 'test-user',
      displayName: 'Test User',
      emailAddress: 'test@example.com',
      avatarUrls: {
        '16x16': '',
        '24x24': '',
        '32x32': '',
        '48x48': ''
      }
    },
    created,
    updated: created,
    resolved: null
  };
}

// Helper function to create mock changelog
function createMockChangelog(
  issueKey: string, 
  statusTransitions: Array<{ date: string, fromStatus: string | null, toStatus: string, toStatusName: string }>
) {
  const histories = statusTransitions.map(transition => ({
    created: transition.date,
    createdTimestamp: new Date(transition.date).getTime(),
    items: [{
      field: 'status',
      fromString: transition.fromStatus,
      toString: transition.toStatusName,
      from: transition.fromStatus,
      to: transition.toStatus
    }]
  }));

  const statusTransitionIndex = new Map<string, string>();
  statusTransitions.forEach(transition => {
    if (!statusTransitionIndex.has(transition.toStatus)) {
      statusTransitionIndex.set(transition.toStatus, transition.date);
    }
  });

  return {
    issueKey,
    histories,
    statusTransitionIndex
  };
}

describe('extractAllColumnStatusIds', () => {
  test('should combine toDoStatusIds and doneStatusIds without duplicates', async () => {
    const toDoStatusIds = ['10001', '10002'];
    const doneStatusIds = ['10003', '10001']; // '10001' is duplicate
    const mockClient = createMockMcpClient();
    
    const result = await extractAllColumnStatusIds(toDoStatusIds, doneStatusIds, mockClient, 'board-1');
    
    expect(result).toEqual(['10001', '10002', '10003']);
    expect(result).toHaveLength(3); // No duplicates
  });

  test('should handle empty status arrays', async () => {
    const toDoStatusIds: string[] = [];
    const doneStatusIds: string[] = [];
    const mockClient = createMockMcpClient();
    
    const result = await extractAllColumnStatusIds(toDoStatusIds, doneStatusIds, mockClient, 'board-1');
    
    expect(result).toEqual([]);
  });
});

describe('calculateIssueStatusTimes', () => {
  test('should calculate time spent in each status correctly', async () => {
    // Create issue with status NOT in column statuses initially to avoid double creation
    const issue = createMockIssue('TEST-1', '10000', 'Backlog', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002', '10003'];
    
    const changelogData = {
      'TEST-1': createMockChangelog('TEST-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T14:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' },
        { date: '2024-01-03T16:00:00.000Z', fromStatus: '10002', toStatus: '10003', toStatusName: 'Done' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    expect(result.issueKey).toBe('TEST-1');
    expect(result.boardId).toBe('board-1');
    expect(result.statusTimes).toHaveLength(3);
    
    // Check To Do status (10001): from 10:00 to 14:00 next day = 28 hours
    const toDoStatus = result.statusTimes.find(st => st.statusId === '10001');
    expect(toDoStatus).toBeDefined();
    expect(toDoStatus!.statusName).toBe('To Do');
    expect(toDoStatus!.timeSpentHours).toBeCloseTo(28, 1);
    expect(toDoStatus!.timeSpentDays).toBeCloseTo(28/24, 1);
    expect(toDoStatus!.entryDate).toBe('2024-01-01T10:00:00.000Z');
    expect(toDoStatus!.exitDate).toBe('2024-01-02T14:00:00.000Z');
    
    // Check In Progress status (10002): from 14:00 to 16:00 next day = 26 hours
    const inProgressStatus = result.statusTimes.find(st => st.statusId === '10002');
    expect(inProgressStatus).toBeDefined();
    expect(inProgressStatus!.statusName).toBe('In Progress');
    expect(inProgressStatus!.timeSpentHours).toBeCloseTo(26, 1);
    expect(inProgressStatus!.entryDate).toBe('2024-01-02T14:00:00.000Z');
    expect(inProgressStatus!.exitDate).toBe('2024-01-03T16:00:00.000Z');
    
    // Check Done status (10003): still active, so exitDate should be null
    const doneStatus = result.statusTimes.find(st => st.statusId === '10003');
    expect(doneStatus).toBeDefined();
    expect(doneStatus!.statusName).toBe('Done');
    expect(doneStatus!.entryDate).toBe('2024-01-03T16:00:00.000Z');
    expect(doneStatus!.exitDate).toBeNull();
    expect(doneStatus!.timeSpentHours).toBeGreaterThan(0); // Should have some time elapsed
  });

  test('should handle issue created directly in column status', async () => {
    const issue = createMockIssue('TEST-2', '10001', 'To Do', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002'];
    
    const changelogData = {
      'TEST-2': createMockChangelog('TEST-2', [
        { date: '2024-01-02T10:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    expect(result.statusTimes).toHaveLength(2);
    
    // Should include creation as initial status entry
    const initialStatus = result.statusTimes.find(st => st.statusId === '10001');
    expect(initialStatus).toBeDefined();
    expect(initialStatus!.entryDate).toBe('2024-01-01T09:00:00.000Z');
    expect(initialStatus!.exitDate).toBe('2024-01-02T10:00:00.000Z');
  });

  test('should ignore transitions to non-column statuses', async () => {
    const issue = createMockIssue('TEST-3', '99999', 'Other Status', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002']; // 99999 is not in column statuses
    
    const changelogData = {
      'TEST-3': createMockChangelog('TEST-3', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T14:00:00.000Z', fromStatus: '10001', toStatus: '99999', toStatusName: 'Other Status' },
        { date: '2024-01-03T16:00:00.000Z', fromStatus: '99999', toStatus: '10002', toStatusName: 'In Progress' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    // Should only have 2 status times (ignoring 99999)
    expect(result.statusTimes).toHaveLength(2);
    expect(result.statusTimes.some(st => st.statusId === '99999')).toBe(false);
    expect(result.statusTimes.some(st => st.statusId === '10001')).toBe(true);
    expect(result.statusTimes.some(st => st.statusId === '10002')).toBe(true);
  });

  test('should handle changelog fetch failure gracefully', async () => {
    const issue = createMockIssue('TEST-4', '10001', 'To Do', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002'];
    
    // Client returns failure for this issue
    const mockClient = createMockMcpClient({});
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    expect(result.issueKey).toBe('TEST-4');
    expect(result.statusTimes).toEqual([]);
  });

  test('should handle empty changelog', async () => {
    const issue = createMockIssue('TEST-5', '10001', 'To Do', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002'];
    
    const changelogData = {
      'TEST-5': {
        issueKey: 'TEST-5',
        histories: [],
        statusTransitionIndex: new Map()
      }
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    // Should include initial status if issue is created in a column status
    expect(result.statusTimes).toHaveLength(1);
    expect(result.statusTimes[0].statusId).toBe('10001');
    expect(result.statusTimes[0].entryDate).toBe('2024-01-01T09:00:00.000Z');
    expect(result.statusTimes[0].exitDate).toBeNull();
  });
});

describe('calculateIssuesStatusTimes', () => {
  test('should calculate status times for multiple issues', async () => {
    const issues = [
      createMockIssue('TEST-1', '10002', 'In Progress', '2024-01-01T09:00:00.000Z'),
      createMockIssue('TEST-2', '10003', 'Done', '2024-01-01T10:00:00.000Z')
    ];
    const columnStatusIds = ['10001', '10002', '10003'];
    
    const changelogData = {
      'TEST-1': createMockChangelog('TEST-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: '10002', toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T14:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' }
      ]),
      'TEST-2': createMockChangelog('TEST-2', [
        { date: '2024-01-01T11:00:00.000Z', fromStatus: '10003', toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T12:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const results = await calculateIssuesStatusTimes(issues, 'board-1', columnStatusIds, mockClient);
    
    expect(results).toHaveLength(2);
    
    // TEST-1 should have 3 status times: creation (In Progress), To Do, In Progress
    const test1Result = results.find(r => r.issueKey === 'TEST-1');
    expect(test1Result).toBeDefined();
    expect(test1Result!.statusTimes).toHaveLength(3);
    
    // Verify TEST-1 status progression
    const test1Sorted = test1Result!.statusTimes.toSorted((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    expect(test1Sorted[0].statusId).toBe('10002'); // Creation In Progress (09:00-10:00)
    expect(test1Sorted[1].statusId).toBe('10001'); // To Do (10:00-14:00 next day)
    expect(test1Sorted[2].statusId).toBe('10002'); // In Progress (14:00-ongoing)
    
    // TEST-2 should have 3 status times: creation (Done), To Do, Done
    const test2Result = results.find(r => r.issueKey === 'TEST-2');
    expect(test2Result).toBeDefined();
    expect(test2Result!.statusTimes).toHaveLength(3);
    
    // Verify TEST-2 status progression
    const test2Sorted = test2Result!.statusTimes.toSorted((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    expect(test2Sorted[0].statusId).toBe('10003'); // Creation Done (10:00-11:00)
    expect(test2Sorted[1].statusId).toBe('10001'); // To Do (11:00-12:00 next day)
    expect(test2Sorted[2].statusId).toBe('10003'); // Done (12:00-ongoing)
  });

  test('should handle errors for individual issues gracefully', async () => {
    const issues = [
      createMockIssue('TEST-1', '10001', 'To Do', '2024-01-01T09:00:00.000Z'),
      createMockIssue('TEST-2', '10002', 'In Progress', '2024-01-01T10:00:00.000Z')
    ];
    const columnStatusIds = ['10001', '10002'];
    
    // Only provide changelog for TEST-1, TEST-2 will fail
    const changelogData = {
      'TEST-1': createMockChangelog('TEST-1', [
        { date: '2024-01-02T10:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const results = await calculateIssuesStatusTimes(issues, 'board-1', columnStatusIds, mockClient);
    
    expect(results).toHaveLength(2);
    
    const test1Result = results.find(r => r.issueKey === 'TEST-1');
    expect(test1Result!.statusTimes.length).toBeGreaterThan(0);
    
    const test2Result = results.find(r => r.issueKey === 'TEST-2');
    expect(test2Result!.statusTimes).toEqual([]); // Empty due to error
  });
});

describe('Status Time Calculation Edge Cases', () => {
  test('should handle issues that skip statuses', async () => {
    const issue = createMockIssue('TEST-SKIP', '10003', 'Done', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002', '10003'];
    
    // Issue goes directly from To Do (10001) to Done (10003), skipping In Progress (10002)
    const changelogData = {
      'TEST-SKIP': createMockChangelog('TEST-SKIP', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: '10003', toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T16:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    // Should have 3 status times: creation (Done), To Do, Done (final)
    expect(result.statusTimes).toHaveLength(3);
    expect(result.statusTimes.some(st => st.statusId === '10002')).toBe(false); // No In Progress
    
    // Sort status times chronologically to verify correct sequence
    const sortedStatusTimes = result.statusTimes.toSorted((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    // Creation Done period: from 09:00 to 10:00 = 1 hour
    expect(sortedStatusTimes[0].statusId).toBe('10003');
    expect(sortedStatusTimes[0].timeSpentHours).toBeCloseTo(1, 1);
    expect(sortedStatusTimes[0].entryDate).toBe('2024-01-01T09:00:00.000Z');
    expect(sortedStatusTimes[0].exitDate).toBe('2024-01-01T10:00:00.000Z');
    
    // To Do period: from 10:00 to 16:00 next day = 30 hours
    expect(sortedStatusTimes[1].statusId).toBe('10001');
    expect(sortedStatusTimes[1].timeSpentHours).toBeCloseTo(30, 1); // ~30 hours from 10:00 to 16:00 next day
    expect(sortedStatusTimes[1].entryDate).toBe('2024-01-01T10:00:00.000Z');
    expect(sortedStatusTimes[1].exitDate).toBe('2024-01-02T16:00:00.000Z');
    
    // Final Done period: from 16:00 ongoing
    expect(sortedStatusTimes[2].statusId).toBe('10003');
    expect(sortedStatusTimes[2].entryDate).toBe('2024-01-02T16:00:00.000Z');
    expect(sortedStatusTimes[2].exitDate).toBeNull(); // Still ongoing
    expect(sortedStatusTimes[2].timeSpentHours).toBeGreaterThan(0);
  });

  test('should handle issues that move back and forth between statuses', async () => {
    // Create issue with current status as In Progress (the final state)
    const issue = createMockIssue('TEST-BACKFORTH', '10002', 'In Progress', '2024-01-01T09:00:00.000Z');
    const columnStatusIds = ['10001', '10002'];
    
    // Issue moves: first in column -> To Do -> In Progress -> To Do -> In Progress (back-and-forth)
    const changelogData = {
      'TEST-BACKFORTH': createMockChangelog('TEST-BACKFORTH', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: '10002', toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T10:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' },
        { date: '2024-01-03T10:00:00.000Z', fromStatus: '10002', toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-04T10:00:00.000Z', fromStatus: '10001', toStatus: '10002', toStatusName: 'In Progress' }
      ])
    };
    
    const mockClient = createMockMcpClient(changelogData);
    
    const result = await calculateIssueStatusTimes(issue, 'board-1', columnStatusIds, mockClient);
    
    // Should have 5 entries: creation (10002, 09:00-10:00) + 4 changelog transitions
    expect(result.statusTimes).toHaveLength(5);
    
    // Verify each status time period in chronological order
    const sortedStatusTimes = result.statusTimes.toSorted((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    // Creation In Progress period: from 09:00 to 10:00 = 1 hour
    expect(sortedStatusTimes[0].statusId).toBe('10002');
    expect(sortedStatusTimes[0].timeSpentHours).toBeCloseTo(1, 1);
    expect(sortedStatusTimes[0].entryDate).toBe('2024-01-01T09:00:00.000Z');
    expect(sortedStatusTimes[0].exitDate).toBe('2024-01-01T10:00:00.000Z');
    
    // First To Do period: from 10:00 to 10:00 next day = 24 hours
    expect(sortedStatusTimes[1].statusId).toBe('10001');
    expect(sortedStatusTimes[1].timeSpentHours).toBeCloseTo(24, 1);
    expect(sortedStatusTimes[1].entryDate).toBe('2024-01-01T10:00:00.000Z');
    expect(sortedStatusTimes[1].exitDate).toBe('2024-01-02T10:00:00.000Z');
    
    // First In Progress period: from 10:00 to 10:00 next day = 24 hours
    expect(sortedStatusTimes[2].statusId).toBe('10002');
    expect(sortedStatusTimes[2].timeSpentHours).toBeCloseTo(24, 1);
    expect(sortedStatusTimes[2].entryDate).toBe('2024-01-02T10:00:00.000Z');
    expect(sortedStatusTimes[2].exitDate).toBe('2024-01-03T10:00:00.000Z');
    
    // Second To Do period: from 10:00 to 10:00 next day = 24 hours
    expect(sortedStatusTimes[3].statusId).toBe('10001');
    expect(sortedStatusTimes[3].timeSpentHours).toBeCloseTo(24, 1);
    expect(sortedStatusTimes[3].entryDate).toBe('2024-01-03T10:00:00.000Z');
    expect(sortedStatusTimes[3].exitDate).toBe('2024-01-04T10:00:00.000Z');
    
    // Second In Progress period: ongoing (exitDate should be null)
    expect(sortedStatusTimes[4].statusId).toBe('10002');
    expect(sortedStatusTimes[4].entryDate).toBe('2024-01-04T10:00:00.000Z');
    expect(sortedStatusTimes[4].exitDate).toBeNull();
    expect(sortedStatusTimes[4].timeSpentHours).toBeGreaterThan(0); // Should have elapsed time
  });
});