/**
 * Insights v0 API - DISABLED BY DEFAULT
 *
 * Flag: INSIGHTS_ENABLE=1 (default 0)
 * Read-only, deterministic insights derived from existing reports
 * No LLMs, no external calls
 */

// Environment guard - disabled by default
export const INSIGHTS_ENABLED = process.env.INSIGHTS_ENABLE === '1';

if (!INSIGHTS_ENABLED) {
  console.debug('Insights API disabled. Set INSIGHTS_ENABLE=1 to enable.');
}

import { applySecurityHeaders, validateRequestSecurity, logRequestSafely } from './security-headers.js';
import { ensureCorrelationId } from './correlation.js';

// Insights schema v1
export interface InsightsResponse {
  schema: 'insights.v1';
  runId: string;
  meta: {
    analysisType: 'top-drivers' | 'risk-hotspots';
    timestamp: string;
    reportVersion: string;
  };
  drivers?: Array<{
    name: string;
    weight: number;
    contribution: number;
  }>;
  hotspots?: Array<{
    name: string;
    rationale: string;
  }>;
  notes: string[];
}

// Report structure interfaces (based on report.v1 schema)
interface ReportStep {
  id: string;
  type: string;
  duration: number;
  status: string;
  tokens?: number;
  cost?: number;
}

interface ReportData {
  reportId?: string;
  meta: {
    seed: number;
    timestamp: string;
    duration: number;
    status?: string;
    model?: string;
  };
  totals?: {
    totalTokens: number;
    totalCost: number;
    totalSteps: number;
    completedSteps: number;
  };
  steps: ReportStep[];
  schema?: string;
}

/**
 * Extract top drivers from report data
 */
function extractTopDrivers(reportData: ReportData): InsightsResponse {
  const drivers: Array<{ name: string; weight: number; contribution: number }> = [];
  const notes: string[] = [];

  if (!reportData.steps || reportData.steps.length === 0) {
    notes.push('No steps found in report data');
    return createDriversResponse(reportData, drivers, notes);
  }

  // Calculate contribution by step duration and cost
  const totalDuration = reportData.meta?.duration || 0;
  const totalCost = reportData.totals?.totalCost || 0;

  reportData.steps.forEach((step, index) => {
    const durationWeight = totalDuration > 0 ? (step.duration / totalDuration) : 0;
    const costWeight = totalCost > 0 && step.cost ? (step.cost / totalCost) : 0;

    // Combine duration and cost to calculate overall contribution
    const contribution = (durationWeight * 0.6 + costWeight * 0.4);

    drivers.push({
      name: step.type || `step_${index + 1}`,
      weight: step.status === 'completed' ? 1.0 : 0.5,
      contribution: Math.round(contribution * 100) / 100
    });
  });

  // Sort by contribution (highest first)
  drivers.sort((a, b) => b.contribution - a.contribution);

  // Take top 5 drivers
  const topDrivers = drivers.slice(0, 5);

  if (topDrivers.length > 0) {
    notes.push(`Top ${topDrivers.length} performance drivers identified`);
  }

  if (reportData.steps.some(step => step.status !== 'completed')) {
    notes.push('Some steps failed or incomplete, affecting accuracy');
  }

  return createDriversResponse(reportData, topDrivers, notes);
}

/**
 * Extract risk hotspots from report data
 */
function extractRiskHotspots(reportData: ReportData): InsightsResponse {
  const hotspots: Array<{ name: string; rationale: string }> = [];
  const notes: string[] = [];

  if (!reportData.steps || reportData.steps.length === 0) {
    notes.push('No steps found in report data');
    return createHotspotsResponse(reportData, hotspots, notes);
  }

  // Identify potential risk factors
  reportData.steps.forEach((step, index) => {
    const risks: string[] = [];

    // High duration risk
    if (step.duration > 5000) {
      risks.push('high execution time');
    }

    // Failed step risk
    if (step.status === 'failed' || step.status === 'error') {
      risks.push('execution failure');
    }

    // High cost risk
    if (step.cost && step.cost > 0.01) {
      risks.push('high token cost');
    }

    // Incomplete step risk
    if (step.status === 'pending' || step.status === 'running') {
      risks.push('incomplete execution');
    }

    if (risks.length > 0) {
      hotspots.push({
        name: step.type || `step_${index + 1}`,
        rationale: `Risk factors: ${risks.join(', ')}`
      });
    }
  });

  // System-level risks
  if (reportData.totals) {
    const { totalSteps, completedSteps } = reportData.totals;

    if (completedSteps < totalSteps) {
      hotspots.push({
        name: 'system_completion',
        rationale: `Only ${completedSteps}/${totalSteps} steps completed successfully`
      });
    }

    if (reportData.totals.totalCost > 0.05) {
      hotspots.push({
        name: 'cost_overrun',
        rationale: `Total cost ${reportData.totals.totalCost} exceeds budget thresholds`
      });
    }
  }

  // Performance risks
  if (reportData.meta?.duration > 30000) {
    hotspots.push({
      name: 'performance_bottleneck',
      rationale: `Total duration ${reportData.meta.duration}ms exceeds performance targets`
    });
  }

  // Sort by risk severity (failed steps first)
  hotspots.sort((a, b) => {
    const aFailure = a.rationale.includes('failure') ? 1 : 0;
    const bFailure = b.rationale.includes('failure') ? 1 : 0;
    return bFailure - aFailure;
  });

  notes.push(`${hotspots.length} risk hotspots identified`);

  if (hotspots.length === 0) {
    notes.push('No significant risk factors detected');
  }

  return createHotspotsResponse(reportData, hotspots, notes);
}

/**
 * Create drivers response
 */
function createDriversResponse(
  reportData: ReportData,
  drivers: Array<{ name: string; weight: number; contribution: number }>,
  notes: string[]
): InsightsResponse {
  return {
    schema: 'insights.v1',
    runId: reportData.reportId || 'unknown',
    meta: {
      analysisType: 'top-drivers',
      timestamp: new Date().toISOString(),
      reportVersion: reportData.schema || 'unknown'
    },
    drivers,
    notes
  };
}

/**
 * Create hotspots response
 */
function createHotspotsResponse(
  reportData: ReportData,
  hotspots: Array<{ name: string; rationale: string }>,
  notes: string[]
): InsightsResponse {
  return {
    schema: 'insights.v1',
    runId: reportData.reportId || 'unknown',
    meta: {
      analysisType: 'risk-hotspots',
      timestamp: new Date().toISOString(),
      reportVersion: reportData.schema || 'unknown'
    },
    hotspots,
    notes
  };
}

/**
 * Load report data (mock implementation - would load from storage in real system)
 */
async function loadReportData(runId: string): Promise<ReportData> {
  // Mock implementation - in real system this would load from database/storage
  // For now, return sample data based on runId

  if (runId === 'sample-framework') {
    return {
      reportId: runId,
      meta: {
        seed: 42,
        timestamp: "2025-09-25T20:37:43.953Z",
        duration: 10000,
        status: "completed",
        model: "gpt-4-turbo"
      },
      totals: {
        totalTokens: 1000,
        totalCost: 0.02,
        totalSteps: 3,
        completedSteps: 3
      },
      steps: [
        {
          id: "step_1",
          type: "analysis",
          duration: 4219,
          status: "completed",
          tokens: 359,
          cost: 0.0054
        },
        {
          id: "step_2",
          type: "generation",
          duration: 4168,
          status: "completed",
          tokens: 368,
          cost: 0.0073
        },
        {
          id: "step_3",
          type: "validation",
          duration: 4307,
          status: "completed",
          tokens: 361,
          cost: 0.0078
        }
      ],
      schema: "report.v1"
    };
  }

  if (runId === 'sample-risks') {
    return {
      reportId: runId,
      meta: {
        seed: 123,
        timestamp: "2025-09-26T10:15:30.000Z",
        duration: 25000,
        status: "partial"
      },
      totals: {
        totalTokens: 2500,
        totalCost: 0.08,
        totalSteps: 4,
        completedSteps: 2
      },
      steps: [
        {
          id: "step_1",
          type: "analysis",
          duration: 8000,
          status: "completed",
          tokens: 800,
          cost: 0.025
        },
        {
          id: "step_2",
          type: "generation",
          duration: 12000,
          status: "failed",
          tokens: 1200,
          cost: 0.035
        },
        {
          id: "step_3",
          type: "validation",
          duration: 5000,
          status: "pending",
          tokens: 500,
          cost: 0.02
        }
      ],
      schema: "report.v1"
    };
  }

  throw new Error(`Report not found: ${runId}`);
}

/**
 * Handle top drivers request
 */
export async function handleTopDrivers(runId: string): Promise<InsightsResponse> {
  if (!INSIGHTS_ENABLED) {
    throw new Error('Insights functionality is disabled. Set INSIGHTS_ENABLE=1 to enable.');
  }

  if (!runId) {
    throw new Error('runId parameter is required');
  }

  try {
    const reportData = await loadReportData(runId);
    return extractTopDrivers(reportData);
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new Error(`Report not found: ${runId}`);
    }
    throw new Error(`Failed to analyse drivers: ${error.message}`);
  }
}

/**
 * Handle risk hotspots request
 */
export async function handleRiskHotspots(runId: string): Promise<InsightsResponse> {
  if (!INSIGHTS_ENABLED) {
    throw new Error('Insights functionality is disabled. Set INSIGHTS_ENABLE=1 to enable.');
  }

  if (!runId) {
    throw new Error('runId parameter is required');
  }

  try {
    const reportData = await loadReportData(runId);
    return extractRiskHotspots(reportData);
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new Error(`Report not found: ${runId}`);
    }
    throw new Error(`Failed to analyse risk hotspots: ${error.message}`);
  }
}

/**
 * Validate insights request
 */
export function validateInsightsRequest(params: any): string[] {
  const errors: string[] = [];

  if (!params) {
    errors.push('Query parameters are required');
    return errors;
  }

  if (!params.runId) {
    errors.push('runId parameter is required');
  }

  if (params.runId && typeof params.runId !== 'string') {
    errors.push('runId must be a string');
  }

  return errors;
}