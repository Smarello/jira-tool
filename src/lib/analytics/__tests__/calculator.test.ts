/**
 * Test suite for analytics calculation business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateDashboardMetrics,
  calculatePercentage
} from '../calculator.js';
import type { JiraIssue } from '../../jira/types.js';

// Test fixtures
const createMockIssue = (
  id: string,
  status: string,
  statusCategory: string,
  priority: string,
  issueType: string,
  created: string = '2024-01-01T00:00:00.000Z',
  resolved: string | null = null
): JiraIssue => ({
  id,
  key: `TEST-${id}`,
  summary: `Test Issue ${id}`,
  description: `Description for test issue ${id}`,
  created,
  updated: created,
  resolved,
  status: {
    name: status,
    statusCategory: {
      name: statusCategory
    }
  },
  priority: {
    name: priority
  },
  issueType: {
    name: issueType
  },
  assignee: null,
  reporter: {
    displayName: 'Test User'
  },
  customFields: {}
});

describe('calculateDashboardMetrics', () => {
  test('should calculate comprehensive metrics for mixed issues', () => {
    // Arrange
    const issues: JiraIssue[] = [
      createMockIssue('1', 'To Do', 'To Do', 'High', 'Story'),
      createMockIssue('2', 'In Progress', 'In Progress', 'Medium', 'Bug'),
      createMockIssue('3', 'Done', 'Done', 'Low', 'Task', '2024-01-01T00:00:00.000Z', '2024-01-03T00:00:00.000Z'),
      createMockIssue('4', 'Done', 'Done', 'High', 'Story', '2024-01-01T00:00:00.000Z', '2024-01-05T00:00:00.000Z'),
      createMockIssue('5', 'To Do', 'To Do', 'Medium', 'Epic')
    ];

    // Act
    const result = calculateDashboardMetrics(issues);

    // Assert
    expect(result).toEqual({
      totalIssues: 5,
      openIssues: 2,        // 2 issues with "To Do" status category
      inProgressIssues: 1,  // 1 issue with "In Progress" status category
      resolvedIssues: 2,    // 2 issues with "Done" status category
      averageResolutionDays: 3, // (2 + 4) / 2 = 3 days average
      issuesByPriority: [
        { priority: 'High', count: 2 },
        { priority: 'Medium', count: 2 },
        { priority: 'Low', count: 1 }
      ],
      issuesByType: [
        { type: 'Story', count: 2 },
        { type: 'Bug', count: 1 },
        { type: 'Task', count: 1 },
        { type: 'Epic', count: 1 }
      ]
    });
  });

  test('should handle empty issues array', () => {
    // Arrange
    const issues: JiraIssue[] = [];

    // Act
    const result = calculateDashboardMetrics(issues);

    // Assert
    expect(result).toEqual({
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      resolvedIssues: 0,
      averageResolutionDays: 0,
      issuesByPriority: [],
      issuesByType: []
    });
  });

  test('should handle issues with no resolved dates', () => {
    // Arrange
    const issues: JiraIssue[] = [
      createMockIssue('1', 'To Do', 'To Do', 'High', 'Story'),
      createMockIssue('2', 'In Progress', 'In Progress', 'Medium', 'Bug'),
      createMockIssue('3', 'Done', 'Done', 'Low', 'Task') // No resolved date
    ];

    // Act
    const result = calculateDashboardMetrics(issues);

    // Assert
    expect(result.averageResolutionDays).toBe(0); // No resolved issues with dates
    expect(result.resolvedIssues).toBe(1); // But still count as resolved
  });

  test('should calculate correct resolution days for various durations', () => {
    // Arrange
    const issues: JiraIssue[] = [
      createMockIssue('1', 'Done', 'Done', 'High', 'Story', '2024-01-01T10:00:00.000Z', '2024-01-01T14:00:00.000Z'), // Same day = 1 day
      createMockIssue('2', 'Done', 'Done', 'Medium', 'Bug', '2024-01-01T00:00:00.000Z', '2024-01-08T00:00:00.000Z'), // 7 days
      createMockIssue('3', 'Done', 'Done', 'Low', 'Task', '2024-01-01T00:00:00.000Z', '2024-01-16T00:00:00.000Z') // 15 days
    ];

    // Act
    const result = calculateDashboardMetrics(issues);

    // Assert
    // Average = (1 + 7 + 15) / 3 = 23 / 3 = 7.67... rounds to 8
    expect(result.averageResolutionDays).toBe(8);
  });

  test('should sort priority and type counts by frequency descending', () => {
    // Arrange
    const issues: JiraIssue[] = [
      createMockIssue('1', 'Done', 'Done', 'Low', 'Bug'),     // Low: 3, Bug: 2
      createMockIssue('2', 'Done', 'Done', 'Low', 'Bug'),
      createMockIssue('3', 'Done', 'Done', 'Low', 'Story'),   // Story: 1
      createMockIssue('4', 'Done', 'Done', 'High', 'Task'),   // High: 1, Task: 1
    ];

    // Act
    const result = calculateDashboardMetrics(issues);

    // Assert
    expect(result.issuesByPriority).toEqual([
      { priority: 'Low', count: 3 },  // Most frequent first
      { priority: 'High', count: 1 }
    ]);

    expect(result.issuesByType).toEqual([
      { type: 'Bug', count: 2 },     // Most frequent first
      { type: 'Story', count: 1 },
      { type: 'Task', count: 1 }
    ]);
  });
});

describe('calculatePercentage', () => {
  test('should calculate percentage correctly for normal values', () => {
    // Arrange & Act & Assert
    expect(calculatePercentage(25, 100)).toBe(25);
    expect(calculatePercentage(1, 3)).toBe(33); // 33.33... rounds to 33
    expect(calculatePercentage(2, 3)).toBe(67); // 66.66... rounds to 67
    expect(calculatePercentage(3, 3)).toBe(100);
  });

  test('should handle zero total without division by zero', () => {
    // Arrange & Act & Assert
    expect(calculatePercentage(5, 0)).toBe(0);
    expect(calculatePercentage(0, 0)).toBe(0);
  });

  test('should handle zero part correctly', () => {
    // Arrange & Act & Assert
    expect(calculatePercentage(0, 100)).toBe(0);
    expect(calculatePercentage(0, 50)).toBe(0);
  });

  test('should round to nearest integer', () => {
    // Arrange & Act & Assert
    expect(calculatePercentage(1, 6)).toBe(17); // 16.66... rounds to 17
    expect(calculatePercentage(1, 7)).toBe(14); // 14.28... rounds to 14
    expect(calculatePercentage(5, 7)).toBe(71); // 71.42... rounds to 71
  });

  test('should handle percentages over 100%', () => {
    // Arrange & Act & Assert
    expect(calculatePercentage(150, 100)).toBe(150);
    expect(calculatePercentage(75, 50)).toBe(150);
  });
}); 