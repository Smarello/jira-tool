/**
 * Test suite for velocity calculator business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateAverageSprintCompletionRate
} from '../calculator.js';
import type { SprintVelocity } from '../mock-calculator.js';
import type { JiraSprint } from '../../jira/boards.js';

// Test fixtures
const createMockSprint = (id: string, name: string, state: 'active' | 'closed' | 'future' = 'closed'): JiraSprint => ({
  id,
  name,
  state,
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-14T23:59:59.999Z',
  originBoardId: 'board-123',
  goal: `Goal for ${name}`
});

const createSprintVelocity = (
  id: string,
  name: string,
  state: 'active' | 'closed' | 'future',
  completionRate: number
): SprintVelocity => ({
  sprint: createMockSprint(id, name, state),
  committedPoints: 20,
  completedPoints: Math.round((completionRate / 100) * 20),
  velocityPoints: state === 'closed' ? Math.round((completionRate / 100) * 20) : 0,
  completionRate
});

describe('calculateAverageSprintCompletionRate', () => {
  test('should calculate average completion rate from multiple closed sprints', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 90),
      createSprintVelocity('2', 'Sprint 2', 'closed', 85),
      createSprintVelocity('3', 'Sprint 3', 'closed', 95),
      createSprintVelocity('4', 'Sprint 4', 'closed', 80)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    // Average = (90 + 85 + 95 + 80) / 4 = 350 / 4 = 87.5 rounds to 88
    expect(result).toBe(88);
  });

  test('should ignore active sprints in completion rate calculation', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 90),
      createSprintVelocity('2', 'Sprint 2', 'closed', 80),
      createSprintVelocity('3', 'Sprint 3', 'active', 75), // Should be ignored
      createSprintVelocity('4', 'Sprint 4', 'future', 0)   // Should be ignored
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    // Should only consider closed sprints: (90 + 80) / 2 = 85
    expect(result).toBe(85);
  });

  test('should return 0 when no closed sprints exist', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'active', 75),
      createSprintVelocity('2', 'Sprint 2', 'future', 0)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    expect(result).toBe(0);
  });

  test('should return 0 for empty sprints array', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    expect(result).toBe(0);
  });

  test('should handle single closed sprint', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 92)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    expect(result).toBe(92);
  });

  test('should round to nearest integer for fractional averages', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 85),
      createSprintVelocity('2', 'Sprint 2', 'closed', 86),
      createSprintVelocity('3', 'Sprint 3', 'closed', 87)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    // Average = (85 + 86 + 87) / 3 = 258 / 3 = 86
    expect(result).toBe(86);
  });

  test('should handle sprints with 0% completion rate', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 0),
      createSprintVelocity('2', 'Sprint 2', 'closed', 100),
      createSprintVelocity('3', 'Sprint 3', 'closed', 50)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    // Average = (0 + 100 + 50) / 3 = 150 / 3 = 50
    expect(result).toBe(50);
  });

  test('should handle sprints with 100% completion rate', () => {
    // Arrange
    const sprintVelocities: SprintVelocity[] = [
      createSprintVelocity('1', 'Sprint 1', 'closed', 100),
      createSprintVelocity('2', 'Sprint 2', 'closed', 100),
      createSprintVelocity('3', 'Sprint 3', 'closed', 100)
    ];

    // Act
    const result = calculateAverageSprintCompletionRate(sprintVelocities);

    // Assert
    expect(result).toBe(100);
  });
}); 