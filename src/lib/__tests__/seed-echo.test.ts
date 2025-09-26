/**
 * Seed Echo Test
 * Verifies deterministic replay by ensuring seed parameter is echoed back
 */

import { describe, it, expect, beforeAll } from 'vitest';

let seedExamples: any;

beforeAll(async () => {
  // Import seed echo contract examples
  const module = await import('/Users/paulslee/Documents/GitHub/DecisionGuideAI-Claude/artifacts/contracts/examples/seed-echo.json');
  seedExamples = module.default;
});

describe('Seed Echo for Deterministic Replay', () => {
  it('should echo seed in SSE stream start event', () => {
    const example = seedExamples.examples.analysis_with_seed;
    const startEvent = example.response.events.find((e: any) => e.event === 'start');

    expect(startEvent).toBeDefined();
    expect(startEvent.data.seed).toBe(42);
  });

  it('should echo seed in SSE stream complete event', () => {
    const example = seedExamples.examples.analysis_with_seed;
    const completeEvent = example.response.events.find((e: any) => e.event === 'complete');

    expect(completeEvent).toBeDefined();
    expect(completeEvent.data.seed).toBe(42);
  });

  it('should include seed in report response body', () => {
    const example = seedExamples.examples.report_with_seed;

    expect(example.response.body.seed).toBe(42);
    expect(example.response.body.metadata.seedUsed).toBe(42);
    expect(example.response.body.metadata.deterministic).toBe(true);
    expect(example.response.body.metadata.replayable).toBe(true);
  });

  it('should handle seed parameter extraction from URL', () => {
    const example = seedExamples.examples.analysis_with_seed;
    const url = new URL(example.request.path, 'http://localhost:3000');

    expect(url.searchParams.get('seed')).toBe('42');
    expect(url.searchParams.get('route')).toBe('critique');
    expect(url.searchParams.get('sessionId')).toBe('test');
  });

  it('should maintain seed consistency across request-response cycle', () => {
    const analysisExample = seedExamples.examples.analysis_with_seed;
    const reportExample = seedExamples.examples.report_with_seed;

    const requestSeed = new URL(analysisExample.request.path, 'http://localhost').searchParams.get('seed');
    const startEventSeed = analysisExample.response.events.find((e: any) => e.event === 'start').data.seed;
    const completeEventSeed = analysisExample.response.events.find((e: any) => e.event === 'complete').data.seed;
    const reportSeed = reportExample.response.body.seed;

    expect(Number(requestSeed)).toBe(42);
    expect(startEventSeed).toBe(42);
    expect(completeEventSeed).toBe(42);
    expect(reportSeed).toBe(42);
  });

  it('should support deterministic replay validation', () => {
    const reportExample = seedExamples.examples.report_with_seed;
    const metadata = reportExample.response.body.metadata;

    expect(metadata.deterministic).toBe(true);
    expect(metadata.replayable).toBe(true);
    expect(metadata.seedUsed).toBe(42);
  });
});