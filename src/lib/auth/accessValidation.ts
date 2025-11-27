/**
 * Access Code Validation Module
 *
 * ⚠️ IMPORTANT SECURITY SEMANTICS ⚠️
 *
 * Access codes are UX GATING mechanisms, NOT security boundaries.
 *
 * What this means:
 * - Access codes control UI visibility (e.g., limited beta access, soft paywalls)
 * - The backend API is publicly accessible regardless of access code validation
 * - A determined user can bypass access codes by:
 *   - Setting localStorage flags directly
 *   - Calling the API endpoints directly
 *   - Inspecting network traffic
 *
 * Why this design:
 * - Keeps frontend stateless and CDN-cacheable
 * - Simplifies deployment (no server-side session management)
 * - Appropriate for limited-access/beta programs where friction, not security, is the goal
 *
 * When TRUE security is needed:
 * - Use Supabase authentication (sb-auth-token)
 * - Implement server-side authorization checks
 * - Add Row Level Security (RLS) policies on data
 *
 * This module provides:
 * - Constant-time comparison to prevent timing attacks on code enumeration
 * - 24-hour expiry to encourage re-validation
 * - Cross-tab synchronization via storage events
 * - Hashed storage to obscure codes in localStorage
 *
 * None of these measures make it a security boundary - they only make it
 * a slightly better UX gate by discouraging casual inspection.
 */

import { authLogger } from './authLogger';

// Constants
const ACCESS_CODES = (import.meta.env.VITE_ACCESS_CODES || 'DGAIV01').split(',');
const SALT = import.meta.env.VITE_ACCESS_SALT || 'dga_v1_'; // Fallback for development
export const ACCESS_VALIDATION_KEY = 'dga_access_validated';
export const ACCESS_TIMESTAMP_KEY = 'dga_access_validation_time';
export const ACCESS_CODE_KEY = 'dga_access_code';
const VALIDATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Convert string to array of numbers for constant-time comparison
function stringToBytes(str: string): number[] {
  return Array.from(str).map(char => char.charCodeAt(0));
}

// Constant-time string comparison
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = stringToBytes(SALT + a);
  const bufB = stringToBytes(SALT + b);
  
  if (bufA.length !== bufB.length) return false;
  
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Hash access code for storage
function hashAccessCode(code: string): string {
  return btoa(SALT + code);
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateAccessCode(code: string): ValidationResult {
  try {
    // Input validation
    if (!code) {
      return {
        isValid: false,
        error: 'Please enter an access code'
      };
    }

    if (typeof code !== 'string') {
      return {
        isValid: false,
        error: 'Invalid input type'
      };
    }

    // Check against all valid access codes
    const isValid = ACCESS_CODES.some(validCode => constantTimeEqual(code, validCode));

    if (isValid) {
      // Store validation state and timestamp
      localStorage.setItem(ACCESS_VALIDATION_KEY, 'true');
      localStorage.setItem(ACCESS_TIMESTAMP_KEY, Date.now().toString());
      localStorage.setItem(ACCESS_CODE_KEY, hashAccessCode(code));
      
      // Trigger storage event for cross-tab synchronization
      window.dispatchEvent(new StorageEvent('storage', {
        key: ACCESS_VALIDATION_KEY,
        newValue: 'true'
      }));
    }

    return {
      isValid,
      error: isValid ? undefined : 'Invalid access code'
    };
  } catch (error) {
    console.error('Access validation error:', error);
    return {
      isValid: false,
      error: 'An error occurred during validation'
    };
  }
}

export function checkAccessValidation(): boolean {
  try {
    // If user is authenticated, they don't need access validation
    const hasAuthToken = !!localStorage.getItem('sb-auth-token');
    if (hasAuthToken) {
      return true;
    }

    const isValidated = localStorage.getItem(ACCESS_VALIDATION_KEY) === 'true';
    const timestamp = localStorage.getItem(ACCESS_TIMESTAMP_KEY);
    const accessCode = localStorage.getItem(ACCESS_CODE_KEY);
    
    if (!isValidated) {
      return false;
    }

    if (!timestamp || !accessCode) {
      clearAccessValidation();
      return false;
    }

    const validationAge = Date.now() - parseInt(timestamp);
    if (validationAge > VALIDATION_EXPIRY) {
      clearAccessValidation();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking access validation:', error);
    clearAccessValidation();
    return false;
  }
}

export function clearAccessValidation(): void {
  localStorage.removeItem(ACCESS_VALIDATION_KEY);
  localStorage.removeItem(ACCESS_TIMESTAMP_KEY);
  localStorage.removeItem(ACCESS_CODE_KEY);
}