/**
 * Jira configuration and environment validation
 * Following Clean Code: Express intent, fail fast
 */

export interface JiraConfig {
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
  readonly projectKey: string;
}

/**
 * Gets environment variable from both Node.js and Astro contexts
 * Following Clean Code: Single responsibility, cross-platform compatibility
 */
function getEnvVar(name: string): string | undefined {
  // Check import.meta.env first (Astro context)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  
  // Fall back to process.env (Node.js context)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  
  return undefined;
}

/**
 * Validates required environment variables
 * Following Clean Code: Single responsibility, early return
 */
function validateEnvironment(): void {
  const requiredVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'];
  
  for (const varName of requiredVars) {
    if (!getEnvVar(varName)) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
}

/**
 * Validates Jira base URL format
 * Following Clean Code: Express intent, single responsibility
 */
function validateBaseUrl(url: string): void {
  if (!url.startsWith('https://') || !url.includes('.atlassian.net')) {
    throw new Error(`Invalid Jira base URL format: ${url}`);
  }
}

/**
 * Creates Jira configuration from environment
 * Following Clean Code: Factory pattern, immutability
 */
export function createJiraConfig(): JiraConfig {
  // Load environment variables if in development
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    try {
      const dotenv = require('dotenv');
      dotenv.config();
    } catch {
      // dotenv not available, continue with existing env vars
    }
  }
  
  validateEnvironment();
  
  const baseUrl = getEnvVar('JIRA_BASE_URL')!;
  validateBaseUrl(baseUrl);
  
  return {
    baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
    email: getEnvVar('JIRA_EMAIL')!,
    apiToken: getEnvVar('JIRA_API_TOKEN')!,
    projectKey: getEnvVar('JIRA_PROJECT_KEY')!
  };
}
