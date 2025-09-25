/**
 * Run Report v1 Pass-through
 * Read-only gateway route with redaction support
 * No transformation, just pass-through with privacy controls
 */

export interface ReportV1Meta {
  seed: number;
  timestamp: string;
  duration: number; // milliseconds
  route: string;
  totalTokens?: number;
  totalCost?: number;
  model?: string;
  status: 'completed' | 'cancelled' | 'error' | 'timeout';
}

export interface ReportV1Step {
  id: string | number;
  type: 'analysis' | 'generation' | 'validation' | 'processing';
  startTime: number;
  endTime: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'error' | 'skipped';
  tokens?: number;
  cost?: number;
  // Redacted fields - never exposed
  // input?: string;
  // output?: string;
  // prompt?: string;
}

export interface ReportV1 {
  version: '1.0';
  meta: ReportV1Meta;
  steps: ReportV1Step[];
  totals: {
    totalSteps: number;
    completedSteps: number;
    totalTokens: number;
    totalCost: number;
    totalDuration: number;
  };
}

export interface RedactionConfig {
  // Fields to completely remove
  removeFields?: string[];
  // Fields to mask (e.g., "***REDACTED***")
  maskFields?: string[];
  // Custom redaction function
  customRedactor?: (key: string, value: any) => any;
}

class RunReportV1Service {
  private readonly DEFAULT_REDACTION_CONFIG: RedactionConfig = {
    removeFields: [
      'input', 'output', 'prompt', 'response',
      'rawData', 'payload', 'content', 'text',
      'apiKey', 'token', 'secret', 'password'
    ],
    maskFields: [
      'userId', 'sessionId', 'requestId'
    ]
  };

  // Fetch raw report from backend service (mocked for PoC)
  async fetchRawReport(reportId: string): Promise<any> {
    // In real implementation, this would call the actual backend service
    // For PoC, simulate with mock data

    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay

    // Mock report data (would come from actual service)
    return {
      version: '1.0',
      meta: {
        seed: 12345,
        timestamp: new Date().toISOString(),
        duration: 4567,
        route: '/api/v1/analyze',
        totalTokens: 1250,
        totalCost: 0.025,
        model: 'gpt-4',
        status: 'completed',
        // These would be redacted
        userId: 'user-abc-123',
        sessionId: 'sess-xyz-789'
      },
      steps: [
        {
          id: 'step-1',
          type: 'analysis',
          startTime: 1640995200000,
          endTime: 1640995201500,
          duration: 1500,
          status: 'completed',
          tokens: 450,
          cost: 0.009,
          // These would be redacted
          input: 'Sensitive user prompt here...',
          output: 'Analysis results with potential PII...'
        },
        {
          id: 'step-2',
          type: 'generation',
          startTime: 1640995201500,
          endTime: 1640995204067,
          duration: 2567,
          status: 'completed',
          tokens: 800,
          cost: 0.016,
          input: 'Follow-up prompt...',
          output: 'Generated content...'
        }
      ],
      totals: {
        totalSteps: 2,
        completedSteps: 2,
        totalTokens: 1250,
        totalCost: 0.025,
        totalDuration: 4067
      }
    };
  }

  // Apply redaction rules to protect privacy
  applyRedaction(data: any, config?: RedactionConfig): ReportV1 {
    const effectiveConfig = { ...this.DEFAULT_REDACTION_CONFIG, ...config };

    return this.deepRedact(JSON.parse(JSON.stringify(data)), effectiveConfig);
  }

  private deepRedact(obj: any, config: RedactionConfig): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepRedact(item, config));
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Remove completely blacklisted fields
      if (config.removeFields?.includes(key)) {
        continue;
      }

      // Mask sensitive fields
      if (config.maskFields?.includes(key)) {
        result[key] = '***REDACTED***';
        continue;
      }

      // Apply custom redaction
      if (config.customRedactor) {
        const redacted = config.customRedactor(key, value);
        if (redacted !== value) {
          result[key] = redacted;
          continue;
        }
      }

      // Recursively process nested objects
      if (typeof value === 'object' && value !== null) {
        result[key] = this.deepRedact(value, config);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // Main pass-through method with redaction
  async getReport(reportId: string, redactionConfig?: RedactionConfig): Promise<ReportV1> {
    try {
      // 1. Fetch raw report from backend
      const rawReport = await this.fetchRawReport(reportId);

      // 2. Apply redaction rules
      const redactedReport = this.applyRedaction(rawReport, redactionConfig);

      // 3. Validate structure (basic schema check)
      this.validateReportV1(redactedReport);

      return redactedReport;

    } catch (error) {
      console.error('[RunReportV1] Error fetching report:', error);
      throw new Error(`Failed to fetch report ${reportId}: ${error.message}`);
    }
  }

  // Basic validation of report structure
  private validateReportV1(report: any): void {
    if (!report.version || !report.meta || !Array.isArray(report.steps) || !report.totals) {
      throw new Error('Invalid report structure: missing required fields');
    }

    if (!report.meta.seed || !report.meta.timestamp || typeof report.meta.duration !== 'number') {
      throw new Error('Invalid report meta: missing required fields');
    }

    for (const step of report.steps) {
      if (!step.id || !step.type || typeof step.duration !== 'number' || !step.status) {
        throw new Error('Invalid step structure: missing required fields');
      }
    }
  }

  // Generate sample report for testing/demo
  generateSampleReport(): ReportV1 {
    const sampleReport = {
      version: '1.0' as const,
      meta: {
        seed: 42,
        timestamp: new Date().toISOString(),
        duration: 3456,
        route: '/api/v1/sample',
        totalTokens: 1100,
        totalCost: 0.022,
        model: 'gpt-4',
        status: 'completed' as const
      },
      steps: [
        {
          id: 'sample-step-1',
          type: 'analysis' as const,
          startTime: Date.now() - 3456,
          endTime: Date.now() - 2000,
          duration: 1456,
          status: 'completed' as const,
          tokens: 400,
          cost: 0.008
        },
        {
          id: 'sample-step-2',
          type: 'generation' as const,
          startTime: Date.now() - 2000,
          endTime: Date.now(),
          duration: 2000,
          status: 'completed' as const,
          tokens: 700,
          cost: 0.014
        }
      ],
      totals: {
        totalSteps: 2,
        completedSteps: 2,
        totalTokens: 1100,
        totalCost: 0.022,
        totalDuration: 3456
      }
    };

    return sampleReport;
  }

  // Check if real report fetching is enabled
  isRealReportEnabled(): boolean {
    return import.meta.env.VITE_USE_REAL_REPORT === '1' ||
           localStorage.getItem('feature.realReport') === '1';
  }
}

// Singleton instance
export const runReportV1Service = new RunReportV1Service();

// Helper function for API routes
export async function handleReportV1Request(
  reportId: string,
  customRedaction?: RedactionConfig
): Promise<ReportV1> {

  // Use sample report if real reports are disabled (default for PoC)
  if (!runReportV1Service.isRealReportEnabled() || reportId === 'sample') {
    return runReportV1Service.generateSampleReport();
  }

  // Otherwise attempt to fetch real report
  return runReportV1Service.getReport(reportId, customRedaction);
}

// Logging prevention - no payload logging allowed
export function logReportAccess(reportId: string, redacted: boolean = true): void {
  // Only log metadata, never the actual report content
  console.log(`[RunReportV1] Report accessed: ${reportId}, redacted: ${redacted}, timestamp: ${new Date().toISOString()}`);

  // Counter for telemetry (if enabled)
  if (import.meta.env.VITE_FEATURE_TELEMETRY === '1') {
    // Increment counter only, no payload data
    console.log('[TLM] run.report.access');
  }
}