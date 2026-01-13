/**
 * Tests for diagnostic-bundle.ts
 *
 * Tests the merged debug export structure and generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { truncateToSize } from '../../utils/text'

// Mock dependencies
vi.mock('../debug-state', () => ({
  getRecentTraces: vi.fn(() => []),
  getPendingTraces: vi.fn(() => []),
  getFailedTraces: vi.fn(() => []),
}))

vi.mock('../gate-state', () => ({
  useGateStore: {
    getState: vi.fn(() => ({
      gates: {
        graph_readiness: { status: 'pass', updatedAt: '2024-01-01T00:00:00Z' },
        isl_connectivity: { status: 'pass', updatedAt: '2024-01-01T00:00:00Z' },
        engine_run_status: { status: 'pass', updatedAt: '2024-01-01T00:00:00Z' },
        output_delivered: { status: 'pass', updatedAt: '2024-01-01T00:00:00Z' },
      },
    })),
  },
  ALL_GATES: ['graph_readiness', 'isl_connectivity', 'engine_run_status', 'output_delivered'],
}))

vi.mock('../version-cache', () => ({
  getClientBuild: vi.fn(() => 'test-build-123'),
  getVersionInfo: vi.fn(() => ({
    branch: 'main',
    commit: 'abc123',
    timestamp: '2024-01-01T00:00:00Z',
  })),
}))

vi.mock('../service-health', () => ({
  getAllServiceHealthArray: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../payload-trace-store', () => ({
  usePayloadTraceStore: {
    getState: vi.fn(() => ({
      payloads: [],
    })),
  },
  getDataShapeAnomalies: vi.fn(() => []),
}))

describe('diagnostic-bundle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('MergedDebugExport structure', () => {
    it('should have meta field with required properties', async () => {
      const { createMergedDebugExport } = await import('../diagnostic-bundle')
      const bundle = await createMergedDebugExport()

      expect(bundle.meta).toBeDefined()
      expect(bundle.meta.timestamp).toBe('2024-01-15T12:00:00.000Z')
      expect(bundle.meta.environment).toBeDefined()
      expect(bundle.meta.uiBuild).toBe('test-build-123')
      expect(bundle.meta.branch).toBe('main')
    })

    it('should include diagnostic bundle', async () => {
      const { createMergedDebugExport } = await import('../diagnostic-bundle')
      const bundle = await createMergedDebugExport()

      expect(bundle.diagnostic).toBeDefined()
      expect(bundle.diagnostic.version).toBe('1.0')
      expect(bundle.diagnostic.createdAt).toBeDefined()
      expect(bundle.diagnostic.gates).toBeInstanceOf(Array)
    })

    it('should include contractTrace with payloads', async () => {
      const { createMergedDebugExport } = await import('../diagnostic-bundle')
      const bundle = await createMergedDebugExport()

      expect(bundle.contractTrace).toBeDefined()
      expect(typeof bundle.contractTrace.payloadCount).toBe('number')
      expect(bundle.contractTrace.payloads).toBeInstanceOf(Array)
    })

    it('should include dataShapeAnomalies', async () => {
      const { createMergedDebugExport } = await import('../diagnostic-bundle')
      const bundle = await createMergedDebugExport()

      expect(bundle.dataShapeAnomalies).toBeDefined()
      expect(typeof bundle.dataShapeAnomalies.count).toBe('number')
      expect(bundle.dataShapeAnomalies.anomalies).toBeInstanceOf(Array)
    })

    it('should include boundaryEvents placeholder', async () => {
      const { createMergedDebugExport } = await import('../diagnostic-bundle')
      const bundle = await createMergedDebugExport()

      expect(bundle.boundaryEvents).toBeInstanceOf(Array)
    })
  })

  describe('filename generation', () => {
    it('should generate olumi-diagnostic-{timestamp}.json format', async () => {
      const diagnosticBundle = await import('../diagnostic-bundle')
      const filename = diagnosticBundle.__test__.generateMergedFilename()
      expect(filename).toMatch(/^olumi-diagnostic-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/)
    })
  })
})

describe('Copy Summary truncation', () => {
  it('should truncate content exceeding 50KB', () => {
    const MAX_SIZE = 50 * 1024
    const longContent = 'x'.repeat(MAX_SIZE + 1000)

    const result = truncateToSize(longContent, MAX_SIZE, '\n\n... (truncated at 50KB)')

    expect(result.length).toBeLessThanOrEqual(MAX_SIZE)
    expect(result).toContain('(truncated at 50KB)')
  })
})
