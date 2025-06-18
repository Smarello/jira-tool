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

export const GET: APIRoute = async ({ params, request, url }) => {
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

  // Parse query parameters for optimization
  // Following Clean Code: Express intent, fail-fast validation
  const searchParams = url.searchParams;
  const limitParam = searchParams.get('limit');
  const sprintLimit = limitParam ? parseInt(limitParam, 10) : null;
  
  // Validate limit parameter
  if (limitParam && (isNaN(sprintLimit!) || sprintLimit! < 1 || sprintLimit! > 50)) {
    return new Response(
      JSON.stringify({ 
        error: 'Limit must be a number between 1 and 50' 
      }),
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
            message: sprintLimit 
              ? `Initializing velocity calculation (limited to ${sprintLimit} sprints)...`
              : 'Initializing velocity calculation...'
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

          // Apply sprint limit for performance optimization
          // Following Clean Code: Immutability, clear transformations
          let sprintsToProcess = sprintsResponse.data;
          let limitMessage = '';
          
          if (sprintLimit && sprintsToProcess.length > sprintLimit) {
            // Take the most recent sprints (last N sprints for better relevance)
            sprintsToProcess = sprintsToProcess.slice(-sprintLimit);
            limitMessage = ` (limited to last ${sprintLimit} of ${sprintsResponse.data.length} total sprints)`;
          }

          // Get board info
          const boardResponse = await mcpClient.getBoardInfo(boardId);
          const boardName = boardResponse.success ? boardResponse.data.name : `Board ${boardId}`;

          const totalSprints = sprintsToProcess.length;
          
          sendEvent({
            type: 'progress',
            phase: 'fetching',
            currentSprint: 0,
            totalSprints,
            sprintName: '',
            message: `Found ${totalSprints} sprints to analyze${limitMessage}`
          });

          // Calculate velocity with progress callbacks
          const issuesApi = mcpClient.getIssuesApi();
          
          const sprintVelocities = await calculateRealSprintsVelocityWithProgress(
            sprintsToProcess,
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

          // Send final results with metadata about limitations
          sendEvent({
            type: 'complete',
            phase: 'complete',
            currentSprint: totalSprints,
            totalSprints,
            sprintName: '',
            message: limitMessage 
              ? `Velocity calculation complete! Showing last ${sprintLimit} sprints.`
              : 'Velocity calculation complete!',
            data: {
              ...velocityData,
              timestamp: new Date().toISOString(),
              metadata: {
                requestedLimit: sprintLimit,
                totalSprintsAvailable: sprintsResponse.data.length,
                sprintsAnalyzed: totalSprints,
                limitApplied: sprintLimit !== null && sprintsResponse.data.length > sprintLimit
              }
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