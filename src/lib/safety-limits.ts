/**
 * Safety Limits Implementation
 * Scenario validator, quotas, and rate limiting for pilot deployment
 */

import { toPublicError } from './error-normaliser.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
}

interface RateLimitResult {
  allowed: boolean;
  type: 'RPM' | 'DAILY_TOKENS' | 'OK';
  message: string;
  retryAfter?: number;
}

interface ErrorResponse {
  type: 'BAD_INPUT' | 'RATE_LIMIT' | 'INTERNAL_ERROR';
  message: string;
  timestamp: string;
}

// Environment configuration with safe defaults (dynamic to allow runtime changes)
function getMaxNodes(): number {
  return parseInt(process.env.MAX_NODES || '12');
}

function getWarnNodes(): number {
  return parseInt(process.env.WARN_NODES || '10');
}

function getRateLimitRpm(): number {
  return parseInt(process.env.RATE_LIMIT_RPM || '60');
}

function getDailyBudgetTokens(): number {
  return parseInt(process.env.DAILY_BUDGET_TOKENS || '50000');
}

// In-memory storage for PoC (resets on restart)
const originMetrics = new Map<string, {
  requests: Array<{ timestamp: number; tokens?: number }>;
  totalTokensToday: number;
  lastReset: string;
}>();

/**
 * Get client origin from request headers
 */
function getClientOrigin(headers: Record<string, string>): string {
  return headers['x-forwarded-for'] ||
         headers['x-real-ip'] ||
         headers['origin'] ||
         'unknown';
}

/**
 * Reset daily counters if date has changed
 */
function resetDailyCountersIfNeeded(origin: string) {
  const today = new Date().toISOString().split('T')[0];
  const metrics = originMetrics.get(origin);

  if (!metrics || metrics.lastReset !== today) {
    originMetrics.set(origin, {
      requests: [],
      totalTokensToday: 0,
      lastReset: today
    });
  }
}

/**
 * Check rate limits for an origin
 */
export function checkRateLimit(origin: string, tokensUsed: number = 0): RateLimitResult {
  resetDailyCountersIfNeeded(origin);

  const metrics = originMetrics.get(origin)!;
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Clean old requests (older than 1 minute)
  metrics.requests = metrics.requests.filter(req => req.timestamp > oneMinuteAgo);

  // Check RPM limit
  const rateLimitRpm = getRateLimitRpm();
  if (metrics.requests.length >= rateLimitRpm) {
    const oldestRequest = Math.min(...metrics.requests.map(r => r.timestamp));
    const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);

    return {
      allowed: false,
      type: 'RPM',
      message: `Rate limit exceeded: ${rateLimitRpm} requests per minute`,
      retryAfter
    };
  }

  // Check daily token budget
  const dailyBudgetTokens = getDailyBudgetTokens();
  if (metrics.totalTokensToday + tokensUsed > dailyBudgetTokens) {
    return {
      allowed: false,
      type: 'DAILY_TOKENS',
      message: `Daily token budget exceeded: ${dailyBudgetTokens} tokens per day`
    };
  }

  // Record this request
  metrics.requests.push({
    timestamp: now,
    tokens: tokensUsed
  });

  metrics.totalTokensToday += tokensUsed;

  return {
    allowed: true,
    type: 'OK',
    message: 'Request allowed'
  };
}

/**
 * Count nodes in a scenario template
 */
function countScenarioNodes(scenario: any): number {
  if (!scenario || typeof scenario !== 'object') {
    return 0;
  }

  let nodeCount = 0;

  // Count options
  if (Array.isArray(scenario.options)) {
    nodeCount += scenario.options.length;
  }

  // Count stakeholders
  if (Array.isArray(scenario.stakeholders)) {
    nodeCount += scenario.stakeholders.length;
  }

  // Count constraints
  if (scenario.constraints && typeof scenario.constraints === 'object') {
    nodeCount += Object.keys(scenario.constraints).length;
  }

  // Count success metrics
  if (Array.isArray(scenario.success_metrics)) {
    nodeCount += scenario.success_metrics.length;
  }

  // Count additional complex fields
  ['requirements', 'assumptions', 'risks'].forEach(field => {
    if (Array.isArray(scenario[field])) {
      nodeCount += scenario[field].length;
    }
  });

  return nodeCount;
}

/**
 * Validate scenario structure and complexity
 */
export function validateScenario(template: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic structure validation
  if (!template) {
    errors.push('Template is required');
    return { valid: false, errors, warnings, nodeCount: 0 };
  }

  if (!template.scenario) {
    errors.push('Template must contain a scenario');
    return { valid: false, errors, warnings, nodeCount: 0 };
  }

  const scenario = template.scenario;

  // Required fields
  if (!scenario.title || typeof scenario.title !== 'string') {
    errors.push('Scenario title is required');
  }

  if (!scenario.options || !Array.isArray(scenario.options) || scenario.options.length === 0) {
    errors.push('Scenario must have at least one option');
  }

  // Count nodes for complexity validation
  const nodeCount = countScenarioNodes(scenario);

  const maxNodes = getMaxNodes();
  const warnNodes = getWarnNodes();

  if (nodeCount > maxNodes) {
    errors.push(`Scenario too large for pilot (${maxNodes}-node cap)`);
  } else if (nodeCount > warnNodes) {
    warnings.push(`Scenario approaching complexity limit (${nodeCount}/${maxNodes} nodes)`);
  }

  // Validate options structure
  if (scenario.options) {
    scenario.options.forEach((option: any, index: number) => {
      if (!option.id || typeof option.id !== 'string') {
        errors.push(`Option ${index + 1} must have a valid id`);
      }

      if (!option.name || typeof option.name !== 'string') {
        errors.push(`Option ${index + 1} must have a valid name`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    nodeCount
  };
}

/**
 * Middleware to check rate limits and scenario validation
 */
export function createSafetyMiddleware() {
  return async (req: any, res: any, next: any) => {
    const origin = getClientOrigin(req.headers);

    // Check rate limits first
    const rateLimitResult = checkRateLimit(origin);

    if (!rateLimitResult.allowed) {
      const statusCode = rateLimitResult.type === 'RPM' ? 429 : 429;
      const publicError = toPublicError({
        type: 'RATE_LIMIT',
        devDetail: rateLimitResult.message
      });

      if (rateLimitResult.retryAfter) {
        res.header('Retry-After', rateLimitResult.retryAfter.toString());
      }

      return res.status(statusCode).json(publicError);
    }

    // Validate scenario if present in request body
    if (req.body && (req.body.template || req.body.scenario)) {
      const templateToValidate = req.body.template || { scenario: req.body.scenario };
      const validation = validateScenario(templateToValidate);

      if (!validation.valid) {
        const publicError = toPublicError({
          type: 'BAD_INPUT',
          devDetail: validation.errors.join('; ')
        });

        return res.status(400).json(publicError);
      }

      // Add validation info to request for later use
      req.validationResult = validation;
    }

    next();
  };
}

/**
 * Get current rate limit status for monitoring
 */
export function getRateLimitStatus(): Record<string, any> {
  const status: Record<string, any> = {};

  for (const [origin, metrics] of originMetrics.entries()) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = metrics.requests.filter(req => req.timestamp > oneMinuteAgo);

    status[origin] = {
      rpm_current: recentRequests.length,
      rpm_limit: getRateLimitRpm(),
      tokens_today: metrics.totalTokensToday,
      tokens_limit: getDailyBudgetTokens(),
      last_reset: metrics.lastReset
    };
  }

  return status;
}

/**
 * Generate SSE "limited" event when rate limited
 */
export function generateLimitedEvent(message: string): string {
  const event = {
    type: 'limited',
    data: {
      message,
      timestamp: new Date().toISOString()
    }
  };

  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Update health endpoint with rate limit refusals
 */
export function updateHealthMetrics(): Record<string, number> {
  let totalRefusals = 0;

  for (const metrics of originMetrics.values()) {
    // Count requests that would have been refused
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = metrics.requests.filter(req => req.timestamp > oneMinuteAgo);

    const rateLimitRpm = getRateLimitRpm();
    const dailyBudgetTokens = getDailyBudgetTokens();

    if (recentRequests.length >= rateLimitRpm || metrics.totalTokensToday >= dailyBudgetTokens) {
      totalRefusals++;
    }
  }

  return {
    'rate_limit.refusals': totalRefusals
  };
}