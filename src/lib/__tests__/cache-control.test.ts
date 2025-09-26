/**
 * Cache-Control Headers Test for Warp Routes
 * Verifies that non-cacheable Warp routes include proper Cache-Control: no-store headers
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ContractExample {
  info: {
    title: string;
    description: string;
  };
  examples: Record<string, {
    name: string;
    response?: {
      status: number;
      headers?: Record<string, string>;
      body?: any;
    };
  }>;
}

describe('Warp Cache-Control Headers', () => {
  const contractPath = resolve(__dirname, '../../../artifacts/contracts/examples/warp-cache-control.json');

  let warpContract: ContractExample;

  beforeAll(() => {
    try {
      const contractContent = readFileSync(contractPath, 'utf-8');
      warpContract = JSON.parse(contractContent);
    } catch (error) {
      throw new Error(`Failed to load Warp contract: ${error}`);
    }
  });

  it('should include Cache-Control: no-store in analysis response', () => {
    const analysisExample = warpContract.examples.warp_analysis_request;

    expect(analysisExample).toBeDefined();
    expect(analysisExample.response).toBeDefined();
    expect(analysisExample.response!.headers).toBeDefined();
    expect(analysisExample.response!.headers!['Cache-Control']).toBe('no-store');
  });

  it('should include Cache-Control: no-store in stream response', () => {
    const streamExample = warpContract.examples.warp_stream_response;

    expect(streamExample).toBeDefined();
    expect(streamExample.response).toBeDefined();
    expect(streamExample.response!.headers).toBeDefined();
    expect(streamExample.response!.headers!['Cache-Control']).toBe('no-store');
  });

  it('should include Cache-Control: no-store in report response', () => {
    const reportExample = warpContract.examples.warp_report_response;

    expect(reportExample).toBeDefined();
    expect(reportExample.response).toBeDefined();
    expect(reportExample.response!.headers).toBeDefined();
    expect(reportExample.response!.headers!['Cache-Control']).toBe('no-store');
  });

  it('should verify all Warp responses have proper caching headers', () => {
    const examples = Object.values(warpContract.examples);
    let responsesWithCacheHeaders = 0;

    for (const example of examples) {
      if (example.response?.headers?.['Cache-Control'] === 'no-store') {
        responsesWithCacheHeaders++;
      }
    }

    // All 3 examples should have Cache-Control: no-store
    expect(responsesWithCacheHeaders).toBe(3);
    expect(responsesWithCacheHeaders).toBeGreaterThan(0);
  });

  it('should prevent caching of sensitive analysis data', () => {
    // Verify that analysis responses cannot be cached
    const analysisExample = warpContract.examples.warp_analysis_request;
    const cacheControl = analysisExample.response!.headers!['Cache-Control'];

    expect(cacheControl).toBe('no-store');
    expect(cacheControl).not.toContain('cache');
    expect(cacheControl).not.toContain('public');
  });
});