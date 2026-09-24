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
    existence: { kind: 'stated', dash: undefined },
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
      // ⭐ ONE contest rule, and it is about the SIGN (Experience Design,
      // 23 Sep 2026: "orange = AI review sign disagreement only").
      // `contested_needs_user_input` — full orange whenever pass 2 asked for
      // input, whatever the reason — is gone; that flag is now read by the
      // inspector's disagreement heading instead.
      'contested_direction_disputed',
      'highlighted',
      'polarity',
    ])
  })

  it('states the dash precedence as an ordered list, and carries NO pre-run rule', () => {
    expect([...EDGE_DASH_RULES]).toEqual([
      'structural',
      // ⭐ NO `contested` RULE (Experience Design, 23 Sep 2026: "dash =
      // existence certainty only"). A review disagreement never dashes a line.
      // Provenance is asked BEFORE value: an edge nobody assessed reaches a
      // NAMED rule rather than falling through to the legacy visual-props map.
      'existence_unset',
      'existence_certainty',
      // ⛔ NO `visual_props` — Paul 23 Sep contract feedback point 4: "Dash
      // remains existence certainty only." A presentational `style` field
      // carries no existence claim, so it may not dash a line.
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

  // ⭐ REWRITTEN 23 Sep 2026 (Experience Design: "orange = AI review sign
  // disagreement only"). This case used to assert that `needs_user_input`
  // took the exception hue at FULL strength whatever the reason — so a pass-2
  // request over an AGREED sign painted the line orange. The flag's reader
  // moved to the inspector heading (`EdgeReviewDisagreement`).
  it('needs_user_input over an AGREED sign keeps its polarity — the flag is not a colour', () => {
    const d = resolveEdgeStroke(state({ contested: contestedNeedsInput }))
    expect(d.rule).toBe('polarity')
    expect(d.value).toBe(POLARITY_GREEN)
  })

  it('a sign_flip that ALSO needs input takes the same single orange — one meaning, one hue', () => {
    const both = readContestedState(validation({
      contested_reasons: ['sign_flip'],
      pass2: {
        strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
        reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
      },
    }))
    const d = resolveEdgeStroke(state({ contested: both }))
    expect(d.rule).toBe('contested_direction_disputed')
    expect(d.value).toBe(resolveEdgeStroke(state({ contested: contestedSignFlip })).value)
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

// ── GAP 1 (design-gap audit row 13, contract §03 "Colour and sign = direction")
//
// A selected node's path edges used to lose their +/− polarity colour and turn
// Info blue while highlighted — the ONE case in this file where the `rule` id
// alone (`'highlighted'`) was not enough evidence, because the test above only
// checked rule MEMBERSHIP, never the VALUE the rule produced. The soft Info
// emphasis belongs on a separate channel (a glow, asserted at the StyledEdge
// DOM level in `StyledEdge.pathHighlightColour.spec.tsx`), not a stroke
// recolour — recolouring erases the one channel a red-green dichromat relies
// on for the whole highlighted path, not just one edge.
describe('edgePresentation — GAP 1: a highlighted path keeps its direction colour', () => {
  const POLARITY_ROSE = 'var(--edge-negative)'

  it('a highlighted positive edge paints the SAME colour polarity alone would — not Info', () => {
    const highlighted = resolveEdgeStroke(state({ isHighlighted: true, polarityStroke: POLARITY_GREEN }))
    expect(highlighted.rule).toBe('highlighted')
    expect(highlighted.value).toBe(POLARITY_GREEN)
    expect(highlighted.value).not.toBe('var(--semantic-info)')
  })

  it('CONTRAST: the same edge unhighlighted resolves to the identical value — highlighting repaints nothing', () => {
    const highlighted = resolveEdgeStroke(state({ isHighlighted: true, polarityStroke: POLARITY_GREEN }))
    const quiet = resolveEdgeStroke(state({ isHighlighted: false, polarityStroke: POLARITY_GREEN }))
    expect(highlighted.value).toBe(quiet.value)
  })

  it('OPPOSITE-DIRECTION TWIN: a highlighted negative edge keeps rose, not the same Info blue', () => {
    const d = resolveEdgeStroke(state({ isHighlighted: true, polarityStroke: POLARITY_ROSE }))
    expect(d.rule).toBe('highlighted')
    expect(d.value).toBe(POLARITY_ROSE)
    expect(d.value).not.toBe('var(--semantic-info)')
  })
})

describe('edgePresentation — the dash is existence certainty ONLY', () => {
  // ⭐ REWRITTEN 23 Sep 2026 (Experience Design: "dash = existence certainty
  // only"). This block used to be titled "the contest is ALWAYS visible, on the
  // dash" and asserted a divergence-scaled `contested` dash on every contested
  // edge. A strength-only contest then dashed under a key that said the
  // connection's EXISTENCE was in doubt. The contest now reaches the canvas only
  // as the sign-dispute orange; every other review disagreement is in the
  // connection's inspector.
  it('no contested edge dashes by virtue of the contest — whatever the reason', () => {
    for (const c of [contestedNonDirection, contestedSignFlip, contestedNeedsInput]) {
      expect(c.isContested).toBe(true)
      expect(resolveEdgeDash(state({ contested: c }))).toEqual(resolveEdgeDash(state()))
    }
  })

  it('the reduced contest state carries no dash to compute', () => {
    expect('dash' in contestedNonDirection).toBe(false)
    expect('dash' in NOT_CONTESTED).toBe(false)
  })

  it('OPPOSITE-DIRECTION TWIN: a genuinely uncertain edge still dashes from existence certainty', () => {
    // Removing the fake "needs attention" dash must not remove the real one.
    const d = resolveEdgeDash(state({ existence: { kind: 'stated', dash: '6,4' } }))
    expect(d.rule).toBe('existence_certainty')
    expect(d.value).toBe('6,4')
  })

  it('an edge NOBODY ASSESSED is solid, and says so by NAME rather than by falling through', () => {
    // ⭐ THE DEFECT THIS RULE WAS ADDED TO REMOVE. `USER_EDGE_DEFAULTS.beliefExists`
    // is 0.8 with no source stamp; the dash used to read that number raw, clear
    // the 0.7 threshold and draw solid — under a legend reading "Solid
    // connection: established". The board asserted that a link the user had
    // merely DRAWN was established, pre-attentively.
    //
    // Binding to the RULE, not the value, is the whole point: the pixels are
    // unchanged (solid), so a value assertion could not tell this apart from the
    // defect. Only the decision's identity can (trap 19).
    const d = resolveEdgeDash(state({ existence: { kind: 'unset' } }))
    expect(d.rule).toBe('existence_unset')
    expect(d.value).toBeUndefined()
  })

  it('OPPOSITE-DIRECTION TWIN: a STATED high likelihood is solid too, and is a DIFFERENT decision', () => {
    // The pair is what proves the binding. Same pixels, different rule — so a
    // future lane that wants to mark the unset state has a named position to
    // hang it on, and nothing silently inherits the other's treatment.
    const d = resolveEdgeDash(state({ existence: { kind: 'stated', dash: undefined } }))
    expect(d.rule).toBe('existence_certainty')
    expect(d.value).toBeUndefined()
    expect(d.rule).not.toBe('existence_unset')
  })

  it('an unassessed edge is NOT marked by the legacy visual-props map either', () => {
    // Provenance before value: `style` is a presentational field with no
    // provenance at all, so it may not paint a certainty mark on a link nobody
    // assessed. Inert in the product today (nothing sets `style` to 'dashed'),
    // which is why this is a closed hole rather than a pixel change.
    const d = resolveEdgeDash(state({ existence: { kind: 'unset' }, visualPropsDash: '6 4' }))
    expect(d.rule).toBe('existence_unset')
    expect(d.value).toBeUndefined()
  })

  it('structural edges are always solid', () => {
    const d = resolveEdgeDash(state({ isStructural: true, contested: contestedSignFlip, existence: { kind: 'stated', dash: '6,4' } }))
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
    // on no evidence. Since 23 Sep 2026 the contest is not on the line at all
    // (dash = existence only); it is in the connection's inspector.
    const c = readContestedState(v)
    expect(c.isContested).toBe(true)
    expect(c.directionDisputed).toBe(false)
    expect(resolveEdgeStroke(state({ contested: c })).rule).toBe('polarity')
    expect(resolveEdgeDash(state({ contested: c }))).toEqual(resolveEdgeDash(state()))
  })
})
