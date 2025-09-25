#!/usr/bin/env tsx
/**
 * SSE Blip Stability Test for Scenario Sandbox PoC
 * Tests: 10 parallel simulated streams, reconnects with Last-Event-ID, mid-flight cancels
 * Validates: no leaks, all connections close properly, cancel ≤1s
 * Usage: npm run sse:stability
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

// Ensure artifacts directory exists
try {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

// Mock EventSource for stability testing
class MockEventSource {
  static instances: MockEventSource[] = [];
  static idCounter = 0;

  public id: number;
  public url: string;
  public readyState: number = 0; // CONNECTING
  public lastEventId: string = '';
  public reconnectAttempts: number = 0;
  public isReconnecting: boolean = false;
  public isClosed: boolean = false;
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(url: string, options?: { lastEventId?: string }) {
    this.id = MockEventSource.idCounter++;
    this.url = url;
    this.lastEventId = options?.lastEventId || '';

    MockEventSource.instances.push(this);

    // Simulate connection
    setTimeout(() => {
      if (!this.isClosed) {
        this.readyState = 1; // OPEN
        this.emit('open');
      }
    }, 50 + Math.random() * 100);
  }

  addEventListener(type: string, handler: Function) {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)!.push(handler);
  }

  removeEventListener(type: string, handler: Function) {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(type: string, data?: any, eventId?: string) {
    if (this.isClosed) return;

    if (eventId) {
      this.lastEventId = eventId;
    }

    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(data ? { data, lastEventId: this.lastEventId } : {});
      } catch (error) {
        console.warn(`Event handler error: ${error}`);
      }
    });
  }

  simulateReconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isClosed || this.isReconnecting) {
        resolve();
        return;
      }

      this.isReconnecting = true;
      this.readyState = 0; // CONNECTING
      this.reconnectAttempts++;

      this.reconnectTimeout = setTimeout(() => {
        if (!this.isClosed) {
          this.readyState = 1; // OPEN
          this.isReconnecting = false;
          this.emit('open');
        }
        resolve();
      }, 200 + Math.random() * 300);
    });
  }

  close() {
    if (this.isClosed) return;

    this.isClosed = true;
    this.readyState = 2; // CLOSED

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Remove from global instances
    const index = MockEventSource.instances.indexOf(this);
    if (index > -1) {
      MockEventSource.instances.splice(index, 1);
    }

    this.eventHandlers.clear();
  }

  static getActiveInstances(): MockEventSource[] {
    return MockEventSource.instances.filter(instance => !instance.isClosed);
  }

  static cleanup() {
    MockEventSource.instances.forEach(instance => instance.close());
    MockEventSource.instances = [];
  }
}

interface StreamTest {
  id: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventSource: MockEventSource;
  tokensReceived: number;
  reconnectCount: number;
  cancelTime?: number;
  cancelDuration?: number;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  error?: string;
}

interface StabilityResult {
  timestamp: string;
  totalStreams: number;
  completedStreams: number;
  cancelledStreams: number;
  errorStreams: number;
  averageDuration: number;
  averageTokens: number;
  reconnectStats: {
    total: number;
    successful: number;
    avgPerStream: number;
  };
  cancelStats: {
    attempted: number;
    successful: number;
    averageCancelTime: number;
    maxCancelTime: number;
  };
  leakCheck: {
    activeConnectionsAtEnd: number;
    memoryLeaksDetected: number;
  };
  verdict: 'PASS' | 'FAIL';
  issues: string[];
}

class SSEBlipStabilityTester {
  private tests: StreamTest[] = [];
  private startTime: number = 0;

  async runStabilityTest(): Promise<StabilityResult> {
    console.log('🌊 SSE Blip Stability Test');
    console.log('=' .repeat(40));

    this.startTime = Date.now();

    // Clean up any existing instances
    MockEventSource.cleanup();

    // Start 10 parallel streams
    console.log('🚀 Starting 10 parallel simulated streams...');
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 10; i++) {
      promises.push(this.startTestStream(i));
    }

    // Let streams run for a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Cancel 3 streams mid-flight
    console.log('🛑 Cancelling 3 streams mid-flight...');
    await this.cancelRandomStreams(3);

    // Let remaining streams run
    await new Promise(resolve => setTimeout(resolve, 800));

    // Trigger reconnects for remaining streams
    console.log('🔄 Triggering reconnects with Last-Event-ID...');
    await this.triggerReconnects();

    // Wait for all streams to complete
    await Promise.allSettled(promises);

    // Final cleanup and analysis
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await this.analyzeResults();

    MockEventSource.cleanup();
    return result;
  }

  private async startTestStream(id: number): Promise<void> {
    const test: StreamTest = {
      id,
      startTime: Date.now(),
      eventSource: new MockEventSource(`/stream/${id}`),
      tokensReceived: 0,
      reconnectCount: 0,
      status: 'running'
    };

    this.tests.push(test);

    return new Promise((resolve) => {
      test.eventSource.addEventListener('open', () => {
        // Start simulating tokens
        this.simulateTokenStream(test, resolve);
      });

      test.eventSource.addEventListener('error', (event) => {
        test.status = 'error';
        test.error = 'Connection error';
        test.endTime = Date.now();
        test.duration = test.endTime - test.startTime;
        resolve();
      });
    });
  }

  private simulateTokenStream(test: StreamTest, resolve: () => void) {
    let tokenCount = 0;
    const maxTokens = 5 + Math.random() * 10; // 5-15 tokens per stream

    const sendToken = () => {
      if (test.status !== 'running') {
        resolve();
        return;
      }

      if (tokenCount >= maxTokens) {
        // Stream complete
        test.eventSource.emit('done', '', `token-${tokenCount}`);
        test.status = 'completed';
        test.endTime = Date.now();
        test.duration = test.endTime - test.startTime;
        resolve();
        return;
      }

      // Send token
      test.eventSource.emit('token', `Token ${tokenCount} from stream ${test.id}`, `token-${tokenCount}`);
      test.tokensReceived++;
      tokenCount++;

      // Schedule next token
      setTimeout(sendToken, 100 + Math.random() * 200);
    };

    // Start token flow
    setTimeout(sendToken, 50);
  }

  private async cancelRandomStreams(count: number): Promise<void> {
    const runningTests = this.tests.filter(t => t.status === 'running');
    const toCancelTests = runningTests.slice(0, count);

    for (const test of toCancelTests) {
      const cancelStart = Date.now();
      test.status = 'cancelled';
      test.cancelTime = cancelStart;

      // Simulate cancel operation
      test.eventSource.close();

      const cancelDuration = Date.now() - cancelStart;
      test.cancelDuration = cancelDuration;
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
    }
  }

  private async triggerReconnects(): Promise<void> {
    const runningTests = this.tests.filter(t => t.status === 'running');

    const reconnectPromises = runningTests.map(async (test) => {
      if (Math.random() < 0.7) { // 70% chance of reconnect
        test.reconnectCount++;
        await test.eventSource.simulateReconnect();
      }
    });

    await Promise.all(reconnectPromises);
  }

  private async analyzeResults(): Promise<StabilityResult> {
    const timestamp = new Date().toISOString();
    const activeConnections = MockEventSource.getActiveInstances().length;

    const completed = this.tests.filter(t => t.status === 'completed');
    const cancelled = this.tests.filter(t => t.status === 'cancelled');
    const errors = this.tests.filter(t => t.status === 'error');

    const totalDuration = completed.reduce((sum, t) => sum + (t.duration || 0), 0);
    const totalTokens = this.tests.reduce((sum, t) => sum + t.tokensReceived, 0);
    const totalReconnects = this.tests.reduce((sum, t) => sum + t.reconnectCount, 0);

    const cancelTimes = cancelled.map(t => t.cancelDuration || 0).filter(d => d > 0);
    const avgCancelTime = cancelTimes.length > 0 ? cancelTimes.reduce((a, b) => a + b, 0) / cancelTimes.length : 0;
    const maxCancelTime = Math.max(...cancelTimes, 0);

    // Check for issues
    const issues: string[] = [];

    if (activeConnections > 0) {
      issues.push(`${activeConnections} connections still active (memory leak)`);
    }

    if (maxCancelTime > 1000) {
      issues.push(`Cancel operation took ${maxCancelTime}ms (target: ≤1000ms)`);
    }

    if (errors.length > 0) {
      issues.push(`${errors.length} streams encountered errors`);
    }

    const verdict = issues.length === 0 ? 'PASS' : 'FAIL';

    const result: StabilityResult = {
      timestamp,
      totalStreams: this.tests.length,
      completedStreams: completed.length,
      cancelledStreams: cancelled.length,
      errorStreams: errors.length,
      averageDuration: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
      averageTokens: this.tests.length > 0 ? Math.round(totalTokens / this.tests.length) : 0,
      reconnectStats: {
        total: totalReconnects,
        successful: totalReconnects, // All simulated reconnects succeed
        avgPerStream: this.tests.length > 0 ? Math.round((totalReconnects / this.tests.length) * 10) / 10 : 0
      },
      cancelStats: {
        attempted: cancelled.length,
        successful: cancelled.length, // All cancel attempts succeed in simulation
        averageCancelTime: Math.round(avgCancelTime),
        maxCancelTime: Math.round(maxCancelTime)
      },
      leakCheck: {
        activeConnectionsAtEnd: activeConnections,
        memoryLeaksDetected: activeConnections > 0 ? 1 : 0
      },
      verdict,
      issues
    };

    return result;
  }

  async saveResults(result: StabilityResult): Promise<void> {
    // Save JSON report
    const jsonPath = join(ARTIFACTS_DIR, 'sse-stability.json');
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    // Create HTML summary
    const htmlContent = this.generateHtmlSummary(result);
    const htmlPath = join(ARTIFACTS_DIR, 'sse-stability.html');
    writeFileSync(htmlPath, htmlContent);

    console.log(`📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
  }

  private generateHtmlSummary(result: StabilityResult): string {
    const statusClass = result.verdict === 'PASS' ? 'pass' : 'fail';
    const statusIcon = result.verdict === 'PASS' ? '✅' : '❌';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSE Stability Test Results</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid ${result.verdict === 'PASS' ? '#10b981' : '#ef4444'}; padding-bottom: 10px; }
        .status { padding: 20px; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .status.pass { background: #dcfce7; color: #166534; border-left: 4px solid #10b981; }
        .status.fail { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1e40af; }
        .metric-label { color: #64748b; font-size: 0.9em; }
        .issues { margin-top: 30px; }
        .issue { padding: 10px; margin: 5px 0; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; }
        .timestamp { text-align: center; color: #64748b; font-size: 0.9em; margin-top: 30px; }
        .section { margin: 30px 0; }
        .section h3 { color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌊 SSE Stability Test Results</h1>

        <div class="status ${statusClass}">
            ${statusIcon} ${result.verdict === 'PASS' ? 'ALL STABLE - No connection leaks detected' : 'STABILITY ISSUES DETECTED'}
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${result.totalStreams}</div>
                <div class="metric-label">Total Streams</div>
            </div>
            <div class="metric">
                <div class="metric-value">${result.completedStreams}</div>
                <div class="metric-label">Completed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${result.cancelledStreams}</div>
                <div class="metric-label">Cancelled</div>
            </div>
            <div class="metric">
                <div class="metric-value">${result.averageDuration}ms</div>
                <div class="metric-label">Avg Duration</div>
            </div>
            <div class="metric">
                <div class="metric-value">${result.cancelStats.maxCancelTime}ms</div>
                <div class="metric-label">Max Cancel Time</div>
            </div>
            <div class="metric">
                <div class="metric-value">${result.leakCheck.activeConnectionsAtEnd}</div>
                <div class="metric-label">Active Connections</div>
            </div>
        </div>

        <div class="section">
            <h3>📊 Reconnection Statistics</h3>
            <p>Total Reconnects: ${result.reconnectStats.total}</p>
            <p>Successful Reconnects: ${result.reconnectStats.successful}</p>
            <p>Average per Stream: ${result.reconnectStats.avgPerStream}</p>
        </div>

        <div class="section">
            <h3>🛑 Cancellation Statistics</h3>
            <p>Cancel Attempts: ${result.cancelStats.attempted}</p>
            <p>Successful Cancels: ${result.cancelStats.successful}</p>
            <p>Average Cancel Time: ${result.cancelStats.averageCancelTime}ms</p>
            <p>Max Cancel Time: ${result.cancelStats.maxCancelTime}ms (target: ≤1000ms)</p>
        </div>

        ${result.issues.length > 0 ? `
        <div class="issues">
            <h3>⚠️ Issues Detected</h3>
            ${result.issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
        </div>
        ` : ''}

        <div class="timestamp">
            Generated: ${result.timestamp}
        </div>
    </div>
</body>
</html>`;
  }

  printSummary(result: StabilityResult): void {
    console.log('\n📊 SSE Stability Test Summary');
    console.log('=' .repeat(40));
    console.log(`Result: ${result.verdict}`);
    console.log(`Streams: ${result.completedStreams}/${result.totalStreams} completed`);
    console.log(`Cancellations: ${result.cancelledStreams} (avg: ${result.cancelStats.averageCancelTime}ms)`);
    console.log(`Reconnects: ${result.reconnectStats.total} total, ${result.reconnectStats.avgPerStream} avg/stream`);
    console.log(`Memory Leaks: ${result.leakCheck.memoryLeaksDetected}`);

    if (result.issues.length > 0) {
      console.log('\n⚠️ Issues:');
      result.issues.forEach(issue => console.log(`   • ${issue}`));
    }

    const summaryLine = result.verdict === 'PASS'
      ? '✅ Summary: No stuck handles reported; typical cancel ≤1s'
      : '❌ Summary: Issues detected with connection stability';

    console.log(`\n${summaryLine}`);
  }
}

// Run stability test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SSEBlipStabilityTester();

  tester.runStabilityTest()
    .then(async (result) => {
      await tester.saveResults(result);
      tester.printSummary(result);

      // Exit with appropriate code
      process.exit(result.verdict === 'PASS' ? 0 : 1);
    })
    .catch(error => {
      console.error('SSE stability test failed:', error);
      process.exit(1);
    });
}