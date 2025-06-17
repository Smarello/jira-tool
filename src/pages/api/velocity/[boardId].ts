/**
 * API endpoint for fetching velocity data for a specific board
 * Following Clean Code: Single responsibility, parameter validation
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../lib/mcp/atlassian';
import { calculateRealSprintsVelocity } from '../../../lib/velocity/calculator';
import { 
  createEnhancedVelocityData,
  type SprintVelocity 
} from '../../../lib/velocity/mock-calculator';

export const GET: APIRoute = async ({ params }) => {
  const boardId = params.boardId;
  
  // Validate required parameter
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ 
        error: 'Board ID is required' 
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Use MCP client for consistent API
    const mcpClient = getMcpAtlassianClient();
    const sprintsResponse = await mcpClient.getBoardSprints(boardId);
    
    // Handle Kanban boards that don't have sprints
    if (sprintsResponse.success && sprintsResponse.data.length === 0) {
      const boardResponse = await mcpClient.getBoardInfo(boardId);
      const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;
      
      return new Response(
        JSON.stringify({
          boardId,
          boardName,
          sprints: [],
          averageVelocity: 0,
          trend: 'no-data',
          predictability: 0,
          message: 'This board does not support velocity tracking (likely a Kanban board)',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!sprintsResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: sprintsResponse.error || 'Failed to fetch sprints' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get board info for real board name
    const boardResponse = await mcpClient.getBoardInfo(boardId);
    const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

    // Calculate real velocity using actual Jira issues data
    const issuesApi = mcpClient.getIssuesApi();
    const sprintVelocities = await calculateRealSprintsVelocity(sprintsResponse.data, issuesApi, mcpClient);

    const velocityData = createEnhancedVelocityData(
      boardId,
      boardName,
      sprintVelocities
    );

    return new Response(
      JSON.stringify({
        ...velocityData,
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
