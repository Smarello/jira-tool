/**
 * Test suite for Board Configuration Helper
 * Following Clean Code: Descriptive test names, AAA pattern
 * Following automated-tests rule: Testing business logic only
 */

import { getBoardStatusConfiguration } from '../board-config.js';
import type { BoardStatusConfiguration } from '../board-config.js';
import type { McpAtlassianClient } from '../../mcp/atlassian.js';

// Mock MCP client factory
const createMockMcpClient = (
  toDoStatusSuccess: boolean = true,
  doneStatusSuccess: boolean = true,
  toDoStatusIds: string[] = ['10001', '10002'],
  doneStatusIds: string[] = ['10003', '10004']
): McpAtlassianClient => ({
  getBoardToDoStatusIds: jest.fn().mockResolvedValue({
    success: toDoStatusSuccess,
    data: toDoStatusSuccess ? toDoStatusIds : null
  }),
  getBoardDoneStatusIds: jest.fn().mockResolvedValue({
    success: doneStatusSuccess,
    data: doneStatusSuccess ? doneStatusIds : null
  }),
  getIssueChangelog: jest.fn(),
  getProjectBoards: jest.fn(),
  getBoardSprints: jest.fn(),
  getBoardInfo: jest.fn(),
  getBoardIssues: jest.fn(),
  getSprintDetails: jest.fn(),
  getSprintIssues: jest.fn()
});

describe('getBoardStatusConfiguration', () => {
  const boardId = 'BOARD-123';

  test('should fetch and return board status configuration successfully', async () => {
    // Arrange
    const toDoStatusIds = ['10001', '10002'];
    const doneStatusIds = ['10003', '10004'];
    const mcpClient = createMockMcpClient(true, true, toDoStatusIds, doneStatusIds);

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.boardId).toBe(boardId);
    expect(result!.toDoStatusIds).toEqual(toDoStatusIds);
    expect(result!.doneStatusIds).toEqual(doneStatusIds);

    // Verify API calls were made
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledWith(boardId);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledWith(boardId);
  });

  test('should fetch status configurations in parallel for performance', async () => {
    // Arrange
    const mcpClient = createMockMcpClient();
    
    // Act
    await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    // Both calls should be made (parallel execution)
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledTimes(1);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledTimes(1);
  });

  test('should return null when To Do status fetch fails', async () => {
    // Arrange
    const mcpClient = createMockMcpClient(false, true); // To Do fails, Done succeeds

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).toBeNull();
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledWith(boardId);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledWith(boardId);
  });

  test('should return null when Done status fetch fails', async () => {
    // Arrange
    const mcpClient = createMockMcpClient(true, false); // To Do succeeds, Done fails

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).toBeNull();
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledWith(boardId);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledWith(boardId);
  });

  test('should return null when both status fetches fail', async () => {
    // Arrange
    const mcpClient = createMockMcpClient(false, false); // Both fail

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).toBeNull();
    expect(mcpClient.getBoardToDoStatusIds).toHaveBeenCalledWith(boardId);
    expect(mcpClient.getBoardDoneStatusIds).toHaveBeenCalledWith(boardId);
  });

  test('should handle empty status arrays', async () => {
    // Arrange
    const emptyToDoStatuses: string[] = [];
    const emptyDoneStatuses: string[] = [];
    const mcpClient = createMockMcpClient(true, true, emptyToDoStatuses, emptyDoneStatuses);

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.toDoStatusIds).toEqual([]);
    expect(result!.doneStatusIds).toEqual([]);
    expect(result!.boardId).toBe(boardId);
  });

  test('should handle single status IDs', async () => {
    // Arrange
    const singleToDoStatus = ['10001'];
    const singleDoneStatus = ['10003'];
    const mcpClient = createMockMcpClient(true, true, singleToDoStatus, singleDoneStatus);

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.toDoStatusIds).toEqual(['10001']);
    expect(result!.doneStatusIds).toEqual(['10003']);
  });

  test('should handle multiple status IDs for complex workflows', async () => {
    // Arrange
    const complexToDoStatuses = ['10001', '10002', '10005', '10006']; // To Do, In Progress, Code Review, Testing
    const complexDoneStatuses = ['10003', '10004', '10007']; // Done, Closed, Released
    const mcpClient = createMockMcpClient(true, true, complexToDoStatuses, complexDoneStatuses);

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.toDoStatusIds).toHaveLength(4);
    expect(result!.doneStatusIds).toHaveLength(3);
    expect(result!.toDoStatusIds).toEqual(complexToDoStatuses);
    expect(result!.doneStatusIds).toEqual(complexDoneStatuses);
  });

  test('should return configuration with readonly arrays', async () => {
    // Arrange
    const toDoStatusIds = ['10001', '10002'];
    const doneStatusIds = ['10003', '10004'];
    const mcpClient = createMockMcpClient(true, true, toDoStatusIds, doneStatusIds);

    // Act
    const result = await getBoardStatusConfiguration(boardId, mcpClient);

    // Assert
    expect(result).not.toBeNull();
    
    // Configuration should be properly structured
    expect(result!.toDoStatusIds).toEqual(toDoStatusIds);
    expect(result!.doneStatusIds).toEqual(doneStatusIds);
    expect(result!.boardId).toBe(boardId);
    
    // Arrays should be defined and accessible
    expect(Array.isArray(result!.toDoStatusIds)).toBe(true);
    expect(Array.isArray(result!.doneStatusIds)).toBe(true);
  });

  test('should work with real-world board scenarios', async () => {
    // Arrange - Typical Scrum board configuration
    const scrumToDoStatuses = ['10000', '10001']; // Backlog, Selected for Development
    const scrumDoneStatuses = ['10004', '10005']; // Done, Released
    const mcpClient = createMockMcpClient(true, true, scrumToDoStatuses, scrumDoneStatuses);

    // Act
    const result = await getBoardStatusConfiguration('SCRUM-456', mcpClient);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.boardId).toBe('SCRUM-456');
    expect(result!.toDoStatusIds).toEqual(scrumToDoStatuses);
    expect(result!.doneStatusIds).toEqual(scrumDoneStatuses);
  });
});
