#!/usr/bin/env node
/**
 * Golden Briefs Live Tests Helper
 *
 * Runs live tests against production-like API endpoints using golden test cases.
 * Compares responses against expected outcomes to catch regressions.
 *
 * Usage:
 *   npm run test:golden              # Run all golden tests
 *   npm run test:golden -- --brief=1 # Run specific brief
 *   npm run test:golden -- --save    # Save current responses as new golden data
 *   npm run test:golden -- --verbose # Show detailed comparison
 *
 * Environment variables:
 *   PLOT_API_URL          # API endpoint (default: staging URL)
 *   GOLDEN_THRESHOLD=0.9  # Min similarity for pass (default: 0.9)
 *   SKIP_LIVE_API=1       # Use cached responses instead of live API
 *
 * Golden briefs format (golden-briefs/*.json):
 *   {
 *     "id": "brief-1",
 *     "name": "Simple 3-node decision",
 *     "request": { "graph": {...}, "seed": 1337 },
 *     "expected": {
 *       "summary": { "conservative": 100, "likely": 150, "optimistic": 200 },
 *       "drivers": [...],
 *       "response_hash": "abc123..."
 *     }
 *   }
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import https from 'https';

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

// Config
const GOLDEN_DIR = 'golden-briefs';
const API_URL = process.env.PLOT_API_URL || 'https://plot-lite-service.onrender.com';
const THRESHOLD = parseFloat(process.env.GOLDEN_THRESHOLD || '0.9');
const IS_SAVE_MODE = process.argv.includes('--save');
const IS_VERBOSE = process.argv.includes('--verbose');
const SKIP_LIVE = process.env.SKIP_LIVE_API === '1';

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    acc[key.slice(2)] = value || true;
  }
  return acc;
}, {});

/**
 * Make HTTP POST request
 */
function apiRequest(path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Load golden briefs from directory
 */
function loadGoldenBriefs() {
  if (!existsSync(GOLDEN_DIR)) {
    log(`⚠️  No golden briefs directory found at ${GOLDEN_DIR}`, 'yellow');
    log('   Creating sample golden brief...', 'gray');
    createSampleBrief();
    return [];
  }

  const files = readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const content = readFileSync(join(GOLDEN_DIR, f), 'utf-8');
    return JSON.parse(content);
  });
}

/**
 * Create sample golden brief
 */
function createSampleBrief() {
  if (!existsSync(GOLDEN_DIR)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
  }

  const sample = {
    id: 'brief-sample',
    name: 'Sample 3-node decision graph',
    description: 'Basic test with 3 nodes and 2 edges',
    request: {
      graph: {
        nodes: [
          { id: 'goal', label: 'Revenue Goal' },
          { id: 'product', label: 'Product Launch' },
          { id: 'market', label: 'Market Conditions' }
        ],
        edges: [
          { from: 'product', to: 'goal', weight: 0.7 },
          { from: 'market', to: 'product', weight: 0.5 }
        ]
      },
      seed: 1337
    },
    expected: {
      summary: {
        conservative: 80,
        likely: 120,
        optimistic: 180,
        units: 'units'
      },
      // Note: response_hash will vary by backend implementation
      // Set to null to skip hash validation
      response_hash: null
    }
  };

  const filename = join(GOLDEN_DIR, 'sample-brief.json');
  writeFileSync(filename, JSON.stringify(sample, null, 2));
  log(`✅ Created sample golden brief: ${filename}`, 'green');
  log('   Edit this file and add your own test cases', 'gray');
}

/**
 * Compare numeric values with tolerance
 */
function compareNumeric(actual, expected, tolerance = 0.1) {
  if (typeof expected !== 'number') return { match: true };
  if (typeof actual !== 'number') return { match: false, reason: 'type mismatch' };

  const diff = Math.abs(actual - expected);
  const pct = expected === 0 ? 0 : diff / Math.abs(expected);

  return {
    match: pct <= tolerance,
    pct: pct * 100,
    diff
  };
}

/**
 * Compare summary values
 */
function compareSummary(actual, expected) {
  const results = {};
  const fields = ['conservative', 'likely', 'optimistic'];

  for (const field of fields) {
    if (expected[field] != null) {
      const cmp = compareNumeric(actual[field], expected[field], 0.1);
      results[field] = cmp;
    }
  }

  // Check units match
  if (expected.units && actual.units !== expected.units) {
    results.units = { match: false, reason: `expected "${expected.units}", got "${actual.units}"` };
  }

  return results;
}

/**
 * Run a single golden brief test
 */
async function runGoldenBrief(brief) {
  log(`\n🧪 Running: ${brief.name}`, 'blue');
  log(`   ID: ${brief.id}`, 'gray');

  try {
    let response;

    if (SKIP_LIVE) {
      // Use cached response if available
      const cacheFile = join(GOLDEN_DIR, `${brief.id}-cached.json`);
      if (existsSync(cacheFile)) {
        response = JSON.parse(readFileSync(cacheFile, 'utf-8'));
        log('   Using cached response', 'gray');
      } else {
        log('   ⚠️  No cached response found, use live API or run with --save first', 'yellow');
        return { brief: brief.id, status: 'skipped', reason: 'no cache' };
      }
    } else {
      // Make live API request
      response = await apiRequest('/api/plot/v1/run', brief.request);

      // Cache response in save mode
      if (IS_SAVE_MODE) {
        const cacheFile = join(GOLDEN_DIR, `${brief.id}-cached.json`);
        writeFileSync(cacheFile, JSON.stringify(response, null, 2));
        log(`   💾 Saved response to ${cacheFile}`, 'gray');
      }
    }

    // Compare with expected
    const summaryComparison = compareSummary(response.summary, brief.expected.summary);

    // Check if all fields match
    const allMatch = Object.values(summaryComparison).every(r => r.match);

    if (allMatch) {
      log('   ✅ PASS', 'green');
      if (IS_VERBOSE) {
        log('   Summary:', 'gray');
        log(`     Conservative: ${response.summary.conservative} (expected: ${brief.expected.summary.conservative})`, 'gray');
        log(`     Likely:       ${response.summary.likely} (expected: ${brief.expected.summary.likely})`, 'gray');
        log(`     Optimistic:   ${response.summary.optimistic} (expected: ${brief.expected.summary.optimistic})`, 'gray');
      }
      return { brief: brief.id, status: 'pass', response };
    } else {
      log('   ❌ FAIL', 'red');
      log('   Mismatches:', 'red');
      for (const [field, result] of Object.entries(summaryComparison)) {
        if (!result.match) {
          if (result.reason) {
            log(`     ${field}: ${result.reason}`, 'red');
          } else {
            log(`     ${field}: ${result.diff.toFixed(2)} diff (${result.pct.toFixed(1)}% deviation)`, 'red');
          }
        }
      }
      return { brief: brief.id, status: 'fail', mismatches: summaryComparison, response };
    }

  } catch (error) {
    log(`   ❌ ERROR: ${error.message}`, 'red');
    return { brief: brief.id, status: 'error', error: error.message };
  }
}

/**
 * Print summary report
 */
function printSummary(results) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
  log('📊 Golden Briefs Test Summary', 'bold');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const total = results.length;

  log(`\n  Total:   ${total}`, 'gray');
  log(`  Passed:  ${passed}`, passed === total ? 'green' : 'gray');
  if (failed > 0) log(`  Failed:  ${failed}`, 'red');
  if (errors > 0) log(`  Errors:  ${errors}`, 'red');
  if (skipped > 0) log(`  Skipped: ${skipped}`, 'yellow');

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');

  if (failed > 0 || errors > 0) {
    log('\n❌ Some tests failed. Review output above for details.', 'red');
    process.exit(1);
  } else if (skipped === total) {
    log('\n⚠️  All tests skipped. Run without SKIP_LIVE_API or use --save first.', 'yellow');
  } else {
    log('\n✅ All golden briefs tests passed!', 'green');
  }
}

/**
 * Main
 */
async function main() {
  log('🔱 Golden Briefs Live Tests', 'bold');

  if (IS_SAVE_MODE) {
    log('💾 Save mode: Will cache responses for offline testing', 'yellow');
  }

  if (SKIP_LIVE) {
    log('📦 Using cached responses (SKIP_LIVE_API=1)', 'yellow');
  }

  // Load golden briefs
  const briefs = loadGoldenBriefs();

  if (briefs.length === 0) {
    log('\n⚠️  No golden briefs found. Create test cases in golden-briefs/', 'yellow');
    return;
  }

  log(`\n📋 Found ${briefs.length} golden brief(s)`, 'gray');

  // Filter by brief ID if specified
  const filtered = args.brief
    ? briefs.filter(b => b.id === args.brief)
    : briefs;

  if (filtered.length === 0) {
    log(`❌ No briefs match ID: ${args.brief}`, 'red');
    return;
  }

  // Run tests
  const results = [];
  for (const brief of filtered) {
    const result = await runGoldenBrief(brief);
    results.push(result);
  }

  // Print summary
  printSummary(results);
}

main();
