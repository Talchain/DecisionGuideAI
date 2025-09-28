/**
 * Signed Pilot Access Links
 * Optional feature for temporary, shareable pilot URLs (OFF by default)
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface SignLinkRequest {
  path: string;
  params: Record<string, any>;
  ttlMin?: number;
}

export interface SignLinkResponse {
  url: string;
}

// Environment configuration
const PILOT_SIGNING_KEY = process.env.PILOT_SIGNING_KEY;
const DEFAULT_TTL_MIN = parseInt(process.env.PILOT_LINK_TTL_MIN || '30');

/**
 * Check if signed links feature is enabled
 */
export function isSignedLinksEnabled(): boolean {
  return !!PILOT_SIGNING_KEY;
}

/**
 * Generate HMAC signature for URL components
 */
function generateSignature(path: string, params: Record<string, any>, exp: number): string {
  if (!PILOT_SIGNING_KEY) {
    throw new Error('PILOT_SIGNING_KEY not configured');
  }

  // Sort params for consistent signing
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const payload = `${path}?${sortedParams}&exp=${exp}`;

  return createHmac('sha256', PILOT_SIGNING_KEY)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
function verifySignature(
  path: string,
  params: Record<string, any>,
  exp: number,
  signature: string
): boolean {
  if (!PILOT_SIGNING_KEY) {
    return false;
  }

  try {
    const expectedSignature = generateSignature(path, params, exp);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    return sigBuffer.length === expectedBuffer.length &&
           timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Validate sign link request
 */
function validateSignLinkRequest(requestBody: any): any {
  if (!requestBody || typeof requestBody !== 'object') {
    return {
      type: 'BAD_INPUT',
      message: 'Request body required',
      timestamp: new Date().toISOString()
    };
  }

  if (!requestBody.path || typeof requestBody.path !== 'string') {
    return {
      type: 'BAD_INPUT',
      message: 'path field required',
      timestamp: new Date().toISOString()
    };
  }

  if (!requestBody.params || typeof requestBody.params !== 'object') {
    return {
      type: 'BAD_INPUT',
      message: 'params field required',
      timestamp: new Date().toISOString()
    };
  }

  // Validate path format
  if (!requestBody.path.startsWith('/')) {
    return {
      type: 'BAD_INPUT',
      message: 'path must start with /',
      timestamp: new Date().toISOString()
    };
  }

  // Validate TTL
  if (requestBody.ttlMin !== undefined) {
    if (typeof requestBody.ttlMin !== 'number' || requestBody.ttlMin <= 0 || requestBody.ttlMin > 1440) {
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
 * Handle POST /pilot/sign-link request
 */
export async function handleSignLinkRequest(requestBody: any): Promise<any> {
  // Check if feature is enabled
  if (!isSignedLinksEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Signed pilot links not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Validate request
  const validation = validateSignLinkRequest(requestBody);
  if (validation) {
    return { status: 400, body: validation };
  }

  const { path, params, ttlMin = DEFAULT_TTL_MIN } = requestBody;

  try {
    // Calculate expiry timestamp
    const exp = Math.floor(Date.now() / 1000) + (ttlMin * 60);

    // Generate signature
    const signature = generateSignature(path, params, exp);

    // Build URL with signature
    const urlParams = new URLSearchParams();

    // Add original params
    for (const [key, value] of Object.entries(params)) {
      urlParams.set(key, String(value));
    }

    // Add signature params
    urlParams.set('olumi_signed', signature);
    urlParams.set('exp', exp.toString());

    // Construct full URL (using localhost for pilot)
    const baseUrl = process.env.PILOT_BASE_URL || 'http://localhost:3001';
    const url = `${baseUrl}${path}?${urlParams.toString()}`;

    const response: SignLinkResponse = { url };

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
        message: 'Failed to generate signed link',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Verify signed request parameters
 */
export function verifySignedRequest(
  path: string,
  queryParams: Record<string, any>
): { valid: boolean; error?: any } {
  // Check if signing is enabled
  if (!isSignedLinksEnabled()) {
    return { valid: true }; // No verification if not enabled
  }

  // Extract signature params
  const { olumi_signed, exp, ...params } = queryParams;

  // If no signature present, allow through (optional feature)
  if (!olumi_signed && !exp) {
    return { valid: true };
  }

  // If partial signature, reject
  if (!olumi_signed || !exp) {
    return {
      valid: false,
      error: {
        type: 'BAD_INPUT',
        message: 'Invalid signed request format',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Check expiry
  const expTimestamp = parseInt(exp);
  if (isNaN(expTimestamp) || expTimestamp < Math.floor(Date.now() / 1000)) {
    return {
      valid: false,
      error: {
        type: 'BAD_INPUT',
        message: 'Signed link expired',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Verify signature
  if (!verifySignature(path, params, expTimestamp, olumi_signed)) {
    return {
      valid: false,
      error: {
        type: 'BAD_INPUT',
        message: 'Invalid signature',
        timestamp: new Date().toISOString()
      }
    };
  }

  return { valid: true };
}

/**
 * Get signing configuration status
 */
export function getSigningStatus(): any {
  return {
    enabled: isSignedLinksEnabled(),
    default_ttl_min: DEFAULT_TTL_MIN,
    max_ttl_min: 1440
  };
}