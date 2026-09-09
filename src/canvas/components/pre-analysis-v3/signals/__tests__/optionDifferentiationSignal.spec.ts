/**
 * sig_option_differentiation — the option VALUE row.
 *
 * Guards, in order of what they defend:
 *  - the row fires on the shape measured live (options identical on all but
 *    one axis), which the existing `IDENTICAL_OPTIONS_SUSPECTED` predicate
 *    cannot see because it requires total identity;
 *  - it never renders alongside the structural row, which answers the other
 *    question and outranks;
 *  - it stays silent when no comparison could honestly run.
 *
 * Every assertion binds to the signal BY ID, never by "the first sharpen row" —
 * a positional assertion would pass on a different signal the moment registry
 * order changes.
 */

import { describe, it, expect } from 'vitest'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from '../registry'
import { deriveSignalViews } from '../deriveSignalViews'

function input(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    goalPresent: true,
    successSet: true,
    optionCount: 4,
    riskCount: 3,
    risksAllOlumi: false,
    aiEstimatedCount: 0,
    topUncalibrated: null,
    isSavedExample: false,
    narrowFramingDetail: null,
    biasFindingExplanation: null,
    structuralAbsence: null,
    optionDifferentiation: null,
    ...overrides,
  }
}

const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_option_differentiation')!

describe('sig_option_differentiation — registration', () => {
  it('is registered on the sharpen surface with no quiet confirmation', () => {
    expect(def).toBeDefined()
    expect(def.surface).toBe('sharpen')
    expect(def.entityKind).toBe('option')
    // A confirmation cannot distinguish "well differentiated" from "could not
    // look", so there must not be one.
    expect(def.resolvedCopy).toBeNull()
  })

  it('outranks the option-count row — a value defect is worth more than a count', () => {
    const ids = SIGNAL_REGISTRY.map(d => d.signal_id)
    expect(ids.indexOf('sig_option_differentiation')).toBeLessThan(
      ids.indexOf('sig_option_breadth'),
    )
  })
})

describe('sig_option_differentiation — detection', () => {
  it('stays silent when no differentiation finding was computed', () => {
    expect(def.detect(input())).toBeNull()
  })

  it('fires on the measured live shape: identical on three of four shared factors', () => {
    const detection = def.detect(
      input({ optionDifferentiation: { optionCount: 4, sharedCount: 4, identicalCount: 3 } }),
    )!
    expect(detection).not.toBeNull()
    expect(detection.signal_id).toBe('sig_option_differentiation')
    expect(detection.copy.lead).toBe(
      'All 4 options set the same value for 3 of the 4 factors they share.',
    )
    // The user is told what CAN still separate the options — the actionable half.
    expect(detection.copy.emphasis).toContain('one that differs')
  })

  it('pluralises the differing factors correctly', () => {
    const detection = def.detect(
      input({ optionDifferentiation: { optionCount: 3, sharedCount: 5, identicalCount: 3 } }),
    )!
    expect(detection.copy.lead).toBe(
      'All 3 options set the same value for 3 of the 5 factors they share.',
    )
    expect(detection.copy.emphasis).toContain('2 that differ')
  })

  it('uses the total-identity wording when every shared factor carries one value', () => {
    const detection = def.detect(
      input({ optionDifferentiation: { optionCount: 2, sharedCount: 2, identicalCount: 2 } }),
    )!
    expect(detection.copy.lead).toBe(
      'All two options set the same value for every factor they share.',
    )
  })

  it('carries an actionable spark rather than a dead end', () => {
    const detection = def.detect(
      input({ optionDifferentiation: { optionCount: 2, sharedCount: 2, identicalCount: 2 } }),
    )!
    expect(detection.action).toEqual({ type: 'send_prompt', spark: detection.spark })
    expect(detection.spark?.prompt).toBeTruthy()
  })
})

describe('sig_option_differentiation — one answer per question at the surface', () => {
  const finding = { optionCount: 4, sharedCount: 4, identicalCount: 3 }

  it('yields to the structural row when the options share a mechanism', () => {
    expect(
      def.detect(
        input({
          optionDifferentiation: finding,
          structuralAbsence: { kind: 'shared_mechanism', optionCount: 4 },
        }),
      ),
    ).toBeNull()
  })

  it('still fires alongside the OTHER structural findings — they ask different things', () => {
    for (const kind of ['no_downside', 'no_external_factor'] as const) {
      const detection = def.detect(
        input({ optionDifferentiation: finding, structuralAbsence: { kind, optionCount: 4 } }),
      )
      expect(detection, `should fire alongside ${kind}`).not.toBeNull()
    }
  })

  it('renders exactly one option row when both questions would fire', () => {
    const views = deriveSignalViews(
      input({
        optionDifferentiation: finding,
        structuralAbsence: { kind: 'shared_mechanism', optionCount: 4 },
      }),
      {},
    )
    const ids = views.sharpen.map(v => v.detection.signal_id)
    expect(ids).toContain('sig_structural_absence')
    expect(ids).not.toContain('sig_option_differentiation')
  })

  it('reaches the sharpen rows when nothing outranks it', () => {
    const views = deriveSignalViews(input({ optionDifferentiation: finding }), {})
    expect(views.sharpen.map(v => v.detection.signal_id)).toContain(
      'sig_option_differentiation',
    )
  })
})
