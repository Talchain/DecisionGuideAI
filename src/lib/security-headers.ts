/**
 * Security Headers and Logging Guards
 * Ensures proper security posture and prevents payload logging
 */

/**
 * Standard security headers for all responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * CORS headers (disabled by default, enable with flag)
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  if (process.env.CORS_ENABLE !== '1') {
    return {};
  }

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [];
  const allowOrigin = allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)
    ? origin
    : process.env.CORS_DEFAULT_ORIGIN || 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Last-Event-ID, X-Correlation-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Rate limit headers
 */
export function getRateLimitHeaders(limit: number, remaining: number, resetTime: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
  };
}

/**
 * Payload logging guard - prevents accidental logging of request bodies
 */
class PayloadLoggingGuard {
  private static blockedFields = new Set([
    'body', 'requestBody', 'payload', 'data', 'content',
    'password', 'token', 'secret', 'key', 'auth', 'authorization'
  ]);

  /**
   * Check if an object contains fields that should not be logged
   */
  static containsSensitiveData(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (this.blockedFields.has(lowerKey)) {
        return true;
      }

      // Check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (this.containsSensitiveData(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Sanitize object for safe logging
   */
  static sanitizeForLogging(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (this.blockedFields.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Safe logger wrapper that prevents payload logging
   */
  static createSafeLogger(originalLogger: any) {
    return {
      info: (message: string, data?: any) => {
        if (data && this.containsSensitiveData(data)) {
          throw new Error('Attempted to log sensitive data - use PayloadLoggingGuard.sanitizeForLogging() first');
        }
        return originalLogger.info(message, data);
      },
      warn: (message: string, data?: any) => {
        if (data && this.containsSensitiveData(data)) {
          throw new Error('Attempted to log sensitive data - use PayloadLoggingGuard.sanitizeForLogging() first');
        }
        return originalLogger.warn(message, data);
      },
      error: (message: string, data?: any) => {
        if (data && this.containsSensitiveData(data)) {
          throw new Error('Attempted to log sensitive data - use PayloadLoggingGuard.sanitizeForLogging() first');
        }
        return originalLogger.error(message, data);
      },
      debug: (message: string, data?: any) => {
        if (data && this.containsSensitiveData(data)) {
          throw new Error('Attempted to log sensitive data - use PayloadLoggingGuard.sanitizeForLogging() first');
        }
        return originalLogger.debug(message, data);
      }
    };
  }
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  headers: Record<string, string>,
  origin?: string,
  rateLimit?: { limit: number; remaining: number; resetTime: number }
): Record<string, string> {
  const secureHeaders = {
    ...headers,
    ...SECURITY_HEADERS,
    ...getCorsHeaders(origin)
  };

  if (rateLimit) {
    Object.assign(secureHeaders, getRateLimitHeaders(
      rateLimit.limit,
      rateLimit.remaining,
      rateLimit.resetTime
    ));
  }

  return secureHeaders;
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(
  limit: number,
  resetTime: number,
  origin?: string
): any {
  return {
    status: 429,
    headers: applySecurityHeaders({
      'Content-Type': 'application/json'
    }, origin, {
      limit,
      remaining: 0,
      resetTime
    }),
    body: {
      type: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      resetTime,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Validate request for security issues
 */
export function validateRequestSecurity(
  method: string,
  headers: Record<string, any>,
  body?: any
): { valid: boolean; error?: any } {
  // Check for oversized requests
  const contentLength = parseInt(headers['content-length'] || '0');
  const maxSize = parseInt(process.env.MAX_REQUEST_SIZE || '10485760'); // 10MB default

  if (contentLength > maxSize) {
    return {
      valid: false,
      error: {
        status: 413,
        headers: applySecurityHeaders({ 'Content-Type': 'application/json' }),
        body: {
          type: 'BAD_INPUT',
          message: 'Request entity too large',
          maxSize,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-host'];
  for (const header of suspiciousHeaders) {
    if (headers[header] && process.env.PROXY_HEADERS_ALLOWED !== '1') {
      return {
        valid: false,
        error: {
          status: 400,
          headers: applySecurityHeaders({ 'Content-Type': 'application/json' }),
          body: {
            type: 'BAD_INPUT',
            message: 'Suspicious proxy headers detected',
            timestamp: new Date().toISOString()
          }
        }
      };
    }
  }

  return { valid: true };
}

/**
 * Safe request logging - only logs metadata, never bodies
 */
export function logRequestSafely(
  method: string,
  path: string,
  headers: Record<string, any>,
  query?: Record<string, any>
): void {
  const safeHeaders = PayloadLoggingGuard.sanitizeForLogging(headers);
  const safeQuery = PayloadLoggingGuard.sanitizeForLogging(query);

  // Only log safe metadata
  const logData = {
    method,
    path,
    userAgent: headers['user-agent'],
    contentType: headers['content-type'],
    contentLength: headers['content-length'],
    origin: headers['origin'],
    correlationId: headers['x-correlation-id'],
    queryParams: safeQuery ? Object.keys(safeQuery) : [],
    timestamp: new Date().toISOString()
  };

  console.log('Request metadata:', logData);
}

/**
 * Export the payload logging guard for use in other modules
 */
export { PayloadLoggingGuard };