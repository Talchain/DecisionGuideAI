/**
 * PLoT API Error Mapping - Friendly UX
 */
import type { ApiError } from './plotApi'

export function formatApiError(error: ApiError): string {
  switch (error.code) {
    case 'BAD_INPUT':
      return error.field 
        ? `Looks like ${error.field} is invalid or missing.`
        : 'Some input is invalid or missing.'
    
    case 'LIMIT_EXCEEDED':
      return error.field && error.max
        ? `This template exceeds the limit (${error.field}, max ${error.max}).`
        : 'This template exceeds a limit.'
    
    case 'RATE_LIMITED':
      return error.retry_after
        ? `A bit busy. Try again in ~${error.retry_after}s.`
        : 'A bit busy. Try again soon.'
    
    case 'UNAUTHORIZED':
      return 'Sign in again to continue.'
    
    case 'SERVER_ERROR':
    default:
      return 'Something went wrong. Please try again.'
  }
}
