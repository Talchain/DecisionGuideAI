/**
 * CORS Origin Doctor
 * Diagnostic tool to help teams understand CORS configuration and troubleshoot browser connection issues
 */

/**
 * Parse CORS configuration from environment
 */
function getCORSConfig() {
  // Read CORS configuration from environment variables
  const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
  const defaultOrigins = 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173';

  const allowedOrigins = (corsOriginsEnv !== undefined ? corsOriginsEnv : defaultOrigins)
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  return {
    allowedOrigins,
    allowCredentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
    allowedMethods: (process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,DELETE,OPTIONS')
      .split(',')
      .map(method => method.trim()),
    allowedHeaders: (process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-Correlation-ID')
      .split(',')
      .map(header => header.trim()),
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400')
  };
}

/**
 * Check if an origin is allowed by current CORS configuration
 */
function isOriginAllowed(origin: string, config: ReturnType<typeof getCORSConfig>): boolean {
  if (!origin) return false;

  // Check exact matches
  if (config.allowedOrigins.includes(origin)) return true;

  // Check wildcard patterns
  return config.allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin === '*') return true;

    // Convert simple wildcard patterns to regex
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }

    return false;
  });
}

/**
 * Generate human-readable explanation for CORS status
 */
function generateCORSExplanation(origin: string, allowed: boolean, config: ReturnType<typeof getCORSConfig>): string {
  if (!origin) {
    return 'No origin provided. This typically happens with file:// URLs or direct server requests.';
  }

  if (allowed) {
    return `✅ Origin "${origin}" is allowed by current CORS configuration.`;
  }

  const explanations = [
    `❌ Origin "${origin}" is not in the allowed origins list.`,
    `Current allowed origins: ${config.allowedOrigins.join(', ')}`,
  ];

  // Provide helpful suggestions
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    explanations.push('💡 For local development, ensure your port is included in CORS_ALLOWED_ORIGINS.');
  } else if (origin.startsWith('https://')) {
    explanations.push('💡 For production domains, add your domain to CORS_ALLOWED_ORIGINS environment variable.');
  } else if (origin.startsWith('file://')) {
    explanations.push('💡 File:// origins cannot be whitelisted for security reasons. Use a local server instead.');
  }

  return explanations.join(' ');
}

/**
 * Get required headers for a successful CORS request
 */
function getRequiredHeaders(origin: string, config: ReturnType<typeof getCORSConfig>): Record<string, string> {
  const headers: Record<string, string> = {};

  if (isOriginAllowed(origin, config)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  return headers;
}

/**
 * Handle GET /_tools/origin-check request
 */
export async function handleOriginCheckRequest(
  query: any = {},
  headers: Record<string, any> = {}
): Promise<any> {
  try {
    // Get origin from query parameter or request headers
    const origin = query.origin || headers.origin || headers.Origin || '';
    const corsConfig = getCORSConfig();
    const allowed = isOriginAllowed(origin, corsConfig);

    const explanation = generateCORSExplanation(origin, allowed, corsConfig);
    const requiredHeaders = getRequiredHeaders(origin, corsConfig);

    const response = {
      origin,
      allowed,
      explanation,
      cors_config: {
        allowed_origins: corsConfig.allowedOrigins,
        allow_credentials: corsConfig.allowCredentials,
        allowed_methods: corsConfig.allowedMethods,
        allowed_headers: corsConfig.allowedHeaders,
        max_age: corsConfig.maxAge
      },
      required_headers: requiredHeaders,
      troubleshooting: {
        common_issues: [
          'Origin not in CORS_ALLOWED_ORIGINS environment variable',
          'Protocol mismatch (http vs https)',
          'Port number not included in origin whitelist',
          'Subdomain not explicitly allowed (wildcard needed)'
        ],
        next_steps: allowed ? [
          'Your origin is allowed - CORS should work',
          'If still having issues, check for preflight request problems',
          'Verify your request includes required headers'
        ] : [
          'Add your origin to CORS_ALLOWED_ORIGINS environment variable',
          'Restart the server after updating CORS configuration',
          'Use the static helper page for interactive testing'
        ]
      },
      timestamp: new Date().toISOString()
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        // Apply CORS headers to this response
        ...requiredHeaders
      },
      body: response
    };

  } catch (error) {
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        error: true,
        message: 'Failed to check origin',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get CORS doctor status for debugging
 */
export function getCORSDoctorStatus(): any {
  const config = getCORSConfig();

  return {
    enabled: true,
    endpoint: '/_tools/origin-check',
    cors_config: config,
    example_usage: {
      curl: 'curl "http://localhost:3000/_tools/origin-check?origin=http://localhost:5173"',
      javascript: 'fetch("/_tools/origin-check?origin=" + encodeURIComponent(window.location.origin))'
    },
    static_helper: '/artifacts/public/origin-check.html'
  };
}