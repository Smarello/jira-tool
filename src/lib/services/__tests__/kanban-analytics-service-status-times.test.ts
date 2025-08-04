/**
 * Integration tests for Kanban Analytics Service with Status Times
 * Tests the complete analytics flow including status time calculations
 * Following Clean Code: Integration testing, realistic scenarios
 */

// Mock the Jira config to avoid environment variable dependency
jest.mock('../../jira/config.js', () => ({
  createJiraConfig: jest.fn(() => ({
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    projectKey: 'TEST'
  }))
}));

// Jest globals are available without import
import type { JiraIssue } from '../../jira/types';
import type { McpAtlassianClient } from '../../mcp/atlassian';
import { calculateKanbanAnalytics } from '../kanban-analytics-service';

// Mock MCP client for integration testing
function createMockMcpClient(boardIssues: JiraIssue[], changelogData: Record<string, any>): McpAtlassianClient {
  return {
    getBoardIssues: async (_boardId: string, _updatedSince?: string) => ({
      success: true,
      data: boardIssues
    }),
    
    getBoardToDoStatusIds: async (_boardId: string) => ({
      success: true,  
      data: ['10001'] // To Do
    }),
    
    getBoardDoneStatusIds: async (_boardId: string) => ({
      success: true,
      data: ['10003'] // Done
    }),
    
    getIssueChangelog: async (issueKey: string) => {
      if (changelogData[issueKey]) {
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
    getProjectBoards: async (_projectKey: string) => ({
      success: true,
      data: []
    }),
    
    getBoardSprints: async (_boardId: string) => ({
      success: true,
      data: []
    }),
    
    getBoardInfo: async (_boardId: string) => ({
      success: true,
      data: {} as any
    }),
    
    getSprintDetails: async (_sprintId: string) => ({
      success: true,
      data: {} as any
    }),
    
    getSprintIssues: async (_sprintId: string) => ({
      success: true,
      data: []
    })
  } as McpAtlassianClient;
}

// Helper to create mock issue
function createMockIssue(
  key: string, 
  statusId: string, 
  statusName: string, 
  created: string,
  issueTypeName: string = 'Story'
): JiraIssue {
  return {
    id: key,
    key,
    summary: `Test issue ${key}`,
    description: null,
    status: {
      id: statusId,
      name: statusName,
      statusCategory: {
        id: statusId === '10003' ? 3 : 1,
        name: statusId === '10003' ? 'Done' : 'To Do',
        colorName: statusId === '10003' ? 'green' : 'blue-gray'
      }
    },
    priority: {
      id: '3',
      name: 'Medium',
      iconUrl: 'https://example.com/medium.png'
    },
    issueType: {
      id: '1',
      name: issueTypeName,
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
    resolved: statusId === '10003' ? created : null
  };
}

// Helper to create mock changelog
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

describe('Kanban Analytics Service with Status Times', () => {
  test('should include status times in issue details', async () => {
    const boardIssues = [
      createMockIssue('PROJ-1', '10003', 'Done', '2024-01-01T09:00:00.000Z'),
      createMockIssue('PROJ-2', '10003', 'Done', '2024-01-01T10:00:00.000Z')
    ];

    // Use only column statuses that are configured in the mock client (10001 and 10003)
    const changelogData = {
      'PROJ-1': createMockChangelog('PROJ-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-03T16:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ]),
      'PROJ-2': createMockChangelog('PROJ-2', [
        { date: '2024-01-01T11:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T15:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    // KanbanAnalyticsResult doesn't have a success field, it's the result itself
    expect(result).toBeDefined();
    expect(result.totalIssues).toBe(2);
    expect(result.completedIssues).toBe(2);
    expect(result.issuesDetails).toHaveLength(2);

    // Check first issue has status times
    const proj1Detail = result.issuesDetails.find(issue => issue.key === 'PROJ-1');
    expect(proj1Detail).toBeDefined();
    expect(proj1Detail!.statusTimes).toBeDefined();
    expect(proj1Detail!.statusTimes!.length).toBeGreaterThan(0);

    // Verify status times structure
    const statusTimes = proj1Detail!.statusTimes!;
    expect(statusTimes.every(st => 
      typeof st.statusId === 'string' &&
      typeof st.statusName === 'string' &&
      typeof st.timeSpentHours === 'number' &&
      typeof st.timeSpentDays === 'number' &&
      typeof st.entryDate === 'string'
    )).toBe(true);

    // Verify we have the expected statuses (10001 - To Do, 10003 - Done)
    const statusIds = statusTimes.map(st => st.statusId);
    expect(statusIds).toContain('10001'); // To Do
    expect(statusIds).toContain('10003'); // Done

    // Check second issue (simpler flow: To Do -> Done)
    const proj2Detail = result.issuesDetails.find(issue => issue.key === 'PROJ-2');
    expect(proj2Detail).toBeDefined();
    expect(proj2Detail!.statusTimes).toBeDefined();
    expect(proj2Detail!.statusTimes!.length).toBeGreaterThan(0);
    
    // Verify PROJ-2 also has the expected column statuses
    const proj2StatusIds = proj2Detail!.statusTimes!.map(st => st.statusId);
    expect(proj2StatusIds).toContain('10001'); // To Do
    expect(proj2StatusIds).toContain('10003'); // Done
  });

  test('should handle issues with different status flows', async () => {
    const boardIssues = [
      createMockIssue('FAST-1', '10003', 'Done', '2024-01-01T09:00:00.000Z'), // Quick completion
      createMockIssue('SLOW-1', '10003', 'Done', '2024-01-01T09:00:00.000Z')  // Slow completion with back-and-forth
    ];

    // Use only column statuses (10001 and 10003) - avoid 10002 since it's not in mock client
    const changelogData = {
      'FAST-1': createMockChangelog('FAST-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-01T14:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ]),
      'SLOW-1': createMockChangelog('SLOW-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T10:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' },
        { date: '2024-01-03T10:00:00.000Z', fromStatus: '10003', toStatus: '10001', toStatusName: 'To Do' }, // Back to To Do
        { date: '2024-01-04T10:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    expect(result.completedIssues).toBe(2);
    expect(result.issuesDetails).toHaveLength(2);

    // Fast issue should have simple status times
    const fastDetail = result.issuesDetails.find(issue => issue.key === 'FAST-1');
    expect(fastDetail!.statusTimes!.length).toBe(2); // To Do and Done

    const fastToDoTime = fastDetail!.statusTimes!.find(st => st.statusId === '10001');
    expect(fastToDoTime!.timeSpentHours).toBeCloseTo(4, 1); // 4 hours from 10:00 to 14:00

    // Slow issue should have multiple status entries due to back-and-forth
    const slowDetail = result.issuesDetails.find(issue => issue.key === 'SLOW-1');
    expect(slowDetail!.statusTimes!.length).toBeGreaterThan(2); // Multiple entries due to transitions

    // Should have multiple To Do entries (back-and-forth between To Do and Done)
    const slowToDoTimes = slowDetail!.statusTimes!.filter(st => st.statusId === '10001');
    expect(slowToDoTimes.length).toBe(2); // Two separate To Do periods
    
    // Should also have multiple Done entries
    const slowDoneTimes = slowDetail!.statusTimes!.filter(st => st.statusId === '10003');
    expect(slowDoneTimes.length).toBe(2); // Two separate Done periods
  });

  test('should only include column statuses in status times', async () => {
    const boardIssues = [
      createMockIssue('PROJ-1', '10003', 'Done', '2024-01-01T09:00:00.000Z')
    ];

    // Include transitions to non-column statuses (e.g., 99999)
    const changelogData = {
      'PROJ-1': createMockChangelog('PROJ-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T10:00:00.000Z', fromStatus: '10001', toStatus: '99999', toStatusName: 'Other Status' }, // Non-column status
        { date: '2024-01-03T10:00:00.000Z', fromStatus: '99999', toStatus: '10003', toStatusName: 'Done' }
      ])
    };

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    expect(result.completedIssues).toBe(1);
    
    const issueDetail = result.issuesDetails[0];
    expect(issueDetail.statusTimes).toBeDefined();
    
    // Should not include status 99999 (non-column status)
    const hasNonColumnStatus = issueDetail.statusTimes!.some(st => st.statusId === '99999');
    expect(hasNonColumnStatus).toBe(false);
    
    // Should only include column statuses (10001, 10003 from To Do and Done status IDs)
    const allStatusIds = issueDetail.statusTimes!.map(st => st.statusId);
    expect(allStatusIds.every(id => ['10001', '10003'].includes(id))).toBe(true);
    
    // Should have both To Do and Done statuses
    expect(allStatusIds).toContain('10001'); // To Do
    expect(allStatusIds).toContain('10003'); // Done
  });

  test('should handle empty status times gracefully', async () => {
    const boardIssues = [
      createMockIssue('PROJ-1', '10003', 'Done', '2024-01-01T09:00:00.000Z')
    ];

    // Issue with no changelog or failed changelog fetch
    const changelogData = {}; // Empty - will cause changelog fetch to fail

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    expect(result.totalIssues).toBe(1);
    // May have 0 completed issues if changelog is required for completion detection
    
    if (result.issuesDetails.length > 0) {
      const issueDetail = result.issuesDetails[0];
      expect(issueDetail.statusTimes).toBeDefined();
      expect(Array.isArray(issueDetail.statusTimes)).toBe(true);
      // Should be empty array, not undefined
    }
  });

  test('should calculate correct time ranges for status times', async () => {
    const boardIssues = [
      createMockIssue('TIME-1', '10003', 'Done', '2024-01-01T08:00:00.000Z')
    ];

    const changelogData = {
      'TIME-1': createMockChangelog('TIME-1', [
        { date: '2024-01-01T09:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-01T17:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    const issueDetail = result.issuesDetails[0];
    const toDoStatus = issueDetail.statusTimes!.find(st => st.statusId === '10001');
    
    expect(toDoStatus).toBeDefined();
    expect(toDoStatus!.entryDate).toBe('2024-01-01T09:00:00.000Z');
    expect(toDoStatus!.exitDate).toBe('2024-01-01T17:00:00.000Z');
    expect(toDoStatus!.timeSpentHours).toBeCloseTo(8, 1); // 8 hours from 09:00 to 17:00
    expect(toDoStatus!.timeSpentDays).toBeCloseTo(8/24, 2); // 1/3 of a day
  });

  test('should maintain consistency between cycle time and status times', async () => {
    const boardIssues = [
      createMockIssue('CONSISTENCY-1', '10003', 'Done', '2024-01-01T08:00:00.000Z')
    ];

    const changelogData = {
      'CONSISTENCY-1': createMockChangelog('CONSISTENCY-1', [
        { date: '2024-01-01T10:00:00.000Z', fromStatus: null, toStatus: '10001', toStatusName: 'To Do' },
        { date: '2024-01-02T14:00:00.000Z', fromStatus: '10001', toStatus: '10003', toStatusName: 'Done' }
      ])
    };

    const mockClient = createMockMcpClient(boardIssues, changelogData);
    
    const result = await calculateKanbanAnalytics('board-1', mockClient);

    const issueDetail = result.issuesDetails[0];
    
    // Calculate total time spent in all statuses
    const totalStatusTimeHours = issueDetail.statusTimes!.reduce((total, st) => 
      st.exitDate ? total + st.timeSpentHours : total, 0
    );
    
    // Should be approximately equal to cycle time
    const cycleTimeHours = issueDetail.cycleTimeDays! * 24;
    expect(totalStatusTimeHours).toBeCloseTo(cycleTimeHours, 0); // Within 1 hour tolerance
  });
});