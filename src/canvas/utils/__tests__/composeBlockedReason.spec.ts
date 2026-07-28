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
    expect(reason).toBe(BLOCKED_REASON_COPY.twoOptions('Buy a vendor platform', 'Wait a year'))
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
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(3))
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
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(1))
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
  it('does not name options when the count disagrees with the verdict', () => {
    const reason = composeReadinessBlockedReason(
      { ...paulReadiness, options_ready: 3, options_total: 5 }, // verdict says 2 not ready
      [{ id: 'opt_extend', label: 'Partner with a consultancy' }], // we see 1
    )
    expect(reason).toBe(BLOCKED_REASON_COPY.manyOptions(1))
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
