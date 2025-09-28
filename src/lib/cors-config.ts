/**
 * CORS Configuration with Allow-list
 * Default: CLOSED (no cross-origin access)
 * Configure via WIND_SURF_DEV_ORIGIN environment variable
 */

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  credentials: boolean;
}

/**
 * Get CORS configuration from environment
 * Default posture: CLOSED (no origins allowed)
 */
export function getCorsConfig(): CorsConfig {
  // Read allowed origins from environment
  const windSurfOrigin = process.env.WIND_SURF_DEV_ORIGIN;

  // Default: CLOSED (empty allow-list)
  let allowedOrigins: string[] = [];

  if (windSurfOrigin) {
    // Parse comma-separated origins
    allowedOrigins = windSurfOrigin
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  }

  // In development mode only, optionally allow localhost
  if (process.env.NODE_ENV === 'development' && process.env.CORS_ALLOW_LOCALHOST === 'true') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');
  }

  return {
    allowedOrigins,
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Last-Event-ID', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
    credentials: false // No credentials by default
  };
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean {
  if (!origin) {
    // No origin header (same-origin request) - always allowed
    return true;
  }

  if (config.allowedOrigins.length === 0) {
    // CLOSED posture - no cross-origin allowed
    return false;
  }

  // Check exact match or wildcard
  return config.allowedOrigins.some(allowed => {
    if (allowed === '*') {
      // Wildcard (not recommended for production)
      return true;
    }
    if (allowed === origin) {
      // Exact match
      return true;
    }
    // Pattern matching (e.g., https://*.example.com)
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return false;
  });
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  req: any,
  res: any,
  config: CorsConfig = getCorsConfig()
): void {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin, config)) {
    // Origin is allowed
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
  } else if (origin) {
    // Origin not allowed - no CORS headers
    // This will cause browser to block the request
    console.warn(`CORS blocked origin: ${origin}`);
  }
}

/**
 * Express/Connect middleware for CORS
 */
export function corsMiddleware(config?: CorsConfig) {
  const corsConfig = config || getCorsConfig();

  return (req: any, res: any, next: any) => {
    applyCorsHeaders(req, res, corsConfig);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    next();
  };
}

/**
 * Log CORS configuration (for debugging)
 */
export function logCorsConfig(): void {
  const config = getCorsConfig();
  console.log('CORS Configuration:');
  console.log(`  Allowed Origins: ${config.allowedOrigins.length > 0 ? config.allowedOrigins.join(', ') : 'NONE (CLOSED)'}`);
  console.log(`  Allowed Methods: ${config.allowedMethods.join(', ')}`);
  console.log(`  Allowed Headers: ${config.allowedHeaders.join(', ')}`);
  console.log(`  Credentials: ${config.credentials}`);
  console.log(`  Max Age: ${config.maxAge}s`);
}