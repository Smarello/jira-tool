/**
 * Jira client leveraging MCP Atlassian server
 * Following Clean Code: Single Responsibility, Express Intent, Fail Fast
 */

import type { 
  JiraIssue, 
  JiraProject, 
  JiraConfig, 
  JiraApiResponse 
} from './types.js';
import { getCachedData, setCachedData } from '../utils/cache';

class JiraClientError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'JiraClientError';
  }
}

/**
 * Creates Jira configuration from environment variables
 * Fails fast if required variables are missing
 */
function createJiraConfig(): JiraConfig {
  const baseUrl = import.meta.env.JIRA_BASE_URL;
  const email = import.meta.env.JIRA_EMAIL;
  const apiToken = import.meta.env.JIRA_API_TOKEN;
  const projectKey = import.meta.env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    throw new JiraClientError('Missing required Jira configuration');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
    email,
    apiToken,
    projectKey
  };
}

/**
 * Fetches project information
 * Single responsibility: only project data
 */
export async function getProject(): Promise<JiraApiResponse<JiraProject>> {
  const cacheKey = 'jira-project';
  
  // Try cache first
  const cachedProject = getCachedData<JiraProject>(cacheKey);
  if (cachedProject) {
    return {
      data: cachedProject,
      success: true
    };
  }

  try {
    const config = createJiraConfig();
    
    // This will be implemented to call MCP server
    // For now, using a placeholder structure
    const projectData: JiraProject = {
      id: '10001',
      key: config.projectKey,
      name: 'New Project',
      description: 'Jira Tool project for analytics',
      lead: {
        accountId: 'user123',
        displayName: 'Project Lead',
        emailAddress: config.email,
        avatarUrls: {
          '16x16': '',
          '24x24': '',
          '32x32': '',
          '48x48': ''
        }
      }
    };

    // Cache the result
    setCachedData(cacheKey, projectData);

    return {
      data: projectData,
      success: true
    };
  } catch (error) {
    return {
      data: {} as JiraProject,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetches issues for the configured project
 * Returns read-only data following immutability principle
 */
export async function getProjectIssues(): Promise<JiraApiResponse<readonly JiraIssue[]>> {
  const cacheKey = 'jira-issues';
  
  // Try cache first
  const cachedIssues = getCachedData<readonly JiraIssue[]>(cacheKey);
  if (cachedIssues) {
    return {
      data: cachedIssues,
      success: true
    };
  }

  try {
    const config = createJiraConfig();
    
    // Placeholder for MCP server integration
    // This will call the mcp-atlassian server
    const mockIssues: readonly JiraIssue[] = [
      {
        id: '10001',
        key: `${config.projectKey}-1`,
        summary: 'Sample Issue for Dashboard',
        description: 'This is a sample issue for testing the dashboard',
        status: {
          id: '1',
          name: 'To Do',
          statusCategory: {
            id: 1,
            name: 'To Do',
            colorName: 'blue-gray'
          }
        },
        priority: {
          id: '3',
          name: 'Medium',
          iconUrl: ''
        },
        issueType: {
          id: '1',
          name: 'Task',
          iconUrl: '',
          subtask: false
        },
        assignee: null,
        reporter: {
          accountId: 'user123',
          displayName: 'Reporter User',
          emailAddress: config.email,
          avatarUrls: {
            '16x16': '',
            '24x24': '',
            '32x32': '',
            '48x48': ''
          }
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        resolved: null
      }
    ];

    // Cache the result
    setCachedData(cacheKey, mockIssues);

    return {
      data: mockIssues,
      success: true
    };
  } catch (error) {
    return {
      data: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validates Jira connection
 * Command-Query Separation: this function answers a question
 */
export async function validateConnection(): Promise<boolean> {
  try {
    const projectResponse = await getProject();
    return projectResponse.success;
  } catch {
    return false;
  }
}
