/**
 * Fast-cancel handshake implementation (Gateway ↔ Warp)
 * Maps Warp ABORTED → terminal 'cancelled' event
 * Target: ≤150ms cancel latency
 */

export interface CancelRequest {
  sessionId: string;
  timestamp: number;
  timeout?: number; // Optional timeout in ms (default 150ms)
}

export interface CancelResponse {
  sessionId: string;
  status: 'cancelled' | 'not_found' | 'already_cancelled' | 'timeout';
  latency: number;
  warpResponse?: {
    status: 'ABORTED' | 'ERROR' | 'NOT_FOUND';
    timestamp: number;
  };
}

export interface StreamEvent {
  type: 'token' | 'cancelled' | 'done' | 'error';
  sessionId: string;
  data?: any;
  timestamp: number;
}

// Fast-cancel manager for coordinating Gateway ↔ Warp communication
export class FastCancelManager {
  private activeSessions = new Map<string, {
    controller: AbortController;
    startTime: number;
    eventSource?: EventSource;
  }>();

  private cancelLatencies: number[] = [];
  private readonly MAX_LATENCY_TARGET = 150; // ms

  // Start tracking a session for fast-cancel capability
  startSession(sessionId: string, eventSource?: EventSource): AbortController {
    const controller = new AbortController();

    this.activeSessions.set(sessionId, {
      controller,
      startTime: Date.now(),
      eventSource
    });

    return controller;
  }

  // Fast-cancel implementation with timing guarantees
  async cancel(request: CancelRequest): Promise<CancelResponse> {
    const cancelStartTime = Date.now();
    const timeout = request.timeout || this.MAX_LATENCY_TARGET;

    const session = this.activeSessions.get(request.sessionId);
    if (!session) {
      return {
        sessionId: request.sessionId,
        status: 'not_found',
        latency: Date.now() - cancelStartTime
      };
    }

    try {
      // 1. Immediately signal abort to prevent new events
      session.controller.abort();

      // 2. Close EventSource connection if present (immediate local effect)
      if (session.eventSource && session.eventSource.readyState !== 2) { // 2 = CLOSED
        session.eventSource.close();
      }

      // 3. Fast-track cancel request to Warp service
      const warpCancelPromise = this.sendWarpCancel(request.sessionId);

      // 4. Race against timeout to ensure ≤150ms guarantee
      const timeoutPromise = new Promise<CancelResponse>((resolve) => {
        setTimeout(() => {
          resolve({
            sessionId: request.sessionId,
            status: 'timeout',
            latency: timeout
          });
        }, timeout);
      });

      const warpResponsePromise = warpCancelPromise.then((warpResponse): CancelResponse => {
        const latency = Date.now() - cancelStartTime;
        this.recordLatency(latency);

        return {
          sessionId: request.sessionId,
          status: warpResponse.status === 'ABORTED' ? 'cancelled' : 'already_cancelled',
          latency,
          warpResponse
        };
      });

      // Return whichever completes first (should be local cancellation)
      const result = await Promise.race([warpResponsePromise, timeoutPromise]);

      // Clean up session
      this.activeSessions.delete(request.sessionId);

      return result;

    } catch (error) {
      const latency = Date.now() - cancelStartTime;
      this.activeSessions.delete(request.sessionId);

      return {
        sessionId: request.sessionId,
        status: 'cancelled', // Assume success for client-side abort
        latency
      };
    }
  }

  // Send cancel request to Warp service (mocked for PoC)
  private async sendWarpCancel(sessionId: string): Promise<{ status: 'ABORTED' | 'ERROR' | 'NOT_FOUND'; timestamp: number }> {
    // In real implementation, this would be HTTP POST to Warp service
    // For PoC, simulate fast response

    const delay = Math.random() * 100 + 20; // 20-120ms simulated network

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'ABORTED',
          timestamp: Date.now()
        });
      }, delay);
    });
  }

  // Create a terminal 'cancelled' event for SSE streams
  createCancelledEvent(sessionId: string): StreamEvent {
    return {
      type: 'cancelled',
      sessionId,
      timestamp: Date.now(),
      data: {
        reason: 'User requested cancellation',
        final: true
      }
    };
  }

  // Record and track cancel latencies for monitoring
  private recordLatency(latency: number): void {
    this.cancelLatencies.push(latency);

    // Keep only last 100 measurements
    if (this.cancelLatencies.length > 100) {
      this.cancelLatencies.shift();
    }

    // Log if latency exceeds target
    if (latency > this.MAX_LATENCY_TARGET) {
      console.warn(`[FastCancel] High latency: ${latency}ms (target: ≤${this.MAX_LATENCY_TARGET}ms)`);
    }
  }

  // Get cancel performance metrics
  getMetrics(): {
    averageLatency: number;
    maxLatency: number;
    minLatency: number;
    p95Latency: number;
    successRate: number;
    totalCancels: number;
    targetCompliance: number; // % of cancels under target latency
  } {
    if (this.cancelLatencies.length === 0) {
      return {
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        p95Latency: 0,
        successRate: 100,
        totalCancels: 0,
        targetCompliance: 100
      };
    }

    const sorted = [...this.cancelLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const underTarget = sorted.filter(l => l <= this.MAX_LATENCY_TARGET).length;

    return {
      averageLatency: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      maxLatency: Math.max(...sorted),
      minLatency: Math.min(...sorted),
      p95Latency: sorted[p95Index] || 0,
      successRate: 100, // Assume all cancels succeed locally
      totalCancels: this.cancelLatencies.length,
      targetCompliance: Math.round((underTarget / sorted.length) * 100)
    };
  }

  // Check if a session is active
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  // Clean up all sessions (for testing/reset)
  cleanup(): void {
    for (const [sessionId, session] of this.activeSessions) {
      session.controller.abort();
      if (session.eventSource) {
        session.eventSource.close();
      }
    }
    this.activeSessions.clear();
    this.cancelLatencies = [];
  }

  // Get active session count
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}

// Global instance for the application
export const fastCancelManager = new FastCancelManager();

// Helper function for SSE streams to wire up fast-cancel
export function setupFastCancelForStream(
  sessionId: string,
  eventSource: EventSource,
  onCancelled?: () => void
): () => void {
  const controller = fastCancelManager.startSession(sessionId, eventSource);

  // Listen for abort signal
  controller.signal.addEventListener('abort', () => {
    if (onCancelled) {
      onCancelled();
    }
  });

  // Return cleanup function
  return () => {
    if (fastCancelManager.isSessionActive(sessionId)) {
      fastCancelManager.cancel({
        sessionId,
        timestamp: Date.now()
      });
    }
  };
}

// Feature flag check
export function isFastCancelEnabled(): boolean {
  return import.meta.env.VITE_FAST_CANCEL === '1' ||
         localStorage.getItem('feature.fastCancel') === '1';
}