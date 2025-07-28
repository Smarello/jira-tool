/**
 * Kanban Analytics Event System
 * Following Clean Code: Event-driven architecture, type safety
 * Replaces window object usage with proper event communication
 */

// Event types for type safety
export interface KanbanAnalyticsData {
  boardId: string;
  totalIssues: number;
  completedIssues: number;
  cycleTimePercentiles: {
    p50: number;
    p75: number;
    p85: number;
    p95: number;
    sampleSize: number;
  };
  cycleTimeProbability?: {
    dayRanges: Array<{
      range: string;
      probability: number;
      confidence: number;
      isRecommended: boolean;
      count: number;
      minDays: number;
      maxDays: number;
    }>;
    recommendations: {
      minDays: number;
      maxDays: number;
      confidenceLevel: number;
    };
  };
  issuesDetails: Array<{
    key: string;
    summary: string;
    issueType: {
      name: string;
      iconUrl: string;
    };
    status: {
      name: string;
      statusCategory: {
        id: number;
        name: 'To Do' | 'In Progress' | 'Done';
        colorName: string;
      };
    };
    jiraUrl: string;
    cycleTimeDays?: number;
    openedDate?: string;
    lastDoneDate?: string;
  }>;
  calculatedAt: string;
}

export interface CycleTimeRange {
  minDays: number;
  maxDays: number;
}

// Custom event details
export interface KanbanAnalyticsUpdateEvent extends CustomEvent {
  detail: {
    data: KanbanAnalyticsData;
  };
}

export interface ShowIssuesModalEvent extends CustomEvent {
  detail: {
    cycleTimeRange: CycleTimeRange;
  };
}

// Event names as constants
export const KANBAN_EVENTS = {
  ANALYTICS_UPDATED: 'kanban:analytics-updated',
  SHOW_ISSUES_MODAL: 'kanban:show-issues-modal',
  CLOSE_ISSUES_MODAL: 'kanban:close-issues-modal'
} as const;

/**
 * Kanban Analytics State Manager
 * Following Clean Code: Single responsibility, encapsulation
 */
class KanbanAnalyticsState {
  private currentData: KanbanAnalyticsData | null = null;
  private eventTarget: EventTarget;

  constructor() {
    this.eventTarget = document;
  }

  /**
   * Updates the current analytics data and notifies listeners
   */
  updateAnalyticsData(data: KanbanAnalyticsData): void {
    this.currentData = data;
    
    const event = new CustomEvent(KANBAN_EVENTS.ANALYTICS_UPDATED, {
      detail: { data }
    });
    
    this.eventTarget.dispatchEvent(event);
  }

  /**
   * Gets the current analytics data
   */
  getCurrentData(): KanbanAnalyticsData | null {
    return this.currentData;
  }

  /**
   * Shows the issues modal for a specific cycle time range
   */
  showIssuesModal(cycleTimeRange: CycleTimeRange): void {
    const event = new CustomEvent(KANBAN_EVENTS.SHOW_ISSUES_MODAL, {
      detail: { cycleTimeRange }
    });
    
    this.eventTarget.dispatchEvent(event);
  }

  /**
   * Closes the issues modal
   */
  closeIssuesModal(): void {
    const event = new CustomEvent(KANBAN_EVENTS.CLOSE_ISSUES_MODAL);
    this.eventTarget.dispatchEvent(event);
  }

  /**
   * Adds an event listener
   */
  addEventListener(type: string, listener: EventListener): void {
    this.eventTarget.addEventListener(type, listener);
  }

  /**
   * Removes an event listener
   */
  removeEventListener(type: string, listener: EventListener): void {
    this.eventTarget.removeEventListener(type, listener);
  }
}

// Create and export singleton instance
export const kanbanState = new KanbanAnalyticsState();

// Make it available globally in a clean way
declare global {
  interface Window {
    kanbanState: KanbanAnalyticsState;
  }
}

if (typeof window !== 'undefined') {
  window.kanbanState = kanbanState;
}