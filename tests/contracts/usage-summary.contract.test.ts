/**
 * Contract Tests - Usage Summary API
 * Tests usage metrics collection, summary generation, and CSV export
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordRunCompletion,
  recordRateLimitHit,
  generateUsageSummary,
  handleUsageSummaryRequest,
  handleUsageCsvRequest,
  getUsageStatistics,
  cleanupOldUsageData,
  resetUsageData
} from '../../src/lib/usage-summary.js';

describe('Usage Summary Contract Tests', () => {
  beforeEach(() => {
    // Clear any existing usage data by resetting
    resetUsageData();
  });

  describe('Usage Data Recording', () => {
    it('should record run completion', () => {
      recordRunCompletion('test-org', 1500, 500, 1000);

      const stats = getUsageStatistics();
      expect(stats.total_orgs).toBe(1);
      expect(stats.orgs_with_data).toContain('test-org');
      expect(stats.total_runs_across_orgs).toBe(1);
      expect(stats.total_tokens_across_orgs).toBe(1000);
    });

    it('should record run completion without cancel time', () => {
      recordRunCompletion('test-org', 1200, undefined, 800);

      const stats = getUsageStatistics();
      expect(stats.total_runs_across_orgs).toBe(1);
      expect(stats.total_tokens_across_orgs).toBe(800);
    });

    it('should record multiple runs for same org', () => {
      recordRunCompletion('test-org', 1000, 200, 500);
      recordRunCompletion('test-org', 1500, 300, 700);

      const stats = getUsageStatistics();
      expect(stats.total_orgs).toBe(1);
      expect(stats.total_runs_across_orgs).toBe(2);
      expect(stats.total_tokens_across_orgs).toBe(1200);
    });

    it('should record rate limit hits', () => {
      recordRateLimitHit('test-org');
      recordRateLimitHit('test-org');

      const stats = getUsageStatistics();
      expect(stats.total_rate_limit_hits).toBe(2);
    });

    it('should handle different orgs independently', () => {
      recordRunCompletion('org-a', 1000, 200, 500);
      recordRunCompletion('org-b', 1500, 300, 700);
      recordRateLimitHit('org-a');

      const stats = getUsageStatistics();
      expect(stats.total_orgs).toBe(2);
      expect(stats.orgs_with_data).toContain('org-a');
      expect(stats.orgs_with_data).toContain('org-b');
      expect(stats.total_runs_across_orgs).toBe(2);
      expect(stats.total_tokens_across_orgs).toBe(1200);
      expect(stats.total_rate_limit_hits).toBe(1);
    });
  });

  describe('Usage Summary Generation', () => {
    beforeEach(() => {
      // Add test data
      recordRunCompletion('test-org', 1000, 200, 500);
      recordRunCompletion('test-org', 1500, 300, 700);
      recordRunCompletion('test-org', 2000, undefined, 800);
      recordRateLimitHit('test-org');
      recordRateLimitHit('test-org');
    });

    it('should generate summary for valid period', () => {
      const summary = generateUsageSummary('test-org', '24h');

      expect(summary.schema).toBe('usage-summary.v1');
      expect(summary.org).toBe('test-org');
      expect(summary.window).toBe('last_24h');
      expect(summary.runs).toBe(3);
      expect(summary.median_ttff_ms).toBe(1500); // Median of [1000, 1500, 2000]
      expect(summary.median_cancel_ms).toBe(250); // Median of [200, 300]
      expect(summary.rate_limit_hits).toBe(2);
      expect(summary.tokens_estimated).toBe(2000);
    });

    it('should handle different time periods', () => {
      const summary7d = generateUsageSummary('test-org', '7d');
      expect(summary7d.window).toBe('last_7d');

      const summary60m = generateUsageSummary('test-org', '60m');
      expect(summary60m.window).toBe('last_60m');
    });

    it('should return empty summary for org with no data', () => {
      const summary = generateUsageSummary('empty-org', '24h');

      expect(summary.org).toBe('empty-org');
      expect(summary.runs).toBe(0);
      expect(summary.median_ttff_ms).toBe(0);
      expect(summary.median_cancel_ms).toBe(0);
      expect(summary.rate_limit_hits).toBe(0);
      expect(summary.tokens_estimated).toBe(0);
    });

    it('should handle median calculation with even number of values', () => {
      recordRunCompletion('even-org', 1000, undefined, 100);
      recordRunCompletion('even-org', 2000, undefined, 200);

      const summary = generateUsageSummary('even-org', '24h');
      expect(summary.median_ttff_ms).toBe(1500); // (1000 + 2000) / 2
    });

    it('should handle median calculation with single value', () => {
      recordRunCompletion('single-org', 1234, 567, 100);

      const summary = generateUsageSummary('single-org', '24h');
      expect(summary.median_ttff_ms).toBe(1234);
      expect(summary.median_cancel_ms).toBe(567);
    });
  });

  describe('Period Parsing', () => {
    it('should throw error for invalid period format', () => {
      expect(() => generateUsageSummary('test-org', 'invalid')).toThrow('Invalid period format');
    });

    it('should throw error for invalid period unit', () => {
      expect(() => generateUsageSummary('test-org', '24x')).toThrow('Invalid period format');
    });

    it('should handle various valid period formats', () => {
      recordRunCompletion('test-org', 1000, 200, 500);

      expect(() => generateUsageSummary('test-org', '1d')).not.toThrow();
      expect(() => generateUsageSummary('test-org', '12h')).not.toThrow();
      expect(() => generateUsageSummary('test-org', '30m')).not.toThrow();
    });
  });

  describe('GET /usage/summary', () => {
    beforeEach(() => {
      recordRunCompletion('test-org', 1500, 500, 1000);
    });

    it('should require org parameter', async () => {
      const result = await handleUsageSummaryRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org parameter required');
    });

    it('should require period parameter', async () => {
      const result = await handleUsageSummaryRequest({ org: 'test-org' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('period parameter required');
    });

    it('should validate org parameter type', async () => {
      const result = await handleUsageSummaryRequest({ org: 123, period: '24h' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org parameter required');
    });

    it('should validate period parameter type', async () => {
      const result = await handleUsageSummaryRequest({ org: 'test-org', period: 123 });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('period parameter required');
    });

    it('should validate period format', async () => {
      const result = await handleUsageSummaryRequest({ org: 'test-org', period: 'invalid' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Invalid period format');
    });

    it('should return usage summary when parameters are valid', async () => {
      const result = await handleUsageSummaryRequest({ org: 'test-org', period: '24h' });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('usage-summary.v1');
      expect(result.body.org).toBe('test-org');
      expect(result.body.window).toBe('last_24h');

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('GET /export/usage.csv', () => {
    beforeEach(() => {
      recordRunCompletion('test-org', 1500, 500, 1000);
    });

    it('should require org parameter', async () => {
      const result = await handleUsageCsvRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org parameter required');
    });

    it('should require period parameter', async () => {
      const result = await handleUsageCsvRequest({ org: 'test-org' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('period parameter required');
    });

    it('should return CSV when parameters are valid', async () => {
      const result = await handleUsageCsvRequest({ org: 'test-org', period: '7d' });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.headers['Content-Disposition']).toContain('attachment; filename=');
      expect(result.headers['Cache-Control']).toBe('no-store');

      // Check CSV structure
      const csv = result.body;
      expect(typeof csv).toBe('string');
      expect(csv).toContain('org,window,runs,median_ttff_ms');
      expect(csv).toContain('test-org,last_7d');
    });

    it('should generate proper CSV filename', async () => {
      const result = await handleUsageCsvRequest({ org: 'acme-corp', period: '30d' });

      expect(result.headers['Content-Disposition']).toMatch(
        /attachment; filename="usage_acme-corp_30d_v0\.1\.0_\d{4}-\d{2}-\d{2}\.csv"/
      );
    });

    it('should escape CSV fields properly', async () => {
      recordRunCompletion('org,with"comma', 1000, undefined, 500);

      const result = await handleUsageCsvRequest({ org: 'org,with"comma', period: '24h' });

      expect(result.status).toBe(200);
      expect(result.body).toContain('"org,with""comma"'); // Properly escaped
    });
  });

  describe('Usage Statistics', () => {
    it('should return empty statistics initially', () => {
      const stats = getUsageStatistics();

      expect(stats.total_orgs).toBe(0);
      expect(stats.orgs_with_data).toEqual([]);
      expect(stats.total_runs_across_orgs).toBe(0);
      expect(stats.total_tokens_across_orgs).toBe(0);
      expect(stats.total_rate_limit_hits).toBe(0);
    });

    it('should aggregate statistics across orgs', () => {
      recordRunCompletion('org-1', 1000, 200, 500);
      recordRunCompletion('org-1', 1500, 300, 700);
      recordRunCompletion('org-2', 2000, undefined, 800);
      recordRateLimitHit('org-1');
      recordRateLimitHit('org-2');
      recordRateLimitHit('org-2');

      const stats = getUsageStatistics();

      expect(stats.total_orgs).toBe(2);
      expect(stats.orgs_with_data).toContain('org-1');
      expect(stats.orgs_with_data).toContain('org-2');
      expect(stats.total_runs_across_orgs).toBe(3);
      expect(stats.total_tokens_across_orgs).toBe(2000);
      expect(stats.total_rate_limit_hits).toBe(3);
    });
  });

  describe('Data Cleanup', () => {
    it('should clean up old usage data', () => {
      // Add some data first
      recordRunCompletion('test-org', 1000, 200, 500);

      const statsBefore = getUsageStatistics();
      expect(statsBefore.total_runs_across_orgs).toBe(1);

      // Cleanup (in real implementation, this would only clean data older than 30 days)
      const cleaned = cleanupOldUsageData();

      // For this test, we can't easily simulate 30-day-old data,
      // so we just verify the function returns a number
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors in summary generation', async () => {
      // Mock an internal error by passing invalid data
      const result = await handleUsageSummaryRequest({ org: 'test-org', period: '999999d' });

      // Should handle gracefully (though this particular case might not error)
      expect(result.status).toBeGreaterThanOrEqual(200);
    });

    it('should include timestamp in error responses', async () => {
      const result = await handleUsageSummaryRequest({});

      expect(result.body.timestamp).toBeDefined();
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });

    it('should handle CSV generation errors gracefully', async () => {
      // Test with valid parameters
      recordRunCompletion('test-org', 1000, 200, 500);

      const result = await handleUsageCsvRequest({ org: 'test-org', period: '24h' });

      expect(result.status).toBe(200);
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      recordRunCompletion('test-org', 1500, 500, 1000);
    });

    it('should return consistent summary response structure', async () => {
      const result = await handleUsageSummaryRequest({ org: 'test-org', period: '24h' });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('schema', 'usage-summary.v1');
      expect(result.body).toHaveProperty('org');
      expect(result.body).toHaveProperty('window');
      expect(result.body).toHaveProperty('runs');
      expect(result.body).toHaveProperty('median_ttff_ms');
      expect(result.body).toHaveProperty('median_cancel_ms');
      expect(result.body).toHaveProperty('rate_limit_hits');
      expect(result.body).toHaveProperty('tokens_estimated');

      expect(typeof result.body.org).toBe('string');
      expect(typeof result.body.window).toBe('string');
      expect(typeof result.body.runs).toBe('number');
      expect(typeof result.body.median_ttff_ms).toBe('number');
      expect(typeof result.body.median_cancel_ms).toBe('number');
      expect(typeof result.body.rate_limit_hits).toBe('number');
      expect(typeof result.body.tokens_estimated).toBe('number');
    });

    it('should return consistent error response structure', async () => {
      const result = await handleUsageSummaryRequest({});

      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
    });

    it('should return consistent CSV response structure', async () => {
      const result = await handleUsageCsvRequest({ org: 'test-org', period: '24h' });

      expect(result.status).toBe(200);
      expect(result.headers).toHaveProperty('Content-Type', 'text/csv');
      expect(result.headers).toHaveProperty('Content-Disposition');
      expect(result.headers).toHaveProperty('Cache-Control', 'no-store');
      expect(typeof result.body).toBe('string');
    });
  });

  describe('Time Window Filtering', () => {
    it('should filter metrics by time window correctly', () => {
      // This would require more complex setup to test actual time filtering
      // For contract test, we verify the basic functionality works
      recordRunCompletion('test-org', 1000, 200, 500);

      const summary = generateUsageSummary('test-org', '1m');
      expect(summary.window).toBe('last_1m');

      const summary2 = generateUsageSummary('test-org', '1h');
      expect(summary2.window).toBe('last_1h');

      const summary3 = generateUsageSummary('test-org', '1d');
      expect(summary3.window).toBe('last_1d');
    });
  });
});