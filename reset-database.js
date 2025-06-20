/**
 * Reset database script for testing completion_date implementation
 * Following Clean Code: Single responsibility, express intent
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

// Load environment variables
config();

async function resetDatabase() {
  console.log('🗑️ Starting database reset...');
  
  try {
    // Create database connection
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    const db = drizzle(client);
    
    // Check existing tables
    console.log('🔍 Checking existing tables...');
    const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`);
    console.log('📋 Existing tables:', tables.map(t => t.name));

    // Delete all sprint issues first (foreign key constraint)
    if (tables.some(t => t.name === 'sprint_issues')) {
      console.log('🗑️ Deleting all sprint issues...');
      await db.run(sql`DELETE FROM sprint_issues`);
      console.log(`✅ Deleted sprint issues`);
    } else {
      console.log('ℹ️ Table sprint_issues does not exist');
    }

    // Delete all closed sprints
    if (tables.some(t => t.name === 'closed_sprints')) {
      console.log('🗑️ Deleting all closed sprints...');
      await db.run(sql`DELETE FROM closed_sprints`);
      console.log(`✅ Deleted closed sprints`);
    } else {
      console.log('ℹ️ Table sprints does not exist');
    }
    
    console.log('🎉 Database reset completed successfully!');
    console.log('📊 Database is now empty and ready for testing with completion_date field');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

resetDatabase();
