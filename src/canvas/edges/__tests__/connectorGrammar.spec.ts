/**
 * THE LOCKED CONNECTOR GRAMMAR (Experience Design, 23 Sep 2026, §6 "Connectors"),
 * at the level of the one authority that decides stroke and dash.
 *
 *   · thickness = relationship magnitude;
 *   · colour/sign = direction;
 *   · dash = existence certainty ONLY;
 *   · orange = AI-review SIGN disagreement only;
 *   · fragility = a discreet exception cue, never a line style;
 *   · no "contested" without attributable human disagreement.
 *
 * This file pins the two rules that live in `edgePresentation`: the DASH and the
 * ORANGE. Every assertion binds to the NAMED RULE the resolver returns (trap 19),
 * and the rule lists are asserted exactly, so a contest rule re-added anywhere in
 * either list is a RED rather than a silent repaint.
 *
 * ⚠ The corpus is the producer's own enum (`src/types/validation.ts`
 * `ContestedReason`, five members) crossed with both values of
 * `pass2.needs_user_input` and three divergences — not a hand-picked example.
 * `needs_user_input` is in the corpus BECAUSE it used to paint the line
 * full-strength orange whatever the reason, including the four reasons where
 * both passes AGREE on the sign.
 *
 * ⚠ `DIRECTION_DISPUTED_STROKE` is read through the module namespace rather than
 * a named import, so this file loads at a base that does not export it and REDs
 * on the assertion rather than on the import.
 */
import { describe, it, expect } from 'vitest'
import * as presentation from '../edgePresentation'
import {
  EDGE_STROKE_RULES,
  EDGE_DASH_RULES,
  NOT_CONTESTED,
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  type EdgePresentationState,
} from '../edgePresentation'
import type { ExistenceDash } from '../../utils/graphDisplayCalculations'

const POLARITY_GREEN = 'var(--edge-positive)'

function state(overrides: Partial<EdgePresentationState> = {}): EdgePresentationState {
  return {
    isStructural: false,
    lensMode: 'full',
    causalParams: null,
    evidenceClass: null,
    contested: NOT_CONTESTED,
    isHighlighted: false,
    polarityStroke: POLARITY_GREEN,
    existence: { kind: 'stated', dash: undefined },
    visualPropsDash: undefined,
    ...overrides,
  }
}

function validation(reason: string, needsUserInput: boolean, divergence: number) {
  return {
    status: 'contested',
    contested_reasons: [reason],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: needsUserInput,
    },
    max_divergence: divergence,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
  }
}

/** The producer's five reasons (`ContestedReason`), in full. */
const REASONS = [
  'sign_flip',
  'strength_band_change',
  'confidence_band_change',
  'existence_boundary_crossing',
  'raw_magnitude',
] as const
const NON_SIGN_REASONS = REASONS.filter((r) => r !== 'sign_flip')

const CORPUS = REASONS.flatMap((reason) =>
  [false, true].flatMap((needs) =>
    [0, 0.6, 1].map((d) => [reason, needs, d] as const),
  ),
)

/** The three existence states the dash channel can be handed. */
const EXISTENCE: ReadonlyArray<readonly [string, ExistenceDash]> = [
  ['nobody stated a likelihood', { kind: 'unset' }],
  ['a stated likelihood at or above the cut', { kind: 'stated', dash: undefined }],
  ['a stated likelihood below the cut', { kind: 'stated', dash: '6,4' }],
]

describe('R1 — the dash means existence certainty ONLY', () => {
  it('the dash precedence carries no contest rule at all', () => {
    expect([...EDGE_DASH_RULES]).toEqual([
      'structural',
      'existence_unset',
      'existence_certainty',
      'visual_props',
    ])
  })

  it.each(CORPUS)(
    'a live %s contest (needs_user_input=%s, divergence %s) dashes exactly as the same edge with no contest, in every existence state',
    (reason, needs, d) => {
      const contested = readContestedState(validation(reason, needs, d))
      // Discrimination: the corpus really is a live contest, so the equality
      // below is not two uncontested renders agreeing with each other.
      expect(contested.isContested).toBe(true)
      for (const [, existence] of EXISTENCE) {
        const withContest = resolveEdgeDash(state({ contested, existence }))
        const without = resolveEdgeDash(state({ contested: NOT_CONTESTED, existence }))
        expect(withContest).toEqual(without)
      }
    },
  )

  it('a contested edge with a LOW stated likelihood dashes 6,4 — from existence, not from the contest', () => {
    const contested = readContestedState(validation('existence_boundary_crossing', true, 0.6))
    const d = resolveEdgeDash(state({ contested, existence: { kind: 'stated', dash: '6,4' } }))
    expect(d.rule).toBe('existence_certainty')
    expect(d.value).toBe('6,4')
  })

  it('a contested edge with a HIGH stated likelihood is SOLID, by the existence channel', () => {
    const contested = readContestedState(validation('strength_band_change', false, 1))
    const d = resolveEdgeDash(state({ contested, existence: { kind: 'stated', dash: undefined } }))
    expect(d.value).toBeUndefined()
    expect(d.rule).toBe('visual_props')
  })

  it('the reduced contest state carries no dash — nothing computed for a rule that no longer exists', () => {
    const contested = readContestedState(validation('raw_magnitude', true, 0.6))
    expect(Object.keys(contested).sort()).toEqual(['directionDisputed', 'isContested'])
  })
})

describe('R2 — orange means an AI-review SIGN disagreement ONLY', () => {
  it('the stroke precedence carries exactly one contest rule: the disputed direction', () => {
    expect([...EDGE_STROKE_RULES]).toEqual([
      'structural',
      'lens_causal',
      'lens_evidence',
      'contested_direction_disputed',
      'highlighted',
      'polarity',
    ])
  })

  it.each(
    NON_SIGN_REASONS.flatMap((reason) => [false, true].map((needs) => [reason, needs] as const)),
  )('a %s contest (needs_user_input=%s) keeps its POLARITY stroke — the passes agree on the sign', (reason, needs) => {
    const contested = readContestedState(validation(reason, needs, 0.6))
    expect(contested.isContested).toBe(true)
    const d = resolveEdgeStroke(state({ contested }))
    expect(d.rule).toBe('polarity')
    expect(d.value).toBe(POLARITY_GREEN)
  })

  it.each([false, true])(
    'a sign_flip contest (needs_user_input=%s) takes the ONE disputed-direction orange',
    (needs) => {
      const contested = readContestedState(validation('sign_flip', needs, 0.6))
      const d = resolveEdgeStroke(state({ contested }))
      expect(d.rule).toBe('contested_direction_disputed')
      expect(d.value).toBe(
        (presentation as Record<string, unknown>).DIRECTION_DISPUTED_STROKE,
      )
    },
  )

  it('the disputed-direction stroke is exported for the legend, and it is the warning hue', () => {
    const stroke = (presentation as Record<string, unknown>).DIRECTION_DISPUTED_STROKE
    expect(typeof stroke).toBe('string')
    expect(stroke as string).toContain('--semantic-warning')
  })

  it('CONTROL: a sign_flip the person has already resolved is not a live contest — polarity', () => {
    const v = { ...validation('sign_flip', true, 0.6), user_action: 'accepted_pass1' }
    expect(resolveEdgeStroke(state({ contested: readContestedState(v) })).rule).toBe('polarity')
  })
})
