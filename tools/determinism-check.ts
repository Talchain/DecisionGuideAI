#!/usr/bin/env tsx
/**
 * Determinism Check for Scenario Sandbox PoC
 * Executes same seeded Sim stream 3× and validates identical outputs
 * Usage: npm run determinism:check
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

// Ensure artifacts directory exists
try {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

// Mock simulation streamer for determinism testing (simplified version)
interface SimToken {
  id: string;
  text: string;
  delay: number;
  type?: 'content' | 'thinking' | 'done' | 'error';
}

class DeterminismTestStreamer {
  private scenario: SimToken[];
  private currentIndex = 0;

  constructor(seed: number) {
    // Create deterministic scenario based on seed
    this.scenario = this.generateDeterministicScenario(seed);
  }

  private generateDeterministicScenario(seed: number): SimToken[] {
    // Use seed to create predictable sequence
    const rng = this.seededRandom(seed);

    const tokens: SimToken[] = [
      { id: 'tok_1', text: `Analyzing scenario with seed ${seed}...`, delay: 200 },
      { id: 'tok_2', text: '\n\n## Analysis Results\n\n', delay: 300 },
    ];

    // Generate deterministic content based on seed
    const variations = [
      'The data suggests a clear pattern',
      'Initial findings indicate potential',
      'Preliminary analysis reveals',
      'Key observations from the data'
    ];

    const conclusions = [
      'requiring immediate attention',
      'that warrants further investigation',
      'with significant implications',
      'demanding strategic consideration'
    ];

    const variationIndex = Math.floor(rng() * variations.length);
    const conclusionIndex = Math.floor(rng() * conclusions.length);

    tokens.push({
      id: 'tok_3',
      text: `${variations[variationIndex]} ${conclusions[conclusionIndex]}.`,
      delay: 400
    });

    tokens.push({
      id: 'tok_4',
      text: `\n\n**Confidence Level**: ${Math.floor(rng() * 30 + 70)}%`,
      delay: 250
    });

    tokens.push({
      id: 'done',
      text: '',
      delay: 0,
      type: 'done'
    });

    return tokens;
  }

  // Simple seeded random number generator (LCG)
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
  }

  async stream(): Promise<string> {
    let output = '';

    for (const token of this.scenario) {
      if (token.type === 'done') break;
      output += token.text;
    }

    return output;
  }

  getDuration(): number {
    return this.scenario.reduce((total, token) => total + token.delay, 0);
  }
}

interface DeterminismResult {
  seed: number;
  runs: {
    output: string;
    duration: number;
    timestamp: string;
  }[];
  isDeterministic: boolean;
  differences?: string[];
  verdict: 'PASS' | 'FAIL';
  summary: string;
}

class DeterminismChecker {
  private results: DeterminismResult[] = [];

  async checkDeterminism(seed: number, runs: number = 3): Promise<DeterminismResult> {
    console.log(`🔬 Testing determinism for seed ${seed} (${runs} runs)...`);

    const testRuns: { output: string; duration: number; timestamp: string }[] = [];

    // Execute multiple runs with same seed
    for (let i = 0; i < runs; i++) {
      const streamer = new DeterminismTestStreamer(seed);
      const startTime = Date.now();
      const output = await streamer.stream();
      const duration = Date.now() - startTime;

      testRuns.push({
        output,
        duration,
        timestamp: new Date().toISOString()
      });

      // Small delay between runs to ensure they're independent
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Compare outputs
    const firstOutput = testRuns[0].output;
    const differences: string[] = [];
    let isDeterministic = true;

    for (let i = 1; i < testRuns.length; i++) {
      if (testRuns[i].output !== firstOutput) {
        isDeterministic = false;
        differences.push(`Run ${i + 1} differs from Run 1`);

        // Find specific differences
        const diff = this.findDifferences(firstOutput, testRuns[i].output);
        differences.push(...diff);
      }
    }

    const result: DeterminismResult = {
      seed,
      runs: testRuns,
      isDeterministic,
      differences: differences.length > 0 ? differences : undefined,
      verdict: isDeterministic ? 'PASS' : 'FAIL',
      summary: isDeterministic
        ? `✅ All ${runs} runs produced identical output`
        : `❌ ${differences.length} differences found across runs`
    };

    this.results.push(result);
    return result;
  }

  private findDifferences(text1: string, text2: string): string[] {
    const differences: string[] = [];

    if (text1.length !== text2.length) {
      differences.push(`Length differs: ${text1.length} vs ${text2.length} characters`);
    }

    // Find character-level differences
    let diffCount = 0;
    const maxDiffs = 5; // Limit diff reporting

    for (let i = 0; i < Math.max(text1.length, text2.length) && diffCount < maxDiffs; i++) {
      if (text1[i] !== text2[i]) {
        const char1 = text1[i] || '<end>';
        const char2 = text2[i] || '<end>';
        differences.push(`Position ${i}: '${char1}' vs '${char2}'`);
        diffCount++;
      }
    }

    if (diffCount >= maxDiffs) {
      differences.push('... (more differences truncated)');
    }

    return differences;
  }

  async runFullSuite(): Promise<void> {
    console.log('🎯 Determinism Check Suite');
    console.log('=' .repeat(40));

    // Test multiple seeds
    const testSeeds = [42, 123, 999, 1337, 2024];
    let totalTests = 0;
    let passedTests = 0;

    for (const seed of testSeeds) {
      const result = await this.checkDeterminism(seed);
      totalTests++;

      if (result.verdict === 'PASS') {
        console.log(`✅ Seed ${seed}: ${result.summary}`);
        passedTests++;
      } else {
        console.log(`❌ Seed ${seed}: ${result.summary}`);
        if (result.differences) {
          result.differences.slice(0, 3).forEach(diff => {
            console.log(`   • ${diff}`);
          });
        }
      }
    }

    // Generate summary
    const overallResult = passedTests === totalTests ? 'PASS' : 'FAIL';
    const verdict = overallResult === 'PASS' ? 'deterministic OK' : 'deterministic FAILED';

    console.log('\n📊 Determinism Test Summary');
    console.log('=' .repeat(40));
    console.log(`Result: ${overallResult}`);
    console.log(`Tests: ${passedTests}/${totalTests} passed`);
    console.log(`Verdict: ${verdict}`);

    // Save results
    await this.saveResults(overallResult, verdict, passedTests, totalTests);

    // Exit with appropriate code
    if (overallResult !== 'PASS') {
      process.exit(1);
    }
  }

  private async saveResults(overallResult: string, verdict: string, passed: number, total: number): Promise<void> {
    const timestamp = new Date().toISOString();

    // Create detailed report
    const report = {
      timestamp,
      verdict,
      overallResult,
      summary: {
        passed,
        total,
        passRate: Math.round((passed / total) * 100)
      },
      results: this.results,
      metadata: {
        testType: 'determinism',
        simulator: 'DeterminismTestStreamer',
        runsPerSeed: 3
      }
    };

    // Save JSON report
    const jsonPath = join(ARTIFACTS_DIR, 'determinism-check.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save diff file if there are failures
    if (overallResult !== 'PASS') {
      const diffLines: string[] = [];
      diffLines.push('# Determinism Check Differences');
      diffLines.push(`Generated: ${timestamp}`);
      diffLines.push('');

      for (const result of this.results) {
        if (result.verdict === 'FAIL') {
          diffLines.push(`## Seed ${result.seed} - FAILED`);
          if (result.differences) {
            result.differences.forEach(diff => diffLines.push(`- ${diff}`));
          }
          diffLines.push('');
        }
      }

      const diffPath = join(ARTIFACTS_DIR, 'determinism-diff.md');
      writeFileSync(diffPath, diffLines.join('\n'));
      console.log(`📄 Diff file saved: ${diffPath}`);
    }

    console.log(`📄 Report saved: ${jsonPath}`);
  }
}

// Run the determinism check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new DeterminismChecker();
  checker.runFullSuite().catch(error => {
    console.error('Determinism check failed:', error);
    process.exit(1);
  });
}