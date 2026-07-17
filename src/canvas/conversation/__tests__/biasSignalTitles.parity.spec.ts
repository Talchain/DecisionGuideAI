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
 *   - both real public mappers (pre-analysis panel, both wire conventions)
 *     resolve every registry code to the registry title;
 *   - hostile prototype-chain codes fail closed everywhere (C7) and the
 *     findings path is case-insensitive (C8).
 */
import { describe, it, expect, vi } from 'vitest'

import { BIAS_SIGNAL_REGISTRY, resolveBiasSignal } from '../../shared/biasSignalTitles'
import { humaniseBiasSignalCode } from '../draftBiasSignalBlocks'
import {
  mapDraftBiasSignalToTrigger,
  normaliseCeeBiasFinding,
} from '../../components/pre-analysis/PreAnalysisPanel'

// PreAnalysisPanel imports the canvas store transitively; keep the module
// import light and deterministic (the functions under test are pure).
vi.mock('../../store', () => {
  const mockState = { nodes: [] as Array<{ id: string }> }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

/**
 * Every bias code a UI surface composes copy from via
 * resolveBiasSignal('<code>')!. Keep in step with the literal call sites:
 *   - PreAnalysisPanel.tsx pushDeterministic (narrow_framing, overconfidence)
 *   - useScienceIcons.ts / OptionNode.tsx status-quo tooltips
 *   - DecisionNode.tsx bias trigger strings
 * A code missing from the registry would make those sites throw at render —
 * this trap fails first.
 */
const COMPOSED_TRIGGER_CODES = [
  'narrow_framing',
  'overconfidence',
  'status_quo_bias',
] as const

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

  it('every code the deterministic-trigger literals compose from resolves', () => {
    for (const code of COMPOSED_TRIGGER_CODES) {
      const entry = resolveBiasSignal(code)
      expect(entry, `composed-trigger code ${code} must resolve`).not.toBeNull()
    }
  })

  it('pins one composed trigger string byte-identical to the pre-registry literal (C15)', () => {
    expect(`${resolveBiasSignal('status_quo_bias')!.title}: inaction risks often underestimated.`)
      .toBe('Status quo bias: inaction risks often underestimated.')
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
  it('the pre-analysis draft-signal mapper resolves every registry code to the registry title, both cases', () => {
    for (const [code, entry] of Object.entries(BIAS_SIGNAL_REGISTRY)) {
      const trigger = mapDraftBiasSignalToTrigger(
        { type: code, detail: 'A grounded detail sentence.' },
        0,
        () => null,
      )
      expect(trigger, `code ${code} produced no trigger`).not.toBeNull()
      expect(trigger!.title, `title drift for code ${code}`).toBe(entry.title)
      expect(trigger!.icon, `icon drift for code ${code}`).toBe(entry.icon)
      const upper = mapDraftBiasSignalToTrigger(
        { type: code.toUpperCase(), detail: 'A grounded detail sentence.' },
        0,
        () => null,
      )
      expect(upper!.title, `uppercase title drift for code ${code}`).toBe(entry.title)
      expect(upper!.icon, `uppercase icon drift for code ${code}`).toBe(entry.icon)
    }
  })

  it('the conversation resolver agrees with the registry, case-insensitively', () => {
    for (const [code, entry] of Object.entries(BIAS_SIGNAL_REGISTRY)) {
      expect(humaniseBiasSignalCode(code)).toBe(entry.title)
      expect(humaniseBiasSignalCode(code.toUpperCase())).toBe(entry.title)
    }
  })

  it('the CEE-findings mapper resolves every registry code to the registry title and icon', () => {
    for (const [code, entry] of Object.entries(BIAS_SIGNAL_REGISTRY)) {
      const trigger = normaliseCeeBiasFinding(
        { code, explanation: 'A grounded explanation.' },
        0,
        () => null,
      )
      expect(trigger, `code ${code} produced no trigger`).not.toBeNull()
      expect(trigger!.title, `title drift for code ${code}`).toBe(entry.title)
      expect(trigger!.icon, `icon drift for code ${code}`).toBe(entry.icon)
    }
  })
})

// ─── Review-folds pins (C7 + C8) — written RED before the registry fix ────

describe('C7: hostile wire codes must not crash the pre-analysis panel mappers', () => {
  it('resolveBiasSignal fails closed on prototype-chain keys and non-strings', () => {
    expect(resolveBiasSignal('__proto__')).toBeNull()
    expect(resolveBiasSignal('constructor')).toBeNull()
    expect(resolveBiasSignal('CONSTRUCTOR')).toBeNull()
    expect(resolveBiasSignal(42)).toBeNull()
    expect(resolveBiasSignal('   ')).toBeNull()
  })

  it("mapDraftBiasSignalToTrigger('constructor') falls back — icon defined, title a string", () => {
    const trigger = mapDraftBiasSignalToTrigger(
      { type: 'constructor', detail: 'Hostile wire code.' },
      0,
      () => null,
    )
    expect(trigger).not.toBeNull()
    expect(typeof trigger!.icon).not.toBe('undefined')
    expect(typeof trigger!.title).toBe('string')
    expect(trigger!.title.trim().length).toBeGreaterThan(0)
  })

  it("mapDraftBiasSignalToTrigger('__proto__') falls back — icon defined, title a string", () => {
    const trigger = mapDraftBiasSignalToTrigger(
      { type: '__proto__', detail: 'Hostile wire code.' },
      0,
      () => null,
    )
    expect(trigger).not.toBeNull()
    expect(typeof trigger!.icon).not.toBe('undefined')
    expect(typeof trigger!.title).toBe('string')
  })

  it("normaliseCeeBiasFinding('constructor'/'__proto__') never throws and falls back honestly", () => {
    for (const code of ['constructor', '__proto__']) {
      let trigger: ReturnType<typeof normaliseCeeBiasFinding> = null
      expect(() => {
        trigger = normaliseCeeBiasFinding(
          { code, explanation: 'Hostile wire code.', target_factor_id: 'n1' },
          0,
          () => 'A resolvable label',
        )
      }, `code ${code} crashed the mapper`).not.toThrow()
      expect(trigger).not.toBeNull()
      expect(typeof trigger!.title).toBe('string')
      expect(typeof trigger!.icon).not.toBe('undefined')
    }
  })
})

describe('C8: the findings path resolves case-insensitively (both wire conventions)', () => {
  it("normaliseCeeBiasFinding({ code: 'ANCHORING' }) resolves the canonical Anchoring title, not the fallback", () => {
    const trigger = normaliseCeeBiasFinding(
      { code: 'ANCHORING', explanation: 'A grounded explanation.' },
      0,
      () => null,
    )
    expect(trigger).not.toBeNull()
    expect(trigger!.title).toBe('Anchoring')
  })

  it("lowercase 'sunk_cost' and uppercase 'SUNK_COST' land on the same title", () => {
    const lower = normaliseCeeBiasFinding({ code: 'sunk_cost', explanation: 'x.' }, 0, () => null)
    const upper = normaliseCeeBiasFinding({ code: 'SUNK_COST', explanation: 'x.' }, 0, () => null)
    expect(lower!.title).toBe('Sunk cost')
    expect(upper!.title).toBe('Sunk cost')
  })
})
