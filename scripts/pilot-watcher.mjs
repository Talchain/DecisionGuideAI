#!/usr/bin/env node

/**
 * Pilot Watcher - Continuous monitoring during pilot operations
 * Every 5 minutes: quick health check and append to live-swap.log
 * Opt-in tool with clean shutdown on SIGINT
 */

import fetch from 'node-fetch';
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DURATION_MS = parseInt(process.env.DURATION_MS || (60 * 60 * 1000)); // 1 hour default
const LOG_FILE = join(__dirname, '..', 'artifacts', 'reports', 'live-swap.log');

// Health check timeout
const HEALTH_TIMEOUT = 10000; // 10 seconds

let intervalId = null;
let running = false;
let checks = 0;
let lastResults = []; // Store last few results to detect consecutive failures

/**
 * Format timestamp for log entries
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Ensure log directory exists
 */
function ensureLogDirectory() {
  const logDir = dirname(LOG_FILE);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Append line to live-swap.log
 */
function appendToLog(message) {
  try {
    appendFileSync(LOG_FILE, `${message}\n`);
  } catch (error) {
    console.error(`Failed to write to log: ${error.message}`);
  }
}

/**
 * Create incident stub for consecutive failures
 */
function createIncidentStub(consecutiveFailures) {
  const incidentId = `INC-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Determine catalogue phrase and remedy based on failure pattern
  let cataloguePhrase = 'Service Degradation';
  let suggestedRemedy = 'Check service health and restart if needed';

  if (consecutiveFailures >= 3) {
    cataloguePhrase = 'Service Outage';
    suggestedRemedy = 'Immediate escalation required - service unresponsive';
  } else if (consecutiveFailures === 2) {
    cataloguePhrase = 'Service Instability';
    suggestedRemedy = 'Monitor closely and prepare for potential restart';
  }

  const incidentStub = {
    id: incidentId,
    timestamp,
    severity: consecutiveFailures >= 3 ? 'critical' : 'warning',
    cataloguePhrase,
    description: `${consecutiveFailures} consecutive health check failures detected`,
    suggestedRemedy,
    detectedBy: 'pilot-watcher',
    target: BASE_URL,
    consecutiveFailures,
    status: 'open'
  };

  // Write incident stub to incidents directory
  const incidentsDir = join(dirname(LOG_FILE), 'incidents');
  if (!existsSync(incidentsDir)) {
    mkdirSync(incidentsDir, { recursive: true });
  }

  const incidentFile = join(incidentsDir, `${incidentId}.json`);
  try {
    writeFileSync(incidentFile, JSON.stringify(incidentStub, null, 2));
    console.log(`🚨 Incident stub created: ${incidentFile}`);

    // Also log to main log
    appendToLog(`# INCIDENT: ${incidentId} - ${cataloguePhrase} (${consecutiveFailures} consecutive failures)`);

    return incidentFile;
  } catch (error) {
    console.error(`Failed to create incident stub: ${error.message}`);
    return null;
  }
}

/**
 * Quick health check
 */
async function quickHealthCheck() {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

    const response = await fetch(`${BASE_URL}/health`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'pilot-watcher/1.0'
      }
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - start;

    if (response.ok) {
      return {
        status: 'PASS',
        duration,
        details: `HTTP ${response.status}`
      };
    } else {
      return {
        status: 'FAIL',
        duration,
        details: `HTTP ${response.status}`
      };
    }

  } catch (error) {
    const duration = Date.now() - start;

    if (error.name === 'AbortError') {
      return {
        status: 'FAIL',
        duration,
        details: 'Timeout'
      };
    }

    return {
      status: 'FAIL',
      duration,
      details: error.code || error.message
    };
  }
}

/**
 * Perform monitoring check and log result
 */
async function performCheck() {
  checks++;
  console.log(`[${timestamp()}] Check #${checks}: Running health check...`);

  const result = await quickHealthCheck();

  // Track result for consecutive failure detection
  lastResults.push(result.status);
  if (lastResults.length > 5) {
    lastResults.shift(); // Keep only last 5 results
  }

  const logEntry = `${timestamp()} | Check #${checks} | ${result.status} | ${result.duration}ms | ${result.details}`;

  // Log to file
  appendToLog(logEntry);

  // Console output
  const statusIcon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${statusIcon} ${result.status} (${result.duration}ms) - ${result.details}`);

  // Check for consecutive failures
  if (result.status === 'FAIL') {
    const consecutiveFailures = getConsecutiveFailures();
    if (consecutiveFailures >= 2) {
      console.log(`⚠️ ${consecutiveFailures} consecutive failures detected`);
      createIncidentStub(consecutiveFailures);
    }
  }

  return result;
}

/**
 * Count consecutive failures from the end of the results array
 */
function getConsecutiveFailures() {
  let count = 0;
  for (let i = lastResults.length - 1; i >= 0; i--) {
    if (lastResults[i] === 'FAIL') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Start monitoring
 */
async function startWatching() {
  console.log('🔍 Pilot Watcher Starting');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`⏱️  Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`🕐 Duration: ${DURATION_MS / 1000}s`);
  console.log(`📝 Log: ${LOG_FILE}`);
  console.log('');
  console.log('Press Ctrl+C to stop monitoring cleanly');
  console.log('');

  ensureLogDirectory();

  // Log start marker
  appendToLog(`# Pilot Watcher Session Started - ${timestamp()}`);
  appendToLog(`# Target: ${BASE_URL}, Interval: ${INTERVAL_MS}ms, Duration: ${DURATION_MS}ms`);

  running = true;

  // Initial check
  await performCheck();

  // Set up interval
  intervalId = setInterval(async () => {
    if (running) {
      await performCheck();
    }
  }, INTERVAL_MS);

  // Auto-stop after duration
  setTimeout(() => {
    if (running) {
      console.log('\n⏰ Duration limit reached, stopping watcher...');
      stopWatching();
    }
  }, DURATION_MS);
}

/**
 * Stop monitoring cleanly
 */
function stopWatching() {
  if (!running) return;

  running = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  // Log stop marker
  appendToLog(`# Pilot Watcher Session Ended - ${timestamp()} (${checks} checks completed)`);

  console.log('\n🛑 Pilot Watcher Stopped');
  console.log(`✅ Completed ${checks} health checks`);
  console.log(`📝 Results logged to: ${LOG_FILE}`);

  process.exit(0);
}

/**
 * Handle graceful shutdown
 */
function setupSignalHandlers() {
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    stopWatching();
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    stopWatching();
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    appendToLog(`# ERROR: ${timestamp()} - ${error.message}`);
    stopWatching();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection:', reason);
    appendToLog(`# ERROR: ${timestamp()} - Unhandled rejection: ${reason}`);
    stopWatching();
  });
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
🔍 Pilot Watcher - Continuous Monitoring Tool

Usage:
  node scripts/pilot-watcher.mjs [options]

Environment Variables:
  BASE_URL      Target URL to monitor (default: http://localhost:3001)
  DURATION_MS   How long to monitor in milliseconds (default: 3600000 = 1 hour)

Examples:
  # Monitor for 1 hour (default)
  node scripts/pilot-watcher.mjs

  # Monitor for 30 minutes
  DURATION_MS=1800000 node scripts/pilot-watcher.mjs

  # Monitor different URL
  BASE_URL=http://localhost:4001 node scripts/pilot-watcher.mjs

The watcher will:
- Perform health checks every 5 minutes
- Log results to artifacts/reports/live-swap.log
- Stop cleanly on Ctrl+C or after duration limit
- Run until manually stopped or duration expires

Log format: timestamp | check# | PASS/FAIL | duration | details
`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  // Setup signal handlers for clean shutdown
  setupSignalHandlers();

  try {
    await startWatching();
  } catch (error) {
    console.error('💥 Pilot watcher failed to start:', error.message);
    appendToLog(`# STARTUP ERROR: ${timestamp()} - ${error.message}`);
    process.exit(1);
  }
}

// Run the watcher
main();