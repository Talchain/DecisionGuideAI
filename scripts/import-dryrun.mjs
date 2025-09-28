#!/usr/bin/env node

/**
 * Import Dry-Run CLI Helper
 * Test import functionality without persisting data
 */

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
 * Read file
 */
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Read JSON file
 */
async function readJsonFile(filePath) {
  try {
    const content = await readFile(filePath);
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse JSON ${filePath}: ${error.message}`);
  }
}

/**
 * CSV import command
 */
async function csvImportCommand(options) {
  const { csv: csvFile, mapping: mappingFile, output } = options;

  if (!csvFile) {
    console.error('Error: CSV file is required (--csv)');
    process.exit(1);
  }

  if (!mappingFile) {
    console.error('Error: Mapping file is required (--mapping)');
    process.exit(1);
  }

  try {
    console.log(`📋 Reading CSV file: ${csvFile}`);
    const csvData = await readFile(csvFile);

    console.log(`🗺️  Reading mapping file: ${mappingFile}`);
    const mapping = await readJsonFile(mappingFile);

    console.log(`🚀 Running import dry-run...`);
    const { data } = await makeRequest('/import/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        csv: csvData,
        mapping
      })
    });

    if (output) {
      console.log(`💾 Writing output to: ${output}`);
      await fs.writeFile(output, JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Import dry-run completed successfully`);
      console.log(`📋 Schema: ${data.schema}`);
      console.log(`📊 Summary:`);
      console.log(`   - Nodes: ${data.summary.nodes}`);
      console.log(`   - Links: ${data.summary.links}`);

      if (data.summary.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${data.summary.warnings.length}`);
        data.summary.warnings.forEach(warning => {
          console.log(`   - ${warning}`);
        });
      }

      if (data.summary.errors.length > 0) {
        console.log(`❌ Errors: ${data.summary.errors.length}`);
        data.summary.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }

      console.log(`📝 Scenario Preview: "${data.scenarioPreview.title}"`);
    }

  } catch (error) {
    console.error('Import dry-run failed:', error.message);
    process.exit(1);
  }
}

/**
 * Google Sheets import command (placeholder)
 */
async function sheetsImportCommand(options) {
  const { sheetId, range, mapping: mappingFile, output } = options;

  if (!sheetId) {
    console.error('Error: Sheet ID is required (--sheet-id)');
    process.exit(1);
  }

  if (!range) {
    console.error('Error: Range is required (--range)');
    process.exit(1);
  }

  if (!mappingFile) {
    console.error('Error: Mapping file is required (--mapping)');
    process.exit(1);
  }

  try {
    console.log(`📋 Importing from Google Sheets: ${sheetId}`);
    console.log(`📍 Range: ${range}`);

    const mapping = await readJsonFile(mappingFile);

    console.log(`🚀 Running import dry-run...`);
    const { data } = await makeRequest('/import/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        googleSheet: {
          sheetId,
          range
        },
        mapping
      })
    });

    if (output) {
      await fs.writeFile(output, JSON.stringify(data, null, 2));
      console.log(`💾 Output written to: ${output}`);
    } else {
      console.log(`✅ Import dry-run completed`);
      console.log(`📋 Schema: ${data.schema}`);
      console.log(`📊 Summary: ${data.summary.nodes} nodes, ${data.summary.links} links`);

      if (data.summary.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${data.summary.warnings.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Sheets import dry-run failed:', error.message);
    process.exit(1);
  }
}

/**
 * Jira import command (placeholder)
 */
async function jiraImportCommand(options) {
  const { jql, mapping: mappingFile, output } = options;

  if (!jql) {
    console.error('Error: JQL query is required (--jql)');
    process.exit(1);
  }

  if (!mappingFile) {
    console.error('Error: Mapping file is required (--mapping)');
    process.exit(1);
  }

  try {
    console.log(`📋 Importing from Jira with JQL: ${jql}`);

    const mapping = await readJsonFile(mappingFile);

    console.log(`🚀 Running import dry-run...`);
    const { data } = await makeRequest('/import/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        jira: {
          jql
        },
        mapping
      })
    });

    if (output) {
      await fs.writeFile(output, JSON.stringify(data, null, 2));
      console.log(`💾 Output written to: ${output}`);
    } else {
      console.log(`✅ Import dry-run completed`);
      console.log(`📋 Schema: ${data.schema}`);
      console.log(`📊 Summary: ${data.summary.nodes} nodes, ${data.summary.links} links`);

      if (data.summary.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${data.summary.warnings.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Jira import dry-run failed:', error.message);
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
Import Dry-Run CLI

Usage:
  node scripts/import-dryrun.mjs csv --csv <file> --mapping <file> [--output <file>]
  node scripts/import-dryrun.mjs sheets --sheet-id <id> --range <range> --mapping <file> [--output <file>]
  node scripts/import-dryrun.mjs jira --jql <query> --mapping <file> [--output <file>]

Commands:
  csv       Import from CSV file
  sheets    Import from Google Sheets (placeholder)
  jira      Import from Jira (placeholder)

Options:
  --csv           Path to CSV file
  --mapping       Path to mapping configuration JSON file
  --sheet-id      Google Sheets ID
  --range         Google Sheets range (e.g., "A1:Z100")
  --jql           Jira JQL query
  --output        Output file for results (optional, prints to console if not specified)
  --help          Show this help message

Examples:
  node scripts/import-dryrun.mjs csv --csv data.csv --mapping artifacts/import/mappings/basic.json
  node scripts/import-dryrun.mjs sheets --sheet-id 1abc --range A1:Z100 --mapping basic.json
  node scripts/import-dryrun.mjs jira --jql "project = PROJ" --mapping basic.json

Environment:
  BASE_URL        API base URL (default: http://localhost:3001)
`);
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args._.length === 0) {
    showHelp();
    return;
  }

  const command = args._[0];

  try {
    switch (command) {
      case 'csv':
        await csvImportCommand(args);
        break;

      case 'sheets':
        await sheetsImportCommand(args);
        break;

      case 'jira':
        await jiraImportCommand(args);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run with --help for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();