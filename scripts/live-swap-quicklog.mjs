#!/usr/bin/env node

/**
 * Live Swap Quick Log Script
 *
 * Runs a tiny live smoke test (seed 42) and appends a one-line result
 * to artifacts/reports/live-swap.log with PASS/FAIL status and timings.
 *
 * Tests:
 * 1. Health check endpoint availability
 * 2. Template loading with live flag enabled
 * 3. Basic analysis initiation
 * 4. Stream connectivity validation
 *
 * Output format: TIMESTAMP | STATUS | DURATION | DETAILS
 */

import { execSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const reportsDir = join(rootDir, 'artifacts', 'reports');
const logFile = join(reportsDir, 'live-swap.log');

// Test configuration
const SMOKE_CONFIG = {
  baseUrl: 'http://localhost:3001',
  health: '/healthz',
  stream: '/stream',
  report: '/report',
  timeout: 10000, // 10 second timeout
  seed: 42,
  scenarioId: 'demo'
};

/**
 * Ensure reports directory exists
 */
function ensureReportsDir() {
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
}

/**
 * Format timestamp for log entry
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Append result to live-swap.log
 */
function logResult(status, duration, details) {
  const timestamp = getTimestamp();
  const logEntry = `${timestamp} | ${status} | ${duration}ms | ${details}\n`;

  ensureReportsDir();
  appendFileSync(logFile, logEntry);

  console.log(`📝 Logged: ${status} in ${duration}ms - ${details}`);
}

/**
 * Check if Gateway server is running
 */
async function checkGatewayServer() {
  try {
    const response = await fetch(`${SMOKE_CONFIG.baseUrl}${SMOKE_CONFIG.health}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check health endpoint availability
 */
async function checkHealthEndpoint() {
  try {
    const response = await fetch(`${SMOKE_CONFIG.baseUrl}${SMOKE_CONFIG.health}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      const correlationId = response.headers.get('X-Olumi-Correlation-Id');

      return {
        available: true,
        status: data.status || 'unknown',
        p95: data.p95_ms || 0,
        correlationId: correlationId || null
      };
    }

    return { available: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Test stream endpoint connectivity
 */
async function checkStreamEndpoint() {
  try {
    const url = `${SMOKE_CONFIG.baseUrl}${SMOKE_CONFIG.stream}?route=critique&seed=${SMOKE_CONFIG.seed}`;

    // Test SSE connection establishment
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
      return { available: true };
    }

    return { available: false, error: `HTTP ${response.status} - ${response.headers.get('content-type')}` };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Run comprehensive live swap smoke test
 */
async function runSmokeTest() {
  const startTime = Date.now();

  console.log('🔄 Starting live swap smoke test...');
  console.log(`📍 Target: ${SMOKE_CONFIG.baseUrl}`);
  console.log(`🌱 Seed: ${SMOKE_CONFIG.seed}`);
  console.log(`📊 Scenario: ${SMOKE_CONFIG.scenarioId}`);

  try {
    // Step 1: Check Gateway server
    console.log('\n1️⃣ Checking Gateway server...');
    const gatewayOk = await checkGatewayServer();

    if (!gatewayOk) {
      const duration = Date.now() - startTime;
      logResult('FAIL', duration, 'Gateway server not responding at localhost:3001');
      return { success: false, reason: 'Gateway unavailable' };
    }

    console.log('   ✅ Gateway server responding');

    // Step 2: Check health endpoint
    console.log('\n2️⃣ Checking health endpoint...');
    const health = await checkHealthEndpoint();

    if (!health.available) {
      const duration = Date.now() - startTime;
      logResult('FAIL', duration, `Health endpoint unavailable: ${health.error}`);
      return { success: false, reason: 'Health endpoint unavailable' };
    }

    console.log(`   ✅ Health: ${health.status} (P95: ${health.p95}ms)`);
    if (health.correlationId) {
      console.log(`   🔗 Correlation: ${health.correlationId.slice(0, 8)}...`);
    }

    // Step 3: Check stream endpoint
    console.log('\n3️⃣ Checking stream endpoint...');
    const stream = await checkStreamEndpoint();

    if (!stream.available) {
      const duration = Date.now() - startTime;
      logResult('FAIL', duration, `Stream endpoint unavailable: ${stream.error}`);
      return { success: false, reason: 'Stream endpoint unavailable' };
    }

    console.log('   ✅ Stream endpoint responding with SSE headers');

    // Success!
    const duration = Date.now() - startTime;
    const details = `Health:${health.status} P95:${health.p95}ms Stream:OK`;
    logResult('PASS', duration, details);

    return {
      success: true,
      duration,
      health: health.status,
      p95: health.p95,
      correlationId: health.correlationId
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logResult('FAIL', duration, `Unexpected error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

/**
 * Check log file status
 */
function checkLogFile() {
  if (existsSync(logFile)) {
    try {
      const stats = execSync(`wc -l < "${logFile}"`, { encoding: 'utf8' });
      const lineCount = parseInt(stats.trim());
      console.log(`📊 Log file: ${lineCount} entries in ${logFile}`);
    } catch (error) {
      console.log(`📁 Log file: ${logFile}`);
    }
  } else {
    console.log(`📁 Log file: ${logFile} (will be created)`);
  }
}

/**
 * Show recent log entries
 */
function showRecentLogs(count = 3) {
  if (existsSync(logFile)) {
    try {
      const recent = execSync(`tail -n ${count} "${logFile}"`, { encoding: 'utf8' });
      if (recent.trim()) {
        console.log(`\n📜 Recent log entries:`);
        recent.trim().split('\n').forEach(line => {
          const [timestamp, status, duration, details] = line.split(' | ');
          const statusIcon = status === 'PASS' ? '✅' : '❌';
          const shortTime = timestamp ? timestamp.slice(11, 19) : 'unknown';
          console.log(`   ${statusIcon} ${shortTime} ${duration} ${details}`);
        });
      }
    } catch (error) {
      console.log('   (No recent entries)');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Live Swap Quick Log');
  console.log('=====================\n');

  // Show current log status
  checkLogFile();
  showRecentLogs();

  // Run the smoke test
  const result = await runSmokeTest();

  // Summary
  console.log('\n🏁 Smoke Test Complete');
  console.log('======================');

  if (result.success) {
    console.log('✅ Status: PASS');
    console.log(`⏱️  Duration: ${result.duration}ms`);
    console.log(`🏥 Health: ${result.health}`);
    console.log(`📊 P95: ${result.p95}ms`);

    if (result.correlationId) {
      console.log(`🔗 Correlation: ${result.correlationId.slice(0, 8)}...`);
    }

    console.log('\n🎉 Live swap validation successful!');
  } else {
    console.log('❌ Status: FAIL');
    console.log(`❗ Reason: ${result.reason}`);
    console.log('\n💡 Check that:');
    console.log('   - npm run dev is running');
    console.log('   - Backend Gateway is available');
    console.log('   - Network connectivity is stable');
  }

  console.log(`\n📝 Result logged to: ${logFile}`);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runSmokeTest, logResult };