#!/usr/bin/env tsx

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, relative } from 'path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';

interface LintOptions {
  paths: string[];
  recursive: boolean;
  format: 'table' | 'json';
  schema?: string;
  exitOnError: boolean;
}

interface LintResult {
  path: string;
  valid: boolean;
  errors: ErrorObject[];
  warnings: string[];
  parsed?: any;
}

const DEFAULT_SCHEMA = 'schemas/scenario.schema.json';

async function loadSchema(schemaPath: string): Promise<object> {
  try {
    const schemaContent = await readFile(schemaPath, 'utf-8');
    return JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Failed to load schema from ${schemaPath}: ${(error as Error).message}`);
  }
}

async function findScenarioFiles(paths: string[], recursive: boolean): Promise<string[]> {
  const files: string[] = [];

  for (const path of paths) {
    const stats = await stat(path).catch(() => null);
    if (!stats) {
      console.warn(`Warning: Path not found: ${path}`);
      continue;
    }

    if (stats.isFile()) {
      if (['.yaml', '.yml'].includes(extname(path))) {
        files.push(path);
      }
    } else if (stats.isDirectory()) {
      const entries = await readdir(path);
      for (const entry of entries) {
        const fullPath = join(path, entry);
        const entryStats = await stat(fullPath);

        if (entryStats.isFile() && ['.yaml', '.yml'].includes(extname(entry))) {
          files.push(fullPath);
        } else if (entryStats.isDirectory() && recursive) {
          const subFiles = await findScenarioFiles([fullPath], recursive);
          files.push(...subFiles);
        }
      }
    }
  }

  return files.sort();
}

async function lintScenario(filePath: string, schema: object): Promise<LintResult> {
  const result: LintResult = {
    path: filePath,
    valid: false,
    errors: [],
    warnings: []
  };

  try {
    // Read and parse YAML
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content);
    result.parsed = parsed;

    // Validate against schema
    const ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });

    const validate = ajv.compile(schema);
    const valid = validate(parsed);

    result.valid = valid;
    if (!valid && validate.errors) {
      result.errors = validate.errors;
    }

    // Additional custom warnings
    if (parsed && typeof parsed === 'object') {
      // Check for missing recommended fields
      if (!parsed.params) {
        result.warnings.push('Missing recommended "params" section');
      }
      if (!parsed.metadata) {
        result.warnings.push('Missing recommended "metadata" section');
      }

      // Check for potential issues with options (nested or flat format)
      const options = parsed.decision?.options || parsed.options;
      if (options && options.length < 2) {
        result.warnings.push('Should have at least 2 options');
      }
      if (options && options.length > 10) {
        result.warnings.push('Consider reducing options count for clarity (>10 options)');
      }

      // Check for duplicate option names
      if (options) {
        const names = options.map((opt: any) => opt.name?.toLowerCase()).filter(Boolean);
        const duplicates = names.filter((name: string, index: number) => names.indexOf(name) !== index);
        if (duplicates.length > 0) {
          result.warnings.push(`Duplicate option names: ${[...new Set(duplicates)].join(', ')}`);
        }
      }

      // Check if scenario has options at all (either format)
      if (!parsed.decision?.options && !parsed.options) {
        result.warnings.push('No options found - scenarios should have decision options');
      }
    }

  } catch (error) {
    result.errors.push({
      keyword: 'parse',
      message: `Failed to parse YAML: ${(error as Error).message}`,
      instancePath: '',
      schemaPath: '',
      data: null
    } as ErrorObject);
  }

  return result;
}

function formatTableOutput(results: LintResult[]): void {
  console.log('\n📋 Scenario Validation Results\n');
  console.log('┌─' + '─'.repeat(50) + '─┬─' + '─'.repeat(8) + '─┬─' + '─'.repeat(10) + '─┐');
  console.log('│ File' + ' '.repeat(47) + '│ Status   │ Issues     │');
  console.log('├─' + '─'.repeat(50) + '─┼─' + '─'.repeat(8) + '─┼─' + '─'.repeat(10) + '─┤');

  for (const result of results) {
    const fileName = relative('.', result.path).slice(0, 47);
    const status = result.valid ? (result.warnings.length > 0 ? '⚠️  WARN' : '✅ PASS') : '❌ FAIL';
    const issues = `${result.errors.length}E ${result.warnings.length}W`;

    console.log(`│ ${fileName.padEnd(47)} │ ${status.padEnd(8)} │ ${issues.padEnd(10)} │`);
  }

  console.log('└─' + '─'.repeat(50) + '─┴─' + '─'.repeat(8) + '─┴─' + '─'.repeat(10) + '─┘');

  // Show detailed errors and warnings
  for (const result of results) {
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`\n📄 ${relative('.', result.path)}:`);

      for (const error of result.errors) {
        const path = error.instancePath || 'root';
        console.log(`  ❌ ${path}: ${error.message}`);
      }

      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }
  }

  // Summary
  const totalFiles = results.length;
  const validFiles = results.filter(r => r.valid).length;
  const filesWithWarnings = results.filter(r => r.warnings.length > 0).length;
  const filesWithErrors = results.filter(r => r.errors.length > 0).length;

  console.log(`\n📊 Summary: ${validFiles}/${totalFiles} valid, ${filesWithErrors} errors, ${filesWithWarnings} warnings\n`);
}

function formatJsonOutput(results: LintResult[]): void {
  const output = {
    summary: {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      errors: results.filter(r => r.errors.length > 0).length,
      warnings: results.filter(r => r.warnings.length > 0).length
    },
    results: results.map(r => ({
      path: r.path,
      valid: r.valid,
      errors: r.errors.length,
      warnings: r.warnings.length,
      details: {
        errors: r.errors,
        warnings: r.warnings
      }
    }))
  };

  console.log(JSON.stringify(output, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Scenario Linter - Validate Decision Guide AI scenario files

Usage:
  npm run scenario:lint [options] <paths...>

Options:
  -r, --recursive     Search directories recursively
  -f, --format        Output format: table (default) | json
  -s, --schema        Path to custom schema file
  --exit-on-error     Exit with code 1 if any errors found
  -h, --help          Show this help

Examples:
  npm run scenario:lint artifacts/scenarios/
  npm run scenario:lint -r artifacts/scenarios/ --format json
  npm run scenario:lint sample.yaml --schema custom-schema.json
    `);
    process.exit(0);
  }

  const options: LintOptions = {
    paths: [],
    recursive: false,
    format: 'table',
    schema: DEFAULT_SCHEMA,
    exitOnError: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-r':
      case '--recursive':
        options.recursive = true;
        break;
      case '-f':
      case '--format':
        options.format = args[++i] as 'table' | 'json';
        break;
      case '-s':
      case '--schema':
        options.schema = args[++i];
        break;
      case '--exit-on-error':
        options.exitOnError = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.paths.push(arg);
        }
        break;
    }
  }

  // Default to current directory if no paths provided
  if (options.paths.length === 0) {
    options.paths = ['.'];
  }

  try {
    // Load schema
    const schema = await loadSchema(options.schema!);

    // Find scenario files
    const files = await findScenarioFiles(options.paths, options.recursive);

    if (files.length === 0) {
      console.log('No scenario files found.');
      process.exit(0);
    }

    // Lint all files
    const results: LintResult[] = [];
    for (const file of files) {
      const result = await lintScenario(file, schema);
      results.push(result);
    }

    // Output results
    if (options.format === 'json') {
      formatJsonOutput(results);
    } else {
      formatTableOutput(results);
    }

    // Exit with error code if requested and errors found
    if (options.exitOnError && results.some(r => r.errors.length > 0)) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}