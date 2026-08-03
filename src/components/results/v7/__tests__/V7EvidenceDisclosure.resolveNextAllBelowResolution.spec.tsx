/**
 * Resolve next — THE ARRIVED-AND-ALL-SUB-RESOLUTION EMPTY STATE (L51).
 *
 * WHAT THIS SUITE EXISTS FOR
 * ──────────────────────────
 * The 3-Aug witness walk ran an analysis whose per-factor EVPPI came back with
 * EVERY row `status: 'below_resolution'` — the honest "nothing cleared the noise
 * floor on this run" condition, with `decision_evpi` present, so the estimator
 * unambiguously RAN. At staging tip `42cbd0d4` the view rendered a note claiming
 * the factors were "Ranked by value of information" above an empty list, then a
 * bare `Below resolution on this run: …` line — and never once told the user the
 * actual outcome. This suite pins the sentence that says it.
 *
 * (That quoted line is the BEFORE state, kept for the record. The same PR's
 * review also reworded it to the plain class — see `v7LensCopy.ts`. Every
 * assertion here goes through `E.resolveNextBelow(...)` or a fixture label, so
 * no pin in this file spells either wording.)
 *
 * THE FIXTURE IS CAPTURED PRODUCER BYTES, NOT A HAND-WRITTEN SHAPE.
 * `ALL_BELOW_RESOLUTION_ROWS` is the `enrichment.factor_evppi` array copied
 * VERBATIM out of
 * `PHASE0-EVIDENCE-2026-07-28/journey-witness-2026-08-04c-raw/w7/wire-final-5-res.txt`,
 * audit legs and all. `FIXTURE_LABELS` is the canvas id→label map read out of the
 * SAME response's graph, and both ids are confirmed present as `rf__node-*` in
 * that walk's painted manifest (`w7/W7-manifests.json`) — so label resolution
 * genuinely succeeds and no row is dropped. A hand-rolled fixture could have got
 * the honest condition wrong in either direction; these bytes cannot.
 *
 * THE HONESTY BOUNDARY THIS SUITE POLICES (both directions — trap 13)
 * ──────────────────────────────────────────────────────────────────
 * The empty state is a CLAIM: it says the analysis assessed the unknowns and
 * none of them would change the recommendation. That claim is only true when the
 * rows ARRIVED. So:
 *
 *   · rows arrived, none resolved  → the sentence renders          (§1, §2)
 *   · `factor_evppi` ABSENT        → the sentence must NOT render, the
 *     pre-existing honest gate does instead                        (§3)
 *   · rows arrived, one resolved   → the sentence must NOT render, the ranking
 *     does                                                          (§4)
 *
 * §3 is the negative control and it is the load-bearing one: an empty state on
 * absent data would fabricate the claim that the analysis assessed anything at
 * all. It is asserted against the COPY CONSTANT, not a paraphrase, so it cannot
 * drift into passing against a sentence that is no longer the one we ship.
 *
 * IDENTITY-BOUND, NEVER VALUE-MATCHED (trap 19). Every label assertion resolves
 * through `FIXTURE_LABELS[row.factor_id]` off the fixture's own rows rather than
 * naming a string inline, so a test cannot pass on a different factor than the
 * one it was written for, and re-capturing the walk cannot leave a stale literal
 * silently asserting nothing.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../buildV7Lenses'
import { V7_LENS_COPY } from '../v7LensCopy'
import { buildVoiRanking } from '../../voi/voiRanking'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import { openDisclosureHeader, switchEvidenceView } from '../../../../test/helpers/resolveNextView'

const E = V7_LENS_COPY.evidence

/**
 * VERBATIM producer bytes — `enrichment.factor_evppi` from
 * `journey-witness-2026-08-04c-raw/w7/wire-final-5-res.txt`. Both rows
 * `below_resolution`, both `evppi: 0`, audit legs intact. Not trimmed: the
 * reader's `.pick()` is supposed to survive the full row, and a trimmed copy
 * would be testing a shape the wire never sends.
 */
const ALL_BELOW_RESOLUTION_ROWS = [
  {
    factor_id: 'fac_churn_rate',
    evppi: 0,
    evppi_raw: 0,
    baseline_max_expected_utility: 0.154582,
    conditional_max_expected_utility: 0.154582,
    units: 'outcome',
    method: 'regression_evppi_v1',
    regression_degree: 4,
    n_samples: 10000,
    clamped_low: false,
    clamped_high: false,
    noise_floor: 6e-6,
    status: 'below_resolution',
    correlation_active: false,
  },
  {
    factor_id: 'fac_market_demand',
    evppi: 0,
    evppi_raw: 0,
    baseline_max_expected_utility: 0.154582,
    conditional_max_expected_utility: 0.154582,
    units: 'outcome',
    method: 'regression_evppi_v1',
    regression_degree: 4,
    n_samples: 10000,
    clamped_low: false,
    clamped_high: false,
    noise_floor: 1.8e-5,
    status: 'below_resolution',
    correlation_active: false,
  },
] as const

/** Canvas id→label, read from the same captured response's graph nodes. */
const FIXTURE_LABELS: Record<string, string> = {
  fac_churn_rate: 'Customer Churn Rate',
  fac_market_demand: 'Enterprise Market Demand',
}

/** `decision_evpi` from the same capture — the estimator demonstrably RAN. */
const CAPTURED_DECISION_EVPI = 0.044601096202867174

/**
 * ⚠ WHY THE NEGATIVE CONTROLS NEED A DRIVER (found by this suite's own RED run).
 *
 * `V7EvidenceDisclosure` returns `null` outright when NOTHING is disclosable
 * (`:178` — "Nothing to disclose at all → render nothing"). So on absent VOI with
 * no other evidence the whole section unmounts and `not.toContain(copy)` passes
 * against an EMPTY BODY — a textbook trap-13 vacuous absence: the assertion could
 * never have seen a presence.
 *
 * Passing one driver keeps the disclosure, the tab strip and the Resolve-next
 * view all MOUNTED, so the negative control asserts what it claims to: the
 * surface is on screen, the user is looking at the Resolve-next view, and the
 * sentence still is not there. Every §3/§4 case asserts `v7-evidence-resolve-next`
 * is present for exactly this reason.
 */
const ONE_DRIVER = [
  { factorKey: 'fac_sales_capacity', label: 'Enterprise Sales Capacity', direction: 'positive' as const, isEstimate: false, focusId: 'fac_sales_capacity' },
]

function renderResolveNext(
  enrichment: Record<string, unknown>,
  { drivers = [] }: { drivers?: V7EvidenceModel['drivers'] } = {},
) {
  const block = {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_sales',
    win_probabilities: { opt_sales: 0.57, opt_hybrid: 0.26 },
    enrichment,
  } as unknown as AnalysisResultBlock
  const report = mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
  const resolveNext = buildVoiRanking({
    rows: report.factor_evppi,
    inferenceWarnings: report.inference_warnings,
    resolveLabel: (id) =>
      FIXTURE_LABELS[id] ? { label: FIXTURE_LABELS[id], canFocus: true } : null,
  })
  render(
    <V7EvidenceDisclosure
      evidence={{
        drivers,
        flipRisks: [],
        tradeOffs: [],
        resolveNext,
        designationsWithheld: false,
      }}
    />,
  )
  openDisclosureHeader()
  switchEvidenceView('resolveNext')
  return { report, resolveNext, text: document.body.textContent ?? '' }
}

/** As `renderResolveNext`, with the disclosure guaranteed to stay mounted. */
function renderResolveNextMounted(enrichment: Record<string, unknown>) {
  const out = renderResolveNext(enrichment, { drivers: ONE_DRIVER })
  // NON-VACUITY: prove the absence assertions below can SEE a presence.
  expect(screen.getByTestId('v7-evidence-resolve-next')).toBeTruthy()
  return out
}

/**
 * The nothing-at-all case: no evidence of any kind, so the disclosure never
 * mounts and there is no header to click. Cannot go through `renderResolveNext`,
 * which opens the section.
 */
function renderResolveNextNoDisclosure(enrichment: Record<string, unknown>) {
  const block = {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_sales',
    win_probabilities: { opt_sales: 0.57, opt_hybrid: 0.26 },
    enrichment,
  } as unknown as AnalysisResultBlock
  const report = mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
  const resolveNext = buildVoiRanking({
    rows: report.factor_evppi,
    inferenceWarnings: report.inference_warnings,
    resolveLabel: (id) =>
      FIXTURE_LABELS[id] ? { label: FIXTURE_LABELS[id], canFocus: true } : null,
  })
  render(
    <V7EvidenceDisclosure
      evidence={{
        drivers: [],
        flipRisks: [],
        tradeOffs: [],
        resolveNext,
        designationsWithheld: false,
      }}
    />,
  )
  return { resolveNext }
}

const ALL_BELOW_ENRICHMENT = {
  factor_evppi: ALL_BELOW_RESOLUTION_ROWS,
  decision_evpi: CAPTURED_DECISION_EVPI,
}

describe('§1 POSITIVE CONTROL — the fixture really is the arrived-and-all-sub-resolution condition', () => {
  it('carries every captured row through the mapper with status below_resolution', () => {
    // Without this, §2 could pass on an empty fixture — proving nothing.
    const { report } = renderResolveNext(ALL_BELOW_ENRICHMENT)
    const carried = report.factor_evppi as Array<Record<string, unknown>>
    expect(carried).toHaveLength(ALL_BELOW_RESOLUTION_ROWS.length)
    expect(carried.map((r) => r.status)).toEqual(
      ALL_BELOW_RESOLUTION_ROWS.map(() => 'below_resolution'),
    )
    // The estimator ran: a magnitude for the decision as a whole came back.
    expect(report.decision_evpi).toBe(CAPTURED_DECISION_EVPI)
  })

  it('the reader returns a NON-NULL ranking whose resolved band is empty', () => {
    // This is the fact the dispatched hypothesis got backwards: the reader does
    // NOT filter below-resolution rows away, so the section does not skip.
    const { resolveNext } = renderResolveNext(ALL_BELOW_ENRICHMENT)
    expect(resolveNext).not.toBeNull()
    expect(resolveNext!.resolved).toEqual([])
    expect(resolveNext!.belowResolution.map((r) => r.factorId)).toEqual(
      ALL_BELOW_RESOLUTION_ROWS.map((r) => r.factor_id),
    )
    // Nothing was dropped — so the empty state is not standing in for a gap.
    expect(resolveNext!.someFactorsUnassessed).toBe(false)
  })

  it('renders no ranked rows at all', () => {
    renderResolveNext(ALL_BELOW_ENRICHMENT)
    expect(screen.queryAllByTestId('v7-resolve-next-row')).toHaveLength(0)
    expect(screen.queryByTestId('v7-resolve-next-lead')).toBeNull()
  })
})

describe('§2 the honest empty state renders when rows arrived and none cleared resolution', () => {
  it('states the outcome in plain language', () => {
    const { text } = renderResolveNext(ALL_BELOW_ENRICHMENT)
    const node = screen.getByTestId('v7-resolve-next-none-above-resolution')
    expect(node).toHaveTextContent(E.resolveNextNoneAboveResolution)
    expect(text).toContain(E.resolveNextNoneAboveResolution)
  })

  it('does NOT render the "wasn\'t produced" gate — the ranking WAS produced', () => {
    const { text } = renderResolveNext(ALL_BELOW_ENRICHMENT)
    expect(screen.queryByTestId('v7-evidence-resolve-next-gate')).toBeNull()
    expect(text).not.toContain(E.resolveNextGate)
  })

  it('carries no magnitude from the captured audit legs into the DOM', () => {
    // The empty state is a new sentence on a surface whose whole doctrine is
    // "no magnitude has a licensed rendering here". It must not become the leak.
    const { text } = renderResolveNext(ALL_BELOW_ENRICHMENT)
    for (const magnitude of ['0.154582', '0.0446', '10000', '0.000006', '6e-6', '1.8e-5']) {
      expect(text, `magnitude ${magnitude} must not render`).not.toContain(magnitude)
    }
  })

  it('renders whatever OTHER evidence the disclosure happens to carry', () => {
    // ⚠ ANTI-CORRELATION PIN. Every other case in this suite renders the
    // all-below payload with NO drivers and every non-rendering case WITH one,
    // so a condition wrongly sourced from `evidence.drivers.length === 0` —
    // a field with nothing to do with EVPPI status — would satisfy all of them
    // and survive. It correlates with the real condition across the fixtures,
    // not with the thing the sentence claims. This case breaks the correlation:
    // same all-below payload, driver present, sentence still required.
    renderResolveNextMounted(ALL_BELOW_ENRICHMENT)
    expect(screen.getByTestId('v7-resolve-next-none-above-resolution')).toHaveTextContent(
      E.resolveNextNoneAboveResolution,
    )
  })

  it('names the below-resolution factors by fixture identity, not by a value predicate', () => {
    renderResolveNext(ALL_BELOW_ENRICHMENT)
    const below = screen.getByTestId('v7-resolve-next-below')
    for (const row of ALL_BELOW_RESOLUTION_ROWS) {
      expect(below).toHaveTextContent(FIXTURE_LABELS[row.factor_id])
    }
  })
})

describe('§3 NEGATIVE CONTROL — VOI absent from the payload stays silent', () => {
  // ⭐ THE LOAD-BEARING PIN. The empty state claims the analysis ASSESSED the
  // unknowns. On a payload that carried no `factor_evppi` at all, that claim is
  // fabricated. Absent must keep the pre-existing honest gate and nothing else.
  it('renders the pre-existing gate and NOT the empty state', () => {
    const { resolveNext, text } = renderResolveNextMounted({
      decision_evpi: CAPTURED_DECISION_EVPI,
    })
    expect(resolveNext).toBeNull()
    expect(screen.getByTestId('v7-evidence-resolve-next-gate')).toHaveTextContent(
      E.resolveNextGate,
    )
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })

  it('an explicitly EMPTY producer array also stays silent', () => {
    // `[]` is an honest "no factor survived upstream" — still not an assessment
    // of anything, so still not the empty state's claim to make.
    const { resolveNext, text } = renderResolveNextMounted({ factor_evppi: [] })
    expect(resolveNext).toBeNull()
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })

  it('rows that all FAIL validation stay silent — unusable is not "assessed"', () => {
    const { resolveNext, text } = renderResolveNextMounted({
      factor_evppi: ALL_BELOW_RESOLUTION_ROWS.map((r) => ({ ...r, factor_id: '' })),
    })
    expect(resolveNext).toBeNull()
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })

  it('rows whose LABELS do not resolve stay silent — unnameable is not "assessed"', () => {
    // The live-path drop: a producer factor id with no canvas node. All rows are
    // below-resolution, so `sawFirstResolvedRow` is never set and the reader
    // collapses to the gate (`voiRanking.ts:237`). Still not the empty state.
    const { resolveNext, text } = renderResolveNextMounted({
      factor_evppi: ALL_BELOW_RESOLUTION_ROWS.map((r) => ({
        ...r,
        factor_id: `${r.factor_id}_not_on_canvas`,
      })),
    })
    expect(resolveNext).toBeNull()
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })

  it('with NO other evidence either, the whole disclosure stays unmounted', () => {
    // The genuinely-silent case the brief asks for, pinned explicitly so the
    // driver-mounted controls above are not mistaken for the only absent shape.
    const { resolveNext } = renderResolveNextNoDisclosure({})
    expect(resolveNext).toBeNull()
    expect(screen.queryByTestId('v7-evidence-disclosure')).toBeNull()
    expect(document.body.textContent ?? '').not.toContain(E.resolveNextNoneAboveResolution)
  })
})

describe('§4 NEGATIVE CONTROL — a resolved row present means there IS something to resolve', () => {
  it('does not render the empty state when the SAME captured rows carry a resolved status', () => {
    // Mutant (c) as a standing pin: the copy must be sourced from the real
    // statuses. Flip the captured rows' `status` and the sentence must vanish.
    const { resolveNext, text } = renderResolveNextMounted({
      factor_evppi: ALL_BELOW_RESOLUTION_ROWS.map((r) => ({ ...r, evppi: 0.9, status: 'resolved' })),
      decision_evpi: CAPTURED_DECISION_EVPI,
    })
    expect(resolveNext!.resolved).toHaveLength(ALL_BELOW_RESOLUTION_ROWS.length)
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })

  it('does not render the empty state when only ONE row resolves', () => {
    const [first, ...rest] = ALL_BELOW_RESOLUTION_ROWS
    const { resolveNext, text } = renderResolveNextMounted({
      factor_evppi: [{ ...first, evppi: 0.9, status: 'resolved' }, ...rest],
      decision_evpi: CAPTURED_DECISION_EVPI,
    })
    // Identity-bound: the surviving rank-1 is the row we promoted, not "some row".
    expect(resolveNext!.resolved.map((r) => r.factorId)).toEqual([first.factor_id])
    expect(screen.queryByTestId('v7-resolve-next-none-above-resolution')).toBeNull()
    expect(text).not.toContain(E.resolveNextNoneAboveResolution)
  })
})
