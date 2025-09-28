#!/usr/bin/env node

/**
 * determinism-audit.mjs
 * Audit determinism by running seeds multiple times and comparing stable fields
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const AUDIT_SEEDS = [42, 101, 31415];

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Unable to connect to API at ${BASE_URL}. Is the server running?`);
    }
    throw error;
  }
}

/**
 * Run scenario and get report
 */
async function runScenarioAndGetReport(seed) {
  console.log(`🎯 Running seed ${seed}...`);

  // Default test scenario
  const scenario = {
    nodes: [
      { id: 'decision', label: 'Determinism Test', weight: 1.0 },
      { id: 'factor1', label: 'Factor 1', weight: 0.6 },
      { id: 'factor2', label: 'Factor 2', weight: 0.8 }
    ],
    links: [
      { from: 'decision', to: 'factor1', weight: 0.6 },
      { from: 'decision', to: 'factor2', weight: 0.8 }
    ]
  };

  // Start stream
  const streamResponse = await makeRequest('/stream', {
    method: 'POST',
    body: JSON.stringify({
      seed: seed,
      scenario: scenario,
      meta: {
        determinismAudit: true,
        timestamp: new Date().toISOString()
      }
    })
  });

  const streamData = await streamResponse.json();
  const runId = streamData.runId;

  // Wait for completion
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds timeout

  while (attempts < maxAttempts) {
    try {
      const reportResponse = await makeRequest(`/report/${runId}`);
      if (reportResponse.ok) {
        const report = await reportResponse.json();
        console.log(`✅ Seed ${seed} completed (${report.status})`);
        return report;
      }
    } catch (error) {
      // Report not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error(`Timeout waiting for seed ${seed} completion`);
}

/**
 * Extract stable fields for comparison
 */
function extractStableFields(report) {
  // Fields that should be deterministic across runs with same seed
  const stable = {
    schema: report.schema,
    seed: report.meta?.seed,
    status: report.status
  };

  // Extract summary fields (should be stable)
  if (report.summary) {
    stable.summary = {
      ...report.summary
    };
  }

  // Extract decision data (should be stable)
  if (report.decisions) {
    stable.decisions = report.decisions.map(decision => ({
      id: decision.id,
      label: decision.label,
      weight: decision.weight,
      score: decision.score
    }));
  }

  // Extract factor data (should be stable)
  if (report.factors) {
    stable.factors = report.factors.map(factor => ({
      id: factor.id,
      label: factor.label,
      weight: factor.weight,
      impact: factor.impact
    }));
  }

  return stable;
}

/**
 * Deep compare objects and find differences
 */
function deepCompare(obj1, obj2, path = '') {
  const differences = [];

  if (typeof obj1 !== typeof obj2) {
    differences.push({
      path: path,
      type: 'type_mismatch',
      left: typeof obj1,
      right: typeof obj2
    });
    return differences;
  }

  if (obj1 === null || obj2 === null) {
    if (obj1 !== obj2) {
      differences.push({
        path: path,
        type: 'null_mismatch',
        left: obj1,
        right: obj2
      });
    }
    return differences;
  }

  if (typeof obj1 !== 'object') {
    if (obj1 !== obj2) {
      differences.push({
        path: path,
        type: 'value_mismatch',
        left: obj1,
        right: obj2
      });
    }
    return differences;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    differences.push({
      path: path,
      type: 'array_mismatch',
      left: Array.isArray(obj1),
      right: Array.isArray(obj2)
    });
    return differences;
  }

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) {
      differences.push({
        path: path,
        type: 'array_length_mismatch',
        left: obj1.length,
        right: obj2.length
      });
    }

    const minLength = Math.min(obj1.length, obj2.length);
    for (let i = 0; i < minLength; i++) {
      differences.push(...deepCompare(obj1[i], obj2[i], `${path}[${i}]`));
    }
  } else {
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;

      if (!(key in obj1)) {
        differences.push({
          path: keyPath,
          type: 'missing_left',
          right: obj2[key]
        });
      } else if (!(key in obj2)) {
        differences.push({
          path: keyPath,
          type: 'missing_right',
          left: obj1[key]
        });
      } else {
        differences.push(...deepCompare(obj1[key], obj2[key], keyPath));
      }
    }
  }

  return differences;
}

/**
 * Audit a single seed
 */
async function auditSeed(seed) {
  console.log(`\n🔍 Auditing seed ${seed}...`);

  // Run twice
  const [report1, report2] = await Promise.all([
    runScenarioAndGetReport(seed),
    runScenarioAndGetReport(seed)
  ]);

  // Extract stable fields
  const stable1 = extractStableFields(report1);
  const stable2 = extractStableFields(report2);

  // Compare
  const differences = deepCompare(stable1, stable2);

  const result = {
    seed: seed,
    runIds: [report1.meta?.runId, report2.meta?.runId],
    passed: differences.length === 0,
    differences: differences,
    reports: {
      first: stable1,
      second: stable2
    }
  };

  if (result.passed) {
    console.log(`✅ Seed ${seed}: PASS (deterministic)`);
  } else {
    console.log(`❌ Seed ${seed}: FAIL (${differences.length} differences)`);
    differences.forEach(diff => {
      console.log(`   ${diff.path}: ${diff.type}`);
    });
  }

  return result;
}

/**
 * Run full determinism audit
 */
async function runDeterminismAudit() {
  console.log('🔬 Starting Determinism Audit');
  console.log(`🎯 Testing seeds: ${AUDIT_SEEDS.join(', ')}`);
  console.log(`🌐 API: ${BASE_URL}`);

  const startTime = Date.now();
  const results = [];

  try {
    // Test each seed
    for (const seed of AUDIT_SEEDS) {
      const result = await auditSeed(seed);
      results.push(result);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Compile overall results
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const overallPass = failed === 0;

    const summary = {
      timestamp: new Date().toISOString(),
      duration: duration,
      overall: overallPass ? 'PASS' : 'FAIL',
      seeds: {
        tested: AUDIT_SEEDS.length,
        passed: passed,
        failed: failed
      },
      results: results
    };

    // Write JSON report
    const reportsDir = path.join(projectRoot, 'artifacts', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const jsonPath = path.join(reportsDir, 'determinism-audit.json');
    await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2));

    // Write Markdown report
    const markdownReport = generateMarkdownReport(summary);
    const mdPath = path.join(reportsDir, 'determinism-audit.md');
    await fs.writeFile(mdPath, markdownReport);

    // Print summary
    console.log(`\n📊 DETERMINISM AUDIT COMPLETE`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🎯 Seeds tested: ${AUDIT_SEEDS.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🏆 Overall: ${overallPass ? 'PASS' : 'FAIL'}`);
    console.log(`📁 Reports: ${jsonPath}, ${mdPath}`);

    return summary;

  } catch (error) {
    console.error(`\n❌ Audit failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(summary) {
  const { timestamp, duration, overall, seeds, results } = summary;

  let markdown = `# Determinism Audit Report

**Generated:** ${timestamp}
**Duration:** ${duration}s
**Overall Result:** ${overall === 'PASS' ? '✅ PASS' : '❌ FAIL'}

## Summary

- **Seeds Tested:** ${seeds.tested}
- **Passed:** ${seeds.passed}
- **Failed:** ${seeds.failed}
- **Success Rate:** ${Math.round((seeds.passed / seeds.tested) * 100)}%

## Seed Results

`;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    markdown += `### Seed ${result.seed} - ${status}\n\n`;

    if (result.passed) {
      markdown += 'All stable fields are deterministic.\n\n';
    } else {
      markdown += `Found ${result.differences.length} differences:\n\n`;
      result.differences.forEach(diff => {
        markdown += `- **${diff.path}**: ${diff.type}`;
        if (diff.left !== undefined) markdown += ` (${JSON.stringify(diff.left)} → ${JSON.stringify(diff.right)})`;
        markdown += '\n';
      });
      markdown += '\n';
    }
  });

  markdown += `## Methodology

This audit tests determinism by:

1. Running each seed twice with identical parameters
2. Extracting stable fields from reports (schema, status, summary, decisions, factors)
3. Comparing extracted fields for exact equality
4. Reporting any differences found

**Note:** Some fields like timestamps, run IDs, and debug info are excluded from comparison as they are expected to vary.

## Interpretation

- **PASS**: All stable fields are identical across runs with the same seed
- **FAIL**: Some stable fields differ, indicating non-deterministic behaviour

A passing audit ensures that:
- Scenarios produce consistent results for testing
- UI fixtures remain stable
- Regression testing is reliable
- Demos produce predictable outcomes

## Next Steps

${overall === 'PASS' ?
  'The system is deterministic. No action required.' :
  'Investigate the differences found and fix non-deterministic behaviour in the affected components.'}
`;

  return markdown;
}

/**
 * Main function
 */
async function main() {
  await runDeterminismAudit();
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});