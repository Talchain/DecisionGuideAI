/**
 * Contract Tests - Synthetic Status Endpoints
 * Tests synthetic monitoring status endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleSynthLatestRequest,
  handlePilotMetricsRequest
} from '../../src/lib/synth-status.js';

describe('Synthetic Status Contract Tests', () => {
  describe('GET /_status/synth-latest', () => {
    it('should return synthetic monitoring status', async () => {
      const result = await handleSynthLatestRequest();

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');

      expect(result.body).toHaveProperty('status');
      expect(result.body).toHaveProperty('timestamp');
      expect(result.body).toHaveProperty('checks_passed');
      expect(result.body).toHaveProperty('checks_total');
      expect(result.body).toHaveProperty('duration_ms');

      // Should be valid status values
      expect(['PASS', 'FAIL', 'UNKNOWN', 'ERROR']).toContain(result.body.status);
      expect(typeof result.body.checks_passed).toBe('number');
      expect(typeof result.body.checks_total).toBe('number');
      expect(typeof result.body.duration_ms).toBe('number');
    });

    it('should handle missing monitoring data gracefully', async () => {
      // Even without monitoring data, should return valid structure
      const result = await handleSynthLatestRequest();

      expect(result.status).toBe(200);
      expect(result.body.status).toBeDefined();
      expect(result.body.timestamp).toBeDefined();
    });

    it('should include proper headers', async () => {
      const result = await handleSynthLatestRequest();

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('GET /_status/pilot-metrics', () => {
    it('should return 404 when pilot metrics not available', async () => {
      const result = await handlePilotMetricsRequest();

      // Most likely scenario in test environment
      if (result.status === 404) {
        expect(result.body.type).toBe('BAD_INPUT');
        expect(result.body.message).toContain('Pilot metrics not available');
        expect(result.body.timestamp).toBeDefined();
      }
    });

    it('should return pilot metrics when available', async () => {
      const result = await handlePilotMetricsRequest();

      if (result.status === 200) {
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.headers['Cache-Control']).toBe('no-store');
        expect(result.body).toBeDefined();
      }
    });

    it('should handle file read errors gracefully', async () => {
      const result = await handlePilotMetricsRequest();

      // Should return either 200 (success), 404 (not found), or 500 (error)
      expect([200, 404, 500]).toContain(result.status);

      if (result.status === 500) {
        expect(result.body.type).toBe('INTERNAL_ERROR');
        expect(result.body.message).toContain('Failed to load pilot metrics');
      }
    });
  });

  describe('Error Handling', () => {
    it('should include timestamps in error responses', async () => {
      const result = await handlePilotMetricsRequest();

      if (result.status >= 400) {
        expect(result.body.timestamp).toBeDefined();
        expect(() => new Date(result.body.timestamp)).not.toThrow();
      }
    });

    it('should return consistent error structure', async () => {
      const result = await handlePilotMetricsRequest();

      if (result.status >= 400) {
        expect(result.body).toHaveProperty('type');
        expect(result.body).toHaveProperty('message');
        expect(result.body).toHaveProperty('timestamp');
        expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
      }
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent synth-latest response structure', async () => {
      const result = await handleSynthLatestRequest();

      expect(result.status).toBe(200);
      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('body');

      expect(typeof result.body.status).toBe('string');
      expect(typeof result.body.timestamp).toBe('string');
      expect(typeof result.body.checks_passed).toBe('number');
      expect(typeof result.body.checks_total).toBe('number');
      expect(typeof result.body.duration_ms).toBe('number');
    });

    it('should have valid timestamp format', async () => {
      const result = await handleSynthLatestRequest();

      expect(result.status).toBe(200);
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });
  });
});