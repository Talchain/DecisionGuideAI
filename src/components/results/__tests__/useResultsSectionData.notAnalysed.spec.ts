/**
 * NO RANK, NO PROBABILITY, NO PLACEHOLDER FOR AN OPTION THAT WAS NEVER ANALYSED.
 *
 * Ruling (Paul, 14 Aug 2026): an unanalysable/placeholder option must NOT be
 * included in comparative ranking or probabilities. It stays visible as a
 * proposed/unanalysed alternative with a clear reason and an action to resolve
 * it.
 *
 * ## Why the READER half is mandatory
 *
 * CEE now EXCLUDES an option with no interventions from the PLoT submission, so
 * the producer mints nothing for it. But this hook does not iterate the result
 * array — it enumerates the USER'S GRAPH option nodes and LEFT-JOINS the result
 * (`optionNodes.map(node => optionProbs[node.id] || {})`). An excluded option
 * therefore does not vanish; it arrives here as an option with an EMPTY join,
 * and everything downstream treats "empty" as "zero-ish" rather than "absent".
 *
 * Three measured consequences, each pinned below:
 *
 *  1. **A FABRICATED EXPECTED VALUE.** `const optionBands = prob.bands ??
 *     sharedBands ?? {}` where `sharedBands = report.run?.bands`, and the V2
 *     response mapper builds `run.bands` from the FIRST option's
 *     `confidence_interval` (`responseMapper.ts:585`, `ciMid = (lo + hi) / 2`).
 *     `rawExpected` then resolves via `?? optionBands.p50`, so the excluded
 *     option renders ANOTHER option's midpoint as its own number.
 *  2. **A RE-SORT OF THE ANALYSED OPTIONS.** `sortOptionsForDisplay`'s
 *     `allHaveWinProb` is an `every` over ALL options, so one option without a
 *     win probability drops every ANALYSED option onto the
 *     `expected ?? goalProbability ?? -Infinity` comparator.
 *  3. **A CHANGE OF WINNER-SELECTION METHOD.** `determineWinnerSelection`'s
 *     `hasCompleteWinProbabilityCoverage` is the same `every` one level up, so
 *     the same single absence silently re-decides the winner by expected value
 *     and reports `determinedBy: 'expected_outcome'` to the user.
 *
 * ## Fixture provenance and discrimination
 *
 * Driven through the REAL V2 response mapper (`mapV2ResponseToReportV1`), so
 * `run.bands` is the producer's own construction rather than this lane's model
 * of it. The V2 run path is live: `OutputsDock.tsx:1084` calls `runV2Analysis()`
 * ungated when the canonical dispatcher is not registered.
 *
 * ⚠ SCOPE OF THE `run.bands` LEAK, stated precisely (CLAUDE.md trap 20):
 * `mapV5AnalysisToReport` emits NO `bands` key EVER (its own block says so and
 * it was verified at the bytes), so consequence 1 requires a V1/V2-mapped
 * report. Consequences 2 and 3 need no bands at all and are reachable on EVERY
 * path, V5 included. The three are pinned separately for that reason.
 *
 * The fixture is DISCRIMINATING by construction: win-probability order
 * (hire .60 > partner .30) is the REVERSE of expected-value order (partner 40 >
 * hire 10), so a test that passes under either comparator is impossible. The
 * excluded option's fabricated number (10) is the analysed LEADER's own mean,
 * which is what the live defect produces — not a value invented to be spotted.
 *
 * Every assertion binds to its option by ID (CLAUDE.md trap 19); none uses a
 * value predicate another option could satisfy.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useResultsSectionData } from '../useResultsSectionData'
import { determineWinnerSelection } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { OptionResult } from '../types'

// ── Identities ────────────────────────────────────────────────────────────
const HIRE = 'opt_hire'
const PARTNER = 'opt_partner'
/** The option CEE excluded: no interventions, so it was never submitted. */
const MIGRATE = 'opt_migrate'

const LABELS: Record<string, string> = {
  [HIRE]: 'Hire Two Developers Only',
  [PARTNER]: 'Partner with a specialist consultancy',
  [MIGRATE]: 'Migrate to Salesforce',
}

/**
 * The leader's mean, and therefore `ciMid` and therefore `run.bands.p50` —
 * the exact number the defect writes onto the excluded option.
 */
const LEADER_MEAN = 10
const PARTNER_MEAN = 40

interface AnalysedShape {
  id: string
  mean: number
  winProbability: number
}

/** Only the SUBMITTED options appear in `option_comparison`. */
const ANALYSED: AnalysedShape[] = [
  { id: HIRE, mean: LEADER_MEAN, winProbability: 0.6 },
  { id: PARTNER, mean: PARTNER_MEAN, winProbability: 0.3 },
]

function makeV2Response(analysed: AnalysedShape[]): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: analysed.map((o) => ({
      option_id: o.id,
      option_label: LABELS[o.id],
      // [0, 20] on the leader ⇒ ciMid 10 ⇒ run.bands.p50 = 10.
      confidence_interval: [o.mean - 10, o.mean + 10],
      win_probability: o.winProbability,
      outcome: {
        mean: o.mean, std: 5, p10: o.mean - 10, p50: o.mean, p90: o.mean + 10,
        n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1,
      },
    })),
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    // A producer leader claim is REQUIRED, not decoration: without one
    // `deriveDecisionVerdict` returns `unknown`, `designationsWithheld` becomes
    // true, and `sortOptionsForDisplay` short-circuits to canonical order — the
    // ordering assertions below would then pass while testing nothing.
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      near_tie: { is_tie: false, top_option_id: HIRE },
    },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as unknown as V2RunResponse
}

function optionNode(id: string) {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: LABELS[id] } }
}

/** A factor the analysed options intervene on. */
const FACTOR = 'fac_capacity'

/**
 * Intervention edges: option → factor. The analysed options each have one; the
 * excluded option has NONE, which is the graph-side fact the reason is derived
 * from.
 */
const INTERVENTION_EDGES = [
  { id: 'e_hire', source: HIRE, target: FACTOR },
  { id: 'e_partner', source: PARTNER, target: FACTOR },
]

interface SeedOptions {
  /** Option nodes on the canvas, in the user's creation order. */
  readonly nodeIds?: readonly string[]
  /** Which analysed options the producer returned. */
  readonly analysed?: AnalysedShape[]
  readonly edges?: ReadonlyArray<{ id: string; source: string; target: string }>
}

/**
 * ⚠ THE EXCLUDED OPTION IS FIRST IN CREATION ORDER, DELIBERATELY.
 *
 * With it last, the pristine expected-value comparator happens to leave it at
 * the bottom anyway (its fabricated 10 ties the leader's 10 and the sort is
 * stable), so an "it sits outside the ranking" assertion would pass at pristine
 * by luck — a test agreeing with itself. First in creation order, the pristine
 * order is PARTNER, MIGRATE, HIRE: the never-analysed option renders ABOVE an
 * analysed one, which is both the RED signature and the worse live shape.
 */
const CANONICAL_NODE_IDS = [MIGRATE, HIRE, PARTNER] as const

function seedStore({
  nodeIds = CANONICAL_NODE_IDS,
  analysed = ANALYSED,
  edges = INTERVENTION_EDGES,
}: SeedOptions = {}): void {
  const report = mapV2ResponseToReportV1(makeV2Response(analysed), { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as never,
    runMeta: {} as never,
    nodes: [
      ...nodeIds.map(optionNode),
      { id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Capacity' } },
    ] as never,
    edges: edges as never,
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

function renderOptions(): OptionResult[] {
  const { result } = renderHook(() => useResultsSectionData())
  return (result.current.recommendation?.allOptions ?? []) as OptionResult[]
}

/** Bound by IDENTITY — never `find(o => o.expected === 10)`. */
function byId(options: readonly OptionResult[], id: string): OptionResult {
  const found = options.find((o) => o.id === id)
  if (!found) throw new Error(`fixture precondition failed: no option ${id} in [${options.map((o) => o.id).join(', ')}]`)
  return found
}

describe('useResultsSectionData — an option the run never analysed', () => {
  beforeEach(() => {
    seedStore()
  })

  it('PRECONDITION: the producer returned entries for the analysed options only, and run.bands carries the leader midpoint', () => {
    // The fixture's own preconditions, asserted in-test so a later refactor of
    // the mapper cannot quietly turn every assertion below into a tautology
    // (CLAUDE.md trap 13b — a discriminator must pin its own precondition).
    const report = (useCanvasStore.getState() as unknown as { results: { report: Record<string, never> } }).results.report as unknown as {
      option_probabilities?: Record<string, unknown>
      run?: { bands?: { p50?: number | null } }
    }
    expect(Object.keys(report.option_probabilities ?? {}).sort()).toEqual([HIRE, PARTNER].sort())
    expect(report.option_probabilities?.[MIGRATE]).toBeUndefined()
    // THE FABRICATION SOURCE. If this ever stops being a number the
    // placeholder pin below can no longer fail for the right reason.
    expect(report.run?.bands?.p50).toBe(LEADER_MEAN)
  })

  it('mints no placeholder numbers for it', () => {
    const options = renderOptions()
    const migrate = byId(options, MIGRATE)

    // The measured RED: `expected === 10`, the LEADER's mean rendered as the
    // excluded option's own number.
    expect(migrate.expected).toBeNull()
    expect(migrate.outcome?.mean ?? null).toBeNull()
    expect(migrate.outcome?.p10 ?? null).toBeNull()
    expect(migrate.outcome?.p50 ?? null).toBeNull()
    expect(migrate.outcome?.p90 ?? null).toBeNull()
    expect(migrate.p50).toBeNull()
    expect(migrate.winProbability).toBeUndefined()
    expect(migrate.goalProbability ?? null).toBeNull()
    // A per-option sample count belongs to a computation that never ran.
    expect(migrate.nValidSamples).toBeUndefined()

    // CONTRAST CONTROL in the same render (trap 13e): the analysed options
    // keep every number, so this is a claim about THIS option and not a
    // suite-wide blindness to numbers.
    expect(byId(options, HIRE).expected).toBe(LEADER_MEAN)
    expect(byId(options, HIRE).winProbability).toBe(0.6)
  })

  it('marks it not-analysed, and marks only it', () => {
    const options = renderOptions()
    expect(byId(options, MIGRATE).notAnalysed).toBe(true)
    expect(byId(options, HIRE).notAnalysed).not.toBe(true)
    expect(byId(options, PARTNER).notAnalysed).not.toBe(true)
  })

  it('derives the reason from the GRAPH: no intervention edges ⇒ no_interventions', () => {
    const options = renderOptions()
    expect(byId(options, MIGRATE).notAnalysedReason).toBe('no_interventions')
  })

  it('OPPOSITE TWIN — an option WITH intervention edges that the run did not return is not_returned', () => {
    // Same absence at the join, a DIFFERENT question about why (trap 21). The
    // user has nothing to configure here, so the copy must not prescribe one.
    seedStore({
      edges: [...INTERVENTION_EDGES, { id: 'e_migrate', source: MIGRATE, target: FACTOR }],
    })
    const options = renderOptions()
    expect(byId(options, MIGRATE).notAnalysed).toBe(true)
    expect(byId(options, MIGRATE).notAnalysedReason).toBe('not_returned')
  })

  it('DOMAIN GUARD — a run that analysed NO option marks nothing not-analysed', () => {
    // The predicate is "this option is missing from a result set that HAS
    // results", never "this option is missing". A whole-run producer gap is a
    // different fact and must not be re-badged as "you did not configure
    // these" (trap 22 — audit the predicate's DOMAIN, not just the invariant).
    seedStore({ analysed: [] })
    const options = renderOptions()
    for (const o of options) {
      expect(o.notAnalysed, `option ${o.id} must not be marked when the run returned nothing`).not.toBe(true)
    }
    // The guard is not vacuous: the options are all still here.
    expect(options.map((o) => o.id).sort()).toEqual([HIRE, PARTNER, MIGRATE].sort())
  })

  it('does not re-sort the ANALYSED options onto the expected-value comparator', () => {
    const options = renderOptions()
    const ids = options.map((o) => o.id)
    // Win-probability order among the analysed options. The fixture makes this
    // the REVERSE of expected-value order, so only one comparator can produce
    // it.
    expect(ids.indexOf(HIRE)).toBeLessThan(ids.indexOf(PARTNER))
  })

  it('places the not-analysed option outside the ranking, after every analysed option', () => {
    const ids = renderOptions().map((o) => o.id)
    expect(ids.indexOf(MIGRATE)).toBe(ids.length - 1)
  })

  it('does not change how the winner is selected', () => {
    // `determineWinnerSelection` is exported and called with the mapped
    // options; the `every` inside it is the same quantifier defect one level
    // up from the sort.
    const options = renderOptions()
    const { recommendedId, determinedBy } = determineWinnerSelection(options)
    expect(determinedBy).toBe('win_probability')
    expect(recommendedId).toBe(HIRE)
  })

  it('UNCHANGED BEHAVIOUR — a run where every option was analysed is untouched', () => {
    // The no-op arm. Nothing is marked, nothing is reordered, every number
    // survives — so the change cannot be paying for itself with a regression
    // on the ordinary path.
    seedStore({ nodeIds: [HIRE, PARTNER] })
    const options = renderOptions()
    expect(options.map((o) => o.id)).toEqual([HIRE, PARTNER])
    for (const o of options) expect(o.notAnalysed).not.toBe(true)
    expect(byId(options, HIRE).expected).toBe(LEADER_MEAN)
    expect(byId(options, PARTNER).expected).toBe(PARTNER_MEAN)
  })
})
