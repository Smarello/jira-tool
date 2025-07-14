/**
 * Board Configuration Helper
 * Centralized functions for retrieving board status configuration
 * Reusable across different metrics (kanban, velocity, throughput, etc.)
 * Following Clean Code: Single responsibility, dependency injection
 */

import type { McpAtlassianClient } from '../mcp/atlassian';

/**
 * Board status configuration for metrics calculation
 * Contains the status IDs for To Do and Done categories
 * Following Clean Code: Express intent, immutability
 */
export interface BoardStatusConfiguration {
  readonly toDoStatusIds: readonly string[];
  readonly doneStatusIds: readonly string[];
  readonly boardId: string;
}

/**
 * Retrieves board status configuration for metrics calculation
 * Fetches To Do and Done status IDs in a single operation
 * Following Clean Code: Compose operations, performance optimization
 * 
 * @param boardId The Jira board ID
 * @param mcpClient MCP client for API calls
 * @returns Board status configuration or null if failed
 */
export async function getBoardStatusConfiguration(
  boardId: string,
  mcpClient: McpAtlassianClient
): Promise<BoardStatusConfiguration | null> {
  console.log(`[BoardConfig] Fetching status configuration for board ${boardId}`);

  // Fetch both status configurations in parallel for performance
  const [toDoStatusResponse, doneStatusResponse] = await Promise.all([
    mcpClient.getBoardToDoStatusIds(boardId),
    mcpClient.getBoardDoneStatusIds(boardId)
  ]);

  // Validate both responses
  if (!toDoStatusResponse.success || !doneStatusResponse.success) {
    console.error(`[BoardConfig] Failed to fetch board status configuration for board ${boardId}`);
    console.error(`[BoardConfig] To Do Status Response: ${JSON.stringify(toDoStatusResponse)}`);
    console.error(`[BoardConfig] Done Status Response: ${JSON.stringify(doneStatusResponse)}`);
    return null;
  }

  const configuration: BoardStatusConfiguration = {
    toDoStatusIds: toDoStatusResponse.data,
    doneStatusIds: doneStatusResponse.data,
    boardId
  };

  console.log(`[BoardConfig] Board ${boardId} config: To Do statuses [${configuration.toDoStatusIds.join(', ')}], Done statuses [${configuration.doneStatusIds.join(', ')}]`);

  return configuration;
}
