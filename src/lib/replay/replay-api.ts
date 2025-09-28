/**
 * Edge Replay Mode API - DISABLED BY DEFAULT
 *
 * DEVELOPMENT ONLY - Environment flag REPLAY_MODE must be set to 1 to enable.
 * Serves recorded NDJSON streams and reports from artifacts/snapshots/
 * Preserves resume and cancel semantics without engine calls
 */

import { replayModeApi } from './replay-mode.js';
import { ensureCorrelationId } from '../correlation.js';
import { enforceTenantSession } from '../tenant-sessions.js';
import { applySecurityHeaders, validateRequestSecurity, logRequestSafely } from '../security-headers.js';

/**
 * Format SSE message for replay events
 */
function formatReplaySSE(event: any, id?: string): string {
  const lines = [];
  if (id) {
    lines.push(`id: ${id}`);
  }
  lines.push(`event: ${event.type || 'data'}`);
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push(''); // Empty line to end event
  return lines.join('\n');
}

/**
 * Handle replay session start
 * POST /stream/{runId} (when REPLAY_MODE=1)
 */
export async function handleReplayStartRequest(
  params: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  if (!replayModeApi.isEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Replay mode is not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Security validation
  const securityCheck = validateRequestSecurity('POST', headers);
  if (!securityCheck.valid) {
    return securityCheck.error;
  }

  // Safe request logging
  logRequestSafely('POST', `/stream/${params.runId}`, headers);

  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Correlation ID
  const correlationId = ensureCorrelationId(headers);

  const runId = params.runId;
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

  const result = await replayModeApi.startReplay(runId);

  return {
    status: result.status,
    headers: applySecurityHeaders({
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId
    }, headers['origin']),
    body: result.success ? result.data : {
      type: 'BAD_INPUT',
      message: result.error,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Handle replay events streaming
 * GET /stream/{runId} (when REPLAY_MODE=1)
 */
export async function handleReplayStreamRequest(
  params: Record<string, any>,
  headers: Record<string, any> = {},
  query: Record<string, any> = {}
): Promise<any> {
  if (!replayModeApi.isEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Replay mode is not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Security validation
  const securityCheck = validateRequestSecurity('GET', headers);
  if (!securityCheck.valid) {
    return securityCheck.error;
  }

  // Safe request logging
  logRequestSafely('GET', `/stream/${params.runId}`, headers, query);

  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Correlation ID
  const correlationId = ensureCorrelationId(headers);

  const runId = params.runId;
  const lastEventId = headers['last-event-id'];

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
        let eventCount = 0;
        const batchSize = 5; // Send events in small batches to simulate real-time

        while (true) {
          const result = await replayModeApi.getNextEvents(runId, batchSize, lastEventId);

          if (!result.success) {
            // Send error event
            yield formatReplaySSE({
              type: 'error',
              error: {
                type: 'INTERNAL',
                code: 'REPLAY_ERROR',
                message: result.error
              },
              timestamp: new Date().toISOString()
            });
            break;
          }

          // Send events from this batch
          for (const event of result.data.events) {
            yield formatReplaySSE(event, event.id);
            eventCount++;
          }

          // Check if replay is complete or cancelled
          if (result.data.completed || result.data.cancelled) {
            if (result.data.cancelled) {
              yield formatReplaySSE({
                type: 'cancelled',
                message: 'Replay session was cancelled',
                timestamp: new Date().toISOString()
              });
            }
            break;
          }

          // Brief pause between batches to simulate real-time streaming
          if (result.data.events.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            // No more events available yet, longer pause
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Safety limit to prevent infinite loops
          if (eventCount > 10000) {
            yield formatReplaySSE({
              type: 'error',
              error: {
                type: 'INTERNAL',
                code: 'TOO_MANY_EVENTS',
                message: 'Event limit exceeded for replay session'
              },
              timestamp: new Date().toISOString()
            });
            break;
          }
        }
      } catch (error) {
        // Send error event on failure
        yield formatReplaySSE({
          type: 'error',
          error: {
            type: 'INTERNAL',
            code: 'REPLAY_STREAM_ERROR',
            message: error instanceof Error ? error.message : 'Unknown replay streaming error'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
  };
}

/**
 * Handle replay session cancellation
 * POST /stream/{runId}/cancel (when REPLAY_MODE=1)
 */
export async function handleReplayCancelRequest(
  params: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  if (!replayModeApi.isEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Replay mode is not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  const runId = params.runId;
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

  const result = await replayModeApi.cancelReplay(runId);

  return {
    status: result.status,
    body: result.success ? {
      schema: 'replay-cancel.v1',
      ...result.data
    } : {
      type: 'BAD_INPUT',
      message: result.error,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Handle replay report retrieval
 * GET /report/{runId} (when REPLAY_MODE=1)
 */
export async function handleReplayReportRequest(
  params: Record<string, any>,
  headers: Record<string, any> = {}
): Promise<any> {
  if (!replayModeApi.isEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Replay mode is not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Tenant session enforcement
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  const runId = params.runId;
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

  const result = await replayModeApi.getReplayReport(runId);

  return {
    status: result.status,
    body: result.success ? result.data : {
      type: 'BAD_INPUT',
      message: result.error,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Handle available snapshots listing
 * GET /replay/snapshots (when REPLAY_MODE=1)
 */
export async function handleReplaySnapshotsRequest(
  query: Record<string, any> = {},
  headers: Record<string, any> = {}
): Promise<any> {
  if (!replayModeApi.isEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Replay mode is not enabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Security validation
  const securityCheck = validateRequestSecurity('GET', headers);
  if (!securityCheck.valid) {
    return securityCheck.error;
  }

  // Safe request logging
  logRequestSafely('GET', '/replay/snapshots', headers, query);

  // Correlation ID
  const correlationId = ensureCorrelationId(headers);

  const result = await replayModeApi.listAvailableSnapshots();

  return {
    status: result.status,
    headers: applySecurityHeaders({
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId
    }, headers['origin']),
    body: result.success ? {
      schema: 'replay-snapshots.v1',
      ...result.data,
      timestamp: new Date().toISOString()
    } : {
      type: 'BAD_INPUT',
      message: result.error,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get replay mode status for monitoring
 */
export function getReplayModeStatus(): any {
  if (!replayModeApi.isEnabled()) {
    return {
      enabled: false,
      message: 'Replay mode is disabled (set REPLAY_MODE=1 to enable)'
    };
  }

  return {
    enabled: true,
    message: 'Replay mode is active',
    timestamp: new Date().toISOString()
  };
}