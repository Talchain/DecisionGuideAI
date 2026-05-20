/**
 * Env-gate matrix tests for payload-trace-store (PR #152).
 *
 * The gate is closed-by-default. Live staging bundles previously
 * shipped with `payloads.cee_request` / `cee_response` null because
 * a missing/empty `VITE_APP_ENV` silently disabled capture. The new
 * gate enables capture ONLY when one of:
 *   - `import.meta.env.DEV === true`
 *   - `VITE_APP_ENV === 'development'`
 *   - `VITE_APP_ENV === 'staging'`
 *   - `VITE_ENABLE_PAYLOAD_INSPECTION === 'true'`
 * Otherwise capture is disabled and the bundle surfaces one of four
 * documented `_capture_disabled` reason codes so reviewers immediately
 * see WHY traces are absent.
 *
 * Each case re-imports the module under stubbed env so the gate's
 * resolved state is observed under the matrix entry.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('payload-trace-store env gate (PR #152)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // Helpers --------------------------------------------------------------

  /**
   * Stub the env then dynamic-import the module so the gate is
   * evaluated under the matrix entry. The gate captures resolved
   * state at module load (a `const`), so we MUST reset modules and
   * re-import for each matrix entry.
   */
  async function loadWithEnv(env: {
    DEV?: boolean
    VITE_APP_ENV?: string | undefined
    VITE_ENABLE_PAYLOAD_INSPECTION?: string | undefined
  }) {
    vi.stubEnv('DEV', env.DEV === true ? 'true' : '')
    // Use undefined to remove the var; stub with '' to simulate empty.
    if (env.VITE_APP_ENV === undefined) {
      vi.stubEnv('VITE_APP_ENV', '')
    } else {
      vi.stubEnv('VITE_APP_ENV', env.VITE_APP_ENV)
    }
    if (env.VITE_ENABLE_PAYLOAD_INSPECTION === undefined) {
      vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    } else {
      vi.stubEnv(
        'VITE_ENABLE_PAYLOAD_INSPECTION',
        env.VITE_ENABLE_PAYLOAD_INSPECTION,
      )
    }
    const mod = await import('../payload-trace-store')
    return mod.getPayloadInspectionStatus()
  }

  // Enabling reasons -----------------------------------------------------

  it('enables capture when Vite DEV is true (vite_dev_mode_enabled)', async () => {
    const status = await loadWithEnv({ DEV: true, VITE_APP_ENV: '' })
    expect(status.enabled).toBe(true)
    expect(status.reason).toBe('vite_dev_mode_enabled')
  })

  it('enables capture when VITE_APP_ENV is "development"', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: 'development',
    })
    expect(status.enabled).toBe(true)
    expect(status.reason).toBe('app_env_development_enabled')
    expect(status.resolvedAppEnv).toBe('development')
  })

  it('enables capture when VITE_APP_ENV is "staging"', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: 'staging',
    })
    expect(status.enabled).toBe(true)
    expect(status.reason).toBe('app_env_staging_enabled')
    expect(status.resolvedAppEnv).toBe('staging')
  })

  it('enables capture when explicit debug flag is set (production override)', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: 'production',
      VITE_ENABLE_PAYLOAD_INSPECTION: 'true',
    })
    expect(status.enabled).toBe(true)
    expect(status.reason).toBe('explicit_debug_flag_enabled')
    // resolvedAppEnv still echoes what was observed
    expect(status.resolvedAppEnv).toBe('production')
  })

  // Disabling reasons ----------------------------------------------------
  //
  // CRITICAL: This is the security correction the user demanded. A
  // missing / empty / unknown VITE_APP_ENV must NOT default open. Each
  // disabled-state code maps 1:1 with a documented branch in the gate
  // priority order — reviewers see exactly which branch fired without
  // rebuilding.

  it('disables capture and reports missing_app_env when VITE_APP_ENV is undefined', async () => {
    // vi.stubEnv with '' is what we have to use to "unset"; the gate
    // treats string '' as the empty-string branch. To exercise the
    // missing-undefined branch we drop the env var entirely by
    // deleting from import.meta.env after stubEnv has populated it.
    vi.stubEnv('DEV', '')
    vi.stubEnv('VITE_APP_ENV', '')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    // Force VITE_APP_ENV to undefined post-stub so the gate sees the
    // "missing" branch rather than "empty string".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (import.meta.env as any).VITE_APP_ENV
    const mod = await import('../payload-trace-store')
    const status = mod.getPayloadInspectionStatus()
    expect(status.enabled).toBe(false)
    expect(status.reason).toBe('missing_app_env_capture_disabled')
    expect(status.resolvedAppEnv).toBe('')
  })

  it('disables capture when VITE_APP_ENV is the empty string', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: '',
    })
    expect(status.enabled).toBe(false)
    expect(status.reason).toBe('empty_app_env_capture_disabled')
    expect(status.resolvedAppEnv).toBe('')
  })

  it('disables capture when VITE_APP_ENV is "production" (and no override)', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: 'production',
    })
    expect(status.enabled).toBe(false)
    expect(status.reason).toBe('production_env_capture_disabled')
    expect(status.resolvedAppEnv).toBe('production')
  })

  it('disables capture for an unknown VITE_APP_ENV value', async () => {
    const status = await loadWithEnv({
      DEV: false,
      VITE_APP_ENV: 'preview',
    })
    expect(status.enabled).toBe(false)
    expect(status.reason).toBe('unknown_app_env_capture_disabled')
    expect(status.resolvedAppEnv).toBe('preview')
  })

  // Cross-cutting invariants --------------------------------------------

  it('record* functions become no-ops when capture is disabled', async () => {
    vi.stubEnv('DEV', '')
    vi.stubEnv('VITE_APP_ENV', 'production')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    const mod = await import('../payload-trace-store')
    expect(mod.getPayloadInspectionStatus().enabled).toBe(false)

    mod.recordRequestPayload({
      id: 'gated-1',
      endpoint: 'https://example.test/v5/turn',
      method: 'POST',
      headers: {},
      body: { ping: 1 },
    })
    mod.recordResponsePayload({
      id: 'gated-1',
      status: 200,
      headers: {},
      body: { ok: true },
      duration: 5,
    })

    // Closed-by-default: nothing stored.
    expect(mod.usePayloadTraceStore.getState().payloads).toHaveLength(0)
  })

  it('record* functions store when capture is enabled (e.g. DEV)', async () => {
    vi.stubEnv('DEV', 'true')
    vi.stubEnv('VITE_APP_ENV', '')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    const mod = await import('../payload-trace-store')
    // Module-load gate must be enabled in this matrix entry.
    expect(mod.getPayloadInspectionStatus().enabled).toBe(true)

    mod.recordRequestPayload({
      id: 'open-1',
      endpoint: 'https://example.test/v5/turn',
      method: 'POST',
      headers: {},
      body: { ping: 1 },
    })
    mod.recordResponsePayload({
      id: 'open-1',
      status: 200,
      headers: {},
      body: { ok: true },
      duration: 5,
    })

    const stored = mod.usePayloadTraceStore
      .getState()
      .payloads.find((p) => p.id === 'open-1')
    expect(stored).toBeDefined()
    expect(stored?.completed).toBe(true)
  })
})
