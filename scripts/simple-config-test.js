#!/usr/bin/env node

/**
 * Simple Drizzle configuration test
 * Following Clean Code: Simple debugging script
 */

console.log('🔄 Starting simple configuration test...');

// Load environment variables
import { config } from 'dotenv';
config();

console.log('✅ Environment variables loaded');

const provider = process.env.DATABASE_PROVIDER || 'mock';
console.log(`📊 Database Provider: ${provider}`);

// Test basic imports
try {
  console.log('🔄 Testing drizzle.config.js import...');

  // Try to import the config
  const configModule = await import('../drizzle.config.js');
  console.log('✅ drizzle.config.js imported successfully');
  
  const drizzleConfig = configModule.default;
  console.log('✅ Default export retrieved');
  
  if (drizzleConfig) {
    console.log('📋 Configuration details:');
    console.log(`  Schema: ${drizzleConfig.schema || 'not specified'}`);
    console.log(`  Output: ${drizzleConfig.out || 'not specified'}`);
    console.log(`  Dialect: ${drizzleConfig.dialect || 'not specified'}`);
    
    if (drizzleConfig.dbCredentials) {
      console.log('  Database credentials: configured');
    } else {
      console.log('  Database credentials: not configured');
    }
  } else {
    console.log('❌ Configuration is null or undefined');
  }
  
} catch (error) {
  console.log('❌ Failed to import drizzle.config.js');
  console.log(`Error: ${error.message}`);
  console.log('Full error:', error);
}

// Test schema import
try {
  console.log('🔄 Testing schema import...');
  const schemaModule = await import('../src/lib/database/schemas/turso-schema.ts');
  console.log('✅ Schema imported successfully');
  
  const { tursoSchema } = schemaModule;
  if (tursoSchema) {
    const tables = Object.keys(tursoSchema);
    console.log(`📋 Schema tables: ${tables.join(', ')}`);
  }
} catch (error) {
  console.log('❌ Failed to import schema');
  console.log(`Error: ${error.message}`);
}

// Test environment variables for Turso
if (provider === 'turso') {
  console.log('🔄 Testing Turso environment variables...');
  
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (url) {
    console.log(`✅ TURSO_DATABASE_URL: ${url}`);
  } else {
    console.log('❌ TURSO_DATABASE_URL not set');
  }
  
  if (token) {
    console.log(`✅ TURSO_AUTH_TOKEN: ${token.substring(0, 20)}...`);
  } else {
    console.log('❌ TURSO_AUTH_TOKEN not set');
  }
}

console.log('🎉 Simple configuration test completed');
