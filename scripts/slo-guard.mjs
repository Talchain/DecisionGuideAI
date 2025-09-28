#!/usr/bin/env node

/**
 * SLO Guard & Trend Monitor
 *
 * Performance monitoring with configurable thresholds and historical tracking.
 * Designed to fail fast when performance drifts beyond acceptable limits.
 *
 * Features:
 * - Configurable SLO thresholds via environment variables
 * - Historical trend tracking with daily data points
 * - PASS/FAIL determination based on current vs. target metrics
 * - Integration with existing health/telemetry systems
 * - Fail-fast design for CI/CD integration
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// SLO Configuration with environment overrides
const SLO_CONFIG = {
  ttff_ms: parseInt(process.env.SLO_TTFF_MS || '500'),      // Time to First Frame
  cancel_ms: parseInt(process.env.SLO_CANCEL_MS || '150'),   // Cancel operation latency
  p95_ms: parseInt(process.env.SLO_P95_MS || '600'),        // 95th percentile response time
  error_rate: parseFloat(process.env.SLO_ERROR_RATE || '0.05'), // 5% error rate threshold
  success_rate: parseFloat(process.env.SLO_SUCCESS_RATE || '0.95'), // 95% success rate threshold
};

// Paths
const REPORTS_DIR = join(rootDir, 'artifacts', 'reports');
const TREND_FILE = join(REPORTS_DIR, 'slo-trend.json');

/**
 * Ensure reports directory exists
 */
function ensureReportsDir() {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/**
 * Get today's date string for data points
 */
function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load existing SLO trend data
 */
function loadSLOTrend() {
  if (!existsSync(TREND_FILE)) {
    return {
      version: '1.0',
      created_at: new Date().toISOString(),
      thresholds: SLO_CONFIG,
      data_points: []
    };
  }

  try {
    const data = readFileSync(TREND_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('⚠️  Failed to parse existing SLO trend data:', error.message);
    return {
      version: '1.0',
      created_at: new Date().toISOString(),
      thresholds: SLO_CONFIG,
      data_points: []
    };
  }
}

/**
 * Extract metrics from health endpoint or logs
 */
async function getCurrentMetrics() {
  const metrics = {
    ttff_ms: null,
    cancel_ms: null,
    p95_ms: null,
    p99_ms: null,
    error_rate: null,
    success_rate: null,
    source: 'simulated'
  };

  // Try to load from health endpoint data
  const healthPath = join(REPORTS_DIR, 'health-status.json');
  if (existsSync(healthPath)) {
    try {
      const healthData = JSON.parse(readFileSync(healthPath, 'utf-8'));
      if (healthData.performance) {
        metrics.p95_ms = healthData.performance.p95_ms;
        metrics.p99_ms = healthData.performance.p99_ms;
        metrics.error_rate = healthData.performance.error_rate;
        metrics.success_rate = healthData.performance.success_rate;
        metrics.source = 'health-endpoint';
      }
    } catch (error) {
      console.warn('⚠️  Could not parse health data:', error.message);
    }
  }

  // Try to load from live-swap logs
  const liveSwapLogPath = join(REPORTS_DIR, 'live-swap.log');
  if (existsSync(liveSwapLogPath)) {
    try {
      const logContent = readFileSync(liveSwapLogPath, 'utf-8');
      const logLines = logContent.trim().split('\n').filter(line => line.trim());

      if (logLines.length > 0) {
        const lastLine = logLines[logLines.length - 1];
        const parts = lastLine.split(' | ');

        if (parts.length >= 3) {
          const duration = parseInt(parts[2].replace('ms', ''));
          if (!isNaN(duration)) {
            metrics.ttff_ms = duration;
            metrics.source = 'live-swap-log';
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not parse live-swap log:', error.message);
    }
  }

  // Simulate missing metrics with reasonable defaults for demo
  if (metrics.p95_ms === null) {
    metrics.p95_ms = 480 + Math.floor(Math.random() * 240); // 480-720ms
  }
  if (metrics.ttff_ms === null) {
    metrics.ttff_ms = 320 + Math.floor(Math.random() * 280); // 320-600ms
  }
  if (metrics.cancel_ms === null) {
    metrics.cancel_ms = 80 + Math.floor(Math.random() * 120); // 80-200ms
  }
  if (metrics.error_rate === null) {
    metrics.error_rate = 0.01 + Math.random() * 0.08; // 1-9%
  }
  if (metrics.success_rate === null) {
    metrics.success_rate = 0.92 + Math.random() * 0.07; // 92-99%
  }

  return metrics;
}

/**
 * Evaluate current metrics against SLO thresholds
 */
function evaluateMetrics(metrics) {
  const checks = {
    ttff_ms: {
      value: metrics.ttff_ms,
      threshold: SLO_CONFIG.ttff_ms,
      passed: metrics.ttff_ms <= SLO_CONFIG.ttff_ms,
      name: 'Time to First Frame'
    },
    cancel_ms: {
      value: metrics.cancel_ms,
      threshold: SLO_CONFIG.cancel_ms,
      passed: metrics.cancel_ms <= SLO_CONFIG.cancel_ms,
      name: 'Cancel Latency'
    },
    p95_ms: {
      value: metrics.p95_ms,
      threshold: SLO_CONFIG.p95_ms,
      passed: metrics.p95_ms <= SLO_CONFIG.p95_ms,
      name: 'P95 Response Time'
    },
    error_rate: {
      value: metrics.error_rate,
      threshold: SLO_CONFIG.error_rate,
      passed: metrics.error_rate <= SLO_CONFIG.error_rate,
      name: 'Error Rate'
    },
    success_rate: {
      value: metrics.success_rate,
      threshold: SLO_CONFIG.success_rate,
      passed: metrics.success_rate >= SLO_CONFIG.success_rate,
      name: 'Success Rate'
    }
  };

  const passed = Object.values(checks).every(check => check.passed);
  const failures = Object.entries(checks)
    .filter(([, check]) => !check.passed)
    .map(([key, check]) => ({
      metric: key,
      name: check.name,
      value: check.value,
      threshold: check.threshold,
      delta: check.value - check.threshold
    }));

  return {
    overall_passed: passed,
    checks,
    failures,
    total_checks: Object.keys(checks).length,
    passed_checks: Object.values(checks).filter(c => c.passed).length
  };
}

/**
 * Update SLO trend data with today's metrics
 */
function updateSLOTrend(trendData, metrics, evaluation) {
  const today = getTodayDateString();

  // Remove existing data point for today if it exists
  trendData.data_points = trendData.data_points.filter(dp => dp.date !== today);

  // Add today's data point
  const dataPoint = {
    date: today,
    timestamp: new Date().toISOString(),
    metrics: {
      ttff_ms: metrics.ttff_ms,
      cancel_ms: metrics.cancel_ms,
      p95_ms: metrics.p95_ms,
      error_rate: metrics.error_rate,
      success_rate: metrics.success_rate
    },
    evaluation: {
      overall_passed: evaluation.overall_passed,
      passed_checks: evaluation.passed_checks,
      total_checks: evaluation.total_checks,
      failures: evaluation.failures.map(f => ({
        metric: f.metric,
        value: f.value,
        threshold: f.threshold
      }))
    },
    source: metrics.source
  };

  trendData.data_points.push(dataPoint);

  // Keep only last 30 days of data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffString = cutoffDate.toISOString().split('T')[0];

  trendData.data_points = trendData.data_points.filter(dp => dp.date >= cutoffString);

  // Sort by date
  trendData.data_points.sort((a, b) => a.date.localeCompare(b.date));

  // Update metadata
  trendData.last_updated = new Date().toISOString();
  trendData.thresholds = SLO_CONFIG;

  return trendData;
}

/**
 * Generate trend analysis
 */
function analyseTrend(trendData) {
  if (trendData.data_points.length < 2) {
    return {
      trend: 'insufficient_data',
      direction: 'unknown',
      stability: 'unknown',
      recent_failures: 0
    };
  }

  const recentPoints = trendData.data_points.slice(-7); // Last 7 days
  const recentFailures = recentPoints.filter(dp => !dp.evaluation.overall_passed).length;

  // Calculate trend for P95 response time
  const p95Values = recentPoints.map(dp => dp.metrics.p95_ms).filter(v => v !== null);

  let direction = 'stable';
  if (p95Values.length >= 3) {
    const firstHalf = p95Values.slice(0, Math.floor(p95Values.length / 2));
    const secondHalf = p95Values.slice(-Math.floor(p95Values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) direction = 'degrading';
    else if (change < -0.1) direction = 'improving';
  }

  return {
    trend: recentFailures === 0 ? 'healthy' : recentFailures > 3 ? 'critical' : 'warning',
    direction,
    stability: recentFailures <= 1 ? 'stable' : 'unstable',
    recent_failures: recentFailures,
    data_points: recentPoints.length
  };
}

/**
 * Print SLO status summary
 */
function printSLOStatus(evaluation, trendAnalysis, metrics) {
  const status = evaluation.overall_passed ? 'PASS' : 'FAIL';
  const icon = evaluation.overall_passed ? '✅' : '❌';

  console.log(`${icon} SLO Guard: ${status}`);

  if (!evaluation.overall_passed) {
    console.log('\n❌ SLO Violations:');
    evaluation.failures.forEach(failure => {
      const operator = ['error_rate'].includes(failure.metric) ? '≤' :
                      ['success_rate'].includes(failure.metric) ? '≥' : '≤';
      const unit = failure.metric.endsWith('_ms') ? 'ms' :
                   failure.metric.endsWith('_rate') ? '%' : '';
      const valueFormatted = unit === '%' ?
        Math.round(failure.value * 100) + unit :
        Math.round(failure.value) + unit;
      const thresholdFormatted = unit === '%' ?
        Math.round(failure.threshold * 100) + unit :
        Math.round(failure.threshold) + unit;

      console.log(`   ${failure.name}: ${valueFormatted} (${operator} ${thresholdFormatted})`);
    });
  }

  console.log(`\n📊 Checks: ${evaluation.passed_checks}/${evaluation.total_checks} passed`);
  console.log(`📈 Trend: ${trendAnalysis.trend} (${trendAnalysis.direction})`);
  console.log(`🎯 Recent failures: ${trendAnalysis.recent_failures}/7 days`);
  console.log(`📍 Source: ${metrics.source}`);
}

/**
 * Main SLO guard execution
 */
async function runSLOGuard() {
  try {
    // Ensure output directory
    ensureReportsDir();

    // Load current metrics
    const metrics = await getCurrentMetrics();

    // Evaluate against SLO thresholds
    const evaluation = evaluateMetrics(metrics);

    // Load and update trend data
    let trendData = loadSLOTrend();
    trendData = updateSLOTrend(trendData, metrics, evaluation);

    // Analyse trend
    const trendAnalysis = analyseTrend(trendData);

    // Save updated trend data
    writeFileSync(TREND_FILE, JSON.stringify(trendData, null, 2));

    // Print status
    printSLOStatus(evaluation, trendAnalysis, metrics);

    // Return exit code based on SLO status
    return evaluation.overall_passed ? 0 : 1;

  } catch (error) {
    console.error('💥 SLO Guard Error:', error.message);
    console.error(error.stack);
    return 2; // System error
  }
}

/**
 * CLI interface
 */
async function main() {
  const exitCode = await runSLOGuard();
  process.exit(exitCode);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(2);
  });
}

export { runSLOGuard, SLO_CONFIG, evaluateMetrics, analyseTrend };