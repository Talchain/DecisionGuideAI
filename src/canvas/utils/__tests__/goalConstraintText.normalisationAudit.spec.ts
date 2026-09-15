/**
 * ⭐⭐⭐ WHEN THE PRODUCER HANDS US THE READER'S OWN FIGURE, WE RENDER IT.
 *
 * `provenance_unit_normalised` is the contract's audit trail for CEE's
 * percent→fraction rewrite (`@talchain/schemas@0.55.0`, `boundary/blocks.d.ts`):
 * *"Audit trail for the percent->fraction rewrite. Declared (rather than left to
 * passthrough) so the value is typed for consumers and cannot be silently
 * dropped by a future stricter pin."*
 *
 * `original_value` is the number the reader actually stated — **110, not 1.1**.
 *
 * ## Why this spec exists before the field is ever sent
 *
 * Nothing in this estate populates it yet (swept at 0.55.0: zero occurrences,
 * against a contrast control of 28 files for `source_quote`), and it was not even
 * DECLARED on our own `CEEGoalConstraint`, so it could not have been read if it
 * arrived. That is the estate's oldest failure — a producer starts sending
 * something and the consumer silently ignores it. This is the read path waiting,
 * with the ladder pinned, so the figure appears the moment CEE writes it.
 */
import { describe, it, expect } from 'vitest'
import { goalConstraintText } from '../goalConstraintText'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

/** The real shipped constraint from the `pricing-model` starter. */
const NRR: CEEGoalConstraint = {
  constraint_id: 'constraint_out_nrr_min',
  node_id: 'out_nrr',
  label: 'net revenue retention floor',
  operator: '>=',
  value: 1.1,
  unit: '%',
  source_quote: 'net revenue retention above 110%',
  provenance: 'explicit',
}

const WITH_AUDIT: CEEGoalConstraint = {
  ...NRR,
  provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 110, original_unit: '%' },
}

describe('the normalisation audit trail outranks every workaround', () => {
  it('⭐ renders the reader’s stated figure, not the rewritten one', () => {
    const t = goalConstraintText(WITH_AUDIT, [], { omitLabel: true })
    expect(t).toContain('110%')
    // ⛔ The discriminating half. 1.1% is what the wire value alone produces and
    // is a hundred times under the brief; it must not survive anywhere.
    expect(t).not.toContain('1.1')
  })

  it('⭐ and it outranks the QUOTE — a figure beats a sentence', () => {
    const t = goalConstraintText(WITH_AUDIT, [], { omitLabel: true })
    expect(t).toContain('≥ 110%')
    expect(t).not.toContain('net revenue retention above')
  })

  /**
   * ⛔ CONTRAST #1 — the ladder's lower rung is intact. Without the audit the
   * quote is still the honest answer, so this proves the new branch did not
   * simply replace the fallback.
   */
  it('⛔ CONTRAST: with NO audit, a percent limit still quotes the brief', () => {
    const t = goalConstraintText(NRR, [], { omitLabel: true })
    expect(t).toContain('net revenue retention above 110%')
    expect(t).not.toContain('≥ 110%')
  })

  /**
   * ⛔ CONTRAST #2 — bound to the AUDIT, not to "any percent constraint". A
   * hardcoded 110 would pass everything above.
   */
  it('⛔ CONTRAST: a different audited figure renders that figure', () => {
    const t = goalConstraintText(
      { ...NRR, value: 0.04, source_quote: 'keep churn under 4%',
        provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 4, original_unit: '%' } },
      [], { omitLabel: true },
    )
    expect(t).toContain('4%')
    expect(t).not.toContain('110')
  })

  /** The audit carries the unit too, so a currency rewrite renders as currency. */
  it('formats the audited figure in its own unit', () => {
    const t = goalConstraintText(
      { ...NRR, operator: '<=', unit: '£',
        provenance_unit_normalised: { rule: 'scaled', original_value: 200000, original_unit: '£' } },
      [], { omitLabel: true },
    )
    expect(t).toContain('£200,000')
  })

  /** Provenance still travels with the figure — an inferred limit says so. */
  it('keeps the provenance suffix on the audited path', () => {
    const t = goalConstraintText({ ...WITH_AUDIT, provenance: 'inferred' }, [], { omitLabel: true })
    expect(t).toContain('110%')
    expect(t).toContain('Inferred limit')
  })
})
