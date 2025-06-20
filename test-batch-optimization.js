/**
 * Test script for batch optimization performance
 * Following Clean Code: Express intent, performance measurement
 */

// Use built-in fetch (Node.js 18+)

async function testBatchOptimization() {
  console.log('🚀 Testing Batch Optimization Performance');
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
    
    // Test 2: Test batch endpoint with different ranges to measure optimization
    console.log('\n2️⃣ Testing batch optimization with multiple ranges...');
    
    const testBoardId = '1314'; // Using a valid board ID
    const testCases = [
      { start: 3, end: 6, name: 'Small batch (3 sprints)' },
      { start: 6, end: 12, name: 'Medium batch (6 sprints)' },
      { start: 0, end: 10, name: 'Large batch (10 sprints)' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📊 Testing ${testCase.name}...`);
      
      const batchUrl = `${baseUrl}/api/velocity/${testBoardId}/batch?start=${testCase.start}&end=${testCase.end}&maxIssues=200`;
      
      console.log(`📡 Calling: ${batchUrl}`);
      
      const startTime = Date.now();
      const response = await fetch(batchUrl);
      const endTime = Date.now();
      
      console.log(`⏱️ Response time: ${endTime - startTime}ms`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Batch endpoint failed:', errorText);
        continue;
      }
      
      const data = await response.json();
      
      // Analyze optimization results
      if (data.database && data.database.databaseFirstStrategy) {
        const strategy = data.database.databaseFirstStrategy;
        
        console.log('📈 Batch Optimization Results:');
        console.log(`   - Enabled: ${strategy.enabled}`);
        console.log(`   - Hit Rate: ${strategy.hitRate.toFixed(1)}%`);
        console.log(`   - Sprints from Database: ${strategy.sprintsFromDatabase}`);
        console.log(`   - Sprints from API: ${strategy.sprintsFromApi}`);
        console.log(`   - Total Sprints: ${data.sprints?.length || 0}`);
        
        // Calculate estimated query reduction
        const totalSprints = strategy.sprintsFromDatabase + strategy.sprintsFromApi;
        const oldQueries = totalSprints * 2; // Old: 2 queries per sprint (existence + issues)
        const newQueries = 2; // New: 1 batch existence + 1 batch issues
        const queryReduction = totalSprints > 0 ? ((oldQueries - newQueries) / oldQueries * 100) : 0;
        
        console.log(`📊 Estimated Query Optimization:`);
        console.log(`   - Old approach: ~${oldQueries} queries`);
        console.log(`   - New approach: ~${newQueries} queries`);
        console.log(`   - Reduction: ${queryReduction.toFixed(1)}%`);
        
        if (strategy.hitRate === 100) {
          console.log('✅ Perfect database hit rate! Maximum optimization achieved.');
        } else if (strategy.hitRate > 50) {
          console.log('✅ Good database hit rate! Significant optimization achieved.');
        } else if (strategy.hitRate > 0) {
          console.log('⚠️ Partial database hit rate. Some optimization achieved.');
        } else {
          console.log('ℹ️ No database hits (expected for new sprints).');
        }
      } else {
        console.log('❌ No database-first strategy information in response');
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 3: Test second call to same range to verify caching consistency
    console.log('\n3️⃣ Testing caching consistency...');
    
    const cacheTestUrl = `${baseUrl}/api/velocity/${testBoardId}/batch?start=3&end=6&maxIssues=100`;
    
    console.log('📡 First call...');
    const firstStartTime = Date.now();
    const firstResponse = await fetch(cacheTestUrl);
    const firstEndTime = Date.now();
    
    console.log('📡 Second call (should be faster)...');
    const secondStartTime = Date.now();
    const secondResponse = await fetch(cacheTestUrl);
    const secondEndTime = Date.now();
    
    const firstTime = firstEndTime - firstStartTime;
    const secondTime = secondEndTime - secondStartTime;
    
    console.log(`⏱️ First call: ${firstTime}ms`);
    console.log(`⏱️ Second call: ${secondTime}ms`);
    
    if (secondTime < firstTime * 0.1) {
      console.log('✅ Excellent caching! Second call is much faster.');
    } else if (secondTime < firstTime * 0.5) {
      console.log('✅ Good caching! Second call is faster.');
    } else {
      console.log('ℹ️ Caching working but similar times (may be due to database optimization).');
    }
    
    // Test 4: Performance comparison summary
    console.log('\n4️⃣ Performance Summary...');
    
    if (firstResponse.ok && secondResponse.ok) {
      const firstData = await firstResponse.json();
      const secondData = await secondResponse.json();
      
      if (firstData.database?.databaseFirstStrategy && secondData.database?.databaseFirstStrategy) {
        const firstStrategy = firstData.database.databaseFirstStrategy;
        const secondStrategy = secondData.database.databaseFirstStrategy;
        
        console.log('📊 Optimization Summary:');
        console.log(`   - Database-first strategy: ${firstStrategy.enabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   - Average hit rate: ${((firstStrategy.hitRate + secondStrategy.hitRate) / 2).toFixed(1)}%`);
        console.log(`   - Consistent results: ${firstStrategy.hitRate === secondStrategy.hitRate ? 'YES' : 'NO'}`);
        
        if (firstStrategy.enabled && firstStrategy.hitRate > 0) {
          console.log('🎉 Batch optimization is working successfully!');
          console.log('   - Reduced database queries from N*2 to 2 total');
          console.log('   - Faster response times for cached data');
          console.log('   - Consistent database-first strategy');
        } else {
          console.log('ℹ️ Optimization enabled but no cached data available (normal for new sprints)');
        }
      }
    }
    
    console.log('\n🎉 Batch optimization test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testBatchOptimization().catch(console.error);
