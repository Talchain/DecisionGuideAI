/**
 * Concurrency Queue
 * Fair scheduling for per-org concurrent run limits
 */

export interface QueueStatus {
  org: string;
  active: number;
  queued: number;
  max: number;
}

export interface QueueEntry {
  org: string;
  runId: string;
  timestamp: number;
  resolve: (allowed: boolean) => void;
  reject: (error: Error) => void;
}

// Environment configuration - read dynamically to support tests
function getMaxConcurrencyPerOrg(): number {
  return parseInt(process.env.MAX_CONCURRENCY_PER_ORG || '2');
}

function getQueueMaxDepth(): number {
  return parseInt(process.env.QUEUE_MAX_DEPTH || '25');
}

function getQueueRetryAfterS(): number {
  return parseInt(process.env.QUEUE_RETRY_AFTER_S || '5');
}

function getQueueTimeoutMs(): number {
  return parseInt(process.env.QUEUE_TIMEOUT_MS || '30000');
}

// In-memory queue state per org
const activeRuns = new Map<string, Set<string>>(); // org -> Set<runId>
const queuedRuns = new Map<string, QueueEntry[]>(); // org -> Array<QueueEntry>

/**
 * Get active run count for org
 */
function getActiveCount(org: string): number {
  return activeRuns.get(org)?.size || 0;
}

/**
 * Get queued run count for org
 */
function getQueuedCount(org: string): number {
  return queuedRuns.get(org)?.length || 0;
}

/**
 * Check if org can start a new run immediately
 */
function canRunImmediately(org: string): boolean {
  return getActiveCount(org) < getMaxConcurrencyPerOrg();
}

/**
 * Add run to active set
 */
function addActiveRun(org: string, runId: string): void {
  if (!activeRuns.has(org)) {
    activeRuns.set(org, new Set());
  }
  activeRuns.get(org)!.add(runId);
}

/**
 * Remove run from active set and process queue
 */
function removeActiveRun(org: string, runId: string): void {
  const orgRuns = activeRuns.get(org);
  if (orgRuns) {
    orgRuns.delete(runId);
    if (orgRuns.size === 0) {
      activeRuns.delete(org);
    }
  }

  // Process queue for this org
  processQueue(org);
}

/**
 * Add run to queue
 */
function addToQueue(entry: QueueEntry): boolean {
  const { org } = entry;

  if (!queuedRuns.has(org)) {
    queuedRuns.set(org, []);
  }

  const queue = queuedRuns.get(org)!;

  // Check queue depth limit
  if (queue.length >= getQueueMaxDepth()) {
    return false; // Queue full
  }

  queue.push(entry);
  return true;
}

/**
 * Process queue for org (move queued runs to active if possible)
 */
function processQueue(org: string): void {
  const queue = queuedRuns.get(org);
  if (!queue || queue.length === 0) {
    return;
  }

  // Process as many queued runs as possible
  while (queue.length > 0 && canRunImmediately(org)) {
    const entry = queue.shift()!;
    addActiveRun(org, entry.runId);
    entry.resolve(true);
  }

  // Clean up empty queue
  if (queue.length === 0) {
    queuedRuns.delete(org);
  }
}

/**
 * Request run slot for org
 */
export async function requestRunSlot(org: string, runId: string): Promise<{ allowed: boolean; retryAfter?: number; reason?: string }> {
  // Check if can run immediately
  if (canRunImmediately(org)) {
    addActiveRun(org, runId);
    return { allowed: true };
  }

  // Check if queue has space
  const queuedCount = getQueuedCount(org);
  const maxDepth = getQueueMaxDepth();
  if (queuedCount >= maxDepth) {
    return {
      allowed: false,
      retryAfter: getQueueRetryAfterS(),
      reason: `Queue full: ${maxDepth} maximum queued runs per org`
    };
  }

  // Add to queue and wait
  return new Promise((resolve, reject) => {
    const entry: QueueEntry = {
      org,
      runId,
      timestamp: Date.now(),
      resolve: (allowed) => resolve({ allowed }),
      reject
    };

    const queued = addToQueue(entry);
    if (!queued) {
      resolve({
        allowed: false,
        retryAfter: getQueueRetryAfterS(),
        reason: 'Failed to add to queue'
      });
    }

    // Set timeout for queued request
    setTimeout(() => {
      // Remove from queue if still there
      const queue = queuedRuns.get(org);
      if (queue) {
        const index = queue.findIndex(e => e.runId === runId);
        if (index >= 0) {
          queue.splice(index, 1);
          if (queue.length === 0) {
            queuedRuns.delete(org);
          }
        }
      }

      resolve({
        allowed: false,
        retryAfter: getQueueRetryAfterS(),
        reason: 'Queued request timed out'
      });
    }, getQueueTimeoutMs()); // Configurable timeout for queued requests
  });
}

/**
 * Release run slot for org
 */
export function releaseRunSlot(org: string, runId: string): void {
  removeActiveRun(org, runId);
}

/**
 * Get queue status for org
 */
export function getQueueStatus(org: string): QueueStatus {
  return {
    org,
    active: getActiveCount(org),
    queued: getQueuedCount(org),
    max: getMaxConcurrencyPerOrg()
  };
}

/**
 * Handle GET /queue/status request
 */
export async function handleQueueStatusRequest(query: any): Promise<any> {
  const { org } = query;

  if (!org) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'org parameter required',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const status = getQueueStatus(org);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: status
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get queue status',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle POST /queue/bump request (dev/test only)
 */
export async function handleQueueBumpRequest(): Promise<any> {
  // Check if test routes are enabled
  if (process.env.TEST_ROUTES !== '1') {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Queue bump not available (requires TEST_ROUTES=1)',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    let processed = 0;

    // Process one slot for each org with queued runs
    for (const [org, queue] of queuedRuns.entries()) {
      if (queue.length > 0 && canRunImmediately(org)) {
        processQueue(org);
        processed++;
        break; // Only advance one slot
      }
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        message: `Advanced ${processed} queued run(s)`,
        processed
      }
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to bump queue',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get overall queue statistics (for debugging)
 */
export function getQueueStatistics(): any {
  const stats = {
    max_concurrency_per_org: getMaxConcurrencyPerOrg(),
    queue_max_depth: getQueueMaxDepth(),
    retry_after_seconds: getQueueRetryAfterS(),
    total_orgs_active: activeRuns.size,
    total_orgs_queued: queuedRuns.size,
    active_runs_by_org: {} as Record<string, number>,
    queued_runs_by_org: {} as Record<string, number>
  };

  // Populate per-org stats
  for (const [org, runs] of activeRuns.entries()) {
    stats.active_runs_by_org[org] = runs.size;
  }

  for (const [org, queue] of queuedRuns.entries()) {
    stats.queued_runs_by_org[org] = queue.length;
  }

  return stats;
}

/**
 * Reset all queue state (for testing)
 */
export function resetQueueState(): void {
  activeRuns.clear();
  queuedRuns.clear();
}

/**
 * Clean up expired queue entries
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  const maxAge = 60000; // 1 minute
  let cleaned = 0;

  for (const [org, queue] of queuedRuns.entries()) {
    const initialLength = queue.length;

    // Remove expired entries
    const filtered = queue.filter(entry => {
      const expired = (now - entry.timestamp) > maxAge;
      if (expired) {
        entry.reject(new Error('Queue entry expired'));
        cleaned++;
      }
      return !expired;
    });

    if (filtered.length === 0) {
      queuedRuns.delete(org);
    } else if (filtered.length !== initialLength) {
      queuedRuns.set(org, filtered);
    }
  }

  return cleaned;
}

// Run cleanup every minute
setInterval(cleanupExpiredEntries, 60000);