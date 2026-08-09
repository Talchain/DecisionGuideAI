/**
 * COLLAB — TOKEN HYGIENE. These are capability tests, not robustness overhead:
 * attribution is the proof PR4 exists to make, and a leaked bearer token means
 * a forged answer under someone else's name.
 *
 * ── EVERY ABSENCE ASSERTION HERE HAS A POSITIVE CONTROL ───────────────────
 * The detector is proven to SEE a token before it is trusted to report one
 * absent. Without that, "no token in the debug log" is equally consistent with
 * "the detector is blind" — and a vacuous absence assertion about a credential
 * is worse than none, because it is believed.
 *
 * ── THE LEAK THIS CLOSES IS OUTSIDE THIS MODULE ───────────────────────────
 * `src/main.tsx` captures `location.href` into `window.__SAFE_DEBUG__.logs` at
 * `boot:start`, and persists it to localStorage under ENABLE_DEBUG_PERSISTENCE.
 * That fires BEFORE React mounts, so no page-level cleanup can beat it. The
 * strip therefore happens in the boot path, and these tests bind to that
 * ordering rather than to the strip function in isolation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  captureParticipantTokenFromUrl,
  getParticipantToken,
  __resetParticipantTokenForTests,
} from '../participantToken'

const TOKEN = 'COLLAB-TEST-TOKEN-e3b0c44298fc1c149afbf4c8996fb924'

/** Drive the URL the way a real participant link does. */
function setUrl(url: string): void {
  window.history.replaceState({}, '', url)
}

describe('participant token capture and strip', () => {
  beforeEach(() => {
    __resetParticipantTokenForTests()
    setUrl('/')
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('captures from the real query string and REMOVES it from location.href', () => {
    setUrl(`/?ct=${TOKEN}#/panel/round-abc`)
    // POSITIVE CONTROL: the token IS in the URL before the strip, so the
    // assertion below is about the strip and not about an empty fixture.
    expect(window.location.href).toContain(TOKEN)

    const captured = captureParticipantTokenFromUrl()

    expect(captured).toBe(TOKEN)
    expect(getParticipantToken()).toBe(TOKEN)
    expect(window.location.href).not.toContain(TOKEN)
    // The route survives — the strip must not break navigation.
    expect(window.location.hash).toBe('#/panel/round-abc')
  })

  it('captures from a hash query too (HashRouter link shape) and preserves the route', () => {
    setUrl(`/#/panel/round-abc?ct=${TOKEN}`)
    expect(window.location.href).toContain(TOKEN)

    expect(captureParticipantTokenFromUrl()).toBe(TOKEN)
    expect(window.location.href).not.toContain(TOKEN)
    expect(window.location.hash).toBe('#/panel/round-abc')
  })

  it('preserves OTHER query parameters while removing only the token', () => {
    setUrl(`/?diag=1&ct=${TOKEN}&analysisHeroCompare=1#/panel/round-abc`)
    captureParticipantTokenFromUrl()
    expect(window.location.href).not.toContain(TOKEN)
    expect(window.location.search).toContain('diag=1')
    expect(window.location.search).toContain('analysisHeroCompare=1')
  })

  it('leaves no history entry that could restore the token via Back', () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    setUrl(`/?ct=${TOKEN}#/panel/round-abc`)
    replaceSpy.mockClear()
    pushSpy.mockClear()

    captureParticipantTokenFromUrl()

    expect(replaceSpy).toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('NEVER writes the token to localStorage or sessionStorage', () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');
    setUrl(`/?ct=${TOKEN}#/panel/round-abc`)

    captureParticipantTokenFromUrl()

    // POSITIVE CONTROL: the spy DOES observe a write when one happens, so an
    // empty call list means "nothing was written", not "the spy is inert".
    localStorage.setItem('collab-hygiene-control', TOKEN)
    expect(localSpy).toHaveBeenCalledWith('collab-hygiene-control', TOKEN)

    const tokenWrites = localSpy.mock.calls.filter(
      ([key, value]) =>
        key !== 'collab-hygiene-control' && String(value).includes(TOKEN),
    )
    expect(tokenWrites).toEqual([])
  })

  it('is not reachable from any enumerable global — a diagnostic bundle cannot find it', () => {
    setUrl(`/?ct=${TOKEN}#/panel/round-abc`)
    captureParticipantTokenFromUrl()
    expect(getParticipantToken()).toBe(TOKEN)

    // POSITIVE CONTROL for the scan: a value deliberately placed on window IS
    // found by exactly this walk.
    ;(window as unknown as Record<string, unknown>).__collabHygieneControl = TOKEN
    const scan = (): string[] =>
      Object.keys(window).filter((k) => {
        try {
          return JSON.stringify((window as unknown as Record<string, unknown>)[k])?.includes(TOKEN)
        } catch {
          return false
        }
      })
    expect(scan()).toContain('__collabHygieneControl')

    delete (window as unknown as Record<string, unknown>).__collabHygieneControl
    expect(scan()).toEqual([])
  })
})

describe('the boot path strips BEFORE the first location.href capture', () => {
  it('main.tsx calls captureParticipantTokenFromUrl ahead of the boot:start log that records location.href', async () => {
    // Bound to the SOURCE ORDER, because the ordering IS the guarantee: a strip
    // that runs one line later is a strip that runs after the capture.
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

    const stripAt = src.indexOf('captureParticipantTokenFromUrl()')
    const captureAt = src.indexOf("log('boot:start'")

    // POSITIVE CONTROL: both anchors must EXIST. If either is renamed away this
    // test would otherwise pass on two -1s and prove nothing.
    expect(stripAt).toBeGreaterThan(-1)
    expect(captureAt).toBeGreaterThan(-1)
    expect(src).toContain('href: location.href')

    expect(stripAt).toBeLessThan(captureAt)
  })
})
