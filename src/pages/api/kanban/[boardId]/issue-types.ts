/**
 * API endpoint for fetching distinct issue types for a Kanban board
 * Returns unique issue types from board issues
 * Following Clean Code: Single responsibility, express intent
 */

import type { APIRoute } from 'astro';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian.js';

export const GET: APIRoute = async ({ params }) => {
  const boardId = params.boardId;
  
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
    console.log(`[KanbanIssueTypesAPI] Fetching issue types for board ${boardId}`);
    
    const mcpClient = getMcpAtlassianClient();
    const boardIssuesResponse = await mcpClient.getBoardIssues(boardId);
    
    if (!boardIssuesResponse.success || !boardIssuesResponse.data) {
      console.error(`[KanbanIssueTypesAPI] Failed to fetch issues for board ${boardId}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch board issues',
          issueTypes: []
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const allIssues = boardIssuesResponse.data;
    
    // Extract unique issue types using Set for deduplication
    const issueTypesSet = new Set<string>();
    
    allIssues.forEach(issue => {
      if (issue.issueType && issue.issueType.name) {
        issueTypesSet.add(issue.issueType.name);
      }
    });
    
    // Convert to sorted array
    const issueTypes = Array.from(issueTypesSet).sort();
    
    console.log(`[KanbanIssueTypesAPI] Found ${issueTypes.length} unique issue types for board ${boardId}:`, issueTypes);

    return new Response(
      JSON.stringify({
        boardId,
        issueTypes,
        totalIssues: allIssues.length,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
        } 
      }
    );
  } catch (error) {
    console.error(`[KanbanIssueTypesAPI] Error fetching issue types for board ${boardId}:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch issue types',
        details: error instanceof Error ? error.message : 'Unknown error',
        issueTypes: []
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
