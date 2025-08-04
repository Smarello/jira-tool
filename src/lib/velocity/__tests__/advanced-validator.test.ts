/**
 * Test suite for advanced validation business logic
 * Following Clean Code: Descriptive test names, AAA pattern  
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateValidatedStoryPoints,
  filterValidIssuesForVelocity
} from '../advanced-validator.js';
import type { AdvancedValidationResult } from '../advanced-validator.js';
import type { JiraIssueWithPoints } from '../../jira/issues-api.js';

// Test fixtures
const createMockIssue = (
  id: string,
  storyPoints: number | null = null,
  key: string = `TEST-${id}`
): JiraIssueWithPoints => ({
  id,
  key,
  summary: `Test Issue ${id}`,
  storyPoints,
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
    name: 'Story',
    iconUrl: 'https://example.com/story.png',
    subtask: false
  },
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-15T00:00:00.000Z',
  resolved: null,
  description: `Description for ${key}`,
  reporter: {
    accountId: 'reporter-123',
    displayName: 'Test Reporter',
    emailAddress: 'reporter@example.com',
    avatarUrls: {
      '16x16': 'https://example.com/16x16.png',
      '24x24': 'https://example.com/24x24.png',
      '32x32': 'https://example.com/32x32.png',
      '48x48': 'https://example.com/48x48.png'
    }
  },
  assignee: null,
  statusCategoryChangedDate: null
});

const createValidationResult = (
  isValid: boolean,
  doneTransitionDate?: string
): AdvancedValidationResult => ({
  isValidForVelocity: isValid,
  doneTransitionDate,
  reason: isValid ? 'done_at_sprint_end' : 'not_valid'
});

describe('calculateValidatedStoryPoints', () => {
  test('should calculate total story points for valid issues only', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),   // Valid issue
      createMockIssue('2', 8),   // Valid issue  
      createMockIssue('3', 3),   // Invalid issue
      createMockIssue('4', null), // No story points
      createMockIssue('5', 13)   // Invalid issue
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(true),
      createValidationResult(false),
      createValidationResult(false),
      createValidationResult(false)
    ];

    // Act
    const result = calculateValidatedStoryPoints(issues, validationResults);

    // Assert
    // Only issues 1 and 2 are valid: 5 + 8 = 13 points
    expect(result).toBe(13);
  });

  test('should return 0 when no issues are valid', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8),
      createMockIssue('3', 3)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(false),
      createValidationResult(false),
      createValidationResult(false)
    ];

    // Act
    const result = calculateValidatedStoryPoints(issues, validationResults);

    // Assert
    expect(result).toBe(0);
  });

  test('should handle issues with null story points', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),    // Valid with points
      createMockIssue('2', null), // Valid but no points
      createMockIssue('3', 8),    // Valid with points
      createMockIssue('4', null)  // Invalid, no points
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(true),
      createValidationResult(true),
      createValidationResult(false)
    ];

    // Act
    const result = calculateValidatedStoryPoints(issues, validationResults);

    // Assert
    // Only issues 1 and 3 contribute: 5 + 8 = 13 points (issue 2 has null points)
    expect(result).toBe(13);
  });

  test('should handle empty arrays', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [];
    const validationResults: AdvancedValidationResult[] = [];

    // Act
    const result = calculateValidatedStoryPoints(issues, validationResults);

    // Assert
    expect(result).toBe(0);
  });

  test('should handle mismatched array lengths gracefully', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true)
      // Missing validation for issue '2'
    ];

    // Act
    const result = calculateValidatedStoryPoints(issues, validationResults);

    // Assert
    // Only issue 1 should be counted: 5 points
    expect(result).toBe(5);
  });
});

describe('filterValidIssuesForVelocity', () => {
  test('should return only valid issues based on validation results', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8),
      createMockIssue('3', 3),
      createMockIssue('4', 13)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(false),
      createValidationResult(true),
      createValidationResult(false)
    ];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('should return empty array when no issues are valid', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(false),
      createValidationResult(false)
    ];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    expect(result).toHaveLength(0);
  });

  test('should return all issues when all are valid', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8),
      createMockIssue('3', 3)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(true),
      createValidationResult(true)
    ];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    expect(result).toHaveLength(3);
    expect(result.map(issue => issue.id)).toEqual(['1', '2', '3']);
  });

  test('should handle empty arrays', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [];
    const validationResults: AdvancedValidationResult[] = [];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    expect(result).toHaveLength(0);
  });

  test('should handle validation results shorter than issues array', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5),
      createMockIssue('2', 8),
      createMockIssue('3', 3)
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(false)
      // Missing validation for issue '3'
    ];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    // Only issue 1 should be returned (issue 3 has no validation result)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('should preserve issue properties in filtered results', () => {
    // Arrange
    const issues: JiraIssueWithPoints[] = [
      createMockIssue('1', 5, 'PROJ-123'),
      createMockIssue('2', 8, 'PROJ-456')
    ];

    const validationResults: AdvancedValidationResult[] = [
      createValidationResult(true),
      createValidationResult(true)
    ];

    // Act
    const result = filterValidIssuesForVelocity(issues, validationResults);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      id: '1',
      key: 'PROJ-123',
      storyPoints: 5
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      id: '2', 
      key: 'PROJ-456',
      storyPoints: 8
    }));
  });
}); 