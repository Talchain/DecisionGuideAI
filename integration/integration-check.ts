#!/usr/bin/env tsx
/**
 * Integration Harness for Scenario Sandbox PoC
 * Tests: health, OpenAPI contract, stream+cancel, job+cancel, Report v1 fetch, determinism
 * Outputs: console summary + HTML report to artifacts/integration-status.html
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

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message?: string;
  details?: any;
}

interface ServiceUrls {
  gateway: string;
  warp: string;
  jobs: string;
  usageMeter?: string;
}

class IntegrationHarness {
  private results: TestResult[] = [];
  private services: ServiceUrls;

  constructor() {
    // Default PoC URLs
    this.services = {
      gateway: process.env.VITE_EDGE_GATEWAY_URL || 'http://localhost:3001',
      warp: process.env.WARP_SERVICE_URL || 'http://localhost:4311',
      jobs: process.env.JOBS_SERVICE_URL || 'http://localhost:4500',
      usageMeter: process.env.USAGE_METER_URL || 'http://localhost:4600',
    };
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`🧪 ${name}...`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'pass', duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      this.results.push({ name, status: 'fail', duration, message });
      console.log(`❌ ${name} (${duration}ms): ${message}`);
    }
  }

  private async fetch(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      timeout: 10000, // 10 second timeout
      ...options,
    });
    return response;
  }

  // Test 1: Health checks for all services
  private async testHealth(): Promise<void> {
    const services = [
      { name: 'Gateway', url: `${this.services.gateway}/health` },
      { name: 'Warp', url: `${this.services.warp}/health` },
      { name: 'Jobs', url: `${this.services.jobs}/health` },
      { name: 'Usage Meter', url: `${this.services.usageMeter}/health` },
    ];

    for (const service of services) {
      try {
        const response = await this.fetch(service.url);
        if (!response.ok) {
          throw new Error(`${service.name} health check failed: ${response.status}`);
        }
      } catch (error) {
        if (service.name === 'Usage Meter') {
          // Usage Meter is optional
          console.log(`⚠️  ${service.name} is unavailable (optional service)`);
          continue;
        }
        throw error;
      }
    }
  }

  // Test 2: OpenAPI Contract validation
  private async testOpenAPIContract(): Promise<void> {
    const response = await this.fetch(`${this.services.gateway}/openapi.json`);
    if (!response.ok) {
      throw new Error(`OpenAPI spec not available: ${response.status}`);
    }

    const spec = await response.json();
    if (!spec.openapi || !spec.paths) {
      throw new Error('Invalid OpenAPI specification structure');
    }

    // Basic contract validation
    const requiredPaths = ['/health', '/api/v1/stream', '/api/v1/jobs', '/api/v1/reports'];
    const availablePaths = Object.keys(spec.paths);

    for (const path of requiredPaths) {
      if (!availablePaths.some(p => p.includes(path.split('/').pop()!))) {
        throw new Error(`Required API path missing: ${path}`);
      }
    }
  }

  // Test 3: Stream + Cancel functionality
  private async testStreamAndCancel(): Promise<void> {
    const streamUrl = `${this.services.gateway}/api/v1/stream`;
    const cancelUrl = `${this.services.gateway}/api/v1/stream/cancel`;

    // Start a stream
    const streamResponse = await this.fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Test stream for integration harness',
        seed: 12345,
        budget: 100,
      }),
    });

    if (!streamResponse.ok) {
      throw new Error(`Stream start failed: ${streamResponse.status}`);
    }

    const { sessionId } = await streamResponse.json();
    if (!sessionId) {
      throw new Error('No session ID returned from stream start');
    }

    // Wait a moment for stream to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cancel the stream
    const cancelResponse = await this.fetch(cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!cancelResponse.ok) {
      throw new Error(`Stream cancel failed: ${cancelResponse.status}`);
    }
  }

  // Test 4: Job + Cancel functionality
  private async testJobAndCancel(): Promise<void> {
    const jobUrl = `${this.services.gateway}/api/v1/jobs`;
    const cancelUrl = `${this.services.gateway}/api/v1/jobs/cancel`;

    // Start a job
    const jobResponse = await this.fetch(jobUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'analysis',
        payload: { scenario: 'test-scenario' },
      }),
    });

    if (!jobResponse.ok) {
      throw new Error(`Job start failed: ${jobResponse.status}`);
    }

    const { jobId } = await jobResponse.json();
    if (!jobId) {
      throw new Error('No job ID returned from job start');
    }

    // Wait a moment for job to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cancel the job
    const cancelResponse = await this.fetch(cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!cancelResponse.ok) {
      throw new Error(`Job cancel failed: ${cancelResponse.status}`);
    }
  }

  // Test 5: Report v1 fetch (sample)
  private async testReportV1Fetch(): Promise<void> {
    const reportUrl = `${this.services.gateway}/api/v1/reports/sample`;

    const response = await this.fetch(reportUrl);
    if (!response.ok) {
      throw new Error(`Report fetch failed: ${response.status}`);
    }

    const report = await response.json();

    // Basic validation of report structure
    if (!report.meta || !report.steps || !Array.isArray(report.steps)) {
      throw new Error('Invalid report structure');
    }

    // Save sample report to artifacts
    const samplePath = join(ARTIFACTS_DIR, 'samples');
    try {
      mkdirSync(samplePath, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    writeFileSync(
      join(samplePath, 'report-v1.json'),
      JSON.stringify(report, null, 2)
    );
  }

  // Test 6: Determinism check (same seed 3x)
  private async testDeterminism(): Promise<void> {
    const seed = 42;
    const prompt = 'Determinism test prompt';
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      const response = await this.fetch(`${this.services.gateway}/api/v1/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          seed,
          budget: 50,
          deterministic: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Determinism test ${i + 1} failed: ${response.status}`);
      }

      const result = await response.json();
      results.push(result.preview || result.content || JSON.stringify(result));

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if all results are identical
    const firstResult = results[0];
    if (!results.every(result => result === firstResult)) {
      throw new Error('Results are not deterministic with same seed');
    }
  }

  // Run all integration tests
  public async runAll(): Promise<void> {
    console.log('🚀 Starting Integration Harness for Scenario Sandbox PoC\n');

    const startTime = Date.now();

    await this.runTest('Health Checks', () => this.testHealth());
    await this.runTest('OpenAPI Contract', () => this.testOpenAPIContract());
    await this.runTest('Stream + Cancel', () => this.testStreamAndCancel());
    await this.runTest('Job + Cancel', () => this.testJobAndCancel());
    await this.runTest('Report v1 Fetch', () => this.testReportV1Fetch());
    await this.runTest('Determinism Check', () => this.testDeterminism());

    const totalDuration = Date.now() - startTime;

    this.generateSummary(totalDuration);
    this.generateHtmlReport(totalDuration);
  }

  private generateSummary(totalDuration: number): void {
    console.log('\n📊 Integration Test Summary');
    console.log('=' .repeat(50));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\nFailures:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  ❌ ${r.name}: ${r.message}`));
    }

    const allGreen = failed === 0;
    console.log(`\n${allGreen ? '🟢 ALL GREEN' : '🔴 FAILURES DETECTED'}`);

    if (allGreen) {
      console.log('✨ Integration check complete - all systems operational');
    } else {
      console.log('🔧 Please address failures before deploying');
      process.exit(1);
    }
  }

  private generateHtmlReport(totalDuration: number): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const allGreen = failed === 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Status - Scenario Sandbox PoC</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid ${allGreen ? '#10b981' : '#ef4444'}; padding-bottom: 10px; }
        .status { padding: 20px; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .status.pass { background: #dcfce7; color: #166534; border-left: 4px solid #10b981; }
        .status.fail { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1e40af; }
        .metric-label { color: #64748b; font-size: 0.9em; }
        .test-results { margin-top: 30px; }
        .test { padding: 15px; margin: 10px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
        .test.pass { background: #f0fdf4; border-left: 4px solid #10b981; }
        .test.fail { background: #fef2f2; border-left: 4px solid #ef4444; }
        .test-name { font-weight: 500; }
        .test-duration { color: #64748b; font-size: 0.9em; }
        .test-message { color: #ef4444; font-size: 0.9em; margin-top: 5px; }
        .timestamp { text-align: center; color: #64748b; font-size: 0.9em; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Integration Status</h1>

        <div class="status ${allGreen ? 'pass' : 'fail'}">
            ${allGreen ? '🟢 ALL GREEN - All systems operational' : '🔴 FAILURES DETECTED - Please address issues before deploying'}
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${this.results.length}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${totalDuration}ms</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="test-results">
            <h2>Test Results</h2>
            ${this.results.map(result => `
                <div class="test ${result.status}">
                    <div>
                        <div class="test-name">${result.status === 'pass' ? '✅' : '❌'} ${result.name}</div>
                        ${result.message ? `<div class="test-message">${result.message}</div>` : ''}
                    </div>
                    <div class="test-duration">${result.duration}ms</div>
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            Generated: ${new Date().toISOString()}
        </div>
    </div>
</body>
</html>`;

    const reportPath = join(ARTIFACTS_DIR, 'integration-status.html');
    writeFileSync(reportPath, html);
    console.log(`📄 HTML report written to: ${reportPath}`);
  }
}

// Run integration harness if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const harness = new IntegrationHarness();
  harness.runAll().catch(error => {
    console.error('Integration harness failed:', error);
    process.exit(1);
  });
}