/**
 * Usage Summary
 * Read-only usage metrics and CSV export (no PII)
 */

import { enforceTenantSession } from './tenant-sessions.js';

export interface UsageSummaryResponse {
  schema: 'usage-summary.v1';
  org: string;
  window: string;
  runs: number;
  median_ttff_ms: number;
  median_cancel_ms: number;
  rate_limit_hits: number;
  tokens_estimated: number;
}

export interface UsageMetrics {
  runs: number[];
  ttff_times: number[];
  cancel_times: number[];
  rate_limit_hits: number;
  tokens_used: number;
  timestamps: number[];
}

// In-memory usage data per org
const usageData = new Map<string, UsageMetrics>();

/**
 * Initialize usage metrics for org
 */
function initializeUsageMetrics(org: string): UsageMetrics {
  return {
    runs: [],
    ttff_times: [],
    cancel_times: [],
    rate_limit_hits: 0,
    tokens_used: 0,
    timestamps: []
  };
}

/**
 * Get usage metrics for org
 */
function getUsageMetrics(org: string): UsageMetrics {
  if (!usageData.has(org)) {
    usageData.set(org, initializeUsageMetrics(org));
  }
  return usageData.get(org)!;
}

/**
 * Record run completion
 */
export function recordRunCompletion(
  org: string,
  ttff_ms: number,
  cancel_ms?: number,
  tokens_estimated: number = 0
): void {
  const metrics = getUsageMetrics(org);
  const timestamp = Date.now();

  metrics.runs.push(timestamp);
  metrics.ttff_times.push(ttff_ms);
  metrics.timestamps.push(timestamp);
  metrics.tokens_used += tokens_estimated;

  if (cancel_ms !== undefined && cancel_ms > 0) {
    metrics.cancel_times.push(cancel_ms);
  }
}

/**
 * Record rate limit hit
 */
export function recordRateLimitHit(org: string): void {
  const metrics = getUsageMetrics(org);
  metrics.rate_limit_hits++;
}

/**
 * Calculate median of array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  } else {
    return sorted[mid];
  }
}

/**
 * Filter metrics by time window
 */
function filterByTimeWindow(
  metrics: UsageMetrics,
  windowMs: number
): UsageMetrics {
  const cutoff = Date.now() - windowMs;

  // Filter runs by timestamp
  const recentIndices = metrics.timestamps
    .map((timestamp, index) => ({ timestamp, index }))
    .filter(({ timestamp }) => timestamp >= cutoff)
    .map(({ index }) => index);

  return {
    runs: recentIndices.map(i => metrics.runs[i]),
    ttff_times: recentIndices.map(i => metrics.ttff_times[i]),
    cancel_times: metrics.cancel_times.filter((_, index) => {
      // Approximate filter for cancel times (they don't have individual timestamps)
      return index < recentIndices.length;
    }),
    rate_limit_hits: metrics.rate_limit_hits, // Note: not time-filtered in this simple implementation
    tokens_used: metrics.tokens_used, // Note: not time-filtered in this simple implementation
    timestamps: recentIndices.map(i => metrics.timestamps[i])
  };
}

/**
 * Parse time period string to milliseconds
 */
function parsePeriod(period: string): { windowMs: number; windowLabel: string } {
  const match = period.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error('Invalid period format. Use format like "7d", "24h", "60m"');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  let windowMs: number;
  let windowLabel: string;

  switch (unit) {
    case 'd':
      windowMs = value * 24 * 60 * 60 * 1000;
      windowLabel = `last_${value}d`;
      break;
    case 'h':
      windowMs = value * 60 * 60 * 1000;
      windowLabel = `last_${value}h`;
      break;
    case 'm':
      windowMs = value * 60 * 1000;
      windowLabel = `last_${value}m`;
      break;
    default:
      throw new Error('Invalid period unit. Use d (days), h (hours), or m (minutes)');
  }

  return { windowMs, windowLabel };
}

/**
 * Generate usage summary for org and period
 */
export function generateUsageSummary(org: string, period: string): UsageSummaryResponse {
  const { windowMs, windowLabel } = parsePeriod(period);
  const allMetrics = getUsageMetrics(org);
  const filteredMetrics = filterByTimeWindow(allMetrics, windowMs);

  return {
    schema: 'usage-summary.v1',
    org,
    window: windowLabel,
    runs: filteredMetrics.runs.length,
    median_ttff_ms: calculateMedian(filteredMetrics.ttff_times),
    median_cancel_ms: calculateMedian(filteredMetrics.cancel_times),
    rate_limit_hits: filteredMetrics.rate_limit_hits,
    tokens_estimated: filteredMetrics.tokens_used
  };
}

/**
 * Validate usage summary request
 */
function validateUsageSummaryRequest(query: any): any {
  const { org, period } = query;

  if (!org || typeof org !== 'string') {
    return {
      type: 'BAD_INPUT',
      message: 'org parameter required',
      timestamp: new Date().toISOString()
    };
  }

  if (!period || typeof period !== 'string') {
    return {
      type: 'BAD_INPUT',
      message: 'period parameter required (e.g., "7d", "24h", "60m")',
      timestamp: new Date().toISOString()
    };
  }

  try {
    parsePeriod(period);
  } catch (error) {
    return {
      type: 'BAD_INPUT',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    };
  }

  return null; // Valid
}

/**
 * Handle GET /usage/summary request
 */
export async function handleUsageSummaryRequest(query: any, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers, query.org);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Validate request
  const validation = validateUsageSummaryRequest(query);
  if (validation) {
    return { status: 400, body: validation };
  }

  const { org, period } = query;

  try {
    const summary = generateUsageSummary(org, period);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: summary
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate usage summary',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Generate CSV content for usage summary
 */
function generateUsageCsv(summary: UsageSummaryResponse): string {
  const rows = [];

  // Header
  rows.push([
    'org',
    'window',
    'runs',
    'median_ttff_ms',
    'median_cancel_ms',
    'rate_limit_hits',
    'tokens_estimated',
    'generated_at',
    'version'
  ].join(','));

  // Data row
  rows.push([
    escapeCsvField(summary.org),
    escapeCsvField(summary.window),
    summary.runs,
    summary.median_ttff_ms,
    summary.median_cancel_ms,
    summary.rate_limit_hits,
    summary.tokens_estimated,
    escapeCsvField(new Date().toISOString()),
    escapeCsvField('v0.1.0')
  ].join(','));

  return rows.join('\n');
}

/**
 * Escape CSV field value
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV filename
 */
function generateCsvFilename(org: string, period: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `usage_${org}_${period}_v0.1.0_${date}.csv`;
}

/**
 * Handle GET /export/usage.csv request
 */
export async function handleUsageCsvRequest(query: any, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers, query.org);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Validate request (same as summary)
  const validation = validateUsageSummaryRequest(query);
  if (validation) {
    return { status: 400, body: validation };
  }

  const { org, period } = query;

  try {
    const summary = generateUsageSummary(org, period);
    const csv = generateUsageCsv(summary);
    const filename = generateCsvFilename(org, period);

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate usage CSV',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Reset all usage data (for testing)
 */
export function resetUsageData(): void {
  usageData.clear();
}

/**
 * Get usage statistics for debugging
 */
export function getUsageStatistics(): any {
  const stats = {
    total_orgs: usageData.size,
    orgs_with_data: Array.from(usageData.keys()),
    total_runs_across_orgs: 0,
    total_tokens_across_orgs: 0,
    total_rate_limit_hits: 0
  };

  for (const metrics of usageData.values()) {
    stats.total_runs_across_orgs += metrics.runs.length;
    stats.total_tokens_across_orgs += metrics.tokens_used;
    stats.total_rate_limit_hits += metrics.rate_limit_hits;
  }

  return stats;
}

/**
 * Clean up old usage data (retain for 30 days)
 */
export function cleanupOldUsageData(): number {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
  let totalCleaned = 0;

  for (const [org, metrics] of usageData.entries()) {
    const initialCount = metrics.runs.length;

    // Filter out old entries
    const recentIndices = metrics.timestamps
      .map((timestamp, index) => ({ timestamp, index }))
      .filter(({ timestamp }) => timestamp >= cutoff)
      .map(({ index }) => index);

    if (recentIndices.length < initialCount) {
      // Update metrics with recent data only
      metrics.runs = recentIndices.map(i => metrics.runs[i]);
      metrics.ttff_times = recentIndices.map(i => metrics.ttff_times[i]);
      metrics.timestamps = recentIndices.map(i => metrics.timestamps[i]);

      // Approximate cleanup for cancel times
      metrics.cancel_times = metrics.cancel_times.slice(0, recentIndices.length);

      totalCleaned += (initialCount - recentIndices.length);
    }

    // Remove org entry if no data left
    if (metrics.runs.length === 0) {
      usageData.delete(org);
    }
  }

  return totalCleaned;
}

// Clean up old usage data daily
setInterval(() => {
  const cleaned = cleanupOldUsageData();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old usage records`);
  }
}, 24 * 60 * 60 * 1000); // 24 hours