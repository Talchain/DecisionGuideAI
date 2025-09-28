/**
 * Experimental Streaming API - DISABLED BY DEFAULT
 *
 * EXPERIMENTAL ONLY - Environment flag STREAM_ALT_EVENTS must be set to 1 to enable.
 * This API uses different event names and is NOT compatible with the frozen contract.
 * Production systems use only: hello|token|cost|done|cancelled|limited|error
 */

// Environment guard - this entire module is disabled by default
if (process.env.STREAM_ALT_EVENTS !== '1') {
  throw new Error('Experimental streaming API is disabled. Set STREAM_ALT_EVENTS=1 to enable.');
}

import { randomUUID } from 'crypto';
import { ensureCorrelationId } from './correlation.js';
import { enforceTenantSession } from './tenant-sessions.js';
import { applySecurityHeaders, validateRequestSecurity, logRequestSafely } from './security-headers.js';

// Event envelope schema: stream.v1
export interface StreamEventEnvelope {
  schema: 'stream.v1';
  runId: string;
  seed: number;
  tsIso: string;
  resumable: boolean;
  error?: {
    type: 'TIMEOUT' | 'RETRYABLE' | 'INTERNAL' | 'BAD_INPUT' | 'RATE_LIMIT' | 'BREAKER_OPEN';
    code: string;
    message: string;
  };
  step?: {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    durationMs: number;
    retries: number;
  };
}

// Event types (frozen set)
export type StreamEventType =
  | 'run.start'
  | 'run.heartbeat'
  | 'step.progress'
  | 'step.retry'
  | 'run.error'
  | 'run.complete';

// Run state tracking
interface RunState {
  runId: string;
  seed: number;
  startTime: number;
  lastEventId: number;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: number;
    retries: number;
  }>;
  cancelled?: boolean;
  cancelReason?: string;
}

// Global run registry
const runRegistry = new Map<string, RunState>();

/**
 * Format SSE message
 */
function formatSSE(event: string, data: StreamEventEnvelope, id?: number): string {
  const lines = [];
  if (id !== undefined) {
    lines.push(`id: ${id}`);
  }
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push(''); // Empty line to end event
  return lines.join('\n');
}

/**
 * Create event envelope
 */
function createEnvelope(
  runId: string,
  seed: number,
  resumable: boolean = true,
  error?: StreamEventEnvelope['error'],
  step?: StreamEventEnvelope['step']
): StreamEventEnvelope {
  return {
    schema: 'stream.v1',
    runId,
    seed,
    tsIso: new Date().toISOString(),
    resumable,
    error,
    step
  };
}

/**
 * Get or create run state
 */
function getOrCreateRun(runId: string, seed: number): RunState {
  let state = runRegistry.get(runId);
  if (!state) {
    state = {
      runId,
      seed,
      startTime: Date.now(),
      lastEventId: 0,
      status: 'running',
      steps: []
    };
    runRegistry.set(runId, state);
  }
  return state;
}

/**
 * Generate next event ID
 */
function nextEventId(state: RunState): number {
  return ++state.lastEventId;
}

/**
 * Simulate run execution with proper event sequence
 */
async function* generateRunEvents(runId: string, seed: number, resumeFromId?: number): AsyncGenerator<string> {
  const state = getOrCreateRun(runId, seed);

  // If resuming, skip to the appropriate point
  const startFromId = resumeFromId || 0;
  let currentEventId = Math.max(state.lastEventId, startFromId);

  // If already completed/cancelled, send final event and return
  if (state.status === 'completed') {
    currentEventId = nextEventId(state);
    yield formatSSE('run.complete', createEnvelope(runId, seed, false), currentEventId);
    return;
  }

  if (state.status === 'cancelled') {
    currentEventId = nextEventId(state);
    yield formatSSE('run.error', createEnvelope(runId, seed, false, {
      type: 'BAD_INPUT',
      code: 'RUN_CANCELLED',
      message: 'Run was cancelled'
    }), currentEventId);
    return;
  }

  if (state.status === 'error') {
    currentEventId = nextEventId(state);
    yield formatSSE('run.error', createEnvelope(runId, seed, false, {
      type: 'INTERNAL',
      code: 'RUN_FAILED',
      message: 'Run failed during execution'
    }), currentEventId);
    return;
  }

  // Send run.start if this is the beginning
  if (currentEventId === 0) {
    currentEventId = nextEventId(state);
    yield formatSSE('run.start', createEnvelope(runId, seed), currentEventId);
  }

  // Simulate steps based on seed for deterministic behavior
  const stepCount = 3 + (seed % 3); // 3-5 steps
  const stepNames = ['analyze', 'compute', 'optimize', 'validate', 'finalize'];

  for (let i = 0; i < stepCount; i++) {
    if (state.cancelled) break;

    const stepId = `step-${i + 1}`;
    const stepName = stepNames[i] || `step-${i + 1}`;

    // Initialize step if not exists
    if (!state.steps[i]) {
      state.steps[i] = {
        id: stepId,
        name: stepName,
        status: 'pending',
        startTime: Date.now(),
        retries: 0
      };
    }

    const step = state.steps[i];

    // Skip if step already completed and we're resuming
    if (step.status === 'completed' && currentEventId > startFromId) {
      continue;
    }

    // Step start
    step.status = 'running';
    step.startTime = Date.now();

    currentEventId = nextEventId(state);
    yield formatSSE('step.progress', createEnvelope(runId, seed, true, undefined, {
      id: step.id,
      name: step.name,
      status: 'running',
      durationMs: 0,
      retries: step.retries
    }), currentEventId);

    // Simulate work with heartbeats
    const workDuration = 1000 + (seed % 2000); // 1-3 seconds
    const heartbeatInterval = 500;
    const heartbeats = Math.floor(workDuration / heartbeatInterval);

    for (let h = 0; h < heartbeats; h++) {
      if (state.cancelled) break;

      await new Promise(resolve => setTimeout(resolve, heartbeatInterval));

      currentEventId = nextEventId(state);
      yield formatSSE('run.heartbeat', createEnvelope(runId, seed), currentEventId);
    }

    if (state.cancelled) break;

    // Simulate occasional retry (deterministic based on seed)
    if (seed % 7 === i && step.retries === 0) {
      step.retries = 1;
      currentEventId = nextEventId(state);
      yield formatSSE('step.retry', createEnvelope(runId, seed, true, undefined, {
        id: step.id,
        name: step.name,
        status: 'running',
        durationMs: Date.now() - step.startTime,
        retries: step.retries
      }), currentEventId);

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (state.cancelled) break;

    // Step complete
    step.status = 'completed';
    currentEventId = nextEventId(state);
    yield formatSSE('step.progress', createEnvelope(runId, seed, true, undefined, {
      id: step.id,
      name: step.name,
      status: 'completed',
      durationMs: Date.now() - step.startTime,
      retries: step.retries
    }), currentEventId);
  }

  // Final completion (if not cancelled)
  if (!state.cancelled) {
    state.status = 'completed';
    currentEventId = nextEventId(state);
    yield formatSSE('run.complete', createEnvelope(runId, seed, false), currentEventId);
  }
}

/**
 * Handle streaming run request
 * GET /run?seed=42&runId=optional
 */
export async function handleStreamingRunRequest(
  query: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  // Security validation
  const securityCheck = validateRequestSecurity('GET', headers);
  if (!securityCheck.valid) {
    return securityCheck.error;
  }

  // Safe request logging (no bodies)
  logRequestSafely('GET', '/run', headers, query);

  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Correlation ID
  const correlationId = ensureCorrelationId(headers);

  // Parse parameters
  const seed = parseInt(query.seed);
  if (!seed || isNaN(seed)) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'seed parameter required and must be a number',
        timestamp: new Date().toISOString()
      }
    };
  }

  const runId = query.runId || randomUUID();
  const lastEventId = headers['last-event-id'] || query.lastEventId;
  const resumeFromId = lastEventId ? parseInt(lastEventId) : undefined;

  // Return SSE stream with security headers
  return {
    status: 200,
    headers: applySecurityHeaders({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Correlation-ID': correlationId
    }, headers['origin']),
    body: async function* () {
      try {
        for await (const event of generateRunEvents(runId, seed, resumeFromId)) {
          yield event;
        }
      } catch (error) {
        // Send error event on failure
        const state = getOrCreateRun(runId, seed);
        state.status = 'error';
        const errorEventId = nextEventId(state);
        yield formatSSE('run.error', createEnvelope(runId, seed, false, {
          type: 'INTERNAL',
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown streaming error'
        }), errorEventId);
      }
    }
  };
}

/**
 * Handle run cancellation
 * POST /run/cancel?runId=<id>
 */
export async function handleRunCancelRequest(
  query: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  const runId = query.runId;
  if (!runId) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'runId parameter required',
        timestamp: new Date().toISOString()
      }
    };
  }

  const state = runRegistry.get(runId);
  if (!state) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Run not found',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Idempotent cancel - return same result if already cancelled
  if (state.cancelled) {
    return {
      status: 200,
      body: {
        schema: 'run-cancel.v1',
        runId,
        status: 'cancelled',
        message: 'Run was already cancelled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Mark as cancelled
  state.cancelled = true;
  state.status = 'cancelled';
  state.cancelReason = 'user_cancelled';

  return {
    status: 200,
    body: {
      schema: 'run-cancel.v1',
      runId,
      status: 'cancelled',
      message: 'Run cancelled successfully',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get run status
 * GET /run/status?runId=<id>
 */
export async function handleRunStatusRequest(
  query: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  const runId = query.runId;
  if (!runId) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'runId parameter required',
        timestamp: new Date().toISOString()
      }
    };
  }

  const state = runRegistry.get(runId);
  if (!state) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Run not found',
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    status: 200,
    body: {
      schema: 'run-status.v1',
      runId: state.runId,
      seed: state.seed,
      status: state.status,
      lastEventId: state.lastEventId,
      startTime: state.startTime,
      steps: state.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: step.status,
        retries: step.retries,
        durationMs: step.status === 'completed' ?
          Date.now() - step.startTime :
          (step.status === 'running' ? Date.now() - step.startTime : 0)
      })),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Cleanup old runs (housekeeping)
 */
export function cleanupOldRuns(maxAge: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [runId, state] of runRegistry.entries()) {
    if (now - state.startTime > maxAge) {
      runRegistry.delete(runId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get streaming API status for monitoring
 */
export function getStreamingAPIStatus(): any {
  return {
    active_runs: runRegistry.size,
    runs_by_status: Array.from(runRegistry.values()).reduce((acc, state) => {
      acc[state.status] = (acc[state.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    oldest_run_age_ms: runRegistry.size > 0 ?
      Math.max(...Array.from(runRegistry.values()).map(s => Date.now() - s.startTime)) : 0
  };
}