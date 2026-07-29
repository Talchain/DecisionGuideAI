/**
 * buildVoiRanking — the reader between `enrichment.factor_evppi` and the
 * V7 "Resolve next" view (V7-C slice 1, ROADMAP 2.141).
 *
 * These pins encode the design's §2 rendering-rules table at the MODEL level,
 * where every branch is reachable without a DOM. The render-level pins live in
 * `v7/__tests__/V7EvidenceDisclosure.resolveNext.spec.tsx`.
 *
 * NON-DEGENERATE BY CONSTRUCTION (ROADMAP 2.141 probe limit i — the live
 * rank-order pin was vacuous on a both-zeros run). The main fixture carries
 * three DISTINCT evppi values, a TIE PAIR, two below-resolution rows, and a
 * canvas factor deliberately ABSENT from the wire (the lever case). A fixture
 * whose order matches accidental iteration order proves nothing, so one pin
 * feeds a deliberately MIS-SORTED wire and asserts the reader preserves it.
 *
 * CLAIM TYPE: pure-function behaviour. No rendering, no wire claim.
 */

import { describe, it, expect } from 'vitest'
import { buildVoiRanking } from '../voiRanking'

/** The canvas this fixture's ids resolve against. `n_lever` exists on the
 * canvas but is deliberately ABSENT from the wire rows (ISL omits levers). */
const LABELS: Record<string, string> = {
  n_market: 'Market receptivity',
  n_comp: 'Competitor response',
  n_comp_eu: 'Competitor response (Europe)',
  n_reg: 'Regulatory timeline',
  n_hiring: 'Hiring pace',
  n_brand: 'Brand halo',
  n_lever: 'Discount depth',
}

function resolveLabel(factorId: string) {
  const label = LABELS[factorId]
  return label ? { label, canFocus: true } : null
}

/**
 * Producer wire order — `evppi` DESCENDING, exactly as ISL sorts it.
 * n_comp / n_comp_eu are the TIE pair (identical evppi, n_comp first on wire).
 */
function wireRows() {
  return [
    { factor_id: 'n_market', evppi: 0.91, status: 'resolved', units: 'outcome', method: 'regression_evppi_v1', noise_floor: 0.01 },
    { factor_id: 'n_comp', evppi: 0.44, status: 'resolved', units: 'outcome', method: 'regression_evppi_v1', noise_floor: 0.01 },
    { factor_id: 'n_comp_eu', evppi: 0.44, status: 'resolved', units: 'outcome', method: 'regression_evppi_v1', noise_floor: 0.01 },
    { factor_id: 'n_reg', evppi: 0.12, status: 'resolved', units: 'outcome', method: 'regression_evppi_v1', noise_floor: 0.01, clamped_high: true },
    { factor_id: 'n_hiring', evppi: 0.004, status: 'below_resolution', units: 'outcome', noise_floor: 0.01 },
    { factor_id: 'n_brand', evppi: 0, status: 'below_resolution', units: 'outcome', noise_floor: 0.01, clamped_low: true },
  ]
}

function build(rows: unknown, inferenceWarnings: unknown = undefined) {
  return buildVoiRanking({ rows, inferenceWarnings, resolveLabel })
}

describe('buildVoiRanking — the non-degenerate baseline', () => {
  it('POSITIVE CONTROL: the fixture is genuinely non-degenerate', () => {
    const rows = wireRows()
    const resolved = rows.filter(r => r.status === 'resolved')
    // ≥3 resolved rows with DISTINCT evppi values → a determinate order.
    expect(new Set(resolved.map(r => r.evppi)).size).toBeGreaterThanOrEqual(3)
    // A tie pair exists (so producer-order, not value-order, is what is tested).
    expect(resolved.filter(r => r.evppi === 0.44)).toHaveLength(2)
    // At least one below-resolution row exists.
    expect(rows.filter(r => r.status === 'below_resolution').length).toBeGreaterThan(0)
    // And a canvas factor is absent from the wire (the lever case).
    expect(rows.map(r => r.factor_id)).not.toContain('n_lever')
  })

  it('keeps producer wire order and separates resolved from below-resolution', () => {
    const m = build(wireRows())
    expect(m).not.toBeNull()
    expect(m!.resolved.map(r => r.label)).toEqual([
      'Market receptivity',
      'Competitor response',
      'Competitor response (Europe)',
      'Regulatory timeline',
    ])
    expect(m!.belowResolution.map(r => r.label)).toEqual(['Hiring pace', 'Brand halo'])
    expect(m!.someFactorsUnassessed).toBe(false)
  })

  it('a tie at ranks 2-3 keeps PRODUCER order, never a value re-sort', () => {
    const m = build(wireRows())
    expect(m!.resolved[1].label).toBe('Competitor response')
    expect(m!.resolved[2].label).toBe('Competitor response (Europe)')
  })

  it('preserves a MIS-SORTED wire verbatim — the UI never re-ranks', () => {
    // A deliberate producer-order violation. The producer's order is the
    // contract even when wrong: a UI that "fixes" order is a UI that can
    // invert it (design §7).
    const m = build([
      { factor_id: 'n_comp', evppi: 0.4, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.9, status: 'resolved' },
    ])
    expect(m!.resolved.map(r => r.label)).toEqual(['Competitor response', 'Market receptivity'])
  })

  it('never imputes a row for a factor ABSENT from the wire (absent ≠ zero)', () => {
    const m = build(wireRows())
    const everyLabel = [...m!.resolved, ...m!.belowResolution].map(r => r.label)
    expect(everyLabel).not.toContain('Discount depth')
    // …and the absence is silent: an omitted lever is intentional, not a gap.
    expect(m!.someFactorsUnassessed).toBe(false)
  })
})

describe('buildVoiRanking — the honest gate (degrade, never fabricate)', () => {
  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', []],
    ['not an array', { factor_id: 'n_market' }],
  ])('returns null when factor_evppi is %s', (_name, rows) => {
    expect(build(rows)).toBeNull()
  })

  it('returns null when every row fails validation (never an empty ranking)', () => {
    expect(build([{ factor_id: 'n_unknown', evppi: 0.5, status: 'resolved' }])).toBeNull()
  })

  it('falls back to the gate when the RANK-1 resolved row cannot be labelled', () => {
    // Never rank around a factor you cannot name (design §2, last row).
    const m = build([
      { factor_id: 'n_not_on_canvas', evppi: 0.9, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.5, status: 'resolved' },
    ])
    expect(m).toBeNull()
  })

  it('below-resolution rows ALONE still render (a demotion is honest data)', () => {
    const m = build([
      { factor_id: 'n_hiring', evppi: 0.004, status: 'below_resolution' },
    ])
    expect(m).not.toBeNull()
    expect(m!.resolved).toEqual([])
    expect(m!.belowResolution.map(r => r.label)).toEqual(['Hiring pace'])
  })
})

describe('buildVoiRanking — defensive row validation (drop, never coerce)', () => {
  it.each([
    ['factor_id non-string', { factor_id: 42, evppi: 0.5, status: 'resolved' }],
    ['factor_id empty', { factor_id: '', evppi: 0.5, status: 'resolved' }],
    ['evppi absent', { factor_id: 'n_comp', status: 'resolved' }],
    ['evppi null', { factor_id: 'n_comp', evppi: null, status: 'resolved' }],
    ['evppi NaN', { factor_id: 'n_comp', evppi: Number.NaN, status: 'resolved' }],
    ['evppi a string', { factor_id: 'n_comp', evppi: '0.5', status: 'resolved' }],
    ['status unknown', { factor_id: 'n_comp', evppi: 0.5, status: 'partially_resolved' }],
    ['status absent', { factor_id: 'n_comp', evppi: 0.5 }],
    ['row not an object', 'n_comp'],
    ['row null', null],
  ])('drops the row and discloses when %s', (_name, bad) => {
    const m = build([wireRows()[0], bad])
    expect(m!.resolved.map(r => r.label)).toEqual(['Market receptivity'])
    expect(m!.belowResolution).toEqual([])
    // A row we could not show is disclosed — never silently dropped.
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('drops an UNLABELABLE non-rank-1 row and discloses it', () => {
    const m = build([wireRows()[0], { factor_id: 'n_ghost', evppi: 0.2, status: 'resolved' }])
    expect(m!.resolved.map(r => r.label)).toEqual(['Market receptivity'])
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('never renders a raw id as a label', () => {
    const m = build([wireRows()[0], { factor_id: 'n_ghost', evppi: 0.2, status: 'resolved' }])
    const everyLabel = [...m!.resolved, ...m!.belowResolution].map(r => r.label)
    expect(everyLabel).not.toContain('n_ghost')
    expect(everyLabel.some(l => /^n_/.test(l))).toBe(false)
  })

  it('a clamped_low row is treated exactly as any below_resolution row', () => {
    const m = build(wireRows())
    expect(m!.belowResolution.map(r => r.factorId)).toContain('n_brand')
    expect(m!.resolved.map(r => r.factorId)).not.toContain('n_brand')
  })
})

describe('buildVoiRanking — the PARTIAL disclosure', () => {
  it('discloses when the producer sent FACTOR_EVPPI_PARTIAL', () => {
    const m = build(wireRows(), [
      { code: 'FACTOR_EVPPI_PARTIAL', message: 'some factors failed', severity: 'warning' },
    ])
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('does NOT disclose on an unrelated warning code', () => {
    const m = build(wireRows(), [{ code: 'SOMETHING_ELSE', severity: 'warning' }])
    expect(m!.someFactorsUnassessed).toBe(false)
  })

  it('reads the code out of a malformed warnings payload without throwing', () => {
    expect(build(wireRows(), 'not-an-array')!.someFactorsUnassessed).toBe(false)
    expect(build(wireRows(), [null, 7, { code: 'FACTOR_EVPPI_PARTIAL' }])!.someFactorsUnassessed).toBe(true)
  })

  it('the UNAVAILABLE code is the gate, not an error state', () => {
    // FACTOR_EVPPI_UNAVAILABLE arrives WITH an absent block — the gate branch.
    expect(build(undefined, [{ code: 'FACTOR_EVPPI_UNAVAILABLE' }])).toBeNull()
  })
})

describe('buildVoiRanking — what it deliberately does NOT carry', () => {
  it('carries no magnitude, unit, method, floor or clamp onto the model', () => {
    const m = build(wireRows())
    const serialised = JSON.stringify(m)
    for (const banned of ['evppi', 'noise_floor', 'units', 'outcome', 'method', 'regression', 'clamped', '0.91', '0.44']) {
      expect(serialised, `model must not carry ${banned}`).not.toContain(banned)
    }
  })

  it('POSITIVE CONTROL: that detector CAN see a magnitude when one is present', () => {
    // Trap 13 — the absence assertion above is vacuous unless the check fires
    // on a model that really does carry the number.
    const leaky = JSON.stringify({ ...build(wireRows()), evppi: 0.91 })
    expect(leaky).toContain('evppi')
    expect(leaky).toContain('0.91')
  })

  it('correlation_active never changes the model (EVPPI is honest under correlation)', () => {
    const plain = build(wireRows())
    const correlated = build(wireRows().map(r => ({ ...r, correlation_active: true })))
    expect(correlated).toEqual(plain)
  })
})
