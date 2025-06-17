/**
 * Jira connectivity health check API endpoint
 * Following Clean Code: Express intent, single responsibility
 */

import type { APIRoute } from 'astro';
import { createJiraConfig } from '../../../lib/jira/config.js';
import { JiraApiClient } from '../../../lib/jira/api-client.js';

export interface HealthCheckResponse {
  readonly status: 'healthy' | 'unhealthy';
  readonly timestamp: string;
  readonly jira: {
    readonly connected: boolean;
    readonly responseTime?: number;
    readonly error?: string;
  };
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  
  try {
    // Test Jira connectivity
    const config = createJiraConfig();
    const apiClient = new JiraApiClient(config);
    
    const connected = await apiClient.testConnection();
    const responseTime = Date.now() - startTime;
    
    const response: HealthCheckResponse = {
      status: connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      jira: {
        connected,
        responseTime
      }
    };

    return new Response(JSON.stringify(response), {
      status: connected ? 200 : 503,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      jira: {
        connected: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    return new Response(JSON.stringify(response), {
      status: 503,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
