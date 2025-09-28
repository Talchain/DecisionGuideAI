#!/usr/bin/env node

/**
 * olumi-scm CLI tool
 * Command-line interface for SCM-lite operations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base API URL (can be overridden by environment)
const API_BASE = process.env.SCM_API_BASE || 'http://localhost:3000';

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
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
      throw new Error('Unable to connect to SCM API. Is the server running?');
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
 * List command
 */
async function listVersions() {
  try {
    const { data } = await makeRequest('/scm/versions');

    console.log('Available versions:');
    console.log('==================');

    if (data.versions.length === 0) {
      console.log('No versions found.');
      return;
    }

    for (const version of data.versions) {
      console.log(`ID: ${version.id}`);
      console.log(`Label: ${version.label}`);
      console.log(`Scenario: ${version.scenarioId}`);
      console.log(`Created: ${version.createdAt}`);
      if (version.signer) {
        console.log(`Signed: ${version.signer}`);
      }
      console.log('---');
    }
  } catch (error) {
    console.error('Error listing versions:', error.message);
    process.exit(1);
  }
}

/**
 * Get command
 */
async function getVersion(versionId) {
  if (!versionId) {
    console.error('Error: Version ID is required');
    process.exit(1);
  }

  try {
    const { data } = await makeRequest(`/scm/versions/${versionId}`);

    console.log('Version Details:');
    console.log('================');
    console.log(`ID: ${data.metadata.id}`);
    console.log(`Label: ${data.metadata.label}`);
    console.log(`Scenario: ${data.metadata.scenarioId}`);
    console.log(`Created: ${data.metadata.createdAt}`);
    console.log(`Checksum: ${data.metadata.checksum}`);
    if (data.metadata.signer) {
      console.log(`Signed: ${data.metadata.signer}`);
    }
    console.log('\\nScenario:');
    console.log(JSON.stringify(data.scenario, null, 2));
  } catch (error) {
    console.error('Error getting version:', error.message);
    process.exit(1);
  }
}

/**
 * Diff command
 */
async function calculateDiff(options) {
  const { base, candidate } = options;

  if (!base) {
    console.error('Error: Base reference is required (--base)');
    process.exit(1);
  }

  if (!candidate) {
    console.error('Error: Candidate is required (--candidate)');
    process.exit(1);
  }

  try {
    let candidateSpec;

    // Check if candidate is a file path
    if (candidate.endsWith('.json')) {
      const candidateScenario = await readJsonFile(candidate);
      candidateSpec = { inlineScenario: candidateScenario };
    } else {
      // Assume it's a version ID
      candidateSpec = { versionId: candidate };
    }

    const { data } = await makeRequest('/scm/diff', {
      method: 'POST',
      body: JSON.stringify({
        baseRef: base,
        candidate: candidateSpec
      })
    });

    console.log('Diff Results:');
    console.log('=============');
    console.log(`Base: ${data.meta.baseRef}`);
    console.log(`Candidate: ${data.meta.candidateRef}`);
    console.log(`Created: ${data.meta.createdAt}`);
    console.log('');
    console.log('Summary:');
    console.log(`  Nodes: +${data.summary.nodesAdded} -${data.summary.nodesRemoved} ~${data.summary.nodesChanged}`);
    console.log(`  Links: +${data.summary.linksAdded} -${data.summary.linksRemoved}`);
    console.log(`  Weights changed: ${data.summary.weightsChanged}`);
    console.log('');

    if (data.changes.length > 0) {
      console.log('Changes:');
      for (const change of data.changes) {
        console.log(`  ${change.path}:`);
        if (change.before === undefined) {
          console.log(`    + ${JSON.stringify(change.after)}`);
        } else if (change.after === undefined) {
          console.log(`    - ${JSON.stringify(change.before)}`);
        } else {
          console.log(`    - ${JSON.stringify(change.before)}`);
          console.log(`    + ${JSON.stringify(change.after)}`);
        }
      }
    } else {
      console.log('No changes detected.');
    }
  } catch (error) {
    console.error('Error calculating diff:', error.message);
    process.exit(1);
  }
}

/**
 * Suggest command
 */
async function createSuggestion(options) {
  const { base, title, file, note } = options;

  if (!base || !title || !file) {
    console.error('Error: Base reference (--base), title (--title), and file (--file) are required');
    process.exit(1);
  }

  try {
    const candidateScenario = await readJsonFile(file);

    const { data, headers } = await makeRequest('/scm/suggest', {
      method: 'POST',
      body: JSON.stringify({
        baseRef: base,
        title: title,
        note: note,
        candidateScenario: candidateScenario
      })
    });

    console.log('Proposal Created:');
    console.log('=================');
    console.log(`ID: ${data.proposal.id}`);
    console.log(`Title: ${data.proposal.title}`);
    console.log(`Base: ${data.proposal.baseRef}`);
    if (data.proposal.note) {
      console.log(`Note: ${data.proposal.note}`);
    }
    console.log(`Created: ${data.proposal.createdAt}`);

    if (headers.get('X-Proposal-Transient')) {
      console.log('\\n⚠️  This proposal is transient and not persisted (SCM_WRITES=0)');
    }

    console.log('\\nDiff Summary:');
    console.log(`  Nodes: +${data.diff.summary.nodesAdded} -${data.diff.summary.nodesRemoved} ~${data.diff.summary.nodesChanged}`);
    console.log(`  Links: +${data.diff.summary.linksAdded} -${data.diff.summary.linksRemoved}`);
    console.log(`  Weights changed: ${data.diff.summary.weightsChanged}`);

    if (data.diff.changes.length > 0) {
      console.log('\\nKey Changes:');
      // Show first 5 changes
      for (const change of data.diff.changes.slice(0, 5)) {
        console.log(`  ${change.path}`);
      }
      if (data.diff.changes.length > 5) {
        console.log(`  ... and ${data.diff.changes.length - 5} more`);
      }
    }
  } catch (error) {
    console.error('Error creating suggestion:', error.message);
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
olumi-scm - SCM-lite command line tool

Usage:
  olumi-scm <command> [options]

Commands:
  list                          List all available versions
  get <versionId>              Get details for a specific version
  diff --base <id> --candidate <id|file>
                              Calculate diff between base and candidate
  suggest --base <id> --title "Title" --file <file> [--note "Note"]
                              Create a proposal from a scenario file

Options:
  --base <id>                 Base version ID
  --candidate <id|file>       Candidate version ID or JSON file path
  --title <title>             Proposal title
  --file <file>               Path to scenario JSON file
  --note <note>               Optional note for proposal
  --help                      Show this help message

Examples:
  olumi-scm list
  olumi-scm get v-1234567890-abc123
  olumi-scm diff --base v-1234567890-abc123 --candidate v-1234567891-def456
  olumi-scm diff --base v-1234567890-abc123 --candidate ./my-scenario.json
  olumi-scm suggest --base v-1234567890-abc123 --title "Optimize weights" --file ./optimized.json

Environment:
  SCM_API_BASE               API base URL (default: http://localhost:3000)
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
    case 'list':
      await listVersions();
      break;

    case 'get':
      await getVersion(options._[1]);
      break;

    case 'diff':
      await calculateDiff(options);
      break;

    case 'suggest':
      await createSuggestion(options);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "olumi-scm --help" for usage information.');
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