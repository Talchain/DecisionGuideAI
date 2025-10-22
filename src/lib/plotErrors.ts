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
      if (error.field && error.max) {
        return `This template exceeds the limit (${error.field}, max ${error.max}). Reduce ${error.field} below ${error.max} and try again.`
      }
      return 'This template exceeds a limit.'
    
    case 'RATE_LIMITED': {
      const retryAfter = Math.min(error.retry_after || 30, 60)
      return `A bit busy. Try again in ~${retryAfter}s.`
    }
    
    case 'UNAUTHORIZED':
      return 'Sign in again to continue.'
    
    case 'SERVER_ERROR':
    default:
      return 'Something went wrong. Please try again.'
  }
}
