// src/lib/errors.ts
// Error taxonomy mapping to British English UI copy

export type ErrorType =
  | 'TIMEOUT'
  | 'RETRYABLE'
  | 'INTERNAL'
  | 'BAD_INPUT'
  | 'RATE_LIMIT'
  | 'BREAKER_OPEN'
  | string

export type ErrorAdvice = {
  message: string
  primaryAction: 'Try again' | 'Check input' | 'Wait and retry'
}

export function mapErrorTypeToAdvice(code?: ErrorType): ErrorAdvice {
  const c = String(code || '').toUpperCase()
  switch (c) {
    case 'TIMEOUT':
      return { message: 'The request took too long to respond.', primaryAction: 'Try again' }
    case 'RETRYABLE':
      return { message: 'A temporary issue occurred.', primaryAction: 'Try again' }
    case 'INTERNAL':
      return { message: 'Something went wrong on our side.', primaryAction: 'Try again' }
    case 'BAD_INPUT':
      return { message: 'Please check your input and try again.', primaryAction: 'Check input' }
    case 'RATE_LIMIT':
      return { message: 'You have reached the limit. Please wait and retry.', primaryAction: 'Wait and retry' }
    case 'BREAKER_OPEN':
      return { message: 'The service is temporarily unavailable. Please wait and retry.', primaryAction: 'Wait and retry' }
    default:
      return { message: 'We could not complete your request.', primaryAction: 'Try again' }
  }
}
