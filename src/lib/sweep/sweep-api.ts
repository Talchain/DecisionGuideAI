/**
 * Parameter Sweeps API Handler
 * POST /compare/sweep endpoint (flagged behind SWEEP_ENABLE=1)
 */

import { parameterSweepApi } from './parameter-sweeps.js';
import { ensureCorrelationId, addCorrelationHeader } from '../correlation.js';
import { enforceTenantSession } from '../tenant-sessions.js';
import { schemaValidationMiddleware } from '../schema-validation.js';
import { toPublicError } from '../error-normaliser.js';

interface SweepRequest {
  baseScenario: any;
  targetPaths: string[];
  variations?: number[];
  maxVariants?: number;
}

interface ErrorResponse {
  type: 'BAD_INPUT' | 'RATE_LIMIT' | 'INTERNAL_ERROR';
  message: string;
  timestamp: string;
}

/**
 * Check if sweep API is enabled
 */
function isSweepEnabled(): boolean {
  return process.env.SWEEP_ENABLE === '1';
}

/**
 * Validate sweep request
 */
function validateSweepRequest(req: any): SweepRequest | ErrorResponse {
  if (!req.baseScenario) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'baseScenario is required',
      field: 'baseScenario'
    });
  }

  if (!req.targetPaths || !Array.isArray(req.targetPaths) || req.targetPaths.length === 0) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'targetPaths array is required and must not be empty',
      field: 'targetPaths'
    });
  }

  // Validate target paths are strings
  if (!req.targetPaths.every((path: any) => typeof path === 'string')) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'All target paths must be strings',
      field: 'targetPaths'
    });
  }

  // Validate variations if provided
  if (req.variations && (!Array.isArray(req.variations) || !req.variations.every((v: any) => typeof v === 'number'))) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'variations must be an array of numbers',
      field: 'variations'
    });
  }

  // Validate maxVariants if provided
  if (req.maxVariants && (typeof req.maxVariants !== 'number' || req.maxVariants < 1 || req.maxVariants > 50)) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'maxVariants must be a number between 1 and 50',
      field: 'maxVariants'
    });
  }

  return {
    baseScenario: req.baseScenario,
    targetPaths: req.targetPaths,
    variations: req.variations || [-15, -10, -5, 5, 10, 15],
    maxVariants: req.maxVariants || 20
  };
}

/**
 * Main sweep endpoint handler
 * POST /compare/sweep
 */
export async function handleSweepRequest(requestBody: any, headers: Record<string, any> = {}): Promise<any> {
  // Check if feature is enabled
  if (!isSweepEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'The requested resource could not be found.',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Schema validation (dev/test only)
  const validation = schemaValidationMiddleware('/compare/sweep', requestBody);
  if (!validation.valid) {
    return validation.error;
  }

  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Generate or extract correlation ID
  const correlationId = ensureCorrelationId(headers, '/compare/sweep');

  try {
    // Validate request
    const validation = validateSweepRequest(requestBody);
    if ('type' in validation) {
      // Return error response
      return {
        status: 400,
        body: validation
      };
    }

    const { baseScenario, targetPaths, variations, maxVariants } = validation;

    // Generate parameter sweep
    const result = await parameterSweepApi.generateSweep(
      baseScenario,
      targetPaths,
      variations,
      maxVariants
    );

    if (!result.success) {
      return {
        status: result.status,
        body: {
          type: result.status === 400 ? 'BAD_INPUT' : 'INTERNAL_ERROR',
          message: result.error || 'Unable to generate parameter sweep',
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }, correlationId),
      body: result.data
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Internal server error during parameter sweep',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Express.js route handler wrapper
 */
export function setupSweepRoute(app: any) {
  app.post('/compare/sweep', async (req: any, res: any) => {
    const result = await handleSweepRequest(req.body, req.headers);

    res.status(result.status);

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.header(key, value);
      });
    }

    res.json(result.body);
  });
}