/**
 * Tenant Sessions & Fair-Use Guardrails
 * Optional HMAC-signed session tokens for multi-tenant pilot quotas (OFF by default)
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface TenantCaps {
  rpm: number;
  daily_tokens: number;
  max_concurrency: number;
}

export interface TenantClaims {
  org: string;
  plan: string;
  caps: TenantCaps;
  exp: number; // Unix timestamp
}

export interface MintSessionRequest {
  org: string;
  plan: string;
  caps: TenantCaps;
  ttlMin?: number;
}

export interface MintSessionResponse {
  session: string;
  exp: string; // ISO8601
}

export interface TenantUsage {
  requests_last_minute: number;
  tokens_today: number;
  concurrent_runs: number;
  last_reset_rpm: number;
  last_reset_daily: number;
}

// Environment configuration - read dynamically to support tests
function getTenantSigningKey(): string | undefined {
  return process.env.TENANT_SIGNING_KEY;
}

function getDefaultTtlMin(): number {
  return parseInt(process.env.TENANT_TTL_MIN || '120');
}

// In-memory usage tracking per org
const tenantUsage = new Map<string, TenantUsage>();

/**
 * Check if tenant sessions feature is enabled
 */
export function isTenantSessionsEnabled(): boolean {
  return !!getTenantSigningKey();
}

/**
 * Generate HMAC signature for tenant claims
 */
function generateSessionToken(claims: TenantClaims): string {
  const signingKey = getTenantSigningKey();
  if (!signingKey) {
    throw new Error('TENANT_SIGNING_KEY not configured');
  }

  const payload = JSON.stringify({
    org: claims.org,
    plan: claims.plan,
    caps: claims.caps,
    exp: claims.exp
  });

  const signature = createHmac('sha256', signingKey)
    .update(payload)
    .digest('hex');

  // Base64URL encode the payload + signature
  const token = Buffer.from(`${payload}.${signature}`).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return token;
}

/**
 * Verify and decode session token
 */
function verifySessionToken(token: string): TenantClaims | null {
  const signingKey = getTenantSigningKey();
  if (!signingKey) {
    return null;
  }

  try {
    // Base64URL decode
    const decoded = Buffer.from(
      token.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');

    const [payloadStr, signature] = decoded.split('.');
    if (!payloadStr || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', signingKey)
      .update(payloadStr)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    // Parse claims
    const claims = JSON.parse(payloadStr);

    // Check expiry
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

/**
 * Validate mint session request
 */
function validateMintRequest(requestBody: any): any {
  if (!requestBody || typeof requestBody !== 'object') {
    return {
      type: 'BAD_INPUT',
      message: 'Request body required',
      timestamp: new Date().toISOString()
    };
  }

  const { org, plan, caps, ttlMin } = requestBody;

  if (!org || typeof org !== 'string') {
    return {
      type: 'BAD_INPUT',
      message: 'org field required',
      timestamp: new Date().toISOString()
    };
  }

  if (!plan || typeof plan !== 'string') {
    return {
      type: 'BAD_INPUT',
      message: 'plan field required',
      timestamp: new Date().toISOString()
    };
  }

  if (!caps || typeof caps !== 'object') {
    return {
      type: 'BAD_INPUT',
      message: 'caps field required',
      timestamp: new Date().toISOString()
    };
  }

  // Validate caps structure
  if (typeof caps.rpm !== 'number' || caps.rpm <= 0 || caps.rpm > 1000) {
    return {
      type: 'BAD_INPUT',
      message: 'caps.rpm must be a number between 1 and 1000',
      timestamp: new Date().toISOString()
    };
  }

  if (typeof caps.daily_tokens !== 'number' || caps.daily_tokens <= 0 || caps.daily_tokens > 1000000) {
    return {
      type: 'BAD_INPUT',
      message: 'caps.daily_tokens must be a number between 1 and 1000000',
      timestamp: new Date().toISOString()
    };
  }

  if (typeof caps.max_concurrency !== 'number' || caps.max_concurrency <= 0 || caps.max_concurrency > 50) {
    return {
      type: 'BAD_INPUT',
      message: 'caps.max_concurrency must be a number between 1 and 50',
      timestamp: new Date().toISOString()
    };
  }

  // Validate TTL
  if (ttlMin !== undefined) {
    if (typeof ttlMin !== 'number' || ttlMin <= 0 || ttlMin > 1440) {
      return {
        type: 'BAD_INPUT',
        message: 'ttlMin must be between 1 and 1440 minutes',
        timestamp: new Date().toISOString()
      };
    }
  }

  return null; // Valid
}

/**
 * Get or initialize tenant usage
 */
function getTenantUsage(org: string): TenantUsage {
  if (!tenantUsage.has(org)) {
    const now = Math.floor(Date.now() / 1000);
    tenantUsage.set(org, {
      requests_last_minute: 0,
      tokens_today: 0,
      concurrent_runs: 0,
      last_reset_rpm: now,
      last_reset_daily: now
    });
  }

  const usage = tenantUsage.get(org)!;
  const now = Math.floor(Date.now() / 1000);

  // Reset RPM counter if minute boundary crossed
  if (now - usage.last_reset_rpm >= 60) {
    usage.requests_last_minute = 0;
    usage.last_reset_rpm = now;
  }

  // Reset daily counter if day boundary crossed
  if (now - usage.last_reset_daily >= 86400) {
    usage.tokens_today = 0;
    usage.last_reset_daily = now;
  }

  return usage;
}

/**
 * Check if tenant exceeds rate limits
 */
export function checkTenantLimits(org: string, caps: TenantCaps): { allowed: boolean; retryAfter?: number; reason?: string } {
  const usage = getTenantUsage(org);

  // Check RPM limit
  if (usage.requests_last_minute >= caps.rpm) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) - usage.last_reset_rpm);
    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: `Rate limit exceeded: ${caps.rpm} requests per minute`
    };
  }

  // Check daily token limit
  if (usage.tokens_today >= caps.daily_tokens) {
    const retryAfter = 86400 - (Math.floor(Date.now() / 1000) - usage.last_reset_daily);
    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      reason: `Daily token budget exceeded: ${caps.daily_tokens} tokens per day`
    };
  }

  // Check concurrency limit
  if (usage.concurrent_runs >= caps.max_concurrency) {
    return {
      allowed: false,
      retryAfter: 5, // Default retry after for concurrency
      reason: `Too many concurrent runs: ${caps.max_concurrency} maximum`
    };
  }

  return { allowed: true };
}

/**
 * Record tenant usage
 */
export function recordTenantUsage(org: string, tokens: number = 0): void {
  const usage = getTenantUsage(org);
  usage.requests_last_minute++;
  usage.tokens_today += tokens;
}

/**
 * Increment tenant concurrency
 */
export function incrementConcurrency(org: string): void {
  const usage = getTenantUsage(org);
  usage.concurrent_runs++;
}

/**
 * Decrement tenant concurrency
 */
export function decrementConcurrency(org: string): void {
  const usage = getTenantUsage(org);
  usage.concurrent_runs = Math.max(0, usage.concurrent_runs - 1);
}

/**
 * Extract tenant session from request headers
 */
export function extractTenantSession(headers: Record<string, any>): TenantClaims | null {
  if (!isTenantSessionsEnabled()) {
    return null;
  }

  // Check Authorization header: "Pilot <token>"
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader && authHeader.startsWith('Pilot ')) {
    const token = authHeader.substring(6);
    return verifySessionToken(token);
  }

  // Check X-Olumi-Session header
  const sessionHeader = headers['x-olumi-session'] || headers['X-Olumi-Session'];
  if (sessionHeader) {
    return verifySessionToken(sessionHeader);
  }

  return null;
}

/**
 * Handle POST /pilot/mint-session request
 */
export async function handleMintSessionRequest(requestBody: any): Promise<any> {
  // Check if feature is enabled
  if (!isTenantSessionsEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Tenant sessions not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Validate request
  const validation = validateMintRequest(requestBody);
  if (validation) {
    return { status: 400, body: validation };
  }

  const { org, plan, caps, ttlMin = getDefaultTtlMin() } = requestBody;

  try {
    // Calculate expiry
    const exp = Math.floor(Date.now() / 1000) + (ttlMin * 60);

    // Create claims
    const claims: TenantClaims = { org, plan, caps, exp };

    // Generate session token
    const session = generateSessionToken(claims);

    const response: MintSessionResponse = {
      session,
      exp: new Date(exp * 1000).toISOString()
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
        message: 'Failed to mint session token',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get tenant session status for debugging
 */
export function getTenantSessionStatus(): any {
  return {
    enabled: isTenantSessionsEnabled(),
    default_ttl_min: getDefaultTtlMin(),
    active_orgs: Array.from(tenantUsage.keys()),
    total_usage_records: tenantUsage.size
  };
}

/**
 * Get usage for specific org (for debugging)
 */
export function getOrgUsage(org: string): TenantUsage | null {
  return tenantUsage.get(org) || null;
}

/**
 * Middleware for tenant session enforcement
 * Returns null if allowed, or error response if blocked
 */
export function enforceTenantSession(headers: Record<string, any>, org?: string): any | null {
  // Skip enforcement if tenant sessions are disabled
  if (!isTenantSessionsEnabled()) {
    return null; // Allow
  }

  // Extract session token from headers
  let sessionToken: string | null = null;

  // Check Authorization header: "Authorization: Pilot <token>"
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Pilot\s+(.+)$/);
    if (match) {
      sessionToken = match[1];
    }
  }

  // Check X-Olumi-Session header
  if (!sessionToken) {
    sessionToken = headers['x-olumi-session'] || headers['X-Olumi-Session'];
  }

  // No session token provided
  if (!sessionToken) {
    return {
      status: 401,
      body: {
        type: 'BAD_INPUT',
        message: 'Valid pilot session required. Use POST /pilot/mint-session to obtain token.',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Validate session token
  const validation = validateSessionToken(sessionToken);
  if (!validation.valid) {
    return {
      status: 401,
      body: {
        type: 'BAD_INPUT',
        message: validation.reason || 'Invalid session token',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Check if this specific org is allowed (if org provided)
  if (org && validation.payload?.org !== org) {
    return {
      status: 403,
      body: {
        type: 'BAD_INPUT',
        message: 'Session not valid for requested organisation',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Check quota enforcement
  const sessionOrg = validation.payload?.org;
  if (sessionOrg) {
    const quotaCheck = checkQuotaLimits(sessionOrg);
    if (!quotaCheck.allowed) {
      return {
        status: 429,
        headers: {
          'Retry-After': '3600' // Suggest retry in 1 hour
        },
        body: {
          type: 'RATE_LIMIT',
          message: `Quota exceeded: ${quotaCheck.reason}. Used ${quotaCheck.usage?.used}/${quotaCheck.usage?.limit} requests this period.`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  return null; // Allow - session is valid
}

/**
 * Clear sessions for testing
 */
export function clearTenantSessions(): void {
  activeSessions.clear();
}