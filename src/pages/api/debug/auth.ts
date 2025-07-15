/**
 * Debug endpoint per testare l'autenticazione Jira
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';
import { createJiraConfig } from '../../../lib/jira/config.js';
import { JiraApiClient } from '../../../lib/jira/api-client.js';

export interface AuthDebugResponse {
  readonly timestamp: string;
  readonly configStatus: 'success' | 'failed';
  readonly configError?: string;
  readonly authTest: {
    readonly endpoint: string;
    readonly status: 'success' | 'failed';
    readonly statusCode?: number;
    readonly responseTime: number;
    readonly error?: string;
    readonly details?: unknown;
  };
  readonly credentials: {
    readonly emailMasked: string;
    readonly tokenMasked: string;
    readonly baseUrl: string;
  };
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  
  try {
    console.log('[AUTH-DEBUG] Starting Jira authentication test');
    
    // Step 1: Test configuration creation
    let config;
    let configStatus: 'success' | 'failed' = 'success';
    let configError: string | undefined;
    
    try {
      config = createJiraConfig();
      console.log('[AUTH-DEBUG] Configuration created successfully');
    } catch (error) {
      configStatus = 'failed';
      configError = error instanceof Error ? error.message : 'Unknown config error';
      console.error('[AUTH-DEBUG] Configuration failed:', configError);
      
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        configStatus,
        configError,
        authTest: {
          endpoint: 'N/A',
          status: 'failed',
          responseTime: Date.now() - startTime,
          error: 'Configuration failed'
        },
        credentials: {
          emailMasked: 'N/A',
          tokenMasked: 'N/A',
          baseUrl: 'N/A'
        }
      } as AuthDebugResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Step 2: Create API client and test authentication
    const apiClient = new JiraApiClient(config);
    const testEndpoint = '/rest/api/3/myself';
    
    let authTest: AuthDebugResponse['authTest'];
    
    try {
      console.log('[AUTH-DEBUG] Testing authentication with /rest/api/3/myself');
      const response = await apiClient.get(testEndpoint);
      
      authTest = {
        endpoint: testEndpoint,
        status: 'success',
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        details: response.data
      };
      
      console.log('[AUTH-DEBUG] Authentication successful:', {
        status: response.status,
        responseTime: authTest.responseTime
      });
      
    } catch (error) {
      authTest = {
        endpoint: testEndpoint,
        status: 'failed',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown auth error',
        details: error
      };
      
      console.error('[AUTH-DEBUG] Authentication failed:', {
        error: authTest.error,
        statusCode: authTest.statusCode,
        responseTime: authTest.responseTime
      });
    }
    
    // Mask sensitive data for response
    const maskEmail = (email: string) => {
      const [username, domain] = email.split('@');
      return username.substring(0, 2) + '***@' + domain;
    };
    
    const maskToken = (token: string) => {
      return token.substring(0, 8) + '***' + token.substring(token.length - 8);
    };
    
    const response: AuthDebugResponse = {
      timestamp: new Date().toISOString(),
      configStatus,
      configError,
      authTest,
      credentials: {
        emailMasked: maskEmail(config.email),
        tokenMasked: maskToken(config.apiToken),
        baseUrl: config.baseUrl
      }
    };
    
    const statusCode = authTest.status === 'success' ? 200 : 401;
    
    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('[AUTH-DEBUG] Unexpected error:', error);
    
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      configStatus: 'failed',
      error: 'Unexpected error during authentication test',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
