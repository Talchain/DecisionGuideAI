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
  // Network offline
  if (!navigator.onLine) {
    return {
      title: 'No internet connection',
      message: 'You appear to be offline. Please check your network connection.',
      suggestion: 'You can continue editing your graph, but analysis requires an internet connection.',
      retryable: true,
      severity: 'warning',
    }
  }

  const rawMessage = error.message
  const normalizedMessage =
    typeof rawMessage === 'string'
      ? rawMessage
      : rawMessage != null
      ? String(rawMessage)
      : ''
  const messageLower = normalizedMessage.toLowerCase()

  // CORS error (common in dev/staging misconfigurations)
  if (messageLower.includes('cors') || error.status === 0) {
    return {
      title: 'Connection blocked',
      message: 'Unable to reach the analysis engine due to a security policy (CORS).',
      suggestion: 'This usually means the engine URL is misconfigured. Contact support if this persists.',
      retryable: false,
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

  // 400 Bad Request
  if (error.status === 400 || error.code === 'BAD_INPUT') {
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
