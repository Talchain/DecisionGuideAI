/**
 * Snapshot Normaliser Contract Test
 * Ensures snapshot normaliser guarantees expected fields in bundles
 */

import { describe, it, expect } from 'vitest';
import { ensureReportV1Fields, ensureCompareV1Fields } from '../../src/lib/snapshot-normaliser.js';

describe('Snapshot Normaliser Contract', () => {
  describe('ensureReportV1Fields', () => {
    it('should add missing confidence field with heuristic method', () => {
      const minimalReport = {
        schema: 'report.v1',
        decision: { title: 'Test Decision' },
        meta: { seed: 42 }
      };

      const normalised = ensureReportV1Fields(minimalReport);

      expect(normalised.analysis).toBeDefined();
      expect(normalised.analysis.confidence).toBe('MEDIUM');
      expect(normalised.analysis.confidence_method).toBe('heuristic');
    });

    it('should preserve existing confidence field', () => {
      const reportWithConfidence = {
        schema: 'report.v1',
        analysis: { confidence: 'HIGH' },
        meta: { seed: 42 }
      };

      const normalised = ensureReportV1Fields(reportWithConfidence);

      expect(normalised.analysis.confidence).toBe('HIGH');
      expect(normalised.analysis.confidence_method).toBeUndefined();
    });

    it('should ensure all required fields for snapshot bundles', () => {
      const emptyReport = {};

      const normalised = ensureReportV1Fields(emptyReport);

      expect(normalised.schema).toBe('report.v1');
      expect(normalised.meta).toBeDefined();
      expect(normalised.meta.seed).toBe(42);
      expect(normalised.analysis).toBeDefined();
      expect(normalised.analysis.confidence).toBe('MEDIUM');
      expect(normalised.recommendation).toBeDefined();
      expect(normalised.recommendation.primary).toBeDefined();
      expect(normalised.decision).toBeDefined();
      expect(Array.isArray(normalised.decision.options)).toBe(true);
    });
  });

  describe('ensureCompareV1Fields', () => {
    it('should add missing confidence to both reports', () => {
      const minimalCompare = {
        left: {
          report: { schema: 'report.v1' }
        },
        right: {
          report: { schema: 'report.v1' }
        },
        delta: {}
      };

      const normalised = ensureCompareV1Fields(minimalCompare);

      expect(normalised.left.report.analysis.confidence).toBe('MEDIUM');
      expect(normalised.right.report.analysis.confidence).toBe('MEDIUM');
      expect(normalised.delta.confidence_shift).toBe('NONE');
    });

    it('should ensure schema field', () => {
      const compareWithoutSchema = {
        left: { report: {} },
        right: { report: {} }
      };

      const normalised = ensureCompareV1Fields(compareWithoutSchema);

      expect(normalised.schema).toBe('compare.v1');
    });
  });

  describe('Bundle integration', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(ensureReportV1Fields(null)).toBe(null);
      expect(ensureReportV1Fields(undefined)).toBe(undefined);
      expect(ensureCompareV1Fields(null)).toBe(null);
      expect(ensureCompareV1Fields(undefined)).toBe(undefined);
    });

    it('should handle non-object inputs gracefully', () => {
      expect(ensureReportV1Fields('string')).toBe('string');
      expect(ensureReportV1Fields(123)).toBe(123);
      expect(ensureCompareV1Fields('string')).toBe('string');
      expect(ensureCompareV1Fields(123)).toBe(123);
    });
  });
});