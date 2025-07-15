/**
 * Debug endpoint per testare chiamate API Jira dirette
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';

export interface DirectApiDebugResponse {
  readonly timestamp: string;
  readonly tests: ReadonlyArray<{
    readonly name: string;
    readonly endpoint: string;
    readonly status: 'success' | 'failed';
    readonly statusCode?: number;
    readonly responseTime: number;
    readonly error?: string;
    readonly dataPreview?: unknown;
  }>;
  readonly summary: {
    readonly total: number;
    readonly successful: number;
    readonly failed: number;
  };
}

/**
 * Utility function to get environment variable
 */
function getEnvVar(name: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Test a single API endpoint
 */
async function testEndpoint(name: string, endpoint: string, baseUrl: string, authHeader: string) {
  const startTime = Date.now();
  const fullUrl = `${baseUrl}${endpoint}`;
  
  try {
    console.log(`[DIRECT-API-DEBUG] Testing ${name}: ${endpoint}`);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name,
        endpoint,
        status: 'failed' as const,
        statusCode: response.status,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    
    return {
      name,
      endpoint,
      status: 'success' as const,
      statusCode: response.status,
      responseTime,
      dataPreview: Array.isArray(data) ? 
        { type: 'array', length: data.length, firstItem: data[0] } :
        { type: 'object', keys: Object.keys(data).slice(0, 5) }
    };
    
  } catch (error) {
    return {
      name,
      endpoint,
      status: 'failed' as const,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export const GET: APIRoute = async () => {
  try {
    console.log('[DIRECT-API-DEBUG] Starting direct API tests');
    
    // Get configuration
    const baseUrl = getEnvVar('JIRA_BASE_URL');
    const email = getEnvVar('JIRA_EMAIL');
    const apiToken = getEnvVar('JIRA_API_TOKEN');
    const projectKey = getEnvVar('JIRA_PROJECT_KEY');
    
    if (!baseUrl || !email || !apiToken || !projectKey) {
      return new Response(JSON.stringify({
        error: 'Missing required environment variables',
        missing: [
          !baseUrl && 'JIRA_BASE_URL',
          !email && 'JIRA_EMAIL', 
          !apiToken && 'JIRA_API_TOKEN',
          !projectKey && 'JIRA_PROJECT_KEY'
        ].filter(Boolean)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create auth header
    const credentials = `${email}:${apiToken}`;
    const authHeader = `Basic ${btoa(credentials)}`;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    // Define test endpoints
    const testEndpoints = [
      { name: 'User Info', endpoint: '/rest/api/3/myself' },
      { name: 'Project Info', endpoint: `/rest/api/3/project/${projectKey}` },
      { name: 'Project Boards', endpoint: `/rest/agile/1.0/board?projectKeyOrId=${projectKey}` },
      { name: 'Server Info', endpoint: '/rest/api/3/serverInfo' }
    ];
    
    // Run all tests
    const tests = await Promise.all(
      testEndpoints.map(({ name, endpoint }) => 
        testEndpoint(name, endpoint, cleanBaseUrl, authHeader)
      )
    );
    
    // Calculate summary
    const successful = tests.filter(t => t.status === 'success').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    
    const response: DirectApiDebugResponse = {
      timestamp: new Date().toISOString(),
      tests,
      summary: {
        total: tests.length,
        successful,
        failed
      }
    };
    
    console.log('[DIRECT-API-DEBUG] Tests completed:', {
      successful,
      failed,
      total: tests.length
    });
    
    const statusCode = failed === 0 ? 200 : (successful > 0 ? 207 : 500);
    
    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('[DIRECT-API-DEBUG] Unexpected error:', error);
    
    return new Response(JSON.stringify({
      error: 'Unexpected error during direct API tests',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
