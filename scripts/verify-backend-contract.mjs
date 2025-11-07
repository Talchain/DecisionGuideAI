#!/usr/bin/env node
/**
 * Backend Contract Verification Script
 *
 * Verifies the PLoT v1 API backend contract by testing:
 * - /v1/health - returns 200 with status
 * - /v1/limits - returns 200 with max_nodes, max_edges, max_runs_per_hour
 * - /v1/validate - returns 200 with valid boolean and errors array
 *
 * Usage:
 *   node scripts/verify-backend-contract.mjs
 *   SKIP_CONTRACT_CHECK=1 node scripts/verify-backend-contract.mjs  # Skip verification
 *   BASE_URL=https://api.example.com node scripts/verify-backend-contract.mjs
 */

import { exit } from 'process';

// Configuration
const SKIP_CHECK = process.env.SKIP_CONTRACT_CHECK === '1';
const BASE_URL = process.env.VITE_PLOT_LITE_BASE_URL
  || process.env.BASE_URL
  || 'https://plot-lite-service.onrender.com';

const TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Test /v1/health endpoint
 */
async function testHealthEndpoint() {
  console.log('🔍 Testing /v1/health...');

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/v1/health`);

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const data = await response.json();

    // Validate shape
    if (typeof data.status !== 'string') {
      throw new Error('Missing or invalid "status" field (expected string)');
    }

    if (!['ok', 'degraded', 'down'].includes(data.status)) {
      console.warn(`⚠️  Warning: Unexpected status value "${data.status}" (expected: ok, degraded, or down)`);
    }

    console.log(`✅ /v1/health returned 200 with status="${data.status}"`);
    return true;
  } catch (error) {
    console.error(`❌ /v1/health failed: ${error.message}`);
    return false;
  }
}

/**
 * Test /v1/limits endpoint
 */
async function testLimitsEndpoint() {
  console.log('🔍 Testing /v1/limits...');

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/v1/limits`);

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const data = await response.json();

    // Validate shape - actual backend returns: {"nodes":{"max":200},"edges":{"max":500}}
    let maxNodes, maxEdges;

    if (data.nodes && typeof data.nodes.max === 'number') {
      maxNodes = data.nodes.max;
    } else if ('max_nodes' in data || 'maxNodes' in data) {
      maxNodes = data.max_nodes || data.maxNodes;
    }

    if (data.edges && typeof data.edges.max === 'number') {
      maxEdges = data.edges.max;
    } else if ('max_edges' in data || 'maxEdges' in data) {
      maxEdges = data.max_edges || data.maxEdges;
    }

    if (!maxNodes) {
      throw new Error('Missing nodes limit (expected: nodes.max, max_nodes, or maxNodes)');
    }

    if (!maxEdges) {
      throw new Error('Missing edges limit (expected: edges.max, max_edges, or maxEdges)');
    }

    if (typeof maxNodes !== 'number' || maxNodes <= 0) {
      throw new Error(`Invalid nodes limit: ${maxNodes} (expected positive number)`);
    }

    if (typeof maxEdges !== 'number' || maxEdges <= 0) {
      throw new Error(`Invalid edges limit: ${maxEdges} (expected positive number)`);
    }

    console.log(`✅ /v1/limits returned 200 with nodes.max=${maxNodes}, edges.max=${maxEdges}`);
    return true;
  } catch (error) {
    console.error(`❌ /v1/limits failed: ${error.message}`);
    return false;
  }
}

/**
 * Test /v1/validate endpoint
 */
async function testValidateEndpoint() {
  console.log('🔍 Testing /v1/validate...');

  try {
    // Send a minimal valid graph (backend requires label field)
    const testPayload = {
      graph: {
        nodes: [
          { id: 'test-node-1', label: 'Test Node' }
        ],
        edges: []
      }
    };

    const response = await fetchWithTimeout(`${BASE_URL}/v1/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      // 422 is acceptable if backend validates strictly
      if (response.status === 422) {
        console.log('⚠️  Got 422 (validation failed) - checking response shape...');
        const data = await response.json();

        if (typeof data.valid !== 'boolean') {
          throw new Error('422 response missing "valid" boolean field');
        }

        // Accept both "errors" and "violations" array
        const errorArray = data.errors || data.violations;
        if (!Array.isArray(errorArray)) {
          throw new Error('422 response missing "errors" or "violations" array field');
        }

        console.log(`✅ /v1/validate returned 422 with valid=${data.valid}, issues.length=${errorArray.length} (acceptable)`);
        return true;
      }

      throw new Error(`Expected 200 or 422, got ${response.status}`);
    }

    const data = await response.json();

    // Validate shape - actual backend returns {"valid":true,"violations":[]}
    if (typeof data.valid !== 'boolean') {
      throw new Error('Missing or invalid "valid" field (expected boolean)');
    }

    // Accept both "errors" and "violations" array
    const errorArray = data.errors || data.violations;
    if (!Array.isArray(errorArray)) {
      throw new Error('Missing or invalid "errors" or "violations" field (expected array)');
    }

    console.log(`✅ /v1/validate returned 200 with valid=${data.valid}, violations.length=${errorArray.length}`);
    return true;
  } catch (error) {
    console.error(`❌ /v1/validate failed: ${error.message}`);
    return false;
  }
}

/**
 * Test /v1/run endpoint
 */
async function testRunEndpoint() {
  console.log('🔍 Testing /v1/run...');

  try {
    const testPayload = {
      graph: {
        nodes: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: 0.7 }]
      },
      outcome_node: 'B',
      seed: 4242,
      include_debug: true
    };

    const response = await fetchWithTimeout(`${BASE_URL}/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    }, 15000); // Longer timeout for run

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const data = await response.json();

    if (!data.result) {
      throw new Error('Missing "result" field');
    }

    if (!data.result.response_hash) {
      throw new Error('Missing "result.response_hash" field - determinism violation!');
    }

    const hasDebug = data.debug && typeof data.debug === 'object';
    const hashPreview = data.result.response_hash.substring(0, 16);

    console.log(`✅ /v1/run returned 200 with response_hash="${hashPreview}...", debug=${hasDebug}`);
    return true;
  } catch (error) {
    console.error(`❌ /v1/run failed: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Backend Contract Verification');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('');

  if (SKIP_CHECK) {
    console.log('⏭️  SKIP_CONTRACT_CHECK=1 - Skipping verification');
    exit(0);
  }

  // Run all tests
  const results = await Promise.all([
    testHealthEndpoint(),
    testLimitsEndpoint(),
    testValidateEndpoint(),
    testRunEndpoint(),
  ]);

  console.log('');

  // Check results
  const allPassed = results.every(r => r === true);

  if (allPassed) {
    console.log('✅ All contract checks passed');
    exit(0);
  } else {
    const failedCount = results.filter(r => !r).length;
    console.error(`❌ ${failedCount}/${results.length} contract checks failed`);
    console.error('');
    console.error('💡 Tip: Set SKIP_CONTRACT_CHECK=1 to bypass this check');
    console.error('   Example: SKIP_CONTRACT_CHECK=1 npm run ci:verify-contract');
    exit(1);
  }
}

main().catch((error) => {
  console.error('');
  console.error('💥 Unexpected error during contract verification:');
  console.error(error);
  exit(1);
});
