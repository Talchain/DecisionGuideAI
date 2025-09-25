#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'pass' | 'warn' | 'fail';
  threshold?: number;
}

interface BaselineResult {
  timestamp: string;
  mode: 'simulation';
  metrics: PerformanceMetric[];
  summary: {
    totalTests: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

class PerformanceBaseline {
  private results: PerformanceMetric[] = [];

  async measureStreamStartLatency(): Promise<PerformanceMetric> {
    console.log('📊 Measuring stream start latency...');

    const start = performance.now();

    // Simulate SSE connection establishment
    await this.simulateSSEConnection();

    const end = performance.now();
    const latency = end - start;

    const metric: PerformanceMetric = {
      name: 'Stream Start Latency',
      value: Math.round(latency),
      unit: 'ms',
      status: latency <= 500 ? 'pass' : latency <= 1000 ? 'warn' : 'fail',
      threshold: 500
    };

    console.log(`  ✅ ${metric.value}${metric.unit} (${metric.status})`);
    return metric;
  }

  async measureTokenCadence(): Promise<PerformanceMetric> {
    console.log('📊 Measuring token generation cadence...');

    const tokenCount = 50;
    const start = performance.now();

    // Simulate token streaming
    for (let i = 0; i < tokenCount; i++) {
      await this.simulateTokenGeneration();
    }

    const end = performance.now();
    const totalTime = end - start;
    const tokensPerSecond = (tokenCount / totalTime) * 1000;

    const metric: PerformanceMetric = {
      name: 'Token Generation Cadence',
      value: Math.round(tokensPerSecond * 10) / 10,
      unit: 'tokens/sec',
      status: tokensPerSecond >= 10 ? 'pass' : tokensPerSecond >= 5 ? 'warn' : 'fail',
      threshold: 10
    };

    console.log(`  ✅ ${metric.value} ${metric.unit} (${metric.status})`);
    return metric;
  }

  async measureCancelTiming(): Promise<PerformanceMetric> {
    console.log('📊 Measuring cancel operation timing...');

    const start = performance.now();

    // Simulate cancel request processing
    await this.simulateCancelOperation();

    const end = performance.now();
    const cancelTime = end - start;

    const metric: PerformanceMetric = {
      name: 'Cancel Operation Time',
      value: Math.round(cancelTime),
      unit: 'ms',
      status: cancelTime <= 1000 ? 'pass' : cancelTime <= 2000 ? 'warn' : 'fail',
      threshold: 1000
    };

    console.log(`  ✅ ${metric.value}${metric.unit} (${metric.status}) - Target: ≤1s`);
    return metric;
  }

  async measureMemoryUsage(): Promise<PerformanceMetric> {
    console.log('📊 Measuring memory baseline...');

    const memBefore = process.memoryUsage();

    // Simulate some processing load
    await this.simulateProcessingLoad();

    const memAfter = process.memoryUsage();
    const memDelta = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024; // MB

    const metric: PerformanceMetric = {
      name: 'Memory Delta',
      value: Math.round(memDelta * 10) / 10,
      unit: 'MB',
      status: memDelta <= 50 ? 'pass' : memDelta <= 100 ? 'warn' : 'fail',
      threshold: 50
    };

    console.log(`  ✅ ${metric.value} ${metric.unit} (${metric.status})`);
    return metric;
  }

  async measureConcurrentConnections(): Promise<PerformanceMetric> {
    console.log('📊 Measuring concurrent connection handling...');

    const connectionCount = 10;
    const start = performance.now();

    // Simulate multiple concurrent SSE connections
    const promises = Array.from({ length: connectionCount }, () =>
      this.simulateSSEConnection()
    );

    await Promise.all(promises);

    const end = performance.now();
    const totalTime = end - start;
    const connectionsPerSecond = (connectionCount / totalTime) * 1000;

    const metric: PerformanceMetric = {
      name: 'Concurrent Connections',
      value: Math.round(connectionsPerSecond * 10) / 10,
      unit: 'conn/sec',
      status: connectionsPerSecond >= 5 ? 'pass' : connectionsPerSecond >= 2 ? 'warn' : 'fail',
      threshold: 5
    };

    console.log(`  ✅ ${metric.value} ${metric.unit} (${metric.status})`);
    return metric;
  }

  // Simulation methods
  private async simulateSSEConnection(): Promise<void> {
    // Simulate connection overhead
    await this.sleep(20 + Math.random() * 30);
  }

  private async simulateTokenGeneration(): Promise<void> {
    // Simulate token processing time
    await this.sleep(5 + Math.random() * 10);
  }

  private async simulateCancelOperation(): Promise<void> {
    // Simulate cancel processing
    await this.sleep(100 + Math.random() * 200);
  }

  private async simulateProcessingLoad(): Promise<void> {
    // Simulate some processing work
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: `item-${i}`,
      timestamp: Date.now()
    }));

    // Process the data
    data.forEach(item => {
      item.data = item.data.toUpperCase();
    });

    await this.sleep(50);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAll(): Promise<BaselineResult> {
    console.log('🏁 Starting Performance Baseline Tests');
    console.log('=====================================');
    console.log('Mode: Simulation (no real services required)');
    console.log('');

    const metrics = [
      await this.measureStreamStartLatency(),
      await this.measureTokenCadence(),
      await this.measureCancelTiming(),
      await this.measureMemoryUsage(),
      await this.measureConcurrentConnections()
    ];

    console.log('');
    console.log('📋 Performance Baseline Summary');
    console.log('===============================');

    const summary = {
      totalTests: metrics.length,
      passed: metrics.filter(m => m.status === 'pass').length,
      warnings: metrics.filter(m => m.status === 'warn').length,
      failed: metrics.filter(m => m.status === 'fail').length
    };

    metrics.forEach(metric => {
      const icon = metric.status === 'pass' ? '✅' : metric.status === 'warn' ? '⚠️' : '❌';
      const threshold = metric.threshold ? ` (threshold: ${metric.threshold}${metric.unit})` : '';
      console.log(`${icon} ${metric.name}: ${metric.value}${metric.unit}${threshold}`);
    });

    console.log('');
    console.log(`Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`);

    const result: BaselineResult = {
      timestamp: new Date().toISOString(),
      mode: 'simulation',
      metrics,
      summary
    };

    return result;
  }

  saveResults(result: BaselineResult, format: 'json' | 'csv' | 'markdown' = 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csv = [
        'Metric,Value,Unit,Status,Threshold',
        ...result.metrics.map(m => `"${m.name}",${m.value},"${m.unit}","${m.status}",${m.threshold || ''}`)
      ].join('\n');

      const csvPath = resolve(`artifacts/perf-baseline-${timestamp}.csv`);
      writeFileSync(csvPath, csv);
      return csvPath;
    }

    if (format === 'markdown') {
      const md = [
        '# Performance Baseline Report',
        '',
        `**Timestamp:** ${result.timestamp}`,
        `**Mode:** ${result.mode}`,
        '',
        '## Metrics',
        '',
        '| Metric | Value | Status | Threshold |',
        '|--------|-------|--------|-----------|',
        ...result.metrics.map(m => `| ${m.name} | ${m.value}${m.unit} | ${m.status} | ${m.threshold || 'N/A'}${m.unit} |`),
        '',
        '## Summary',
        '',
        `- Total Tests: ${result.summary.totalTests}`,
        `- ✅ Passed: ${result.summary.passed}`,
        `- ⚠️ Warnings: ${result.summary.warnings}`,
        `- ❌ Failed: ${result.summary.failed}`,
        '',
        '## Key Findings',
        '',
        result.metrics.filter(m => m.status === 'fail').length > 0
          ? '### ❌ Failed Metrics:\n' + result.metrics.filter(m => m.status === 'fail').map(m => `- ${m.name}: ${m.value}${m.unit} (threshold: ${m.threshold}${m.unit})`).join('\n')
          : '✅ All metrics within acceptable ranges.',
        '',
        result.metrics.filter(m => m.status === 'warn').length > 0
          ? '### ⚠️ Warning Metrics:\n' + result.metrics.filter(m => m.status === 'warn').map(m => `- ${m.name}: ${m.value}${m.unit} (threshold: ${m.threshold}${m.unit})`).join('\n')
          : '',
        '',
        '---',
        '*Generated by perf-baseline tool*'
      ].filter(line => line !== undefined).join('\n');

      const mdPath = resolve(`artifacts/perf-baseline-${timestamp}.md`);
      writeFileSync(mdPath, md);
      return mdPath;
    }

    // Default JSON format
    const jsonPath = resolve(`artifacts/perf-baseline-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    return jsonPath;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseline = new PerformanceBaseline();

  baseline.runAll().then(result => {
    // Save in multiple formats
    const jsonPath = baseline.saveResults(result, 'json');
    const mdPath = baseline.saveResults(result, 'markdown');

    console.log('');
    console.log('💾 Results saved:');
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);

    // Exit with appropriate code
    process.exit(result.summary.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Baseline test failed:', error);
    process.exit(1);
  });
}

export { PerformanceBaseline };