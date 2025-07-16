/**
 * API endpoint for fetching issues in a specific sprint
 * Following Clean Code: Single responsibility, parameter validation
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../../../lib/mcp/atlassian';
import { transformIssuesForDisplay } from '../../../../../lib/velocity/sprint-issues';
import { validateIssuesForVelocity, calculateValidatedStoryPoints } from '../../../../../lib/velocity/advanced-validator';
import { filterNonSubTasks } from '../../../../../lib/velocity/calculator';

export const GET: APIRoute = async ({ params }) => {
  const sprintId = params.sprintId;
  
  // Validate required parameter
  if (!sprintId || typeof sprintId !== 'string') {
    return new Response(
      JSON.stringify({ 
        error: 'Sprint ID is required',
        issues: []
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Use MCP client for consistent API access
    const mcpClient = getMcpAtlassianClient();
    
    // Get sprint details for date validation
    const sprintResponse = await mcpClient.getSprintDetails(sprintId);
    if (!sprintResponse.success || !sprintResponse.data) {
      return new Response(
        JSON.stringify({ 
          error: 'Sprint not found',
          sprintId,
          issues: []
        }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const sprint = sprintResponse.data;
    const boardId = sprint.originBoardId;
    
    // Fetch sprint issues with story points
    const sprintIssuesResponse = await mcpClient.getSprintIssues(sprintId);
    if (!sprintIssuesResponse.success) {
      return new Response(
        JSON.stringify({
          error: sprintIssuesResponse.error || 'Failed to fetch sprint issues',
          sprintId,
          issues: []
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const sprintIssues = sprintIssuesResponse.data;
    
    // Handle empty sprint (no issues found)
    if (sprintIssues.length === 0) {
      return new Response(
        JSON.stringify({
          sprintId,
          issues: [],
          totalIssues: 0,
          message: 'No issues found in this sprint',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Filter out sub-tasks for consistent velocity calculation
    // Following Clean Code: Express intent, separate concerns  
    const nonSubTaskIssues = filterNonSubTasks(sprintIssues);
    
    // Perform advanced validation with Done column checking (excluding sub-tasks)
    const validationResults = await validateIssuesForVelocity(
      nonSubTaskIssues, 
      sprint, 
      boardId, 
      mcpClient
    );
    
    // Transform issues for display with validation info (excluding sub-tasks)
    const displayIssues = transformIssuesForDisplay(
      nonSubTaskIssues, 
      sprint, 
      validationResults
    );
    
    // Calculate sprint metrics using advanced validation (excluding sub-tasks)
    const totalIssues = nonSubTaskIssues.length;
    const completedIssues = validationResults.filter(result => 
      result.isValidForVelocity
    ).length;
    
    const totalPoints = nonSubTaskIssues.reduce((sum, issue) => 
      sum + (issue.storyPoints || 0), 0
    );
    
    const completedPoints = calculateValidatedStoryPoints(nonSubTaskIssues, validationResults);

    return new Response(
      JSON.stringify({
        sprintId,
        issues: displayIssues,
        totalIssues,
        completedIssues,
        totalPoints,
        completedPoints,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minutes cache
        } 
      }
    );
    
  } catch (error) {
    console.error(`Failed to fetch issues for sprint ${sprintId}:`, error);
    
    // Determine appropriate error status
    const isNotFound = error instanceof Error && 
      (error.message.includes('not found') || error.message.includes('404'));
      
    const statusCode = isNotFound ? 404 : 500;
    const errorMessage = isNotFound 
      ? `Sprint ${sprintId} not found`
      : 'Failed to fetch sprint issues';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        sprintId,
        issues: [],
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: statusCode, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}; 