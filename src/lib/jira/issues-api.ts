/**
 * Jira Issues API wrapper with story points support
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraApiClient } from './api-client.js';
import type { JiraIssue } from './types.js';
import type { JiraSprint } from './boards.js';
import type { McpAtlassianClient } from '../mcp/atlassian.js';
import { validateIssuesForVelocity, calculateValidatedStoryPoints } from '../velocity/advanced-validator.js';

export interface StoryPointsData {
  readonly committed: number;
  readonly completed: number;
  readonly issueCount: number;
  readonly completedIssueCount: number;
}

export interface JiraIssueWithPoints extends JiraIssue {
  readonly storyPoints: number | null;
  readonly statusCategoryChangedDate: string | null;
  readonly completionDate?: string | null; // When issue moved to last kanban column
}

/**
 * High-level API for Jira issues and story points
 * Following Clean Code: Single responsibility, dependency injection
 */
export class JiraIssuesApi {
  private storyPointsFieldId: string | null = null;

  constructor(private readonly apiClient: JiraApiClient) {}

  /**
   * Discovers story points custom field ID
   * Following Clean Code: Express intent, single responsibility
   */
  async discoverStoryPointsField(): Promise<string | null> {
    if (this.storyPointsFieldId) {
      return this.storyPointsFieldId;
    }

    try {
      const response = await this.apiClient.get('/rest/api/3/field');
      const fields = response.data as any[];
      
      // Prioritize known field ID for this Jira instance
      const knownStoryPointsField = fields.find(field => 
        field.id === 'customfield_10202'
      );
      
      if (knownStoryPointsField) {
        this.storyPointsFieldId = knownStoryPointsField.id;
        return this.storyPointsFieldId;
      }

      // Fallback to common story points field detection
      const storyPointsField = fields.find(field => 
        field.name?.toLowerCase().includes('story points') ||
        field.name?.toLowerCase().includes('points') ||
        field.id === 'customfield_10016' // Common default
      );

      this.storyPointsFieldId = storyPointsField?.id || null;
      return this.storyPointsFieldId;
    } catch {
      return null;
    }
  }

  /**
   * Fetches issues for a sprint with story points
   * Following Clean Code: Express intent, single responsibility
   */
  async fetchSprintIssues(sprintId: string): Promise<readonly JiraIssueWithPoints[]> {
    const storyPointsField = await this.discoverStoryPointsField();
    
    const fields = [
      'id', 'key', 'summary', 'status', 'issuetype', 'created', 'updated', 'resolved',
      'statuscategorychangedate'
    ];
    
    if (storyPointsField) {
      fields.push(storyPointsField);
    }

    const allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100; // Increased batch size for efficiency
    let total = 0;

    do {
      const endpoint = `/rest/agile/1.0/sprint/${sprintId}/issue?fields=${fields.join(',')}&startAt=${startAt}&maxResults=${maxResults}`;
      const response = await this.apiClient.get(endpoint);
      
      const responseData = response.data as any;
      const issues = responseData?.issues || [];
      total = responseData?.total || 0;
      
      allIssues.push(...issues);
      startAt += maxResults;
      
      // Break if we've fetched all issues
      if (allIssues.length >= total || issues.length < maxResults) {
        break;
      }
    } while (startAt < total);
    
    return allIssues.map((issue: any) => ({
      ...this.mapIssue(issue),
      storyPoints: this.extractStoryPoints(issue, storyPointsField),
      statusCategoryChangedDate: this.extractStatusCategoryChangedDate(issue)
    }));
  }

  /**
   * Calculates story points data for a sprint using advanced validation
   * Following Clean Code: Express intent, single responsibility
   */
  async calculateSprintStoryPoints(
    sprintId: string, 
    sprint: JiraSprint, 
    boardId: string,
    mcpClient: McpAtlassianClient
  ): Promise<StoryPointsData> {
    const issues = await this.fetchSprintIssues(sprintId);
    
    const committed = this.sumStoryPoints(issues);
    
    // Use advanced validation with Done column checking
    const validationResults = await validateIssuesForVelocity(
      issues, 
      sprint, 
      boardId, 
      mcpClient
    );
    
    const completed = calculateValidatedStoryPoints(issues, validationResults);
    const completedIssueCount = validationResults.filter(result => 
      result.isValidForVelocity
    ).length;

    return {
      committed,
      completed,
      issueCount: issues.length,
      completedIssueCount
    };
  }

  /**
   * Extracts story points from issue
   * Following Clean Code: Express intent, null handling
   */
  private extractStoryPoints(issue: any, fieldId: string | null): number | null {
    if (!fieldId || !issue.fields?.[fieldId]) {
      return null;
    }

    const value = issue.fields[fieldId];
    const points = typeof value === 'number' ? value : parseFloat(value);
    
    return isNaN(points) ? null : points;
  }

  /**
   * Extracts status category changed date from issue
   * Following Clean Code: Express intent, null handling
   */
  private extractStatusCategoryChangedDate(issue: any): string | null {
    return issue.fields?.statuscategorychangedate || null;
  }

  /**
   * Sums story points from issues array
   * Following Clean Code: Single responsibility, immutability
   */
  private sumStoryPoints(issues: readonly JiraIssueWithPoints[]): number {
    return issues.reduce((sum, issue) => 
      sum + (issue.storyPoints || 0), 0
    );
  }

  /**
   * Maps raw issue to typed interface
   * Following Clean Code: Single responsibility, type safety
   */
  private mapIssue(rawIssue: any): JiraIssue {
    const fields = rawIssue.fields || {};
    
    return {
      id: rawIssue.id,
      key: rawIssue.key,
      summary: fields.summary || '',
      description: fields.description || null,
      status: fields.status || { name: 'Unknown', statusCategory: { name: 'To Do' } },
      priority: fields.priority || { name: 'Unknown' },
      issueType: fields.issuetype || { name: 'Unknown' },
      assignee: fields.assignee || null,
      reporter: fields.reporter || { displayName: 'Unknown' },
      created: fields.created || '',
      updated: fields.updated || '',
      resolved: fields.resolved || null
    };
  }
}
