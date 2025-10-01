// src/lib/errorTaxonomy.ts
export type ErrorType = 'TIMEOUT' | 'RETRYABLE' | 'INTERNAL' | 'BAD_INPUT' | 'RATE_LIMIT' | 'BREAKER_OPEN'

export function mapErrorType(t: ErrorType): { label: string; message: string; suggestion: string } {
  switch (t) {
    case 'TIMEOUT':
      return { label: 'Timeout', message: 'The request took too long to respond.', suggestion: 'Try again.' }
    case 'RETRYABLE':
      return { label: 'Temporary issue', message: 'A temporary network issue occurred.', suggestion: 'Try again.' }
    case 'BAD_INPUT':
      return { label: 'Check input', message: 'There is a problem with the input.', suggestion: 'Check input.' }
    case 'RATE_LIMIT':
      return { label: 'Rate limited', message: 'You have reached the rate limit.', suggestion: 'Wait a moment and try again.' }
    case 'BREAKER_OPEN':
      return { label: 'Service busy', message: 'The service is temporarily unavailable.', suggestion: 'Try again later.' }
    case 'INTERNAL':
    default:
      return { label: 'Error', message: 'Something went wrong.', suggestion: 'Try again.' }
  }
}
