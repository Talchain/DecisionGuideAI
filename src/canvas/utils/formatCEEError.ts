import { CEEError } from '../../adapters/cee/client'

export interface FormattedCEEError {
  title?: string
  message: string
  debugInfo?: string
  isUnavailable?: boolean
  isTimeout?: boolean
  isGraphInvalid?: boolean
  isValidationFailed?: boolean
  guidance?: string
}

/** Check if error indicates CEE service is unavailable */
export function isCEEUnavailable(error: CEEError | Error): boolean {
  if (error instanceof CEEError) {
    // HTTP 404 (not found) or 503 (service unavailable)
    return error.status === 404 || error.status === 503
  }
  // Network-level failures (no HTTP status) - treat as service unavailable
  // These typically indicate the service is not reachable at all
  const message = error.message?.toLowerCase() ?? ''
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connection refused') ||
    message.includes('dns') ||
    message.includes('econnrefused')
  ) {
    return true
  }
  return false
}

/** Format CEE error for user-friendly display + debug info.
 *
 * Classification:
 *   1. Unavailable (404/503/network) — service not reachable
 *   2. Timeout (408/504) — request took too long
 *   3. Validation failed (CEE_VALIDATION_FAILED) — brief or input rejected by CEE
 *   4. Graph invalid (CEE_GRAPH_INVALID) — draft generated but failed structural validation
 *   5. Empty (empty_draft/empty_graph) — CEE returned no graph data
 *   6. Generic fallback
 */
export function formatCEEError(error: CEEError | Error): FormattedCEEError {
  if (error instanceof CEEError) {
    const debugParts = [`Message: ${error.message}`, `Status: ${error.status}`]
    if (error.correlationId) {
      debugParts.push(`Correlation ID: ${error.correlationId}`)
    }
    if (error.details) {
      try {
        const detailsString = typeof error.details === 'string'
          ? error.details
          : JSON.stringify(error.details, null, 2)
        debugParts.push(`Details: ${detailsString}`)
      } catch {
        // Ignore JSON stringify failures
      }
    }

    const debugInfo = debugParts.join('\n')

    // Check if service is unavailable (404/503)
    if (isCEEUnavailable(error)) {
      return {
        message: 'AI drafting is temporarily unavailable.',
        isUnavailable: true,
        debugInfo,
      }
    }

    // Map well-known backend error codes / messages to friendlier text
    const friendlyMessages: Record<string, string> = {
      'openai_response_invalid_schema': 'The AI service returned an unexpected response format. This is a temporary backend issue.',
      'Too Many Requests': 'Too many requests. Please wait a moment and try again.',
    }

    const rawDetails = error.details as any
    const reason = rawDetails?.reason ?? rawDetails?.details?.reason
    const code = rawDetails?.code ?? rawDetails?.details?.code

    // Detect timeout errors (client-side 408, gateway 504, or message match)
    if (error.message === 'Request timeout' || error.status === 408 || error.status === 504) {
      return {
        title: 'This brief is taking longer than expected',
        message: 'Complex briefs with many factors and options can take longer to model. You can:',
        guidance: 'To speed things up, try focusing on your top 3\u20135 factors and 2\u20133 options. You can always add more detail later.',
        isTimeout: true,
        debugInfo,
      }
    }

    // CEE validation failed — brief too short, schema validation, etc.
    if (code === 'CEE_VALIDATION_FAILED') {
      const rawFieldErrors =
        rawDetails?.fieldErrors ??
        rawDetails?.field_errors ??
        rawDetails?.details?.fieldErrors

      let hasBriefTooSmall = false
      if (Array.isArray(rawFieldErrors)) {
        for (const fe of rawFieldErrors) {
          if (fe && typeof fe === 'object' && fe.field === 'brief' && fe.code === 'too_small') {
            hasBriefTooSmall = true
          }
        }
      }

      return {
        title: hasBriefTooSmall
          ? 'Your brief needs a bit more detail'
          : 'Something about your input didn\u2019t look right',
        message: hasBriefTooSmall
          ? 'Add more context about your decision \u2014 what you\u2019re deciding, your key options, and what a good outcome looks like.'
          : 'Try rephrasing your decision description or adding more detail about what you\u2019re trying to decide.',
        guidance: 'A good brief includes a clear goal or KPI, 2\u20133 specific options, and the key factors that matter most.',
        isValidationFailed: true,
        debugInfo,
      }
    }

    // Graph invalid — draft was generated but failed structural validation/repair
    if (code === 'CEE_GRAPH_INVALID' && reason !== 'empty_draft' && reason !== 'empty_graph') {
      return {
        title: "We couldn\u2019t build a valid model from this brief",
        message: 'We generated a draft, but it had structural issues that couldn\u2019t be auto-repaired. This can happen with very short or ambiguous briefs.',
        guidance: 'To improve results, try adding a clear goal or KPI, 2\u20133 specific options, and the key factors you think matter.',
        isGraphInvalid: true,
        debugInfo,
      }
    }

    // Truly empty — CEE returned no graph data
    if (reason === 'empty_draft' || reason === 'empty_graph') {
      return {
        title: 'Empty draft',
        message: 'The AI assistant returned an empty draft for this description. Try adding more concrete context, factors, and relationships, then try again.',
        debugInfo,
      }
    }

    const message = friendlyMessages[error.message] || error.message

    return {
      message,
      debugInfo,
    }
  }

  // Check if non-CEEError is a network failure (treat as unavailable)
  if (isCEEUnavailable(error)) {
    return {
      message: 'AI drafting is temporarily unavailable.',
      isUnavailable: true,
    }
  }

  return { message: error.message }
}
