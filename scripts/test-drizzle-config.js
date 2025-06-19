#!/usr/bin/env node

/**
 * Test script for Drizzle configuration
 * Following Clean Code: Configuration validation, clear output
 */

import { config } from 'dotenv';

// Load environment variables
config();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logHeader(message) {
  log(`\n${colors.bold}=== ${message} ===${colors.reset}`, 'blue');
}

async function testDrizzleConfig() {
  try {
    logHeader('Drizzle Configuration Test');

    const provider = process.env.DATABASE_PROVIDER || 'mock';
    log(`Database Provider: ${provider}`);

  try {
    // Import the config dynamically
    let drizzleConfig;
    try {
      const configModule = await import('../drizzle.config.js');
      drizzleConfig = configModule.default;
      logSuccess('Drizzle configuration loaded successfully');
    } catch (importError) {
      logError(`Failed to import drizzle.config.js: ${importError.message}`);
      return;
    }
    
    // Display configuration details
    log('\nConfiguration Details:');
    if (drizzleConfig) {
      log(`Schema: ${drizzleConfig.schema || 'not specified'}`);
      log(`Output: ${drizzleConfig.out || 'not specified'}`);
      log(`Dialect: ${drizzleConfig.dialect || 'not specified'}`);
      log(`Driver: ${drizzleConfig.driver || 'not specified'}`);
    } else {
      logWarning('Configuration object is empty or undefined');
    }
    
    // Check credentials based on provider
    if (provider === 'turso') {
      logHeader('Turso Configuration Check');
      
      const url = process.env.TURSO_DATABASE_URL;
      const token = process.env.TURSO_AUTH_TOKEN;
      
      if (!url) {
        logError('TURSO_DATABASE_URL is not set');
      } else {
        logSuccess(`Database URL: ${url}`);
      }
      
      if (!token) {
        logError('TURSO_AUTH_TOKEN is not set');
      } else {
        logSuccess(`Auth Token: ${token.substring(0, 20)}...`);
      }
      
      if (url && token) {
        logSuccess('Turso configuration is complete');
      } else {
        logError('Turso configuration is incomplete');
      }
    }
    
    // Test schema import
    logHeader('Schema Validation');
    try {
      const { tursoSchema } = await import('../src/lib/database/schemas/turso-schema.ts');
      logSuccess('Schema imported successfully');
      
      const tables = Object.keys(tursoSchema);
      log(`Tables defined: ${tables.join(', ')}`);
      
      if (tables.length > 0) {
        logSuccess(`Found ${tables.length} table(s) in schema`);
      } else {
        logWarning('No tables found in schema');
      }
    } catch (error) {
      logError(`Schema import failed: ${error.message}`);
    }
    
    logHeader('Test Summary');
    logSuccess('Drizzle configuration test completed');
    
    if (provider === 'mock') {
      logWarning('Currently using mock provider');
      log('To use Turso, set DATABASE_PROVIDER=turso and configure credentials');
    } else if (provider === 'turso') {
      log('Ready to run Drizzle commands:');
      log('  npm run db:generate  # Generate migrations');
      log('  npm run db:push      # Apply to database');
      log('  npm run db:studio    # Open Drizzle Studio');
    }
    
  } catch (error) {
    logError(`Configuration test failed: ${error.message}`);
    
    logHeader('Troubleshooting');
    log('Common issues:');
    log('1. Missing environment variables');
    log('2. Invalid database provider');
    log('3. Incorrect file paths in config');
    log('4. Missing dependencies');
    
    process.exit(1);
  }

  } catch (globalError) {
    logError(`Global error in test: ${globalError.message}`);
    console.error('Full error:', globalError);
    process.exit(1);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting Drizzle configuration test...');
  testDrizzleConfig().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    console.error('Full error:', error);
    process.exit(1);
  });
}

export { testDrizzleConfig };
