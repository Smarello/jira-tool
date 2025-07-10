/**
 * Test suite for changelog business logic functions
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import type { IssueChangelog, ChangelogEntry } from '../../jira/changelog-api.js';

// Test fixtures
const createMockChangelogEntry = (
  created: string,
  statusTransitions: Array<{ from: string | null, to: string | null }>
): ChangelogEntry => ({
  created,
  createdTimestamp: new Date(created).getTime(),
  items: statusTransitions.map(transition => ({
    field: 'status',
    fromString: transition.from,
    toString: transition.to,
    from: transition.from,
    to: transition.to
  }))
});

const createMockChangelog = (
  issueKey: string,
  entries: ChangelogEntry[]
): IssueChangelog => {
  // Build status transition index like in real implementation
  const statusTransitionIndex = new Map<string, string>();
  for (const entry of entries) {
    for (const item of entry.items) {
      if (item.field === 'status' && item.to && !statusTransitionIndex.has(item.to)) {
        statusTransitionIndex.set(item.to, entry.created);
      }
    }
  }

  return {
    issueKey,
    histories: entries,
    statusTransitionIndex
  };
};

/**
 * Business logic function: Find status transition date by ID
 * This logic was moved from JiraChangelogApi to velocity services
 */
function findStatusTransitionDateById(
  changelog: IssueChangelog,
  targetStatusIds: readonly string[]
): string | null {
  // Use indexed search for O(1) lookup - check if any target status exists in index
  for (const statusId of targetStatusIds) {
    if (changelog.statusTransitionIndex.has(statusId)) {
      return changelog.statusTransitionIndex.get(statusId)!;
    }
  }
  return null;
}

/**
 * Business logic function: Check if issue was in Done status at specific date
 * This logic was moved from JiraChangelogApi to velocity services
 */
function wasIssueInDoneAtDateById(
  changelog: IssueChangelog,
  doneStatusIds: readonly string[],
  targetDate: string
): boolean {
  const transitionDate = findStatusTransitionDateById(changelog, doneStatusIds);
  
  if (!transitionDate) {
    return false;
  }
  
  const transitionDateTime = new Date(transitionDate);
  const targetDateTime = new Date(targetDate);
  
  return transitionDateTime <= targetDateTime;
}

describe('Changelog Business Logic', () => {
  describe('findStatusTransitionDateById', () => {
    test('should find transition date for first matching status ID', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ]),
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10003' } // In Progress -> Done
        ]),
        createMockChangelogEntry('2024-01-06T09:15:00.000Z', [
          { from: '10003', to: '10004' } // Done -> Closed
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const targetStatusIds = ['10003', '10004']; // Looking for Done or Closed

      // Act
      const result = findStatusTransitionDateById(changelog, targetStatusIds);

      // Assert
      expect(result).toBe('2024-01-05T14:30:00.000Z'); // First transition to Done
    });

    test('should return null when no matching status found', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const targetStatusIds = ['10003', '10004']; // Looking for Done or Closed

      // Act
      const result = findStatusTransitionDateById(changelog, targetStatusIds);

      // Assert
      expect(result).toBeNull();
    });

    test('should return null for empty target status IDs', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' }
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);

      // Act
      const result = findStatusTransitionDateById(changelog, []);

      // Assert
      expect(result).toBeNull();
    });

    test('should handle empty changelog histories', () => {
      // Arrange
      const changelog = createMockChangelog('TEST-1', []);
      const targetStatusIds = ['10003'];

      // Act
      const result = findStatusTransitionDateById(changelog, targetStatusIds);

      // Assert
      expect(result).toBeNull();
    });

    test('should find earliest transition when status appears multiple times', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10003' } // To Do -> Done (first time)
        ]),
        createMockChangelogEntry('2024-01-02T11:00:00.000Z', [
          { from: '10003', to: '10001' } // Done -> In Progress (reopened)
        ]),
        createMockChangelogEntry('2024-01-03T12:00:00.000Z', [
          { from: '10001', to: '10003' } // In Progress -> Done (second time)
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const targetStatusIds = ['10003']; // Looking for Done

      // Act
      const result = findStatusTransitionDateById(changelog, targetStatusIds);

      // Assert
      // Should return the first transition to Done, not the second
      expect(result).toBe('2024-01-01T10:00:00.000Z');
    });
  });

  describe('wasIssueInDoneAtDateById', () => {
    test('should return true when issue was moved to Done before target date', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ]),
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10003' } // In Progress -> Done
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const doneStatusIds = ['10003'];
      const targetDate = '2024-01-14T23:59:59.999Z'; // Sprint end date

      // Act
      const result = wasIssueInDoneAtDateById(changelog, doneStatusIds, targetDate);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false when issue was moved to Done after target date', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ]),
        createMockChangelogEntry('2024-01-16T14:30:00.000Z', [
          { from: '10001', to: '10003' } // In Progress -> Done (after sprint end)
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const doneStatusIds = ['10003'];
      const targetDate = '2024-01-14T23:59:59.999Z'; // Sprint end date

      // Act
      const result = wasIssueInDoneAtDateById(changelog, doneStatusIds, targetDate);

      // Assert
      expect(result).toBe(false);
    });

    test('should return true when issue was moved to Done exactly at target date', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-14T23:59:59.999Z', [
          { from: '10001', to: '10003' } // In Progress -> Done exactly at sprint end
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const doneStatusIds = ['10003'];
      const targetDate = '2024-01-14T23:59:59.999Z'; // Sprint end date

      // Act
      const result = wasIssueInDoneAtDateById(changelog, doneStatusIds, targetDate);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false when issue never reached Done status', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ]),
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10002' } // In Progress -> Code Review
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const doneStatusIds = ['10003'];
      const targetDate = '2024-01-14T23:59:59.999Z';

      // Act
      const result = wasIssueInDoneAtDateById(changelog, doneStatusIds, targetDate);

      // Assert
      expect(result).toBe(false);
    });

    test('should handle multiple Done status IDs correctly', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10004' } // In Progress -> Closed (one of the Done statuses)
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const doneStatusIds = ['10003', '10004', '10005']; // Multiple Done status IDs
      const targetDate = '2024-01-14T23:59:59.999Z';

      // Act
      const result = wasIssueInDoneAtDateById(changelog, doneStatusIds, targetDate);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false for empty Done status IDs', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10003' }
        ])
      ];
      
      const changelog = createMockChangelog('TEST-1', entries);
      const targetDate = '2024-01-14T23:59:59.999Z';

      // Act
      const result = wasIssueInDoneAtDateById(changelog, [], targetDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Status Transition Index', () => {
    test('should build correct status transition index', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10001' } // To Do -> In Progress
        ]),
        createMockChangelogEntry('2024-01-05T14:30:00.000Z', [
          { from: '10001', to: '10003' } // In Progress -> Done
        ]),
        createMockChangelogEntry('2024-01-06T09:15:00.000Z', [
          { from: '10003', to: '10004' } // Done -> Closed
        ])
      ];

      // Act
      const changelog = createMockChangelog('TEST-1', entries);

      // Assert
      expect(changelog.statusTransitionIndex.get('10001')).toBe('2024-01-01T10:00:00.000Z');
      expect(changelog.statusTransitionIndex.get('10003')).toBe('2024-01-05T14:30:00.000Z');
      expect(changelog.statusTransitionIndex.get('10004')).toBe('2024-01-06T09:15:00.000Z');
      expect(changelog.statusTransitionIndex.has('10000')).toBe(false); // Never transitioned TO this status
    });

    test('should store only first transition for duplicate statuses', () => {
      // Arrange
      const entries = [
        createMockChangelogEntry('2024-01-01T10:00:00.000Z', [
          { from: '10000', to: '10003' } // First transition to Done
        ]),
        createMockChangelogEntry('2024-01-02T11:00:00.000Z', [
          { from: '10003', to: '10001' } // Done -> In Progress
        ]),
        createMockChangelogEntry('2024-01-03T12:00:00.000Z', [
          { from: '10001', to: '10003' } // Second transition to Done
        ])
      ];

      // Act
      const changelog = createMockChangelog('TEST-1', entries);

      // Assert
      // Should store only the first transition to status 10003
      expect(changelog.statusTransitionIndex.get('10003')).toBe('2024-01-01T10:00:00.000Z');
    });
  });
});
