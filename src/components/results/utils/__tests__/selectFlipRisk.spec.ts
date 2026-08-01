/**
 * selectFlipRisk — RED-first from the WITNESSED staging payloads.
 *
 * Every number below is copied from a real capture, not invented:
 *   · witness-2267-raw/f-turn-2.json  (run 1) — 4 flip thresholds, ALL
 *     non-flipping; fragile edge `fac_leeds_activation` switch 0.4943. The
 *     screen said "Top flip risk: Leeds Site Activation Effectiveness" on a
 *     turn with zero flips.
 *   · witness-2267-raw/r3-turn-2.json (run 3) — 6 flip thresholds, ALL
 *     non-flipping; the chip printed "15% flip risk · Hybrid Delivery
 *     Approach" (switch 0.1485) while the hero said "Top flip risk: Vendor
 *     Platform Fit" (switch 0.314) — two statements, two factors, one screen.
 *   · witness-2265-raw/runB-66251a40-turn.json — flips ARE real
 *     (`fac_op_readiness`, flip_value 0.772182) and the only flipping factor
 *     is NOT the top fragile edge (`fac_launch_timing` 0.4125 outranks it).
 */

import { describe, it, expect } from 'vitest'
import { selectFlipRisk, classifyFlipEvidence } from '../selectFlipRisk'

// ── Witnessed fixtures ──────────────────────────────────────────────────────

/** witness-2267 run 1: every row `structurally_invariant` → flip_value null. */
const RUN1_ZERO_FLIP_THRESHOLDS = [
  { node_id: 'fac_bristol_activation', flip_value: null },
  { node_id: 'fac_capex', flip_value: null },
  { node_id: 'fac_demand_growth', flip_value: null },
  { node_id: 'fac_leeds_activation', flip_value: null },
]

/** witness-2267 run 1 fragile edges, grouped by from_id (max switch kept). */
const RUN1_CANDIDATES = [
  { label: 'Leeds Site Activation Effectiveness', switchProbability: 0.4942683749157114, joinId: 'fac_leeds_activation', targetId: 'fac_leeds_activation' },
  { label: 'Bristol Site Expansion Effectiveness', switchProbability: 0.3888634280476627, joinId: 'fac_bristol_activation', targetId: 'fac_bristol_activation' },
  { label: 'Capital Expenditure', switchProbability: 0.386, joinId: 'fac_capex', targetId: 'fac_capex' },
  { label: 'Demand Growth', switchProbability: 0.3411949685534591, joinId: 'fac_demand_growth', targetId: 'fac_demand_growth' },
]

/** witness-2267 run 3: 6 rows, all non-flipping. */
const RUN3_ZERO_FLIP_THRESHOLDS = [
  { node_id: 'fac_build_indicator', flip_value: null },
  { node_id: 'fac_buy_indicator', flip_value: null },
  { node_id: 'fac_eng_productivity', flip_value: null },
  { node_id: 'fac_hybrid_indicator', flip_value: null },
  { node_id: 'fac_req_change_rate', flip_value: null },
  { node_id: 'fac_vendor_fit', flip_value: null },
]

/**
 * witness-2265 run B: one real flip. `fac_op_readiness` flips at 0.772182 but
 * carries a LOWER switch probability than two factors that do not flip.
 */
const RUNB_FLIP_BEARING_THRESHOLDS = [
  { node_id: 'fac_capital_invest', flip_value: null },
  { node_id: 'fac_launch_timing', flip_value: null },
  { node_id: 'fac_local_demand', flip_value: null },
  { node_id: 'fac_op_readiness', flip_value: 0.772182 },
]

const RUNB_CANDIDATES = [
  { label: 'Launch Timing Urgency', switchProbability: 0.4125, joinId: 'fac_launch_timing', targetId: 'fac_launch_timing' },
  { label: 'Capital Investment Committed', switchProbability: 0.327, joinId: 'fac_capital_invest', targetId: 'fac_capital_invest' },
  { label: 'Operational Readiness', switchProbability: 0.24, joinId: 'fac_op_readiness', targetId: 'fac_op_readiness' },
]

// ── The honest-absence arm (ROADMAP 2.276, witness §4b / §10) ───────────────

describe('selectFlipRisk — honest absence on a zero-flip turn', () => {
  it('names NO flip risk when every producer flip threshold is non-flipping (witness run 1)', () => {
    const sel = selectFlipRisk(RUN1_ZERO_FLIP_THRESHOLDS, RUN1_CANDIDATES)

    expect(sel.evidence).toBe('flips_absent')
    expect(sel.mayNameFlipRisk).toBe(false)
    // The witnessed false positive, pinned by name.
    expect(sel.topFlipRisk).toBeNull()
  })

  it('withholds the percentage too — no number survives a zero-flip turn (witness run 3)', () => {
    const sel = selectFlipRisk(RUN3_ZERO_FLIP_THRESHOLDS, [
      // The row that produced the witnessed "15%".
      { label: 'Hybrid Delivery Approach', switchProbability: 0.1485, joinId: 'fac_hybrid_indicator' },
      { label: 'Vendor Platform Fit', switchProbability: 0.314, joinId: 'fac_vendor_fit' },
    ])

    expect(sel.mayNameFlipRisk).toBe(false)
    expect(sel.topFlipRisk).toBeNull()
  })

  it('one selector cannot produce two different answers for one turn', () => {
    // The witnessed contradiction: two surfaces, two factors, same payload.
    const heroPool = [{ label: 'Vendor Platform Fit', switchProbability: 0.314, joinId: 'fac_vendor_fit' }]
    const chipPool = [{ label: 'Hybrid Delivery Approach', switchProbability: 0.1485, joinId: 'fac_hybrid_indicator' }]

    const hero = selectFlipRisk(RUN3_ZERO_FLIP_THRESHOLDS, heroPool)
    const chip = selectFlipRisk(RUN3_ZERO_FLIP_THRESHOLDS, chipPool)

    expect(hero.topFlipRisk).toBeNull()
    expect(chip.topFlipRisk).toBeNull()
    expect(hero.mayNameFlipRisk).toBe(chip.mayNameFlipRisk)
  })
})

// ── The attribution arm (flips are real) ────────────────────────────────────

describe('selectFlipRisk — correct attribution when flips are real', () => {
  it('names the factor that ACTUALLY flips, not the top fragile edge (witness-2265 run B)', () => {
    const sel = selectFlipRisk(RUNB_FLIP_BEARING_THRESHOLDS, RUNB_CANDIDATES)

    expect(sel.evidence).toBe('flips_present')
    expect(sel.mayNameFlipRisk).toBe(true)
    // Launch Timing Urgency has the HIGHER switch probability (0.4125) and is
    // what the pre-fix selector named — but it does not flip.
    expect(sel.topFlipRisk?.label).toBe('Operational Readiness')
    expect(sel.topFlipRisk?.switchProbability).toBe(0.24)
  })

  it('renders the SAME metric it ranked by (no marginal-vs-switch mismatch)', () => {
    const sel = selectFlipRisk(RUNB_FLIP_BEARING_THRESHOLDS, RUNB_CANDIDATES)
    const named = RUNB_CANDIDATES.find((c) => c.label === sel.topFlipRisk?.label)
    expect(sel.topFlipRisk?.switchProbability).toBe(named?.switchProbability)
  })

  it('yields no named risk when the flipping factor is below the visibility floor', () => {
    const sel = selectFlipRisk(RUNB_FLIP_BEARING_THRESHOLDS, [
      { label: 'Launch Timing Urgency', switchProbability: 0.4125, joinId: 'fac_launch_timing' },
      { label: 'Operational Readiness', switchProbability: 0.15, joinId: 'fac_op_readiness' },
    ])
    // 0.15 is not > 0.15 (UI-SEM-013 floor), and no other candidate flips.
    expect(sel.topFlipRisk).toBeNull()
    expect(sel.mayNameFlipRisk).toBe(true)
  })
})

// ── Absence of evidence is not evidence of absence ──────────────────────────

describe('selectFlipRisk — legacy payloads are not silently blinded', () => {
  it('preserves switch-probability ranking when the producer sent no flip thresholds', () => {
    const sel = selectFlipRisk(undefined, RUN1_CANDIDATES)
    expect(sel.evidence).toBe('no_producer_flip_data')
    expect(sel.mayNameFlipRisk).toBe(true)
    expect(sel.topFlipRisk?.label).toBe('Leeds Site Activation Effectiveness')
  })

  it('treats an empty array as no data, not as a zero-flip attestation', () => {
    expect(classifyFlipEvidence([])).toBe('no_producer_flip_data')
  })

  it('does not read flip_reason — the UI union omits every value the producer sends', () => {
    // `structurally_invariant` is not in the UI FlipReason union; classification
    // must survive that skew by keying on flip_value alone.
    const sel = selectFlipRisk(
      [{ node_id: 'f1', flip_value: null }, { node_id: 'f2', flip_value: 0.5 }],
      [{ label: 'F2', switchProbability: 0.4, joinId: 'f2' }],
    )
    expect(sel.evidence).toBe('flips_present')
    expect(sel.topFlipRisk?.label).toBe('F2')
  })
})
