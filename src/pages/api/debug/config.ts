/**
 * Debug endpoint per verificare la configurazione Jira
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';

export interface ConfigDebugResponse {
  readonly timestamp: string;
  readonly environment: string;
  readonly variables: {
    readonly jiraBaseUrl: string | null;
    readonly jiraEmail: string | null;
    readonly jiraApiToken: string | null;
    readonly jiraProjectKey: string | null;
  };
  readonly variableSources: {
    readonly importMeta: boolean;
    readonly processEnv: boolean;
  };
  readonly validation: {
    readonly hasAllRequiredVars: boolean;
    readonly missingVars: string[];
    readonly baseUrlValid: boolean;
  };
}

/**
 * Utility function to safely get environment variable
 */
function getEnvVar(name: string): { value: string | null; source: string } {
  // Check import.meta.env first (Astro context)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return { value: import.meta.env[name], source: 'import.meta.env' };
  }
  
  // Fall back to process.env (Node.js context)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return { value: process.env[name], source: 'process.env' };
  }
  
  return { value: null, source: 'not_found' };
}

/**
 * Masks sensitive information for logging
 */
function maskSensitive(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

export const GET: APIRoute = async () => {
  try {
    const timestamp = new Date().toISOString();
    
    // Get all required variables with their sources
    const jiraBaseUrl = getEnvVar('JIRA_BASE_URL');
    const jiraEmail = getEnvVar('JIRA_EMAIL');
    const jiraApiToken = getEnvVar('JIRA_API_TOKEN');
    const jiraProjectKey = getEnvVar('JIRA_PROJECT_KEY');
    
    // Check which source systems are available
    const variableSources = {
      importMeta: typeof import.meta !== 'undefined' && !!import.meta.env,
      processEnv: typeof process !== 'undefined' && !!process.env
    };
    
    // Validation logic
    const missingVars: string[] = [];
    
    if (!jiraBaseUrl.value) missingVars.push('JIRA_BASE_URL');
    if (!jiraEmail.value) missingVars.push('JIRA_EMAIL');
    if (!jiraApiToken.value) missingVars.push('JIRA_API_TOKEN');
    if (!jiraProjectKey.value) missingVars.push('JIRA_PROJECT_KEY');
    
    const baseUrlValid = jiraBaseUrl.value ? 
      jiraBaseUrl.value.startsWith('https://') && jiraBaseUrl.value.includes('.atlassian.net') : 
      false;
    
    const response: ConfigDebugResponse = {
      timestamp,
      environment: typeof import.meta !== 'undefined' ? 'astro' : 'node',
      variables: {
        jiraBaseUrl: maskSensitive(jiraBaseUrl.value),
        jiraEmail: maskSensitive(jiraEmail.value),
        jiraApiToken: maskSensitive(jiraApiToken.value),
        jiraProjectKey: jiraProjectKey.value
      },
      variableSources,
      validation: {
        hasAllRequiredVars: missingVars.length === 0,
        missingVars,
        baseUrlValid
      }
    };

    console.log('[CONFIG-DEBUG] Variable sources:', {
      jiraBaseUrl: jiraBaseUrl.source,
      jiraEmail: jiraEmail.source,
      jiraApiToken: jiraApiToken.source,
      jiraProjectKey: jiraProjectKey.source
    });

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[CONFIG-DEBUG] Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Debug endpoint failed',
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
