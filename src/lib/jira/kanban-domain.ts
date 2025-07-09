/**
 * Kanban Domain Value Objects and Business Logic
 * Following Clean Architecture and Domain-Driven Design principles
 * 
 * Value Objects are immutable and encapsulate business rules
 */

import type { 
  CycleTime, 
  ColumnMapping, 
  KanbanIssue, 
  KanbanBoard, 
  ColumnTransition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  StatusMapping
} from './types.js';

/**
 * CycleTime Value Object implementation
 * Encapsulates cycle time calculation logic and business rules
 */
export class CycleTimeVO implements CycleTime {
  readonly startDate: string;
  readonly endDate: string;
  readonly durationDays: number;
  readonly durationHours: number;
  readonly isEstimated: boolean;
  readonly calculationMethod: 'board_entry' | 'creation_date';

  private constructor(
    startDate: string,
    endDate: string,
    calculationMethod: 'board_entry' | 'creation_date'
  ) {
    this.startDate = startDate;
    this.endDate = endDate;
    this.calculationMethod = calculationMethod;
    this.isEstimated = calculationMethod === 'creation_date';
    
    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    
    this.durationHours = Math.max(0, diffMs / (1000 * 60 * 60));
    this.durationDays = Math.max(0, this.durationHours / 24);
  }

  /**
   * Factory method to create CycleTime from board entry date
   * Preferred method when issue has a clear board entry date
   */
  static fromBoardEntry(boardEntryDate: string, doneDate: string): CycleTimeVO {
    if (!boardEntryDate || !doneDate) {
      throw new Error('Board entry date and done date are required');
    }
    
    return new CycleTimeVO(boardEntryDate, doneDate, 'board_entry');
  }

  /**
   * Factory method to create CycleTime from creation date
   * Fallback method when board entry date is not available
   */
  static fromCreationDate(creationDate: string, doneDate: string): CycleTimeVO {
    if (!creationDate || !doneDate) {
      throw new Error('Creation date and done date are required');
    }
    
    return new CycleTimeVO(creationDate, doneDate, 'creation_date');
  }

  /**
   * Check if cycle time is within reasonable bounds
   * Business rule: cycle time should be positive and not exceed 2 years
   */
  isReasonable(): boolean {
    const maxDays = 730; // 2 years
    return this.durationDays > 0 && this.durationDays <= maxDays;
  }

  /**
   * Get human-readable duration string
   */
  toHumanString(): string {
    if (this.durationDays < 1) {
      return `${Math.round(this.durationHours)}h`;
    } else if (this.durationDays < 7) {
      return `${Math.round(this.durationDays)}d`;
    } else {
      const weeks = Math.round(this.durationDays / 7);
      return `${weeks}w`;
    }
  }

  /**
   * Compare with another cycle time
   */
  isGreaterThan(other: CycleTime): boolean {
    return this.durationDays > other.durationDays;
  }

  isLessThan(other: CycleTime): boolean {
    return this.durationDays < other.durationDays;
  }
}

/**
 * ColumnMapping Value Object implementation
 * Encapsulates board column to status mapping logic
 */
export class ColumnMappingVO implements ColumnMapping {
  readonly boardId: string;
  readonly mappings: readonly StatusMapping[];
  readonly doneColumns: readonly string[];
  readonly inProgressColumns: readonly string[];
  readonly todoColumns: readonly string[];

  constructor(
    boardId: string,
    mappings: readonly StatusMapping[],
    doneColumns: readonly string[] = [],
    inProgressColumns: readonly string[] = [],
    todoColumns: readonly string[] = []
  ) {
    this.boardId = boardId;
    this.mappings = mappings;
    this.doneColumns = doneColumns;
    this.inProgressColumns = inProgressColumns;
    this.todoColumns = todoColumns;
  }

  /**
   * Get column name for a given status ID
   */
  getColumnForStatus(statusId: string): string | null {
    const mapping = this.mappings.find(m => m.statusId === statusId);
    return mapping?.columnName || null;
  }

  /**
   * Check if a column represents "Done" state
   */
  isDoneColumn(columnName: string): boolean {
    return this.doneColumns.includes(columnName);
  }

  /**
   * Check if a column represents work in progress
   */
  isInProgressColumn(columnName: string): boolean {
    return this.inProgressColumns.includes(columnName);
  }

  /**
   * Check if a column represents todo/backlog
   */
  isTodoColumn(columnName: string): boolean {
    return this.todoColumns.includes(columnName);
  }

  /**
   * Get all statuses for a specific column
   */
  getStatusesForColumn(columnName: string): readonly StatusMapping[] {
    return this.mappings.filter(m => m.columnName === columnName);
  }

  /**
   * Validate the column mapping configuration
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Business rule: Must have at least one "Done" column
    if (this.doneColumns.length === 0) {
      errors.push({
        code: 'NO_DONE_COLUMN',
        message: 'Board must have at least one column marked as "Done"',
        field: 'doneColumns'
      });
    }

    // Business rule: All columns should have at least one status
    const columnsWithoutStatuses = this.getAllColumns().filter(
      column => this.getStatusesForColumn(column).length === 0
    );
    
    columnsWithoutStatuses.forEach(column => {
      warnings.push({
        code: 'EMPTY_COLUMN',
        message: `Column "${column}" has no mapped statuses`,
        field: 'mappings',
        suggestion: 'Consider removing empty columns or mapping statuses to them'
      });
    });

    // Business rule: Each status should be mapped to exactly one column
    const statusOccurrences = new Map<string, number>();
    this.mappings.forEach(mapping => {
      const count = statusOccurrences.get(mapping.statusId) || 0;
      statusOccurrences.set(mapping.statusId, count + 1);
    });

    statusOccurrences.forEach((count, statusId) => {
      if (count > 1) {
        errors.push({
          code: 'DUPLICATE_STATUS_MAPPING',
          message: `Status ${statusId} is mapped to multiple columns`,
          field: 'mappings',
          context: { statusId, occurrences: count }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get all unique column names
   */
  private getAllColumns(): string[] {
    const allColumns = [
      ...this.doneColumns,
      ...this.inProgressColumns,
      ...this.todoColumns
    ];
    return [...new Set(allColumns)];
  }
}

/**
 * Business Logic Functions for Kanban Domain
 */

/**
 * Helper function to check if a column is marked as "Done"
 */
function isDoneColumn(columnName: string, columnMapping: ColumnMapping): boolean {
  return columnMapping.doneColumns.includes(columnName);
}

/**
 * Helper function to get column name for a status ID
 */
function getColumnForStatus(statusId: string, columnMapping: ColumnMapping): string | null {
  const mapping = columnMapping.mappings.find(m => m.statusId === statusId);
  return mapping?.columnName || null;
}

/**
 * Check if an issue should be excluded from cycle time calculations
 * Business rules based on PRD requirements
 */
export function shouldExcludeIssue(issue: KanbanIssue, columnMapping: ColumnMapping): boolean {
  // Exclude if issue was reopened after being done
  if (issue.isReopened) {
    return true;
  }

  // Exclude if issue never reached a "Done" column
  if (!issue.lastDoneDate) {
    return true;
  }

  // Exclude if current status is not in a "Done" column
  if (issue.currentColumn && !isDoneColumn(issue.currentColumn, columnMapping)) {
    return true;
  }

  return false;
}

/**
 * Calculate the most recent "Done" transition for an issue
 * Returns the last time the issue entered any "Done" column
 */
export function getLastDoneTransition(
  columnHistory: readonly ColumnTransition[], 
  columnMapping: ColumnMapping
): ColumnTransition | null {
  // Find all transitions to "Done" columns
  const doneTransitions = columnHistory.filter(transition => 
    transition.toColumn && isDoneColumn(transition.toColumn, columnMapping)
  );

  if (doneTransitions.length === 0) {
    return null;
  }

  // Return the most recent one
  return doneTransitions.reduce((latest, current) => {
    return new Date(current.transitionDate) > new Date(latest.transitionDate) 
      ? current 
      : latest;
  });
}

/**
 * Find the first board entry transition for an issue
 * Returns the first transition into any column of the board
 */
export function getBoardEntryTransition(
  columnHistory: readonly ColumnTransition[],
  columnMapping: ColumnMapping
): ColumnTransition | null {
  // Find transitions into any mapped column (excluding transitions from null)
  const entryTransitions = columnHistory.filter(transition => 
    transition.fromColumn === null && 
    transition.toColumn &&
    getColumnForStatus(transition.toStatus, columnMapping) !== null
  );

  if (entryTransitions.length === 0) {
    return null;
  }

  // Return the earliest one
  return entryTransitions.reduce((earliest, current) => {
    return new Date(current.transitionDate) < new Date(earliest.transitionDate) 
      ? current 
      : earliest;
  });
}

/**
 * Determine if an issue was reopened after being in a "Done" state
 */
export function checkIfReopened(
  columnHistory: readonly ColumnTransition[],
  columnMapping: ColumnMapping
): boolean {
  let wasInDone = false;
  
  for (const transition of columnHistory) {
    // If moving to a Done column
    if (transition.toColumn && isDoneColumn(transition.toColumn, columnMapping)) {
      wasInDone = true;
    }
    
    // If moving out of a Done column to a non-Done column after being in Done
    if (wasInDone && 
        transition.fromColumn && 
        isDoneColumn(transition.fromColumn, columnMapping) &&
        transition.toColumn &&
        !isDoneColumn(transition.toColumn, columnMapping)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate Kanban board configuration
 * Comprehensive validation following business rules from PRD
 */
export function validateKanbanBoard(board: KanbanBoard): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Board must be of type 'kanban'
  if (board.type !== 'kanban') {
    errors.push({
      code: 'INVALID_BOARD_TYPE',
      message: 'Board must be of type "kanban"',
      field: 'type',
      context: { actualType: board.type }
    });
  }

  // Board must have column configuration
  if (!board.columnConfig || board.columnConfig.columns.length === 0) {
    errors.push({
      code: 'MISSING_COLUMN_CONFIG',
      message: 'Board must have column configuration',
      field: 'columnConfig'
    });
  } else {
    // At least one column must be configured as "Done"
    const hasValidDoneColumn = board.columnConfig.columns.some(column =>
      column.statuses.some(status => status.statusCategory.name === 'Done')
    );

    if (!hasValidDoneColumn) {
      errors.push({
        code: 'NO_DONE_STATUS',
        message: 'Board must have at least one column with "Done" status',
        field: 'columnConfig.columns'
      });
    }

    // Warn about columns without constraints
    board.columnConfig.columns.forEach((column, index) => {
      if (!column.min && !column.max) {
        warnings.push({
          code: 'NO_WIP_LIMITS',
          message: `Column "${column.name}" has no WIP limits configured`,
          field: `columnConfig.columns[${index}]`,
          suggestion: 'Consider adding WIP limits to improve flow'
        });
      }
    });
  }

  // Board filter should have valid JQL
  if (!board.filter.jql || board.filter.jql.trim().length === 0) {
    warnings.push({
      code: 'EMPTY_JQL_FILTER',
      message: 'Board filter has empty JQL query',
      field: 'filter.jql',
      suggestion: 'Define JQL filter to ensure correct issue scope'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Type guards for runtime type checking

export function isCycleTime(obj: unknown): obj is CycleTime {
  return typeof obj === 'object' && 
         obj !== null &&
         'startDate' in obj &&
         'endDate' in obj &&
         'durationDays' in obj &&
         'durationHours' in obj &&
         'isEstimated' in obj &&
         'calculationMethod' in obj;
}

export function isKanbanIssue(obj: unknown): obj is KanbanIssue {
  return typeof obj === 'object' && 
         obj !== null &&
         'id' in obj &&
         'key' in obj &&
         'boardId' in obj &&
         'cycleTime' in obj;
}

export function isKanbanBoard(obj: unknown): obj is KanbanBoard {
  return typeof obj === 'object' && 
         obj !== null &&
         'id' in obj &&
         'type' in obj &&
         (obj as { type: unknown }).type === 'kanban' &&
         'columnConfig' in obj;
}
