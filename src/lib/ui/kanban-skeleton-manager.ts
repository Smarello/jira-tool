/**
 * Kanban Skeleton Manager
 * Following Clean Code: Single responsibility - manages skeleton screen visibility
 * Separation of concerns: UI state management separated from business logic
 */

export type SkeletonSection = 'cycle-time' | 'flow-metrics' | 'flow-insights' | 'issues-details';

export interface SkeletonState {
  cycleTime: boolean;
  flowMetrics: boolean;
  flowInsights: boolean;
  issuesDetails: boolean;
}

/**
 * Manager class for Kanban skeleton screen visibility
 * Following Clean Code: Express intent, encapsulation
 */
export class KanbanSkeletonManager {
  private currentState: SkeletonState = {
    cycleTime: false,
    flowMetrics: false,
    flowInsights: false,
    issuesDetails: false
  };

  /**
   * Shows skeleton screens for specified sections
   * Following Clean Code: Clear function name, single responsibility
   */
  showSkeletons(sections: SkeletonSection[] = ['cycle-time', 'flow-metrics', 'flow-insights', 'issues-details']): void {
    sections.forEach(section => {
      this.showSkeleton(section);
    });
    
    console.log('[KanbanSkeletonManager] Skeleton screens shown for sections:', sections);
  }

  /**
   * Hides skeleton screens for specified sections
   * Following Clean Code: Clear function name, single responsibility
   */
  hideSkeletons(sections: SkeletonSection[] = ['cycle-time', 'flow-metrics', 'flow-insights', 'issues-details']): void {
    sections.forEach(section => {
      this.hideSkeleton(section);
    });
    
    console.log('[KanbanSkeletonManager] Skeleton screens hidden for sections:', sections);
  }

  /**
   * Shows skeleton for a specific section
   * Following Clean Code: Express intent, DOM manipulation abstraction
   */
  private showSkeleton(section: SkeletonSection): void {
    const sectionConfig = this.getSectionConfig(section);
    if (!sectionConfig) return;

    // Hide original content containers
    sectionConfig.contentSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.classList.add('hidden');
      }
    });

    // Show skeleton
    const skeletonElement = document.querySelector(sectionConfig.skeletonSelector);
    if (skeletonElement) {
      skeletonElement.classList.remove('hidden');
      this.currentState[this.getSectionKey(section)] = true;
    }
  }

  /**
   * Hides skeleton for a specific section
   * Following Clean Code: Express intent, DOM manipulation abstraction
   */
  private hideSkeleton(section: SkeletonSection): void {
    const sectionConfig = this.getSectionConfig(section);
    if (!sectionConfig) return;

    // Hide skeleton
    const skeletonElement = document.querySelector(sectionConfig.skeletonSelector);
    if (skeletonElement) {
      skeletonElement.classList.add('hidden');
      this.currentState[this.getSectionKey(section)] = false;
    }

    // Show original content containers (will be managed by display functions)
    sectionConfig.fallbackSelectors?.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && !element.classList.contains('hidden')) {
        element.classList.remove('hidden');
      }
    });
  }

  /**
   * Gets current skeleton state
   * Following Clean Code: Express intent, state access
   */
  getCurrentState(): SkeletonState {
    return { ...this.currentState };
  }

  /**
   * Checks if any skeleton is currently shown
   * Following Clean Code: Express intent, boolean query
   */
  hasActiveSkeletons(): boolean {
    return Object.values(this.currentState).some(isActive => isActive);
  }

  /**
   * Gets section configuration for DOM manipulation
   * Following Clean Code: Configuration abstraction, single point of truth
   */
  private getSectionConfig(section: SkeletonSection) {
    const configs = {
      'cycle-time': {
        skeletonSelector: '#cycle-time-skeleton',
        contentSelectors: ['#cycle-time-data', '#cycle-time-placeholder'],
        fallbackSelectors: ['#cycle-time-placeholder']
      },
      'flow-metrics': {
        skeletonSelector: '#flow-metrics-skeleton',
        contentSelectors: ['#flow-metrics-container > div:not(#flow-metrics-skeleton)'],
        fallbackSelectors: ['#flow-metrics-container > div:not(#flow-metrics-skeleton)']
      },
      'flow-insights': {
        skeletonSelector: '#flow-insights-skeleton',
        contentSelectors: ['#kanban-insights-container > div:not(#flow-insights-skeleton)'],
        fallbackSelectors: ['#kanban-insights-container > div:not(#flow-insights-skeleton)']
      },
      'issues-details': {
        skeletonSelector: '#issues-details-skeleton',
        contentSelectors: ['#issues-details-content', '#issues-details-placeholder'],
        fallbackSelectors: ['#issues-details-placeholder']
      }
    };

    return configs[section];
  }

  /**
   * Maps section name to state key
   * Following Clean Code: Type safety, clear mapping
   */
  private getSectionKey(section: SkeletonSection): keyof SkeletonState {
    const keyMap: Record<SkeletonSection, keyof SkeletonState> = {
      'cycle-time': 'cycleTime',
      'flow-metrics': 'flowMetrics',
      'flow-insights': 'flowInsights',
      'issues-details': 'issuesDetails'
    };

    return keyMap[section];
  }
}

/**
 * Global singleton instance for consistent skeleton management
 * Following Clean Code: Single instance, global access pattern
 */
export const kanbanSkeletonManager = new KanbanSkeletonManager();