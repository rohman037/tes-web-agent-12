/**
 * Global Test Setup & Mock Configuration for Vitest
 */
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Configure test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'AIzaSy_mock_test_environment_key_0123456789';
  process.env.ADMIN_SECRET = 'test-admin-secret-xyz';
  process.env.PORT = '3000';
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
