/**
 * Test script to verify batch endpoint with database persistence
 * Following Clean Code: Integration testing, API verification
 */

const { config } = require('dotenv');

// Load environment variables
config();

async function testBatchEndpoint() {
  console.log('🧪 Testing batch endpoint with database persistence...\n');
  
  // Check if server is running
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:4321';
  console.log(`🌐 Testing against: ${baseUrl}`);
  
  try {
    // Test 1: Check if server is running
    console.log('\n1️⃣ Checking if server is running...');
    
    const healthResponse = await fetch(`${baseUrl}/`).catch(() => null);
    if (!healthResponse) {
      console.log('❌ Server is not running. Please start the server with: npm run dev');
      console.log('💡 Then run this test again');
      return;
    }
    console.log('✅ Server is running');
    
    // Test 2: Test batch endpoint with a real board
    console.log('\n2️⃣ Testing batch endpoint...');
    
    // Use a test board ID - you might need to replace this with a real board ID
    const testBoardId = '1'; // Replace with a real board ID from your JIRA
    const batchUrl = `${baseUrl}/api/velocity/${testBoardId}/batch?start=0&end=3&maxIssues=100`;
    
    console.log(`📡 Calling: ${batchUrl}`);
    
    const startTime = Date.now();
    const response = await fetch(batchUrl);
    const endTime = Date.now();
    
    console.log(`⏱️ Response time: ${endTime - startTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Batch endpoint failed:', errorText);
      return;
    }
    
    const data = await response.json();
    
    // Test 3: Verify response structure
    console.log('\n3️⃣ Verifying response structure...');
    
    const expectedFields = ['boardId', 'boardName', 'sprints', 'batch', 'stage', 'metadata', 'timestamp'];
    const missingFields = expectedFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      console.log('❌ Missing fields in response:', missingFields);
    } else {
      console.log('✅ Response structure is correct');
    }
    
    // Test 4: Check database persistence info
    console.log('\n4️⃣ Checking database persistence...');
    
    if (data.database) {
      console.log('✅ Database persistence info found:', {
        persistedSprints: data.database.persistedSprints,
        failedSprints: data.database.failedSprints,
        success: data.database.success
      });
      
      if (data.database.persistedSprints > 0) {
        console.log('🎉 SUCCESS: Sprints were persisted to database!');
      } else if (data.database.failedSprints > 0) {
        console.log('⚠️ Some sprints failed to persist (might be duplicates)');
      } else {
        console.log('ℹ️ No sprints to persist (might be no closed sprints in range)');
      }
    } else {
      console.log('❌ No database persistence info in response');
      console.log('💡 This might indicate database service is not working');
    }
    
    // Test 5: Display summary
    console.log('\n5️⃣ Response Summary:');
    console.log(`📋 Board: ${data.boardName} (${data.boardId})`);
    console.log(`📊 Sprints in batch: ${data.batch?.sprintsInBatch || 0}`);
    console.log(`📈 Total sprints: ${data.batch?.totalSprints || 0}`);
    console.log(`🎯 Stage: ${data.stage}`);
    
    if (data.sprints && data.sprints.length > 0) {
      console.log(`\n📋 Sprint Details:`);
      data.sprints.forEach((sprint, index) => {
        console.log(`  ${index + 1}. ${sprint.sprint?.name || 'Unknown'} (${sprint.sprint?.state || 'Unknown'})`);
        console.log(`     Points: ${sprint.committedPoints}→${sprint.completedPoints} (${sprint.completionRate}%)`);
      });
    }
    
    console.log('\n🎉 Batch endpoint test completed successfully!');
    
    // Test 6: Verify database provider
    console.log('\n6️⃣ Environment Check:');
    console.log(`🗄️ Database Provider: ${process.env.DATABASE_PROVIDER || 'not set'}`);
    
    if (process.env.DATABASE_PROVIDER === 'turso') {
      console.log('✅ Using Turso database - persistence should work');
      console.log(`🔗 Database URL: ${process.env.TURSO_DATABASE_URL ? 'configured' : 'not configured'}`);
    } else if (process.env.DATABASE_PROVIDER === 'mock') {
      console.log('⚠️ Using mock database - no actual persistence');
    } else {
      console.log('❓ Unknown database provider');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure the server is running: npm run dev');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Server connection refused. Check if the server is running on the correct port.');
    }
  }
}

// Helper function to check if we're in the right environment
function checkEnvironment() {
  console.log('🔍 Environment Check:');
  console.log(`📁 Working Directory: ${process.cwd()}`);
  console.log(`🗄️ Database Provider: ${process.env.DATABASE_PROVIDER || 'not set'}`);
  console.log(`🔧 Node Environment: ${process.env.NODE_ENV || 'not set'}`);
  
  if (!process.env.DATABASE_PROVIDER) {
    console.log('\n⚠️ DATABASE_PROVIDER not set in environment');
    console.log('💡 Make sure you have a .env file with DATABASE_PROVIDER=turso');
  }
}

// Run the test
console.log('🚀 Starting batch endpoint integration test...\n');
checkEnvironment();
testBatchEndpoint();
