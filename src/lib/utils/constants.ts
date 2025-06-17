/**
 * Application constants
 * Following Clean Code: Replace magic numbers with named constants
 */

export const APP_NAME = 'Jira Tool Analytics' as const;

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  JIRA_HEALTH: '/api/health/jira',
  VELOCITY_BOARDS: '/api/velocity/boards',
  VELOCITY_DATA: '/api/velocity',
  ANALYTICS: '/api/jira/analytics',
  PROJECT_METRICS: '/api/jira/project',
  CACHE_DEBUG: '/api/debug/cache',
  FIELDS_DEBUG: '/api/debug/fields',
  PERFORMANCE_TEST: '/api/debug/performance-test',
} as const;

export const CACHE_KEYS = {
  BOARDS: 'jira:boards',
  VELOCITY: 'velocity:',
  ANALYTICS: 'analytics:',
  PROJECT_METRICS: 'project:',
  HEALTH: 'health:jira',
} as const;

export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
} as const;

export const DEFAULT_PAGE_SIZE = 50 as const;

export const MAX_ISSUES_PER_REQUEST = 100 as const;

export const PRIORITY_COLORS = {
  'Highest': 'text-red-600',
  'High': 'text-orange-500',
  'Medium': 'text-yellow-500',
  'Low': 'text-green-500',
  'Lowest': 'text-gray-500'
} as const;

export const STATUS_COLORS = {
  'To Do': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Done': 'bg-green-100 text-green-800'
} as const;

export const JIRA_TOOL_BRAND_COLORS = {
  primary: '#2563eb',
  secondary: '#64748b',
  accent: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

export const DEFAULT_PAGINATION = {
  startAt: 0,
  maxResults: 50,
} as const;
