/**
 * Batch Compare API
 * Ranks multiple scenarios for fast option comparison
 */

import { schemaValidationMiddleware } from './schema-validation.js';
import { toPublicError } from './error-normaliser.js';

export interface BatchItem {
  scenarioId: string;
  seed: number;
  budget?: number;
}

export interface RankedScenario {
  scenarioId: string;
  most_likely: number;
  delta_vs_baseline_pct: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

export interface BatchCompareResponse {
  schema: 'compare-batch.v1';
  ranked: RankedScenario[];
  baseline: string;
  notes: string[];
}

/**
 * Generate mock Report v1 for batch comparison
 */
function generateBatchReport(scenarioId: string, seed: number): any {
  // Use seed for deterministic generation
  let seedValue = seed;
  const random = () => {
    let x = Math.sin(seedValue++) * 10000;
    return x - Math.floor(x);
  };

  // Generate deterministic scores based on scenario and seed
  const baseValue = 1000000; // £1M baseline
  const variance = (random() - 0.5) * 0.3; // ±15% variance
  const most_likely = Math.round(baseValue * (1 + variance));

  const confidenceMap = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
  const confidence = confidenceMap[Math.floor(random() * 4)];

  return {
    schema: 'report.v1',
    decision: {
      title: `Analysis for ${scenarioId}`,
      options: [
        {
          id: `${scenarioId}_primary`,
          name: `Primary option for ${scenarioId}`,
          score: 0.7 + random() * 0.2,
          description: 'Recommended approach'
        }
      ]
    },
    recommendation: {
      primary: `${scenarioId}_primary`
    },
    analysis: {
      confidence: confidence.toLowerCase(),
      most_likely_outcome: most_likely
    },
    meta: {
      scenarioId,
      seed,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Validate batch compare request
 */
function validateBatchRequest(requestBody: any): any {
  if (!requestBody || !Array.isArray(requestBody.items)) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Request validation failed: Required field \'items\' is missing',
      field: 'items'
    });
  }

  if (requestBody.items.length === 0) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Items array is empty',
      field: 'items'
    });
  }

  if (requestBody.items.length > 10) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Maximum 10 items allowed',
      field: 'items'
    });
  }

  for (let i = 0; i < requestBody.items.length; i++) {
    const item = requestBody.items[i];
    if (!item || typeof item !== 'object' || !item.scenarioId || typeof item.scenarioId !== 'string') {
      return toPublicError({
        type: 'BAD_INPUT',
        devDetail: `Item ${i + 1}: scenarioId required`,
        field: 'scenarioId'
      });
    }

    if (typeof item.seed !== 'number' || !Number.isInteger(item.seed)) {
      return toPublicError({
        type: 'BAD_INPUT',
        devDetail: `Item ${i + 1}: seed must be an integer`,
        field: 'seed'
      });
    }
  }

  // Check for duplicate scenarios
  const scenarioIds = requestBody.items.map((item: any) => item.scenarioId);
  const uniqueIds = new Set(scenarioIds);
  if (uniqueIds.size !== scenarioIds.length) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Duplicate scenarioId not allowed',
      field: 'scenarioId'
    });
  }

  return null; // Valid
}

/**
 * Extract most likely value from report
 */
function extractMostLikelyValue(report: any): number {
  // Try to extract from analysis first
  if (report.analysis && typeof report.analysis.most_likely_outcome === 'number') {
    return report.analysis.most_likely_outcome;
  }

  // Fallback to option scores (convert to monetary value)
  if (report.decision && report.decision.options && report.decision.options.length > 0) {
    const topOption = report.decision.options[0];
    if (typeof topOption.score === 'number') {
      return Math.round(topOption.score * 1000000); // Convert to £
    }
  }

  // Final fallback
  return 1000000; // £1M default
}

/**
 * Convert confidence string to enum
 */
function normalizeConfidence(confidence: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  const normalized = confidence.toUpperCase();
  switch (normalized) {
    case 'VERY HIGH':
    case 'VERY_HIGH':
      return 'VERY_HIGH';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
    default:
      return 'LOW';
  }
}

/**
 * Handle POST /compare/batch request
 */
export async function handleBatchCompareRequest(requestBody: any): Promise<any> {
  // Schema validation (dev/test only)
  const schemaValidation = schemaValidationMiddleware('/compare/batch', requestBody);
  if (!schemaValidation.valid) {
    return schemaValidation.error;
  }

  // Validate request
  const validation = validateBatchRequest(requestBody);
  if (validation) {
    return { status: 400, body: validation };
  }

  const items: BatchItem[] = requestBody.items;

  try {
    // Generate reports for each item
    const itemReports = items.map(item => ({
      item,
      report: generateBatchReport(item.scenarioId, item.seed)
    }));

    // Extract most likely values and determine baseline
    const scenarios = itemReports.map(({ item, report }) => {
      const mostLikely = extractMostLikelyValue(report);
      const confidence = normalizeConfidence(report.analysis.confidence);

      return {
        scenarioId: item.scenarioId,
        most_likely: mostLikely,
        confidence,
        report
      };
    });

    // Sort by most_likely value (descending)
    scenarios.sort((a, b) => b.most_likely - a.most_likely);

    // Use first item as baseline for percentage calculations
    const baseline = scenarios[0];
    const baselineValue = baseline.most_likely;

    // Calculate deltas vs baseline
    const ranked: RankedScenario[] = scenarios.map(scenario => ({
      scenarioId: scenario.scenarioId,
      most_likely: scenario.most_likely,
      delta_vs_baseline_pct: ((scenario.most_likely - baselineValue) / baselineValue) * 100,
      confidence: scenario.confidence
    }));

    // Round percentages to 1 decimal place
    ranked.forEach(item => {
      item.delta_vs_baseline_pct = Math.round(item.delta_vs_baseline_pct * 10) / 10;
    });

    // Check if all seeds are the same
    const seeds = items.map(item => item.seed);
    const sameSeed = seeds.every(seed => seed === seeds[0]);

    const response: BatchCompareResponse = {
      schema: 'compare-batch.v1',
      ranked,
      baseline: baseline.scenarioId,
      notes: [
        sameSeed ? `All seeds ${seeds[0]}` : 'Mixed seeds used',
        'Currency: USD (unconverted)'
      ]
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: response
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to process batch comparison',
        timestamp: new Date().toISOString()
      }
    };
  }
}