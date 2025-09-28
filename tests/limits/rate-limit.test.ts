/**
 * Tests for rate limiting functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, createSafetyMiddleware, getRateLimitStatus } from '../../src/lib/safety-limits';

describe('Rate Limiting', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and clear any existing metrics
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('checkRateLimit', () => {
    it('should allow requests under RPM limit', () => {
      const origin = 'test-origin-1';

      // Make requests within limit
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(origin, 10);
        expect(result.allowed).toBe(true);
        expect(result.type).toBe('OK');
      }
    });

    it('should reject requests over RPM limit', () => {
      process.env.RATE_LIMIT_RPM = '3'; // Lower limit for testing

      const origin = 'test-origin-2';

      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(origin, 10);
        expect(result.allowed).toBe(true);
      }

      // Next request should be rejected
      const result = checkRateLimit(origin, 10);
      expect(result.allowed).toBe(false);
      expect(result.type).toBe('RPM');
      expect(result.message).toContain('Rate limit exceeded: 3 requests per minute');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reject requests over daily token budget', () => {
      process.env.DAILY_BUDGET_TOKENS = '100'; // Low budget for testing

      const origin = 'test-origin-3';

      // Use up most of the budget
      let result = checkRateLimit(origin, 90);
      expect(result.allowed).toBe(true);

      // Next request should exceed budget
      result = checkRateLimit(origin, 20);
      expect(result.allowed).toBe(false);
      expect(result.type).toBe('DAILY_TOKENS');
      expect(result.message).toContain('Daily token budget exceeded: 100 tokens per day');
    });

    it('should track tokens correctly', () => {
      const origin = 'test-origin-4';

      checkRateLimit(origin, 50);
      checkRateLimit(origin, 30);

      const status = getRateLimitStatus();
      expect(status[origin].tokens_today).toBe(80);
    });

    it('should handle different origins separately', () => {
      process.env.RATE_LIMIT_RPM = '2';

      const origin1 = 'test-origin-5a';
      const origin2 = 'test-origin-5b';

      // Max out origin1
      checkRateLimit(origin1, 10);
      checkRateLimit(origin1, 10);

      // origin1 should be limited
      let result = checkRateLimit(origin1, 10);
      expect(result.allowed).toBe(false);

      // origin2 should still be allowed
      result = checkRateLimit(origin2, 10);
      expect(result.allowed).toBe(true);
    });

    it('should reset daily counters on new date', () => {
      const origin = 'test-origin-6';

      // Use some tokens
      checkRateLimit(origin, 50);

      // Simulate date change by mocking the internal date
      const originalDate = Date.prototype.toISOString;
      Date.prototype.toISOString = function() {
        return '2024-01-02T00:00:00.000Z'; // Different date
      };

      // Should reset counters
      const result = checkRateLimit(origin, 10);
      expect(result.allowed).toBe(true);

      const status = getRateLimitStatus();
      expect(status[origin].tokens_today).toBe(10); // Reset and new token count

      // Restore original date function
      Date.prototype.toISOString = originalDate;
    });

    it('should clean old requests from RPM tracking', () => {
      process.env.RATE_LIMIT_RPM = '2';

      const origin = 'test-origin-7';

      // Mock time to control timestamps
      const originalNow = Date.now;
      let mockTime = 1000000;

      Date.now = () => mockTime;

      // Make requests at specific times
      checkRateLimit(origin, 10); // t=1000000
      checkRateLimit(origin, 10); // t=1000000

      // Should be at limit
      let result = checkRateLimit(origin, 10);
      expect(result.allowed).toBe(false);

      // Advance time by 2 minutes
      mockTime += 120000;

      // Should be allowed again (old requests cleaned)
      result = checkRateLimit(origin, 10);
      expect(result.allowed).toBe(true);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('Safety Middleware', () => {
    it('should create middleware that allows valid requests', () => {
      const middleware = createSafetyMiddleware();

      const mockReq = {
        headers: { origin: 'test-origin' },
        body: {
          template: {
            scenario: {
              title: 'Test',
              options: [{ id: 'a', name: 'Option A' }]
            }
          }
        }
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        header: vi.fn()
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject requests over rate limit', () => {
      process.env.RATE_LIMIT_RPM = '1';

      const middleware = createSafetyMiddleware();

      const mockReq = {
        headers: { origin: 'test-origin-limited' },
        body: {}
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        header: vi.fn()
      };

      const mockNext = vi.fn();

      // First request should pass
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request should be rejected
      vi.clearAllMocks();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RATE_LIMIT',
          message: expect.stringContaining('Too many requests, please try again shortly')
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid scenarios', () => {
      const middleware = createSafetyMiddleware();

      const mockReq = {
        headers: { origin: 'test-origin' },
        body: {
          template: {
            scenario: {
              // Missing title and options
            }
          }
        }
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        header: vi.fn()
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BAD_INPUT',
          message: expect.stringContaining('Scenario title is required')
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle different origin formats', () => {
      const middleware = createSafetyMiddleware();

      const testCases = [
        { headers: { 'x-forwarded-for': '192.168.1.1' }, expected: '192.168.1.1' },
        { headers: { 'x-real-ip': '10.0.0.1' }, expected: '10.0.0.1' },
        { headers: { origin: 'https://example.com' }, expected: 'https://example.com' },
        { headers: {}, expected: 'unknown' }
      ];

      testCases.forEach(({ headers }, index) => {
        const mockReq = { headers, body: {} };
        const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn(), header: vi.fn() };
        const mockNext = vi.fn();

        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('Rate Limit Status', () => {
    it('should provide accurate status information', () => {
      const origin = 'test-origin-status';

      // Make some requests
      checkRateLimit(origin, 25);
      checkRateLimit(origin, 15);

      const status = getRateLimitStatus();

      expect(status[origin]).toMatchObject({
        rpm_current: 2,
        rpm_limit: expect.any(Number),
        tokens_today: 40,
        tokens_limit: expect.any(Number),
        last_reset: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      });
    });

    it('should track multiple origins', () => {
      checkRateLimit('origin-a', 10);
      checkRateLimit('origin-b', 20);

      const status = getRateLimitStatus();

      expect(status['origin-a']).toBeDefined();
      expect(status['origin-b']).toBeDefined();
      expect(status['origin-a'].tokens_today).toBe(10);
      expect(status['origin-b'].tokens_today).toBe(20);
    });

    it('should reflect current state accurately', () => {
      process.env.RATE_LIMIT_RPM = '3';
      process.env.DAILY_BUDGET_TOKENS = '100';

      const origin = 'test-status-accuracy';

      checkRateLimit(origin, 10);
      checkRateLimit(origin, 20);
      checkRateLimit(origin, 30);

      const status = getRateLimitStatus();

      expect(status[origin]).toMatchObject({
        rpm_current: 3,
        rpm_limit: 3,
        tokens_today: 60,
        tokens_limit: 100
      });
    });
  });
});