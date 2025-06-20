/**
 * Test script for database-first strategy
 * Following Clean Code: Express intent, comprehensive testing
 */

// Use built-in fetch (Node.js 18+)

async function testDatabaseFirstStrategy() {
  console.log('🧪 Testing Database-First Strategy Implementation');
  console.log('=' .repeat(60));

  const baseUrl = 'http://localhost:4321';
  
  try {
    // Test 1: Check if server is running
    console.log('\n1️⃣ Testing server connectivity...');
    const healthResponse = await fetch(`${baseUrl}/api/health/jira`);
    
    if (!healthResponse.ok) {
      console.log('❌ Server not running or health check failed');
      return;
    }
    
    console.log('✅ Server is running');
    
    // Test 2: Test batch endpoint with database-first strategy
    console.log('\n2️⃣ Testing batch endpoint with database-first strategy...');
    
    const testBoardId = '1314'; // Using a valid board ID from the logs
    const batchUrl = `${baseUrl}/api/velocity/${testBoardId}/batch?start=3&end=6&maxIssues=100`;
    
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
    
    // Test 3: Analyze database-first strategy results
    console.log('\n3️⃣ Analyzing database-first strategy results...');
    
    if (data.database && data.database.databaseFirstStrategy) {
      const strategy = data.database.databaseFirstStrategy;
      
      console.log('📈 Database-First Strategy Results:');
      console.log(`   - Enabled: ${strategy.enabled}`);
      console.log(`   - Hit Rate: ${strategy.hitRate.toFixed(1)}%`);
      console.log(`   - Sprints from Database: ${strategy.sprintsFromDatabase}`);
      console.log(`   - Sprints from API: ${strategy.sprintsFromApi}`);
      
      if (strategy.enabled && strategy.hitRate > 0) {
        console.log('✅ Database-first strategy is working! Some data loaded from database.');
      } else if (strategy.enabled && strategy.hitRate === 0) {
        console.log('⚠️ Database-first strategy enabled but no data found in database (expected for first run).');
      } else {
        console.log('❌ Database-first strategy not enabled or failed.');
      }
    } else {
      console.log('❌ No database-first strategy information in response');
    }
    
    // Test 4: Check sprint data quality
    console.log('\n4️⃣ Checking sprint data quality...');
    
    if (data.sprints && data.sprints.length > 0) {
      console.log(`📊 Total sprints returned: ${data.sprints.length}`);
      
      const closedSprints = data.sprints.filter(s => s.sprint.state === 'closed');
      console.log(`📊 Closed sprints: ${closedSprints.length}`);
      
      // Check if any sprints have the fromDatabase marker
      const sprintsFromDb = data.sprints.filter(s => s.fromDatabase === true);
      console.log(`📊 Sprints marked as from database: ${sprintsFromDb.length}`);
      
      if (sprintsFromDb.length > 0) {
        console.log('✅ Found sprints loaded from database!');
        console.log('   Sample sprint from database:', {
          name: sprintsFromDb[0].sprint.name,
          state: sprintsFromDb[0].sprint.state,
          committedPoints: sprintsFromDb[0].committedPoints,
          completedPoints: sprintsFromDb[0].completedPoints
        });
      } else {
        console.log('ℹ️ No sprints marked as from database (may be first run or all from API)');
      }
    } else {
      console.log('❌ No sprint data returned');
    }
    
    // Test 5: Test second call to verify caching
    console.log('\n5️⃣ Testing second call to verify database caching...');
    
    const secondStartTime = Date.now();
    const secondResponse = await fetch(batchUrl);
    const secondEndTime = Date.now();
    
    console.log(`⏱️ Second call response time: ${secondEndTime - secondStartTime}ms`);
    
    if (secondResponse.ok) {
      const secondData = await secondResponse.json();
      
      if (secondData.database && secondData.database.databaseFirstStrategy) {
        const secondStrategy = secondData.database.databaseFirstStrategy;
        
        console.log('📈 Second Call Database Strategy:');
        console.log(`   - Hit Rate: ${secondStrategy.hitRate.toFixed(1)}%`);
        console.log(`   - Sprints from Database: ${secondStrategy.sprintsFromDatabase}`);
        console.log(`   - Sprints from API: ${secondStrategy.sprintsFromApi}`);
        
        if (data.database && data.database.databaseFirstStrategy) {
          const firstStrategy = data.database.databaseFirstStrategy;

          if (secondStrategy.hitRate > firstStrategy.hitRate) {
            console.log('✅ Database hit rate improved on second call! Caching is working.');
          } else if (secondStrategy.hitRate === firstStrategy.hitRate && firstStrategy.hitRate > 0) {
            console.log('✅ Database hit rate consistent. Caching is stable.');
          } else {
            console.log('ℹ️ Database hit rate unchanged (may be expected if no new data was cached).');
          }
        }
      }
    }
    
    console.log('\n🎉 Database-first strategy test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDatabaseFirstStrategy().catch(console.error);
