// src/lib/errors.ts

export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  UNKNOWN = 'unknown'
}

export interface AppError extends Error {
  type: ErrorType;
  code?: string;
  status?: number;
  retryAfter?: number;
  context?: Record<string, any>;
}

export class AppErrorHandler {
  static createError(
    message: string,
    type: ErrorType,
    options: {
      code?: string;
      status?: number;
      retryAfter?: number;
      context?: Record<string, any>;
      originalError?: Error;
    } = {}
  ): AppError {
    const error = new Error(message) as AppError;
    error.type = type;
    error.code = options.code;
    error.status = options.status;
    error.retryAfter = options.retryAfter;
    error.context = options.context;
    
    if (options.originalError) {
      error.stack = options.originalError.stack;
    }
    
    return error;
  }

  static fromSupabaseError(error: any, context?: Record<string, any>): AppError {
    if (!error) {
      return this.createError('Unknown database error', ErrorType.UNKNOWN, { context });
    }

    // Handle specific Supabase error codes
    switch (error.code) {
      case '23505': // Unique violation
        return this.createError(
          'This item already exists',
          ErrorType.CONFLICT,
          { code: error.code, context }
        );
      
      case '23503': // Foreign key violation
        return this.createError(
          'Referenced item does not exist',
          ErrorType.VALIDATION,
          { code: error.code, context }
        );
      
      case '23514': // Check constraint violation
        return this.createError(
          'Invalid data provided',
          ErrorType.VALIDATION,
          { code: error.code, context }
        );
      
      case 'PGRST116': // No rows returned
        return this.createError(
          'Item not found',
          ErrorType.NOT_FOUND,
          { code: error.code, context }
        );
      
      case '42501': // Insufficient privilege
        return this.createError(
          'You do not have permission to perform this action',
          ErrorType.PERMISSION,
          { code: error.code, context }
        );
      
      default:
        return this.createError(
          error.message || 'Database operation failed',
          ErrorType.SERVER_ERROR,
          { code: error.code, context, originalError: error }
        );
    }
  }

  static fromNetworkError(error: any, context?: Record<string, any>): AppError {
    if (error?.name === 'TypeError' && error?.message?.includes('Failed to fetch')) {
      return this.createError(
        'Unable to connect to the server. Please check your internet connection.',
        ErrorType.NETWORK,
        { context, originalError: error }
      );
    }
    
    if (error?.message?.includes('timeout')) {
      return this.createError(
        'Request timed out. Please try again.',
        ErrorType.NETWORK,
        { context, originalError: error }
      );
    }
    
    return this.createError(
      'Network error occurred',
      ErrorType.NETWORK,
      { context, originalError: error }
    );
  }

  static fromAuthError(error: any, context?: Record<string, any>): AppError {
    if (!error) {
      return this.createError('Authentication failed', ErrorType.AUTHENTICATION, { context });
    }

    // Handle specific auth error messages
    if (error.message?.includes('Invalid login credentials')) {
      return this.createError(
        'Invalid email or password. Please check your credentials.',
        ErrorType.AUTHENTICATION,
        { context, originalError: error }
      );
    }
    
    if (error.message?.includes('Email not confirmed')) {
      return this.createError(
        'Please check your email and confirm your account.',
        ErrorType.AUTHENTICATION,
        { context, originalError: error }
      );
    }
    
    if (error.message?.includes('Too many requests')) {
      return this.createError(
        'Too many sign in attempts. Please wait before trying again.',
        ErrorType.RATE_LIMIT,
        { retryAfter: 300, context, originalError: error }
      );
    }
    
    if (error.message?.includes('refresh_token_not_found')) {
      return this.createError(
        'Your session has expired. Please sign in again.',
        ErrorType.AUTHENTICATION,
        { context, originalError: error }
      );
    }
    
    return this.createError(
      error.message || 'Authentication error occurred',
      ErrorType.AUTHENTICATION,
      { context, originalError: error }
    );
  }

  static getUserFriendlyMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Connection problem. Please check your internet and try again.';
      
      case ErrorType.AUTHENTICATION:
        return 'Please sign in to continue.';
      
      case ErrorType.PERMISSION:
        return 'You don\'t have permission to do this.';
      
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      
      case ErrorType.RATE_LIMIT:
        return `Too many requests. Please wait ${error.retryAfter || 60} seconds.`;
      
      case ErrorType.NOT_FOUND:
        return 'The requested item was not found.';
      
      case ErrorType.CONFLICT:
        return 'This item already exists.';
      
      case ErrorType.SERVER_ERROR:
        return 'Server error. Please try again later.';
      
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }

  static shouldRetry(error: AppError): boolean {
    return error.type === ErrorType.NETWORK || 
           error.type === ErrorType.SERVER_ERROR ||
           (error.type === ErrorType.RATE_LIMIT && !!error.retryAfter);
  }

  static getRetryDelay(error: AppError, attempt: number): number {
    if (error.type === ErrorType.RATE_LIMIT && error.retryAfter) {
      return error.retryAfter * 1000;
    }
    
    // Exponential backoff for network and server errors
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }
}

// Utility function for consistent error handling in async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const result = await operation();
    return { data: result, error: null };
  } catch (err) {
    let appError: AppError;
    
    if (err instanceof Error && 'type' in err) {
      appError = err as AppError;
    } else if (err?.code) {
      // Supabase error
      appError = AppErrorHandler.fromSupabaseError(err, context);
    } else if (err instanceof TypeError && err.message.includes('fetch')) {
      // Network error
      appError = AppErrorHandler.fromNetworkError(err, context);
    } else {
      // Generic error
      appError = AppErrorHandler.createError(
        err instanceof Error ? err.message : 'Unknown error',
        ErrorType.UNKNOWN,
        { context, originalError: err instanceof Error ? err : undefined }
      );
    }
    
    return { data: null, error: appError };
  }
}