/**
 * ⛔ CANVAS ASK A (#70 5851087722; Canonical owns it): an audited limit is edited in the READER'S units.
 *
 * SERVED: the pricing starter's Goal inspector read "Target 110%" above a limit input holding `>= 1.1` — the stored
 * ratio. Typing "110" there wrote a ratio of 110 (11,000%) into the model. The starter's limit is now the canonical
 * `unit: 'fraction'` + audit `{original_value: 110, original_unit: '%'}` (its own brief: "above 110%"), which the
 * formatter already reads as "≥ 110%", and the inspector edits the audited figure through the producer's own ratio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { auditedFigureOf, constraintWithEditedAuditedFigure, goalConstraintText } from '../goalConstraintText'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const starter = JSON.parse(readFileSync('src/canvas/starters/data/pricing-model.draft.json', 'utf8')) as { goal_constraints: CEEGoalConstraint[] }
const NRR = starter.goal_constraints.find((c) => c.constraint_id === 'constraint_out_nrr_min')!

describe('Canvas ask A — the pricing starter\'s NRR floor, in the reader\'s units', () => {
  it('RED: the starter states its limit canonically — a ratio labelled a fraction, with the brief\'s own 110%', () => {
    expect(NRR).toMatchObject({ value: 1.1, unit: 'fraction', provenance_unit_normalised: { original_value: 110, original_unit: '%' } })
    expect(goalConstraintText(NRR, [], { omitLabel: true })).toContain('≥ 110%')
  })

  it('RED: the inspector shows 110 %, never the stored ratio 1.1', () => {
    expect(auditedFigureOf(NRR)).toEqual({ value: 110, unit: '%' })
  })

  it('RED: editing to 105 writes the ratio 1.05 (not 105) and restates the audit for 105 — the card then reads ≥ 105%', () => {
    const edited = constraintWithEditedAuditedFigure(NRR, 105)!
    expect(edited.value).toBe(1.05)
    expect(edited.provenance_unit_normalised).toMatchObject({ original_value: 105, original_unit: '%' })
    expect((edited as { source_quote?: unknown }).source_quote).toBeUndefined()
    expect(goalConstraintText(edited, [], { omitLabel: true })).toContain('≥ 105%')
  })

  it('CONTRAST: a limit with no audit edits its raw value, as before (null → the old writer)', () => {
    const plain: CEEGoalConstraint = { constraint_id: 'c', node_id: 'n', operator: '<=', value: 4, unit: '%' }
    expect(auditedFigureOf(plain)).toBeNull()
    expect(constraintWithEditedAuditedFigure(plain, 5)).toBeNull()
  })
})
