/**
 * Jira API response mappers
 * Following Clean Code: Express intent, immutability, single responsibility
 */

import type { JiraBoard, JiraSprint } from './boards.js';

/**
 * Raw Jira board response from API
 * Following Clean Code: Express intent, readonly properties
 */
interface JiraBoardApiResponse {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  readonly location?: {
    readonly projectId: number;
    readonly projectKey: string;
    readonly projectName: string;
  };
}

/**
 * Raw Jira sprint response from API
 * Following Clean Code: Express intent, readonly properties
 */
interface JiraSprintApiResponse {
  readonly id: number;
  readonly name: string;
  readonly state: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly completeDate?: string;
  readonly goal?: string;
  readonly originBoardId: number;
}

/**
 * Maps Jira board API response to internal type
 * Following Clean Code: Single responsibility, immutability
 */
export function mapJiraBoard(apiBoard: JiraBoardApiResponse): JiraBoard {
  // Validate required fields
  if (!apiBoard || apiBoard.id === undefined || apiBoard.id === null) {
    throw new Error(`Invalid board data: missing required id field`);
  }
  
  return {
    id: String(apiBoard.id),
    name: apiBoard.name || 'Unknown Board',
    type: mapBoardType(apiBoard.type || 'scrum'),
    projectKey: apiBoard.location?.projectKey || '',
    projectName: apiBoard.location?.projectName || '',
    location: {
      projectId: String(apiBoard.location?.projectId || '0'),
      projectKey: apiBoard.location?.projectKey || '',
      projectName: apiBoard.location?.projectName || ''
    }
  };
}

/**
 * Maps Jira sprint API response to internal type
 * Following Clean Code: Single responsibility, immutability
 */
export function mapJiraSprint(apiSprint: JiraSprintApiResponse): JiraSprint {
  return {
    id: apiSprint.id.toString(),
    name: apiSprint.name,
    state: mapSprintState(apiSprint.state),
    startDate: apiSprint.startDate || '',
    endDate: apiSprint.endDate || '',
    completeDate: apiSprint.completeDate,
    goal: apiSprint.goal,
    originBoardId: apiSprint.originBoardId.toString()
  };
}

/**
 * Maps board type string to internal enum
 * Following Clean Code: Express intent, single responsibility
 */
function mapBoardType(type: string): 'scrum' | 'kanban' {
  return type.toLowerCase() === 'kanban' ? 'kanban' : 'scrum';
}

/**
 * Maps sprint state string to internal enum
 * Following Clean Code: Express intent, single responsibility
 */
function mapSprintState(state: string): 'active' | 'closed' | 'future' {
  switch (state.toLowerCase()) {
    case 'active':
      return 'active';
    case 'closed':
      return 'closed';
    default:
      return 'future';
  }
}

/**
 * Maps array of boards with error handling
 * Following Clean Code: Single responsibility, fail fast
 */
export function mapBoardsArray(apiBoardsResponse: unknown): readonly JiraBoard[] {
  if (!Array.isArray(apiBoardsResponse)) {
    throw new Error('Invalid boards response: expected array');
  }

  return apiBoardsResponse.map(mapJiraBoard);
}

/**
 * Maps array of sprints with error handling
 * Following Clean Code: Single responsibility, fail fast
 */
export function mapSprintsArray(apiSprintsResponse: unknown): readonly JiraSprint[] {
  if (!Array.isArray(apiSprintsResponse)) {
    throw new Error('Invalid sprints response: expected array');
  }

  return apiSprintsResponse.map(mapJiraSprint);
}
