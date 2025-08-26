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
  console.log('Validating access code...');
  
  try {
    // Input validation
    if (!code) {
      console.log('No access code provided');
      return {
        isValid: false,
        error: 'Please enter an access code'
      };
    }

    if (typeof code !== 'string') {
      console.log('Invalid input type:', typeof code);
      return {
        isValid: false,
        error: 'Invalid input type'
      };
    }

    console.log('Available access codes:', ACCESS_CODES);
    console.log('Validating code:', code);
    
    // Check against all valid access codes
    const isValid = ACCESS_CODES.some((validCode: string) => {
      const isMatch = constantTimeEqual(code, validCode);
      console.log(`Comparing with '${validCode}':`, isMatch);
      return isMatch;
    });

    console.log('Access code validation result:', isValid);

    if (isValid) {
      const timestamp = Date.now();
      console.log('Storing validation state with timestamp:', new Date(timestamp).toISOString());
      
      // Store validation state and timestamp
      localStorage.setItem(ACCESS_VALIDATION_KEY, 'true');
      localStorage.setItem(ACCESS_TIMESTAMP_KEY, timestamp.toString());
      localStorage.setItem(ACCESS_CODE_KEY, hashAccessCode(code));
      
      // Log the stored values for verification
      console.log('Stored values:', {
        [ACCESS_VALIDATION_KEY]: localStorage.getItem(ACCESS_VALIDATION_KEY),
        [ACCESS_TIMESTAMP_KEY]: localStorage.getItem(ACCESS_TIMESTAMP_KEY),
        [ACCESS_CODE_KEY]: '***' // Don't log the actual access code hash
      });
      
      // Trigger storage event for cross-tab synchronization
      const storageEvent = new StorageEvent('storage', {
        key: ACCESS_VALIDATION_KEY,
        newValue: 'true',
        oldValue: null,
        storageArea: localStorage,
        url: window.location.href
      });
      
      window.dispatchEvent(storageEvent);
      console.log('Storage event dispatched');
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
    console.log('Checking access validation...');
    
    // If user is authenticated, they don't need access validation
    const hasAuthToken = !!localStorage.getItem('sb-auth-token');
    console.log('Has auth token:', hasAuthToken);
    
    if (hasAuthToken) {
      console.log('User is authenticated, access granted');
      return true;
    }

    const isValidated = localStorage.getItem(ACCESS_VALIDATION_KEY) === 'true';
    const timestamp = localStorage.getItem(ACCESS_TIMESTAMP_KEY);
    const accessCode = localStorage.getItem(ACCESS_CODE_KEY);
    
    console.log('Access validation state:', {
      isValidated,
      hasTimestamp: !!timestamp,
      hasAccessCode: !!accessCode
    });
    
    if (!isValidated) {
      console.log('Access not validated');
      return false;
    }

    if (!timestamp || !accessCode) {
      console.log('Missing timestamp or access code');
      clearAccessValidation();
      return false;
    }

    const validationAge = Date.now() - parseInt(timestamp);
    const isExpired = validationAge > VALIDATION_EXPIRY;
    
    console.log('Validation age (ms):', validationAge, 'Expired:', isExpired);
    
    if (isExpired) {
      console.log('Access validation expired');
      clearAccessValidation();
      return false;
    }

    console.log('Access validation successful');
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