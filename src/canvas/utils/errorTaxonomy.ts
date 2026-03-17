/**
 * Error Taxonomy & User Messaging (v1.2 - Task Group C)
 *
 * Maps common API/network failures to user-friendly, actionable messages.
 * Provides consistent error handling across the app.
 */

export interface UserFriendlyError {
  title: string
  message: string
  suggestion?: string
  retryable: boolean
  severity: 'error' | 'warning' | 'info'
}

/**
 * Map error code or HTTP status to user-friendly message
 */
export function mapErrorToUserMessage(error: {
  code?: string
  status?: number
  message?: string
  retryAfter?: number
}): UserFriendlyError {
  // NOTE: Check specific error codes FIRST, then network status as fallback
  // navigator.onLine can be unreliable (VPNs, slow networks) - don't let it hide real errors

  const rawMessage = error.message
  const normalizedMessage =
    typeof rawMessage === 'string'
      ? rawMessage
      : rawMessage != null
      ? String(rawMessage)
      : ''
  const messageLower = normalizedMessage.toLowerCase()

  // CORS error (common in dev/staging misconfigurations)
  // Only check message for CORS - status 0 alone is not sufficient (could be timeout/abort)
  if (messageLower.includes('cors') || messageLower.includes('blocked by cors')) {
    return {
      title: 'Connection blocked',
      message: 'Unable to reach the analysis engine due to a security policy (CORS).',
      suggestion: 'This usually means the engine URL is misconfigured. Contact support if this persists.',
      retryable: false,
      severity: 'error',
    }
  }

  // Network error (status 0 without CORS message)
  // Status 0 can be: network timeout, connection refused, aborted request
  if (error.status === 0) {
    return {
      title: 'Network error',
      message: 'Unable to connect to the analysis engine.',
      suggestion: 'Check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
      retryable: true,
      severity: 'error',
    }
  }

  // 405 Method Not Allowed
  if (error.status === 405 || error.code === 'METHOD_NOT_ALLOWED') {
    return {
      title: 'Endpoint not available',
      message: 'The analysis endpoint doesn\'t support this operation.',
      suggestion: 'The engine may not be fully deployed yet. Try again later or contact support.',
      retryable: true,
      severity: 'warning',
    }
  }

  // 429 Rate Limited
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    // retryAfter is already in seconds (from Retry-After header or body.retry_after)
    const waitTime = error.retryAfter ? Math.ceil(error.retryAfter) : 60
    return {
      title: 'Rate limit exceeded',
      message: `You've made too many requests. Please wait ${waitTime} seconds before trying again.`,
      suggestion: 'Consider saving your work and taking a short break.',
      retryable: true,
      severity: 'warning',
    }
  }

  // Timeout
  if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT' || messageLower.includes('timeout')) {
    return {
      title: 'Request timed out',
      message: 'The analysis is taking longer than expected.',
      suggestion: 'The engine might be overloaded. Try simplifying your graph or try again in a few minutes.',
      retryable: true,
      severity: 'warning',
    }
  }

  // 503 Service Unavailable
  if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
    return {
      title: 'Engine temporarily unavailable',
      message: 'The analysis engine is currently down for maintenance or experiencing issues.',
      suggestion: 'You can continue editing. Try running your analysis again in a few minutes.',
      retryable: true,
      severity: 'warning',
    }
  }

  // 500 Server Error
  if (error.status === 500 || error.code === 'SERVER_ERROR') {
    return {
      title: 'Engine error',
      message: 'Something went wrong on the analysis engine.',
      suggestion: 'This is usually temporary. Try again in a moment. If it persists, contact support.',
      retryable: true,
      severity: 'error',
    }
  }

  // 401/403 Unauthorized/Forbidden
  if (error.status === 401 || error.status === 403 || error.code === 'UNAUTHORIZED') {
    return {
      title: 'Access denied',
      message: 'You don\'t have permission to access the analysis engine.',
      suggestion: 'Check that you\'re logged in and have the required permissions.',
      retryable: false,
      severity: 'error',
    }
  }

  // 404 Not Found
  if (error.status === 404 || error.code === 'NOT_FOUND') {
    return {
      title: 'Endpoint not found',
      message: 'The analysis endpoint couldn\'t be found.',
      suggestion: 'The engine may not be deployed yet or the URL is misconfigured.',
      retryable: false,
      severity: 'error',
    }
  }

  // 400 Bad Request - with specific handling for probability errors
  if (error.status === 400 || error.code === 'BAD_INPUT') {
    // Detect probability validation errors and provide actionable message
    const isProbabilityError = messageLower.includes('probabilities sum to') ||
                               messageLower.includes('probability') ||
                               messageLower.includes('outgoing edges')

    if (isProbabilityError) {
      return {
        title: 'Branch probabilities need adjustment',
        message: 'When a decision splits into multiple paths, the likelihood of each path must add up to 100%. Some of your branches don\'t add up correctly yet.',
        suggestion: 'Look for the yellow warning badges on your canvas and click "Fix automatically" to balance the probabilities.',
        retryable: false,
        severity: 'warning',
      }
    }

    return {
      title: 'Invalid request',
      message: normalizedMessage || 'The engine couldn\'t process your graph.',
      suggestion: 'Check that your graph has valid nodes and edges, then try again.',
      retryable: true,
      severity: 'error',
    }
  }

  // Limit exceeded
  if (error.code === 'LIMIT_EXCEEDED') {
    return {
      title: 'Graph too large',
      message: normalizedMessage || 'Your graph exceeds the engine\'s capacity limits.',
      suggestion: 'Reduce the number of nodes or edges and try again.',
      retryable: false,
      severity: 'error',
    }
  }

  // Empty canvas (no nodes to analyse)
  if (error.code === 'EMPTY_CANVAS' || messageLower.includes('empty_canvas')) {
    return {
      title: 'Empty canvas',
      message: 'Add nodes to your decision graph before running analysis.',
      suggestion: 'Start by adding a Goal node, then build out your decision structure.',
      retryable: false,
      severity: 'warning',
    }
  }

  // ISL: Degenerate option with zero variance
  if (error.code === 'DEGENERATE_OPTION_ZERO_VARIANCE' || messageLower.includes('zero variance')) {
    return {
      title: 'Option outcome has no uncertainty',
      message: 'One of your options has a completely deterministic outcome with no variability.',
      suggestion: 'This may indicate missing factors or edges. Review the option and add relevant uncertainty sources.',
      retryable: false,
      severity: 'warning',
    }
  }

  // ISL: High tie rate between options
  if (error.code === 'HIGH_TIE_RATE' || messageLower.includes('tie rate') || messageLower.includes('ties between options')) {
    return {
      title: 'Options are too similar',
      message: 'The analysis found many ties between options, making it difficult to recommend a clear winner.',
      suggestion: 'Add more differentiating factors or adjust factor weights to distinguish between options.',
      retryable: false,
      severity: 'warning',
    }
  }

  // Network offline check - ONLY as fallback when no specific error code is available
  // navigator.onLine is unreliable (VPNs, slow networks), so don't let it mask real errors
  if (!navigator.onLine && !error.code && !error.status) {
    return {
      title: 'No internet connection',
      message: 'You appear to be offline. Please check your network connection.',
      suggestion: 'You can continue editing your graph, but analysis requires an internet connection.',
      retryable: true,
      severity: 'warning',
    }
  }

  // Generic fallback
  return {
    title: 'Analysis failed',
    message: normalizedMessage || 'An unexpected error occurred.',
    suggestion: 'Try again in a moment. If the problem persists, contact support.',
    retryable: true,
    severity: 'error',
  }
}

/**
 * Check if user is offline
 */
export function isOffline(): boolean {
  return !navigator.onLine
}

// =============================================================================
// Debug Panel Error Explanations (Technical)
// =============================================================================

/**
 * Technical error explanations for Debug Panel.
 * These provide developer-focused hints, not user-facing messages.
 */
export interface DebugErrorExplanation {
  label: string
  hint: string
}

export const DEBUG_ERROR_EXPLANATIONS: Record<number | string, DebugErrorExplanation> = {
  400: {
    label: 'Bad Request',
    hint: 'Invalid request structure or missing required fields. Check request payload.',
  },
  401: {
    label: 'Unauthorized',
    hint: 'Authentication failed. Check API key or session token.',
  },
  403: {
    label: 'Forbidden',
    hint: 'Permission denied. Verify user has required access.',
  },
  404: {
    label: 'Not Found',
    hint: 'Endpoint not found. Verify service routing and endpoint path.',
  },
  405: {
    label: 'Method Not Allowed',
    hint: 'HTTP method not supported. Check endpoint documentation.',
  },
  422: {
    label: 'Validation Failed',
    hint: 'Graph validation failed. Check critiques for specific issues.',
  },
  429: {
    label: 'Rate Limited',
    hint: 'Too many requests. Wait before retrying.',
  },
  500: {
    label: 'Server Error',
    hint: 'Internal service error. Check service logs for details.',
  },
  502: {
    label: 'Bad Gateway',
    hint: 'Upstream service unavailable. CEE or ISL may be down.',
  },
  503: {
    label: 'Service Unavailable',
    hint: 'Service temporarily overloaded. Retry in a few seconds.',
  },
  504: {
    label: 'Gateway Timeout',
    hint: 'Request timed out. LLM calls can take up to 120s for complex graphs.',
  },
  0: {
    label: 'Network Error',
    hint: 'Request failed to reach server. Check connectivity and CORS.',
  },
  'Network Error': {
    label: 'Network Error',
    hint: 'Request failed to reach server. Check connectivity and CORS.',
  },
}

/**
 * Get debug error explanation for a status code or error string.
 * Returns label and hint for Debug Panel display.
 */
export function getDebugErrorExplanation(
  status: number | string | null | undefined
): DebugErrorExplanation | null {
  if (status == null) return null
  return DEBUG_ERROR_EXPLANATIONS[status] ?? null
}

/**
 * Listen for online/offline events
 */
export function addConnectivityListener(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
