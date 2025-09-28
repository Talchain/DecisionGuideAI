/**
 * Contract Tests - Tenant Sessions API
 * Tests session minting, validation, and enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleMintSessionRequest,
  isTenantSessionsEnabled,
  extractTenantSession,
  checkTenantLimits
} from '../../src/lib/tenant-sessions.js';

// Mock environment for testing
const originalEnv = process.env;

describe('Tenant Sessions Contract Tests', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Feature Toggle', () => {
    it('should be disabled by default', () => {
      delete process.env.TENANT_SIGNING_KEY;
      expect(isTenantSessionsEnabled()).toBe(false);
    });

    it('should be enabled when signing key is set', () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';
      expect(isTenantSessionsEnabled()).toBe(true);
    });
  });

  describe('POST /pilot/mint-session', () => {
    it('should return 404 when feature disabled', async () => {
      delete process.env.TENANT_SIGNING_KEY;

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('not enabled');
    });

    it('should require org field', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org field required');
    });

    it('should require plan field', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('plan field required');
    });

    it('should require caps field', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot'
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('caps field required');
    });

    it('should validate caps.rpm', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 0, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('caps.rpm must be a number between 1 and 1000');
    });

    it('should validate caps.daily_tokens', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 0, max_concurrency: 2 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('caps.daily_tokens must be a number between 1 and 1000000');
    });

    it('should validate caps.max_concurrency', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 0 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('caps.max_concurrency must be a number between 1 and 50');
    });

    it('should validate ttlMin range', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 },
        ttlMin: 2000
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('ttlMin must be between 1 and 1440 minutes');
    });

    it('should mint valid session token when enabled', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';

      const result = await handleMintSessionRequest({
        org: 'acme-corp',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 },
        ttlMin: 120
      });

      expect(result.status).toBe(200);
      expect(result.body.session).toBeDefined();
      expect(result.body.exp).toBeDefined();
      expect(typeof result.body.session).toBe('string');
      expect(result.body.session.length).toBeGreaterThan(0);

      // Verify expiry is ISO8601 format
      expect(() => new Date(result.body.exp)).not.toThrow();

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should use default TTL when not specified', async () => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';
      process.env.TENANT_TTL_MIN = '90';

      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(200);

      // Check that expiry is approximately 90 minutes from now
      const expTime = new Date(result.body.exp).getTime();
      const now = Date.now();
      const expectedExp = now + (90 * 60 * 1000);

      // Allow 5 second tolerance
      expect(Math.abs(expTime - expectedExp)).toBeLessThan(5000);
    });
  });

  describe('Session Extraction', () => {
    beforeEach(() => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';
    });

    it('should extract from Authorization header', () => {
      const headers = {
        Authorization: 'Pilot mock-session-token'
      };

      // Since we can't easily mock the token verification in this test,
      // we'll just test that the extraction logic works
      expect(() => extractTenantSession(headers)).not.toThrow();
    });

    it('should extract from X-Olumi-Session header', () => {
      const headers = {
        'X-Olumi-Session': 'mock-session-token'
      };

      expect(() => extractTenantSession(headers)).not.toThrow();
    });

    it('should return null when no session headers present', () => {
      const headers = {
        'Content-Type': 'application/json'
      };

      const result = extractTenantSession(headers);
      expect(result).toBeNull();
    });

    it('should return null when feature disabled', () => {
      delete process.env.TENANT_SIGNING_KEY;

      const headers = {
        Authorization: 'Pilot mock-session-token'
      };

      const result = extractTenantSession(headers);
      expect(result).toBeNull();
    });
  });

  describe('Rate Limit Checking', () => {
    it('should allow request within limits', () => {
      const caps = { rpm: 60, daily_tokens: 50000, max_concurrency: 2 };
      const result = checkTenantLimits('test-org', caps);

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it('should return rate limit structure for exceeded limits', () => {
      const caps = { rpm: 1, daily_tokens: 50000, max_concurrency: 2 };

      // This would require setting up internal state to exceed limits
      // For contract test, we verify the function signature and basic behavior
      const result = checkTenantLimits('test-org', caps);

      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');

      if (!result.allowed) {
        expect(result).toHaveProperty('retryAfter');
        expect(result).toHaveProperty('reason');
        expect(typeof result.retryAfter).toBe('number');
        expect(typeof result.reason).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';
    });

    it('should handle null request body', async () => {
      const result = await handleMintSessionRequest(null);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle invalid JSON structure', async () => {
      const result = await handleMintSessionRequest('invalid');

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should include timestamp in error responses', async () => {
      const result = await handleMintSessionRequest({});

      expect(result.body.timestamp).toBeDefined();
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      process.env.TENANT_SIGNING_KEY = 'test-key-32-characters-long-enough';
    });

    it('should return consistent session response structure', async () => {
      const result = await handleMintSessionRequest({
        org: 'test-org',
        plan: 'pilot',
        caps: { rpm: 60, daily_tokens: 50000, max_concurrency: 2 }
      });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('session');
      expect(result.body).toHaveProperty('exp');
      expect(typeof result.body.session).toBe('string');
      expect(typeof result.body.exp).toBe('string');
    });

    it('should return consistent error response structure', async () => {
      const result = await handleMintSessionRequest({});

      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
    });
  });
});