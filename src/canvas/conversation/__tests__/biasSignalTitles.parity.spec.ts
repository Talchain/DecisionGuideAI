/**
 * Bias-signal registry parity + drift traps (#356 fast-follow 2, grown by
 * review-folds 2026-07-17).
 *
 * BIAS_SIGNAL_TITLES (titles) and BIAS_TYPE_ICON (icons) used to be TWO
 * maps — the conversation cards' titles hand-mirrored the panel's, and the
 * panel's icon map carried a dual-case key space with a diverging
 * CONFIRMATION_BIAS row. The ratified fix: ONE shared registry
 * (src/canvas/shared/biasSignalTitles.ts BIAS_SIGNAL_REGISTRY) plus ONE
 * guarded resolver (resolveBiasSignal) every surface goes through. These
 * traps assert over the REGISTRY SOURCE, so they can actually fail:
 *   - every registry key is lowercase and carries BOTH a non-empty title
 *     and an icon;
 *   - every code the deterministic-trigger/tooltip literals compose from
 *     resolves;
 *   - hostile prototype-chain codes fail closed (C7).
 * (The pre-analysis panel's two mappers and their rows went with the panel, U2.)
 */
import { describe, it, expect } from 'vitest'
import { Anchor, EyeOff, Frame, Gauge } from 'lucide-react'

import { BIAS_SIGNAL_REGISTRY, biasSignal, resolveBiasSignal } from '../../shared/biasSignalTitles'
import type { KnownBiasCode } from '../../shared/biasSignalTitles'

// The composed-trigger allowlist that used to live here is GONE
// (/simplify item 2). Composed call sites now go through the TOTAL accessor
// `biasSignal(code: KnownBiasCode)`, whose parameter type is
// `keyof typeof BIAS_SIGNAL_REGISTRY` — so renaming or removing a registry
// key is a TYPECHECK error at every site that composes copy from it. The
// compiler enforces what a hand-maintained list could only mirror
// (platform trap 12: derive, don't mirror).

describe('bias-signal registry — drift traps over the SOURCE (C9)', () => {
  it('every registry key is lowercase with a non-empty sentence-case title AND an icon', () => {
    const entries = Object.entries(BIAS_SIGNAL_REGISTRY)
    expect(entries.length).toBeGreaterThanOrEqual(15)
    for (const [key, entry] of entries) {
      expect(key, `key ${key} must be lowercase`).toBe(key.toLowerCase())
      expect(entry.title.trim().length, `title for ${key}`).toBeGreaterThan(0)
      expect(entry.title[0], `title case for ${key}`).toBe(entry.title[0].toUpperCase())
      expect(entry.icon, `icon for ${key}`).toBeDefined()
      expect(entry.icon, `icon for ${key} must be a renderable component`).not.toBeNull()
    }
  })

  it('the total accessor agrees with the guarded wire resolver on every registry code', () => {
    for (const code of Object.keys(BIAS_SIGNAL_REGISTRY) as KnownBiasCode[]) {
      expect(biasSignal(code)).toEqual(resolveBiasSignal(code))
    }
  })

  it('pins the composed trigger strings byte-identical to the pre-registry literals (C15)', () => {
    expect(`${biasSignal('status_quo_bias').title}: inaction risks often underestimated.`)
      .toBe('Status quo bias: inaction risks often underestimated.')
    expect(`${biasSignal('narrow_framing').title}: < 3 options`)
      .toBe('Narrow framing: < 3 options')
    expect(`${biasSignal('status_quo_bias').title}: baseline present`)
      .toBe('Status quo bias: baseline present')
    expect(`${biasSignal('overconfidence').title}: top factor unvalidated`)
      .toBe('Overconfidence: top factor unvalidated')
  })

  it('pins the ICON each composed site now resolves from the registry (/simplify item 3)', () => {
    // Both channels come from one entry, so these are the icons the
    // status-quo science icon and the three deterministic panel triggers
    // render — byte-identical to the pre-migration hardcoded literals.
    expect(biasSignal('status_quo_bias').icon).toBe(EyeOff)
    expect(biasSignal('narrow_framing').icon).toBe(Frame)
    expect(biasSignal('overconfidence').icon).toBe(Gauge)
    expect(biasSignal('anchoring').icon).toBe(Anchor)
  })

  it('CONFIRMATION_BIAS resolves ONE icon for both wire cases (the divergence is dead)', () => {
    const lower = resolveBiasSignal('confirmation_bias')
    const upper = resolveBiasSignal('CONFIRMATION_BIAS')
    expect(lower).not.toBeNull()
    expect(upper).not.toBeNull()
    expect(upper!.icon).toBe(lower!.icon)
    expect(upper!.title).toBe(lower!.title)
  })
})

describe('bias-signal registry — every surface resolves through it', () => {
  it('the conversation resolver agrees with the registry, case-insensitively', () => {
    for (const [code, entry] of Object.entries(BIAS_SIGNAL_REGISTRY)) {
      expect(resolveBiasSignal(code)?.title).toBe(entry.title)
      expect(resolveBiasSignal(code.toUpperCase())?.title).toBe(entry.title)
    }
  })
})

// ─── Review-folds pins (C7 + C8) — written RED before the registry fix ────

describe('C7: hostile wire codes fail closed', () => {
  it('resolveBiasSignal fails closed on prototype-chain keys and non-strings', () => {
    expect(resolveBiasSignal('__proto__')).toBeNull()
    expect(resolveBiasSignal('constructor')).toBeNull()
    expect(resolveBiasSignal('CONSTRUCTOR')).toBeNull()
    expect(resolveBiasSignal(42)).toBeNull()
    expect(resolveBiasSignal('   ')).toBeNull()
  })
})
