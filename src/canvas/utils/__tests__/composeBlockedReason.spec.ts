/**
 * The blocked-state reason must be TRUE and SPECIFIC — Paul, 28 Jul.
 *
 * RED-first, at the gate: with CEE's real refusal sentence on a five-option
 * model, `canRunAnalysis().reason` used to be
 * `'V3 analysis not ready: 1 option(s) blocked: opt_extend'` — which every
 * guarded surface then degraded to `'Add a decision, a goal and at least two
 * options'` (the banned word "blocked" has no substitution), and which the
 * ⌘Enter toast showed raw, internal id and all.
 *
 * The load-bearing pin is the LAST describe block: no blocked-state sentence
 * may assert a fact the panel's own counts contradict.
 */

import { describe, it, expect } from 'vitest'

import {
  BLOCKED_REASON_COPY,
  classifyBlockedReason,
  composeReadinessBlockedReason,
  selectOptionsNeedingValues,
} from '../composeBlockedReason'
import { canRunAnalysis } from '../canRunAnalysis'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import { FOOTER_COPY } from '../../components/pre-analysis-v3/constants'
import { findBannedTerm } from '../../../test/glossaryBannedTerms'

/** The live readiness response captured from the failing journey (28 Jul). */
const paulReadiness: GraphReadiness = {
  readiness_score: 90,
  readiness_level: 'ready',
  can_run_analysis: false,
  confidence_explanation: 'V3 analysis not ready: 1 option(s) blocked: opt_extend',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 4,
  options_total: 5,
  goal_node_valid: true,
}

const paulAnalysisReady = {
  options: [
    { id: 'opt_build', label: 'Build it in house', status: 'ready' },
    { id: 'opt_buy', label: 'Buy a vendor platform', status: 'ready' },
    { id: 'opt_hybrid', label: 'Hybrid build and buy', status: 'ready' },
    { id: 'opt_wait', label: 'Wait a year', status: 'ready' },
    {
      id: 'opt_extend',
      label: 'Partner with a specialist consultancy to extend the current system',
      status: 'needs_encoding',
    },
  ],
}

describe('selectOptionsNeedingValues', () => {
  it("picks exactly the options the verdict did not grade 'ready'", () => {
    const out = selectOptionsNeedingValues(paulAnalysisReady)
    expect(out.map((o) => o.id)).toEqual(['opt_extend'])
  })

  it('falls back to the canvas node label when the option carries none', () => {
    const out = selectOptionsNeedingValues(
      { options: [{ id: 'opt_extend', status: 'needs_encoding' }] },
      new Map([['opt_extend', 'Partner with a consultancy']]),
    )
    expect(out).toEqual([{ id: 'opt_extend', label: 'Partner with a consultancy' }])
  })

  it('never substitutes the node id for a missing label (no developer ids in copy)', () => {
    const out = selectOptionsNeedingValues({ options: [{ id: 'opt_extend', status: 'needs_encoding' }] })
    expect(out).toEqual([{ id: 'opt_extend', label: '' }])
  })

  it('tolerates a missing / malformed payload', () => {
    expect(selectOptionsNeedingValues(null)).toEqual([])
    expect(selectOptionsNeedingValues(undefined)).toEqual([])
    expect(selectOptionsNeedingValues({} as never)).toEqual([])
    expect(selectOptionsNeedingValues({ options: 'nope' } as never)).toEqual([])
  })
})

describe('composeReadinessBlockedReason — specificity ladder', () => {
  it("names the single option and its remedy (Paul's exact state)", () => {
    const reason = composeReadinessBlockedReason(
      paulReadiness,
      selectOptionsNeedingValues(paulAnalysisReady),
    )
    expect(reason).toBe(
      '"Partner with a specialist consultancy to extend…" has no effect values yet. Tell Olumi what it changes and the analysis can run.',
    )
  })

  it('names two options', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 3, options_total: 5 },
      [
        { id: 'a', label: 'Buy a vendor platform' },
        { id: 'b', label: 'Wait a year' },
      ],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.twoOptions('Buy a vendor platform', 'Wait a year', true))
  })

  it('degrades to a count at three or more', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 2, options_total: 5 },
      [
        { id: 'a', label: 'One' },
        { id: 'b', label: 'Two' },
        { id: 'c', label: 'Three' },
      ],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(3, true))
  })

  it('degrades to a count (singular, grammatical) when the one label is unusable', () => {
    const reason = composeReadinessBlockedReason(paulReadiness, [{ id: 'opt_extend', label: '' }])
    expect(reason).toBe('1 option has no effect values yet. Tell Olumi what it changes and the analysis can run.')
  })

  it('degrades to a count when the label itself carries a banned term', () => {
    // A user may legitimately name an option "Graph rewrite". Quoting it would
    // put banned vocabulary in front of the user; a placeholder would read as
    // nonsense. The count is the honest answer.
    const reason = composeReadinessBlockedReason(paulReadiness, [
      { id: 'opt_g', label: 'Graph rewrite' },
    ])
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(1, true))
  })

  it('reports a missing goal', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, goal_node_valid: false, options_ready: 5, options_total: 5 },
      [],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.goalMissing)
  })

  it('reports too few options', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 1, options_total: 1 },
      [],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.tooFewOptions)
  })

  it('makes NO claim when no structured field is specific enough', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 5, options_total: 5 },
      [],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('makes NO claim when readiness is absent entirely', () => {
    expect(composeReadinessBlockedReason(null)).toBe(BLOCKED_REASON_COPY.unspecified)
    expect(composeReadinessBlockedReason(undefined)).toBe(BLOCKED_REASON_COPY.unspecified)
  })
})

describe('composeReadinessBlockedReason — stale-evidence cross-check', () => {
  // A turn can land between the readiness fetch and this render. Naming an
  // option on stale evidence is the same class of error as the false fallback,
  // so a disagreement with the verdict's own counts must DOWNGRADE, not guess.
  // ⚠ AMENDED 28 Jul (adversarial review, finding 2). This test used to expect
  // `manyOptions(1)` — the length of the list the function had JUST declared
  // untrustworthy. Emitting it re-created the PR's own defect: a specific
  // numeric claim built on admitted-stale evidence. The verdict's own
  // arithmetic is the number now. See AMENDMENT A2 below for the full matrix.
  it('does not name options when the count disagrees with the verdict', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 3, options_total: 5 }, // verdict says 2 not ready
      [{ id: 'opt_extend', label: 'Partner with a consultancy' }], // we see 1
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(2, true))
    expect(reason).not.toContain('Partner with a consultancy')
  })

  it('still names when the counts agree', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 4, options_total: 5 },
      [{ id: 'opt_extend', label: 'Partner with a consultancy' }],
    )
    expect(reason).toContain('Partner with a consultancy')
  })

  it('proceeds when the verdict carries no counts at all (older CEE)', () => {
    const { options_ready: _r, options_total: _t, ...noCounts } = paulReadiness
    const reason = composeReadinessBlockedReason(noCounts, [
      { id: 'opt_extend', label: 'Partner with a consultancy' },
    ])
    expect(reason).toContain('Partner with a consultancy')
  })
})

describe('canRunAnalysis — the gate no longer emits engine prose', () => {
  const params = {
    graphHealth: null,
    readiness: paulReadiness,
    hasBlockers: false,
    nodeCount: 18,
  }

  it("RED-first: the reason names the option, not CEE's refusal sentence", () => {
    const result = canRunAnalysis({
      ...params,
      optionsNeedingValues: selectOptionsNeedingValues(paulAnalysisReady),
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Partner with a specialist consultancy')
    expect(result.reason).toContain('has no effect values yet')
  })

  it('RED-first: the reason never leaks the raw engine string or an internal option id', () => {
    const result = canRunAnalysis({
      ...params,
      optionsNeedingValues: selectOptionsNeedingValues(paulAnalysisReady),
    })
    // This is the string the ⌘Enter toast printed verbatim.
    expect(result.reason).not.toBe(paulReadiness.confidence_explanation)
    expect(result.reason).not.toContain('V3 analysis not ready')
    expect(result.reason).not.toContain('opt_extend')
    expect(result.blockingReasons).not.toContain(paulReadiness.confidence_explanation)
  })

  it('the reason is glossary-clean, so no guarded surface can degrade it', () => {
    const result = canRunAnalysis({
      ...params,
      optionsNeedingValues: selectOptionsNeedingValues(paulAnalysisReady),
    })
    expect(findBannedTerm(result.reason!)).toBeNull()
  })

  it('degrades honestly when the caller supplies no option list', () => {
    const result = canRunAnalysis(params)
    // options_total - options_ready === 1, but we were given no names.
    expect(result.reason).toBe(BLOCKED_REASON_COPY.unspecified)
    expect(findBannedTerm(result.reason!)).toBeNull()
  })

  it('does not change `allowed` — the option list feeds COPY only', () => {
    const withList = canRunAnalysis({
      ...params,
      optionsNeedingValues: selectOptionsNeedingValues(paulAnalysisReady),
    })
    const withoutList = canRunAnalysis(params)
    expect(withList.allowed).toBe(withoutList.allowed)
    expect(withList.allowed).toBe(false)
  })

  it('still runs when CEE will scaffold (UI-SEM-091 OR-term untouched)', () => {
    const result = canRunAnalysis({
      ...params,
      readiness: { ...paulReadiness, scaffold_plan: { will_scaffold_options: true, option_count: 1 } },
      optionsNeedingValues: selectOptionsNeedingValues(paulAnalysisReady),
    })
    expect(result.allowed).toBe(true)
  })
})

describe('no blocked-state copy asserts a fact the panel contradicts', () => {
  // The defect, stated as an invariant. Paul's panel showed "5 options · 3 risks
  // · 6 estimates" directly above a footer reading "Add a decision, a goal and
  // at least two options". Whatever the state, the copy shown must not tell the
  // user to add things the model demonstrably already has.
  const FORBIDDEN_WHEN_PRESENT = [
    /add a decision/i,
    /add a goal/i,
    /at least two options/i,
  ]

  const arms: Array<[string, GraphReadiness, ReturnType<typeof selectOptionsNeedingValues>]> = [
    ["Paul's five-option model", paulReadiness, selectOptionsNeedingValues(paulAnalysisReady)],
    ['unlabelled option', paulReadiness, [{ id: 'opt_extend', label: '' }]],
    ['stale counts', { ...paulReadiness, options_ready: 3 }, [{ id: 'opt_extend', label: 'A' }]],
    ['no structured fields at all', { ...paulReadiness, options_ready: 5, options_total: 5 }, []],
  ]

  it.each(arms)(
    '%s: a model WITH a decision, a goal and 5 options is never told to add them',
    (_name, readiness, optionsNeedingValues) => {
      const reason = canRunAnalysis({
        graphHealth: null,
        readiness,
        hasBlockers: false,
        nodeCount: 18,
        optionsNeedingValues,
      }).reason!
      for (const pattern of FORBIDDEN_WHEN_PRESENT) {
        expect(reason, `"${reason}" asserts something the model already has`).not.toMatch(pattern)
      }
    },
  )

  it('the guard fallback itself makes no factual claim about the model', () => {
    // FOOTER_COPY.notReadySubFallback is what guardCeeText degrades to, i.e. the
    // string shown precisely when the cause is UNKNOWN. It must therefore claim
    // nothing. It used to be 'Add a decision, a goal and at least two options'.
    for (const pattern of FORBIDDEN_WHEN_PRESENT) {
      expect(FOOTER_COPY.notReadySubFallback).not.toMatch(pattern)
    }
    expect(findBannedTerm(FOOTER_COPY.notReadySubFallback)).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// AMENDMENTS — adversarial review of this PR, 28 Jul.
//
// The review returned MERGE-SAFE WITH RESIDUALS and three findings that
// RE-CREATE THIS PR'S OWN DEFECT CLASS (asserting a false fact on the blocked
// surface). Each block below is the review's own EXECUTED failure scenario,
// turned into a pin.
// ══════════════════════════════════════════════════════════════════════════

describe('AMENDMENT A1 — the composed sentence is VETTED, never rewritten', () => {
  // Finding 1: PanelFooter passed the composed sentence through `guardCeeText`,
  // whose substitution machinery rewrote the user's own quoted option label
  // ("Move billing to edge computing" → "…to connection computing"), while the
  // unguarded ⌘Enter toast showed the real one. Two surfaces, two option names,
  // one state. The composer therefore exposes a NON-MUTATING classifier the
  // render path uses instead of the substituting guard.

  it('every rung of BLOCKED_REASON_COPY classifies as composed-safe', () => {
    // Derived-not-mirrored (trap 12): the key check below FAILS LOUD when a rung
    // is added without a sample here, because an unrecognised composed sentence
    // would silently degrade to the non-committal fallback at the footer.
    const samples: Record<keyof typeof BLOCKED_REASON_COPY, string[]> = {
      oneOption: [
        BLOCKED_REASON_COPY.oneOption('Move billing to edge computing', true),
        BLOCKED_REASON_COPY.oneOption('Buy a vendor platform', false),
      ],
      twoOptions: [
        BLOCKED_REASON_COPY.twoOptions('Buy a vendor platform', 'Build in house', true),
        BLOCKED_REASON_COPY.twoOptions('Add an edge case queue', 'Wait a year', false),
      ],
      manyOptions: [
        BLOCKED_REASON_COPY.manyOptions(1, true),
        BLOCKED_REASON_COPY.manyOptions(3, false),
        BLOCKED_REASON_COPY.manyOptions(12, true),
      ],
      goalMissing: [BLOCKED_REASON_COPY.goalMissing],
      tooFewOptions: [BLOCKED_REASON_COPY.tooFewOptions],
      unspecified: [BLOCKED_REASON_COPY.unspecified],
    }
    expect(Object.keys(samples).sort()).toEqual(Object.keys(BLOCKED_REASON_COPY).sort())

    for (const [rung, texts] of Object.entries(samples)) {
      for (const text of texts) {
        expect(classifyBlockedReason(text), `${rung}: ${text}`).toBe('composed-safe')
      }
    }
  })

  it('does not mistake an engine-authored sentence for composed copy', () => {
    // These must still reach the substituting guard — that contract is intact.
    expect(classifyBlockedReason('Two nodes in the decision graph need values')).toBe('foreign')
    expect(classifyBlockedReason('V3 analysis not ready: 1 option(s) blocked: opt_extend')).toBe(
      'foreign',
    )
    expect(classifyBlockedReason('Add some nodes to get started')).toBe('foreign')
  })

  it('our shape carrying an unvettable label degrades WHOLE, never in place', () => {
    // Unreachable from the composer (safeDisplayLabel refuses it first), pinned
    // as defence in depth: the answer is the fallback, never a rewritten label.
    expect(classifyBlockedReason(BLOCKED_REASON_COPY.oneOption('Graph rewrite', true))).toBe(
      'composed-unsafe',
    )
  })
})

describe('AMENDMENT A1 — the label is truncated BEFORE it is vetted', () => {
  // The review's second executed proof: check-then-truncate let the CUT expose a
  // banned word. 'graphite' passes the vet (no \bgraph\b), the 47-char slice ends
  // at "… graph", and the ellipsis creates the word boundary — so the footer
  // guard rewrote it to "… model…". Truncate-then-check removes the whole class.
  const LONG_LABEL = `${'x'.repeat(41)} graphite dashboards consolidation`

  it('a >48-char label whose cut would expose a banned word degrades to the count', () => {
    const reason = composeReadinessBlockedReason(paulReadiness, [
      { id: 'opt_g', label: LONG_LABEL },
    ])
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(1, true))
    expect(findBannedTerm(reason)).toBeNull()
    expect(reason).not.toContain('x'.repeat(41))
  })

  it('a >48-char label that is still safe after the cut is quoted, elided', () => {
    // Positive control: truncate-first must not start refusing safe long labels.
    const reason = composeReadinessBlockedReason(paulReadiness, [
      { id: 'opt_x', label: 'Partner with a specialist consultancy to extend the current system' },
    ])
    expect(reason).toContain('"Partner with a specialist consultancy to extend…"')
  })
})

describe('AMENDMENT A2 — a count mismatch emits the VERDICT’s number, never the client list length', () => {
  // Finding 2, executed: the function declares the client list untrustworthy and
  // then publishes its LENGTH as a specific numeric claim. The verdict's own
  // arithmetic is in its hand at that moment.

  it("the review's scenario: verdict says 2 not ready, the client list has 1", () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 3, options_total: 5 },
      [{ id: 'opt_extend', label: 'Partner with a consultancy' }],
    )
    expect(reason).not.toContain('1 option has no effect values yet')
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(2, true))
    expect(reason).not.toContain('Partner with a consultancy')
  })

  it('schema-drift variant: all five options grade not-ready, the verdict says one', () => {
    // normaliseV5AnalysisReady maps an absent per-option status to 'unknown', and
    // selectOptionsNeedingValues counts every status !== 'ready'. A CEE build that
    // stops sending status must not make the footer say "5 options".
    const reason = composeReadinessBlockedReason(
      paulReadiness, // 4 ready of 5 ⇒ the verdict says ONE
      ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: `Option ${id}` })),
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(1, true))
    expect(reason).not.toContain('5 options')
  })

  it("degrades to the unspecified copy when the verdict's own arithmetic yields no count", () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 5, options_total: 5 }, // verdict: none outstanding
      [{ id: 'opt_extend', label: 'Partner with a consultancy' }], // we see one
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('with no counts at all there is no cross-check, so the client list still speaks', () => {
    const { options_ready: _r, options_total: _t, ...noCounts } = paulReadiness
    const reason = composeReadinessBlockedReason(noCounts, [
      { id: 'a', label: '' },
      { id: 'b', label: '' },
    ])
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(2, true))
  })
})

describe('AMENDMENT A3 — the "…and the analysis can run" promise only rides when the verdict licenses it', () => {
  // Finding 3: the claim half can be true while the promise half is false. A
  // verdict blocking for a SECOND disclosed cause makes "do this and it can run"
  // a false statement — the user does the named thing and stays blocked.

  it('goal invalid AND an option unconfigured: the claim stays, the promise is dropped', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, goal_node_valid: false },
      selectOptionsNeedingValues(paulAnalysisReady),
    )
    expect(reason).toContain('has no effect values yet')
    expect(reason).not.toContain('the analysis can run')
  })

  it('too few options AND that option unconfigured: the promise is dropped', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 0, options_total: 1 },
      [{ id: 'opt_solo', label: 'Do nothing' }],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.oneOption('Do nothing', false))
    expect(reason).not.toContain('the analysis can run')
  })

  it('the promise is dropped on the count rung too, not only the named rungs', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, goal_node_valid: false, options_ready: 2, options_total: 5 },
      [
        { id: 'a', label: 'One' },
        { id: 'b', label: 'Two' },
        { id: 'c', label: 'Three' },
      ],
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(3, false))
    // Asserted independently of the factory so this cannot pass by comparing a
    // string to itself if the licence argument is ever dropped again.
    expect(reason).not.toContain('the analysis can run')
    expect(reason).toContain('3 options have no effect values yet')
  })

  it("single-cause: the promise still rides — the PR's headline copy is unchanged", () => {
    const reason = composeReadinessBlockedReason(
      paulReadiness,
      selectOptionsNeedingValues(paulAnalysisReady),
    )
    expect(reason).toContain('and the analysis can run')
  })
})
