#!/usr/bin/env node
/**
 * Datadog Import Helper
 *
 * Assists with importing custom metrics, logs, and traces to Datadog.
 * Useful for migrating from other monitoring solutions or bulk importing historical data.
 *
 * Usage:
 *   npm run datadog:import -- --type=metrics --file=metrics.json
 *   npm run datadog:import -- --type=logs --file=logs.ndjson
 *   npm run datadog:import -- --test  # Test connectivity and auth
 *
 * Environment variables:
 *   DD_API_KEY        # Datadog API key (required)
 *   DD_APP_KEY        # Datadog Application key (required for some operations)
 *   DD_SITE           # Datadog site (default: datadoghq.com)
 *
 * File formats:
 *   metrics.json:  [{ "metric": "app.perf.build_time", "value": 1234, "timestamp": 1699000000, "tags": ["env:prod"] }]
 *   logs.ndjson:   {"message": "...", "timestamp": 1699000000, "level": "info", "tags": ["source:app"]}
 */

import { readFileSync } from 'fs';
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

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    acc[key.slice(2)] = value || true;
  }
  return acc;
}, {});

const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';

/**
 * Make HTTP request to Datadog API
 */
function ddRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `api.${DD_SITE}`,
      port: 443,
      path,
      method,
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (DD_APP_KEY) {
      options.headers['DD-APPLICATION-KEY'] = DD_APP_KEY;
    }

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
          reject(new Error(`Datadog API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test connectivity and authentication
 */
async function testConnection() {
  log('\n🔌 Testing Datadog connectivity...', 'blue');

  if (!DD_API_KEY) {
    log('❌ DD_API_KEY not set', 'red');
    return false;
  }

  try {
    // Validate API key by checking hosts
    await ddRequest('GET', '/api/v1/validate');
    log('✅ API key valid', 'green');
    log(`   Site: ${DD_SITE}`, 'gray');
    return true;
  } catch (error) {
    log(`❌ Connection failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Import metrics from JSON file
 */
async function importMetrics(filePath) {
  log('\n📊 Importing metrics...', 'blue');

  if (!filePath) {
    log('❌ No file specified. Use --file=<path>', 'red');
    return;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const metrics = Array.isArray(data) ? data : [data];

    log(`   Found ${metrics.length} metrics`, 'gray');

    // Datadog metrics API expects series format
    const series = metrics.map(m => ({
      metric: m.metric,
      points: [[m.timestamp || Math.floor(Date.now() / 1000), m.value]],
      type: m.type || 'gauge',
      tags: m.tags || []
    }));

    // Submit in batches of 100
    const batchSize = 100;
    for (let i = 0; i < series.length; i += batchSize) {
      const batch = series.slice(i, i + batchSize);
      await ddRequest('POST', '/api/v1/series', { series: batch });
      log(`   ✓ Imported ${i + batch.length}/${series.length} metrics`, 'gray');
    }

    log(`✅ Successfully imported ${metrics.length} metrics`, 'green');
  } catch (error) {
    log(`❌ Import failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Import logs from NDJSON file
 */
async function importLogs(filePath) {
  log('\n📝 Importing logs...', 'blue');

  if (!filePath) {
    log('❌ No file specified. Use --file=<path>', 'red');
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const logs = content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    log(`   Found ${logs.length} log entries`, 'gray');

    // Datadog logs API format
    const formatted = logs.map(l => ({
      ddsource: l.source || 'custom',
      ddtags: (l.tags || []).join(','),
      hostname: l.hostname || 'import',
      message: l.message,
      service: l.service || 'app',
      timestamp: l.timestamp ? l.timestamp * 1000 : Date.now(),
      level: l.level || 'info'
    }));

    // Submit in batches of 100
    const batchSize = 100;
    for (let i = 0; i < formatted.length; i += batchSize) {
      const batch = formatted.slice(i, i + batchSize);
      await ddRequest('POST', '/api/v2/logs', batch);
      log(`   ✓ Imported ${i + batch.length}/${formatted.length} logs`, 'gray');
    }

    log(`✅ Successfully imported ${logs.length} log entries`, 'green');
  } catch (error) {
    log(`❌ Import failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Generate sample metric data for testing
 */
function generateSampleMetrics() {
  log('\n📋 Generating sample metrics file...', 'blue');

  const now = Math.floor(Date.now() / 1000);
  const samples = [
    {
      metric: 'decisionguide.perf.build_time',
      value: 12340,
      timestamp: now - 3600,
      tags: ['env:prod', 'git:main']
    },
    {
      metric: 'decisionguide.perf.bundle_size',
      value: 524288,
      timestamp: now - 3600,
      tags: ['env:prod', 'git:main']
    },
    {
      metric: 'decisionguide.test.duration',
      value: 8500,
      timestamp: now - 3600,
      tags: ['env:ci', 'suite:unit']
    }
  ];

  const filename = 'sample-metrics.json';
  require('fs').writeFileSync(filename, JSON.stringify(samples, null, 2));
  log(`✅ Created ${filename}`, 'green');
  log('   Import with: npm run datadog:import -- --type=metrics --file=sample-metrics.json', 'gray');
}

/**
 * Generate sample log data for testing
 */
function generateSampleLogs() {
  log('\n📋 Generating sample logs file...', 'blue');

  const now = Math.floor(Date.now() / 1000);
  const samples = [
    {
      message: 'Application started',
      timestamp: now - 3600,
      level: 'info',
      source: 'app',
      tags: ['env:prod']
    },
    {
      message: 'Analysis completed successfully',
      timestamp: now - 3500,
      level: 'info',
      source: 'plot',
      tags: ['env:prod', 'action:run']
    },
    {
      message: 'Rate limit approaching threshold',
      timestamp: now - 3400,
      level: 'warning',
      source: 'api',
      tags: ['env:prod']
    }
  ];

  const filename = 'sample-logs.ndjson';
  const content = samples.map(s => JSON.stringify(s)).join('\n');
  require('fs').writeFileSync(filename, content);
  log(`✅ Created ${filename}`, 'green');
  log('   Import with: npm run datadog:import -- --type=logs --file=sample-logs.ndjson', 'gray');
}

/**
 * Print usage help
 */
function printHelp() {
  log('\n🐕 Datadog Import Helper', 'bold');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
  log('\nUsage:', 'blue');
  log('  npm run datadog:import -- --test', 'gray');
  log('  npm run datadog:import -- --type=metrics --file=metrics.json', 'gray');
  log('  npm run datadog:import -- --type=logs --file=logs.ndjson', 'gray');
  log('  npm run datadog:import -- --generate=metrics', 'gray');
  log('  npm run datadog:import -- --generate=logs', 'gray');
  log('\nEnvironment variables:', 'blue');
  log('  DD_API_KEY    # Required for all operations', 'gray');
  log('  DD_APP_KEY    # Required for some operations', 'gray');
  log('  DD_SITE       # Default: datadoghq.com', 'gray');
  log('\nExamples:', 'blue');
  log('  # Test connection', 'gray');
  log('  DD_API_KEY=xxx npm run datadog:import -- --test', 'gray');
  log('\n  # Import performance metrics', 'gray');
  log('  DD_API_KEY=xxx npm run datadog:import -- --type=metrics --file=perf.json', 'gray');
  log('\n  # Generate sample data', 'gray');
  log('  npm run datadog:import -- --generate=metrics', 'gray');
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
}

/**
 * Main
 */
async function main() {
  if (args.help || Object.keys(args).length === 0) {
    printHelp();
    return;
  }

  if (args.test) {
    await testConnection();
    return;
  }

  if (args.generate === 'metrics') {
    generateSampleMetrics();
    return;
  }

  if (args.generate === 'logs') {
    generateSampleLogs();
    return;
  }

  if (args.type === 'metrics' && args.file) {
    const connected = await testConnection();
    if (!connected) return;
    await importMetrics(args.file);
    return;
  }

  if (args.type === 'logs' && args.file) {
    const connected = await testConnection();
    if (!connected) return;
    await importLogs(args.file);
    return;
  }

  log('❌ Invalid arguments. Use --help for usage.', 'red');
  printHelp();
}

main();
