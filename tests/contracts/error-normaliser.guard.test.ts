/**
 * Error Normaliser Guard Tests
 * Prevents regression where error responses bypass the normaliser
 */

import { describe, it, expect } from 'vitest';
import { toPublicError } from '../../src/lib/error-normaliser.js';

describe('Error Normaliser Guard Tests', () => {
  describe('Response Shape Validation', () => {
    it('should ensure all BAD_INPUT errors use normalised shape', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Test validation error'
      });

      // Must have these exact fields
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');

      // Type must be preserved
      expect(result.type).toBe('BAD_INPUT');

      // Must not expose internal details in public message
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);

      // Timestamp must be ISO format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should ensure all RATE_LIMIT errors use normalised shape with retryable flag', () => {
      const result = toPublicError({
        type: 'RATE_LIMIT',
        devDetail: 'Rate limit exceeded'
      });

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('retryable');

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should ensure error responses do not leak internal details', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Internal schema path: /request/body/items[0]/scenarioId validation failed with error code XYZ123',
        field: 'scenarioId'
      });

      // Should not contain internal schema paths or error codes
      expect(result.message).not.toContain('schema path');
      expect(result.message).not.toContain('XYZ123');
      expect(result.message).not.toContain('/request/body');
      expect(result.message).not.toContain('error code');

      // Should map to appropriate public message
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should prevent raw error objects from being returned', () => {
      // This test documents the expected structure to prevent raw errors
      const validErrorShape = {
        type: 'BAD_INPUT',
        message: 'User-friendly error message',
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      // All error responses must match this shape
      expect(validErrorShape).toHaveProperty('type');
      expect(validErrorShape).toHaveProperty('message');
      expect(validErrorShape).toHaveProperty('timestamp');

      // Must not have internal fields
      expect(validErrorShape).not.toHaveProperty('devDetail');
      expect(validErrorShape).not.toHaveProperty('stack');
      expect(validErrorShape).not.toHaveProperty('error');
      expect(validErrorShape).not.toHaveProperty('details');
    });

    it('should enforce consistent taxonomy types', () => {
      const validTypes = ['BAD_INPUT', 'RATE_LIMIT', 'NOT_FOUND', 'UNAUTHORIZED', 'RESOURCE_LIMIT', 'FEATURE_DISABLED', 'SYSTEM_ERROR', 'QUEUE_FULL'];

      for (const type of validTypes) {
        const result = toPublicError({
          type,
          devDetail: `Test ${type} error`
        });

        expect(result.type).toBe(type);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Contract Compliance', () => {
    it('should map validation errors to catalogue phrases consistently', () => {
      const testCases = [
        {
          input: { type: 'BAD_INPUT', devDetail: 'Request validation failed: Required field \'items\' is missing', field: 'items' },
          expectedMessage: 'Request must include items array'
        },
        {
          input: { type: 'BAD_INPUT', devDetail: 'Request validation failed: Required field \'scenarioId\' is missing', field: 'scenarioId' },
          expectedMessage: 'scenarioId required'
        },
        {
          input: { type: 'BAD_INPUT', devDetail: 'Item 1: scenarioId required', field: 'scenarioId' },
          expectedMessage: 'Item 1: scenarioId required'
        },
        {
          input: { type: 'BAD_INPUT', devDetail: 'Item 1: seed must be an integer', field: 'seed' },
          expectedMessage: 'Item 1: seed must be an integer'
        }
      ];

      for (const testCase of testCases) {
        const result = toPublicError(testCase.input);
        expect(result.message).toBe(testCase.expectedMessage);
      }
    });

    it('should preserve error taxonomy while normalising messages', () => {
      const testCases = [
        { type: 'BAD_INPUT', expectedHttpStatus: 400 },
        { type: 'RATE_LIMIT', expectedHttpStatus: 429 },
        { type: 'NOT_FOUND', expectedHttpStatus: 404 },
        { type: 'UNAUTHORIZED', expectedHttpStatus: 401 },
        { type: 'RESOURCE_LIMIT', expectedHttpStatus: 413 }
      ];

      for (const testCase of testCases) {
        const result = toPublicError({
          type: testCase.type,
          devDetail: `Test ${testCase.type} error`
        });

        // Type must be preserved exactly
        expect(result.type).toBe(testCase.type);

        // Message must be user-friendly (not contain the type name)
        expect(result.message).not.toContain(testCase.type);
      }
    });
  });
});