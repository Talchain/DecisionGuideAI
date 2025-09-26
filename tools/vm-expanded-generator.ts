#!/usr/bin/env tsx
/**
 * Expanded UI View-Model Generator
 * Generates all required states for Windsurf UI development
 * Usage: npm run vm:expanded -- <sarb-bundle> --out <output-dir>
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

interface SARBMetadata {
  scenario: string;
  timestamp: string;
  tokens: number;
  duration: number;
  steps: number;
  cost: number;
  model?: string;
  seed?: number;
}

interface SARBBundle {
  metadata: SARBMetadata;
  transcript?: string;
  report?: any;
}

class ExpandedViewModelGenerator {

  constructor() {
    console.log('🎨 Expanded UI View-Model Generator');
    console.log('=' .repeat(40));
  }

  async extractSARBBundle(bundlePath: string): Promise<SARBBundle> {
    const tempDir = `/tmp/sarb-extract-${Date.now()}`;

    try {
      execSync(`mkdir -p "${tempDir}" && cd "${tempDir}" && unzip -q "${bundlePath}"`);

      const files = await readdir(tempDir);
      const sarbFile = files.find(f => f.endsWith('.sarb.json'));

      if (!sarbFile) {
        throw new Error('No .sarb.json file found in bundle');
      }

      const sarbData = JSON.parse(await readFile(join(tempDir, sarbFile), 'utf-8'));

      const metadata: SARBMetadata = {
        scenario: sarbData.scenario?.path || 'sample-scenario',
        timestamp: sarbData.timestamp || new Date().toISOString(),
        tokens: sarbData.execution?.metadata?.totalTokens || 1200,
        duration: sarbData.execution?.metadata?.duration || 15,
        steps: sarbData.execution?.steps?.length || 4,
        cost: sarbData.execution?.metadata?.totalCost || 0.025,
        model: sarbData.execution?.metadata?.model || 'gpt-4-turbo',
        seed: sarbData.execution?.metadata?.seed || 42
      };

      return { metadata, transcript: sarbData.transcript, report: sarbData.report };
    } catch (error) {
      throw new Error(`Failed to extract SARB bundle: ${error}`);
    }
  }

  generateStreamHappy(metadata: SARBMetadata, sessionId: string) {
    const tokenTexts = [
      'I', ' recommend', ' **React**', ' for', ' your', ' project', '.',
      '\n\n', '##', ' Analysis', '\n\n', 'React', ' offers', ':\n\n',
      '- ', 'Strong', ' ecosystem', '\n', '- ', 'TypeScript', ' support', '\n',
      '- ', 'Active', ' community', '\n\n', '**Decision:** ', 'React', ' with', ' TypeScript'
    ];

    const events = tokenTexts.map((text, i) => ({
      id: (i + 1).toString(),
      event: 'token',
      data: {
        id: `token_${i.toString().padStart(3, '0')}`,
        text,
        timestamp: new Date(Date.now() - (tokenTexts.length - i) * 150).toISOString(),
        sessionId
      }
    }));

    // Add completion event
    events.push({
      id: (events.length + 1).toString(),
      event: 'done',
      data: {
        reason: 'completed',
        totalTokens: tokenTexts.length,
        timestamp: new Date().toISOString(),
        sessionId
      }
    });

    return {
      events,
      connectionState: 'connected' as const,
      lastEventId: events[events.length - 1].id,
      tokens: tokenTexts
    };
  }

  generateStreamResumeOnce(metadata: SARBMetadata, sessionId: string) {
    const tokens = [
      'Based', ' on', ' analysis', ' of', ' your', ' requirements',
      ' [CONNECTION LOST]', ' [RESUMING]', ', I', ' recommend', ' **Vue.js**',
      ' for', ' this', ' specific', ' use', ' case', '.', '\n\n', 'Key', ' benefits', ':'
    ];

    return {
      sessionId,
      status: 'completed' as const,
      connectionState: 'resumed' as const,
      resumedAt: 6,
      tokens: tokens.map((text, i) => ({
        id: `token_${i.toString().padStart(3, '0')}`,
        text,
        timestamp: i < 6 ? Date.now() - 3000 + (i * 150) : Date.now() - 1500 + ((i-6) * 150)
      })),
      metadata: {
        totalTokens: metadata.tokens,
        totalCost: metadata.cost,
        duration: metadata.duration * 1000,
        model: metadata.model || 'gpt-4-turbo'
      }
    };
  }

  generateStreamCancelled(metadata: SARBMetadata, sessionId: string) {
    const tokens = [
      'Based', ' on', ' your', ' requirements', ', I', ' can', ' analyze', ' the', ' different'
    ];

    return {
      sessionId,
      status: 'cancelled' as const,
      reason: 'user_cancelled' as const,
      cancelledAt: Date.now() - 500,
      tokens: tokens.map((text, i) => ({
        id: `token_${i.toString().padStart(3, '0')}`,
        text,
        timestamp: Date.now() - (tokens.length - i) * 150
      })),
      partialContent: tokens.join('')
    };
  }

  generateStreamError(metadata: SARBMetadata, sessionId: string) {
    const tokens = [
      'Starting', ' analysis', ' of', ' your'
    ];

    return {
      sessionId,
      status: 'error' as const,
      tokens: tokens.map((text, i) => ({
        id: `token_${i.toString().padStart(3, '0')}`,
        text,
        timestamp: Date.now() - (tokens.length - i) * 150
      })),
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Request rate limit exceeded. Please try again in a few minutes.',
        retryHint: 'Wait 60 seconds before retrying',
        timestamp: Date.now() - 200
      }
    };
  }

  generateJobsProgress(metadata: SARBMetadata, sessionId: string) {
    const jobs = [
      { name: 'Scenario Analysis', progress: 100, status: 'completed' as const },
      { name: 'Option Evaluation', progress: 75, status: 'running' as const },
      { name: 'Decision Matrix', progress: 0, status: 'pending' as const }
    ];

    return {
      sessionId,
      jobs: jobs.map((job, i) => ({
        id: `job_${i + 1}`,
        name: job.name,
        status: job.status,
        progress: job.progress,
        startTime: Date.now() - (3000 - i * 1000),
        endTime: job.status === 'completed' ? Date.now() - (2000 - i * 1000) : undefined
      }))
    };
  }

  generateJobsCancelled(metadata: SARBMetadata, sessionId: string) {
    const jobs = [
      { name: 'Scenario Analysis', progress: 100, status: 'completed' as const },
      { name: 'Option Evaluation', progress: 50, status: 'cancelled' as const },
      { name: 'Decision Matrix', progress: 0, status: 'cancelled' as const }
    ];

    return {
      sessionId,
      jobs: jobs.map((job, i) => ({
        id: `job_${i + 1}`,
        name: job.name,
        status: job.status,
        progress: job.progress,
        startTime: Date.now() - (3000 - i * 1000),
        endTime: job.status !== 'pending' ? Date.now() - 500 : undefined,
        error: job.status === 'cancelled' ? 'User cancelled analysis' : undefined
      })),
      cancelledAt: Date.now() - 500
    };
  }

  generateReportReady(metadata: SARBMetadata, reportId: string) {
    const steps = [
      { type: 'analysis', tokens: 450, status: 'completed', cost: 0.008 },
      { type: 'evaluation', tokens: 380, status: 'completed', cost: 0.007 },
      { type: 'synthesis', tokens: 320, status: 'completed', cost: 0.006 },
      { type: 'recommendation', tokens: 250, status: 'completed', cost: 0.004 }
    ];

    return {
      reportId,
      meta: {
        seed: metadata.seed || 42,
        timestamp: metadata.timestamp,
        duration: metadata.duration * 1000,
        status: 'completed' as const,
        model: metadata.model || 'gpt-4-turbo'
      },
      totals: {
        totalTokens: metadata.tokens,
        totalCost: metadata.cost,
        totalSteps: steps.length,
        completedSteps: steps.length
      },
      steps: steps.map((step, i) => ({
        id: `step_${i + 1}`,
        type: step.type,
        status: step.status,
        tokens: step.tokens,
        cost: step.cost,
        duration: Math.floor(metadata.duration * 1000 / steps.length)
      }))
    };
  }

  generateReportEmpty(metadata: SARBMetadata, reportId: string) {
    return {
      reportId: null,
      state: 'empty' as const,
      placeholder: {
        title: 'No Report Available',
        subtitle: 'Run an analysis to generate your first report',
        action: 'Start Analysis'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  async generateAllStates(bundlePath: string, outputDir: string): Promise<void> {
    console.log(`📦 Extracting SARB bundle: ${bundlePath}`);

    const bundle = await this.extractSARBBundle(bundlePath);
    const scenarioName = basename(bundle.metadata.scenario || 'scenario', '.yaml');
    const sessionId = `${scenarioName}-session`;
    const reportId = `${scenarioName}-report`;

    console.log(`📊 Scenario: ${scenarioName}`);
    console.log(`🔢 Tokens: ${bundle.metadata.tokens}, Steps: ${bundle.metadata.steps}`);

    await mkdir(outputDir, { recursive: true });

    const states = [
      { name: 'stream.happy.json', data: this.generateStreamHappy(bundle.metadata, sessionId) },
      { name: 'stream.resume-once.json', data: this.generateStreamResumeOnce(bundle.metadata, sessionId) },
      { name: 'stream.cancelled.json', data: this.generateStreamCancelled(bundle.metadata, sessionId) },
      { name: 'stream.error.json', data: this.generateStreamError(bundle.metadata, sessionId) },
      { name: 'jobs.progress.json', data: this.generateJobsProgress(bundle.metadata, sessionId) },
      { name: 'jobs.cancelled.json', data: this.generateJobsCancelled(bundle.metadata, sessionId) },
      { name: 'report.ready.json', data: this.generateReportReady(bundle.metadata, reportId) },
      { name: 'report.empty.json', data: this.generateReportEmpty(bundle.metadata, reportId) }
    ];

    for (const state of states) {
      await writeFile(
        join(outputDir, state.name),
        JSON.stringify(state.data, null, 2)
      );
      console.log(`✅ Generated ${state.name}`);
    }

    console.log(`\n🎨 All view models generated in: ${outputDir}`);
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    const bundlePath = args[0];
    const outputFlag = args.indexOf('--out');
    const outputDir = outputFlag !== -1 ? args[outputFlag + 1] : 'artifacts/ui-viewmodels/expanded/';

    if (!bundlePath) {
      console.error('Usage: npm run vm:expanded -- <sarb-bundle> --out <output-dir>');
      process.exit(1);
    }

    try {
      await this.generateAllStates(bundlePath, outputDir);
    } catch (error) {
      console.error('❌ View model generation failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new ExpandedViewModelGenerator();
  generator.run();
}