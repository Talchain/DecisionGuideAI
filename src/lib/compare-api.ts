/**
 * Compare API Implementation
 * POST /compare endpoint for scenario comparison with report delta
 */

import { compareReports } from './report-diff.js';
import { ensureCorrelationId, addCorrelationHeader } from './correlation.js';
import { enforceTenantSession } from './tenant-sessions.js';
import { schemaValidationMiddleware } from './schema-validation.js';
import { toPublicError } from './error-normaliser.js';

interface CompareRequest {
  left: {
    scenarioId: string;
    seed: number;
    budget?: number;
  };
  right: {
    scenarioId: string;
    seed: number;
    budget?: number;
  };
}

interface ReportV1 {
  decision: {
    title: string;
    options: Array<{
      id: string;
      name: string;
      score: number;
      description: string;
    }>;
  };
  recommendation: {
    primary: string;
  };
  analysis: {
    confidence: string;
  };
  meta: {
    scenarioId: string;
    seed: number;
    timestamp: string;
  };
  ranges?: {
    most_likely?: number;
    confidence_lower?: number;
    confidence_upper?: number;
  };
  threshold_crossings?: Array<{
    threshold: number;
    crossed: boolean;
    direction: 'up' | 'down';
  }>;
}

interface ErrorResponse {
  type: 'BAD_INPUT' | 'RATE_LIMIT' | 'INTERNAL_ERROR';
  message: string;
  timestamp: string;
}

/**
 * Generate mock report for PoC demonstration
 */
function generateMockReport(scenarioId: string, seed: number): ReportV1 {
  // Use seed to generate deterministic but different results
  const seedOffset = seed * 0.1;
  const scenarioOffset = scenarioId.length * 0.05;

  return {
    decision: {
      title: `Analysis for ${scenarioId}`,
      options: [
        {
          id: 'option_a',
          name: 'Conservative Approach',
          score: 0.6 + seedOffset,
          description: 'Lower risk, steady returns'
        },
        {
          id: 'option_b',
          name: 'Aggressive Strategy',
          score: 0.7 + scenarioOffset,
          description: 'Higher risk, potential high returns'
        },
        {
          id: 'option_c',
          name: 'Balanced Portfolio',
          score: 0.8 - seedOffset,
          description: 'Moderate risk, consistent growth'
        }
      ]
    },
    recommendation: {
      primary: seed > 30 ? 'option_c' : 'option_b'
    },
    analysis: {
      confidence: seed > 40 ? 'high' : seed > 20 ? 'medium' : 'low'
    },
    meta: {
      scenarioId,
      seed,
      timestamp: new Date().toISOString()
    },
    ranges: {
      most_likely: 10000 + (seed * 100) + (scenarioOffset * 1000),
      confidence_lower: 8000 + (seed * 80),
      confidence_upper: 12000 + (seed * 120)
    },
    threshold_crossings: [
      {
        threshold: 10000,
        crossed: seed > 25,
        direction: seed > 30 ? 'up' : 'down'
      },
      {
        threshold: 15000,
        crossed: seed > 45,
        direction: 'up'
      }
    ]
  };
}

/**
 * Validate compare request
 */
function validateCompareRequest(req: any): CompareRequest | ErrorResponse {
  if (!req.left || !req.right) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'left and right scenarios required',
      field: 'left'
    });
  }

  if (!req.left.scenarioId) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Request validation failed: Required field \'scenarioId\' is missing',
      field: 'scenarioId'
    });
  }

  if (!req.right.scenarioId) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Request validation failed: Required field \'scenarioId\' is missing',
      field: 'scenarioId'
    });
  }

  if (typeof req.left.seed !== 'number' || typeof req.right.seed !== 'number') {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Request validation failed: Expected type \'integer\' but got \'string\'',
      field: 'seed'
    });
  }

  return {
    left: {
      scenarioId: req.left.scenarioId,
      seed: req.left.seed,
      budget: req.left.budget || 200
    },
    right: {
      scenarioId: req.right.scenarioId,
      seed: req.right.seed,
      budget: req.right.budget || 200
    }
  };
}

/**
 * Main compare endpoint handler
 * POST /compare
 */
export async function handleCompareRequest(requestBody: any, headers: Record<string, any> = {}): Promise<any> {
  // Schema validation (dev/test only)
  const validation = schemaValidationMiddleware('/compare', requestBody);
  if (!validation.valid) {
    return validation.error;
  }

  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Generate or extract correlation ID
  const correlationId = ensureCorrelationId(headers, '/compare');

  try {
    // Validate request
    const validation = validateCompareRequest(requestBody);
    if ('type' in validation) {
      // Return error response
      return {
        status: 400,
        body: validation
      };
    }

    const { left, right } = validation;

    // Generate reports for both scenarios
    // In real implementation, this would call the actual report generation service
    const leftReport = generateMockReport(left.scenarioId, left.seed);
    const rightReport = generateMockReport(right.scenarioId, right.seed);

    // Generate run IDs
    const leftRunId = `run_${left.scenarioId}_${left.seed}_${Date.now()}`;
    const rightRunId = `run_${right.scenarioId}_${right.seed}_${Date.now()}`;

    // Compare reports using our diff utility
    const comparison = compareReports(leftReport, rightReport, leftRunId, rightRunId);

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }, correlationId),
      body: comparison
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Internal server error during comparison',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Express.js route handler wrapper
 */
export function setupCompareRoute(app: any) {
  app.post('/compare', async (req: any, res: any) => {
    const result = await handleCompareRequest(req.body);

    res.status(result.status);

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.header(key, value);
      });
    }

    res.json(result.body);
  });
}