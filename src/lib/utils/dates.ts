/**
 * Date utilities for the dashboard
 * Following Clean Code: Pure functions, intention-revealing names
 */

/**
 * Formats ISO date string to human-readable format
 * Pure function: same input always produces same output
 */
export function formatDateForDisplay(isoDate: string): string {
  const date = new Date(isoDate);
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculates time ago in human-readable format
 * Express intent: clearly shows what this function does
 */
export function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  
  return 'Just now';
}

/**
 * Checks if a date is within the last N days
 * Command-Query Separation: this function answers a question
 */
export function isWithinLastDays(isoDate: string, days: number): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  
  if (isNaN(date.getTime())) {
    return false;
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays <= days;
}
