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
    name: 'Done'
  },
  priority: {
    name: 'Medium'
  },
  issueType: {
    name: 'Story'
  },
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-15T00:00:00.000Z',
  assignee: null
});

const createValidationResult = (
  issueId: string,
  isValid: boolean,
  doneTransitionDate?: string
): AdvancedValidationResult => ({
  issueId,
  isValidForVelocity: isValid,
  doneTransitionDate,
  reason: isValid ? 'Valid issue' : 'Invalid for velocity'
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
      createValidationResult('1', true),
      createValidationResult('2', true),
      createValidationResult('3', false),
      createValidationResult('4', false),
      createValidationResult('5', false)
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
      createValidationResult('1', false),
      createValidationResult('2', false),
      createValidationResult('3', false)
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
      createValidationResult('1', true),
      createValidationResult('2', true),
      createValidationResult('3', true),
      createValidationResult('4', false)
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
      createValidationResult('1', true)
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
      createValidationResult('1', true),
      createValidationResult('2', false),
      createValidationResult('3', true),
      createValidationResult('4', false)
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
      createValidationResult('1', false),
      createValidationResult('2', false)
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
      createValidationResult('1', true),
      createValidationResult('2', true),
      createValidationResult('3', true)
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
      createValidationResult('1', true),
      createValidationResult('2', false)
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
      createValidationResult('1', true),
      createValidationResult('2', true)
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