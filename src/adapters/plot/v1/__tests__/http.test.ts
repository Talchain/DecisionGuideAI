import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { health } from '../http'
import type { V1HealthResponse } from '../types'
// Pin VITE_PLOT_PROXY_BASE so the '/api/plot/v1/...' URL assertions below
// hold in both environments — locally .env.local commonly sets it to
// '/api/plot', while CI leaves it unset (falls back to '/bff/engine').
// Same failure mode centralised in tests/setup/msw-env.ts after ChatGPT
// review P0.1 (2026-04-18, determinism.test.ts); this spec pre-dated the
// helper and had drifted back onto the untracked-.env.local dependency.
import { pinPlotProxyBase } from '../../../../../tests/setup/msw-env'

pinPlotProxyBase()

describe('v1/http', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('health', () => {
    it('should return ok status for 200 response', async () => {
      const healthResponse: V1HealthResponse = {
        status: 'ok',
        timestamp: '2025-01-15T12:00:00Z',
        version: '1.0.0',
        uptime_ms: 123456,
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => healthResponse,
      })

      const result = await health()

      expect(result).toEqual(healthResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/health',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should return degraded status for non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const result = await health()

      expect(result.status).toBe('degraded')
      expect(result.timestamp).toBeDefined()
    })

    it('should return down status on fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await health()

      expect(result.status).toBe('down')
      expect(result.timestamp).toBeDefined()
    })

    it.skip('should timeout after 5 seconds', async () => {
      // Skipped: difficult to test with mocked timers in vitest
      // The actual timeout behavior is verified in integration tests
      fetchMock.mockImplementationOnce(() => new Promise(() => {}))

      const result = await health()

      expect(result.status).toBe('down')
    })
  })
})
