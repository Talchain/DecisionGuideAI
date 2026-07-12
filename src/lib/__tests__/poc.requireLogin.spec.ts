/**
 * Login UI half (3.4) — VITE_REQUIRE_LOGIN gates guest-minting.
 *
 * poc.ts computes isGuestAuth at module load from import.meta.env, so every
 * case stubs env + resets modules + re-imports (the flagFactory snapshot
 * pattern — see flags.v5CanonicalAnalysis.spec.ts).
 *
 * Flag OFF must be byte-identical to today: guest mode remains the default.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function importPoc() {
  return await import('../poc')
}

describe('poc.ts × VITE_REQUIRE_LOGIN', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('flag OFF (unset): guest auth stays the default — byte-identical pin', async () => {
    // VITE_REQUIRE_LOGIN and VITE_AUTH_MODE both genuinely unset (the
    // worktree .env.local carries neither): the `?? 'guest'` default must
    // keep minting the guest. Deliberately NO stubs — an empty-string stub
    // would defeat the nullish default and test a different reality.
    const { isGuestAuth } = await importPoc()
    expect(isGuestAuth).toBe(true)
  })

  it('flag OFF explicit false: guest auth stays on under VITE_AUTH_MODE=guest', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'false')
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    const { isGuestAuth } = await importPoc()
    expect(isGuestAuth).toBe(true)
  })

  it('flag ON: no guest user is minted even with VITE_AUTH_MODE=guest', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'true')
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    const { isGuestAuth } = await importPoc()
    expect(isGuestAuth).toBe(false)
  })

  it('flag ON beats VITE_POC_ONLY=1', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'true')
    vi.stubEnv('VITE_POC_ONLY', '1')
    const { isGuestAuth } = await importPoc()
    expect(isGuestAuth).toBe(false)
  })

  it('flag ON via localStorage override (feature.requireLogin) also gates guest auth', async () => {
    localStorage.setItem('feature.requireLogin', '1')
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    const { isGuestAuth } = await importPoc()
    expect(isGuestAuth).toBe(false)
  })

  it('flag ON does not disturb isPocOnly itself (only the auth consequence)', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'true')
    vi.stubEnv('VITE_POC_ONLY', '1')
    const { isPocOnly } = await importPoc()
    expect(isPocOnly).toBe(true)
  })
})

describe('flags × isRequireLoginEnabled', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('defaults OFF when env is unset', async () => {
    const { isRequireLoginEnabled } = await import('../../flags')
    expect(isRequireLoginEnabled()).toBe(false)
  })

  it('turns ON via VITE_REQUIRE_LOGIN=true', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'true')
    const { isRequireLoginEnabled } = await import('../../flags')
    expect(isRequireLoginEnabled()).toBe(true)
  })

  it('localStorage kill-switch wins over env', async () => {
    vi.stubEnv('VITE_REQUIRE_LOGIN', 'true')
    localStorage.setItem('feature.requireLogin', '0')
    const { isRequireLoginEnabled } = await import('../../flags')
    expect(isRequireLoginEnabled()).toBe(false)
  })
})
