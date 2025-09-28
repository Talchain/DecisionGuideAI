#!/usr/bin/env node

/**
 * Pilot Day Rehearsal Pack
 * Comprehensive 60-second smoke test with Go/No-Go gates for pilot readiness
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';
import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TIMEOUT = 60000; // 60-second budget
const TEST_SEED = 42;

// Gate thresholds (milliseconds)
const GATE_THRESHOLDS = {
  TTFF: 5000,      // Time to first token
  CANCEL: 1000,    // Cancel latency
  CONTRACT: 10000, // Contract validation
  SMOKE: 15000     // Overall smoke test
};

// Colors for output
const colors = {
  GREEN: '\x1b[32m',
  AMBER: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

/**
 * Log message with timestamp and color
 */
function log(message, color = '') {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`${color}[${timestamp}] ${message}${colors.RESET}`);
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

/**
 * Get gate status based on timing
 */
function getGateStatus(actual, threshold) {
  if (actual <= threshold * 0.5) return { status: 'GREEN', icon: '🟢' };
  if (actual <= threshold) return { status: 'AMBER', icon: '🟡' };
  return { status: 'RED', icon: '🔴' };
}

/**
 * Test time-to-first-token
 */
async function testTTFF() {
  return new Promise((resolve) => {
    const start = Date.now();
    const sessionId = `pilot_rehearsal_${Date.now()}`;

    log('Starting TTFF test...', colors.BLUE);

    const url = new URL('/stream', BASE_URL);
    url.searchParams.set('route', 'critique');
    url.searchParams.set('scenarioId', 'pilot-rehearsal');
    url.searchParams.set('seed', String(TEST_SEED));
    url.searchParams.set('sessionId', sessionId);

    const eventSource = new EventSource(url.toString());

    const timeout = setTimeout(() => {
      eventSource.close();
      resolve({
        success: false,
        error: 'TTFF timeout',
        duration: Date.now() - start,
        sessionId: null
      });
    }, GATE_THRESHOLDS.TTFF * 2);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
          const duration = Date.now() - start;
          clearTimeout(timeout);
          eventSource.close();
          resolve({
            success: true,
            duration,
            sessionId
          });
        }
      } catch (error) {
        clearTimeout(timeout);
        eventSource.close();
        resolve({
          success: false,
          error: error.message,
          duration: Date.now() - start,
          sessionId: null
        });
      }
    };

    eventSource.onerror = () => {
      clearTimeout(timeout);
      eventSource.close();
      resolve({
        success: false,
        error: 'EventSource connection failed',
        duration: Date.now() - start,
        sessionId: null
      });
    };
  });
}

/**
 * Test cancel latency
 */
async function testCancel(sessionId) {
  if (!sessionId) return { success: false, error: 'No session ID' };

  log('Testing cancel latency...', colors.BLUE);
  const start = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(GATE_THRESHOLDS.CANCEL * 2)
    });

    const duration = Date.now() - start;

    return {
      success: response.status === 202,
      duration,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

/**
 * Test contract validation
 */
async function testContractValidation() {
  log('Validating API contracts...', colors.BLUE);
  const start = Date.now();

  try {
    // Test health endpoint
    const healthResponse = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!healthResponse.ok) {
      return {
        success: false,
        error: `Health check failed: ${healthResponse.status}`,
        duration: Date.now() - start
      };
    }

    // Test schema endpoint
    const schemaResponse = await fetch(`${BASE_URL}/api/v1/schema`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!schemaResponse.ok) {
      return {
        success: false,
        error: `Schema endpoint failed: ${schemaResponse.status}`,
        duration: Date.now() - start
      };
    }

    const schema = await schemaResponse.json();
    if (!schema.openapi) {
      return {
        success: false,
        error: 'Invalid OpenAPI schema',
        duration: Date.now() - start
      };
    }

    return {
      success: true,
      duration: Date.now() - start,
      endpoints: ['health', 'schema']
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

/**
 * Quick artifact check
 */
function checkArtifacts() {
  log('Checking critical artifacts...', colors.BLUE);
  const start = Date.now();

  const checks = {
    'Package.json exists': existsSync('package.json'),
    'OpenAPI spec exists': existsSync('openapi/scenario-sandbox.yml'),
    'UI kickstart pack': existsSync('artifacts/ui-kickstart-pack'),
    'Standing permissions': existsSync('artifacts/claude-standing-permissions.md'),
    'Reports directory': existsSync('artifacts/reports')
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  return {
    success: passed === total,
    passed,
    total,
    checks,
    duration: Date.now() - start
  };
}

/**
 * Run comprehensive pilot rehearsal
 */
async function runPilotRehearsal() {
  const startTime = Date.now();
  log('🎯 Starting Pilot Day Rehearsal', colors.BOLD);
  log(`📍 Target: ${BASE_URL}`, colors.BLUE);
  log(`⏱️  Budget: 60 seconds`, colors.BLUE);
  log('', '');

  const results = {
    startTime: new Date(startTime).toISOString(),
    baseUrl: BASE_URL,
    gates: {},
    overallStatus: 'GREEN',
    totalDuration: 0,
    recommendations: []
  };

  // Gate 1: Artifact Check
  log('🔍 Gate 1: Artifact Integrity', colors.BOLD);
  const artifactCheck = checkArtifacts();
  const artifactGate = getGateStatus(artifactCheck.duration, 1000);

  results.gates.artifacts = {
    name: 'Artifact Integrity',
    success: artifactCheck.success,
    duration: artifactCheck.duration,
    status: artifactGate.status,
    details: `${artifactCheck.passed}/${artifactCheck.total} checks passed`
  };

  log(`  ${artifactGate.icon} ${artifactCheck.passed}/${artifactCheck.total} checks (${formatDuration(artifactCheck.duration)})`);

  if (!artifactCheck.success) {
    Object.entries(artifactCheck.checks).forEach(([check, passed]) => {
      log(`    ${passed ? '✅' : '❌'} ${check}`);
    });
    results.recommendations.push('Fix missing artifacts before pilot');
  }

  // Gate 2: Contract Validation
  log('📋 Gate 2: API Contract Validation', colors.BOLD);
  const contractCheck = await testContractValidation();
  const contractGate = getGateStatus(contractCheck.duration, GATE_THRESHOLDS.CONTRACT);

  results.gates.contracts = {
    name: 'API Contract Validation',
    success: contractCheck.success,
    duration: contractCheck.duration,
    status: contractGate.status,
    details: contractCheck.success ?
      `Validated ${contractCheck.endpoints?.length || 0} endpoints` :
      contractCheck.error
  };

  log(`  ${contractGate.icon} API validation (${formatDuration(contractCheck.duration)})`);

  if (!contractCheck.success) {
    log(`    ❌ ${contractCheck.error}`, colors.RED);
    results.recommendations.push('Ensure API endpoints are accessible');
  }

  // Gate 3: TTFF Performance
  log('⚡ Gate 3: Time-to-First-Token', colors.BOLD);
  const ttffCheck = await testTTFF();
  const ttffGate = getGateStatus(ttffCheck.duration, GATE_THRESHOLDS.TTFF);

  results.gates.ttff = {
    name: 'Time-to-First-Token',
    success: ttffCheck.success,
    duration: ttffCheck.duration,
    status: ttffGate.status,
    details: ttffCheck.success ?
      `First token in ${formatDuration(ttffCheck.duration)}` :
      ttffCheck.error
  };

  log(`  ${ttffGate.icon} TTFF: ${formatDuration(ttffCheck.duration)} ${ttffCheck.success ? '' : '(FAILED)'}`);

  if (!ttffCheck.success) {
    log(`    ❌ ${ttffCheck.error}`, colors.RED);
    results.recommendations.push('Check streaming endpoint configuration');
  }

  // Gate 4: Cancel Responsiveness
  log('🛑 Gate 4: Cancel Responsiveness', colors.BOLD);
  const cancelCheck = await testCancel(ttffCheck.sessionId);
  const cancelGate = getGateStatus(cancelCheck.duration, GATE_THRESHOLDS.CANCEL);

  results.gates.cancel = {
    name: 'Cancel Responsiveness',
    success: cancelCheck.success,
    duration: cancelCheck.duration,
    status: cancelGate.status,
    details: cancelCheck.success ?
      `Cancel in ${formatDuration(cancelCheck.duration)}` :
      cancelCheck.error || `HTTP ${cancelCheck.status}`
  };

  log(`  ${cancelGate.icon} Cancel: ${formatDuration(cancelCheck.duration)} ${cancelCheck.success ? '' : '(FAILED)'}`);

  if (!cancelCheck.success) {
    log(`    ❌ ${cancelCheck.error || 'Cancel endpoint failed'}`, colors.RED);
    results.recommendations.push('Verify cancel endpoint is working correctly');
  }

  // Calculate overall status
  const allGates = Object.values(results.gates);
  const hasRed = allGates.some(gate => gate.status === 'RED');
  const hasAmber = allGates.some(gate => gate.status === 'AMBER');

  if (hasRed) results.overallStatus = 'RED';
  else if (hasAmber) results.overallStatus = 'AMBER';

  results.totalDuration = Date.now() - startTime;

  // Final assessment
  log('', '');
  log('🎯 PILOT REHEARSAL SUMMARY', colors.BOLD);
  log('=' .repeat(50));

  const overallGate = getGateStatus(results.totalDuration, TIMEOUT);
  log(`${overallGate.icon} Overall: ${results.overallStatus} (${formatDuration(results.totalDuration)})`,
      results.overallStatus === 'GREEN' ? colors.GREEN :
      results.overallStatus === 'AMBER' ? colors.AMBER : colors.RED);

  allGates.forEach(gate => {
    const gateIcon = gate.status === 'GREEN' ? '🟢' :
                    gate.status === 'AMBER' ? '🟡' : '🔴';
    log(`${gateIcon} ${gate.name}: ${gate.details}`);
  });

  if (results.recommendations.length > 0) {
    log('');
    log('📋 Recommendations:', colors.BOLD);
    results.recommendations.forEach(rec => log(`  • ${rec}`, colors.AMBER));
  }

  // Go/No-Go Decision
  log('');
  log('🚦 GO/NO-GO DECISION', colors.BOLD);
  log('-' .repeat(30));

  if (results.overallStatus === 'GREEN') {
    log('✅ GO - Ready for pilot launch', colors.GREEN);
  } else if (results.overallStatus === 'AMBER') {
    log('⚠️  CONDITIONAL GO - Address amber items before launch', colors.AMBER);
  } else {
    log('🛑 NO-GO - Critical issues must be resolved', colors.RED);
  }

  return results;
}

/**
 * Save rehearsal report
 */
function saveRehearsalReport(results) {
  const reportsDir = join(__dirname, '..', 'artifacts', 'reports');

  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `pilot-rehearsal-${timestamp}.md`;
  const filepath = join(reportsDir, filename);

  // Generate human-friendly report
  const report = `# Pilot Day Rehearsal Report

**Generated:** ${new Date(results.startTime).toLocaleString()}
**Duration:** ${formatDuration(results.totalDuration)}
**Target:** ${results.baseUrl}
**Overall Status:** ${results.overallStatus}

## Gate Results

${Object.values(results.gates).map(gate => `
### ${gate.status === 'GREEN' ? '🟢' : gate.status === 'AMBER' ? '🟡' : '🔴'} ${gate.name}

- **Status:** ${gate.status}
- **Duration:** ${formatDuration(gate.duration)}
- **Result:** ${gate.details}
- **Pass:** ${gate.success ? 'Yes' : 'No'}
`).join('')}

## Go/No-Go Assessment

${results.overallStatus === 'GREEN' ?
  '✅ **GO** - System ready for pilot launch' :
results.overallStatus === 'AMBER' ?
  '⚠️ **CONDITIONAL GO** - Address amber items before launch' :
  '🛑 **NO-GO** - Critical issues must be resolved'}

## Recommendations

${results.recommendations.length > 0 ?
  results.recommendations.map(rec => `- ${rec}`).join('\n') :
  'No specific recommendations - system performing within thresholds.'}

## Timing Breakdown

| Gate | Threshold | Actual | Status | Pass |
|------|-----------|--------|--------|------|
${Object.values(results.gates).map(gate =>
  `| ${gate.name} | varies | ${formatDuration(gate.duration)} | ${gate.status} | ${gate.success ? '✅' : '❌'} |`
).join('\n')}

---
*Generated by pilot-rehearsal.mjs*
`;

  writeFileSync(filepath, report);
  log(`📁 Report saved: ${filepath}`, colors.BLUE);

  return filepath;
}

/**
 * Open demo.html in default browser
 */
function openDemo() {
  import('child_process').then(({ exec }) => {
    const demoPath = join(__dirname, '..', 'artifacts', 'public', 'demo.html');
    const command = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${command} "${demoPath}"`, (error) => {
      if (error) {
        log(`⚠️  Could not open demo: ${error.message}`, colors.AMBER);
      } else {
        log('🌐 Demo opened in browser', colors.GREEN);
      }
    });
  }).catch(() => {
    log('⚠️  Could not open demo (import failed)', colors.AMBER);
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const shouldOpenDemo = args.includes('--open');

    const results = await runPilotRehearsal();
    const reportPath = saveRehearsalReport(results);

    // Exit with appropriate code
    const exitCode = results.overallStatus === 'RED' ? 1 : 0;

    if (exitCode === 0) {
      log('🎉 Pilot rehearsal completed successfully', colors.GREEN);

      // Open demo if requested and rehearsal was successful
      if (shouldOpenDemo) {
        log('🚀 Opening demo interface...', colors.BLUE);
        openDemo();
      }
    } else {
      log('💥 Pilot rehearsal failed - resolve issues before pilot', colors.RED);
    }

    process.exit(exitCode);

  } catch (error) {
    log(`💥 Rehearsal crashed: ${error.message}`, colors.RED);
    console.error(error);
    process.exit(1);
  }
}

// Handle signals gracefully
process.on('SIGINT', () => {
  log('🛑 Pilot rehearsal interrupted', colors.RED);
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('🛑 Pilot rehearsal terminated', colors.RED);
  process.exit(1);
});

// Run the rehearsal
main();