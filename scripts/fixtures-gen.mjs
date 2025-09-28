#!/usr/bin/env node

/**
 * fixtures-gen.mjs
 * Auto-generator for UI fixtures (NDJSON stream, report, compare)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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
 * Write file with directories
 */
async function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}

/**
 * Capture NDJSON stream
 */
async function captureStream(runId, outputPath) {
  console.log(`📡 Capturing stream for run ${runId}...`);

  const response = await makeRequest(`/stream/${runId}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const chunks = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep the incomplete line

      for (const line of lines) {
        if (line.trim()) {
          chunks.push(line);
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      chunks.push(buffer);
    }

    const ndjsonContent = chunks.join('\n') + '\n';
    await writeFile(outputPath, ndjsonContent);

    console.log(`✅ Stream captured: ${chunks.length} events`);
    return chunks;

  } finally {
    reader.releaseLock();
  }
}

/**
 * Generate fixtures
 */
async function generateFixtures(seed, scenario, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const timestampDir = path.join(outputDir, timestamp);

  console.log(`🎯 Generating fixtures for seed ${seed}`);
  console.log(`📁 Output directory: ${timestampDir}`);

  // Prepare scenario data
  let scenarioData;
  if (scenario) {
    if (scenario.endsWith('.json')) {
      scenarioData = await readJsonFile(scenario);
      console.log(`📋 Using scenario from file: ${scenario}`);
    } else {
      scenarioData = { scenarioId: scenario };
      console.log(`🔗 Using scenario ID: ${scenario}`);
    }
  } else {
    scenarioData = {
      nodes: [
        { id: 'decision', label: 'Test Decision', weight: 1.0 },
        { id: 'factor1', label: 'Factor 1', weight: 0.7 },
        { id: 'factor2', label: 'Factor 2', weight: 0.8 }
      ],
      links: [
        { from: 'decision', to: 'factor1', weight: 0.7 },
        { from: 'decision', to: 'factor2', weight: 0.8 }
      ]
    };
    console.log(`🧪 Using default test scenario`);
  }

  // Start stream
  console.log(`🚀 Starting stream...`);
  const streamResponse = await makeRequest('/stream', {
    method: 'POST',
    body: JSON.stringify({
      seed: parseInt(seed),
      scenario: scenarioData,
      meta: {
        fixtureGeneration: true,
        timestamp: new Date().toISOString()
      }
    })
  });

  const streamData = await streamResponse.json();
  const runId = streamData.runId;
  console.log(`📊 Stream started with run ID: ${runId}`);

  // Wait for completion (simulation should be fast)
  console.log(`⏳ Waiting for stream completion...`);
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds timeout

  while (attempts < maxAttempts) {
    try {
      const reportResponse = await makeRequest(`/report/${runId}`);
      if (reportResponse.ok) {
        break; // Report available, stream is complete
      }
    } catch (error) {
      // Report not ready yet, continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Timeout waiting for stream completion');
  }

  // Capture NDJSON stream
  const streamPath = path.join(timestampDir, 'stream.ndjson');
  const events = await captureStream(runId, streamPath);

  // Get report
  console.log(`📊 Fetching report...`);
  const reportResponse = await makeRequest(`/report/${runId}`);
  const reportData = await reportResponse.json();
  const reportPath = path.join(timestampDir, 'report.json');
  await writeFile(reportPath, JSON.stringify(reportData, null, 2));

  // Generate compare data (run again with different seed for comparison)
  console.log(`🔍 Generating comparison data...`);
  const compareStreamResponse = await makeRequest('/stream', {
    method: 'POST',
    body: JSON.stringify({
      seed: parseInt(seed) + 1,
      scenario: scenarioData,
      meta: {
        fixtureGeneration: true,
        comparison: true,
        timestamp: new Date().toISOString()
      }
    })
  });

  const compareStreamData = await compareStreamResponse.json();
  const compareRunId = compareStreamData.runId;

  // Wait for comparison run
  attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const compareReportResponse = await makeRequest(`/report/${compareRunId}`);
      if (compareReportResponse.ok) {
        break;
      }
    } catch (error) {
      // Report not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  // Get comparison data
  const compareResponse = await makeRequest('/compare', {
    method: 'POST',
    body: JSON.stringify({
      left: { runId: runId },
      right: { runId: compareRunId }
    })
  });

  const compareData = await compareResponse.json();
  const comparePath = path.join(timestampDir, 'compare.json');
  await writeFile(comparePath, JSON.stringify(compareData, null, 2));

  // Create metadata file
  const metadata = {
    generated: new Date().toISOString(),
    seed: parseInt(seed),
    scenario: scenarioData,
    runs: {
      primary: runId,
      comparison: compareRunId
    },
    files: {
      stream: 'stream.ndjson',
      report: 'report.json',
      compare: 'compare.json'
    },
    stats: {
      streamEvents: events.length,
      reportStatus: reportData.status,
      compareSchema: compareData.schema
    }
  };

  const metadataPath = path.join(timestampDir, 'metadata.json');
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  // Update latest symlink
  const latestDir = path.join(outputDir, 'latest');
  try {
    await fs.unlink(latestDir);
  } catch (error) {
    // Symlink might not exist
  }

  try {
    await fs.symlink(path.basename(timestampDir), latestDir);
  } catch (error) {
    // Fallback for systems without symlink support
    console.log(`⚠️  Could not create symlink: ${error.message}`);
  }

  console.log(`✅ Fixtures generated successfully!`);
  console.log(`📁 Location: ${timestampDir}`);
  console.log(`📊 Files created:`);
  console.log(`   - stream.ndjson (${events.length} events)`);
  console.log(`   - report.json (${reportData.schema})`);
  console.log(`   - compare.json (${compareData.schema})`);
  console.log(`   - metadata.json`);

  return {
    outputDir: timestampDir,
    runId,
    compareRunId,
    metadata
  };
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
fixtures-gen - Auto-generator for UI fixtures

Usage:
  fixtures-gen --seed <n> [--scenario <id|file>]

Options:
  --seed <n>                Seed number for deterministic generation
  --scenario <id|file>      Scenario ID or JSON file path (optional)
  --help                    Show this help message

Environment:
  BASE_URL                  API base URL (default: http://localhost:3001)

Output:
  Creates deterministic NDJSON stream, report.json, and compare.json
  in artifacts/seed/auto/<timestamp>/ with latest/ symlink

Examples:
  fixtures-gen --seed 42
  fixtures-gen --seed 42 --scenario ./my-scenario.json
  fixtures-gen --seed 42 --scenario scenario-001
`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
  }

  const { seed, scenario } = options;

  if (!seed) {
    console.error('Error: Seed is required (--seed)');
    process.exit(1);
  }

  try {
    const outputDir = path.join(projectRoot, 'artifacts', 'seed', 'auto');
    await generateFixtures(seed, scenario, outputDir);

  } catch (error) {
    console.error('Error generating fixtures:', error.message);
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