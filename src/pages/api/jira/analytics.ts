/**
 * API endpoint for dashboard analytics
 * Following Clean Code: Express intent, Single responsibility
 */

import type { APIRoute } from 'astro';
import { getProjectIssues } from '../../../lib/jira/client.js';
import { calculateDashboardMetrics } from '../../../lib/analytics/calculator.js';

export const GET: APIRoute = async () => {
  try {
    const issuesResponse = await getProjectIssues();
    
    if (!issuesResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: issuesResponse.error || 'Failed to fetch issues' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const metrics = calculateDashboardMetrics(issuesResponse.data);

    return new Response(
      JSON.stringify(metrics),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300' // Cache for 5 minutes
        } 
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
