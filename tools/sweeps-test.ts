#!/usr/bin/env tsx

/**
 * Parameter Sweeps Test Script
 * Tests the parameter sweeps functionality
 */

import { parameterSweepApi } from '../src/lib/sweep/parameter-sweeps.js';

/**
 * Test base scenario for parameter sweeping
 */
const baseScenario = {
  title: "Investment Decision",
  nodes: [
    {
      id: "investment",
      type: "decision",
      title: "Investment Decision",
      weight: 1.0,
      children: ["risk", "return"]
    },
    {
      id: "risk",
      type: "factor",
      title: "Risk Level",
      weight: 0.3,
      value: 100,
      children: []
    },
    {
      id: "return",
      type: "factor",
      title: "Expected Return",
      weight: 0.7,
      value: 150,
      children: []
    }
  ],
  links: [
    { from: "investment", to: "risk", weight: 0.3 },
    { from: "investment", to: "return", weight: 0.7 }
  ]
};

/**
 * Test parameter sweeps
 */
async function testSweeps() {
  console.log('📊 Testing Parameter Sweeps...\n');

  // Test 1: Single parameter sweep
  console.log('1️⃣  Testing single parameter sweep (node weight):');
  const sweep1 = await parameterSweepApi.generateSweep(
    baseScenario,
    [{ path: 'nodes[0].weight', type: 'node_weight' }]
  );
  console.log(JSON.stringify(sweep1, null, 2));

  console.log('\n2️⃣  Testing single parameter sweep (link weight):');
  const sweep2 = await parameterSweepApi.generateSweep(
    baseScenario,
    [{ path: 'links[0].weight', type: 'link_weight' }]
  );
  console.log(JSON.stringify(sweep2, null, 2));

  console.log('\n3️⃣  Testing multi-parameter sweep:');
  const sweep3 = await parameterSweepApi.generateSweep(
    baseScenario,
    [
      { path: 'nodes[1].weight', type: 'node_weight' },
      { path: 'nodes[2].weight', type: 'node_weight' }
    ]
  );
  console.log(JSON.stringify(sweep3, null, 2));

  console.log('\n✅ Parameter sweeps tests completed!');
}

/**
 * Main function
 */
async function main() {
  try {
    await testSweeps();
  } catch (error) {
    console.error('❌ Sweeps test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}