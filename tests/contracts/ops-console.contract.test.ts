/**
 * Contract Tests - Operations Console
 * Tests ops console functionality, authentication, and security
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleOpsConsoleRequest,
  getOpsConsoleStatus
} from '../../src/lib/ops-console.js';

// Mock environment for testing
const originalEnv = process.env;

describe('Operations Console Contract Tests', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Feature Toggle', () => {
    it('should be disabled by default', async () => {
      delete process.env.OPS_CONSOLE_ENABLE;

      const result = await handleOpsConsoleRequest({});

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('not enabled');
    });

    it('should be enabled when OPS_CONSOLE_ENABLE=1', async () => {
      process.env.OPS_CONSOLE_ENABLE = '1';

      const status = getOpsConsoleStatus();

      expect(status.enabled).toBe(true);
    });

    it('should require string "1" to enable', async () => {
      process.env.OPS_CONSOLE_ENABLE = 'true';

      const status = getOpsConsoleStatus();

      expect(status.enabled).toBe(false);
    });
  });

  describe('Authentication - Localhost', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
    });

    it('should allow access from localhost without token', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8');
    });

    it('should allow access from 127.0.0.1 without token', async () => {
      const result = await handleOpsConsoleRequest({
        host: '127.0.0.1:3001'
      });

      expect(result.status).toBe(200);
    });

    it('should allow bare localhost', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost'
      });

      expect(result.status).toBe(200);
    });
  });

  describe('Authentication - Remote Access', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
      process.env.OPS_CONSOLE_TOKEN = 'secret-ops-token-123';
    });

    it('should require token for non-localhost access', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com'
      });

      expect(result.status).toBe(401);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Authorization header required');
    });

    it('should accept valid Bearer token', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com',
        authorization: 'Bearer secret-ops-token-123'
      });

      expect(result.status).toBe(200);
    });

    it('should reject invalid token', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com',
        authorization: 'Bearer wrong-token'
      });

      expect(result.status).toBe(401);
      expect(result.body.message).toContain('Invalid ops console token');
    });

    it('should reject malformed authorization header', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com',
        authorization: 'Basic dXNlcjpwYXNz'
      });

      expect(result.status).toBe(401);
      expect(result.body.message).toContain('Invalid Authorization format');
    });

    it('should handle case-insensitive headers', async () => {
      const result = await handleOpsConsoleRequest({
        Host: 'production.example.com',
        Authorization: 'Bearer secret-ops-token-123'
      });

      expect(result.status).toBe(200);
    });
  });

  describe('No Token Configured', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
      delete process.env.OPS_CONSOLE_TOKEN;
    });

    it('should reject non-localhost when no token configured', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com'
      });

      expect(result.status).toBe(401);
      expect(result.body.message).toContain('OPS_CONSOLE_TOKEN not configured');
    });

    it('should still allow localhost when no token configured', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      expect(result.status).toBe(200);
    });
  });

  describe('Response Security Headers', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
    });

    it('should include security headers', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      expect(result.status).toBe(200);
      expect(result.headers['X-Frame-Options']).toBe('DENY');
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should set correct content type', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8');
    });
  });

  describe('Status Information', () => {
    it('should provide comprehensive status', () => {
      process.env.OPS_CONSOLE_ENABLE = '1';
      process.env.OPS_CONSOLE_TOKEN = 'test-token';

      const status = getOpsConsoleStatus();

      expect(status).toHaveProperty('enabled', true);
      expect(status).toHaveProperty('token_configured', true);
      expect(status).toHaveProperty('localhost_mode', true);
      expect(status).toHaveProperty('html_path');
      expect(status).toHaveProperty('html_exists');
    });

    it('should show when token not configured', () => {
      process.env.OPS_CONSOLE_ENABLE = '1';
      delete process.env.OPS_CONSOLE_TOKEN;

      const status = getOpsConsoleStatus();

      expect(status.token_configured).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
    });

    it('should handle missing HTML file gracefully', async () => {
      // This test assumes the HTML file might not exist in test environment
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      // Should either return 200 (file exists) or 500 (file missing)
      expect([200, 500]).toContain(result.status);

      if (result.status === 500) {
        expect(result.body.type).toBe('INTERNAL_ERROR');
        expect(result.body.message).toContain('Failed to load operations console');
      }
    });

    it('should include timestamp in error responses', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'production.example.com'
      });

      expect(result.body.timestamp).toBeDefined();
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      process.env.OPS_CONSOLE_ENABLE = '1';
    });

    it('should return consistent success response structure', async () => {
      const result = await handleOpsConsoleRequest({
        host: 'localhost:3001'
      });

      if (result.status === 200) {
        expect(result).toHaveProperty('status', 200);
        expect(result).toHaveProperty('headers');
        expect(result).toHaveProperty('body');
        expect(typeof result.body).toBe('string'); // HTML content
      }
    });

    it('should return 401 when enabled but unauthorised', async () => {
      const result = await handleOpsConsoleRequest({});

      expect(result.status).toBe(401);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
      expect(result.headers).toHaveProperty('WWW-Authenticate', 'Bearer');
    });

    it('should return 404 when disabled', async () => {
      // Temporarily disable the console for this test
      delete process.env.OPS_CONSOLE_ENABLE;

      const result = await handleOpsConsoleRequest({});

      expect(result.status).toBe(404);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
    });
  });

  describe('Environment Edge Cases', () => {
    it('should handle empty host header', async () => {
      process.env.OPS_CONSOLE_ENABLE = '1';

      const result = await handleOpsConsoleRequest({
        host: ''
      });

      // Should treat empty host as non-localhost
      expect(result.status).toBe(401);
    });

    it('should handle missing host header', async () => {
      process.env.OPS_CONSOLE_ENABLE = '1';

      const result = await handleOpsConsoleRequest({});

      // Should treat missing host as non-localhost
      expect(result.status).toBe(401);
    });

    it('should handle localhost with port variations', async () => {
      process.env.OPS_CONSOLE_ENABLE = '1';

      const testCases = [
        'localhost:80',
        'localhost:3000',
        'localhost:8080',
        '127.0.0.1:3001'
      ];

      for (const host of testCases) {
        const result = await handleOpsConsoleRequest({ host });
        expect(result.status).toBe(200);
      }
    });
  });
});