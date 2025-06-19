/**
 * Sprint domain models and value objects
 * Following Clean Architecture: Domain layer entities and value objects
 * Following Clean Code: Express intent, immutability, type safety
 */

import type { JiraSprint } from '../../jira/boards';
import type { JiraIssueWithPoints } from '../../jira/issues-api';

/**
 * Sprint state enumeration
 * Following Clean Code: Replace magic strings with named constants
 */
export const SprintState = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  FUTURE: 'future'
} as const;

export type SprintStateType = typeof SprintState[keyof typeof SprintState];

/**
 * Issue type enumeration
 * Following Clean Code: Express intent, type safety
 */
export const IssueType = {
  STORY: 'Story',
  BUG: 'Bug',
  TASK: 'Task',
  EPIC: 'Epic',
  SUBTASK: 'Sub-task'
} as const;

export type IssueTypeType = typeof IssueType[keyof typeof IssueType];

/**
 * Issue status category enumeration
 * Following Clean Code: Express intent, business logic
 */
export const StatusCategory = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done'
} as const;

export type StatusCategoryType = typeof StatusCategory[keyof typeof StatusCategory];

/**
 * Sprint velocity value object
 * Following Clean Architecture: Value object in domain layer
 */
export class SprintVelocity {
  constructor(
    public readonly committedPoints: number,
    public readonly completedPoints: number,
    public readonly issuesCount: number,
    public readonly completedIssuesCount: number
  ) {
    if (committedPoints < 0 || completedPoints < 0) {
      throw new Error('Story points cannot be negative');
    }
    if (issuesCount < 0 || completedIssuesCount < 0) {
      throw new Error('Issue counts cannot be negative');
    }
    if (completedPoints > committedPoints) {
      console.warn('Completed points exceed committed points - possible scope change');
    }
  }

  /**
   * Calculates velocity percentage
   * Following Clean Code: Express intent, business logic
   */
  get velocityPercentage(): number {
    return this.committedPoints === 0 ? 0 : (this.completedPoints / this.committedPoints) * 100;
  }

  /**
   * Calculates completion rate
   * Following Clean Code: Express intent, business logic
   */
  get completionRate(): number {
    return this.issuesCount === 0 ? 0 : (this.completedIssuesCount / this.issuesCount) * 100;
  }

  /**
   * Checks if sprint goals were met
   * Following Clean Code: Express intent, business rule
   */
  get isGoalMet(): boolean {
    return this.velocityPercentage >= 80; // 80% threshold for goal achievement
  }

  /**
   * Gets velocity category
   * Following Clean Code: Express intent, business categorization
   */
  get category(): 'excellent' | 'good' | 'fair' | 'poor' {
    const percentage = this.velocityPercentage;
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'fair';
    return 'poor';
  }
}

/**
 * Sprint metrics value object
 * Following Clean Architecture: Complex value object with business logic
 */
export class SprintMetrics {
  constructor(
    public readonly velocity: SprintVelocity,
    public readonly cycleTime: number,
    public readonly leadTime: number,
    public readonly defectRate: number,
    public readonly scopeChangeRate: number
  ) {
    if (cycleTime < 0 || leadTime < 0) {
      throw new Error('Time metrics cannot be negative');
    }
    if (defectRate < 0 || defectRate > 100) {
      throw new Error('Defect rate must be between 0 and 100');
    }
    if (scopeChangeRate < 0) {
      throw new Error('Scope change rate cannot be negative');
    }
  }

  /**
   * Calculates flow efficiency
   * Following Clean Code: Express intent, business calculation
   */
  get flowEfficiency(): number {
    return this.leadTime === 0 ? 0 : (this.cycleTime / this.leadTime) * 100;
  }

  /**
   * Gets quality score based on defect rate
   * Following Clean Code: Express intent, quality assessment
   */
  get qualityScore(): number {
    return Math.max(0, 100 - this.defectRate);
  }

  /**
   * Gets predictability score based on scope changes
   * Following Clean Code: Express intent, predictability assessment
   */
  get predictabilityScore(): number {
    return Math.max(0, 100 - this.scopeChangeRate);
  }

  /**
   * Calculates overall sprint health score
   * Following Clean Code: Express intent, composite metric
   */
  get healthScore(): number {
    const velocityScore = this.velocity.velocityPercentage;
    const qualityScore = this.qualityScore;
    const predictabilityScore = this.predictabilityScore;
    const flowScore = Math.min(100, this.flowEfficiency);

    return (velocityScore + qualityScore + predictabilityScore + flowScore) / 4;
  }
}

/**
 * Sprint domain entity
 * Following Clean Architecture: Rich domain entity with business logic
 */
export class SprintEntity {
  constructor(
    public readonly id: string,
    public readonly boardId: string,
    public readonly name: string,
    public readonly state: SprintStateType,
    public readonly startDate: Date | null,
    public readonly endDate: Date | null,
    public readonly completeDate: Date | null,
    public readonly goal: string | null,
    public readonly issues: readonly JiraIssueWithPoints[] = [],
    public readonly metrics: SprintMetrics | null = null
  ) {
    if (!id || !boardId || !name) {
      throw new Error('Sprint must have id, boardId, and name');
    }
  }

  /**
   * Checks if sprint is closed
   * Following Clean Code: Express intent, business rule
   */
  get isClosed(): boolean {
    return this.state === SprintState.CLOSED;
  }

  /**
   * Checks if sprint is active
   * Following Clean Code: Express intent, business rule
   */
  get isActive(): boolean {
    return this.state === SprintState.ACTIVE;
  }

  /**
   * Gets sprint duration in days
   * Following Clean Code: Express intent, business calculation
   */
  get durationDays(): number | null {
    if (!this.startDate || !this.endDate) return null;
    const diffTime = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Gets completed issues
   * Following Clean Code: Express intent, filtering
   */
  get completedIssues(): readonly JiraIssueWithPoints[] {
    return this.issues.filter(issue => {
      const statusName = typeof issue.status === 'string' ? issue.status : issue.status?.name || '';
      return statusName.toLowerCase().includes('done') ||
             statusName.toLowerCase().includes('closed') ||
             statusName.toLowerCase().includes('resolved');
    });
  }

  /**
   * Gets total story points
   * Following Clean Code: Express intent, aggregation
   */
  get totalStoryPoints(): number {
    return this.issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  }

  /**
   * Gets completed story points
   * Following Clean Code: Express intent, aggregation
   */
  get completedStoryPoints(): number {
    return this.completedIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  }

  /**
   * Creates sprint from JIRA data
   * Following Clean Code: Factory method, static constructor
   */
  static fromJiraSprint(jiraSprint: JiraSprint, issues: readonly JiraIssueWithPoints[] = []): SprintEntity {
    return new SprintEntity(
      jiraSprint.id,
      jiraSprint.originBoardId,
      jiraSprint.name,
      jiraSprint.state as SprintStateType,
      jiraSprint.startDate ? new Date(jiraSprint.startDate) : null,
      jiraSprint.endDate ? new Date(jiraSprint.endDate) : null,
      jiraSprint.completeDate ? new Date(jiraSprint.completeDate) : null,
      jiraSprint.goal || null,
      issues
    );
  }
}
