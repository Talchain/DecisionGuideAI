/**
 * Health Contract Tests
 * Ensures /health endpoint meets contract requirements
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { HealthService, HealthResponse, isValidHealthResponse } from '../../src/types/health-endpoint';

describe('Health Contract Tests', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
  });

  describe('Required Keys and Defaults', () => {
    test('should return all required keys with safe defaults', () => {
      const health = healthService.getHealth();

      // Required keys must be present
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('p95_ms');
      expect(health).toHaveProperty('replay');
      expect(health).toHaveProperty('test_routes_enabled');

      // Replay object must have required nested keys
      expect(health.replay).toHaveProperty('lastStatus');
      expect(health.replay).toHaveProperty('refusals');
      expect(health.replay).toHaveProperty('retries');
      expect(health.replay).toHaveProperty('lastTs');
    });

    test('should initialise with safe defaults on first boot', () => {
      const health = healthService.getHealth();

      // Safe defaults for first boot
      expect(health.status).toBe('healthy');
      expect(health.p95_ms).toBe(0);
      expect(health.replay.refusals).toBe(0);
      expect(health.replay.retries).toBe(0);
      expect(health.replay.lastStatus).toBe('success');
      expect(health.test_routes_enabled).toBe(false);

      // lastTs should be a valid ISO string
      expect(health.replay.lastTs).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should have no undefined values', () => {
      const health = healthService.getHealth();

      // Deep check for undefined values
      expect(health.status).toBeDefined();
      expect(health.p95_ms).toBeDefined();
      expect(health.replay).toBeDefined();
      expect(health.test_routes_enabled).toBeDefined();

      expect(health.replay.lastStatus).toBeDefined();
      expect(health.replay.refusals).toBeDefined();
      expect(health.replay.retries).toBeDefined();
      expect(health.replay.lastTs).toBeDefined();

      // JSON serialisation should not produce undefined
      const serialised = JSON.parse(JSON.stringify(health));
      expect(Object.values(serialised)).not.toContain(undefined);
      expect(Object.values(serialised.replay)).not.toContain(undefined);
    });

    test('should have correct types', () => {
      const health = healthService.getHealth();

      // Type validation
      expect(typeof health.status).toBe('string');
      expect(typeof health.p95_ms).toBe('number');
      expect(typeof health.replay).toBe('object');
      expect(typeof health.test_routes_enabled).toBe('boolean');

      expect(typeof health.replay.lastStatus).toBe('string');
      expect(typeof health.replay.refusals).toBe('number');
      expect(typeof health.replay.retries).toBe('number');
      expect(typeof health.replay.lastTs).toBe('string');

      // Numeric values should be non-negative
      expect(health.p95_ms).toBeGreaterThanOrEqual(0);
      expect(health.replay.refusals).toBeGreaterThanOrEqual(0);
      expect(health.replay.retries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Contract Compliance', () => {
    test('should pass contract validation function', () => {
      const health = healthService.getHealth();
      expect(isValidHealthResponse(health)).toBe(true);
    });

    test('should have valid enum values', () => {
      const health = healthService.getHealth();

      // Status must be valid enum
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);

      // Replay status must be valid enum
      expect(['success', 'failure', 'timeout']).toContain(health.replay.lastStatus);
    });

    test('should maintain consistency after operations', () => {
      // Record some requests
      healthService.recordRequest(100, false);
      healthService.recordRequest(200, false);
      healthService.recordRequest(300, true);

      const health = healthService.getHealth();

      // Should still pass validation
      expect(isValidHealthResponse(health)).toBe(true);

      // Should still have all required keys
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('p95_ms');
      expect(health).toHaveProperty('replay');
      expect(health).toHaveProperty('test_routes_enabled');
    });

    test('should update replay metrics correctly', () => {
      healthService.updateReplayMetrics('failure', 5, 3);
      const health = healthService.getHealth();

      expect(health.replay.lastStatus).toBe('failure');
      expect(health.replay.refusals).toBe(5);
      expect(health.replay.retries).toBe(3);

      // Should still pass validation
      expect(isValidHealthResponse(health)).toBe(true);
    });

    test('should toggle test routes enabled correctly', () => {
      // Initially false
      expect(healthService.getHealth().test_routes_enabled).toBe(false);

      // Enable test routes
      healthService.setTestRoutesEnabled(true);
      expect(healthService.getHealth().test_routes_enabled).toBe(true);

      // Disable test routes
      healthService.setTestRoutesEnabled(false);
      expect(healthService.getHealth().test_routes_enabled).toBe(false);
    });
  });

  describe('Performance Calculations', () => {
    test('should calculate p95 correctly with sample data', () => {
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

      responseTimes.forEach(time => {
        healthService.recordRequest(time, false);
      });

      const health = healthService.getHealth();

      // P95 of [100,200,300,400,500,600,700,800,900,1000]
      // With 10 values, index = ceil(10 * 0.95) - 1 = 10 - 1 = 9
      // sorted[9] = 1000
      expect(health.p95_ms).toBe(1000);
    });

    test('should handle empty metrics gracefully', () => {
      const health = healthService.getHealth();

      // Empty metrics should return 0 for p95
      expect(health.p95_ms).toBe(0);
      expect(health.status).toBe('healthy');
    });

    test('should calculate status based on metrics', () => {
      // Record high error rate
      for (let i = 0; i < 100; i++) {
        healthService.recordRequest(100, i < 15); // 15% error rate
      }

      const health = healthService.getHealth();

      // High error rate should result in unhealthy status
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('JSON Serialisation', () => {
    test('should serialise and deserialise correctly', () => {
      const originalHealth = healthService.getHealth();
      const serialised = JSON.stringify(originalHealth);
      const deserialised = JSON.parse(serialised);

      // Should maintain structure after JSON round-trip
      expect(isValidHealthResponse(deserialised)).toBe(true);
      expect(deserialised).toEqual(originalHealth);
    });

    test('should not lose precision in numeric fields', () => {
      healthService.recordRequest(123.456, false);
      const health = healthService.getHealth();
      const serialised = JSON.parse(JSON.stringify(health));

      expect(typeof serialised.p95_ms).toBe('number');
      expect(typeof serialised.replay.refusals).toBe('number');
      expect(typeof serialised.replay.retries).toBe('number');
    });
  });
});