/**
 * Error Code Reference
 *
 * Human-readable descriptions and recommended actions for common error codes
 * encountered in the CEE/PLoT/ISL service chain.
 */

export interface ErrorCodeInfo {
  /** Human-readable description of the error */
  description: string
  /** Recommended action to resolve the error */
  action: string
}

export const ERROR_DESCRIPTIONS: Record<string, ErrorCodeInfo> = {
  // CEE Errors
  CEE_NETWORK_ERROR: {
    description: 'Network request to CEE service failed',
    action: 'Check CEE service health and network connectivity',
  },
  CEE_TIMEOUT: {
    description: 'CEE request exceeded timeout threshold',
    action: 'LLM may be overloaded. Retry or check CEE logs',
  },
  CEE_VALIDATION_ERROR: {
    description: 'CEE rejected the request payload',
    action: 'Check brief format and required fields',
  },
  CEE_RATE_LIMIT: {
    description: 'CEE rate limit exceeded',
    action: 'Wait before retrying or check rate limit configuration',
  },
  CEE_INTERNAL_ERROR: {
    description: 'CEE encountered an internal error',
    action: 'Check CEE service logs for details',
  },

  // PLoT Errors
  PLOT_NETWORK_ERROR: {
    description: 'Network request to PLoT service failed',
    action: 'Check PLoT service health',
  },
  PLOT_TIMEOUT: {
    description: 'PLoT request exceeded timeout threshold',
    action: 'Graph may be complex. Simplify or check PLoT logs',
  },
  PLOT_VALIDATION_ERROR: {
    description: 'PLoT rejected the graph structure',
    action: 'Check graph format and node relationships',
  },
  PLOT_ISL_ERROR: {
    description: 'PLoT received error from downstream ISL call',
    action: 'Check ISL service health and graph validity',
  },
  PLOT_INTERNAL_ERROR: {
    description: 'PLoT encountered an internal error',
    action: 'Check PLoT service logs for details',
  },

  // ISL Errors
  ISL_NETWORK_ERROR: {
    description: 'Network request to ISL service failed',
    action: 'Check ISL service health',
  },
  ISL_VALIDATION_ERROR: {
    description: 'ISL rejected the graph structure',
    action: 'Check graph connectivity and node types',
  },
  ISL_TIMEOUT: {
    description: 'ISL analysis exceeded timeout',
    action: 'Graph may be too complex. Simplify or increase timeout',
  },
  ISL_COMPUTATION_ERROR: {
    description: 'ISL encountered computation error',
    action: 'Check graph structure for cycles or invalid weights',
  },
  ISL_INTERNAL_ERROR: {
    description: 'ISL encountered an internal error',
    action: 'Check ISL service logs for details',
  },

  // HTTP Status Code Mappings
  HTTP_400: {
    description: 'Bad request - invalid payload format',
    action: 'Check request payload structure',
  },
  HTTP_401: {
    description: 'Authentication failed',
    action: 'Check API key or authentication token',
  },
  HTTP_403: {
    description: 'Access forbidden',
    action: 'Check permissions and API key scope',
  },
  HTTP_404: {
    description: 'Resource not found',
    action: 'Check endpoint URL and service deployment',
  },
  HTTP_429: {
    description: 'Rate limit exceeded',
    action: 'Wait before retrying',
  },
  HTTP_500: {
    description: 'Internal server error',
    action: 'Check service logs for details',
  },
  HTTP_502: {
    description: 'Bad gateway',
    action: 'Check upstream service health',
  },
  HTTP_503: {
    description: 'Service unavailable',
    action: 'Service may be restarting. Retry after a moment',
  },
  HTTP_504: {
    description: 'Gateway timeout',
    action: 'Request took too long. Retry or simplify request',
  },

  // Generic Errors
  ERROR: {
    description: 'An error occurred',
    action: 'Check the error message for details',
  },
  UNKNOWN_ERROR: {
    description: 'An unknown error occurred',
    action: 'Check service logs for details',
  },
}

/**
 * Get error info for a given error code.
 * Falls back to generic error info if code is not found.
 */
export function getErrorInfo(code: string): ErrorCodeInfo {
  return (
    ERROR_DESCRIPTIONS[code] ??
    ERROR_DESCRIPTIONS[`HTTP_${code}`] ??
    ERROR_DESCRIPTIONS.UNKNOWN_ERROR
  )
}
