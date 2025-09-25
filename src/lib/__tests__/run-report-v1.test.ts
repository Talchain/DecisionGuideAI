/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runReportV1Service, handleReportV1Request, logReportAccess } from '../runReportV1';

describe('Run Report v1 Pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
  });

  it('should generate valid sample report', () => {
    const sampleReport = runReportV1Service.generateSampleReport();

    expect(sampleReport.version).toBe('1.0');
    expect(sampleReport.meta).toBeDefined();
    expect(sampleReport.meta.seed).toBe(42);
    expect(sampleReport.meta.timestamp).toBeTruthy();
    expect(typeof sampleReport.meta.duration).toBe('number');
    expect(sampleReport.meta.route).toBe('/api/v1/sample');
    expect(sampleReport.meta.status).toBe('completed');

    expect(Array.isArray(sampleReport.steps)).toBe(true);
    expect(sampleReport.steps.length).toBe(2);

    expect(sampleReport.totals).toBeDefined();
    expect(sampleReport.totals.totalSteps).toBe(2);
    expect(sampleReport.totals.completedSteps).toBe(2);
  });

  it('should apply redaction correctly', async () => {
    // Mock data with sensitive fields
    const mockRawReport = {
      version: '1.0',
      meta: {
        seed: 123,
        timestamp: '2023-01-01T00:00:00.000Z',
        duration: 1000,
        route: '/test',
        status: 'completed',
        // Sensitive fields that should be redacted
        userId: 'user-123',
        sessionId: 'sess-abc',
        apiKey: 'secret-key'
      },
      steps: [
        {
          id: 'step1',
          type: 'analysis',
          startTime: 123,
          endTime: 456,
          duration: 333,
          status: 'completed',
          // Sensitive fields that should be removed
          input: 'sensitive user input',
          output: 'sensitive output',
          prompt: 'system prompt'
        }
      ],
      totals: {
        totalSteps: 1,
        completedSteps: 1,
        totalTokens: 100,
        totalCost: 0.01,
        totalDuration: 333
      }
    };

    const redacted = runReportV1Service.applyRedaction(mockRawReport);

    // Should preserve safe fields
    expect(redacted.meta.seed).toBe(123);
    expect(redacted.meta.timestamp).toBe('2023-01-01T00:00:00.000Z');
    expect(redacted.meta.status).toBe('completed');

    // Should redact sensitive fields
    expect(redacted.meta.userId).toBe('***REDACTED***');
    expect(redacted.meta.sessionId).toBe('***REDACTED***');

    // Should remove completely blacklisted fields
    expect(redacted.meta.apiKey).toBeUndefined();
    expect(redacted.steps[0].input).toBeUndefined();
    expect(redacted.steps[0].output).toBeUndefined();
    expect(redacted.steps[0].prompt).toBeUndefined();

    // Should preserve safe step fields
    expect(redacted.steps[0].id).toBe('step1');
    expect(redacted.steps[0].duration).toBe(333);
  });

  it('should handle real report fetching when enabled', async () => {
    // Enable real reports
    localStorage.setItem('feature.realReport', '1');

    const report = await handleReportV1Request('test-report-123');

    // Should return redacted real report (mocked)
    expect(report.version).toBe('1.0');
    expect(report.meta).toBeDefined();
    expect(Array.isArray(report.steps)).toBe(true);

    // Sensitive fields should be redacted in the mock
    expect(report.meta.userId).toBe('***REDACTED***'); // Masked by default redaction
  });

  it('should use sample report when real reports disabled', async () => {
    // Ensure real reports are disabled (default)
    localStorage.setItem('feature.realReport', '0');

    const report = await handleReportV1Request('any-report-id');

    // Should return sample report
    expect(report.meta.seed).toBe(42);
    expect(report.meta.route).toBe('/api/v1/sample');
    expect(report.steps.length).toBe(2);
  });

  it('should always use sample for "sample" reportId', async () => {
    // Even with real reports enabled
    localStorage.setItem('feature.realReport', '1');

    const report = await handleReportV1Request('sample');

    // Should still return sample report
    expect(report.meta.seed).toBe(42);
    expect(report.meta.route).toBe('/api/v1/sample');
  });

  it('should validate report structure', async () => {
    const invalidReportId = 'invalid-report-id';

    // Mock the fetchRawReport to return invalid data
    const originalFetch = runReportV1Service.fetchRawReport;
    runReportV1Service.fetchRawReport = vi.fn().mockResolvedValue({
      version: '1.0',
      meta: {
        // Missing required fields
        duration: 1000
      },
      steps: [],
      totals: {}
    });

    // Enable real reports to trigger validation
    localStorage.setItem('feature.realReport', '1');

    await expect(async () => {
      await handleReportV1Request(invalidReportId);
    }).rejects.toThrow('Invalid report meta: missing required fields');

    // Restore original method
    runReportV1Service.fetchRawReport = originalFetch;
  });

  it('should handle custom redaction config', () => {
    const mockData = {
      version: '1.0',
      meta: {
        seed: 123,
        timestamp: '2023-01-01T00:00:00.000Z',
        duration: 1000,
        route: '/test',
        status: 'completed',
        customField: 'should-be-masked'
      },
      steps: [],
      totals: { totalSteps: 0, completedSteps: 0, totalTokens: 0, totalCost: 0, totalDuration: 0 }
    };

    const customConfig = {
      maskFields: ['customField'],
      removeFields: ['route'],
      customRedactor: (key: string, value: any) => {
        if (key === 'seed' && value === 123) {
          return 999; // Custom transformation
        }
        return value;
      }
    };

    const redacted = runReportV1Service.applyRedaction(mockData, customConfig);

    expect(redacted.meta.customField).toBe('***REDACTED***');
    expect(redacted.meta.route).toBeUndefined();
    expect(redacted.meta.seed).toBe(999);
  });

  it('should log report access without payload data', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logReportAccess('test-report-123', true);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[RunReportV1\] Report accessed: test-report-123/)
    );

    // Should not contain actual report data
    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).not.toContain('steps');
    expect(logCall).not.toContain('tokens');
    expect(logCall).not.toContain('input');
    expect(logCall).not.toContain('output');

    consoleSpy.mockRestore();
  });

  it('should check real report flag correctly', () => {
    // Test environment variable detection (mocked)
    expect(runReportV1Service.isRealReportEnabled()).toBe(false);

    // Test localStorage detection
    localStorage.setItem('feature.realReport', '1');
    expect(runReportV1Service.isRealReportEnabled()).toBe(true);

    localStorage.setItem('feature.realReport', '0');
    expect(runReportV1Service.isRealReportEnabled()).toBe(false);
  });

  it('should handle deep nested redaction', () => {
    const nestedData = {
      version: '1.0',
      meta: {
        seed: 42,
        timestamp: '2023-01-01T00:00:00.000Z',
        duration: 1000,
        route: '/test',
        status: 'completed',
        nested: {
          userId: 'user-123',
          deepNested: {
            apiKey: 'secret',
            safeData: 'keep-me'
          }
        }
      },
      steps: [],
      totals: { totalSteps: 0, completedSteps: 0, totalTokens: 0, totalCost: 0, totalDuration: 0 }
    };

    const redacted = runReportV1Service.applyRedaction(nestedData);

    expect(redacted.meta.nested.userId).toBe('***REDACTED***');
    expect(redacted.meta.nested.deepNested.apiKey).toBeUndefined();
    expect(redacted.meta.nested.deepNested.safeData).toBe('keep-me');
  });
});