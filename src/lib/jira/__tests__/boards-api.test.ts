/**
 * Tests for JiraBoardsApi
 * Focus on the getToDoColumnStatusIds method with Backlog column logic
 */

import { JiraBoardsApi, type BoardConfiguration } from '../boards-api.js';
import type { JiraApiClient } from '../api-client.js';

// Mock API client
const mockApiClient = {
  get: jest.fn()
} as unknown as JiraApiClient;

describe('JiraBoardsApi', () => {
  let boardsApi: JiraBoardsApi;

  beforeEach(() => {
    boardsApi = new JiraBoardsApi(mockApiClient);
    jest.clearAllMocks();
  });

  describe('getToDoColumnStatusIds', () => {
    test('should use second column when first column is "Backlog"', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'Backlog',
            statuses: [
              { id: '1', name: 'Backlog' }
            ]
          },
          {
            name: 'To Do',
            statuses: [
              { id: '2', name: 'To Do' },
              { id: '3', name: 'Selected for Development' }
            ]
          },
          {
            name: 'In Progress',
            statuses: [
              { id: '4', name: 'In Progress' }
            ]
          }
        ]
      };

      // Mock fetchBoardConfiguration
      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual(['2', '3']);
      expect(boardsApi.fetchBoardConfiguration).toHaveBeenCalledWith('BOARD-123');
    });

    test('should use first column when first column is not "Backlog"', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'To Do',
            statuses: [
              { id: '1', name: 'To Do' },
              { id: '2', name: 'Selected for Development' }
            ]
          },
          {
            name: 'In Progress',
            statuses: [
              { id: '3', name: 'In Progress' }
            ]
          }
        ]
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual(['1', '2']);
    });

    test('should handle case-insensitive "backlog" detection', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'BACKLOG',
            statuses: [
              { id: '1', name: 'Backlog' }
            ]
          },
          {
            name: 'Ready',
            statuses: [
              { id: '2', name: 'Ready' }
            ]
          }
        ]
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual(['2']);
    });

    test('should handle "Product Backlog" as first column', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'Product Backlog',
            statuses: [
              { id: '1', name: 'Backlog' }
            ]
          },
          {
            name: 'Sprint Backlog',
            statuses: [
              { id: '2', name: 'Sprint Backlog' }
            ]
          },
          {
            name: 'In Progress',
            statuses: [
              { id: '3', name: 'In Progress' }
            ]
          }
        ]
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual(['1']);
    });

    test('should return empty array when board has no columns', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: []
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual([]);
    });

    test('should return empty array when board has only Backlog column', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'Backlog',
            statuses: [
              { id: '1', name: 'Backlog' }
            ]
          }
        ]
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual([]);
    });

    test('should handle column with no statuses', async () => {
      const mockConfig: BoardConfiguration = {
        boardId: 'BOARD-123',
        columns: [
          {
            name: 'Backlog',
            statuses: []
          },
          {
            name: 'To Do',
            statuses: []
          }
        ]
      };

      jest.spyOn(boardsApi, 'fetchBoardConfiguration').mockResolvedValue(mockConfig);

      const result = await boardsApi.getToDoColumnStatusIds('BOARD-123');

      expect(result).toEqual([]);
    });
  });
});
