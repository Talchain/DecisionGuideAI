/**
 * Error Messages Catalogue Contract Tests
 * Validates that error taxonomy maps to correct HTTP codes and public phrases
 */

import { describe, it, expect } from 'vitest';
import { toPublicError } from '../../src/lib/error-normaliser.js';
import { ERR_MSG } from '../../src/lib/error-messages.js';

describe('Error Messages Catalogue Contract', () => {
  describe('Error Normalisation', () => {
    it('should map BAD_INPUT with missing items to catalogue phrase', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Request validation failed: Required field \'items\' is missing',
        field: 'items'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.REQUEST_ITEMS_REQUIRED);
      expect(result.timestamp).toBeDefined();
    });

    it('should map BAD_INPUT with missing scenarioId to catalogue phrase', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Request validation failed: Required field \'scenarioId\' is missing',
        field: 'scenarioId'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.SCENARIO_ID_REQUIRED);
      expect(result.timestamp).toBeDefined();
    });

    it('should map item-specific validation errors to catalogue phrases', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Item 1: scenarioId required',
        field: 'scenarioId'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.ITEM_SCENARIO_ID_REQUIRED);
    });

    it('should map seed validation errors to catalogue phrases', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Item 1: seed must be an integer',
        field: 'seed'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.ITEM_SEED_MUST_BE_INTEGER);
    });

    it('should map type validation errors to catalogue phrases', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Request validation failed: Expected type \'integer\' but got \'string\'',
        field: 'seed'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.SEED_MUST_BE_NUMBER);
    });

    it('should map rate limit errors to catalogue phrases', () => {
      const result = toPublicError({
        type: 'RATE_LIMIT',
        devDetail: 'Too many requests from this client'
      });

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.message).toBe(ERR_MSG.RATE_LIMIT_RPM);
      expect(result.retryable).toBe(true);
    });

    it('should include timestamp in all error responses', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Test error'
      });

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should preserve error taxonomy codes', () => {
      const badInputResult = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Test validation error'
      });

      const rateLimitResult = toPublicError({
        type: 'RATE_LIMIT',
        devDetail: 'Rate limit exceeded'
      });

      const notFoundResult = toPublicError({
        type: 'NOT_FOUND',
        devDetail: 'Resource not found'
      });

      expect(badInputResult.type).toBe('BAD_INPUT');
      expect(rateLimitResult.type).toBe('RATE_LIMIT');
      expect(notFoundResult.type).toBe('NOT_FOUND');
    });

    it('should fallback to generic message for unknown errors', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Unknown validation error format'
      });

      expect(result.type).toBe('BAD_INPUT');
      expect(result.message).toBe(ERR_MSG.BAD_INPUT_SCHEMA);
    });
  });

  describe('Catalogue Message Consistency', () => {
    it('should have consistent message format for required fields', () => {
      expect(ERR_MSG.REQUEST_ITEMS_REQUIRED).toBe('Request must include items array');
      expect(ERR_MSG.SCENARIO_ID_REQUIRED).toBe('scenarioId required');
      expect(ERR_MSG.LEFT_RIGHT_SCENARIOS_REQUIRED).toBe('left and right scenarios required');
    });

    it('should have consistent format for item-specific errors', () => {
      expect(ERR_MSG.ITEM_SCENARIO_ID_REQUIRED).toBe('Item 1: scenarioId required');
      expect(ERR_MSG.ITEM_SEED_MUST_BE_INTEGER).toBe('Item 1: seed must be an integer');
    });

    it('should use British English spelling and formatting', () => {
      expect(ERR_MSG.NODE_CAP_EXCEEDED).toContain('Scenario too large for pilot');
      expect(ERR_MSG.RATE_LIMIT_RPM).toContain('please try again shortly');
    });

    it('should maintain stable error taxonomy mappings', () => {
      // These mappings should never change as they are part of the public contract
      const taxonomyMappings = {
        'BAD_INPUT': ['Request must include items array', 'scenarioId required'],
        'RATE_LIMIT': ['Too many requests, please try again shortly'],
        'NOT_FOUND': ['not found'],
        'RESOURCE_LIMIT': ['Scenario too large for pilot (12-node cap)']
      };

      // Verify key catalogue messages exist and maintain their phrasing
      expect(ERR_MSG.REQUEST_ITEMS_REQUIRED).toBe(taxonomyMappings.BAD_INPUT[0]);
      expect(ERR_MSG.SCENARIO_ID_REQUIRED).toBe(taxonomyMappings.BAD_INPUT[1]);
      expect(ERR_MSG.RATE_LIMIT_RPM).toBe(taxonomyMappings.RATE_LIMIT[0]);
      expect(ERR_MSG.NOT_FOUND).toBe(taxonomyMappings.NOT_FOUND[0]);
      expect(ERR_MSG.NODE_CAP_EXCEEDED).toBe(taxonomyMappings.RESOURCE_LIMIT[0]);
    });
  });

  describe('Response Format Stability', () => {
    it('should return consistent error response structure', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Test error'
      });

      // Verify response has required fields with correct types
      expect(typeof result.type).toBe('string');
      expect(typeof result.message).toBe('string');
      expect(typeof result.timestamp).toBe('string');

      // Verify no extra fields in public response (no devDetail exposure)
      const allowedFields = ['type', 'message', 'timestamp', 'retryable'];
      const responseFields = Object.keys(result);

      responseFields.forEach(field => {
        expect(allowedFields).toContain(field);
      });
    });

    it('should not expose internal validation details in public message', () => {
      const result = toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Request validation failed: Required field \'scenarioId\' is missing',
        field: 'scenarioId'
      });

      expect(result.message).toBe(ERR_MSG.SCENARIO_ID_REQUIRED);
      expect(result.message).not.toContain('Request validation failed');
      expect(result.message).not.toContain('Required field');
      expect(result.message).not.toContain('missing');
    });
  });
});