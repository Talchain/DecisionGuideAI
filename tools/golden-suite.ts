#!/usr/bin/env tsx

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, resolve, relative, extname } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface GoldenTest {
  name: string;
  scenario: string;
  params: Record<string, any>;
  expectedHash?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface GoldenSuite {
  version: string;
  name: string;
  description: string;
  created: string;
  tests: GoldenTest[];
  config: {
    timeout: number;
    retries: number;
    mode: 'simulation' | 'live';
  };
}

interface GoldenResult {
  test: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  duration: number;
  hash?: string;
  expectedHash?: string;
  error?: string;
  metadata?: {
    tokens: number;
    cost: number;
    steps: number;
  };
}

interface SuiteRunResult {
  suite: string;
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
  results: GoldenResult[];
}

const DEFAULT_SUITE_PATH = 'artifacts/golden/suite.json';
const DEFAULT_OUTPUT_DIR = 'artifacts/golden/runs';

function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function loadSuite(suitePath: string): Promise<GoldenSuite> {
  try {
    const content = await readFile(suitePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load golden suite from ${suitePath}: ${(error as Error).message}`);
  }
}

async function saveSuite(suite: GoldenSuite, suitePath: string): Promise<void> {
  await mkdir(resolve(suitePath, '..'), { recursive: true });
  await writeFile(suitePath, JSON.stringify(suite, null, 2));
}

async function runSarbCommand(scenario: string, params: Record<string, any>): Promise<{ output: string, hash: string, metadata: any }> {
  // SARB pack creates files in artifacts/runs/ with predictable naming
  const scenarioName = scenario.split('/').pop()?.replace('.yaml', '') || 'unknown';
  const expectedOutput = `artifacts/runs/${scenarioName}.sarb.zip`;

  // Build command in simulation mode
  let cmd = `INTEGRATION_SIM_MODE=1 npm run sarb:pack -- "${scenario}"`;

  // Note: SARB pack doesn't accept arbitrary parameters, so we'll skip them for now
  // In a real implementation, we'd need to modify the scenario file or pass them differently

  try {
    // Execute SARB command
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });

    // Read and hash the output bundle from the actual location
    const bundleContent = await readFile(expectedOutput, 'binary');
    const hash = calculateHash(bundleContent);

    // Extract metadata from command output
    const lines = output.split('\n');
    const tokenMatch = lines.find(l => l.includes('Tokens:'))?.match(/Tokens: (\d+)/);
    const durationMatch = lines.find(l => l.includes('Duration:'))?.match(/Duration: (\d+)s/);
    const stepsMatch = lines.find(l => l.includes('Steps:'))?.match(/Steps: (\d+)/);

    const metadata = {
      tokens: tokenMatch ? parseInt(tokenMatch[1]) : 0,
      cost: 0.002 * (tokenMatch ? parseInt(tokenMatch[1]) : 1000), // rough estimate
      steps: stepsMatch ? parseInt(stepsMatch[1]) : 0
    };

    return { output, hash, metadata };

  } catch (error) {
    throw new Error(`SARB execution failed: ${(error as Error).message}`);
  }
}

async function runGoldenTest(test: GoldenTest, config: GoldenSuite['config']): Promise<GoldenResult> {
  const startTime = Date.now();

  try {
    console.log(`  Running: ${test.name}`);

    const result = await runSarbCommand(test.scenario, test.params);
    const duration = Date.now() - startTime;

    // Check if hash matches expected (if we have one)
    if (test.expectedHash && result.hash !== test.expectedHash) {
      return {
        test: test.name,
        status: 'fail',
        duration,
        hash: result.hash,
        expectedHash: test.expectedHash,
        error: `Hash mismatch: expected ${test.expectedHash}, got ${result.hash}`,
        metadata: result.metadata
      };
    }

    return {
      test: test.name,
      status: 'pass',
      duration,
      hash: result.hash,
      expectedHash: test.expectedHash,
      metadata: result.metadata
    };

  } catch (error) {
    return {
      test: test.name,
      status: 'error',
      duration: Date.now() - startTime,
      error: (error as Error).message
    };
  }
}

async function runSuite(suitePath: string, options: {
  outputDir?: string;
  updateHashes?: boolean;
  filter?: string;
  quiet?: boolean;
}): Promise<SuiteRunResult> {
  const suite = await loadSuite(suitePath);
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  if (!options.quiet) {
    console.log(`🧪 Running Golden Suite: ${suite.name}`);
    console.log(`📋 ${suite.tests.length} tests total`);
  }

  const results: GoldenResult[] = [];
  const filteredTests = options.filter
    ? suite.tests.filter(t => t.name.includes(options.filter!) || t.tags?.some(tag => tag.includes(options.filter!)))
    : suite.tests;

  if (filteredTests.length !== suite.tests.length && !options.quiet) {
    console.log(`🔍 Filtered to ${filteredTests.length} tests`);
  }

  for (const test of filteredTests) {
    const result = await runGoldenTest(test, suite.config);
    results.push(result);

    if (!options.quiet) {
      const status = result.status === 'pass' ? '✅' :
                    result.status === 'fail' ? '❌' :
                    result.status === 'skip' ? '⏭️' : '💥';
      console.log(`  ${status} ${result.test} (${result.duration}ms)`);
    }

    // Update hash if requested and test passed
    if (options.updateHashes && result.status === 'pass' && result.hash) {
      test.expectedHash = result.hash;
    }
  }

  // Save updated suite if hashes were updated
  if (options.updateHashes) {
    await saveSuite(suite, suitePath);
    if (!options.quiet) {
      console.log('📝 Updated expected hashes');
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skip').length,
    errors: results.filter(r => r.status === 'error').length
  };

  const suiteResult: SuiteRunResult = {
    suite: suite.name,
    timestamp,
    duration: Date.now() - startTime,
    summary,
    results
  };

  // Save results
  if (options.outputDir) {
    await mkdir(options.outputDir, { recursive: true });
    const resultPath = join(options.outputDir, `run-${timestamp.replace(/[:.]/g, '-')}.json`);
    await writeFile(resultPath, JSON.stringify(suiteResult, null, 2));

    if (!options.quiet) {
      console.log(`📁 Results saved to ${resultPath}`);
    }
  }

  return suiteResult;
}

async function createDefaultSuite(): Promise<void> {
  const suite: GoldenSuite = {
    version: '1.0',
    name: 'Decision Guide AI Golden Suite',
    description: 'Reference test suite for regression testing',
    created: new Date().toISOString(),
    config: {
      timeout: 60000,
      retries: 0,
      mode: 'simulation'
    },
    tests: [
      {
        name: 'framework-selection-baseline',
        scenario: 'artifacts/scenarios/sample-framework.yaml',
        params: {
          seed: 42,
          temperature: 0.7,
          maxTokens: 1200
        },
        description: 'Baseline framework selection scenario',
        tags: ['baseline', 'framework', 'quick']
      },
      {
        name: 'database-selection-baseline',
        scenario: 'artifacts/scenarios/sample-database.yaml',
        params: {
          seed: 42,
          temperature: 0.7,
          maxTokens: 1200
        },
        description: 'Baseline database selection scenario',
        tags: ['baseline', 'database', 'quick']
      },
      {
        name: 'framework-high-temp',
        scenario: 'artifacts/scenarios/sample-framework.yaml',
        params: {
          seed: 42,
          temperature: 0.9,
          maxTokens: 1200
        },
        description: 'Framework selection with high temperature',
        tags: ['framework', 'temperature', 'variant']
      },
      {
        name: 'big-scenario-comprehensive',
        scenario: 'artifacts/scenarios/big-scenario.yaml',
        params: {
          seed: 123,
          temperature: 0.8,
          maxTokens: 2000
        },
        description: 'Comprehensive enterprise architecture decision',
        tags: ['enterprise', 'comprehensive', 'slow']
      }
    ]
  };

  await saveSuite(suite, DEFAULT_SUITE_PATH);
  console.log(`✅ Created default golden suite at ${DEFAULT_SUITE_PATH}`);
}

function displayResults(result: SuiteRunResult, detailed: boolean = false): void {
  console.log(`\n🏆 Golden Suite Results: ${result.suite}`);
  console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`📊 Summary: ${result.summary.passed}/${result.summary.total} passed`);

  if (result.summary.failed > 0) {
    console.log(`❌ Failed: ${result.summary.failed}`);
  }
  if (result.summary.errors > 0) {
    console.log(`💥 Errors: ${result.summary.errors}`);
  }

  if (detailed && (result.summary.failed > 0 || result.summary.errors > 0)) {
    console.log(`\nFailure Details:`);
    for (const test of result.results) {
      if (test.status === 'fail' || test.status === 'error') {
        console.log(`  ❌ ${test.test}: ${test.error}`);
      }
    }
  }

  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 Golden Suite Runner - Reference testing for Decision Guide AI

Usage:
  npm run golden:test [options]           # Run golden suite
  npm run golden:init                     # Create default suite
  npm run golden:update [options]         # Update expected hashes

Commands:
  init                        Create default golden suite
  test                        Run the golden suite
  update                      Run tests and update expected hashes

Options:
  -s, --suite <path>         Path to suite file (default: artifacts/golden/suite.json)
  -o, --output <dir>         Output directory for results
  -f, --filter <pattern>     Filter tests by name or tag
  --detailed                 Show detailed failure information
  --quiet                    Minimal output
  -h, --help                 Show this help

Examples:
  npm run golden:test
  npm run golden:test --filter baseline
  npm run golden:update --filter quick
  npm run golden:test --detailed --output results/
    `);
    process.exit(0);
  }

  const command = args[0] || 'test';
  const options = {
    suite: DEFAULT_SUITE_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    updateHashes: command === 'update',
    filter: '',
    detailed: false,
    quiet: false
  };

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-s':
      case '--suite':
        options.suite = args[++i];
        break;
      case '-o':
      case '--output':
        options.outputDir = args[++i];
        break;
      case '-f':
      case '--filter':
        options.filter = args[++i];
        break;
      case '--detailed':
        options.detailed = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
    }
  }

  try {
    switch (command) {
      case 'init':
        await createDefaultSuite();
        break;

      case 'test':
      case 'update':
        const result = await runSuite(options.suite, options);
        if (!options.quiet) {
          displayResults(result, options.detailed);
        }

        // Exit with non-zero code if tests failed
        if (result.summary.failed > 0 || result.summary.errors > 0) {
          process.exit(1);
        }
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('Run with --help for usage information');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Golden suite failed:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}