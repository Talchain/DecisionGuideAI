/**
 * Test suite for Pilot Controls API endpoints
 * Tests the new /ops/* endpoints for read-only monitoring and dev toggles
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleOpsFlagsRequest,
  handleOpsLimitsRequest,
  handleOpsQueueRequest,
  handleOpsToggleFlagRequest,
  getOpsConsoleStatus
} from '../src/lib/ops-console.js';

describe('Pilot Controls API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    process.env.OPS_CONSOLE_ENABLE = '1';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('GET /ops/flags', () => {
    it('should return 404 when ops console disabled', async () => {
      process.env.OPS_CONSOLE_ENABLE = '0';

      const result = await handleOpsFlagsRequest();

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should return feature flags when enabled', async () => {
      const result = await handleOpsFlagsRequest({ host: 'localhost:3000' });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.body.flags).toBeDefined();
      expect(Array.isArray(result.body.flags)).toBe(true);
      expect(result.body.meta.total).toBeGreaterThan(0);
      expect(result.body.meta.dev_toggles_enabled).toBeDefined();
    });

    it('should include flag metadata in response', async () => {
      const result = await handleOpsFlagsRequest({ host: 'localhost:3000' });

      expect(result.status).toBe(200);
      const firstFlag = result.body.flags[0];
      expect(firstFlag).toHaveProperty('name');
      expect(firstFlag).toHaveProperty('enabled');
      expect(firstFlag).toHaveProperty('source');
      expect(firstFlag).toHaveProperty('category');
      expect(firstFlag).toHaveProperty('description');
      expect(firstFlag).toHaveProperty('riskLevel');
      expect(firstFlag).toHaveProperty('environment');
    });

    it('should require auth for non-localhost', async () => {
      const result = await handleOpsFlagsRequest({ host: 'example.com' });

      expect(result.status).toBe(401);
      expect(result.headers['WWW-Authenticate']).toBe('Bearer');
    });
  });

  describe('GET /ops/limits', () => {
    it('should return 404 when ops console disabled', async () => {
      process.env.OPS_CONSOLE_ENABLE = '0';

      const result = await handleOpsLimitsRequest();

      expect(result.status).toBe(404);
    });

    it('should return effective limits configuration', async () => {
      const result = await handleOpsLimitsRequest({ host: 'localhost:3000' });

      expect(result.status).toBe(200);
      expect(result.body.limits).toBeDefined();
      expect(result.body.limits.rate_limits).toBeDefined();
      expect(result.body.limits.scenario_limits).toBeDefined();
      expect(result.body.limits.concurrency).toBeDefined();
      expect(result.body.current_usage).toBeDefined();
      expect(result.body.meta.source).toBe('environment_variables');
    });

    it('should include environment-based limit values', async () => {
      process.env.RATE_LIMIT_RPM = '120';
      process.env.MAX_NODES = '20';

      const result = await handleOpsLimitsRequest({ host: 'localhost:3000' });

      expect(result.status).toBe(200);
      expect(result.body.limits.rate_limits.rpm).toBe(120);
      expect(result.body.limits.scenario_limits.max_nodes).toBe(20);
    });
  });

  describe('GET /ops/queue', () => {
    it('should return 404 when ops console disabled', async () => {
      process.env.OPS_CONSOLE_ENABLE = '0';

      const result = await handleOpsQueueRequest();

      expect(result.status).toBe(404);
    });

    it('should return queue statistics', async () => {
      const result = await handleOpsQueueRequest({ host: 'localhost:3000' });

      expect(result.status).toBe(200);
      expect(result.body.max_concurrency_per_org).toBeDefined();
      expect(result.body.queue_max_depth).toBeDefined();
      expect(result.body.total_orgs_active).toBeDefined();
      expect(result.body.total_orgs_queued).toBeDefined();
      expect(result.body.meta.refresh_interval_suggestion).toBe('5s');
    });
  });

  describe('POST /ops/toggle-flag', () => {
    it('should return 404 when ops console disabled', async () => {
      process.env.OPS_CONSOLE_ENABLE = '0';

      const result = await handleOpsToggleFlagRequest();

      expect(result.status).toBe(404);
    });

    it('should return 403 in production environment', async () => {
      process.env.NODE_ENV = 'production';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        { flag: 'VITE_FEATURE_SSE', value: true }
      );

      expect(result.status).toBe(403);
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should validate required parameters', async () => {
      process.env.NODE_ENV = 'development';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        {}
      );

      expect(result.status).toBe(400);
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should reject unknown flags', async () => {
      process.env.NODE_ENV = 'development';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        { flag: 'UNKNOWN_FLAG', value: true }
      );

      expect(result.status).toBe(400);
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should reject server-only flags', async () => {
      process.env.NODE_ENV = 'development';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        { flag: 'SECRET_HYGIENE_ENABLED', value: true }
      );

      expect(result.status).toBe(400);
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should reject server-side high-risk flags', async () => {
      process.env.NODE_ENV = 'development';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        { flag: 'OPENAPI_ENFORCE', value: true }
      );

      expect(result.status).toBe(400);
      expect(result.body.devDetail || result.body.message).toBeTruthy();
    });

    it('should accept valid client-side flag toggles', async () => {
      process.env.NODE_ENV = 'development';

      const result = await handleOpsToggleFlagRequest(
        { host: 'localhost:3000' },
        { flag: 'VITE_FEATURE_SSE', value: true }
      );

      expect(result.status).toBe(200);
      expect(result.body.flag).toBe('VITE_FEATURE_SSE');
      expect(result.body.value).toBe(true);
      expect(result.body.note).toContain('Dev-only toggle');
    });
  });

  describe('getOpsConsoleStatus', () => {
    it('should return comprehensive status', () => {
      const status = getOpsConsoleStatus();

      expect(status.enabled).toBe(true);
      expect(status.dev_toggles_enabled).toBeDefined();
      expect(status.localhost_mode).toBe(true);
      expect(status.api_endpoints).toBeDefined();
      expect(status.api_endpoints['GET /ops/flags']).toBe('Current feature flags');
      expect(status.api_endpoints['GET /ops/limits']).toBe('Effective limits configuration');
      expect(status.api_endpoints['GET /ops/queue']).toBe('Queue status summary');
      expect(status.api_endpoints['POST /ops/toggle-flag']).toContain('Dev-only flag toggles');
    });

    it('should reflect dev toggles availability', () => {
      process.env.NODE_ENV = 'development';
      const devStatus = getOpsConsoleStatus();
      expect(devStatus.dev_toggles_enabled).toBe(true);

      process.env.NODE_ENV = 'production';
      const prodStatus = getOpsConsoleStatus();
      expect(prodStatus.dev_toggles_enabled).toBe(false);
    });
  });
});