/**
 * API endpoint for fetching project boards
 * Following Clean Code: Single responsibility, early return, clear error handling
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../lib/mcp/atlassian.js';

export const GET: APIRoute = async () => {
  try {
    const client = getMcpAtlassianClient();
    const boardsResponse = await client.getProjectBoards('NP');
    
    if (!boardsResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: boardsResponse.error || 'Failed to fetch boards' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        boards: boardsResponse.data,
        timestamp: new Date().toISOString()
      }),
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
