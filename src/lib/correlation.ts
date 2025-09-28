/**
 * Correlation IDs & Traceability
 * UUIDv4 correlation IDs for request tracing across all endpoints
 */

import { randomUUID } from 'crypto';

export interface CorrelationContext {
  correlationId: string;
  timestamp: string;
  endpoint: string;
  org?: string;
}

// In-memory storage for correlation contexts
const correlationStore = new Map<string, CorrelationContext>();

/**
 * Generate a new UUIDv4 correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Create correlation context for a request
 */
export function createCorrelationContext(
  endpoint: string,
  org?: string
): CorrelationContext {
  const correlationId = generateCorrelationId();
  const context: CorrelationContext = {
    correlationId,
    timestamp: new Date().toISOString(),
    endpoint,
    org
  };

  // Store context for later retrieval
  correlationStore.set(correlationId, context);

  return context;
}

/**
 * Get correlation context by ID
 */
export function getCorrelationContext(correlationId: string): CorrelationContext | null {
  return correlationStore.get(correlationId) || null;
}

/**
 * Add correlation ID headers to response
 * Uses X-Olumi-Correlation-Id as canonical header with X-Correlation-ID for compatibility
 */
export function addCorrelationHeader(
  headers: Record<string, any>,
  correlationId: string
): Record<string, any> {
  return {
    ...headers,
    'X-Olumi-Correlation-Id': correlationId,
    'X-Correlation-ID': correlationId // Compatibility header, planned for removal
  };
}

/**
 * Extract correlation ID from existing headers (if forwarded)
 * Prefers X-Olumi-Correlation-Id but falls back to X-Correlation-ID for compatibility
 */
export function extractCorrelationId(headers: Record<string, any>): string | null {
  return headers['x-olumi-correlation-id'] ||
         headers['X-Olumi-Correlation-Id'] ||
         headers['x-correlation-id'] ||
         headers['X-Correlation-ID'] ||
         null;
}

/**
 * Get or create correlation ID for request
 */
export function ensureCorrelationId(
  headers: Record<string, any>,
  endpoint: string,
  org?: string
): string {
  // Try to extract existing correlation ID
  let correlationId = extractCorrelationId(headers);

  if (!correlationId) {
    // Create new correlation context
    const context = createCorrelationContext(endpoint, org);
    correlationId = context.correlationId;
  } else {
    // Store context for existing correlation ID
    const context: CorrelationContext = {
      correlationId,
      timestamp: new Date().toISOString(),
      endpoint,
      org
    };
    correlationStore.set(correlationId, context);
  }

  return correlationId;
}

/**
 * Create provenance info with correlation ID
 */
export function createProvenanceInfo(correlationId: string): any {
  const context = getCorrelationContext(correlationId);

  return {
    correlation_id: correlationId,
    commit_sha: generateMockCommitSHA(),
    version: 'v0.1.0-pilot',
    timestamp: new Date().toISOString(),
    engine: 'scenario-sandbox-poc',
    endpoint: context?.endpoint || 'unknown',
    org: context?.org || null
  };
}

/**
 * Generate mock commit SHA for provenance
 */
function generateMockCommitSHA(): string {
  // Mock commit SHA for PoC - in production would be actual Git commit
  return Math.random().toString(16).substring(2, 10);
}

/**
 * Get correlation statistics for debugging
 */
export function getCorrelationStatistics(): any {
  const now = Date.now();
  const stats = {
    total_correlations: correlationStore.size,
    endpoints: {} as Record<string, number>,
    orgs: {} as Record<string, number>,
    recent_correlations: 0
  };

  // Analyze stored correlations
  for (const context of correlationStore.values()) {
    // Count by endpoint
    stats.endpoints[context.endpoint] = (stats.endpoints[context.endpoint] || 0) + 1;

    // Count by org
    if (context.org) {
      stats.orgs[context.org] = (stats.orgs[context.org] || 0) + 1;
    }

    // Count recent (last hour)
    const contextTime = new Date(context.timestamp).getTime();
    if (now - contextTime < 3600000) {
      stats.recent_correlations++;
    }
  }

  return stats;
}

/**
 * Clean up old correlation contexts (retain for 24 hours)
 */
export function cleanupOldCorrelations(): number {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let cleaned = 0;

  for (const [correlationId, context] of correlationStore.entries()) {
    const contextTime = new Date(context.timestamp).getTime();
    if (now - contextTime > maxAge) {
      correlationStore.delete(correlationId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Format correlation ID for logging (truncated for readability)
 */
export function formatCorrelationId(correlationId: string): string {
  return correlationId.substring(0, 8);
}

/**
 * Validate correlation ID format (UUIDv4)
 */
export function isValidCorrelationId(correlationId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(correlationId);
}

// Clean up old correlations every hour
setInterval(cleanupOldCorrelations, 3600000);