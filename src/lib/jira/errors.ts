/**
 * Jira API error types
 * Following Clean Code: Express intent, exception handling
 */

export class JiraApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = 'JiraApiError';
  }
}

export class JiraAuthenticationError extends JiraApiError {
  constructor(message = 'Jira authentication failed') {
    super(message, 401);
    this.name = 'JiraAuthenticationError';
  }
}

export class JiraRateLimitError extends JiraApiError {
  constructor(
    message = 'Jira API rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 429);
    this.name = 'JiraRateLimitError';
  }
}

export class JiraNotFoundError extends JiraApiError {
  constructor(resource: string) {
    super(`Jira resource not found: ${resource}`, 404);
    this.name = 'JiraNotFoundError';
  }
}
