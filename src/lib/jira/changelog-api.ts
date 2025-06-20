/**
 * Jira Changelog API wrapper for issue history analysis
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraApiClient } from './api-client.js';

/**
 * Issue changelog entry
 * Following Clean Code: Intention-revealing names, immutability
 */
export interface ChangelogEntry {
  readonly created: string;
  readonly createdTimestamp: number; // Pre-calculated timestamp for performance
  readonly items: readonly ChangelogItem[];
}

export interface ChangelogItem {
  readonly field: string;
  readonly fromString: string | null;
  readonly toString: string | null;
  readonly from: string | null;
  readonly to: string | null;
}

export interface IssueChangelog {
  readonly issueKey: string;
  readonly histories: readonly ChangelogEntry[];
  readonly statusTransitionIndex: ReadonlyMap<string, string>; // statusId -> first transition date
}

/**
 * High-level API for Jira issue changelog operations
 * Following Clean Code: Single responsibility, dependency injection
 */
export class JiraChangelogApi {
  private changelogCache = new Map<string, IssueChangelog>();
  private transitionMemoCache = new Map<string, string | null>(); // issueKey:statusId -> transition date

  constructor(private readonly apiClient: JiraApiClient) {}

  /**
   * Fetches complete changelog for an issue with caching and pre-optimization
   * Following Clean Code: Express intent, single responsibility
   * Optimizations: Pre-sorting, lazy date parsing, indexed search
   */
  async fetchIssueChangelog(issueKey: string): Promise<IssueChangelog> {
    // Check cache first
    if (this.changelogCache.has(issueKey)) {
      console.log(`[CHANGELOG-DEBUG] Returning cached changelog for ${issueKey}`);
      return this.changelogCache.get(issueKey)!;
    }

    const endpoint = `/rest/api/3/issue/${issueKey}?expand=changelog`;
    const response = await this.apiClient.get(endpoint);
    
    const data = response.data as any;
    const changelog = data?.changelog;
    
    let result: IssueChangelog;
    
    if (!changelog || !changelog.histories) {
      result = {
        issueKey,
        histories: [],
        statusTransitionIndex: new Map()
      };
    } else {
      // Pre-process histories with timestamp calculation and sorting
      const histories: ChangelogEntry[] = changelog.histories
        .map((history: any) => ({
          created: history.created,
          createdTimestamp: new Date(history.created).getTime(), // Pre-calculate timestamp
          items: (history.items || []).map((item: any) => ({
            field: item.field,
            fromString: item.fromString || null,
            toString: item.toString || null,
            from: item.from || null,
            to: item.to || null
          }))
        }))
        .sort((a: ChangelogEntry, b: ChangelogEntry) => a.createdTimestamp - b.createdTimestamp); // Pre-sort by timestamp (oldest first)

      // Build status transition index for O(1) lookups
      const statusTransitionIndex = new Map<string, string>();
      for (const history of histories) {
        for (const item of history.items) {
          if (item.field === 'status' && item.to && !statusTransitionIndex.has(item.to)) {
            statusTransitionIndex.set(item.to, history.created);
          }
        }
      }

      result = {
        issueKey,
        histories,
        statusTransitionIndex
      };
    }

    // Cache the result
    this.changelogCache.set(issueKey, result);

    return result;
  }

  /**
   * Clears the changelog cache and memoization cache
   * Following Clean Code: Express intent, resource management
   */
  clearCache(): void {
    this.changelogCache.clear();
    this.transitionMemoCache.clear();
  }

  /**
   * Finds the date when an issue was moved to a specific status by ID
   * Following Clean Code: Express intent, single responsibility
   * Optimizations: Memoization, indexed search, pre-sorted data
   */
  async findStatusTransitionDateById(
    issueKey: string, 
    targetStatusIds: readonly string[]
  ): Promise<string | null> {
    // Check memoization cache first for each target status
    for (const statusId of targetStatusIds) {
      const memoKey = `${issueKey}:${statusId}`;
      if (this.transitionMemoCache.has(memoKey)) {
        const cachedResult = this.transitionMemoCache.get(memoKey);
        if (cachedResult !== null && cachedResult !== undefined) {
          return cachedResult;
        }
      }
    }

    const changelog = await this.fetchIssueChangelog(issueKey);
    
    // Use indexed search for O(1) lookup - check if any target status exists in index
    for (const statusId of targetStatusIds) {
      if (changelog.statusTransitionIndex.has(statusId)) {
        const transitionDate = changelog.statusTransitionIndex.get(statusId)!;
        
        // Memoize the result for future calls
        const memoKey = `${issueKey}:${statusId}`;
        this.transitionMemoCache.set(memoKey, transitionDate);
        
        return transitionDate;
      }
    }
    
    // If no transitions found, memoize null results to avoid future searches
    for (const statusId of targetStatusIds) {
      const memoKey = `${issueKey}:${statusId}`;
      this.transitionMemoCache.set(memoKey, null);
    }
    
    return null;
  }



  /**
   * Finds the date when an issue was moved to any "Done" status for a board using status IDs
   * Following Clean Code: Express intent, single responsibility
   */
  async findDoneColumnTransitionDateById(
    issueKey: string, 
    doneStatusIds: readonly string[]
  ): Promise<string | null> {
    return this.findStatusTransitionDateById(issueKey, doneStatusIds);
  }



  /**
   * Checks if an issue was in Done status at a specific date using status IDs
   * Following Clean Code: Express intent, single responsibility
   */
  async wasIssueInDoneAtDateById(
    issueKey: string,
    doneStatusIds: readonly string[],
    targetDate: string
  ): Promise<boolean> {
    const transitionDate = await this.findDoneColumnTransitionDateById(issueKey, doneStatusIds);
    
    if (!transitionDate) {
      return false;
    }
    
    const transitionDateTime = new Date(transitionDate);
    const targetDateTime = new Date(targetDate);
    
    return transitionDateTime <= targetDateTime;
  }


} 