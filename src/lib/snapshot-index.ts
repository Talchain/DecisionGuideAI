/**
 * Persistent Snapshot Index
 * Lightweight metadata storage for snapshot evidence with retention
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { enforceTenantSession } from './tenant-sessions.js';

export interface SnapshotMetadata {
  runId: string;
  org: string;
  scenarioId: string;
  seed: number;
  createdAt: string; // ISO8601
  ttff_ms: number;
  cancel_ms?: number;
  version: string;
  correlationId?: string;
}

export interface SnapshotListResponse {
  items: SnapshotMetadata[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Environment configuration - read dynamically to support tests
function getSnapshotIndexTtlDays(): number {
  return parseInt(process.env.SNAPSHOT_INDEX_TTL_DAYS || '14');
}

function getIndexFilePath(): string {
  return process.env.SNAPSHOT_INDEX_PATH || './artifacts/snapshot-index.json';
}

// In-memory cache of the index
let snapshotIndex: SnapshotMetadata[] = [];
let indexLoaded = false;

/**
 * Reset snapshot index state (for testing)
 */
export function resetSnapshotIndex(): void {
  snapshotIndex = [];
  indexLoaded = false;
}

/**
 * Ensure index directory exists
 */
function ensureIndexDirectory(): void {
  const indexDir = join(getIndexFilePath(), '..');
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
}

/**
 * Load snapshot index from file
 */
function loadSnapshotIndex(): void {
  if (indexLoaded) return;

  try {
    const indexPath = getIndexFilePath();
    if (existsSync(indexPath)) {
      const data = readFileSync(indexPath, 'utf-8');
      snapshotIndex = JSON.parse(data);
    } else {
      snapshotIndex = [];
    }
    indexLoaded = true;
  } catch (error) {
    console.warn('Failed to load snapshot index, starting fresh:', error);
    snapshotIndex = [];
    indexLoaded = true;
  }
}

/**
 * Save snapshot index to file
 */
function saveSnapshotIndex(): void {
  try {
    ensureIndexDirectory();
    writeFileSync(getIndexFilePath(), JSON.stringify(snapshotIndex, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save snapshot index:', error);
  }
}

/**
 * Add snapshot metadata to index
 */
export function addSnapshotMetadata(metadata: SnapshotMetadata): void {
  loadSnapshotIndex();

  // Remove existing entry with same runId (if any)
  snapshotIndex = snapshotIndex.filter(item => item.runId !== metadata.runId);

  // Add new entry
  snapshotIndex.push(metadata);

  // Sort by createdAt (newest first)
  snapshotIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Save to file
  saveSnapshotIndex();
}

/**
 * Get snapshot metadata by runId
 */
export function getSnapshotMetadata(runId: string): SnapshotMetadata | null {
  loadSnapshotIndex();
  return snapshotIndex.find(item => item.runId === runId) || null;
}

/**
 * List snapshots with filtering and pagination
 */
export function listSnapshots(
  org?: string,
  since?: string,
  page: number = 1,
  limit: number = 50
): SnapshotListResponse {
  loadSnapshotIndex();

  let filtered = snapshotIndex;

  // Filter by org
  if (org) {
    filtered = filtered.filter(item => item.org === org);
  }

  // Filter by date
  if (since) {
    const sinceDate = new Date(since).getTime();
    if (!isNaN(sinceDate)) {
      filtered = filtered.filter(item => new Date(item.createdAt).getTime() >= sinceDate);
    }
  }

  // Pagination
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    total: filtered.length,
    page,
    limit,
    hasMore: offset + limit < filtered.length
  };
}

/**
 * Remove expired snapshots based on TTL
 */
export function cleanupExpiredSnapshots(): number {
  loadSnapshotIndex();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - getSnapshotIndexTtlDays());
  const cutoffTime = cutoffDate.getTime();

  const initialCount = snapshotIndex.length;

  // Filter out expired entries
  snapshotIndex = snapshotIndex.filter(item => {
    return new Date(item.createdAt).getTime() >= cutoffTime;
  });

  const removedCount = initialCount - snapshotIndex.length;

  if (removedCount > 0) {
    saveSnapshotIndex();
  }

  return removedCount;
}

/**
 * Validate snapshot list request parameters
 */
function validateListRequest(query: any): any {
  const { org, since, page, limit } = query;

  // Validate page
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return {
        type: 'BAD_INPUT',
        message: 'page must be a positive integer',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      return {
        type: 'BAD_INPUT',
        message: 'limit must be between 1 and 200',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Validate since date
  if (since !== undefined) {
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return {
        type: 'BAD_INPUT',
        message: 'since must be a valid ISO8601 date',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Validate org (basic string check)
  if (org !== undefined && (typeof org !== 'string' || org.length === 0)) {
    return {
      type: 'BAD_INPUT',
      message: 'org must be a non-empty string',
      timestamp: new Date().toISOString()
    };
  }

  return null; // Valid
}

/**
 * Handle GET /snapshots request
 */
export async function handleSnapshotsListRequest(query: any, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled (filter by org if provided)
  const sessionCheck = enforceTenantSession(headers, query.org);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Validate request
  const validation = validateListRequest(query);
  if (validation) {
    return { status: 400, body: validation };
  }

  try {
    const { org, since, page = '1', limit = '50' } = query;

    const result = listSnapshots(
      org,
      since,
      parseInt(page),
      parseInt(limit)
    );

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: result
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to list snapshots',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /snapshots/{runId} request
 */
export async function handleSnapshotGetRequest(runId: string, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  if (!runId || typeof runId !== 'string') {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'runId parameter required',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const metadata = getSnapshotMetadata(runId);

    if (!metadata) {
      return {
        status: 404,
        body: {
          type: 'BAD_INPUT',
          message: `Snapshot metadata for run ${runId} not found`,
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: metadata
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get snapshot metadata',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get snapshot index statistics
 */
export function getSnapshotIndexStatistics(): any {
  loadSnapshotIndex();

  const stats = {
    total_snapshots: snapshotIndex.length,
    ttl_days: getSnapshotIndexTtlDays(),
    index_file_path: getIndexFilePath(),
    orgs: {} as Record<string, number>,
    scenarios: {} as Record<string, number>,
    recent_snapshots: 0
  };

  const now = Date.now();
  const recentThreshold = now - (24 * 60 * 60 * 1000); // Last 24 hours

  // Analyze snapshots
  for (const snapshot of snapshotIndex) {
    // Count by org
    stats.orgs[snapshot.org] = (stats.orgs[snapshot.org] || 0) + 1;

    // Count by scenario
    stats.scenarios[snapshot.scenarioId] = (stats.scenarios[snapshot.scenarioId] || 0) + 1;

    // Count recent snapshots
    if (new Date(snapshot.createdAt).getTime() >= recentThreshold) {
      stats.recent_snapshots++;
    }
  }

  return stats;
}

/**
 * Initialize snapshot index (call on startup)
 */
export function initializeSnapshotIndex(): void {
  loadSnapshotIndex();
  console.log(`Snapshot index loaded: ${snapshotIndex.length} entries`);
}

// Run cleanup daily
setInterval(() => {
  const removed = cleanupExpiredSnapshots();
  if (removed > 0) {
    console.log(`Cleaned up ${removed} expired snapshot index entries`);
  }
}, 24 * 60 * 60 * 1000); // 24 hours