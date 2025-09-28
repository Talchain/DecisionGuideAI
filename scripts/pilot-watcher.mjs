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
const LOG_FILE = join(__dirname, '..', 'artifacts', 'reports', 'live-swap.log');

// Health check timeout
const HEALTH_TIMEOUT = 10000; // 10 seconds

let intervalId = null;
let running = false;
let checks = 0;
let passes = 0;
let failures = 0;
let lastResults = []; // Store last few results to detect consecutive failures
let consecutiveFailures = 0;
let sessionStartTime = 0;
let durationMs = 60 * 60 * 1000; // Default 1 hour, will be overridden by CLI args

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
 * Calculate exponential backoff delay for consecutive failures
 */
function calculateBackoffDelay(failures) {
  // Base delay is the normal interval (5 minutes)
  // Exponential backoff: 5min, 10min, 20min, 40min (max)
  const baseDelay = INTERVAL_MS;
  const multiplier = Math.min(Math.pow(2, failures - 1), 8); // Cap at 8x
  return baseDelay * multiplier;
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

  // Update counters
  if (result.status === 'PASS') {
    passes++;
    consecutiveFailures = 0; // Reset consecutive failure counter
  } else {
    failures++;
    consecutiveFailures++;
  }

  const logEntry = `${timestamp()} | Check #${checks} | ${result.status} | ${result.duration}ms | ${result.details}`;

  // Log to file
  appendToLog(logEntry);

  // Console output
  const statusIcon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${statusIcon} ${result.status} (${result.duration}ms) - ${result.details}`);

  // Handle consecutive failures with exponential backoff
  if (result.status === 'FAIL') {
    if (consecutiveFailures >= 2) {
      console.log(`⚠️ ${consecutiveFailures} consecutive failures detected`);
      createIncidentStub(consecutiveFailures);

      // Calculate exponential backoff delay
      const backoffDelay = calculateBackoffDelay(consecutiveFailures);
      const extraDelay = backoffDelay - INTERVAL_MS;

      if (extraDelay > 0) {
        console.log(`🔄 Applying exponential backoff: +${extraDelay/1000}s (total interval: ${backoffDelay/1000}s)`);
        appendToLog(`# BACKOFF: Next check delayed by ${extraDelay/1000}s due to ${consecutiveFailures} consecutive failures`);

        // Extend the next interval
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = setTimeout(async () => {
            if (running) {
              await performCheck();
              // Resume normal interval
              intervalId = setInterval(async () => {
                if (running) await performCheck();
              }, INTERVAL_MS);
            }
          }, backoffDelay);
        }
      }
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
  sessionStartTime = Date.now();

  console.log('🔍 Pilot Watcher Starting');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`⏱️  Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`🕐 Duration: ${durationMs / 1000}s (${Math.round(durationMs / 60000)} minutes)`);
  console.log(`📝 Log: ${LOG_FILE}`);
  console.log('');
  console.log('Press Ctrl+C to stop monitoring cleanly');
  console.log('');

  ensureLogDirectory();

  // Log start marker
  appendToLog(`# Pilot Watcher Session Started - ${timestamp()}`);
  appendToLog(`# Target: ${BASE_URL}, Interval: ${INTERVAL_MS}ms, Duration: ${durationMs}ms`);

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
  }, durationMs);
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

  // Calculate session stats
  const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000);
  const passRate = checks > 0 ? Math.round((passes / checks) * 100) : 0;
  const overallStatus = passRate >= 90 ? 'HEALTHY' : passRate >= 70 ? 'DEGRADED' : 'UNHEALTHY';

  // Generate final capsule line
  const capsuleLine = `CAPSULE: ${timestamp()} | Window: ${sessionDuration}s | Checks: ${checks} | PASS: ${passes} | FAIL: ${failures} | Rate: ${passRate}% | Status: ${overallStatus}`;

  // Log session summary
  appendToLog(`# Pilot Watcher Session Ended - ${timestamp()} (${checks} checks completed)`);
  appendToLog(`# Session Summary: ${sessionDuration}s runtime, ${passes}/${checks} passed (${passRate}%)`);
  appendToLog(capsuleLine);

  console.log('\n🛑 Pilot Watcher Stopped');
  console.log(`✅ Completed ${checks} health checks in ${sessionDuration}s`);
  console.log(`📊 Results: ${passes} PASS, ${failures} FAIL (${passRate}% success rate)`);
  console.log(`🏥 Overall Status: ${overallStatus}`);
  console.log(`📝 Results logged to: ${LOG_FILE}`);
  console.log(`\n📋 Final Capsule: ${capsuleLine}`);

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
 * Parse CLI arguments
 */
function parseArguments(args) {
  const options = {
    duration: 60, // Default 60 minutes
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--duration' || arg === '-d') {
      const nextArg = args[i + 1];
      if (nextArg && !isNaN(nextArg)) {
        options.duration = parseInt(nextArg);
        i++; // Skip next argument
      } else {
        throw new Error('--duration requires a numeric value in minutes');
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
🔍 Pilot Watcher - Continuous Monitoring Tool

Usage:
  node scripts/pilot-watcher.mjs [options]

Options:
  --duration <minutes>    How long to monitor (default: 60 minutes)
  --help, -h             Show this help message

Environment Variables:
  BASE_URL               Target URL to monitor (default: http://localhost:3001)

Examples:
  # Monitor for 1 hour (default)
  node scripts/pilot-watcher.mjs

  # Monitor for 30 minutes
  node scripts/pilot-watcher.mjs --duration 30

  # Monitor for 2 hours
  node scripts/pilot-watcher.mjs --duration 120

  # Monitor different URL for 45 minutes
  BASE_URL=http://localhost:4001 node scripts/pilot-watcher.mjs --duration 45

Features:
- Performs health checks every 5 minutes
- Exponential backoff on repeated failures (5min → 10min → 20min → 40min)
- Incident stub creation for consecutive failures
- Final capsule line summarising PASS/FAIL for the monitoring window
- Clean shutdown on Ctrl+C or after duration limit
- Comprehensive logging to artifacts/reports/live-swap.log

Log format: timestamp | check# | PASS/FAIL | duration | details
Capsule format: CAPSULE: timestamp | Window: Xs | Checks: N | PASS: N | FAIL: N | Rate: N% | Status: HEALTHY/DEGRADED/UNHEALTHY
`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    const options = parseArguments(args);

    if (options.help) {
      showUsage();
      return;
    }

    // Set duration from CLI argument
    durationMs = options.duration * 60 * 1000; // Convert minutes to milliseconds

    // Setup signal handlers for clean shutdown
    setupSignalHandlers();

    await startWatching();
  } catch (error) {
    if (error.message.includes('Unknown argument') || error.message.includes('requires a numeric value')) {
      console.error(`❌ ${error.message}`);
      console.log('\nUse --help for usage information');
      process.exit(1);
    }

    console.error('💥 Pilot watcher failed to start:', error.message);
    appendToLog(`# STARTUP ERROR: ${timestamp()} - ${error.message}`);
    process.exit(1);
  }
}

// Run the watcher
main();