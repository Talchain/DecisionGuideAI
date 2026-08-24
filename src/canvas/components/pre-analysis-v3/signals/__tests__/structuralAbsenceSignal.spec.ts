/**
 * The structural-absence signal, bound BY IDENTITY.
 *
 * Every lookup here finds its row via `signal_id === 'sig_structural_absence'`,
 * never via a value predicate another row could satisfy (trap 19: a spec that
 * finds its object by value can pass on the wrong object while the real one is
 * deleted).
 */

import { describe, it, expect } from 'vitest'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from '../registry'
import { deriveSignalViews } from '../deriveSignalViews'
import { SIGNAL_COPY } from '../../constants'
import type { StructuralAbsence } from '../../selectors/computeStructuralAbsence'

const SIGNAL_ID = 'sig_structural_absence' as const

function baseInput(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    // A fully healthy model, so no OTHER signal fires and any row we observe is
    // unambiguously ours.
    goalPresent: true,
    successSet: true,
    optionCount: 3,
    riskCount: 3,
    risksAllOlumi: false,
    aiEstimatedCount: 0,
    topUncalibrated: null,
    isSavedExample: false,
    narrowFramingDetail: null,
    biasFindingExplanation: null,
    structuralAbsence: null,
    ...overrides,
  }
}

function def() {
  const found = SIGNAL_REGISTRY.find(d => d.signal_id === SIGNAL_ID)
  if (!found) throw new Error(`${SIGNAL_ID} is not in SIGNAL_REGISTRY`)
  return found
}

describe('sig_structural_absence — registration', () => {
  it('is registered exactly once, by identity', () => {
    const matches = SIGNAL_REGISTRY.filter(d => d.signal_id === SIGNAL_ID)
    expect(matches).toHaveLength(1)
  })

  it('renders on the sharpen surface (structural findings queue)', () => {
    expect(def().surface).toBe('sharpen')
  })

  it('carries NO resolved confirmation — null return is ambiguous by design', () => {
    // `computeStructuralAbsence` returns null both for "no absence found" and
    // for "no check could run". A quiet confirmation cannot tell those apart,
    // so asserting one would fabricate a resolution that never happened.
    expect(def().resolvedCopy).toBeNull()
  })
})

describe('sig_structural_absence — detection', () => {
  it('does not detect when no structural absence is supplied', () => {
    expect(def().detect(baseInput({ structuralAbsence: null }))).toBeNull()
  })

  it.each([
    ['no_downside', 'risk', SIGNAL_COPY.structuralNoDownsideRationale],
    ['shared_mechanism', 'option', SIGNAL_COPY.structuralSharedMechanismRationale],
    ['no_external_factor', 'factor', SIGNAL_COPY.structuralNoExternalFactorRationale],
  ] as const)(
    'maps %s to its own entity channel and rationale',
    (kind, entityKind, rationale) => {
      const absence = { kind, optionCount: 2 } as StructuralAbsence
      const detection = def().detect(baseInput({ structuralAbsence: absence }))
      expect(detection).not.toBeNull()
      expect(detection!.signal_id).toBe(SIGNAL_ID)
      expect(detection!.entityKind).toBe(entityKind)
      expect(detection!.rationale).toBe(rationale)
    },
  )

  it('every kind produces non-empty lead AND emphasis copy', () => {
    const kinds = ['no_downside', 'shared_mechanism', 'no_external_factor'] as const
    for (const kind of kinds) {
      const detection = def().detect(
        baseInput({ structuralAbsence: { kind, optionCount: 2 } as StructuralAbsence }),
      )
      expect(detection!.copy.lead.length, `${kind} lead`).toBeGreaterThan(0)
      expect(detection!.copy.emphasis.length, `${kind} emphasis`).toBeGreaterThan(0)
    }
  })

  it('names the real option count in the copy — never a fabricated quantity', () => {
    const detection = def().detect(
      baseInput({ structuralAbsence: { kind: 'shared_mechanism', optionCount: 4 } }),
    )
    expect(detection!.copy.lead).toContain('4')
  })

  it('describes shared targets without claiming they are factors', () => {
    const detection = def().detect(
      baseInput({ structuralAbsence: { kind: 'shared_mechanism', optionCount: 2 } }),
    )
    expect(`${detection!.copy.lead} ${detection!.rationale}`).not.toMatch(/\bfactors?\b/i)
    expect(detection!.copy.lead).toContain('parts of the model')
  })

  it('attaches a live spark action — no dead-end intents', () => {
    const detection = def().detect(
      baseInput({ structuralAbsence: { kind: 'no_downside', optionCount: 2 } }),
    )
    expect(detection!.action).toBeDefined()
    expect(detection!.action!.type).toBe('send_prompt')
    expect(detection!.spark).toBeDefined()
    expect(detection!.spark!.id.length).toBeGreaterThan(0)
  })
})

describe('sig_structural_absence — reaches the rendered row list', () => {
  it('appears as a LIVE sharpen row when an absence is detected', () => {
    const derived = deriveSignalViews(
      baseInput({ structuralAbsence: { kind: 'no_downside', optionCount: 2 } }),
      {},
    )
    const row = derived.sharpen.find(v => v.detection.signal_id === SIGNAL_ID)
    expect(row).toBeDefined()
    expect(row!.status).toBe('live')
  })

  it('is absent from the row list when nothing is detected', () => {
    const derived = deriveSignalViews(baseInput({ structuralAbsence: null }), {})
    expect(derived.sharpen.find(v => v.detection.signal_id === SIGNAL_ID)).toBeUndefined()
  })

  it('never produces a resolved confirmation, even once seen', () => {
    // Seen previously, now not detecting → the other signals would emit a quiet
    // confirmation here. This one must stay silent.
    const derived = deriveSignalViews(baseInput({ structuralAbsence: null }), {
      [SIGNAL_ID]: { firstSeenAt: 1 },
    })
    expect(derived.sharpen.find(v => v.detection.signal_id === SIGNAL_ID)).toBeUndefined()
  })

  it('holds the first sharpen priority slot so it survives the default cap', () => {
    const ids = SIGNAL_REGISTRY.map(d => d.signal_id)
    expect(ids.indexOf(SIGNAL_ID)).toBeLessThan(ids.indexOf('sig_option_breadth'))
    expect(ids.indexOf(SIGNAL_ID)).toBeLessThan(ids.indexOf('sig_risk_count'))
    expect(ids.indexOf(SIGNAL_ID)).toBeLessThan(ids.indexOf('sig_estimates'))
  })
})
