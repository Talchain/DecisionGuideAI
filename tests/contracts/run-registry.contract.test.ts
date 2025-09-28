/**
 * Contract Tests - Run Registry API
 * Tests deterministic lookup and caching behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleLookupRequest,
  handleEventsRequest,
  lookupRun,
  registerRunExecution,
  getRunEvents,
  clearRegistry
} from '../../src/lib/run-registry.js';

describe('Run Registry Contract Tests', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('GET /runs/lookup', () => {
    it('should require scenarioId parameter', async () => {
      const result = await handleLookupRequest({ seed: 42 });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('scenarioId and seed parameters required');
    });

    it('should require seed parameter', async () => {
      const result = await handleLookupRequest({ scenarioId: 'test' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('scenarioId and seed parameters required');
    });

    it('should validate seed as integer', async () => {
      const result = await handleLookupRequest({ scenarioId: 'test', seed: 'invalid' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('seed must be a valid integer');
    });

    it('should return new run for first lookup', async () => {
      const result = await handleLookupRequest({ scenarioId: 'test-scenario', seed: 42 });

      expect(result.status).toBe(200);
      expect(result.body.runId).toBeDefined();
      expect(result.body.source).toBe('new');
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should return cached run for duplicate lookup', async () => {
      const scenarioId = 'test-scenario';
      const seed = 42;

      // First lookup
      const firstResult = await handleLookupRequest({ scenarioId, seed });
      expect(firstResult.body.source).toBe('new');

      // Second lookup (should be cached)
      const secondResult = await handleLookupRequest({ scenarioId, seed });
      expect(secondResult.body.source).toBe('cache');
      expect(secondResult.body.runId).toBe(firstResult.body.runId);
    });

    it('should generate different runIds for different scenarios', async () => {
      const seed = 42;

      const result1 = await handleLookupRequest({ scenarioId: 'scenario-a', seed });
      const result2 = await handleLookupRequest({ scenarioId: 'scenario-b', seed });

      expect(result1.body.runId).not.toBe(result2.body.runId);
      expect(result1.body.source).toBe('new');
      expect(result2.body.source).toBe('new');
    });

    it('should generate different runIds for different seeds', async () => {
      const scenarioId = 'test-scenario';

      const result1 = await handleLookupRequest({ scenarioId, seed: 42 });
      const result2 = await handleLookupRequest({ scenarioId, seed: 17 });

      expect(result1.body.runId).not.toBe(result2.body.runId);
      expect(result1.body.source).toBe('new');
      expect(result2.body.source).toBe('new');
    });
  });

  describe('GET /runs/{runId}/events', () => {
    it('should return 404 for non-existent run', async () => {
      const result = await handleEventsRequest('non-existent-run');

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('not found');
    });

    it('should return empty events for new run', async () => {
      const scenarioId = 'test-scenario';
      const seed = 42;

      // Create a run
      const lookupResult = lookupRun(scenarioId, seed);
      const runId = lookupResult.runId;

      const result = await handleEventsRequest(runId);

      expect(result.status).toBe(200);
      expect(result.body.runId).toBe(runId);
      expect(result.body.events).toEqual([]);
      expect(result.body.count).toBe(0);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should return recorded events after execution', async () => {
      const scenarioId = 'test-scenario';
      const seed = 42;

      // Create and register a run
      const lookupResult = lookupRun(scenarioId, seed);
      const runId = lookupResult.runId;

      const mockEvents = [
        { type: 'start', data: { sessionId: 'test' } },
        { type: 'token', data: { text: 'hello' } },
        { type: 'done', data: { sessionId: 'test' } }
      ];

      const mockReport = { schema: 'report.v1' };

      registerRunExecution(runId, scenarioId, seed, mockEvents, mockReport);

      const result = await handleEventsRequest(runId);

      expect(result.status).toBe(200);
      expect(result.body.runId).toBe(runId);
      expect(result.body.events).toEqual(mockEvents);
      expect(result.body.count).toBe(3);
    });
  });

  describe('Run Registry Core Logic', () => {
    it('should return cache hit for same parameters', () => {
      const scenarioId = 'test-scenario';
      const seed = 42;

      const first = lookupRun(scenarioId, seed);
      const second = lookupRun(scenarioId, seed);

      expect(first.source).toBe('new');
      expect(second.source).toBe('cache');
      expect(second.runId).toBe(first.runId);
    });

    it('should store and retrieve events correctly', () => {
      const scenarioId = 'test-scenario';
      const seed = 42;
      const events = [
        { type: 'start', data: { sessionId: 'test' } },
        { type: 'done', data: { sessionId: 'test' } }
      ];

      const lookupResult = lookupRun(scenarioId, seed);
      registerRunExecution(lookupResult.runId, scenarioId, seed, events, {});

      const retrievedEvents = getRunEvents(lookupResult.runId);
      expect(retrievedEvents).toEqual(events);
    });

    it('should return null for non-existent run events', () => {
      const events = getRunEvents('non-existent-run');
      expect(events).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    it('should treat runs with same scenario and seed as identical', () => {
      const scenarioId = 'identical-scenario';
      const seed = 123;

      const run1 = lookupRun(scenarioId, seed);
      const run2 = lookupRun(scenarioId, seed);

      expect(run1.runId).toBe(run2.runId);
      expect(run2.source).toBe('cache');
    });

    it('should differentiate based on scenario ID', () => {
      const seed = 123;

      const runA = lookupRun('scenario-a', seed);
      const runB = lookupRun('scenario-b', seed);

      expect(runA.runId).not.toBe(runB.runId);
      expect(runA.source).toBe('new');
      expect(runB.source).toBe('new');
    });

    it('should differentiate based on seed value', () => {
      const scenarioId = 'same-scenario';

      const run42 = lookupRun(scenarioId, 42);
      const run17 = lookupRun(scenarioId, 17);

      expect(run42.runId).not.toBe(run17.runId);
      expect(run42.source).toBe('new');
      expect(run17.source).toBe('new');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const result = await handleLookupRequest(null);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle empty parameters', async () => {
      const result = await handleLookupRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle non-string runId in events request', async () => {
      const result = await handleEventsRequest('');

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent lookup response structure', async () => {
      const result = await handleLookupRequest({ scenarioId: 'test', seed: 42 });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('runId');
      expect(result.body).toHaveProperty('source');
      expect(['new', 'cache']).toContain(result.body.source);
      expect(typeof result.body.runId).toBe('string');
    });

    it('should return consistent events response structure', async () => {
      const lookupResult = lookupRun('test', 42);
      const result = await handleEventsRequest(lookupResult.runId);

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('runId');
      expect(result.body).toHaveProperty('events');
      expect(result.body).toHaveProperty('count');
      expect(Array.isArray(result.body.events)).toBe(true);
      expect(typeof result.body.count).toBe('number');
    });
  });
});