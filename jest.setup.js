/**
 * Jest setup file for global test configuration
 * Following Clean Code: Minimal setup, clear purpose
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console.log for cleaner test output (optional)
global.console = {
  ...console,
  // Uncomment to disable logs during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test helpers (if needed)
// Add any global test utilities here 