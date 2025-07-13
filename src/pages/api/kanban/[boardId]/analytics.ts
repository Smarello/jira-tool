/**
 * API endpoint for Kanban analytics
 * Returns cycle time percentiles for a specific board
 * Following Clean Code: Express intent, Single responsibility
 */

import type { APIRoute } from 'astro';
import { calculateKanbanAnalytics } from '../../../../lib/services/kanban-analytics-service.js';
import { getMcpAtlassianClient } from '../../../../lib/mcp/atlassian.js';
import { TimePeriod } from '../../../../lib/jira/types.js';
import type { TimePeriodFilter } from '../../../../lib/jira/types.js';

export const GET: APIRoute = async ({ params, url }) => {
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
    console.log(`[KanbanAnalyticsAPI] Calculating analytics for board ${boardId}`);
    
    // Parse query parameters for time period filter
    const timePeriodType = url.searchParams.get('period') as TimePeriod | null;
    const customStart = url.searchParams.get('start');
    const customEnd = url.searchParams.get('end');
    
    // Parse query parameters for issue types filter
    const issueTypesParam = url.searchParams.get('issueTypes');
    const selectedIssueTypes = issueTypesParam ? issueTypesParam.split(',').filter(type => type.trim()) : undefined;
    
    let timePeriodFilter: TimePeriodFilter | undefined;
    
    if (timePeriodType && Object.values(TimePeriod).includes(timePeriodType)) {
      timePeriodFilter = {
        type: timePeriodType,
        customRange: timePeriodType === TimePeriod.CUSTOM && customStart && customEnd 
          ? { start: customStart, end: customEnd }
          : undefined
      };
      
      console.log(`[KanbanAnalyticsAPI] Using time period filter:`, timePeriodFilter);
    }
    
    if (selectedIssueTypes && selectedIssueTypes.length > 0) {
      console.log(`[KanbanAnalyticsAPI] Using issue types filter:`, selectedIssueTypes);
    }
    
    const mcpClient = getMcpAtlassianClient();
    const analytics = await calculateKanbanAnalytics(boardId, mcpClient, timePeriodFilter, selectedIssueTypes);
    
    console.log(`[KanbanAnalyticsAPI] Analytics calculated successfully for board ${boardId}`);
    console.log(`  - Total issues: ${analytics.totalIssues}`);
    console.log(`  - Completed issues: ${analytics.completedIssues}`);
    console.log(`  - Sample size: ${analytics.cycleTimePercentiles.sampleSize}`);

    return new Response(
      JSON.stringify(analytics),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=900' // Cache for 15 minutes like other Kanban endpoints
        } 
      }
    );
  } catch (error) {
    console.error(`[KanbanAnalyticsAPI] Error calculating analytics for board ${boardId}:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to calculate Kanban analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
