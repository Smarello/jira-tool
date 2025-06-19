/**
 * Test script to verify database connection and persistence
 * Following Clean Code: Test-driven development, verification
 */

import { config } from 'dotenv';
import { initializeDatabaseService } from './src/lib/database/index.js';

// Load environment variables
config();

async function testDatabaseConnection() {
  console.log('🧪 Testing database connection and persistence...\n');
  
  try {
    // Test 1: Initialize database service
    console.log('1️⃣ Initializing database service...');
    const databaseService = await initializeDatabaseService();
    console.log('✅ Database service initialized successfully');
    
    // Test 2: Test database maintenance (this will verify connection)
    console.log('\n2️⃣ Testing database connection with maintenance...');
    const maintenanceResult = await databaseService.performMaintenance();
    console.log('✅ Database connection successful:', maintenanceResult);
    
    // Test 3: Test sprint persistence with mock data
    console.log('\n3️⃣ Testing sprint persistence...');
    
    const mockSprint = {
      id: 'test-sprint-' + Date.now(),
      name: 'Test Sprint for Database',
      state: 'closed',
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-14T23:59:59Z',
      completeDate: '2024-01-14T23:59:59Z',
      goal: 'Test database persistence',
      originBoardId: 'test-board-123'
    };
    
    const mockIssues = [
      {
        id: 'test-issue-1',
        key: 'TEST-1',
        summary: 'Test issue for database persistence',
        status: 'Done',
        issueType: 'Story',
        storyPoints: 5,
        created: '2024-01-01T10:00:00Z',
        updated: '2024-01-14T16:00:00Z',
        resolved: '2024-01-14T16:00:00Z'
      }
    ];
    
    const saveResult = await databaseService.saveClosedSprint(mockSprint, mockIssues);
    console.log('✅ Sprint persistence test:', saveResult);
    
    // Test 4: Test batch persistence
    console.log('\n4️⃣ Testing batch persistence...');
    
    const mockSprintsWithIssues = [
      {
        sprint: {
          id: 'test-batch-sprint-1-' + Date.now(),
          name: 'Test Batch Sprint 1',
          state: 'closed',
          startDate: '2024-01-15T00:00:00Z',
          endDate: '2024-01-28T23:59:59Z',
          completeDate: '2024-01-28T23:59:59Z',
          originBoardId: 'test-board-123'
        },
        issues: mockIssues
      },
      {
        sprint: {
          id: 'test-batch-sprint-2-' + Date.now(),
          name: 'Test Batch Sprint 2',
          state: 'closed',
          startDate: '2024-01-29T00:00:00Z',
          endDate: '2024-02-11T23:59:59Z',
          completeDate: '2024-02-11T23:59:59Z',
          originBoardId: 'test-board-123'
        },
        issues: mockIssues
      }
    ];
    
    const velocityDataMap = new Map();
    mockSprintsWithIssues.forEach(item => {
      velocityDataMap.set(item.sprint.id, {
        sprintId: item.sprint.id,
        committedPoints: 5,
        completedPoints: 5,
        issuesCount: 1,
        completedIssuesCount: 1,
        cycleTime: 0,
        averageLeadTime: 0
      });
    });
    
    const batchResult = await databaseService.saveClosedSprintsBatch(
      mockSprintsWithIssues,
      velocityDataMap
    );
    console.log('✅ Batch persistence test:', batchResult);
    
    console.log('\n🎉 All database tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Database service initialization');
    console.log('✅ Database connection verification');
    console.log('✅ Single sprint persistence');
    console.log('✅ Batch sprint persistence');
    console.log('\n💡 The database is ready for batch processing!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    
    if (error.message.includes('TURSO_DATABASE_URL')) {
      console.log('\n💡 Make sure your .env file has the correct Turso configuration:');
      console.log('DATABASE_PROVIDER=turso');
      console.log('TURSO_DATABASE_URL=your-turso-url');
      console.log('TURSO_AUTH_TOKEN=your-turso-token');
    }
    
    if (error.message.includes('Mock repository not implemented')) {
      console.log('\n💡 The database is using mock repositories. Check DATABASE_PROVIDER in .env');
    }
    
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();
