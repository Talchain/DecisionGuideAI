/**
 * Error Taxonomy Mapping
 * Contract wall compliance - PRD v15
 * Maps error codes to HTTP status codes and provides error handling utilities
 */

export type ErrorCode =
  | 'TIMEOUT'
  | 'RETRYABLE'
  | 'INTERNAL'
  | 'BAD_INPUT'
  | 'RATE_LIMIT'
  | 'BREAKER_OPEN';

export interface ErrorMapping {
  httpStatus: number;
  retryable: boolean;
  category: 'client' | 'server' | 'network' | 'rate_limit';
  description: string;
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  httpStatus: number;
  timestamp: string;
  details?: Record<string, any>;
  context?: {
    sessionId?: string;
    userId?: string;
    endpoint?: string;
    requestId?: string;
  };
}

/**
 * Error Taxonomy Mapping Table
 */
export const ERROR_TAXONOMY: Record<ErrorCode, ErrorMapping> = {
  TIMEOUT: {
    httpStatus: 408,
    retryable: true,
    category: 'network',
    description: 'Request timed out - operation took longer than allowed time limit'
  },
  RETRYABLE: {
    httpStatus: 503,
    retryable: true,
    category: 'server',
    description: 'Temporary server error - safe to retry after brief delay'
  },
  INTERNAL: {
    httpStatus: 500,
    retryable: true,
    category: 'server',
    description: 'Internal server error - unexpected condition encountered'
  },
  BAD_INPUT: {
    httpStatus: 400,
    retryable: false,
    category: 'client',
    description: 'Invalid input provided - request format or parameters incorrect'
  },
  RATE_LIMIT: {
    httpStatus: 429,
    retryable: true,
    category: 'rate_limit',
    description: 'Rate limit exceeded - too many requests in time window'
  },
  BREAKER_OPEN: {
    httpStatus: 503,
    retryable: true,
    category: 'server',
    description: 'Circuit breaker open - service temporarily unavailable due to repeated failures'
  }
};

/**
 * Error Factory for creating standardised errors
 */
export class ErrorFactory {
  static create(
    code: ErrorCode,
    message?: string,
    details?: Record<string, any>,
    context?: ErrorDetails['context']
  ): ErrorDetails {
    const mapping = ERROR_TAXONOMY[code];

    return {
      code,
      message: message || mapping.description,
      retryable: mapping.retryable,
      httpStatus: mapping.httpStatus,
      timestamp: new Date().toISOString(),
      details,
      context
    };
  }

  static timeout(message?: string, details?: Record<string, any>): ErrorDetails {
    return this.create(
      'TIMEOUT',
      message || 'Operation timed out',
      details
    );
  }

  static retryable(message?: string, details?: Record<string, any>): ErrorDetails {
    return this.create(
      'RETRYABLE',
      message || 'Temporary server error, please retry',
      details
    );
  }

  static internal(message?: string, details?: Record<string, any>): ErrorDetails {
    return this.create(
      'INTERNAL',
      message || 'An internal error occurred',
      details
    );
  }

  static badInput(message?: string, details?: Record<string, any>): ErrorDetails {
    return this.create(
      'BAD_INPUT',
      message || 'Invalid input provided',
      details
    );
  }

  static rateLimit(resetTime?: string, limit?: number, remaining?: number): ErrorDetails {
    const details: Record<string, any> = {};
    if (resetTime) details.resetTime = resetTime;
    if (limit !== undefined) details.limit = limit;
    if (remaining !== undefined) details.remaining = remaining;

    return this.create(
      'RATE_LIMIT',
      'Rate limit exceeded',
      details
    );
  }

  static breakerOpen(service?: string, retryAfter?: number): ErrorDetails {
    const details: Record<string, any> = {};
    if (service) details.service = service;
    if (retryAfter) details.retryAfter = retryAfter;

    return this.create(
      'BREAKER_OPEN',
      'Service temporarily unavailable',
      details
    );
  }
}

/**
 * Error Response Formatter
 */
export class ErrorFormatter {
  static toHttpResponse(error: ErrorDetails): {
    status: number;
    body: {
      code: string;
      message: string;
      retryable: boolean;
      timestamp: string;
      details?: Record<string, any>;
    };
  } {
    return {
      status: error.httpStatus,
      body: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        timestamp: error.timestamp,
        ...(error.details && { details: error.details })
      }
    };
  }

  static toSSEError(error: ErrorDetails, sessionId: string): string {
    return `event: error\ndata: ${JSON.stringify({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details
    })}\n\n`;
  }

  static toLogEntry(error: ErrorDetails): string {
    const logData = {
      timestamp: error.timestamp,
      level: 'ERROR',
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
      ...(error.context && { context: error.context }),
      ...(error.details && { details: error.details })
    };

    return JSON.stringify(logData);
  }
}

/**
 * Error Classification Utilities
 */
export class ErrorClassifier {
  static isRetryable(code: ErrorCode): boolean {
    return ERROR_TAXONOMY[code].retryable;
  }

  static getHttpStatus(code: ErrorCode): number {
    return ERROR_TAXONOMY[code].httpStatus;
  }

  static getCategory(code: ErrorCode): ErrorMapping['category'] {
    return ERROR_TAXONOMY[code].category;
  }

  static isClientError(code: ErrorCode): boolean {
    return this.getCategory(code) === 'client';
  }

  static isServerError(code: ErrorCode): boolean {
    return this.getCategory(code) === 'server';
  }

  static isNetworkError(code: ErrorCode): boolean {
    return this.getCategory(code) === 'network';
  }

  static isRateLimitError(code: ErrorCode): boolean {
    return this.getCategory(code) === 'rate_limit';
  }

  static shouldRetry(error: ErrorDetails, attemptCount: number, maxAttempts: number = 3): boolean {
    if (!error.retryable || attemptCount >= maxAttempts) {
      return false;
    }

    // Special handling for different error types
    switch (error.code) {
      case 'RATE_LIMIT':
        // Only retry rate limits if we have reset time information
        return error.details?.resetTime != null;

      case 'BREAKER_OPEN':
        // Only retry circuit breaker after specified delay
        return error.details?.retryAfter != null;

      case 'TIMEOUT':
        // Retry timeouts with exponential backoff
        return attemptCount < 2;

      default:
        return true;
    }
  }

  static calculateRetryDelay(error: ErrorDetails, attemptCount: number): number {
    const baseDelay = 1000; // 1 second base delay

    switch (error.code) {
      case 'RATE_LIMIT':
        // Use reset time if available, otherwise exponential backoff
        if (error.details?.resetTime) {
          const resetTime = new Date(error.details.resetTime).getTime();
          const now = Date.now();
          return Math.max(0, resetTime - now);
        }
        return baseDelay * Math.pow(2, attemptCount);

      case 'BREAKER_OPEN':
        // Use retry after if specified
        return error.details?.retryAfter || baseDelay * 5;

      case 'TIMEOUT':
        // Exponential backoff for timeouts
        return baseDelay * Math.pow(2, attemptCount);

      default:
        // Standard exponential backoff
        return baseDelay * Math.pow(2, attemptCount);
    }
  }
}

/**
 * Type Guards and Validation
 */
export function isValidErrorCode(code: string): code is ErrorCode {
  return Object.keys(ERROR_TAXONOMY).includes(code);
}

export function isValidErrorDetails(error: any): error is ErrorDetails {
  return (
    error &&
    typeof error === 'object' &&
    isValidErrorCode(error.code) &&
    typeof error.message === 'string' &&
    typeof error.retryable === 'boolean' &&
    typeof error.httpStatus === 'number' &&
    typeof error.timestamp === 'string'
  );
}

/**
 * Common Error Patterns
 */
export const COMMON_ERROR_PATTERNS = {
  VALIDATION_FAILED: (field: string) => ErrorFactory.badInput(
    `Validation failed for field: ${field}`,
    { field, type: 'validation' }
  ),

  MISSING_REQUIRED_FIELD: (field: string) => ErrorFactory.badInput(
    `Required field missing: ${field}`,
    { field, type: 'required' }
  ),

  INVALID_FORMAT: (field: string, expectedFormat: string) => ErrorFactory.badInput(
    `Invalid format for ${field}. Expected: ${expectedFormat}`,
    { field, expectedFormat, type: 'format' }
  ),

  SERVICE_UNAVAILABLE: (service: string) => ErrorFactory.retryable(
    `Service ${service} is temporarily unavailable`,
    { service, type: 'service_unavailable' }
  ),

  QUOTA_EXCEEDED: (quotaType: string, limit: number) => ErrorFactory.rateLimit(
    undefined,
    limit,
    0
  )
} as const;