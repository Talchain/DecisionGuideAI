import { AuthError } from '@supabase/supabase-js';
import { clearAccessValidation } from './accessValidation';
import { authLogger } from './authLogger';

function parseAuthError(error: AuthError | Error | unknown): string {
  if (!error) return 'An unknown error occurred';

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  // Network related errors
  if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
    return 'Unable to connect to the authentication service. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('Load failed')) {
    return 'The request timed out. Please try again.';
  }

  // Token refresh errors
  if (errorMessage.includes('refresh_token_not_found') || errorMessage.includes('Invalid Refresh Token')) {
    return 'Your session has expired. Please sign in again.';
  }

  // Common Supabase auth error patterns
  if (errorMessage.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (errorMessage.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.';
  }
  if (errorMessage.includes('Too many requests')) {
    return 'Too many sign in attempts. Please wait a few minutes before trying again.';
  }
  if (errorMessage.includes('User not found')) {
    return 'No account found with this email. Please sign up first.';
  }
  if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (errorMessage.includes('password')) {
    return 'Password must be at least 6 characters long';
  }

  // Handle 401 errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    return 'Your session has expired or is invalid. Please sign in again.';
  }

  return 'An unexpected error occurred. Please try again later.';
}

export function validateAuthInputs(email: string, password: string): string | null {
  if (!email.trim() || !password.trim()) {
    return 'Please enter both email and password';
  }

  if (!email.includes('@') || !email.includes('.')) {
    return 'Please enter a valid email address';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }

  return null;
}

// Clear all auth-related states
export async function clearAuthStates(): Promise<void> {
    console.debug('[authUtils] clearAuthStates() called', new Error().stack);
  // Clear early access validation state
  clearAccessValidation();
  
  try {
    // Clear all auth-related localStorage items
    const authKeys = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase.auth.token',
      'sb-auth-token',
      'sb-localhost-auth-token',
      'supabase.auth.token.localhost',
      'dga_access_validated',
      'dga_access_validation_time',
      'dga_access_code',
      'dga_session_state',
      'registered_email'
    ];

    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage:`, e);
      }
    });

    // Also clear any Supabase-specific keys that might exist
    try {
      const allKeys = Object.keys(localStorage);
      const supabaseKeys = allKeys.filter(key => 
        key.startsWith('sb-') || 
        key.includes('supabase') ||
        key.includes('auth')
      );
      
      supabaseKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove Supabase key ${key}:`, e);
        }
      });
    } catch (e) {
      console.warn('Failed to clear additional Supabase keys:', e);
    }
  
    // Dispatch storage event for cross-tab synchronization
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth_state_cleared',
        newValue: 'true'
      }));
    } catch (e) {
      console.warn('Failed to dispatch storage event:', e);
    }

    authLogger.debug('AUTH', 'Auth states cleared successfully');
  } catch (error) {
    authLogger.error('ERROR', 'Failed to clear auth states', error);
    throw error;
  }
}

// Cache auth tokens with expiration
function cacheAuthToken(token: string, expiresIn: number): void {
  try {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem('auth_token_expires_at', expiresAt.toString());
    localStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Failed to cache auth token:', error);
  }
}

// Check if cached token is valid
function isTokenValid(): boolean {
  try {
    const expiresAt = localStorage.getItem('auth_token_expires_at');
    if (!expiresAt) return false;
    
    return Date.now() < parseInt(expiresAt);
  } catch (error) {
    console.error('Failed to check token validity:', error);
    return false;
  }
}