import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY_V4 = 'canvas-layout-options-v4'
const KEY_V5 = 'canvas-layout-options-v5'
const KEY_V6 = 'canvas-layout-options-v6'

async function loadStore() {
  const mod = await import('../layoutStore')
  return mod.useLayoutStore.getState()
}

describe('layoutStore — v6 / v5 / v4 migration cascade', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  // ── Layer: defaults ──────────────────────────────────────────────────────

  it('uses fresh v6 defaults when no key exists', async () => {
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  // ── Layer: v6 (current key) ──────────────────────────────────────────────

  it('reads v6 entry as-is when present', async () => {
    localStorage.setItem(KEY_V6, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 25, layerSpacing: 72, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(25)
    expect(state.layerSpacing).toBe(72)
    expect(state.respectLocked).toBe(false)
  })

  it('fills missing v6 fields from defaults when entry is partial', async () => {
    localStorage.setItem(KEY_V6, JSON.stringify({ direction: 'RIGHT', nodeSpacing: 22 }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(22)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  // ── Layer: v5 → v6 migration ─────────────────────────────────────────────

  it('migrates v5 default-like nodeSpacing=20 to v6 default 15', async () => {
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 20, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(15)
  })

  it('preserves v5 customised nodeSpacing (non-20) across migration', async () => {
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 35, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(35)
  })

  it('preserves v5 direction, layerSpacing, and respectLocked while migrating nodeSpacing', async () => {
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 20, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  it('fills missing v5 fields from defaults while migrating', async () => {
    // Same `??` fallback contract on the v5 → v6 migration path.
    // nodeSpacing=20 still migrates; absent fields use v6 defaults.
    localStorage.setItem(KEY_V5, JSON.stringify({ direction: 'RIGHT', nodeSpacing: 20 }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  it('preserves all v5 customisation when nodeSpacing is non-default', async () => {
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'LEFT', nodeSpacing: 80, layerSpacing: 120, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('LEFT')
    expect(state.nodeSpacing).toBe(80)
    expect(state.layerSpacing).toBe(120)
    expect(state.respectLocked).toBe(false)
  })

  it('v6 entry takes precedence over a v5 entry', async () => {
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 20, layerSpacing: 48, respectLocked: true,
    }))
    localStorage.setItem(KEY_V6, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 12, layerSpacing: 72, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(12)
    expect(state.layerSpacing).toBe(72)
    expect(state.respectLocked).toBe(false)
  })

  it('falls back to v5 migration when v6 is malformed but v5 is valid', async () => {
    localStorage.setItem(KEY_V6, '{not valid json')
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 20, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  // ── Layer: v4 → v6 migration (skips intermediate v5 default) ─────────────

  it('migrates v4 default-like nodeSpacing=30 to v6 default 15', async () => {
    // A v4 user holding nodeSpacing=30 (the v4 default) skips v5 entirely
    // and lands on the v6 default 15 — same conservative-snap policy as
    // the original v4 → v5 migration.
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 30, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(15)
  })

  it('preserves v4 customised nodeSpacing (non-30) across migration', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 45, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(45)
  })

  it('preserves v4 direction, layerSpacing, and respectLocked while migrating nodeSpacing', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 30, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  it('fills missing v4 fields from defaults while migrating', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({ direction: 'RIGHT', nodeSpacing: 30 }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  it('falls back to v4 migration when both v6 and v5 are malformed but v4 is valid', async () => {
    localStorage.setItem(KEY_V6, '{not valid')
    localStorage.setItem(KEY_V5, '{also not valid')
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 30, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  // ── Layer: cascade ordering ──────────────────────────────────────────────

  it('cascade ordering: v6 beats v5 beats v4 when all three exist', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'LEFT', nodeSpacing: 30, layerSpacing: 48, respectLocked: true,
    }))
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'UP', nodeSpacing: 20, layerSpacing: 60, respectLocked: true,
    }))
    localStorage.setItem(KEY_V6, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 12, layerSpacing: 72, respectLocked: false,
    }))
    const state = await loadStore()
    // v6 wins all four fields; v5 and v4 are ignored.
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(12)
    expect(state.layerSpacing).toBe(72)
    expect(state.respectLocked).toBe(false)
  })

  // ── Layer: robustness + sanity ──────────────────────────────────────────

  it('returns defaults when all three keys (v6, v5, v4) are malformed', async () => {
    localStorage.setItem(KEY_V6, '{not valid')
    localStorage.setItem(KEY_V5, '{also not valid')
    localStorage.setItem(KEY_V4, '{still not valid')
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  it('migrates only nodeSpacing and preserves other default-like fields', async () => {
    // Sanity: the value-driven snap rules (20 → 15 for v5, 30 → 15 for v4)
    // apply to nodeSpacing alone. Other fields equal to a prior-version
    // default (e.g. layerSpacing=48) stay literal — they are not "snapped"
    // to v6 defaults by the migration.
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 20, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(48)
  })
})
