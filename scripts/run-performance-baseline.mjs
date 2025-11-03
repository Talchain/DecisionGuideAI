#!/usr/bin/env node
/**
 * Performance Baseline Runner
 *
 * Captures performance metrics for the application and compares against baseline.
 * Useful for detecting performance regressions before deployment.
 *
 * Usage:
 *   npm run perf:baseline          # Run and compare against baseline
 *   npm run perf:baseline --save   # Save current metrics as new baseline
 *   npm run perf:baseline --report # Generate detailed report
 *
 * Metrics captured:
 * - Bundle sizes (main, vendor, chunks)
 * - Build time
 * - Lighthouse scores (if available)
 * - Test execution time
 *
 * Environment variables:
 *   PERF_THRESHOLD_PCT=10         # Max allowed regression % (default: 10)
 *   PERF_BASELINE_FILE=<path>     # Custom baseline file path
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASELINE_FILE = process.env.PERF_BASELINE_FILE || 'performance-baseline.json';
const THRESHOLD_PCT = parseInt(process.env.PERF_THRESHOLD_PCT || '10', 10);
const IS_SAVE_MODE = process.argv.includes('--save');
const IS_REPORT_MODE = process.argv.includes('--report');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatMs(ms) {
  return `${ms.toFixed(0)}ms`;
}

function formatPct(pct) {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Measure bundle sizes
 */
function measureBundleSizes() {
  log('\n📦 Measuring bundle sizes...', 'blue');

  try {
    // Build the project
    const buildStart = Date.now();
    execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
    const buildTime = Date.now() - buildStart;

    // Get dist file sizes
    const distFiles = execSync('find dist -type f -name "*.js" -o -name "*.css"', {
      encoding: 'utf-8'
    }).trim().split('\n').filter(Boolean);

    let totalSize = 0;
    const files = {};

    for (const file of distFiles) {
      const stat = execSync(`stat -f%z "${file}"`, { encoding: 'utf-8' }).trim();
      const size = parseInt(stat, 10);
      totalSize += size;

      const name = file.replace('dist/', '');
      files[name] = size;
    }

    return {
      buildTime,
      totalSize,
      files
    };
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Measure test execution time
 */
function measureTestTime() {
  log('\n🧪 Measuring test execution time...', 'blue');

  try {
    const testStart = Date.now();
    execSync('npm run test:unit -- --run', { encoding: 'utf-8', stdio: 'pipe' });
    const testTime = Date.now() - testStart;

    return { testTime };
  } catch (error) {
    log(`⚠️  Tests failed: ${error.message}`, 'yellow');
    return { testTime: null };
  }
}

/**
 * Measure E2E test time
 */
function measureE2ETime() {
  log('\n🎭 Measuring E2E execution time...', 'blue');

  try {
    const e2eStart = Date.now();
    execSync('npm run test:e2e:headless', { encoding: 'utf-8', stdio: 'pipe' });
    const e2eTime = Date.now() - e2eStart;

    return { e2eTime };
  } catch (error) {
    log(`⚠️  E2E tests failed or not available: ${error.message}`, 'yellow');
    return { e2eTime: null };
  }
}

/**
 * Run all performance measurements
 */
async function runMeasurements() {
  log('🚀 Starting performance baseline measurements...', 'bold');

  const measurements = {
    timestamp: new Date().toISOString(),
    git: {
      branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      commit: execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    },
    ...measureBundleSizes(),
    ...measureTestTime(),
    // Skip E2E in CI or if explicitly disabled
    ...(process.env.SKIP_E2E ? {} : measureE2ETime())
  };

  return measurements;
}

/**
 * Compare current measurements against baseline
 */
function compareWithBaseline(current, baseline) {
  const regressions = [];
  const improvements = [];

  // Compare build time
  if (baseline.buildTime && current.buildTime) {
    const change = ((current.buildTime - baseline.buildTime) / baseline.buildTime) * 100;
    if (Math.abs(change) > THRESHOLD_PCT) {
      const item = {
        metric: 'Build time',
        baseline: formatMs(baseline.buildTime),
        current: formatMs(current.buildTime),
        change: formatPct(change)
      };
      (change > 0 ? regressions : improvements).push(item);
    }
  }

  // Compare total bundle size
  if (baseline.totalSize && current.totalSize) {
    const change = ((current.totalSize - baseline.totalSize) / baseline.totalSize) * 100;
    if (Math.abs(change) > THRESHOLD_PCT) {
      const item = {
        metric: 'Total bundle size',
        baseline: formatBytes(baseline.totalSize),
        current: formatBytes(current.totalSize),
        change: formatPct(change)
      };
      (change > 0 ? regressions : improvements).push(item);
    }
  }

  // Compare test time
  if (baseline.testTime && current.testTime) {
    const change = ((current.testTime - baseline.testTime) / baseline.testTime) * 100;
    if (Math.abs(change) > THRESHOLD_PCT) {
      const item = {
        metric: 'Test execution time',
        baseline: formatMs(baseline.testTime),
        current: formatMs(current.testTime),
        change: formatPct(change)
      };
      (change > 0 ? regressions : improvements).push(item);
    }
  }

  // Compare E2E time
  if (baseline.e2eTime && current.e2eTime) {
    const change = ((current.e2eTime - baseline.e2eTime) / baseline.e2eTime) * 100;
    if (Math.abs(change) > THRESHOLD_PCT) {
      const item = {
        metric: 'E2E execution time',
        baseline: formatMs(baseline.e2eTime),
        current: formatMs(current.e2eTime),
        change: formatPct(change)
      };
      (change > 0 ? regressions : improvements).push(item);
    }
  }

  return { regressions, improvements };
}

/**
 * Print comparison report
 */
function printReport(current, baseline, comparison) {
  log('\n📊 Performance Report', 'bold');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');

  // Current metrics
  log('\n📈 Current Metrics:', 'blue');
  log(`  Build time:        ${formatMs(current.buildTime)}`, 'gray');
  log(`  Total bundle size: ${formatBytes(current.totalSize)}`, 'gray');
  if (current.testTime) log(`  Test time:         ${formatMs(current.testTime)}`, 'gray');
  if (current.e2eTime) log(`  E2E time:          ${formatMs(current.e2eTime)}`, 'gray');
  log(`  Git:               ${current.git.branch} (${current.git.commit})`, 'gray');

  if (!baseline) {
    log('\n⚠️  No baseline found. Run with --save to create one.', 'yellow');
    return;
  }

  // Baseline metrics
  log('\n📊 Baseline Metrics:', 'blue');
  log(`  Build time:        ${formatMs(baseline.buildTime)}`, 'gray');
  log(`  Total bundle size: ${formatBytes(baseline.totalSize)}`, 'gray');
  if (baseline.testTime) log(`  Test time:         ${formatMs(baseline.testTime)}`, 'gray');
  if (baseline.e2eTime) log(`  E2E time:          ${formatMs(baseline.e2eTime)}`, 'gray');
  log(`  Git:               ${baseline.git.branch} (${baseline.git.commit})`, 'gray');

  // Regressions
  if (comparison.regressions.length > 0) {
    log('\n❌ Performance Regressions:', 'red');
    for (const item of comparison.regressions) {
      log(`  ${item.metric}:`, 'red');
      log(`    Baseline: ${item.baseline}`, 'gray');
      log(`    Current:  ${item.current}`, 'gray');
      log(`    Change:   ${item.change}`, 'red');
    }
  }

  // Improvements
  if (comparison.improvements.length > 0) {
    log('\n✅ Performance Improvements:', 'green');
    for (const item of comparison.improvements) {
      log(`  ${item.metric}:`, 'green');
      log(`    Baseline: ${item.baseline}`, 'gray');
      log(`    Current:  ${item.current}`, 'gray');
      log(`    Change:   ${item.change}`, 'green');
    }
  }

  // Summary
  if (comparison.regressions.length === 0 && comparison.improvements.length === 0) {
    log('\n✅ No significant performance changes detected', 'green');
  }

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
}

/**
 * Main
 */
async function main() {
  try {
    // Run measurements
    const current = await runMeasurements();

    // Load baseline if exists
    let baseline = null;
    if (existsSync(BASELINE_FILE)) {
      baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));
    }

    if (IS_SAVE_MODE) {
      // Save mode: write current as new baseline
      writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2));
      log(`\n✅ Saved new baseline to ${BASELINE_FILE}`, 'green');
      log(`   Build time:        ${formatMs(current.buildTime)}`, 'gray');
      log(`   Total bundle size: ${formatBytes(current.totalSize)}`, 'gray');
      if (current.testTime) log(`   Test time:         ${formatMs(current.testTime)}`, 'gray');
      if (current.e2eTime) log(`   E2E time:          ${formatMs(current.e2eTime)}`, 'gray');
      return;
    }

    // Compare mode: check for regressions
    const comparison = baseline ? compareWithBaseline(current, baseline) : { regressions: [], improvements: [] };

    if (IS_REPORT_MODE) {
      // Report mode: detailed output
      printReport(current, baseline, comparison);
    } else {
      // Normal mode: summary only
      if (comparison.regressions.length > 0) {
        log('\n❌ Performance regressions detected:', 'red');
        for (const item of comparison.regressions) {
          log(`   ${item.metric}: ${item.baseline} → ${item.current} (${item.change})`, 'red');
        }
        log('\nRun with --report for detailed comparison', 'gray');
        process.exit(1);
      } else if (comparison.improvements.length > 0) {
        log('\n✅ Performance improvements detected:', 'green');
        for (const item of comparison.improvements) {
          log(`   ${item.metric}: ${item.baseline} → ${item.current} (${item.change})`, 'green');
        }
      } else {
        log('\n✅ No significant performance changes', 'green');
      }
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
