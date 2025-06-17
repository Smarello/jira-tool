/**
 * Server-Sent Events API endpoint for real-time velocity calculation progress
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian';
import { calculateRealSprintsVelocityWithProgress } from '../../../../lib/velocity/calculator';
import { 
  createEnhancedVelocityData,
  type SprintVelocity 
} from '../../../../lib/velocity/mock-calculator';

/**
 * Progress event interface for type safety
 * Following Clean Code: Express intent, immutability
 */
interface ProgressEvent {
  readonly type: 'progress' | 'complete' | 'error';
  readonly phase: 'fetching' | 'calculating' | 'validating' | 'complete';
  readonly currentSprint: number;
  readonly totalSprints: number;
  readonly sprintName: string;
  readonly message: string;
  readonly data?: any;
}

export const GET: APIRoute = async ({ params, request }) => {
  const boardId = params.boardId;
  
  // Validate required parameter
  if (!boardId || typeof boardId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Board ID is required' }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  // Set up Server-Sent Events headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      };

      const processVelocity = async () => {
        try {
          // Initialize MCP client
          const mcpClient = getMcpAtlassianClient();
          
          // Send initial progress
          sendEvent({
            type: 'progress',
            phase: 'fetching',
            currentSprint: 0,
            totalSprints: 0,
            sprintName: '',
            message: 'Initializing velocity calculation...'
          });

          // Fetch sprints
          const sprintsResponse = await mcpClient.getBoardSprints(boardId);
          
          if (!sprintsResponse.success) {
            sendEvent({
              type: 'error',
              phase: 'fetching',
              currentSprint: 0,
              totalSprints: 0,
              sprintName: '',
              message: sprintsResponse.error || 'Failed to fetch sprints'
            });
            controller.close();
            return;
          }

          // Handle Kanban boards
          if (sprintsResponse.data.length === 0) {
            const boardResponse = await mcpClient.getBoardInfo(boardId);
            const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;
            
            sendEvent({
              type: 'complete',
              phase: 'complete',
              currentSprint: 0,
              totalSprints: 0,
              sprintName: '',
              message: 'Kanban board detected - no velocity data available',
              data: {
                boardId,
                boardName,
                sprints: [],
                averageVelocity: 0,
                trend: 'no-data',
                predictability: 0,
                message: 'This board does not support velocity tracking (likely a Kanban board)'
              }
            });
            controller.close();
            return;
          }

          // Get board info
          const boardResponse = await mcpClient.getBoardInfo(boardId);
          const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

          const totalSprints = sprintsResponse.data.length;
          
          sendEvent({
            type: 'progress',
            phase: 'fetching',
            currentSprint: 0,
            totalSprints,
            sprintName: '',
            message: `Found ${totalSprints} sprints to analyze`
          });

          // Calculate velocity with progress callbacks
          const issuesApi = mcpClient.getIssuesApi();
          
          const sprintVelocities = await calculateRealSprintsVelocityWithProgress(
            sprintsResponse.data,
            issuesApi,
            mcpClient,
            (currentSprint: number, sprintName: string, phase: string) => {
              let message = '';
              
              switch (phase) {
                case 'fetching':
                  message = 'Fetching sprint issues...';
                  break;
                case 'validating':
                  message = `Validating issues and loading changelog data...`;
                  break;
                case 'calculating':
                  message = 'Calculating final velocity metrics...';
                  break;
                default:
                  message = `Processing sprint ${currentSprint} of ${totalSprints}`;
              }
              
              sendEvent({
                type: 'progress',
                phase: phase as any,
                currentSprint,
                totalSprints,
                sprintName,
                message
              });
            }
          );

          // Finalize results
          sendEvent({
            type: 'progress',
            phase: 'complete',
            currentSprint: totalSprints,
            totalSprints,
            sprintName: '',
            message: 'Finalizing velocity data...'
          });

          const velocityData = createEnhancedVelocityData(
            boardId,
            boardName,
            sprintVelocities
          );

          // Send final results
          sendEvent({
            type: 'complete',
            phase: 'complete',
            currentSprint: totalSprints,
            totalSprints,
            sprintName: '',
            message: 'Velocity calculation complete!',
            data: {
              ...velocityData,
              timestamp: new Date().toISOString()
            }
          });

          controller.close();
        } catch (error) {
          sendEvent({
            type: 'error',
            phase: 'calculating',
            currentSprint: 0,
            totalSprints: 0,
            sprintName: '',
            message: 'Internal server error during velocity calculation'
          });
          controller.close();
        }
      };

      // Start processing
      processVelocity();
    }
  });

  return new Response(stream, { headers });
}; 