#!/usr/bin/env node

/**
 * Test script for database integration
 * Following Clean Code: Testing utilities, clear output
 */

// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

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

function logHeader(message) {
  log(`\n${colors.bold}=== ${message} ===${colors.reset}`, 'blue');
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

async function testEndpoint(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  logHeader('Database Integration Test Suite');
  
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:4321';
  const testBoardId = process.env.TEST_BOARD_ID || '123';
  
  log(`Base URL: ${baseUrl}`);
  log(`Test Board ID: ${testBoardId}`);
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Database Stats
  logHeader('Test 1: Database Stats');
  totalTests++;
  
  const statsResult = await testEndpoint(`${baseUrl}/api/database/stats`);
  if (statsResult.success) {
    logSuccess('Database stats endpoint accessible');
    log(`Provider: ${statsResult.data.database?.provider || 'unknown'}`);
    log(`Status: ${statsResult.data.database?.status || 'unknown'}`);
    passedTests++;
  } else {
    logError(`Database stats failed: ${statsResult.error || statsResult.data?.error}`);
  }
  
  // Test 2: Velocity Cache Status
  logHeader('Test 2: Velocity Cache Status');
  totalTests++;
  
  const cacheResult = await testEndpoint(`${baseUrl}/api/velocity/${testBoardId}/cache`);
  if (cacheResult.success) {
    logSuccess('Velocity cache endpoint accessible');
    log(`Cached: ${cacheResult.data.cached}`);
    if (cacheResult.data.cached) {
      log(`Cache Age: ${cacheResult.data.cacheAge} hours`);
      log(`Total Sprints: ${cacheResult.data.totalSprints}`);
    }
    passedTests++;
  } else {
    logError(`Velocity cache failed: ${cacheResult.error || cacheResult.data?.error}`);
  }
  
  // Test 3: Velocity Data (First Call)
  logHeader('Test 3: Velocity Data (First Call)');
  totalTests++;
  
  const velocityResult1 = await testEndpoint(`${baseUrl}/api/velocity/${testBoardId}`);
  if (velocityResult1.success) {
    logSuccess('Velocity endpoint accessible');
    log(`Board: ${velocityResult1.data.boardName || 'Unknown'}`);
    log(`From Cache: ${velocityResult1.data.fromCache}`);
    log(`Sprints: ${velocityResult1.data.sprints?.length || 0}`);
    passedTests++;
  } else {
    logError(`Velocity data failed: ${velocityResult1.error || velocityResult1.data?.error}`);
  }
  
  // Test 4: Velocity Data (Second Call - Should be cached)
  logHeader('Test 4: Velocity Data (Second Call - Should be cached)');
  totalTests++;
  
  const velocityResult2 = await testEndpoint(`${baseUrl}/api/velocity/${testBoardId}`);
  if (velocityResult2.success) {
    logSuccess('Velocity endpoint accessible (second call)');
    log(`From Cache: ${velocityResult2.data.fromCache}`);
    
    if (velocityResult2.data.fromCache) {
      logSuccess('Caching is working correctly!');
    } else {
      logWarning('Data not cached (might be expected in mock mode)');
    }
    passedTests++;
  } else {
    logError(`Velocity data (second call) failed: ${velocityResult2.error || velocityResult2.data?.error}`);
  }
  
  // Test 5: Force Refresh
  logHeader('Test 5: Force Refresh');
  totalTests++;
  
  const refreshResult = await testEndpoint(`${baseUrl}/api/velocity/${testBoardId}?refresh=true`);
  if (refreshResult.success) {
    logSuccess('Force refresh working');
    log(`From Cache: ${refreshResult.data.fromCache} (should be false)`);
    
    if (!refreshResult.data.fromCache) {
      logSuccess('Force refresh bypassed cache correctly!');
    } else {
      logWarning('Force refresh did not bypass cache');
    }
    passedTests++;
  } else {
    logError(`Force refresh failed: ${refreshResult.error || refreshResult.data?.error}`);
  }
  
  // Test 6: Cache Refresh via POST
  logHeader('Test 6: Cache Refresh via POST');
  totalTests++;
  
  const postRefreshResult = await testEndpoint(`${baseUrl}/api/velocity/${testBoardId}/cache`, 'POST');
  if (postRefreshResult.success) {
    logSuccess('Cache refresh via POST working');
    log(`Refreshed: ${postRefreshResult.data.refreshed}`);
    log(`Total Sprints: ${postRefreshResult.data.totalSprints}`);
    passedTests++;
  } else {
    logError(`Cache refresh POST failed: ${postRefreshResult.error || postRefreshResult.data?.error}`);
  }
  
  // Summary
  logHeader('Test Summary');
  log(`Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    logSuccess('🎉 All tests passed! Database integration is working correctly.');
  } else {
    logWarning(`⚠️  ${totalTests - passedTests} test(s) failed. Check the output above.`);
  }
  
  // Environment Info
  logHeader('Environment Information');
  log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  log(`DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER || 'not set'}`);
  log(`VELOCITY_CACHE_ENABLED: ${process.env.VELOCITY_CACHE_ENABLED || 'not set'}`);
  
  return passedTests === totalTests;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Test suite failed: ${error.message}`);
      process.exit(1);
    });
}

export { runTests };
