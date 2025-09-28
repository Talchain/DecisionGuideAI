/**
 * Health Endpoint Types and Implementation
 * Contract wall compliance - PRD v15
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type ReplayStatus = 'success' | 'failure' | 'timeout';

export interface ReplayMetrics {
  /** Status of last replay attempt */
  lastStatus: ReplayStatus;
  /** Number of replay refusals in last 24h */
  refusals: number;
  /** Number of replay retries in last 24h */
  retries: number;
  /** Number of resume attempts refused (resume-once enforcement) */
  resumeRefused: number;
  /** Timestamp of last replay attempt */
  lastTs: string;
}

export interface HealthResponse {
  /** Overall system status */
  status: HealthStatus;
  /** 95th percentile response time in milliseconds */
  p95_ms: number;
  /** Replay system metrics */
  replay: ReplayMetrics;
  /** Whether test routes are currently enabled */
  test_routes_enabled: boolean;
}

export interface HealthMetrics {
  requestCount: number;
  responseTimes: number[];
  errorCount: number;
  lastUpdated: Date;
}

/**
 * Health Check Service
 */
export class HealthService {
  private metrics: HealthMetrics = {
    requestCount: 0,
    responseTimes: [],
    errorCount: 0,
    lastUpdated: new Date()
  };

  private replayMetrics: ReplayMetrics = {
    lastStatus: 'success',
    refusals: 0,
    retries: 0,
    resumeRefused: 0,
    lastTs: new Date().toISOString()
  };

  private testRoutesEnabled: boolean = false;

  constructor() {
    // Initialize with default healthy state
    this.updateMetrics();
  }

  /**
   * Get current health status
   */
  getHealth(): HealthResponse {
    const status = this.calculateStatus();
    const p95_ms = this.calculateP95ResponseTime();

    return {
      status,
      p95_ms,
      replay: { ...this.replayMetrics },
      test_routes_enabled: this.testRoutesEnabled
    };
  }

  /**
   * Record a request and its response time
   */
  recordRequest(responseTimeMs: number, isError: boolean = false): void {
    this.metrics.requestCount++;
    this.metrics.responseTimes.push(responseTimeMs);

    if (isError) {
      this.metrics.errorCount++;
    }

    // Keep only last 1000 response times for memory efficiency
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
    }

    this.metrics.lastUpdated = new Date();
  }

  /**
   * Update replay metrics
   */
  updateReplayMetrics(status: ReplayStatus, refusals?: number, retries?: number): void {
    this.replayMetrics.lastStatus = status;
    this.replayMetrics.lastTs = new Date().toISOString();

    if (refusals !== undefined) {
      this.replayMetrics.refusals = refusals;
    }

    if (retries !== undefined) {
      this.replayMetrics.retries = retries;
    }
  }

  /**
   * Increment resume refused counter
   */
  incrementResumeRefused(): void {
    this.replayMetrics.resumeRefused++;
  }

  /**
   * Set test routes enabled state
   */
  setTestRoutesEnabled(enabled: boolean): void {
    this.testRoutesEnabled = enabled;
  }

  /**
   * Calculate system health status
   */
  private calculateStatus(): HealthStatus {
    const errorRate = this.metrics.requestCount > 0
      ? this.metrics.errorCount / this.metrics.requestCount
      : 0;

    const p95 = this.calculateP95ResponseTime();

    // Determine status based on error rate and response time
    if (errorRate > 0.1 || p95 > 5000) {
      return 'unhealthy';
    } else if (errorRate > 0.05 || p95 > 3000) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Calculate 95th percentile response time
   */
  private calculateP95ResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) {
      return 0;
    }

    const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return Math.round(sorted[Math.max(0, index)]);
  }

  /**
   * Update metrics periodically
   */
  private updateMetrics(): void {
    // Reset daily counters every 24 hours
    setInterval(() => {
      this.replayMetrics.refusals = 0;
      this.replayMetrics.retries = 0;
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Get detailed metrics for debugging
   */
  getDetailedMetrics(): {
    health: HealthResponse;
    internal: {
      requestCount: number;
      errorCount: number;
      errorRate: number;
      avgResponseTime: number;
      lastUpdated: string;
    };
  } {
    const health = this.getHealth();
    const errorRate = this.metrics.requestCount > 0
      ? this.metrics.errorCount / this.metrics.requestCount
      : 0;

    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;

    return {
      health,
      internal: {
        requestCount: this.metrics.requestCount,
        errorCount: this.metrics.errorCount,
        errorRate: Math.round(errorRate * 1000) / 1000,
        avgResponseTime: Math.round(avgResponseTime),
        lastUpdated: this.metrics.lastUpdated.toISOString()
      }
    };
  }
}

/**
 * Health Check Middleware
 */
export function createHealthMiddleware(healthService: HealthService) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      healthService.recordRequest(responseTime, isError);
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Health Check Constants
 */
export const HEALTH_CHECK_CONSTANTS = {
  MAX_RESPONSE_TIME_HEALTHY: 2000,
  MAX_RESPONSE_TIME_DEGRADED: 3000,
  MAX_ERROR_RATE_HEALTHY: 0.02,
  MAX_ERROR_RATE_DEGRADED: 0.05,
  REPLAY_TIMEOUT_MS: 30000,
  METRICS_RETENTION_COUNT: 1000
} as const;

/**
 * Type Guards
 */
export function isValidHealthStatus(status: string): status is HealthStatus {
  return ['healthy', 'degraded', 'unhealthy'].includes(status);
}

export function isValidReplayStatus(status: string): status is ReplayStatus {
  return ['success', 'failure', 'timeout'].includes(status);
}

export function isValidHealthResponse(response: any): response is HealthResponse {
  return (
    response &&
    typeof response === 'object' &&
    isValidHealthStatus(response.status) &&
    typeof response.p95_ms === 'number' &&
    response.p95_ms >= 0 &&
    response.replay &&
    typeof response.replay === 'object' &&
    isValidReplayStatus(response.replay.lastStatus) &&
    typeof response.replay.refusals === 'number' &&
    typeof response.replay.retries === 'number' &&
    typeof response.replay.lastTs === 'string' &&
    typeof response.test_routes_enabled === 'boolean'
  );
}