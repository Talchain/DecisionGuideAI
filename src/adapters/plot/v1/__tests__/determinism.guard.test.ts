/**
 * Determinism Guard Tests
 *
 * Verifies build-time and runtime determinism enforcement:
 * 1. STRICT mode (VITE_STRICT_DETERMINISM=1): throws on missing response_hash
 * 2. DEV mode (VITE_STRICT_DETERMINISM=0): warns + generates dev-* fallback
 * 3. Legacy model_card.response_hash fallback still works
 * 4. Preference: result.response_hash over model_card.response_hash
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../../httpV1Adapter'
import type { RunRequest } from '../../types'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

const MOCK_REQUEST: RunRequest = {
  graph: {
    nodes: [{ id: 'n1', label: 'Node 1' }],
    edges: []
  },
  seed: 42
}

describe('Determinism Guard', () => {
  describe('STRICT mode (VITE_STRICT_DETERMINISM=1, production)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '1')
      vi.stubEnv('MODE', 'production')
    })

    it('throws SERVER_ERROR when result.response_hash is missing', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            seed: 42,
            confidence: 0.85
            // ❌ No response_hash field
          })
        })
      )

      await expect(httpV1Adapter.run(MOCK_REQUEST)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: expect.stringContaining('response_hash')
      })
    })

    it('throws when both result.response_hash and model_card.response_hash are missing', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            seed: 42,
            confidence: 0.85
            // ❌ No response_hash anywhere
          })
        })
      )

      await expect(httpV1Adapter.run(MOCK_REQUEST)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: expect.stringContaining('response_hash')
      })
    })

    it('succeeds when result.response_hash is present', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            response_hash: 'abc123def456', // ✅ Present
            seed: 42,
            confidence: 0.85
          })
        })
      )

      const report = await httpV1Adapter.run(MOCK_REQUEST)
      expect(report.model_card.response_hash).toBe('abc123def456')
    })
  })

  describe('DEV mode (VITE_STRICT_DETERMINISM=0 or development)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '0')
      vi.stubEnv('MODE', 'development')
    })

    it('generates dev-* fallback hash when result.response_hash is missing', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            seed: 42,
            confidence: 0.85
            // ❌ No response_hash
          })
        })
      )

      const report = await httpV1Adapter.run(MOCK_REQUEST)

      // Should generate dev-* fallback
      expect(report.model_card.response_hash).toMatch(/^dev-\d+-[a-z0-9]+$/)

      // Should warn
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Backend returned no response_hash')
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('continuing in DEV with fallback ID')
      )
    })

    it('does NOT throw, even when hash is missing', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            seed: 42,
            confidence: 0.85
          })
        })
      )

      // Should NOT throw
      await expect(httpV1Adapter.run(MOCK_REQUEST)).resolves.toBeDefined()
    })

    it('uses real hash if present (no fallback needed)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            response_hash: 'real-abc123', // ✅ Present
            seed: 42,
            confidence: 0.85
          })
        })
      )

      const report = await httpV1Adapter.run(MOCK_REQUEST)

      // Should use real hash
      expect(report.model_card.response_hash).toBe('real-abc123')

      // Should NOT warn
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('Legacy model_card.response_hash fallback', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '1')
      vi.stubEnv('MODE', 'production')
    })

    it('accepts legacy model_card.response_hash when result.response_hash is missing', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            // ❌ No result.response_hash
            seed: 42,
            confidence: 0.85,
            model_card: {
              response_hash: 'legacy-hash-789' // ✅ Legacy location
            }
          })
        })
      )

      const report = await httpV1Adapter.run(MOCK_REQUEST)
      expect(report.model_card.response_hash).toBe('legacy-hash-789')
    })

    it('prefers result.response_hash over model_card.response_hash when both present', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            response_hash: 'new-location-abc', // ✅ Preferred
            seed: 42,
            confidence: 0.85,
            model_card: {
              response_hash: 'legacy-location-xyz' // ❌ Ignored
            }
          })
        })
      )

      const report = await httpV1Adapter.run(MOCK_REQUEST)

      // Should prefer new location
      expect(report.model_card.response_hash).toBe('new-location-abc')
    })
  })

  describe('Edge cases', () => {
    it('handles null response_hash as missing', async () => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '1')
      vi.stubEnv('MODE', 'production')

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            response_hash: null, // ❌ Treated as missing
            seed: 42,
            confidence: 0.85
          })
        })
      )

      await expect(httpV1Adapter.run(MOCK_REQUEST)).rejects.toMatchObject({
        code: 'SERVER_ERROR'
      })
    })

    it('handles empty string response_hash as missing', async () => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '1')
      vi.stubEnv('MODE', 'production')

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            response_hash: '', // ❌ Treated as missing
            seed: 42,
            confidence: 0.85
          })
        })
      )

      await expect(httpV1Adapter.run(MOCK_REQUEST)).rejects.toMatchObject({
        code: 'SERVER_ERROR'
      })
    })

    it('dev fallback generates unique hashes across multiple runs', async () => {
      vi.stubEnv('VITE_STRICT_DETERMINISM', '0')
      vi.stubEnv('MODE', 'development')
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            summary: {
              conservative: 100,
              likely: 150,
              optimistic: 200,
              units: 'units'
            },
            seed: 42,
            confidence: 0.85
            // No response_hash
          })
        })
      )

      const report1 = await httpV1Adapter.run(MOCK_REQUEST)
      const report2 = await httpV1Adapter.run(MOCK_REQUEST)

      // Both should start with 'dev-'
      expect(report1.model_card.response_hash).toMatch(/^dev-/)
      expect(report2.model_card.response_hash).toMatch(/^dev-/)

      // Should be unique (timestamp + random)
      expect(report1.model_card.response_hash).not.toBe(report2.model_card.response_hash)
    })
  })
})
