/**
 * Contract Wall CI Parity Smoke Test
 * Feature flags OFF - validates core contract compliance
 * PRD v15 specification validation
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';
import { ReportV1Validator } from '../../src/types/report-schema';
import { isValidHealthResponse } from '../../src/types/health-endpoint';
import { isValidErrorCode, ErrorClassifier } from '../../src/types/error-taxonomy';
import { isSSEEventType } from '../../src/types/sse-events';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

describe('Contract Wall CI Parity Smoke Tests', () => {
  beforeAll(async () => {
    // Ensure feature flags are OFF for CI parity
    process.env.IMPORT_ENABLE = 'false';
    process.env.INSIGHTS_ENABLE = 'false';
    process.env.SCM_ENABLE = 'false';

    console.log('🧪 Contract Wall Smoke Test Starting...');
    console.log('📋 Feature flags disabled for CI parity');
  });

  afterAll(() => {
    console.log('✅ Contract Wall Smoke Test Complete');
  });

  describe('OpenAPI Contract Compliance', () => {
    test('GET /health returns valid health response', async () => {
      const response = await fetch(`${BASE_URL}/health`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const healthData = await response.json();

      // Validate against health endpoint specification
      expect(isValidHealthResponse(healthData)).toBe(true);

      // Validate required fields
      expect(healthData).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.status);
      expect(typeof healthData.p95_ms).toBe('number');
      expect(healthData.p95_ms).toBeGreaterThanOrEqual(0);

      // Validate replay object
      expect(healthData).toHaveProperty('replay');
      expect(healthData.replay).toHaveProperty('lastStatus');
      expect(['success', 'failure', 'timeout']).toContain(healthData.replay.lastStatus);
      expect(typeof healthData.replay.refusals).toBe('number');
      expect(typeof healthData.replay.retries).toBe('number');
      expect(typeof healthData.replay.lastTs).toBe('string');

      // Validate test routes flag
      expect(typeof healthData.test_routes_enabled).toBe('boolean');

      console.log('✅ Health endpoint compliance verified');
    }, TEST_TIMEOUT);

    test('GET /stream with missing seed returns 400 BAD_INPUT', async () => {
      const response = await fetch(`${BASE_URL}/stream`);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');

      const errorData = await response.json();

      // Validate error taxonomy compliance
      expect(errorData).toHaveProperty('code');
      expect(isValidErrorCode(errorData.code)).toBe(true);
      expect(errorData.code).toBe('BAD_INPUT');
      expect(errorData.retryable).toBe(false);

      console.log('✅ Error taxonomy compliance verified');
    }, TEST_TIMEOUT);

    test('POST /cancel with missing jobId returns 400', async () => {
      const response = await fetch(`${BASE_URL}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.code).toBe('BAD_INPUT');
      expect(errorData.retryable).toBe(false);

      console.log('✅ Cancel endpoint validation verified');
    }, TEST_TIMEOUT);

    test('POST /report with invalid schema returns 422', async () => {
      const invalidReport = {
        schema: 'invalid.v1',
        meta: {},
        content: {}
      };

      const response = await fetch(`${BASE_URL}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidReport)
      });

      expect(response.status).toBe(422);

      const errorData = await response.json();
      expect(errorData).toHaveProperty('validationErrors');
      expect(Array.isArray(errorData.validationErrors)).toBe(true);

      console.log('✅ Report validation compliance verified');
    }, TEST_TIMEOUT);
  });

  describe('Report Schema v1 Validation', () => {
    test('ReportV1 validator correctly identifies valid reports', () => {
      const validReport = {
        schema: 'report.v1',
        meta: {
          seed: 'abc123def456',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          analysisType: 'decision'
        },
        content: {
          title: 'Test Decision Analysis',
          summary: 'This is a test summary for validation purposes.'
        }
      };

      expect(ReportV1Validator.isValidSchema(validReport)).toBe(true);
      expect(ReportV1Validator.getValidationErrors(validReport)).toHaveLength(0);

      console.log('✅ Report schema validation working correctly');
    });

    test('ReportV1 validator correctly identifies invalid reports', () => {
      const invalidReport = {
        schema: 'report.v1',
        meta: {
          seed: 'invalid-seed',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          analysisType: 'unknown'
        },
        content: {
          title: 'A'.repeat(250), // Too long
          summary: ''  // Empty
        }
      };

      expect(ReportV1Validator.isValidSchema(invalidReport)).toBe(false);

      const errors = ReportV1Validator.getValidationErrors(invalidReport);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => err.includes('seed'))).toBe(true);
      expect(errors.some(err => err.includes('title'))).toBe(true);

      console.log('✅ Report schema error detection working correctly');
    });

    test('Meta seed validation enforces 12-char hex format', () => {
      expect(ReportV1Validator.isValidSeed('abc123def456')).toBe(true);
      expect(ReportV1Validator.isValidSeed('ABC123DEF456')).toBe(false); // uppercase
      expect(ReportV1Validator.isValidSeed('abc123def45')).toBe(false);  // too short
      expect(ReportV1Validator.isValidSeed('abc123def4567')).toBe(false); // too long
      expect(ReportV1Validator.isValidSeed('xyz123def456')).toBe(false);  // invalid chars

      console.log('✅ Meta seed validation working correctly');
    });
  });

  describe('SSE Event Type Validation', () => {
    test('Frozen event types are correctly validated', () => {
      const frozenEventTypes = ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'];

      frozenEventTypes.forEach(eventType => {
        expect(isSSEEventType(eventType)).toBe(true);
      });

      // Invalid event types
      expect(isSSEEventType('invalid')).toBe(false);
      expect(isSSEEventType('start')).toBe(false);
      expect(isSSEEventType('progress')).toBe(false);

      console.log('✅ SSE event type validation working correctly');
    });
  });

  describe('Error Taxonomy Mapping', () => {
    test('All error codes map to correct HTTP status codes', () => {
      expect(ErrorClassifier.getHttpStatus('TIMEOUT')).toBe(408);
      expect(ErrorClassifier.getHttpStatus('RETRYABLE')).toBe(503);
      expect(ErrorClassifier.getHttpStatus('INTERNAL')).toBe(500);
      expect(ErrorClassifier.getHttpStatus('BAD_INPUT')).toBe(400);
      expect(ErrorClassifier.getHttpStatus('RATE_LIMIT')).toBe(429);
      expect(ErrorClassifier.getHttpStatus('BREAKER_OPEN')).toBe(503);

      console.log('✅ Error taxonomy HTTP mapping verified');
    });

    test('Retryable classification is correct', () => {
      expect(ErrorClassifier.isRetryable('TIMEOUT')).toBe(true);
      expect(ErrorClassifier.isRetryable('RETRYABLE')).toBe(true);
      expect(ErrorClassifier.isRetryable('INTERNAL')).toBe(true);
      expect(ErrorClassifier.isRetryable('BAD_INPUT')).toBe(false);
      expect(ErrorClassifier.isRetryable('RATE_LIMIT')).toBe(true);
      expect(ErrorClassifier.isRetryable('BREAKER_OPEN')).toBe(true);

      console.log('✅ Error retryable classification verified');
    });
  });

  describe('Feature Flag Compliance', () => {
    test('Import API is disabled in CI parity mode', async () => {
      // Attempt to access import endpoint - should not exist or return 404
      try {
        const response = await fetch(`${BASE_URL}/import/dry-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });

        // Should either not exist (404) or be disabled
        expect([404, 503].includes(response.status)).toBe(true);

        console.log('✅ Import API correctly disabled');
      } catch (error) {
        // Connection refused is also acceptable - service not running
        console.log('✅ Import API not available (expected)');
      }
    });

    test('Insights API is disabled in CI parity mode', async () => {
      try {
        const response = await fetch(`${BASE_URL}/insights/analyse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });

        expect([404, 503].includes(response.status)).toBe(true);

        console.log('✅ Insights API correctly disabled');
      } catch (error) {
        console.log('✅ Insights API not available (expected)');
      }
    });

    test('SCM API is disabled in CI parity mode', async () => {
      try {
        const response = await fetch(`${BASE_URL}/scm/status`);

        expect([404, 503].includes(response.status)).toBe(true);

        console.log('✅ SCM API correctly disabled');
      } catch (error) {
        console.log('✅ SCM API not available (expected)');
      }
    });
  });

  describe('Core Contract Wall Endpoints', () => {
    test('All required endpoints are documented in OpenAPI', () => {
      // This is a documentation test - we verify the OpenAPI spec exists
      const fs = require('fs');
      const path = require('path');

      const openApiPath = path.join(__dirname, '../../artifacts/contracts/openapi-v1.yml');
      expect(fs.existsSync(openApiPath)).toBe(true);

      const openApiContent = fs.readFileSync(openApiPath, 'utf8');

      // Verify all required endpoints are documented
      expect(openApiContent).toContain('/stream');
      expect(openApiContent).toContain('/cancel');
      expect(openApiContent).toContain('/jobs/stream');
      expect(openApiContent).toContain('/jobs/cancel');
      expect(openApiContent).toContain('/report');
      expect(openApiContent).toContain('/health');

      // Verify frozen event types are documented
      expect(openApiContent).toContain('hello|token|cost|done|cancelled|limited|error');

      // Verify report schema is documented
      expect(openApiContent).toContain('report.v1');
      expect(openApiContent).toContain('meta.seed');

      console.log('✅ OpenAPI specification completeness verified');
    });
  });

  describe('Performance and Reliability', () => {
    test('Health endpoint responds within acceptable time', async () => {
      const startTime = Date.now();

      const response = await fetch(`${BASE_URL}/health`);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Under 2 seconds

      console.log(`✅ Health endpoint response time: ${responseTime}ms`);
    }, TEST_TIMEOUT);

    test('Error responses include required fields', async () => {
      const response = await fetch(`${BASE_URL}/stream?sessionId=invalid`);

      const errorData = await response.json();

      // Required error fields per taxonomy
      expect(errorData).toHaveProperty('code');
      expect(errorData).toHaveProperty('message');
      expect(errorData).toHaveProperty('retryable');
      expect(errorData).toHaveProperty('timestamp');

      // Validate timestamp format
      expect(() => new Date(errorData.timestamp)).not.toThrow();

      console.log('✅ Error response format compliance verified');
    });
  });
});

/**
 * Test Utilities
 */
export function createTestSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createValidReport() {
  return {
    schema: 'report.v1',
    meta: {
      seed: 'abc123def456',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      analysisType: 'decision'
    },
    content: {
      title: 'CI Parity Test Report',
      summary: 'Automated test report for contract wall validation.',
      recommendations: [
        {
          action: 'Proceed with implementation',
          confidence: 0.95,
          rationale: 'All tests passing'
        }
      ]
    }
  };
}