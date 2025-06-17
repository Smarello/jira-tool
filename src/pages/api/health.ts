/**
 * Health check endpoint
 * Following Clean Code: Single responsibility, clear error messages
 */

import type { APIRoute } from 'astro';
import { validateConnection } from '../../lib/jira/client.js';

export const GET: APIRoute = async () => {
  try {
    const isJiraConnected = await validateConnection();
    const timestamp = new Date().toISOString();
    
    const healthStatus = {
      status: isJiraConnected ? 'healthy' : 'degraded',
      timestamp,
      services: {
        jira: {
          status: isJiraConnected ? 'up' : 'down',
          message: isJiraConnected 
            ? 'Jira connection successful' 
            : 'Jira connection failed'
        }
      },
      version: '1.0.0'
    };

    const httpStatus = isJiraConnected ? 200 : 503;

    return new Response(
      JSON.stringify(healthStatus, null, 2),
      { 
        status: httpStatus,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
