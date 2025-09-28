/**
 * Test suite for CORS Origin Doctor
 * Tests the diagnostic functionality for CORS configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleOriginCheckRequest, getCORSDoctorStatus } from '../src/lib/cors-origin-doctor';

describe('CORS Origin Doctor', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:5173,https://*.example.com';
    process.env.CORS_ALLOW_CREDENTIALS = 'true';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('handleOriginCheckRequest', () => {
    it('should allow whitelisted origins', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(true);
      expect(result.body.origin).toBe('http://localhost:3000');
      expect(result.body.explanation).toContain('✅');
    });

    it('should block non-whitelisted origins', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://evil.com' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(false);
      expect(result.body.origin).toBe('http://evil.com');
      expect(result.body.explanation).toContain('❌');
    });

    it('should handle wildcard patterns', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'https://subdomain.example.com' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(true);
      expect(result.body.explanation).toContain('✅');
    });

    it('should get origin from request headers', async () => {
      const result = await handleOriginCheckRequest(
        {},
        { origin: 'http://localhost:5173' }
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(true);
      expect(result.body.origin).toBe('http://localhost:5173');
    });

    it('should provide CORS configuration details', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.cors_config).toBeDefined();
      expect(result.body.cors_config.allowed_origins).toEqual([
        'http://localhost:3000',
        'http://localhost:5173',
        'https://*.example.com'
      ]);
      expect(result.body.cors_config.allow_credentials).toBe(true);
    });

    it('should provide required headers for allowed origins', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.required_headers).toBeDefined();
      expect(result.body.required_headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
      expect(result.body.required_headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should provide troubleshooting information', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://blocked.com' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.troubleshooting).toBeDefined();
      expect(result.body.troubleshooting.common_issues).toBeDefined();
      expect(result.body.troubleshooting.next_steps).toBeDefined();
    });

    it('should handle missing origin gracefully', async () => {
      const result = await handleOriginCheckRequest({}, {});

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(false);
      expect(result.body.origin).toBe('');
      expect(result.body.explanation).toContain('No origin provided');
    });

    it('should apply CORS headers to response', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
      expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should handle file:// origins with helpful message', async () => {
      const result = await handleOriginCheckRequest(
        { origin: 'file:///Users/test/index.html' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(false);
      expect(result.body.explanation).toContain('File:// origins cannot be whitelisted');
    });
  });

  describe('getCORSDoctorStatus', () => {
    it('should return comprehensive status information', () => {
      const status = getCORSDoctorStatus();

      expect(status.enabled).toBe(true);
      expect(status.endpoint).toBe('/_tools/origin-check');
      expect(status.cors_config).toBeDefined();
      expect(status.example_usage).toBeDefined();
      expect(status.static_helper).toBe('/artifacts/public/origin-check.html');
    });

    it('should include example usage', () => {
      const status = getCORSDoctorStatus();

      expect(status.example_usage.curl).toContain('curl');
      expect(status.example_usage.javascript).toContain('fetch');
    });
  });

  describe('CORS configuration parsing', () => {
    it('should handle empty CORS configuration', async () => {
      process.env.CORS_ALLOWED_ORIGINS = '';

      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(false);
    });

    it('should handle wildcard in allowed origins', async () => {
      process.env.CORS_ALLOWED_ORIGINS = '*';

      const result = await handleOriginCheckRequest(
        { origin: 'http://any-domain.com' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.allowed).toBe(true);
    });

    it('should parse custom headers configuration', async () => {
      process.env.CORS_ALLOWED_HEADERS = 'X-Custom-Header,X-Another-Header';

      const result = await handleOriginCheckRequest(
        { origin: 'http://localhost:3000' },
        {}
      );

      expect(result.status).toBe(200);
      expect(result.body.cors_config.allowed_headers).toEqual([
        'X-Custom-Header',
        'X-Another-Header'
      ]);
    });
  });
});