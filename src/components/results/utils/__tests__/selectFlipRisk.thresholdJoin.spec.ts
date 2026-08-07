/**
 * ROADMAP 2.291 — `selectFlipRisk` publishes the JOINED flip-threshold row for
 * the factor it names, so the surface can state the factor's own flip evidence
 * (threshold, direction, alternative winner) instead of dressing an edge's
 * `switch_probability` up as "flip risk".
 *
 * The join lives HERE, in the owner, because the selector already builds the
 * flipping-ID set — a surface re-deriving "which row is my factor's" would be
 * a second chooser (the two-choosers defect this module exists to end).
 *
 * Additive only: evidence classification, the gate, the floor and the ranking
 * are #557's machinery and are untouched — its own spec
 * (`selectFlipRisk.spec.ts`) runs alongside this file.
 */

import { describe, it, expect } from 'vitest'
import { selectFlipRisk } from '../selectFlipRisk'

const CANDIDATES = [
  { label: 'Vendor Fit', switchProbability: 0.4, targetId: 'f1', joinId: 'f1' },
  { label: 'Adoption', switchProbability: 0.3, targetId: 'f2', joinId: 'f2' },
]

describe('selectFlipRisk — flip-threshold join (2.291)', () => {
  it('RED-first: on flips_present the named factor carries its OWN threshold row', () => {
    const thresholds = [
      { node_id: 'f2', flip_value: null, flip_reason: 'structurally_invariant' },
      {
        node_id: 'f1',
        flip_value: 4000,
        current_value: 2000,
        unit: '£',
        flip_reason: 'found',
        alternative_winner_label: 'Option B',
      },
    ]
    const selection = selectFlipRisk(thresholds, CANDIDATES)
    expect(selection.evidence).toBe('flips_present')
    expect(selection.topFlipRisk?.label).toBe('Vendor Fit')
    expect(selection.topFlipRisk?.flipThreshold).toEqual(thresholds[1])
  })

  it('joins the row that actually FLIPS when a node has several rows', () => {
    const attested = { node_id: 'f1', flip_value: null, flip_reason: 'no_effect_within_bounds' }
    const flipping = { node_id: 'f1', flip_value: 0.9, flip_reason: 'found' }
    const selection = selectFlipRisk([attested, flipping], CANDIDATES)
    expect(selection.topFlipRisk?.flipThreshold).toEqual(flipping)
  })

  it('no producer flip data → no fabricated threshold on the selection', () => {
    const selection = selectFlipRisk(undefined, CANDIDATES)
    expect(selection.evidence).toBe('no_producer_flip_data')
    expect(selection.topFlipRisk?.label).toBe('Vendor Fit')
    expect(selection.topFlipRisk?.flipThreshold).toBeUndefined()
  })

  it('POSITIVE CONTROL (#557 unchanged): flips_absent still names nothing', () => {
    const selection = selectFlipRisk(
      [{ node_id: 'f1', flip_value: null, flip_reason: 'structurally_invariant' }],
      CANDIDATES,
    )
    expect(selection.evidence).toBe('flips_absent')
    expect(selection.mayNameFlipRisk).toBe(false)
    expect(selection.topFlipRisk).toBeNull()
  })
})
