#!/usr/bin/env tsx

/**
 * Scenario Linter Test Script
 * Tests the scenario linting functionality
 */

import { lintScenario } from '../src/lib/lint/scenario-linter.js';

/**
 * Test scenario data
 */
const testScenario = {
  title: "Test Decision",
  description: "A test scenario for linting",
  nodes: [
    {
      id: "root",
      type: "decision",
      title: "Root Decision",
      weight: 1.0,
      children: ["option1", "option2"]
    },
    {
      id: "option1",
      type: "option",
      title: "Option A",
      weight: 0.7,
      value: 100,
      children: []
    },
    {
      id: "option2",
      type: "option",
      title: "Option B",
      weight: 0.3,
      value: 80,
      children: []
    }
  ],
  links: [
    { from: "root", to: "option1", weight: 0.6 },
    { from: "root", to: "option2", weight: 0.4 }
  ]
};

/**
 * Test problematic scenario
 */
const problematicScenario = {
  title: "",  // Missing title
  nodes: [
    {
      id: "root",
      type: "decision",
      weight: -0.5,  // Invalid negative weight
      children: ["missing-node"]  // References non-existent node
    }
  ],
  links: [
    { from: "root", to: "nowhere", weight: 1.5 }  // Invalid weight > 1
  ]
};

/**
 * Test scenario linter
 */
async function testLinter() {
  console.log('🔍 Testing Scenario Linter...\n');

  // Test 1: Valid scenario
  console.log('1️⃣  Testing valid scenario:');
  const result1 = lintScenario(testScenario);
  console.log(JSON.stringify(result1, null, 2));

  console.log('\n2️⃣  Testing problematic scenario:');
  const result2 = lintScenario(problematicScenario);
  console.log(JSON.stringify(result2, null, 2));

  console.log('\n✅ Linter tests completed!');
}

/**
 * Main function
 */
async function main() {
  try {
    await testLinter();
  } catch (error) {
    console.error('❌ Linter test failed:', error.message);
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