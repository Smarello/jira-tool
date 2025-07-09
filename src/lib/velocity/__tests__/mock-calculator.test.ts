/**
 * Test suite for velocity calculation business logic
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import {
  calculateSprintVelocity,
  calculateAverageVelocity,
  analyzeVelocityTrend,
  calculateVelocityPredictability,
  createVelocityData,
  type SprintVelocity
} from '../mock-calculator.js';
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

describe('calculateSprintVelocity', () => {
  test('should calculate velocity correctly for closed sprint', () => {
    // Arrange
    const sprint = createMockSprint('1', 'Sprint 1', 'closed');
    const committedPoints = 20;
    const completedPoints = 18;

    // Act
    const result = calculateSprintVelocity(sprint, committedPoints, completedPoints);

    // Assert
    expect(result).toEqual({
      sprint,
      committedPoints: 20,
      completedPoints: 18,
      velocityPoints: 18, // Same as completed for closed sprint
      completionRate: 90  // (18/20) * 100 = 90%
    });
  });

  test('should set velocity to 0 for active sprint regardless of completed points', () => {
    // Arrange
    const sprint = createMockSprint('2', 'Sprint 2', 'active');
    const committedPoints = 20;
    const completedPoints = 15;

    // Act
    const result = calculateSprintVelocity(sprint, committedPoints, completedPoints);

    // Assert
    expect(result.velocityPoints).toBe(0);
    expect(result.completedPoints).toBe(15);
    expect(result.completionRate).toBe(75);
  });

  test('should handle zero committed points without division by zero', () => {
    // Arrange
    const sprint = createMockSprint('3', 'Sprint 3', 'closed');
    const committedPoints = 0;
    const completedPoints = 0;

    // Act
    const result = calculateSprintVelocity(sprint, committedPoints, completedPoints);

    // Assert
    expect(result.completionRate).toBe(0);
    expect(result.velocityPoints).toBe(0);
  });

  test('should round completion rate to nearest integer', () => {
    // Arrange
    const sprint = createMockSprint('4', 'Sprint 4', 'closed');
    const committedPoints = 13;
    const completedPoints = 10; // 76.923... should round to 77

    // Act
    const result = calculateSprintVelocity(sprint, committedPoints, completedPoints);

    // Assert
    expect(result.completionRate).toBe(77);
  });
});

describe('calculateAverageVelocity', () => {
  test('should calculate average velocity from multiple closed sprints', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 18,
        velocityPoints: 18,
        completionRate: 90
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 25,
        completedPoints: 22,
        velocityPoints: 22,
        completionRate: 88
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 15,
        completedPoints: 15,
        velocityPoints: 15,
        completionRate: 100
      }
    ];

    // Act
    const result = calculateAverageVelocity(sprints);

    // Assert
    // Average = (18 + 22 + 15) / 3 = 55 / 3 = 18.33... rounds to 18
    expect(result).toBe(18);
  });

  test('should ignore active sprints in average calculation', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 100
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'active'),
        committedPoints: 15,
        completedPoints: 10,
        velocityPoints: 0, // Active sprint has 0 velocity
        completionRate: 67
      }
    ];

    // Act
    const result = calculateAverageVelocity(sprints);

    // Assert
    // Should only consider closed sprint: 20 / 1 = 20
    expect(result).toBe(20);
  });

  test('should return 0 when no closed sprints exist', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'active'),
        committedPoints: 20,
        completedPoints: 15,
        velocityPoints: 0,
        completionRate: 75
      }
    ];

    // Act
    const result = calculateAverageVelocity(sprints);

    // Assert
    expect(result).toBe(0);
  });

  test('should return 0 for empty sprint array', () => {
    // Arrange
    const sprints: SprintVelocity[] = [];

    // Act
    const result = calculateAverageVelocity(sprints);

    // Assert
    expect(result).toBe(0);
  });
});

describe('analyzeVelocityTrend', () => {
  test('should detect increasing trend with sufficient data', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 10,
        completedPoints: 10,
        velocityPoints: 10,
        completionRate: 100
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 15,
        completedPoints: 15,
        velocityPoints: 15,
        completionRate: 100
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 22,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 91
      }
    ];

    // Act
    const result = analyzeVelocityTrend(sprints);

    // Assert
    // 10 -> 15 (50% increase) -> 20 (33% increase): significant upward trend
    expect(result).toBe('increasing');
  });

  test('should detect decreasing trend with sufficient data', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 25,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 80
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 20,
        completedPoints: 15,
        velocityPoints: 15,
        completionRate: 75
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 15,
        completedPoints: 10,
        velocityPoints: 10,
        completionRate: 67
      }
    ];

    // Act
    const result = analyzeVelocityTrend(sprints);

    // Assert
    // 20 -> 15 (-25%) -> 10 (-33%): significant downward trend
    expect(result).toBe('decreasing');
  });

  test('should detect stable trend when changes are small', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 19,
        velocityPoints: 19,
        completionRate: 95
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 20,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 100
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 20,
        completedPoints: 18,
        velocityPoints: 18,
        completionRate: 90
      }
    ];

    // Act
    const result = analyzeVelocityTrend(sprints);

    // Assert
    // Small variations around 19: stable trend
    expect(result).toBe('stable');
  });

  test('should return stable for insufficient sprints', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 18,
        velocityPoints: 18,
        completionRate: 90
      }
    ];

    // Act
    const result = analyzeVelocityTrend(sprints);

    // Assert
    expect(result).toBe('stable');
  });
});

describe('calculateVelocityPredictability', () => {
  test('should calculate high predictability for consistent velocities', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 100
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 20,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 100
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 20,
        completedPoints: 20,
        velocityPoints: 20,
        completionRate: 100
      }
    ];

    // Act
    const result = calculateVelocityPredictability(sprints);

    // Assert
    // Perfect consistency should give high predictability
    expect(result).toBeGreaterThan(90);
  });

  test('should calculate low predictability for erratic velocities', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 30,
        completedPoints: 5,
        velocityPoints: 5,
        completionRate: 17
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 15,
        completedPoints: 15,
        velocityPoints: 15,
        completionRate: 100
      },
      {
        sprint: createMockSprint('3', 'Sprint 3', 'closed'),
        committedPoints: 25,
        completedPoints: 25,
        velocityPoints: 25,
        completionRate: 100
      }
    ];

    // Act
    const result = calculateVelocityPredictability(sprints);

    // Assert
    // High variation (5, 15, 25) should give low predictability
    expect(result).toBeLessThan(70);
  });

  test('should return 100% for insufficient data', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 18,
        velocityPoints: 18,
        completionRate: 90
      }
    ];

    // Act
    const result = calculateVelocityPredictability(sprints);

    // Assert
    expect(result).toBe(100);
  });

  test('should handle zero average velocity', () => {
    // Arrange
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 0,
        velocityPoints: 0,
        completionRate: 0
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 15,
        completedPoints: 0,
        velocityPoints: 0,
        completionRate: 0
      }
    ];

    // Act
    const result = calculateVelocityPredictability(sprints);

    // Assert
    expect(result).toBe(100); // Perfect predictability when all are zero
  });
});

describe('createVelocityData', () => {
  test('should create comprehensive velocity data structure', () => {
    // Arrange
    const boardId = 'board-123';
    const boardName = 'Test Board';
    const sprints: SprintVelocity[] = [
      {
        sprint: createMockSprint('1', 'Sprint 1', 'closed'),
        committedPoints: 20,
        completedPoints: 18,
        velocityPoints: 18,
        completionRate: 90
      },
      {
        sprint: createMockSprint('2', 'Sprint 2', 'closed'),
        committedPoints: 22,
        completedPoints: 22,
        velocityPoints: 22,
        completionRate: 100
      }
    ];

    // Act
    const result = createVelocityData(boardId, boardName, sprints);

    // Assert
    expect(result).toEqual({
      boardId: 'board-123',
      boardName: 'Test Board',
      sprints: sprints,
      averageVelocity: 20, // (18 + 22) / 2 = 20
      trend: expect.any(String),
      predictability: expect.any(Number)
    });

    expect(result.averageVelocity).toBeGreaterThan(0);
    expect(result.predictability).toBeGreaterThanOrEqual(0);
    expect(result.predictability).toBeLessThanOrEqual(100);
  });

  test('should handle empty sprints array', () => {
    // Arrange
    const boardId = 'board-empty';
    const boardName = 'Empty Board';
    const sprints: SprintVelocity[] = [];

    // Act
    const result = createVelocityData(boardId, boardName, sprints);

    // Assert
    expect(result).toEqual({
      boardId: 'board-empty',
      boardName: 'Empty Board',
      sprints: [],
      averageVelocity: 0,
      trend: 'stable',
      predictability: 100
    });
  });
}); 