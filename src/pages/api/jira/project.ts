/**
 * API endpoint for project information
 * Following Clean Code: Single responsibility, early return
 */

import type { APIRoute } from 'astro';
import { getProject } from '../../../lib/jira/client.js';

export const GET: APIRoute = async () => {
  try {
    const projectResponse = await getProject();
    
    if (!projectResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: projectResponse.error || 'Failed to fetch project' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(projectResponse.data),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
