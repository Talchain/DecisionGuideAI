/**
 * Shared setup helper for MSW specs that exercise the PLoT adapter.
 *
 * The adapter reads `VITE_PLOT_PROXY_BASE` (fallback `/bff/engine`). Locally
 * `.env.local` sets it to `/api/plot`; in CI it is unset. Specs must therefore
 * pin the value explicitly so MSW handlers registered under `/api/plot` match
 * the adapter's outgoing URLs in both environments.
 *
 * Call `pinPlotProxyBase()` at module scope once per spec file:
 *
 *   import { pinPlotProxyBase, PLOT_PROXY_BASE as PROXY_BASE } from '../../../../tests/setup/msw-env'
 *   pinPlotProxyBase()
 *
 * The helper re-stubs in `beforeEach` (not just `beforeAll`) so later tests
 * that call `vi.unstubAllEnvs()` (e.g. cleanup after stubbing a different
 * feature flag) do not lose proxy-base pinning for subsequent tests in the
 * same file.
 *
 * Discovered via ChatGPT review P0.1 on 2026-04-18:
 * `src/adapters/plot/__tests__/determinism.test.ts` had this exact failure
 * mode before the fix was centralised here.
 */

import { beforeEach, vi } from 'vitest'

export const PLOT_PROXY_BASE = '/api/plot'

export function pinPlotProxyBase(base: string = PLOT_PROXY_BASE): void {
  beforeEach(() => {
    vi.stubEnv('VITE_PLOT_PROXY_BASE', base)
  })
}
