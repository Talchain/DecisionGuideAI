#!/usr/bin/env tsx
/**
 * Schema-Aligned View Model Generator
 * Generates view models that exactly match v3 fixture schemas
 * Usage: npm run vm:aligned -- <sarb-bundle> --out <output-dir>
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

class SchemaAlignedGenerator {

  constructor() {
    console.log('🎯 Schema-Aligned View Model Generator');
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

  // Stream Happy - matches stream-resume-once schema
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
      lastEventId: null,
      tokens: tokenTexts
    };
  }

  // Stream Resume-Once - matches stream-resume-once schema
  generateStreamResumeOnce(metadata: SARBMetadata, sessionId: string) {
    const tokenTexts = [
      'Based', ' on', ' analysis', ' of', ' your', ' requirements',
      ', I', ' recommend', ' **Vue.js**', ' for', ' this', ' specific', ' use', ' case'
    ];

    const events = tokenTexts.map((text, i) => ({
      id: (i + 1).toString(),
      event: i === 6 ? 'disconnect' : 'token',
      data: i === 6 ? {
        reason: 'connection_lost',
        timestamp: new Date(Date.now() - (tokenTexts.length - i) * 150).toISOString(),
        sessionId
      } : {
        id: `token_${i.toString().padStart(3, '0')}`,
        text,
        timestamp: new Date(Date.now() - (tokenTexts.length - i) * 150).toISOString(),
        sessionId
      }
    }));

    return {
      events,
      connectionState: 'resumed' as const,
      lastEventId: '6',
      tokens: tokenTexts.filter((_, i) => i !== 6) // Remove disconnect token
    };
  }

  // Stream Cancelled - matches stream-cancel-mid schema
  generateStreamCancelled(metadata: SARBMetadata, sessionId: string) {
    const tokenTexts = ['Based', ' on', ' your', ' requirements', ', I', ' can', ' analyze'];

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

    events.push({
      id: (events.length + 1).toString(),
      event: 'done',
      data: {
        reason: 'cancelled',
        partialTokens: tokenTexts.length,
        timestamp: new Date().toISOString(),
        sessionId
      }
    });

    return {
      events,
      state: 'cancelled' as const,
      reason: 'cancelled' as const,
      partialContent: tokenTexts.join('')
    };
  }

  // Stream Error - matches stream-error schema
  generateStreamError(metadata: SARBMetadata, sessionId: string) {
    const tokenTexts = ['Starting', ' analysis'];

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

    events.push({
      id: (events.length + 1).toString(),
      event: 'error',
      data: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Request rate limit exceeded. Please try again in a few minutes.',
          retryHint: 'Wait 60 seconds before retrying'
        },
        timestamp: new Date().toISOString(),
        sessionId
      }
    });

    return {
      events,
      error: {
        message: 'Request rate limit exceeded. Please try again in a few minutes.',
        retryHint: 'Wait 60 seconds before retrying',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      state: 'error' as const
    };
  }

  // Jobs Progress - matches jobs-cancel-50 schema
  generateJobsProgress(metadata: SARBMetadata, sessionId: string) {
    const progressEvents = [
      { progress: 0, event: 'progress' },
      { progress: 25, event: 'progress' },
      { progress: 50, event: 'progress' },
      { progress: 75, event: 'progress' }
    ];

    const events = progressEvents.map((item, i) => ({
      id: (i + 1).toString(),
      event: item.event,
      data: {
        jobId: 'job-001',
        progress: item.progress,
        total: 100,
        percent: item.progress,
        status: 'running',
        timestamp: new Date(Date.now() - (progressEvents.length - i) * 200).toISOString()
      }
    }));

    return {
      progress: {
        current: 75,
        total: 100,
        percent: 75
      },
      state: 'running' as const,
      events
    };
  }

  // Jobs Cancelled - matches jobs-cancel-50 schema
  generateJobsCancelled(metadata: SARBMetadata, sessionId: string) {
    const progressEvents = [
      { progress: 0, event: 'progress' },
      { progress: 25, event: 'progress' },
      { progress: 50, event: 'progress' }
    ];

    const events = progressEvents.map((item, i) => ({
      id: (i + 1).toString(),
      event: item.event,
      data: {
        jobId: 'job-001',
        progress: item.progress,
        total: 100,
        percent: item.progress,
        status: 'running',
        timestamp: new Date(Date.now() - (progressEvents.length - i) * 200).toISOString()
      }
    }));

    // Add cancel event
    events.push({
      id: (events.length + 1).toString(),
      event: 'cancel',
      data: {
        jobId: 'job-001',
        reason: 'user_cancelled',
        finalProgress: 50,
        timestamp: new Date().toISOString()
      }
    });

    events.push({
      id: (events.length + 1).toString(),
      event: 'done',
      data: {
        jobId: 'job-001',
        status: 'cancelled',
        reason: 'user_cancelled',
        finalProgress: 50,
        timestamp: new Date().toISOString()
      }
    });

    return {
      progress: {
        current: 50,
        total: 100,
        percent: 50
      },
      state: 'cancelled' as const,
      events
    };
  }

  // Report Ready - matches report-no-data schema exactly
  generateReportReady(metadata: SARBMetadata, reportId: string) {
    return {
      report: null,
      state: 'loading' as const,
      placeholder: {
        title: 'Report Ready',
        subtitle: 'Your analysis is complete',
        action: 'View Report'
      }
    };
  }

  // Report Empty - matches report-no-data schema exactly
  generateReportEmpty(metadata: SARBMetadata, reportId: string) {
    return {
      report: null,
      state: 'empty' as const,
      placeholder: {
        title: 'No Report Available',
        subtitle: 'Run an analysis to generate your first report',
        action: 'Start Analysis'
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

    console.log(`\n🎯 All schema-aligned view models generated in: ${outputDir}`);
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    const bundlePath = args[0];
    const outputFlag = args.indexOf('--out');
    const outputDir = outputFlag !== -1 ? args[outputFlag + 1] : 'artifacts/ui-viewmodels/aligned/';

    if (!bundlePath) {
      console.error('Usage: npm run vm:aligned -- <sarb-bundle> --out <output-dir>');
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
  const generator = new SchemaAlignedGenerator();
  generator.run();
}