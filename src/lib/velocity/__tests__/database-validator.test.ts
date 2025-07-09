/**
 * Test suite for database validation business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateSprintVelocityWithDatabase,
  batchCalculateSprintVelocityWithDatabase,
  issuesHaveCompletionDates
} from '../database-validator.js';
import type { JiraIssueWithPoints } from '../../jira/issues-api.js';
import type { JiraSprint } from '../../jira/boards.js';

// Test fixtures
const createMockSprint = (
  id: string,
  name: string,
  startDate: string = '2024-01-01T00:00:00.000Z',
  endDate: string = '2024-01-14T23:59:59.999Z'
): JiraSprint => ({
  id,
  name,
  state: 'closed',
  startDate,
  endDate,
  originBoardId: 'board-123',
  goal: `Goal for ${name}`
});

const createMockIssueWithCompletion = (
  id: string,
  storyPoints: number | null = null,
  completionDate?: string
): JiraIssueWithPoints => ({
  id,
  key: `TEST-${id}`,
  summary: `Test Issue ${id}`,
  storyPoints,
  status: { name: 'Done' },
  priority: { name: 'Medium' },
  issueType: { name: 'Story' },
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-15T00:00:00.000Z',
  assignee: null,
  completionDate
});

describe('issuesHaveCompletionDates', () => {
  test('should return true when all issues have completion dates', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z'),
      createMockIssueWithCompletion('2', 8, '2024-01-12T00:00:00.000Z'),
      createMockIssueWithCompletion('3', 3, '2024-01-14T00:00:00.000Z')
    ];

    // Act
    const result = issuesHaveCompletionDates(issues);

    // Assert
    expect(result).toBe(true);
  });

  test('should return true when some issues have completion dates', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z'),
      createMockIssueWithCompletion('2', 8), // No completion date
      createMockIssueWithCompletion('3', 3, '2024-01-14T00:00:00.000Z')
    ];

    // Act
    const result = issuesHaveCompletionDates(issues);

    // Assert
    expect(result).toBe(true); // At least one issue has completion date
  });

  test('should return false for empty array', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [];

    // Act
    const result = issuesHaveCompletionDates(issues);

    // Assert
    expect(result).toBe(false); // No issues means no completion dates
  });

  test('should return false when all issues lack completion dates', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5),
      createMockIssueWithCompletion('2', 8),
      createMockIssueWithCompletion('3', 3)
    ];

    // Act
    const result = issuesHaveCompletionDates(issues);

    // Assert
    expect(result).toBe(false);
  });
});

describe('calculateSprintVelocityWithDatabase', () => {
  test('should calculate velocity correctly for issues completed during sprint', () => {
    // Arrange
    const sprint = createMockSprint('1', 'Sprint 1', '2024-01-01T00:00:00.000Z', '2024-01-14T23:59:59.999Z');
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z'),  // During sprint
      createMockIssueWithCompletion('2', 8, '2024-01-12T00:00:00.000Z'),  // During sprint
      createMockIssueWithCompletion('3', 3, '2024-01-16T00:00:00.000Z'),  // After sprint end
      createMockIssueWithCompletion('4', 2) // No completion date
    ];

    // Act
    const result = calculateSprintVelocityWithDatabase(sprint, issues);

    // Assert
    expect(result.totalPoints).toBe(18); // 5 + 8 + 3 + 2 = 18
    expect(result.validPoints).toBe(13); // Only issues 1 and 2: 5 + 8 = 13
    expect(result.validationResults).toHaveLength(4);
  });

  test('should handle sprint with no completed issues', () => {
    // Arrange
    const sprint = createMockSprint('2', 'Sprint 2');
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5, '2024-01-16T00:00:00.000Z'),  // After sprint
      createMockIssueWithCompletion('2', 8), // No completion date
      createMockIssueWithCompletion('3', 3, '2024-01-20T00:00:00.000Z')   // After sprint
    ];

    // Act
    const result = calculateSprintVelocityWithDatabase(sprint, issues);

    // Assert
    expect(result.totalPoints).toBe(16); // 5 + 8 + 3 = 16
    expect(result.validPoints).toBe(0);  // No valid issues (all after sprint or no completion date)
  });

  test('should handle issues with null story points', () => {
    // Arrange
    const sprint = createMockSprint('3', 'Sprint 3');
    const issues: JiraIssueWithPoints[] = [
      createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z'),
      createMockIssueWithCompletion('2', null, '2024-01-12T00:00:00.000Z'), // No points
      createMockIssueWithCompletion('3', 8, '2024-01-14T00:00:00.000Z')
    ];

    // Act
    const result = calculateSprintVelocityWithDatabase(sprint, issues);

    // Assert
    expect(result.totalPoints).toBe(13); // 5 + 0 + 8 = 13
    expect(result.validPoints).toBe(13); // All completed during sprint: 5 + 0 + 8 = 13
  });

  test('should handle empty issues array', () => {
    // Arrange
    const sprint = createMockSprint('4', 'Sprint 4');
    const issues: JiraIssueWithPoints[] = [];

    // Act
    const result = calculateSprintVelocityWithDatabase(sprint, issues);

    // Assert
    expect(result.totalPoints).toBe(0);
    expect(result.validPoints).toBe(0);
    expect(result.validationResults).toHaveLength(0);
  });
});

describe('batchCalculateSprintVelocityWithDatabase', () => {
  test('should calculate velocity for multiple sprints', () => {
    // Arrange
    const sprintIssuesPairs = [
      {
        sprint: createMockSprint('1', 'Sprint 1'),
        issues: [
          createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z'),
          createMockIssueWithCompletion('2', 8, '2024-01-12T00:00:00.000Z')
        ]
      },
      {
        sprint: createMockSprint('2', 'Sprint 2'),
        issues: [
          createMockIssueWithCompletion('3', 3, '2024-01-10T00:00:00.000Z'),
          createMockIssueWithCompletion('4', 13, '2024-01-16T00:00:00.000Z') // After sprint
        ]
      }
    ];

    // Act
    const results = batchCalculateSprintVelocityWithDatabase(sprintIssuesPairs);

    // Assert
    expect(results).toHaveLength(2);
    
    // Sprint 1 results
    expect(results[0].sprintId).toBe('1');
    expect(results[0].totalPoints).toBe(13); // 5 + 8
    expect(results[0].validPoints).toBe(13); // Both during sprint
    
    // Sprint 2 results
    expect(results[1].sprintId).toBe('2');
    expect(results[1].totalPoints).toBe(16); // 3 + 13
    expect(results[1].validPoints).toBe(3);  // Only first issue during sprint
  });

  test('should handle empty sprints array', () => {
    // Arrange
    const sprintIssuesPairs: Array<{sprint: JiraSprint, issues: JiraIssueWithPoints[]}> = [];

    // Act
    const results = batchCalculateSprintVelocityWithDatabase(sprintIssuesPairs);

    // Assert
    expect(results).toHaveLength(0);
  });

  test('should handle sprints with no issues', () => {
    // Arrange
    const sprintIssuesPairs = [
      {
        sprint: createMockSprint('1', 'Sprint 1'),
        issues: []
      },
      {
        sprint: createMockSprint('2', 'Sprint 2'),
        issues: [
          createMockIssueWithCompletion('1', 5, '2024-01-10T00:00:00.000Z')
        ]
      }
    ];

    // Act
    const results = batchCalculateSprintVelocityWithDatabase(sprintIssuesPairs);

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0].totalPoints).toBe(0);
    expect(results[0].validPoints).toBe(0);
    expect(results[1].totalPoints).toBe(5);
    expect(results[1].validPoints).toBe(5);
  });
}); 