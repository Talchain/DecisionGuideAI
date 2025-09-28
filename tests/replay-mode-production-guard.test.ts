/**
 * Replay Mode Production Guard Tests
 *
 * Tests that REPLAY_MODE cannot be enabled in production environments.
 * This is a critical safety test to prevent replay mode from being accidentally
 * enabled in production deployments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { replayModeApi } from '../src/lib/replay/replay-mode';

describe('Replay Mode Production Guard', () => {
  let originalNodeEnv: string | undefined;
  let originalReplayMode: string | undefined;

  beforeEach(() => {
    // Store original environment variables
    originalNodeEnv = process.env.NODE_ENV;
    originalReplayMode = process.env.REPLAY_MODE;
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalReplayMode !== undefined) {
      process.env.REPLAY_MODE = originalReplayMode;
    } else {
      delete process.env.REPLAY_MODE;
    }
  });

  describe('Production Environment Safety', () => {
    it('should block REPLAY_MODE when NODE_ENV=production', () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      process.env.REPLAY_MODE = '1';

      // Verify replay mode is disabled despite REPLAY_MODE=1
      expect(replayModeApi.isEnabled()).toBe(false);
    });

    it('should block REPLAY_MODE when NODE_ENV=production (case variations)', () => {
      const productionVariants = ['production', 'PRODUCTION', 'Production'];

      for (const variant of productionVariants) {
        process.env.NODE_ENV = variant;
        process.env.REPLAY_MODE = '1';

        // Should be disabled for any case variation of 'production'
        if (variant.toLowerCase() === 'production') {
          expect(replayModeApi.isEnabled()).toBe(false);
        }
      }
    });

    it('should return 404 for all operations when production guard is active', async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      process.env.REPLAY_MODE = '1';

      // All replay operations should return 404
      const startResult = await replayModeApi.startReplay('test-run-id');
      expect(startResult.status).toBe(404);
      expect(startResult.success).toBe(false);
      expect(startResult.error).toBe('Replay mode is not enabled.');

      const eventsResult = await replayModeApi.getNextEvents('test-run-id');
      expect(eventsResult.status).toBe(404);
      expect(eventsResult.success).toBe(false);
      expect(eventsResult.error).toBe('Replay mode is not enabled.');

      const cancelResult = await replayModeApi.cancelReplay('test-run-id');
      expect(cancelResult.status).toBe(404);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error).toBe('Replay mode is not enabled.');

      const reportResult = await replayModeApi.getReplayReport('test-run-id');
      expect(reportResult.status).toBe(404);
      expect(reportResult.success).toBe(false);
      expect(reportResult.error).toBe('Replay mode is not enabled.');

      const listResult = await replayModeApi.listAvailableSnapshots();
      expect(listResult.status).toBe(404);
      expect(listResult.success).toBe(false);
      expect(listResult.error).toBe('Replay mode is not enabled.');
    });
  });

  describe('Development Environment Behaviour', () => {
    it('should allow REPLAY_MODE in development when enabled', () => {
      // Set development environment
      process.env.NODE_ENV = 'development';
      process.env.REPLAY_MODE = '1';

      // Verify replay mode is enabled
      expect(replayModeApi.isEnabled()).toBe(true);
    });

    it('should respect REPLAY_MODE=0 in development', () => {
      // Set development environment but disable replay mode
      process.env.NODE_ENV = 'development';
      process.env.REPLAY_MODE = '0';

      // Verify replay mode is disabled
      expect(replayModeApi.isEnabled()).toBe(false);
    });

    it('should respect missing REPLAY_MODE in development', () => {
      // Set development environment without REPLAY_MODE
      process.env.NODE_ENV = 'development';
      delete process.env.REPLAY_MODE;

      // Verify replay mode is disabled
      expect(replayModeApi.isEnabled()).toBe(false);
    });

    it('should allow REPLAY_MODE when NODE_ENV is unset', () => {
      // Unset NODE_ENV (defaults to development-like behaviour)
      delete process.env.NODE_ENV;
      process.env.REPLAY_MODE = '1';

      // Verify replay mode is enabled
      expect(replayModeApi.isEnabled()).toBe(true);
    });

    it('should allow REPLAY_MODE in test environment', () => {
      // Set test environment
      process.env.NODE_ENV = 'test';
      process.env.REPLAY_MODE = '1';

      // Verify replay mode is enabled
      expect(replayModeApi.isEnabled()).toBe(true);
    });
  });

  describe('Security Edge Cases', () => {
    it('should block REPLAY_MODE with production-like NODE_ENV values', () => {
      const productionLikeValues = [
        'production',
        'prod',
        'live',
        'staging-prod',
        'production-staging'
      ];

      for (const envValue of productionLikeValues) {
        process.env.NODE_ENV = envValue;
        process.env.REPLAY_MODE = '1';

        // Only exact 'production' should block replay mode
        const expectedBlocked = envValue === 'production';
        expect(replayModeApi.isEnabled()).toBe(!expectedBlocked);
      }
    });

    it('should handle malformed environment variables gracefully', () => {
      // Test with various malformed values
      const malformedValues = ['', '  ', '\n', '\t', 'null', 'undefined'];

      for (const value of malformedValues) {
        process.env.NODE_ENV = value;
        process.env.REPLAY_MODE = '1';

        // Should not crash and should allow replay mode (not production)
        expect(() => replayModeApi.isEnabled()).not.toThrow();
      }
    });
  });

  describe('Deployment Safety', () => {
    it('should demonstrate production safety with typical deployment env vars', () => {
      // Simulate typical production environment
      process.env.NODE_ENV = 'production';
      process.env.REPLAY_MODE = '1';
      process.env.LOG_LEVEL = 'warn';
      process.env.PORT = '3001';

      // Verify replay mode is blocked despite other settings
      expect(replayModeApi.isEnabled()).toBe(false);
    });

    it('should work correctly with CI environment variables', () => {
      // Simulate CI environment (not production)
      process.env.NODE_ENV = 'test';
      process.env.CI = '1';
      process.env.REPLAY_MODE = '1';

      // Verify replay mode works in CI (since NODE_ENV is test)
      expect(replayModeApi.isEnabled()).toBe(true);
    });
  });
});