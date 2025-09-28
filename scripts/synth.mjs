#!/usr/bin/env node
/**
 * Synthetic Monitoring Script
 * Lightweight canary tests for TTFF/resume/cancel scenarios
 * Writes JSON results for ops console
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const SYNTH_OUTPUT_DIR = process.env.SYNTH_OUTPUT_DIR || join(__dirname, '../artifacts/synth');
const TIMEOUT_MS = parseInt(process.env.SYNTH_TIMEOUT_MS || '30000');

// Ensure output directory exists
if (!existsSync(SYNTH_OUTPUT_DIR)) {
  mkdirSync(SYNTH_OUTPUT_DIR, { recursive: true });
}

/**
 * Make HTTP request with timeout
 */
async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DecisionGuide-Synth/1.0',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test basic health check
 */
async function testHealthCheck() {
  const startTime = Date.now();
  try {
    const response = await makeRequest(`${BASE_URL}/healthz`);
    const duration = Date.now() - startTime;

    if (response.status === 200) {
      const body = await response.json();
      return {
        name: 'health_check',
        status: 'PASS',
        duration_ms: duration,
        details: { status_code: 200, response_body: body }
      };
    } else {
      return {
        name: 'health_check',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Non-200 response' }
      };
    }
  } catch (error) {
    return {
      name: 'health_check',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Test compare endpoint TTFF (Time to First Token)
 */
async function testCompareTTFF() {
  const startTime = Date.now();
  try {
    const payload = {
      left: { scenarioId: 'synth-test-left', seed: 42 },
      right: { scenarioId: 'synth-test-right', seed: 43 }
    };

    const response = await makeRequest(`${BASE_URL}/compare`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;

    if (response.status === 200) {
      const body = await response.json();
      return {
        name: 'compare_ttff',
        status: 'PASS',
        duration_ms: duration,
        details: {
          status_code: 200,
          schema: body.schema,
          has_delta: !!body.delta,
          ttff_ms: duration
        }
      };
    } else {
      return {
        name: 'compare_ttff',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Non-200 response' }
      };
    }
  } catch (error) {
    return {
      name: 'compare_ttff',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Test batch compare endpoint
 */
async function testBatchCompare() {
  const startTime = Date.now();
  try {
    const payload = {
      items: [
        { scenarioId: 'synth-batch-1', seed: 10 },
        { scenarioId: 'synth-batch-2', seed: 20 },
        { scenarioId: 'synth-batch-3', seed: 30 }
      ]
    };

    const response = await makeRequest(`${BASE_URL}/compare/batch`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;

    if (response.status === 200) {
      const body = await response.json();
      return {
        name: 'batch_compare',
        status: 'PASS',
        duration_ms: duration,
        details: {
          status_code: 200,
          schema: body.schema,
          ranked_count: body.ranked?.length || 0
        }
      };
    } else {
      return {
        name: 'batch_compare',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Non-200 response' }
      };
    }
  } catch (error) {
    return {
      name: 'batch_compare',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Test error handling (BAD_INPUT taxonomy)
 */
async function testErrorHandling() {
  const startTime = Date.now();
  try {
    // Send invalid request to test error taxonomy
    const response = await makeRequest(`${BASE_URL}/compare`, {
      method: 'POST',
      body: JSON.stringify({ invalid: 'request' })
    });

    const duration = Date.now() - startTime;

    if (response.status === 400) {
      const body = await response.json();
      const hasCorrectType = body.type === 'BAD_INPUT';
      const hasMessage = !!body.message;
      const hasTimestamp = !!body.timestamp;

      return {
        name: 'error_handling',
        status: hasCorrectType && hasMessage && hasTimestamp ? 'PASS' : 'FAIL',
        duration_ms: duration,
        details: {
          status_code: 400,
          correct_error_type: hasCorrectType,
          has_message: hasMessage,
          has_timestamp: hasTimestamp,
          error_body: body
        }
      };
    } else {
      return {
        name: 'error_handling',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Expected 400 status' }
      };
    }
  } catch (error) {
    return {
      name: 'error_handling',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Test ops console availability (if enabled)
 */
async function testOpsConsole() {
  const startTime = Date.now();
  try {
    const response = await makeRequest(`${BASE_URL}/ops`);
    const duration = Date.now() - startTime;

    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      return {
        name: 'ops_console',
        status: 'PASS',
        duration_ms: duration,
        details: {
          status_code: 200,
          content_type: contentType,
          is_html: contentType?.includes('text/html')
        }
      };
    } else if (response.status === 404) {
      // Expected when ops console is disabled
      return {
        name: 'ops_console',
        status: 'PASS',
        duration_ms: duration,
        details: { status_code: 404, note: 'Ops console disabled (expected)' }
      };
    } else {
      return {
        name: 'ops_console',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Unexpected status' }
      };
    }
  } catch (error) {
    return {
      name: 'ops_console',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Test synthetic status endpoint
 */
async function testSynthStatus() {
  const startTime = Date.now();
  try {
    const response = await makeRequest(`${BASE_URL}/_status/synth-latest`);
    const duration = Date.now() - startTime;

    if (response.status === 200) {
      const body = await response.json();
      const hasRequiredFields = body.status && body.timestamp &&
                               typeof body.checks_passed === 'number' &&
                               typeof body.checks_total === 'number';

      return {
        name: 'synth_status',
        status: hasRequiredFields ? 'PASS' : 'FAIL',
        duration_ms: duration,
        details: {
          status_code: 200,
          has_required_fields: hasRequiredFields,
          response_body: body
        }
      };
    } else {
      return {
        name: 'synth_status',
        status: 'FAIL',
        duration_ms: duration,
        details: { status_code: response.status, error: 'Non-200 response' }
      };
    }
  } catch (error) {
    return {
      name: 'synth_status',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}

/**
 * Run all synthetic checks
 */
async function runSynthChecks() {
  console.log('🔍 Starting synthetic monitoring checks...');
  const overallStartTime = Date.now();

  const checks = [
    testHealthCheck,
    testCompareTTFF,
    testBatchCompare,
    testErrorHandling,
    testOpsConsole,
    testSynthStatus
  ];

  const results = [];

  for (const check of checks) {
    console.log(`  Running ${check.name}...`);
    try {
      const result = await check();
      results.push(result);
      console.log(`  ✅ ${result.name}: ${result.status} (${result.duration_ms}ms)`);
    } catch (error) {
      const errorResult = {
        name: check.name || 'unknown',
        status: 'ERROR',
        duration_ms: 0,
        details: { error: error.message }
      };
      results.push(errorResult);
      console.log(`  ❌ ${errorResult.name}: ERROR - ${error.message}`);
    }
  }

  const overallDuration = Date.now() - overallStartTime;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  const overallStatus = errors > 0 ? 'ERROR' :
                       failed > 0 ? 'FAIL' : 'PASS';

  const synthResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks_passed: passed,
    checks_total: results.length,
    checks_failed: failed,
    checks_error: errors,
    duration_ms: overallDuration,
    base_url: BASE_URL,
    checks: results
  };

  // Write results to file
  const outputFile = join(SYNTH_OUTPUT_DIR, 'synth-latest.json');
  writeFileSync(outputFile, JSON.stringify(synthResult, null, 2));

  console.log(`\n📊 Synthetic monitoring complete:`);
  console.log(`   Status: ${overallStatus}`);
  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Duration: ${overallDuration}ms`);
  console.log(`   Results: ${outputFile}`);

  // Exit with error code if any checks failed
  if (overallStatus !== 'PASS') {
    process.exit(1);
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runSynthChecks().catch(error => {
    console.error('❌ Synthetic monitoring failed:', error);
    process.exit(1);
  });
}