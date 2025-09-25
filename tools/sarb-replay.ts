#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import type { SARBBundle } from './sarb-pack.js';

class SARBReplay {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  loadBundle(zipPath: string): SARBBundle {
    if (!existsSync(zipPath)) {
      throw new Error(`Bundle not found: ${zipPath}`);
    }

    // Extract zip to temporary location
    const tempDir = resolve('tmp', `sarb-${Date.now()}`);
    const jsonFile = basename(zipPath).replace('.sarb.zip', '.sarb.json');

    try {
      execSync(`mkdir -p "${tempDir}"`, { stdio: 'pipe' });
      execSync(`cd "${tempDir}" && unzip -q "${zipPath}"`, { stdio: 'pipe' });

      const jsonPath = resolve(tempDir, jsonFile);
      if (!existsSync(jsonPath)) {
        throw new Error('Bundle does not contain expected JSON file');
      }

      const content = readFileSync(jsonPath, 'utf8');
      const bundle = JSON.parse(content) as SARBBundle;

      // Cleanup
      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });

      return bundle;

    } catch (error) {
      // Cleanup on error
      try {
        execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
      } catch {}
      throw new Error(`Failed to load bundle: ${error}`);
    }
  }

  validateBundle(bundle: SARBBundle): void {
    if (!bundle.version || !bundle.scenario || !bundle.results || !bundle.transcript) {
      throw new Error('Invalid bundle format - missing required fields');
    }

    if (bundle.version !== '1.0') {
      throw new Error(`Unsupported bundle version: ${bundle.version}`);
    }
  }

  replayBundle(bundle: SARBBundle, mode: 'simulation' | 'live' = 'simulation'): void {
    this.log(`🎬 Replaying scenario bundle...`);
    this.log(`   Title: ${bundle.scenario.title}`);
    this.log(`   Created: ${new Date(bundle.created).toLocaleDateString()}`);
    this.log(`   Mode: ${mode} (original: ${bundle.execution.mode})`);
    this.log(`   Seed: ${bundle.execution.seed}`);
    this.log('');

    // Show execution parameters
    this.log(`📋 Execution Parameters:`);
    this.log(`   Max Tokens: ${bundle.execution.params.maxTokens}`);
    this.log(`   Temperature: ${bundle.execution.params.temperature}`);
    this.log(`   Model: ${bundle.execution.params.model}`);
    this.log('');

    // Replay the analysis steps
    this.log(`🔄 Analysis Steps:`);
    bundle.results.steps.forEach(step => {
      this.log(`   [${step.step}] ${step.stage}: ${step.tokens} tokens (${Math.round(step.deltaTime/1000)}s)`);
    });
    this.log('');

    // Show results summary
    this.log(`📊 Results Summary:`);
    this.log(`   Status: ${bundle.results.status.toUpperCase()}`);
    this.log(`   Duration: ${Math.round(bundle.results.duration / 1000)}s`);
    this.log(`   Tokens Generated: ${bundle.results.tokensGenerated}`);
    if (bundle.results.cost) {
      this.log(`   Estimated Cost: $${bundle.results.cost.toFixed(4)}`);
    }
    this.log('');

    // In simulation mode, use the same seed to ensure deterministic output
    if (mode === 'simulation') {
      this.log(`🎯 Deterministic Replay (Seed: ${bundle.execution.seed}):`);
      this.log('─'.repeat(50));

      // For simulation, we replay the exact transcript
      if (bundle.transcript.markdown) {
        console.log(bundle.transcript.markdown);
      } else {
        // Fallback to token-by-token replay
        bundle.transcript.tokens.forEach(token => {
          process.stdout.write(token.text);
        });
        console.log('');
      }

    } else {
      // Live mode would actually execute against real services
      this.log(`⚠️ Live mode not implemented - falling back to simulation replay`);
      this.log('─'.repeat(50));
      console.log(bundle.transcript.markdown);
    }

    this.log('');
    this.log('─'.repeat(50));
    this.log(`✅ Replay completed`);
    this.log(`   Original execution: ${new Date(bundle.created).toLocaleString()}`);
    this.log(`   Replay mode: ${mode}`);
    this.log(`   Deterministic: ${mode === 'simulation' ? 'Yes' : 'No'}`);
  }

  run(args: string[]): void {
    if (args.length < 1) {
      console.error('Usage: npm run sarb:replay -- <bundle.sarb.zip> [--live]');
      console.error('Example: npm run sarb:replay -- artifacts/runs/sample.sarb.zip');
      console.error('Note: Simulation mode (default) ensures deterministic replay');
      process.exit(1);
    }

    const bundlePath = resolve(args[0]);
    let mode: 'simulation' | 'live' = 'simulation';

    // Parse arguments
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--live') {
        mode = 'live';
        this.log('⚠️ Live mode specified - will use real services if available');
      }
    }

    try {
      const bundle = this.loadBundle(bundlePath);
      this.validateBundle(bundle);
      this.replayBundle(bundle, mode);

    } catch (error) {
      console.error(`❌ Failed to replay bundle: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const replay = new SARBReplay();
  replay.run(process.argv.slice(2));
}

export { SARBReplay };