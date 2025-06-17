/**
 * Jira HTTP API client
 * Following Clean Code: Single responsibility, express intent
 */

import type { JiraConfig } from './config.js';
import { 
  JiraApiError, 
  JiraAuthenticationError, 
  JiraRateLimitError,
  JiraNotFoundError 
} from './errors.js';

export interface HttpResponse<T = unknown> {
  readonly data: T;
  readonly status: number;
  readonly headers: Record<string, string>;
}

/**
 * Low-level HTTP client for Jira API
 * Following Clean Code: Single responsibility, dependency injection
 */
export class JiraApiClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly config: JiraConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = this.createAuthHeader();
  }

  /**
   * Creates Basic Auth header
   * Following Clean Code: Express intent, immutability
   */
  private createAuthHeader(): string {
    const credentials = `${this.config.email}:${this.config.apiToken}`;
    return `Basic ${btoa(credentials)}`;
  }

  /**
   * Performs GET request to Jira API
   * Following Clean Code: Single responsibility, exception handling
   */
  async get<T>(endpoint: string): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      console.log(`[API-CLIENT-DEBUG] Response for ${endpoint} with status ${response.status}`);
      return await this.handleResponse<T>(response, endpoint);
    } catch (error) {
      if (error instanceof JiraApiError) {
        throw error;
      }
      throw new JiraApiError(`Network error: ${error}`, undefined, endpoint);
    }
  }

  /**
   * Handles HTTP response and errors
   * Following Clean Code: Single responsibility, fail fast
   */
  private async handleResponse<T>(
    response: Response, 
    endpoint: string
  ): Promise<HttpResponse<T>> {
    const status = response.status;
    
    if (status === 401) {
      throw new JiraAuthenticationError();
    }
    
    if (status === 404) {
      throw new JiraNotFoundError(endpoint);
    }
    
    if (status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new JiraRateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter) : undefined
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new JiraApiError(
        `HTTP ${status}: ${errorText}`,
        status,
        endpoint
      );
    }

    const data = await response.json() as T;
    const headers: Record<string, string> = {};
    
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { data, status, headers };
  }

  /**
   * Tests API connectivity
   * Following Clean Code: Express intent, single responsibility
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get('/rest/api/3/myself');
      return true;
    } catch {
      return false;
    }
  }
}
