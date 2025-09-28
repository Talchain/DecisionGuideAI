/**
 * Server URL Configuration and Auto-Detection
 * Implements consistent URL patterns across environments
 */

/**
 * Get the configured server URL based on environment
 */
export function getServerUrl(): string {
  // Explicit override takes precedence
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Environment-based detection
  const env = process.env.NODE_ENV?.toLowerCase();
  const environment = process.env.ENVIRONMENT?.toLowerCase();

  if (env === 'production' || environment === 'production') {
    return 'https://api.decisionguide.ai';
  }

  if (environment === 'staging') {
    return 'https://api-staging.decisionguide.ai';
  }

  // Development default
  const port = process.env.SERVER_PORT || '3001';
  const host = process.env.SERVER_HOST || 'localhost';
  return `http://${host}:${port}`;
}

/**
 * Validate server URL format and security requirements
 */
export function validateServerUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Production environments must use HTTPS
    const env = process.env.NODE_ENV?.toLowerCase();
    if (env === 'production' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Production URLs must use HTTPS'
      };
    }

    // Validate allowed protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        valid: false,
        error: 'Only HTTP and HTTPS protocols are allowed'
      };
    }

    // Validate hostname patterns
    const hostname = parsed.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isDecisionGuide = hostname.endsWith('.decisionguide.ai') || hostname === 'decisionguide.ai';

    if (!isLocalhost && !isDecisionGuide) {
      return {
        valid: false,
        error: 'Hostname must be localhost or decisionguide.ai domain'
      };
    }

    // Validate port ranges for localhost
    if (isLocalhost && parsed.port) {
      const portNum = parseInt(parsed.port);
      if (portNum < 3000 || portNum > 9999) {
        return {
          valid: false,
          error: 'Localhost ports must be between 3000-9999'
        };
      }
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Get server URL with endpoint path
 */
export function getServerEndpoint(path: string): string {
  const baseUrl = getServerUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get current server configuration info
 */
export function getServerConfig() {
  const url = getServerUrl();
  const validation = validateServerUrl(url);

  return {
    url,
    valid: validation.valid,
    error: validation.error,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      ENVIRONMENT: process.env.ENVIRONMENT,
      SERVER_PORT: process.env.SERVER_PORT,
      SERVER_HOST: process.env.SERVER_HOST,
      API_BASE_URL: process.env.API_BASE_URL
    }
  };
}

/**
 * CORS origins based on server URL policy
 */
export function getAllowedOrigins(): string[] {
  const env = process.env.NODE_ENV?.toLowerCase();
  const environment = process.env.ENVIRONMENT?.toLowerCase();

  if (env === 'production' || environment === 'production') {
    return [
      'https://app.decisionguide.ai',
      'https://decisionguide.ai'
    ];
  }

  if (environment === 'staging') {
    return [
      'https://app-staging.decisionguide.ai',
      'https://staging.decisionguide.ai'
    ];
  }

  // Development: Allow localhost variants
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:8080'
  ];
}

/**
 * Environment detection utilities
 */
export const Environment = {
  isDevelopment(): boolean {
    const env = process.env.NODE_ENV?.toLowerCase();
    const environment = process.env.ENVIRONMENT?.toLowerCase();
    return env === 'development' || environment === 'local' || (!env && !environment);
  },

  isStaging(): boolean {
    const environment = process.env.ENVIRONMENT?.toLowerCase();
    return environment === 'staging';
  },

  isProduction(): boolean {
    const env = process.env.NODE_ENV?.toLowerCase();
    const environment = process.env.ENVIRONMENT?.toLowerCase();
    return env === 'production' || environment === 'production';
  },

  getCurrent(): string {
    if (this.isProduction()) return 'production';
    if (this.isStaging()) return 'staging';
    return 'development';
  }
};

/**
 * Security headers based on server URL
 */
export function getSecurityHeaders(origin?: string) {
  const allowedOrigins = getAllowedOrigins();
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : 'null';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Last-Event-ID',
    'Access-Control-Max-Age': '86400'
  };

  // Add security headers for production
  if (Environment.isProduction()) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    headers['X-Frame-Options'] = 'DENY';
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  return headers;
}