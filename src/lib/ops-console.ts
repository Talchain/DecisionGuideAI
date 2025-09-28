/**
 * Operations Console
 * Read-only dashboard for system monitoring (dev/pilot only)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { toPublicError } from './error-normaliser.js';
import { ERR_MSG } from './error-messages.js';
import { FLAG_REGISTRY, getAllFlags, getFlagValue } from './flagRegistry';
import { getRateLimitStatus } from './safety-limits';
import { getQueueStatistics } from './concurrency-queue';

/**
 * Check if ops console is enabled
 */
function isOpsConsoleEnabled(): boolean {
  return process.env.OPS_CONSOLE_ENABLE === '1';
}

/**
 * Get required ops console token (if not localhost)
 */
function getOpsConsoleToken(): string | null {
  return process.env.OPS_CONSOLE_TOKEN || null;
}

/**
 * Check if request is from localhost
 */
function isLocalhost(headers: Record<string, any>): boolean {
  const host = headers.host || headers.Host || '';
  return host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || host === 'localhost';
}

/**
 * Validate ops console authentication
 */
function validateOpsAuth(headers: Record<string, any>): { valid: boolean; reason?: string } {
  // Skip auth for localhost
  if (isLocalhost(headers)) {
    return { valid: true };
  }

  const requiredToken = getOpsConsoleToken();
  if (!requiredToken) {
    return { valid: false, reason: 'OPS_CONSOLE_TOKEN not configured for non-localhost access' };
  }

  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader) {
    return { valid: false, reason: 'Authorization header required for non-localhost access' };
  }

  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
  if (!tokenMatch) {
    return { valid: false, reason: 'Invalid Authorization format. Use: Bearer <token>' };
  }

  const providedToken = tokenMatch[1];
  if (providedToken !== requiredToken) {
    return { valid: false, reason: 'Invalid ops console token' };
  }

  return { valid: true };
}

/**
 * Load ops console HTML content
 */
function loadOpsConsoleHtml(): string {
  const htmlPath = join(process.cwd(), 'artifacts', 'public', 'ops-console.html');

  if (!existsSync(htmlPath)) {
    throw new Error('Ops console HTML file not found');
  }

  return readFileSync(htmlPath, 'utf-8');
}

/**
 * Handle GET /ops request
 */
export async function handleOpsConsoleRequest(headers: Record<string, any> = {}): Promise<any> {
  // Check if ops console is enabled
  if (!isOpsConsoleEnabled()) {
    return {
      status: 404,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Operations console not enabled. Set OPS_CONSOLE_ENABLE=1 to enable.'
      })
    };
  }

  // Validate authentication
  const authCheck = validateOpsAuth(headers);
  if (!authCheck.valid) {
    return {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer'
      },
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: authCheck.reason || 'Authorisation required'
      })
    };
  }

  try {
    const htmlContent = loadOpsConsoleHtml();

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
      },
      body: htmlContent
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to load operations console',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Check if dev toggles are allowed
 */
function isDevTogglesEnabled(): boolean {
  return process.env.OPS_CONSOLE_ENABLE === '1' && process.env.NODE_ENV !== 'production';
}

/**
 * Handle GET /ops/flags - current feature flags
 */
export async function handleOpsFlagsRequest(headers: Record<string, any> = {}): Promise<any> {
  if (!isOpsConsoleEnabled()) {
    return {
      status: 404,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Operations console not enabled. Set OPS_CONSOLE_ENABLE=1 to enable.'
      })
    };
  }

  // Validate authentication
  const authCheck = validateOpsAuth(headers);
  if (!authCheck.valid) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: authCheck.reason || 'Authorisation required'
      })
    };
  }

  try {
    const flags = getAllFlags(false); // Don't include sensitive flags
    const flagsData = Object.entries(flags).map(([key, flagInfo]) => ({
      name: key,
      enabled: flagInfo.currentValue,
      source: flagInfo.source,
      category: flagInfo.definition.category,
      description: flagInfo.definition.description,
      riskLevel: flagInfo.definition.riskLevel,
      environment: flagInfo.definition.environment
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        flags: flagsData,
        meta: {
          total: flagsData.length,
          dev_toggles_enabled: isDevTogglesEnabled(),
          timestamp: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve feature flags',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /ops/limits - effective limits
 */
export async function handleOpsLimitsRequest(headers: Record<string, any> = {}): Promise<any> {
  if (!isOpsConsoleEnabled()) {
    return {
      status: 404,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Operations console not enabled. Set OPS_CONSOLE_ENABLE=1 to enable.'
      })
    };
  }

  // Validate authentication
  const authCheck = validateOpsAuth(headers);
  if (!authCheck.valid) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: authCheck.reason || 'Authorisation required'
      })
    };
  }

  try {
    const limits = {
      rate_limits: {
        rpm: parseInt(process.env.RATE_LIMIT_RPM || '60'),
        daily_tokens: parseInt(process.env.DAILY_BUDGET_TOKENS || '50000')
      },
      scenario_limits: {
        max_nodes: parseInt(process.env.MAX_NODES || '12'),
        warn_nodes: parseInt(process.env.WARN_NODES || '10')
      },
      concurrency: {
        max_per_org: parseInt(process.env.MAX_CONCURRENCY_PER_ORG || '2'),
        queue_max_depth: parseInt(process.env.QUEUE_MAX_DEPTH || '25'),
        queue_timeout_ms: parseInt(process.env.QUEUE_TIMEOUT_MS || '30000')
      }
    };

    // Get current usage from rate limiting system
    const rateLimitStatus = getRateLimitStatus();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        limits,
        current_usage: rateLimitStatus,
        meta: {
          source: 'environment_variables',
          effective_since: 'service_start',
          timestamp: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve limits',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /ops/queue - queue status summary
 */
export async function handleOpsQueueRequest(headers: Record<string, any> = {}): Promise<any> {
  if (!isOpsConsoleEnabled()) {
    return {
      status: 404,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Operations console not enabled. Set OPS_CONSOLE_ENABLE=1 to enable.'
      })
    };
  }

  // Validate authentication
  const authCheck = validateOpsAuth(headers);
  if (!authCheck.valid) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: authCheck.reason || 'Authorisation required'
      })
    };
  }

  try {
    const queueStats = getQueueStatistics();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        ...queueStats,
        meta: {
          timestamp: new Date().toISOString(),
          refresh_interval_suggestion: '5s'
        }
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve queue status',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle POST /ops/toggle-flag - dev-only flag toggles
 */
export async function handleOpsToggleFlagRequest(
  headers: Record<string, any> = {},
  body: any = {}
): Promise<any> {
  if (!isOpsConsoleEnabled()) {
    return {
      status: 404,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Operations console not enabled. Set OPS_CONSOLE_ENABLE=1 to enable.'
      })
    };
  }

  if (!isDevTogglesEnabled()) {
    return {
      status: 403,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'Dev toggles not enabled. Requires OPS_CONSOLE_ENABLE=1 AND NODE_ENV≠production.'
      })
    };
  }

  // Validate authentication
  const authCheck = validateOpsAuth(headers);
  if (!authCheck.valid) {
    return {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: authCheck.reason || 'Authorisation required'
      })
    };
  }

  const { flag, value } = body;

  if (!flag || typeof flag !== 'string') {
    return {
      status: 400,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'flag parameter required (string)'
      })
    };
  }

  if (value === undefined) {
    return {
      status: 400,
      body: toPublicError({
        type: 'BAD_INPUT',
        devDetail: 'value parameter required'
      })
    };
  }

  try {
    const flagDef = FLAG_REGISTRY[flag];
    if (!flagDef) {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `Unknown flag: ${flag}`
        })
      };
    }

    // Only allow client-side flags to be toggled via localStorage simulation
    if (flagDef.environment !== 'client' && flagDef.environment !== 'both') {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `Flag ${flag} is server-side only (requires environment variable)`
        })
      };
    }

    // Prevent toggling high-risk flags
    if (flagDef.riskLevel === 'critical' || flagDef.riskLevel === 'high') {
      return {
        status: 403,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `High-risk flag ${flag} cannot be toggled via API (${flagDef.riskLevel} risk level)`
        })
      };
    }

    // Log the toggle attempt for auditing
    console.log(`[OPS] Flag toggle attempt: ${flag} = ${value} (dev mode)`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        message: `Flag toggle recorded: ${flag} = ${value}`,
        flag,
        value,
        note: 'Dev-only toggle - actual runtime value depends on environment/localStorage',
        current_effective_value: getFlagValue(flag),
        meta: {
          timestamp: new Date().toISOString(),
          environment: flagDef.environment,
          risk_level: flagDef.riskLevel
        }
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to toggle flag',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get ops console status for debugging
 */
export function getOpsConsoleStatus(): any {
  return {
    enabled: isOpsConsoleEnabled(),
    token_configured: !!getOpsConsoleToken(),
    dev_toggles_enabled: isDevTogglesEnabled(),
    localhost_mode: true, // Always available on localhost when enabled
    html_path: join(process.cwd(), 'artifacts', 'public', 'ops-console.html'),
    html_exists: existsSync(join(process.cwd(), 'artifacts', 'public', 'ops-console.html')),
    api_endpoints: {
      'GET /ops': 'Operations console dashboard',
      'GET /ops/flags': 'Current feature flags',
      'GET /ops/limits': 'Effective limits configuration',
      'GET /ops/queue': 'Queue status summary',
      'POST /ops/toggle-flag': 'Dev-only flag toggles (requires dev mode)'
    }
  };
}