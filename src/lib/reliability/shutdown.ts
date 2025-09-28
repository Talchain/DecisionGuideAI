/**
 * Graceful Shutdown Handler
 * Drains connections and updates health status
 */

import { EventEmitter } from 'events';

export type ShutdownState = 'running' | 'draining' | 'stopped';

export interface ShutdownConfig {
  gracePeriodMs: number;
  drainTimeoutMs: number;
  signals: NodeJS.Signals[];
}

export class GracefulShutdownManager extends EventEmitter {
  private state: ShutdownState = 'running';
  private activeConnections = new Set<string>();
  private activeStreams = new Set<string>();
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private config: ShutdownConfig;
  private shutdownPromise?: Promise<void>;

  constructor(config?: Partial<ShutdownConfig>) {
    super();

    this.config = {
      gracePeriodMs: parseInt(process.env.SHUTDOWN_GRACE_MS || '5000'),
      drainTimeoutMs: parseInt(process.env.SHUTDOWN_DRAIN_MS || '30000'),
      signals: ['SIGTERM', 'SIGINT'],
      ...config
    };

    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    this.config.signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`\n📥 Received ${signal}, initiating graceful shutdown...`);
        this.initiateShutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught exception:', error);
      this.initiateShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      this.initiateShutdown();
    });
  }

  async initiateShutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    if (this.state !== 'running') {
      return; // Already shutting down
    }

    this.state = 'draining';
    this.emit('shutdown:started');

    console.log('🚪 Starting graceful shutdown...');
    console.log(`   Active connections: ${this.activeConnections.size}`);
    console.log(`   Active streams: ${this.activeStreams.size}`);

    // Stop accepting new connections
    this.emit('shutdown:stop-accepting');

    // Give a grace period for current requests
    await this.sleep(this.config.gracePeriodMs);

    // Start draining
    console.log('💧 Draining connections...');

    try {
      await Promise.race([
        this.drainAllConnections(),
        this.timeout(this.config.drainTimeoutMs)
      ]);
      console.log('✅ All connections drained');
    } catch (error) {
      console.warn('⚠️ Drain timeout reached, forcing shutdown');
    }

    // Run cleanup handlers
    console.log('🧹 Running cleanup handlers...');
    await this.runCleanupHandlers();

    this.state = 'stopped';
    this.emit('shutdown:complete');

    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  }

  private async drainAllConnections(): Promise<void> {
    // Send cancellation to all active streams
    this.activeStreams.forEach(streamId => {
      this.emit('stream:cancel', streamId);
    });

    // Wait for connections to close
    while (this.activeConnections.size > 0 || this.activeStreams.size > 0) {
      await this.sleep(100);
    }
  }

  private async runCleanupHandlers(): Promise<void> {
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Error in cleanup handler:', error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
  }

  // Connection tracking
  trackConnection(id: string): void {
    if (this.state === 'draining') {
      throw new Error('Server is shutting down');
    }
    this.activeConnections.add(id);
  }

  untrackConnection(id: string): void {
    this.activeConnections.delete(id);
  }

  trackStream(id: string): void {
    if (this.state === 'draining') {
      throw new Error('Server is shutting down');
    }
    this.activeStreams.add(id);
  }

  untrackStream(id: string): void {
    this.activeStreams.delete(id);
  }

  // Register cleanup handlers
  onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  getState(): ShutdownState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      activeConnections: this.activeConnections.size,
      activeStreams: this.activeStreams.size,
      handlers: this.shutdownHandlers.length
    };
  }

  // For testing
  reset(): void {
    this.state = 'running';
    this.activeConnections.clear();
    this.activeStreams.clear();
    this.shutdownPromise = undefined;
  }
}

// Global shutdown manager
export const shutdownManager = new GracefulShutdownManager();

/**
 * Middleware for tracking connections
 */
export function connectionTrackingMiddleware() {
  return (req: any, res: any, next: any) => {
    const connectionId = `conn-${Date.now()}-${Math.random()}`;

    try {
      shutdownManager.trackConnection(connectionId);
    } catch (error: any) {
      if (error.message === 'Server is shutting down') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 'RETRYABLE',
          message: 'Server is shutting down',
          retryable: true,
          timestamp: new Date().toISOString()
        }));
        return;
      }
      throw error;
    }

    // Track when response ends
    res.on('finish', () => {
      shutdownManager.untrackConnection(connectionId);
    });

    res.on('close', () => {
      shutdownManager.untrackConnection(connectionId);
    });

    next();
  };
}

/**
 * Update health endpoint to reflect draining state
 */
export function getHealthWithShutdown(baseHealth: any) {
  const state = shutdownManager.getState();

  if (state === 'draining') {
    return {
      ...baseHealth,
      status: 'draining',
      shutdown: {
        state: 'draining',
        ...shutdownManager.getMetrics()
      }
    };
  }

  return baseHealth;
}