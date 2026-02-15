/**
 * Tests for diagnostic-bundle.ts
 *
 * Verifies:
 * - Bundle creation with correct structure
 * - Privacy requirements (no PII)
 * - Sanitization of traces
 * - Service extraction from traces
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createDiagnosticBundle,
  createMergedDebugExport,
  getDiagnosticBundleString,
  type DiagnosticBundle,
} from '../diagnostic-bundle'
import { recordRequest, recordResponse, _clearTraces } from '../debug-state'
import { _resetGateStore, useGateStore } from '../gate-state'

// Mock version-cache
vi.mock('../version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({
    commit: 'abc123def456',
    short: 'test-build',
    branch: 'main',
    timestamp: '2024-01-15T10:30:00Z',
  }),
}))

describe('diagnostic-bundle', () => {
  beforeEach(() => {
    _clearTraces()
    _resetGateStore()
  })

  describe('createDiagnosticBundle', () => {
    it('creates bundle with correct version', async () => {
      const bundle = await createDiagnosticBundle()
      expect(bundle.version).toBe('1.0')
    })

    it('includes createdAt timestamp', async () => {
      const before = Date.now()
      const bundle = await createDiagnosticBundle()
      const after = Date.now()

      const createdAt = new Date(bundle.createdAt).getTime()
      expect(createdAt).toBeGreaterThanOrEqual(before)
      expect(createdAt).toBeLessThanOrEqual(after)
    })

    it('includes client info', async () => {
      const bundle = await createDiagnosticBundle()

      expect(bundle.client.build).toBe('test-build')
      expect(bundle.client.branch).toBe('main')
      expect(bundle.client.commit).toBe('abc123def456')
    })

    it('includes environment info', async () => {
      const bundle = await createDiagnosticBundle()

      expect(bundle.environment.userAgent).toBeDefined()
      expect(bundle.environment.language).toBeDefined()
      expect(bundle.environment.screenWidth).toBeGreaterThanOrEqual(0)
      expect(bundle.environment.timezone).toBeDefined()
    })

    it('includes gate statuses', async () => {
      const bundle = await createDiagnosticBundle()

      expect(bundle.gates.length).toBe(4)
      const gateNames = bundle.gates.map((g) => g.gate)
      expect(gateNames).toContain('graph_readiness')
      expect(gateNames).toContain('validation')
      expect(gateNames).toContain('run')
      expect(gateNames).toContain('robustness')
    })

    it('reflects current gate statuses', async () => {
      useGateStore.getState().setGate('graph_readiness', 'pass')
      useGateStore.getState().setGate('validation', 'fail', { message: 'test message' })

      const bundle = await createDiagnosticBundle()

      const graphReadiness = bundle.gates.find((g) => g.gate === 'graph_readiness')
      const validation = bundle.gates.find((g) => g.gate === 'validation')

      expect(graphReadiness?.status).toBe('pass')
      expect(validation?.status).toBe('fail')
      expect(validation?.message).toBe('test message')
    })

    it('includes session info', async () => {
      const bundle = await createDiagnosticBundle()

      expect(bundle.session.durationMs).toBeGreaterThanOrEqual(0)
      expect(bundle.session.pageUrl).toBeDefined()
    })
  })

  describe('trace sanitization', () => {
    it('includes sanitized traces', async () => {
      recordRequest({
        requestId: 'req-123',
        endpoint: '/bff/cee/draft-graph',
        method: 'POST',
        payloadHash: 'abc123',
        clientBuild: 'test-build',
      })

      recordResponse('req-123', {
        status: 200,
        responseHash: 'xyz789',
        service: 'cee',
        serviceBuild: 'cee-v1.2.3',
        elapsedMs: 150,
      })

      const bundle = await createDiagnosticBundle()

      expect(bundle.traces.recent.length).toBe(1)
      const trace = bundle.traces.recent[0]

      expect(trace.requestId).toBe('req-123')
      expect(trace.endpoint).toBe('/bff/cee/draft-graph')
      expect(trace.method).toBe('POST')
      expect(trace.payloadHash).toBe('abc123')
      expect(trace.status).toBe(200)
      expect(trace.service).toBe('cee')
    })

    it('categorizes traces correctly', async () => {
      // Completed request
      recordRequest({
        requestId: 'req-complete',
        endpoint: '/bff/test1',
        method: 'GET',
        payloadHash: 'hash1',
      })
      recordResponse('req-complete', { status: 200, elapsedMs: 100 })

      // Failed request
      recordRequest({
        requestId: 'req-failed',
        endpoint: '/bff/test2',
        method: 'POST',
        payloadHash: 'hash2',
      })
      recordResponse('req-failed', { status: 500, elapsedMs: 50, error: 'Server error' })

      // Pending request
      recordRequest({
        requestId: 'req-pending',
        endpoint: '/bff/test3',
        method: 'GET',
        payloadHash: 'hash3',
      })

      const bundle = await createDiagnosticBundle()

      expect(bundle.traces.recent.length).toBe(3)
      expect(bundle.traces.failed.length).toBe(1)
      expect(bundle.traces.pending.length).toBe(1)

      expect(bundle.traces.failed[0].requestId).toBe('req-failed')
      expect(bundle.traces.pending[0].requestId).toBe('req-pending')
    })
  })

  describe('privacy requirements', () => {
    it('does not include raw error messages in sanitized traces', async () => {
      recordRequest({
        requestId: 'req-error',
        endpoint: '/bff/test',
        method: 'POST',
        payloadHash: 'hash1',
      })
      recordResponse('req-error', {
        status: 500,
        elapsedMs: 100,
        error: 'Stack trace with user data: user@email.com',
      })

      const bundle = await createDiagnosticBundle()
      const trace = bundle.traces.recent[0]

      // Sanitized trace should not include the error field
      expect(trace.error).toBeUndefined()
    })

    it('sanitizes page URL to remove sensitive query params', async () => {
      const bundle = await createDiagnosticBundle()

      // Should not contain auth tokens, user IDs, etc.
      expect(bundle.session.pageUrl).not.toContain('token=')
      expect(bundle.session.pageUrl).not.toContain('auth=')
    })

    it('only includes hostname from referrer', async () => {
      const bundle = await createDiagnosticBundle()

      // Referrer should be just hostname, not full path
      if (bundle.session.referrer) {
        expect(bundle.session.referrer).not.toContain('/')
        expect(bundle.session.referrer).not.toContain('?')
      }
    })
  })

  describe('service extraction', () => {
    it('extracts unique services from traces', async () => {
      recordRequest({
        requestId: 'req-1',
        endpoint: '/bff/cee/draft',
        method: 'POST',
        payloadHash: 'hash1',
      })
      recordResponse('req-1', {
        status: 200,
        service: 'cee',
        serviceBuild: 'v1.0.0',
        elapsedMs: 100,
      })

      recordRequest({
        requestId: 'req-2',
        endpoint: '/bff/isl/validate',
        method: 'POST',
        payloadHash: 'hash2',
      })
      recordResponse('req-2', {
        status: 200,
        service: 'isl',
        serviceBuild: 'v2.0.0',
        elapsedMs: 150,
      })

      const bundle = await createDiagnosticBundle()

      const serviceNames = bundle.services.map((s) => s.name)
      expect(serviceNames).toContain('cee')
      expect(serviceNames).toContain('isl')
    })

    it('includes service version info', async () => {
      recordRequest({
        requestId: 'req-1',
        endpoint: '/bff/cee/draft',
        method: 'POST',
        payloadHash: 'hash1',
      })
      recordResponse('req-1', {
        status: 200,
        service: 'cee',
        serviceBuild: 'v1.2.3',
        elapsedMs: 100,
      })

      const bundle = await createDiagnosticBundle()
      const ceeService = bundle.services.find((s) => s.name === 'cee')

      expect(ceeService?.build).toBe('v1.2.3')
      expect(['healthy', 'unknown']).toContain(ceeService?.status)
    })
  })

  describe('getDiagnosticBundleString', () => {
    it('returns valid JSON string', async () => {
      const jsonString = await getDiagnosticBundleString()

      expect(() => JSON.parse(jsonString)).not.toThrow()
    })

    it('returns formatted JSON', async () => {
      const jsonString = await getDiagnosticBundleString()

      // Should contain newlines (formatted)
      expect(jsonString).toContain('\n')
    })

    it('parses to equivalent bundle', async () => {
      const bundle = await createDiagnosticBundle()
      const jsonString = await getDiagnosticBundleString()
      const parsed = JSON.parse(jsonString) as DiagnosticBundle

      expect(parsed.version).toBe(bundle.version)
      expect(parsed.client.build).toBe(bundle.client.build)
      expect(parsed.gates.length).toBe(bundle.gates.length)
    })
  })

  describe('merged export pipeline trace passthrough', () => {
    it('preserves cee_provenance, enrich, repair, and strp from trace.pipeline', async () => {
      const mockPipelineTrace = {
        status: 'success',
        total_duration_ms: 123,
        stages: [],
        cee_provenance: {
          pipeline_path: 'unified',
          model: 'gpt-4.1',
          prompt_version: 'v3',
          prompt_source: 'registry',
        },
        enrich: {
          called_count: 1,
          extraction_mode: 'deterministic',
          factors_added: 2,
        },
        repair: {
          applied: true,
          count: 1,
        },
        strp: {
          enabled: true,
          dropped_edges_restored: 1,
        },
      }

      const merged = await createMergedDebugExport({ ceePipelineTrace: mockPipelineTrace as any })
      const pipeline = merged.ceePipelineTrace as Record<string, unknown>

      expect(pipeline).toBeTruthy()
      expect((pipeline.cee_provenance as Record<string, unknown>)?.pipeline_path).toBe('unified')
      expect((pipeline.enrich as Record<string, unknown>)?.called_count).toBe(1)
      expect((pipeline.repair as Record<string, unknown>)?.applied).toBe(true)
      expect((pipeline.strp as Record<string, unknown>)?.enabled).toBe(true)
    })
  })
})
