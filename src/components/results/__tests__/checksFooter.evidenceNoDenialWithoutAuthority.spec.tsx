/**
 * "What we checked" may not state an EVIDENCE all-clear it has no authority
 * to state — the evidence twin of `checksFooter.noDenialWithoutAuthority`.
 *
 * ── The defect, measured on the DEPLOYED surface ───────────────────────────
 * Driven on staging `4d1e650b` (fresh guest, one real typed brief, one real
 * first-pass analysis), the Analysis panel said all of these at one moment:
 *
 *   · `checks-evidence`   → "No evidence gaps flagged"
 *   · canvas node badge   → "High-leverage assumption with no supporting evidence."
 *   · Analysis panel      → "0 addressed · 7 worth checking"
 *   · Analysis panel      → "10 other relationships driving this result also
 *                            have placeholder strengths"
 *
 * ── Why "make the readers agree" is the WRONG fix ──────────────────────────
 * Those four are NOT four readings of one fact. Derived at the bytes, they are
 * four different questions: producer factor-level evidence gaps
 * (`m1_coaching.evidence_gaps`), local factor extraction provenance
 * (`observedState.extractionType`), the Strengthen recommendation lifecycle,
 * and local EDGE-strength provenance joined to producer fragile edges.
 * Aligning their defaults would be reconciling four concepts under one word
 * (CLAUDE.md trap 21) and would delete true signal.
 *
 * ── What was actually wrong: one surface speaking without authority ────────
 * `evidenceKnown` was `gaps.length > 0`, and `useResultsSectionData` collapses
 * "producer sent an empty list" and "producer never spoke" into the SAME empty
 * array via `?? []`. The footer rendered that collapsed emptiness as an
 * affirmative all-clear.
 *
 * On the deployed path the producer NEVER speaks, so the sentence was a
 * CONSTANT. Measured three independent ways at `4d1e650b`:
 *   · `applyV5State` — the canonical analysis path — contains ZERO references
 *     to `m1Coaching`, and `useConversation`'s `resultsComplete` passes none;
 *   · of 13 real captured analysis turns in this repo, 12 carry no
 *     `evidence_gaps` key and the 13th carries an empty array. POSITIVE
 *     CONTROL: three older captures carry 3 gaps each, so the probe sees
 *     presence — this is real absence, not a blind instrument;
 *   · driven in real Chromium across 6 captures x 2 starter graphs, the footer
 *     rendered "No evidence gaps flagged" in 12 of 12 runs.
 * Meanwhile `robustness.fragile_edges` and `factor_sensitivity` — the fields
 * the live evidence-weakness surfaces read — are present in 8 of 8 of those
 * same analysis turns.
 *
 * The sibling ruling already settled the principle for the leader verdict:
 * *"'unknown' licenses silence, never a denial"* and *"Reconciling the
 * DEFAULTS would have been the wrong fix; withdrawing the unlicensed claim is
 * the right one."* This spec applies it to the check it missed.
 *
 * ── What this spec pins ────────────────────────────────────────────────────
 * 1. A DISCRIMINATING TRIPLE (trap 19) — three producer states must produce
 *    three DIFFERENT labels, so a blanket change in either direction REDs.
 *    The "assessed, none found" row is the control that stops the fix
 *    degenerating into "delete the all-clear", which would lose a true claim.
 * 2. ONE READER (the mounted acceptance) — mutating the single source moves
 *    the summary line and the gap cards TOGETHER. Neither assertion alone
 *    shows this: the pair does.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { ResultsBody } from '../ResultsBody'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const WINNER_ID = 'opt_wholesale'
const RUNNER_UP_ID = 'opt_retail'

/** Distinctive enough that no other row could satisfy the assertion (trap 19). */
const GAP_FACTOR_ID = 'fac_supplier_lead_time'
const GAP_FACTOR_LABEL = 'Supplier lead time'

type EvidenceGapWire = {
  factor_id: string
  factor_label: string
  confidence: number
  voi_score: number
  suggestion: string
}

/**
 * The three producer states, named. `undefined` is the DEPLOYED state — the
 * producer never sent the array at all.
 */
type ProducerEvidence = { gaps: EvidenceGapWire[] } | { silent: true }

function makeV2Response(): V2RunResponse {
  const outcome = (mean: number) => ({
    mean, std: 12, p10: mean - 20, p50: mean, p90: mean + 20,
    n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1,
  })
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      { option_id: WINNER_ID, option_label: 'Double Down on Wholesale', confidence_interval: [40, 80], win_probability: 0.72, outcome: outcome(60) },
      { option_id: RUNNER_UP_ID, option_label: 'Open Retail Shop', confidence_interval: [20, 60], win_probability: 0.2, outcome: outcome(40) },
    ],
    critiques: [], drivers: [], edge_sensitivity: [], factor_sensitivity: [],
    robustness: {
      fragile_edges: [], robust_edges: ['e1'],
      recommended_option_id: WINNER_ID, recommendation_stability: 0.92,
      near_tie: { is_tie: false, top_option_id: WINNER_ID, second_option_id: RUNNER_UP_ID, gap: 0.52, threshold: 0.1 },
    } as never,
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as V2RunResponse
}

const OPTION_NODES = [
  { id: WINNER_ID, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', type: 'option', label: 'Double Down on Wholesale' } },
  { id: RUNNER_UP_ID, type: 'option', position: { x: 400, y: 0 }, data: { kind: 'option', type: 'option', label: 'Open Retail Shop' } },
]

function setStore(producer: ProducerEvidence): void {
  const v2 = makeV2Response()
  // `runMeta.m1Coaching` is the ONLY writer of the evidence-gap authority
  // (`useResultsSectionData:1233`). 'silent' omits the array entirely, which is
  // what the deployed V5 path produces — not an empty array.
  const m1Coaching = 'silent' in producer ? {} : { evidence_gaps: producer.gaps }
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV2ResponseToReportV1(v2, { seed: 42 }) },
    runMeta: { m1Coaching },
    nodes: OPTION_NODES,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: v2,
    goalThreshold: null,
    viewMode: 'expert',
  } as never)
}

/**
 * Reads BOTH surfaces from ONE render, plus the assessed flag the footer
 * itself consumes.
 *
 * PRECONDITION PIN (trap 13b): `evidenceGapsAssessed` is read from the very
 * object `T1ChecksFooter` receives, so a green result cannot come from a
 * fixture that quietly stopped reproducing the state under test.
 */
function readEvidenceSurfaces(): { label: string; assessed: boolean | undefined; gapCardPresent: boolean } {
  const { result } = renderHook(() => useResultsSectionData())
  const assessed = result.current.confidence.evidenceGapsAssessed
  const { container } = render(
    <ResultsBody resultsSectionData={result.current} tornadoData={{ rows: [], expectedOutcome: null }} />,
  )
  const el = container.querySelector('[data-testid="checks-evidence"]')
  if (!el) throw new Error('checks-evidence did not render — the probe is blind, not the product silent')
  const queue = container.querySelector('[data-testid="unified-triage-queue"]')
  return {
    label: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    assessed,
    gapCardPresent: (queue?.textContent ?? '').includes(GAP_FACTOR_LABEL),
  }
}

const WEAK_GAP: EvidenceGapWire = {
  factor_id: GAP_FACTOR_ID, factor_label: GAP_FACTOR_LABEL,
  confidence: 20, voi_score: 0.8, suggestion: 'Ask procurement for the last six months of lead times.',
}

describe('checks-evidence: no all-clear without authority', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null, rawV2Response: null, runMeta: {}, nodes: [], edges: [], hasCompletedFirstRun: false,
    } as never)
    document.body.innerHTML = ''
  })

  it('producer sent gaps → the check reports gaps', () => {
    setStore({ gaps: [WEAK_GAP] })
    const { label, assessed } = readEvidenceSurfaces()
    expect(assessed).toBe(true)
    expect(label).toBe('Evidence gaps')
  })

  it('producer ASSESSED and found none → the all-clear is licensed and still rendered', () => {
    setStore({ gaps: [] })
    const { label, assessed } = readEvidenceSurfaces()
    // Precondition: the producer really did speak, with an empty list.
    expect(assessed).toBe(true)
    expect(label).toBe('No evidence gaps flagged')
  })

  it('producer NEVER SPOKE → the check makes no claim about evidence', () => {
    setStore({ silent: true })
    const { label, assessed } = readEvidenceSurfaces()
    // Precondition: this really is the no-authority state, not an assessed zero.
    expect(assessed).toBe(false)
    expect(
      label,
      `"No evidence gaps flagged" is an all-clear. The producer sent no assessment, so there is nothing to clear. Read: ${label}`,
    ).not.toMatch(/No evidence gaps flagged/i)
    expect(label).not.toMatch(/Evidence covered/i)
    expect(label).toBe('Evidence not assessed')
  })

  it('the three producer states produce three DIFFERENT labels — the probe discriminates', () => {
    setStore({ gaps: [WEAK_GAP] })
    const withGaps = readEvidenceSurfaces().label
    document.body.innerHTML = ''
    setStore({ gaps: [] })
    const assessedEmpty = readEvidenceSurfaces().label
    document.body.innerHTML = ''
    setStore({ silent: true })
    const silent = readEvidenceSurfaces().label

    expect(
      new Set([withGaps, assessedEmpty, silent]).size,
      `withGaps="${withGaps}" assessedEmpty="${assessedEmpty}" silent="${silent}"`,
    ).toBe(3)
  })

  /**
   * THE MOUNTED ACCEPTANCE, in test form: the summary line and the gap cards
   * are ONE READER. Mutating the single source must move BOTH.
   *
   * Asserted as a PAIRED TRANSITION rather than two independent facts — either
   * assertion alone is satisfiable by a surface that is not reading the source
   * at all (it might simply never render, or always render).
   */
  it('ONE READER: mutating the single source moves the summary line and the gap cards together', () => {
    setStore({ silent: true })
    const before = readEvidenceSurfaces()
    document.body.innerHTML = ''
    setStore({ gaps: [WEAK_GAP] })
    const after = readEvidenceSurfaces()

    // Both surfaces moved, on the same mutation, in the same direction.
    expect(before.gapCardPresent, 'no gap card before the mutation').toBe(false)
    expect(after.gapCardPresent, `the gap card for "${GAP_FACTOR_LABEL}" must appear when the source gains a gap`).toBe(true)
    expect(before.label).toBe('Evidence not assessed')
    expect(after.label).toBe('Evidence gaps')

    // And the reverse direction, so neither surface is merely monotonic.
    document.body.innerHTML = ''
    setStore({ silent: true })
    const back = readEvidenceSurfaces()
    expect(back.gapCardPresent).toBe(false)
    expect(back.label).toBe('Evidence not assessed')
  })
})
