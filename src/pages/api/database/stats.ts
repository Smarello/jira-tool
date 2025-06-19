/**
 * Database statistics API endpoint
 * Following Clean Code: Single responsibility, monitoring support
 */

import type { APIRoute } from 'astro';
import { getDatabaseService } from '../../../lib/database';

export const GET: APIRoute = async () => {
  try {
    const databaseService = getDatabaseService();
    
    // Get maintenance statistics
    const maintenanceResult = await databaseService.performMaintenance();
    
    return new Response(
      JSON.stringify({
        database: {
          status: 'connected',
          provider: process.env.DATABASE_PROVIDER || 'mock',
          lastMaintenance: new Date().toISOString()
        },
        maintenance: {
          sprintsDeleted: maintenanceResult.sprintsDeleted,
          issuesDeleted: maintenanceResult.issuesDeleted
        },
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
        database: {
          status: 'error',
          provider: process.env.DATABASE_PROVIDER || 'mock'
        },
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action;

    if (action !== 'cleanup') {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Only "cleanup" is supported.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const databaseService = getDatabaseService();
    const maintenanceResult = await databaseService.performMaintenance();
    
    return new Response(
      JSON.stringify({
        message: 'Database cleanup completed',
        result: {
          sprintsDeleted: maintenanceResult.sprintsDeleted,
          issuesDeleted: maintenanceResult.issuesDeleted
        },
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
        error: 'Database cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
