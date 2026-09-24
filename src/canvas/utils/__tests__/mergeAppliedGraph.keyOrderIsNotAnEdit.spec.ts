/**
 * ⭐ KEY ORDER IS NOT AN EDIT (manual-edit proof D1 root cause, 24 Sep).
 *
 * Served witness, 5 of 5 across 2 starters: after a run, the agent lane's
 * readback came back with the SAME values and the keys of `observedState` /
 * `prior` in a different order (e.g. `distribution,range_min,range_max` →
 * `range_max,range_min,distribution` — shortest-key-first, the shape Postgres
 * `jsonb` stores). `sameValue` compared by plain `JSON.stringify`, so every such
 * node counted as UPDATED and the reconcile re-marked the model edited 28–39 ms
 * after the run had cleared it (and, by the same path, pushed an undo entry).
 *
 * The run-turn exemption in this PR stops the symptom on the run turn; this is
 * the comparison itself. Object keys are compared as a set; array order still
 * matters (it carries meaning, e.g. an ordered encoding map).
 */
import { describe, it, expect } from 'vitest'
import { overlayNode } from '../mergeAppliedGraph'
import { mapDraftNodeToCanvas } from '../applyDraftResult'

/** A CEE wire factor, as the agent lane's readback carries it. */
const wire = (observed_state: Record<string, unknown>, prior?: Record<string, unknown>) => ({
  id: 'fac_annual_cost',
  kind: 'factor',
  label: 'Annual cost',
  observed_state,
  ...(prior ? { prior } : {}),
})

/** The canvas node the app built from the first readback (the real mapper). */
const canvasFrom = (w: ReturnType<typeof wire>) => ({ ...mapDraftNodeToCanvas(w as never), position: { x: 0, y: 0 } })

describe('a readback that differs from the canvas only in key order is not an update', () => {
  it('⭐ same values, nested keys reordered (observed_state and prior) → the SAME node object comes back', () => {
    const existing = canvasFrom(wire(
      { value: 0.5, raw_value: 60000, unit: '£', source: 'cee_inference' },
      { distribution: 'normal', range_min: 0.25, range_max: 0.75 },
    ))
    const readback = wire(
      { unit: '£', value: 0.5, source: 'cee_inference', raw_value: 60000 },
      { range_max: 0.75, range_min: 0.25, distribution: 'normal' },
    )
    expect(overlayNode(existing, readback)).toBe(existing)
  })

  it('CONTRAST: a real value change is still an update', () => {
    const existing = canvasFrom(wire({ value: 0.5, raw_value: 60000, unit: '£' }))
    expect(overlayNode(existing, wire({ unit: '£', value: 0.6, raw_value: 72000 }))).not.toBe(existing)
  })

  it('CONTRAST: an identical readback (same order) is still a no-op', () => {
    const w = wire({ value: 0.5, raw_value: 60000, unit: '£' })
    const existing = canvasFrom(w)
    expect(overlayNode(existing, wire({ value: 0.5, raw_value: 60000, unit: '£' }))).toBe(existing)
  })
})
