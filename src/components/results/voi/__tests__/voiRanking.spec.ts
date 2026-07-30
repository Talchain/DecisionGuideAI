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
 * ⚠ A STRUCTURAL BLINDNESS THIS SUITE ONCE HAD (adversarial review of PR #531).
 * Every one of the ten defensive-validation cases below was written as
 * `build([wireRows()[0], bad])` — a VALID row always FIRST, the bad row always
 * SECOND. That shape cannot see what happens when the dropped row is the
 * producer's RANK 1, and a real defect lived in exactly that blind spot: the
 * validation `continue` ran before `sawFirstResolvedRow` was set, so a dropped
 * rank-1 silently promoted rank 2 into "Most worth resolving next". The table is
 * therefore run in BOTH POSITIONS now, and the position is asserted rather than
 * assumed (`POSITIONAL CONTROL`), so the class cannot go unpinned again.
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

  /**
   * THE VALIDATION SCOPE IS DELIBERATE, AND THIS IS THE PIN THAT SAYS SO.
   *
   * The reader validates rows against `EnrichmentFactorEvppiEntrySchema.pick({
   * factor_id, evppi, status })` — the three fields it READS — and not against the
   * full entry schema. A row whose UNREAD audit legs are mistyped (`units`,
   * `noise_floor`, `method`, `evppi_raw`, `n_samples`, the clamp booleans,
   * `correlation_active`) therefore still ranks: those fields never reach the DOM
   * and never affect order, so a producer typo in one of them must not cost the
   * user the ranking.
   *
   * ⚠ WHY THIS TEST EXISTS AT ALL. Swapping the `.pick` for the FULL schema passed
   * every committed test — adversarial review of PR #533 swapped it and got
   * voiRanking 55/55, resolveNext.honesty 10/10, resolveNext.spec 25/25 all green.
   * So the choice was held by a COMMENT, not by a test, and the fail-safe framing
   * hid how sharp the difference is: under the full schema this row is DROPPED,
   * and because it is rank 1, the reader's own rank-1 doctrine then collapses the
   * WHOLE ranking to the honest gate. A user loses the entire surface to a typo in
   * a field nobody displays.
   *
   * If a future lane decides that IS the right trade, this test is the place to
   * make that decision visible — it should be changed deliberately, not discovered.
   */
  it('a row with a MISTYPED UNREAD audit leg still ranks (the .pick scope, pinned)', () => {
    const m = build([
      // Every unread audit leg wrong-typed at once, on the RANK-1 row.
      {
        factor_id: 'n_market',
        evppi: 0.91,
        status: 'resolved',
        units: 9,
        noise_floor: 'x',
        method: 3,
        evppi_raw: 'x',
        n_samples: 'x',
        clamped_low: 'yes',
        clamped_high: 'no',
        correlation_active: 'x',
      },
      { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
    ])
    expect(m).not.toBeNull()
    expect(m!.resolved.map(r => r.label)).toEqual(['Market receptivity', 'Competitor response'])
    // Nothing was dropped, so nothing is disclosed as unassessed.
    expect(m!.someFactorsUnassessed).toBe(false)
    // …and the malformed values still reach neither the model nor a magnitude.
    expect(JSON.stringify(m)).not.toContain('noise_floor')
    expect(JSON.stringify(m)).not.toContain('0.91')
  })

  it('POSITIVE CONTROL: a mistyped READ field on that same row DOES drop it', () => {
    // Without this, the test above could be passing because the reader validates
    // nothing at all. The only difference here is that the broken field is one of
    // the three the reader reads — and a dropped rank-1 gates the whole ranking.
    expect(
      build([
        { factor_id: 'n_market', evppi: 'nope', status: 'resolved', units: 9 },
        { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
      ]),
    ).toBeNull()
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

/**
 * AMENDMENT A1 (adversarial review of PR #531, blocking — fabrication class).
 *
 * Two failure modes, ONE principle. Design §2's final row says the surface falls
 * back to the honest gate when the rank-1 resolved row cannot be NAMED — "never
 * rank around a factor you cannot name". The same reasoning governs a rank-1 row
 * we cannot READ: rows arrive sorted by `evppi` descending, so if the top row is
 * dropped, whatever survives first is rank 2 wearing rank 1's licensed sentence.
 *
 * This is reachable on a SCHEMA-VALID payload, which is what makes it a
 * fabrication risk rather than a malformed-input curiosity: `evppi` is
 * `z.number().optional()` at schemas 0.30.0, so `{factor_id, status:'resolved'}`
 * with no `evppi` passes every validator on the wire and is dropped here.
 */
describe('buildVoiRanking — a dropped RANK-1 row reaches the gate (A1)', () => {
  /** The ten defensive-validation payloads, reused in BOTH positions. */
  const BAD_ROWS: Array<[string, unknown]> = [
    ['factor_id non-string', { factor_id: 42, evppi: 0.5, status: 'resolved' }],
    ['factor_id empty', { factor_id: '', evppi: 0.5, status: 'resolved' }],
    ['evppi absent (SCHEMA-VALID on the wire)', { factor_id: 'n_comp', status: 'resolved' }],
    ['evppi null', { factor_id: 'n_comp', evppi: null, status: 'resolved' }],
    ['evppi NaN', { factor_id: 'n_comp', evppi: Number.NaN, status: 'resolved' }],
    ['evppi Infinity', { factor_id: 'n_comp', evppi: Number.POSITIVE_INFINITY, status: 'resolved' }],
    ['evppi a string', { factor_id: 'n_comp', evppi: '0.5', status: 'resolved' }],
    ['status unknown', { factor_id: 'n_comp', evppi: 0.5, status: 'partially_resolved' }],
    ['status absent', { factor_id: 'n_comp', evppi: 0.5 }],
    ['row not an object', 'n_comp'],
    ['row null', null],
  ]

  it('POSITIONAL CONTROL: the fixtures really do place the bad row FIRST', () => {
    // Without this the suite below could be re-running the old blind shape and
    // passing for the wrong reason. Assert the SHAPE, not just the verdict.
    for (const [, bad] of BAD_ROWS) {
      const rows = [bad, wireRows()[0]]
      expect(rows[0]).toBe(bad)
      expect(rows[1]).toEqual(wireRows()[0])
      // …and the trailing row is, on its own, a perfectly renderable ranking —
      // so a `null` below can only be caused by the bad row's POSITION.
      expect(build([wireRows()[0]])).not.toBeNull()
    }
  })

  it.each(BAD_ROWS)(
    'gates instead of promoting rank 2 when the FIRST row is dropped — %s',
    (_name, bad) => {
      expect(build([bad, wireRows()[0]])).toBeNull()
    },
  )

  it('the exact schema-valid payload from the review: rank-1 omits evppi', () => {
    // The reviewer's PROBE B. Before the fix this returned
    // resolved: [Competitor response, Regulatory timeline] with the FIRST of
    // those annotated "Most worth resolving next".
    const m = build([
      { factor_id: 'n_market', status: 'resolved' },
      { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
      { factor_id: 'n_reg', evppi: 0.12, status: 'resolved' },
    ])
    expect(m).toBeNull()
  })

  it('BOTH rank-1 failure modes agree — unnameable and unreadable', () => {
    const unnameable = build([
      { factor_id: 'n_not_on_canvas', evppi: 0.9, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.5, status: 'resolved' },
    ])
    const unreadable = build([
      { factor_id: 'n_market', status: 'resolved' },
      { factor_id: 'n_comp', evppi: 0.5, status: 'resolved' },
    ])
    expect(unnameable).toBeNull()
    expect(unreadable).toBeNull()
  })

  it('THE OTHER DIRECTION: a dropped rank-2 still ranks, and still discloses', () => {
    // The gate must not swallow a ranking whose rank 1 is intact — otherwise
    // A1 would have traded a fabrication for an over-suppression.
    const m = build([
      wireRows()[0],
      { factor_id: 'n_comp', status: 'resolved' },
      { factor_id: 'n_reg', evppi: 0.12, status: 'resolved' },
    ])
    expect(m).not.toBeNull()
    expect(m!.resolved.map((r) => r.label)).toEqual(['Market receptivity', 'Regulatory timeline'])
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('a dropped BELOW-RESOLUTION-only leader still gates (conservative, deliberate)', () => {
    // We cannot tell whether the lost row was a resolved one, so the ranking is
    // withheld rather than guessed. Pinned so the trade-off is visible, not
    // accidental.
    expect(build([{ factor_id: 'n_hiring', evppi: null }, wireRows()[4]])).toBeNull()
    // …whereas a clean all-below-resolution run is untouched by A1.
    const clean = build([wireRows()[4], wireRows()[5]])
    expect(clean!.resolved).toEqual([])
    expect(clean!.belowResolution.map((r) => r.label)).toEqual(['Hiring pace', 'Brand halo'])
  })

  it('a valid rank-1 followed by ANY number of drops keeps its rank', () => {
    const m = build([wireRows()[0], null, 'nope', { factor_id: 'n_comp' }, wireRows()[3]])
    expect(m!.resolved[0].label).toBe('Market receptivity')
    expect(m!.someFactorsUnassessed).toBe(true)
  })
})

/**
 * AMENDMENT B1 (adversarial review of PR #531).
 *
 * A repeated `factor_id` used to render the SAME factor at two ranks with
 * `someFactorsUnassessed: false` — the only payload in the adversarial family
 * that misrepresented SILENTLY. First occurrence wins (producer order untouched,
 * and under the descending sort the first occurrence is the higher-EVPPI one),
 * and the extra row is disclosed as the defensive-validation drop it is.
 */
describe('buildVoiRanking — a repeated factor_id is ONE factor (B1)', () => {
  it('renders the factor once and DISCLOSES the dropped duplicate', () => {
    const m = build([
      { factor_id: 'n_market', evppi: 5, status: 'resolved' },
      { factor_id: 'n_market', evppi: 4, status: 'resolved' },
    ])
    expect(m!.resolved.map((r) => r.label)).toEqual(['Market receptivity'])
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('keeps the FIRST occurrence, so producer rank order is untouched', () => {
    const m = build([
      { factor_id: 'n_market', evppi: 0.91, status: 'resolved' },
      { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.02, status: 'resolved' },
      { factor_id: 'n_reg', evppi: 0.12, status: 'resolved' },
    ])
    expect(m!.resolved.map((r) => r.label)).toEqual([
      'Market receptivity',
      'Competitor response',
      'Regulatory timeline',
    ])
    expect(m!.resolved.filter((r) => r.factorId === 'n_market')).toHaveLength(1)
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('dedupes ACROSS the two status groups — never one factor in both', () => {
    const m = build([
      { factor_id: 'n_market', evppi: 0.91, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.001, status: 'below_resolution' },
    ])
    expect(m!.resolved.map((r) => r.factorId)).toEqual(['n_market'])
    expect(m!.belowResolution).toEqual([])
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('a triple id collapses to one row', () => {
    const m = build([
      { factor_id: 'n_market', evppi: 3, status: 'resolved' },
      { factor_id: 'n_market', evppi: 2, status: 'resolved' },
      { factor_id: 'n_market', evppi: 1, status: 'resolved' },
    ])
    expect(m!.resolved).toHaveLength(1)
    expect(m!.someFactorsUnassessed).toBe(true)
  })

  it('POSITIVE CONTROL: two DISTINCT ids still produce two rows, undisclosed', () => {
    // Without this, the dedup could be collapsing everything and the tests
    // above would pass for the wrong reason.
    const m = build([
      { factor_id: 'n_market', evppi: 0.91, status: 'resolved' },
      { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
    ])
    expect(m!.resolved.map((r) => r.label)).toEqual(['Market receptivity', 'Competitor response'])
    expect(m!.someFactorsUnassessed).toBe(false)
  })

  it('a duplicate can never mask rank 1 (it always has a predecessor)', () => {
    const m = build([
      { factor_id: 'n_market', evppi: 0.91, status: 'resolved' },
      { factor_id: 'n_market', evppi: 0.9, status: 'resolved' },
      { factor_id: 'n_comp', evppi: 0.44, status: 'resolved' },
    ])
    expect(m).not.toBeNull()
    expect(m!.resolved[0].label).toBe('Market receptivity')
  })
})
