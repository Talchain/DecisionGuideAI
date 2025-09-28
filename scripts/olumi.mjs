#!/usr/bin/env node

/**
 * Unified olumi CLI
 * End-to-end developer helpers for the scenario platform
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base API URL (can be overridden by environment)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return { data, headers: response.headers };
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Unable to connect to API at ${BASE_URL}. Is the server running?`);
    }
    throw error;
  }
}

/**
 * Read JSON file
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Stream command
 */
async function streamCommand(options) {
  const { seed, scenario, budget, meta } = options;

  if (!seed) {
    console.error('Error: Seed is required (--seed)');
    process.exit(1);
  }

  try {
    let scenarioData;
    if (scenario) {
      if (scenario.endsWith('.json')) {
        scenarioData = await readJsonFile(scenario);
      } else {
        // Assume it's a scenario ID
        scenarioData = { scenarioId: scenario };
      }
    }

    const requestBody = {
      seed: parseInt(seed),
      scenario: scenarioData,
      budget: budget ? parseInt(budget) : undefined,
      meta: meta ? JSON.parse(meta) : undefined
    };

    console.log(`🚀 Starting stream with seed ${seed}...`);
    const { data } = await makeRequest('/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    console.log(`✅ Stream started successfully`);
    console.log(`📊 Run ID: ${data.runId}`);
    console.log(`🔗 Stream URL: ${BASE_URL}/stream/${data.runId}`);

  } catch (error) {
    console.error('Error starting stream:', error.message);
    process.exit(1);
  }
}

/**
 * Cancel command
 */
async function cancelCommand(options) {
  const { run } = options;

  if (!run) {
    console.error('Error: Run ID is required (--run)');
    process.exit(1);
  }

  try {
    console.log(`🛑 Cancelling run ${run}...`);
    const { data } = await makeRequest(`/stream/${run}/cancel`, {
      method: 'POST'
    });

    console.log(`✅ Cancel request sent successfully`);
    console.log(`⏱️  Response time: ${data.responseTime || 'unknown'}ms`);

  } catch (error) {
    console.error('Error cancelling run:', error.message);
    process.exit(1);
  }
}

/**
 * Report command
 */
async function reportCommand(options) {
  const { run, format } = options;

  if (!run) {
    console.error('Error: Run ID is required (--run)');
    process.exit(1);
  }

  try {
    console.log(`📊 Fetching report for run ${run}...`);
    const { data } = await makeRequest(`/report/${run}`);

    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Report retrieved successfully`);
      console.log(`📋 Schema: ${data.schema}`);
      console.log(`🔢 Seed: ${data.meta?.seed}`);
      console.log(`📈 Status: ${data.status}`);
      if (data.summary) {
        console.log(`📊 Summary: ${Object.keys(data.summary).length} metrics`);
      }
    }

  } catch (error) {
    console.error('Error fetching report:', error.message);
    process.exit(1);
  }
}

/**
 * Compare command
 */
async function compareCommand(options) {
  const { left, right, format } = options;

  if (!left || !right) {
    console.error('Error: Both left and right are required (--left, --right)');
    process.exit(1);
  }

  try {
    let leftData, rightData;

    // Process left input
    if (left.endsWith('.json')) {
      leftData = await readJsonFile(left);
    } else {
      leftData = { runId: left };
    }

    // Process right input
    if (right.endsWith('.json')) {
      rightData = await readJsonFile(right);
    } else {
      rightData = { runId: right };
    }

    console.log(`🔍 Comparing left=${left} vs right=${right}...`);
    const { data } = await makeRequest('/compare', {
      method: 'POST',
      body: JSON.stringify({
        left: leftData,
        right: rightData
      })
    });

    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Comparison completed successfully`);
      console.log(`📋 Schema: ${data.schema}`);
      if (data.delta) {
        console.log(`📊 Delta summary: ${Object.keys(data.delta).length} changes`);
      }
    }

  } catch (error) {
    console.error('Error comparing:', error.message);
    process.exit(1);
  }
}

/**
 * Snapshot command
 */
async function snapshotCommand(options) {
  const { run, format } = options;

  if (!run) {
    console.error('Error: Run ID is required (--run)');
    process.exit(1);
  }

  try {
    console.log(`📸 Creating snapshot for run ${run}...`);
    const { data } = await makeRequest(`/snapshot/${run}`, {
      method: 'POST'
    });

    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Snapshot created successfully`);
      console.log(`📋 Snapshot ID: ${data.snapshotId}`);
      console.log(`📊 Schema: ${data.schema}`);
    }

  } catch (error) {
    console.error('Error creating snapshot:', error.message);
    process.exit(1);
  }
}

/**
 * SCM command (delegated to existing SCM CLI)
 */
async function scmCommand(args) {
  try {
    const scmScript = path.join(__dirname, 'olumi-scm.mjs');

    const proc = spawn('node', [scmScript, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          process.exit(code);
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });

  } catch (error) {
    console.error('Error running SCM command:', error.message);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = { _: [] };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];

      if (value && !value.startsWith('--')) {
        result[key] = value;
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      result._.push(arg);
      i += 1;
    }
  }

  return result;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
olumi - Unified Developer CLI for Scenario Platform

Usage:
  olumi <command> [options]

Commands:
  stream --seed <n> [--scenario <id|file>] [--budget <n>] [--meta <json>]
                              Start a scenario stream
  cancel --run <id>          Cancel a running scenario
  report --run <id> [--format json]
                              Get report for a completed run
  compare --left <file|id> --right <file|id> [--format json]
                              Compare two scenarios or runs
  snapshot --run <id> [--format json]
                              Create snapshot of a run
  scm <subcommand>           SCM operations (list, get, diff, suggest)

Global Options:
  --format json              Output raw JSON (where supported)
  --help                     Show this help message

Environment:
  BASE_URL                   API base URL (default: http://localhost:3001)

Examples:
  olumi stream --seed 42
  olumi stream --seed 42 --scenario ./my-scenario.json
  olumi cancel --run abc123
  olumi report --run abc123
  olumi compare --left abc123 --right def456
  olumi compare --left ./v1.json --right ./v2.json
  olumi snapshot --run abc123
  olumi scm list
  olumi scm diff --base v1 --candidate v2
`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  const command = options._[0];

  if (options.help || !command) {
    showHelp();
    return;
  }

  switch (command) {
    case 'stream':
      await streamCommand(options);
      break;

    case 'cancel':
      await cancelCommand(options);
      break;

    case 'report':
      await reportCommand(options);
      break;

    case 'compare':
      await compareCommand(options);
      break;

    case 'snapshot':
      await snapshotCommand(options);
      break;

    case 'scm':
      await scmCommand(options._.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "olumi --help" for usage information.');
      process.exit(1);
  }
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