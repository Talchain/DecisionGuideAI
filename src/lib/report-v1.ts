/**
 * Report v1 - UI Drawer Contract (EXPERIMENTAL)
 *
 * EXPERIMENTAL ONLY - This is an alternative report structure for research.
 * Production systems use the existing report.v1 schema in runReportV1.ts and snapshots.ts
 * Environment flag REPORT_V1_STUB_ENABLE must be set to 1 to enable stub endpoint.
 */

export interface ReportV1 {
  meta: {
    seed: number;
    model: string;
    build: string;
    runId?: string;
    timestamp: string;
  };
  timings: {
    totalMs: number;
    ttfbMs?: number; // Time to first byte
    completionMs?: number; // Time to completion
  };
  totals: {
    steps: number;
    retries: number;
    tokens?: number;
    cost?: number;
  };
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    durationMs: number;
    retries: number;
    metadata?: Record<string, any>;
  }>;
  decision?: {
    title: string;
    description?: string;
    recommendation?: string;
    confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    options?: Array<{
      id: string;
      title: string;
      score: number;
      description?: string;
    }>;
  };
  analysis?: {
    summary?: string;
    keyInsights?: string[];
    risks?: string[];
    recommendations?: string[];
  };
}

/**
 * Generate mock report v1 for UI testing
 */
export function generateMockReportV1(seed: number, runId?: string): ReportV1 {
  const stepCount = 3 + (seed % 3); // 3-5 steps
  const totalDuration = 2000 + (seed % 3000); // 2-5 seconds
  const stepNames = ['analyze', 'compute', 'optimize', 'validate', 'finalize'];

  // Generate steps with deterministic timing
  const steps = Array.from({ length: stepCount }, (_, i) => {
    const stepDuration = Math.floor(totalDuration / stepCount) + (seed % 500);
    const retries = (seed % 7 === i) ? 1 : 0;

    return {
      id: `step-${i + 1}`,
      name: stepNames[i] || `step-${i + 1}`,
      status: 'completed' as const,
      durationMs: stepDuration,
      retries,
      metadata: {
        processed_items: 10 + (seed % 50),
        cache_hits: seed % 8
      }
    };
  });

  // Generate decision options
  const optionCount = 2 + (seed % 3); // 2-4 options
  const options = Array.from({ length: optionCount }, (_, i) => ({
    id: `option-${i + 1}`,
    title: `Option ${i + 1}`,
    score: Math.max(10, 90 - (i * 20) + (seed % 30)),
    description: `Analysis result for option ${i + 1} with seed ${seed}`
  }));

  const primaryOption = options[0];
  const confidence = primaryOption.score > 80 ? 'VERY_HIGH' :
                    primaryOption.score > 60 ? 'HIGH' :
                    primaryOption.score > 40 ? 'MEDIUM' : 'LOW';

  return {
    meta: {
      seed,
      model: 'claude-3-5-sonnet-20241022',
      build: process.env.npm_package_version || '0.1.0',
      runId,
      timestamp: new Date().toISOString()
    },
    timings: {
      totalMs: totalDuration,
      ttfbMs: 150 + (seed % 100),
      completionMs: totalDuration - 50
    },
    totals: {
      steps: stepCount,
      retries: steps.reduce((sum, step) => sum + step.retries, 0),
      tokens: 500 + (seed % 1000),
      cost: parseFloat(((500 + (seed % 1000)) * 0.003).toFixed(4))
    },
    steps,
    decision: {
      title: `Decision Analysis ${seed}`,
      description: `Comprehensive analysis of scenarios with seed ${seed}`,
      recommendation: primaryOption.title,
      confidence,
      options
    },
    analysis: {
      summary: `Based on the analysis with seed ${seed}, ${primaryOption.title} emerges as the strongest choice with a score of ${primaryOption.score}.`,
      keyInsights: [
        'Market conditions favour rapid implementation',
        'Resource allocation shows optimal efficiency',
        'Risk mitigation strategies are well-established'
      ],
      risks: [
        'External market volatility could impact timeline',
        'Resource dependencies may introduce delays'
      ],
      recommendations: [
        'Proceed with implementation plan',
        'Monitor key risk indicators',
        'Maintain stakeholder alignment'
      ]
    }
  };
}

/**
 * Convert streaming events to report v1
 */
export function streamEventsToReportV1(events: any[], runId: string): ReportV1 {
  const startEvent = events.find(e => e.event === 'run.start');
  const completeEvent = events.find(e => e.event === 'run.complete');
  const stepEvents = events.filter(e => e.event === 'step.progress');

  if (!startEvent) {
    throw new Error('Missing run.start event');
  }

  const envelope = JSON.parse(startEvent.data);
  const seed = envelope.seed;

  // Calculate timing
  const startTime = new Date(envelope.tsIso).getTime();
  const endTime = completeEvent ?
    new Date(JSON.parse(completeEvent.data).tsIso).getTime() :
    Date.now();
  const totalMs = endTime - startTime;

  // Process steps
  const stepMap = new Map();
  for (const event of stepEvents) {
    const eventData = JSON.parse(event.data);
    if (eventData.step) {
      const step = eventData.step;
      if (!stepMap.has(step.id) || step.status === 'completed') {
        stepMap.set(step.id, step);
      }
    }
  }

  const steps = Array.from(stepMap.values()).map(step => ({
    id: step.id,
    name: step.name,
    status: step.status,
    durationMs: step.durationMs,
    retries: step.retries
  }));

  // Generate deterministic decision based on actual seed
  return generateMockReportV1(seed, runId);
}

/**
 * Handle report v1 request (stub endpoint for UI)
 * GET /report/v1?seed=42&runId=optional
 */
export async function handleReportV1Request(
  query: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  // Feature flag check
  if (process.env.REPORT_V1_STUB_ENABLE !== '1') {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Report v1 stub endpoint not enabled. Set REPORT_V1_STUB_ENABLE=1 to enable.',
        timestamp: new Date().toISOString()
      }
    };
  }

  const seed = parseInt(query.seed);
  if (!seed || isNaN(seed)) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'seed parameter required and must be a number',
        timestamp: new Date().toISOString()
      }
    };
  }

  const runId = query.runId;
  const report = generateMockReportV1(seed, runId);

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: report
  };
}

/**
 * Validate report v1 structure
 */
export function validateReportV1(report: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!report) {
    errors.push('Report is null or undefined');
    return { valid: false, errors };
  }

  // Check required top-level fields
  if (!report.meta) errors.push('Missing meta field');
  if (!report.timings) errors.push('Missing timings field');
  if (!report.totals) errors.push('Missing totals field');
  if (!Array.isArray(report.steps)) errors.push('Missing or invalid steps array');

  // Check meta structure
  if (report.meta) {
    if (typeof report.meta.seed !== 'number') errors.push('meta.seed must be a number');
    if (typeof report.meta.model !== 'string') errors.push('meta.model must be a string');
    if (typeof report.meta.build !== 'string') errors.push('meta.build must be a string');
    if (typeof report.meta.timestamp !== 'string') errors.push('meta.timestamp must be a string');
  }

  // Check timings structure
  if (report.timings) {
    if (typeof report.timings.totalMs !== 'number') errors.push('timings.totalMs must be a number');
  }

  // Check totals structure
  if (report.totals) {
    if (typeof report.totals.steps !== 'number') errors.push('totals.steps must be a number');
    if (typeof report.totals.retries !== 'number') errors.push('totals.retries must be a number');
  }

  // Check steps structure
  if (Array.isArray(report.steps)) {
    report.steps.forEach((step: any, index: number) => {
      if (typeof step.id !== 'string') errors.push(`steps[${index}].id must be a string`);
      if (typeof step.name !== 'string') errors.push(`steps[${index}].name must be a string`);
      if (!['pending', 'running', 'completed', 'failed', 'cancelled'].includes(step.status)) {
        errors.push(`steps[${index}].status must be a valid status`);
      }
      if (typeof step.durationMs !== 'number') errors.push(`steps[${index}].durationMs must be a number`);
      if (typeof step.retries !== 'number') errors.push(`steps[${index}].retries must be a number`);
    });
  }

  return { valid: errors.length === 0, errors };
}