/**
 * edgePresentation — the one authority for edge stroke + dash.
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY DOES NOT DO
 * -----------------------------------------------------------
 * Every assertion binds to the NAMED RULE that fired (`decision.rule`), not only
 * to the colour string it produced. Several rules can emit the same hue — the
 * evidence lens's `assumed` and the contested branch both reach for
 * `--semantic-warning` — so a test that asserts only a colour can pass while a
 * completely different rule is doing the work (CLAUDE.md trap 19: bind by
 * identity, never by a value predicate another object could satisfy). Asserting
 * the rule id makes the precedence itself the thing under test.
 *
 * The ordering is asserted against `EDGE_STROKE_RULES` / `EDGE_DASH_RULES`
 * directly, so a future reorder is a RED, not a silent repaint.
 */
import { describe, it, expect } from 'vitest'
import {
  EDGE_STROKE_RULES,
  EDGE_DASH_RULES,
  STRUCTURAL_EDGE_COLOUR,
  NOT_CONTESTED,
  DIRECTION_DISPUTING_REASON,
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  type EdgePresentationState,
  type ContestedState,
} from '../edgePresentation'

const POLARITY_GREEN = 'var(--edge-positive)'

/** A plain, quiet, AI-drafted edge: polarity stated, nothing exceptional. */
function state(overrides: Partial<EdgePresentationState> = {}): EdgePresentationState {
  return {
    isStructural: false,
    lensMode: 'full',
    causalParams: null,
    evidenceClass: null,
    contested: NOT_CONTESTED,
    isHighlighted: false,
    polarityStroke: POLARITY_GREEN,
    existenceDash: null,
    visualPropsDash: undefined,
    ...overrides,
  }
}

/** Wire `validation` for a live contest. Defaults to a NON-direction reason. */
function validation(overrides: Record<string, unknown> = {}) {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: false,
    },
    max_divergence: 0.6,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  }
}

const contestedNonDirection: ContestedState = readContestedState(validation())
const contestedSignFlip: ContestedState = readContestedState(
  validation({ contested_reasons: ['sign_flip'] }),
)
const contestedNeedsInput: ContestedState = readContestedState(
  validation({
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
    },
  }),
)

describe('edgePresentation — the precedence is data, not paste order', () => {
  it('states the stroke precedence as an ordered list, highest first', () => {
    expect([...EDGE_STROKE_RULES]).toEqual([
      'structural',
      'lens_causal',
      'lens_evidence',
      'contested_needs_user_input',
      'contested_direction_disputed',
      'highlighted',
      'polarity',
    ])
  })

  it('states the dash precedence as an ordered list, and carries NO pre-run rule', () => {
    expect([...EDGE_DASH_RULES]).toEqual([
      'structural',
      'contested',
      'existence_certainty',
      'visual_props',
    ])
    // The defect this module was written to remove: a "needs attention" dash
    // applied to every confidence-less edge, gated on an app phase.
    expect(EDGE_DASH_RULES).not.toContain('pre_run_incomplete')
  })

  it('every rule the stroke resolver can return is declared in the ordered list', () => {
    // Derived, not mirrored: exercises one state per rule and checks the
    // returned id is a member. Catches a rule added to the resolver and
    // forgotten in the list — the hand-maintained-mirror defect (trap 12).
    const reached = [
      resolveEdgeStroke(state({ isStructural: true })).rule,
      resolveEdgeStroke(state({ lensMode: 'causal', causalParams: { direction: 'negative' } })).rule,
      resolveEdgeStroke(state({ lensMode: 'evidence', evidenceClass: 'assumed' })).rule,
      resolveEdgeStroke(state({ contested: contestedNeedsInput })).rule,
      resolveEdgeStroke(state({ contested: contestedSignFlip })).rule,
      resolveEdgeStroke(state({ isHighlighted: true })).rule,
      resolveEdgeStroke(state()).rule,
    ]
    expect(new Set(reached)).toEqual(new Set(EDGE_STROKE_RULES))
  })
})

describe('edgePresentation — colour belongs to polarity', () => {
  it('a quiet, unconfirmed, AI-drafted edge renders its polarity and nothing else', () => {
    const d = resolveEdgeStroke(state())
    expect(d.rule).toBe('polarity')
    expect(d.value).toBe(POLARITY_GREEN)
  })

  it("PAUL'S RULING: a contested edge whose contest is NOT about the sign keeps its polarity", () => {
    const d = resolveEdgeStroke(state({ contested: contestedNonDirection }))
    expect(d.rule).toBe('polarity')
    expect(d.value).toBe(POLARITY_GREEN)
    expect(d.value).not.toContain('--semantic-warning')
  })

  it('OPPOSITE-DIRECTION TWIN: a sign_flip contest DOES take the exception hue', () => {
    // Without this, the rule above could be satisfied by deleting the exception
    // styling altogether — trading a false alarm for a silent one.
    const d = resolveEdgeStroke(state({ contested: contestedSignFlip }))
    expect(d.rule).toBe('contested_direction_disputed')
    expect(d.value).toContain('--semantic-warning')
  })

  it('OPPOSITE-DIRECTION TWIN: needs_user_input takes the exception hue at full strength', () => {
    const d = resolveEdgeStroke(state({ contested: contestedNeedsInput }))
    expect(d.rule).toBe('contested_needs_user_input')
    expect(d.value).toBe('var(--semantic-warning)')
  })

  it('needs_user_input outranks a sign_flip contest — one edge, one colour, stated order', () => {
    const both = readContestedState(validation({
      contested_reasons: ['sign_flip'],
      pass2: {
        strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
        reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
      },
    }))
    expect(resolveEdgeStroke(state({ contested: both })).rule).toBe('contested_needs_user_input')
  })

  it('a contested edge still outranks the transient highlight, as it always did', () => {
    expect(
      resolveEdgeStroke(state({ contested: contestedSignFlip, isHighlighted: true })).rule,
    ).toBe('contested_direction_disputed')
  })

  it('structural grey outranks every other rule, including a sign_flip contest', () => {
    const d = resolveEdgeStroke(state({
      isStructural: true,
      contested: contestedSignFlip,
      isHighlighted: true,
      lensMode: 'evidence',
      evidenceClass: 'unknown',
    }))
    expect(d.rule).toBe('structural')
    expect(d.value).toBe(STRUCTURAL_EDGE_COLOUR)
  })

  it('the causal lens keeps its own vocabulary, above the contested rules', () => {
    const d = resolveEdgeStroke(state({
      lensMode: 'causal',
      causalParams: { direction: 'negative' },
      contested: contestedSignFlip,
    }))
    expect(d.rule).toBe('lens_causal')
    expect(d.value).toContain('--semantic-danger')
  })

  it('the causal lens paints an UNSTATED direction in its neutral body colour, not polarity', () => {
    // The lens's own refusal to claim a sign. `causalParams` present with a null
    // direction is a different fact from `causalParams` absent, and collapsing
    // them would drop the edge out of the lens entirely (trap 21).
    const d = resolveEdgeStroke(state({ lensMode: 'causal', causalParams: { direction: null } }))
    expect(d.rule).toBe('lens_causal')
    expect(d.value).toContain('--text-body')
  })

  it('an unrecognised evidence class is not a claim we can paint — it falls through', () => {
    const d = resolveEdgeStroke(state({ lensMode: 'evidence', evidenceClass: 'not_a_class' }))
    expect(d.rule).toBe('polarity')
  })
})

describe('edgePresentation — the contest is ALWAYS visible, on the dash', () => {
  it('every contested edge dashes, whatever colour won above', () => {
    for (const c of [contestedNonDirection, contestedSignFlip, contestedNeedsInput]) {
      const d = resolveEdgeDash(state({ contested: c }))
      expect(d.rule).toBe('contested')
      expect(d.value).toBe(c.dash)
    }
  })

  it('the divergence-scaled dash is unchanged by this refactor', () => {
    expect(readContestedState(validation({ max_divergence: 0.6 })).dash).toBe('2.4 6')
    expect(readContestedState(validation({ max_divergence: 0 })).dash).toBe('1.5 4')
    expect(readContestedState(validation({ max_divergence: 1 })).dash).toBe('3 8')
    // needs_user_input pins the GAP at 3 regardless of divergence; the width
    // still scales (1.5 + 0.6 × 1.5 = 2.4).
    expect(contestedNeedsInput.dash).toBe('2.4 3')
    expect(readContestedState(validation({
      max_divergence: 0.8,
      pass2: {
        strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
        reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
      },
    })).dash).toBe('2.7 3')
  })

  it('OPPOSITE-DIRECTION TWIN: a genuinely uncertain edge still dashes from existence certainty', () => {
    // Removing the fake "needs attention" dash must not remove the real one.
    const d = resolveEdgeDash(state({ existenceDash: '6,4' }))
    expect(d.rule).toBe('existence_certainty')
    expect(d.value).toBe('6,4')
  })

  it('a quiet edge with nothing stated is SOLID — no alarm by default', () => {
    const d = resolveEdgeDash(state())
    expect(d.rule).toBe('visual_props')
    expect(d.value).toBeUndefined()
  })

  it('structural edges are always solid', () => {
    const d = resolveEdgeDash(state({ isStructural: true, contested: contestedSignFlip, existenceDash: '6,4' }))
    expect(d.rule).toBe('structural')
    expect(d.value).toBeUndefined()
  })
})

describe('readContestedState — the gate, and what it refuses to infer', () => {
  it('reads a live contest', () => {
    expect(contestedNonDirection.isContested).toBe(true)
  })

  it.each([
    ['agreed status', validation({ status: 'agreed' })],
    ['a resolved contest', validation({ user_action: 'accepted_pass2' })],
    ['a dismissed contest', validation({ user_action: 'dismissed' })],
    ['absent max_divergence', (() => { const v = validation(); delete (v as any).max_divergence; return v })()],
    ['null max_divergence', validation({ max_divergence: null })],
    ['a non-numeric max_divergence', validation({ max_divergence: '0.6' })],
    ['absent validation', undefined],
    ['null validation', null],
    ['a non-object validation', 'contested'],
  ])('is NOT contested for %s', (_label, v) => {
    expect(readContestedState(v)).toEqual(NOT_CONTESTED)
  })

  it('names sign_flip as the one reason that puts the direction in dispute', () => {
    expect(DIRECTION_DISPUTING_REASON).toBe('sign_flip')
  })

  it.each([
    'strength_band_change',
    'confidence_band_change',
    'existence_boundary_crossing',
    'raw_magnitude',
  ])('%s leaves the direction undisputed — the producer says the passes agree on the sign', (reason) => {
    // Derived from the PRODUCER's enum (src/types/validation.ts `ContestedReason`),
    // not from an observed corpus: of the five declared reasons only `sign_flip`
    // is a disagreement about direction.
    expect(readContestedState(validation({ contested_reasons: [reason] })).directionDisputed).toBe(false)
  })

  it('finds sign_flip alongside other reasons', () => {
    expect(
      readContestedState(validation({ contested_reasons: ['raw_magnitude', 'sign_flip'] })).directionDisputed,
    ).toBe(true)
  })

  it.each([
    ['absent', (() => { const v = validation(); delete (v as any).contested_reasons; return v })()],
    ['null', validation({ contested_reasons: null })],
    ['a bare string rather than an array', validation({ contested_reasons: 'sign_flip' })],
  ])('FAILS QUIET when contested_reasons is %s — still contested, direction NOT disputed', (_l, v) => {
    // P5: painting the exception hue here would assert a direction disagreement
    // on no evidence. The contest is still shown, on the dash.
    const c = readContestedState(v)
    expect(c.isContested).toBe(true)
    expect(c.directionDisputed).toBe(false)
    expect(c.dash).not.toBeNull()
    expect(resolveEdgeStroke(state({ contested: c })).rule).toBe('polarity')
  })
})
