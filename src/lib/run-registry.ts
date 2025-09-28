/**
 * Deterministic Run Registry + Replay Lookup
 * Caches scenario executions to speed demos and prove reproducibility
 */

import { createHash } from 'crypto';
import { ensureCorrelationId, addCorrelationHeader } from './correlation.js';
import { enforceTenantSession } from './tenant-sessions.js';

export interface RegistryEntry {
  runId: string;
  scenarioId: string;
  seed: number;
  engineCodeHash: string;
  timestamp: number; // Unix timestamp for TTL
  sseEvents: any[];
  report: any;
}

export interface LookupResult {
  runId: string;
  source: 'cache' | 'new';
}

// In-memory registry for PoC - resets on restart
const runRegistry = new Map<string, RegistryEntry>();

// Environment configuration
const RUN_REGISTRY_TTL_MIN = parseInt(process.env.RUN_REGISTRY_TTL_MIN || '60');

/**
 * Generate engine code hash for cache key
 * In production, this would be actual Git commit SHA + engine version
 */
function generateEngineCodeHash(): string {
  // Mock hash based on version and timestamp
  // In production: git rev-parse HEAD + engine version
  return createHash('sha256')
    .update('v0.1.0-pilot')
    .update(process.env.ENGINE_VERSION || 'mock-engine')
    .digest('hex')
    .substring(0, 16);
}

/**
 * Generate cache key for deterministic lookup
 */
function generateCacheKey(scenarioId: string, seed: number, engineCodeHash: string): string {
  return `${scenarioId}:${seed}:${engineCodeHash}`;
}

/**
 * Check if registry entry is expired
 */
function isExpired(entry: RegistryEntry): boolean {
  const ttlMs = RUN_REGISTRY_TTL_MIN * 60 * 1000;
  return (Date.now() - entry.timestamp) > ttlMs;
}

/**
 * Clean expired entries from registry
 */
function cleanExpiredEntries(): void {
  for (const [key, entry] of runRegistry.entries()) {
    if (isExpired(entry)) {
      runRegistry.delete(key);
    }
  }
}

/**
 * Look up existing run or create new entry
 */
export function lookupRun(scenarioId: string, seed: number): LookupResult {
  const engineCodeHash = generateEngineCodeHash();
  const cacheKey = generateCacheKey(scenarioId, seed, engineCodeHash);

  // Clean expired entries
  cleanExpiredEntries();

  // Check for cache hit
  const existing = runRegistry.get(cacheKey);
  if (existing && !isExpired(existing)) {
    return {
      runId: existing.runId,
      source: 'cache'
    };
  }

  // Cache miss - generate new runId
  const runId = `run_${scenarioId}_${seed}_${Date.now()}`;

  // Create new registry entry (will be populated when execution completes)
  const entry: RegistryEntry = {
    runId,
    scenarioId,
    seed,
    engineCodeHash,
    timestamp: Date.now(),
    sseEvents: [],
    report: null
  };

  runRegistry.set(cacheKey, entry);

  return {
    runId,
    source: 'new'
  };
}

/**
 * Register completed run execution
 */
export function registerRunExecution(
  runId: string,
  scenarioId: string,
  seed: number,
  sseEvents: any[],
  report: any
): void {
  const engineCodeHash = generateEngineCodeHash();
  const cacheKey = generateCacheKey(scenarioId, seed, engineCodeHash);

  const entry = runRegistry.get(cacheKey);
  if (entry && entry.runId === runId) {
    entry.sseEvents = sseEvents;
    entry.report = report;
    entry.timestamp = Date.now(); // Update timestamp
  }
}

/**
 * Get recorded SSE events for a runId
 */
export function getRunEvents(runId: string): any[] | null {
  for (const entry of runRegistry.values()) {
    if (entry.runId === runId) {
      return entry.sseEvents;
    }
  }
  return null;
}

/**
 * Get run report for a runId
 */
export function getRunReport(runId: string): any | null {
  for (const entry of runRegistry.values()) {
    if (entry.runId === runId) {
      return entry.report;
    }
  }
  return null;
}

/**
 * Handle GET /runs/lookup request
 */
export async function handleLookupRequest(query: any, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  const { scenarioId, seed } = query || {};

  if (!scenarioId || !seed) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'scenarioId and seed parameters required',
        timestamp: new Date().toISOString()
      }
    };
  }

  const seedNumber = parseInt(seed);
  if (isNaN(seedNumber)) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'seed must be a valid integer',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    // Generate or extract correlation ID
    const correlationId = ensureCorrelationId(headers, '/runs/lookup');

    const result = lookupRun(scenarioId, seedNumber);

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }, correlationId),
      body: result
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to lookup run',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /runs/{runId}/events request
 */
export async function handleEventsRequest(runId: string, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  try {
    // Generate or extract correlation ID
    const correlationId = ensureCorrelationId(headers, `/runs/${runId}/events`);

    const events = getRunEvents(runId);

    if (events === null) {
      return {
        status: 404,
        body: {
          type: 'BAD_INPUT',
          message: `Run ${runId} not found`,
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }, correlationId),
      body: {
        runId,
        events,
        count: events.length
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve run events',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get registry statistics for debugging
 */
export function getRegistryStats(): any {
  cleanExpiredEntries();

  const stats = {
    total_entries: runRegistry.size,
    ttl_minutes: RUN_REGISTRY_TTL_MIN,
    entries_by_scenario: {} as { [key: string]: number }
  };

  for (const entry of runRegistry.values()) {
    stats.entries_by_scenario[entry.scenarioId] =
      (stats.entries_by_scenario[entry.scenarioId] || 0) + 1;
  }

  return stats;
}

/**
 * Clear registry (for testing)
 */
export function clearRegistry(): void {
  runRegistry.clear();
}