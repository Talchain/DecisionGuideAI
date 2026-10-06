/**
 * ⭐ D3 cut 6 HOLD-AT-1.0 — the canvas shows the existence the Run USES (DL 0df0e1: the UI is in scope, because the
 * inspector readout said "80%" and ConnRow "80% conf." for a link CEE holds at 1.0). Ingestion stamps `existenceHeld` from
 * the RAW wire edge (the ONE reader, every hop); `resolveEdgeValueDisplay(…, 'beliefExists')` is the chokepoint every
 * existence surface reads (readout, dash, summary row, hover, screen-reader name, key, model tab).
 */
import { describe, expect, it } from 'vitest'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeValueDisplay } from '../edgeValueProvenance'

const ne = (range?: { low: number; high: number }) => ({ amount: 20, amount_unit: 'customers', per_source_change: 1,
  per_source_change_unit: '£', strength_mean: 0.4, strength_mean_frame: 'edge_strength',
  ...(range ? { stated_range: { ...range, text: `${range.low} to ${range.high}`, end: 'low' } } : {}) })
const wire = (range?: { low: number; high: number }) => ({ id: 'e1', from: 'price', to: 'subs', strength: { mean: 0.4, std: 0.15 },
  exists_probability: 0.8, provenance: { source: 'user_specified', magnitude: 'user_stated', natural_effect: ne(range) } })

describe('a link CEE holds at 1.0 shows 100%, never Olumi\'s stored 0.8', () => {
  it('ingestion: a user link whose range excludes zero is stamped held; the same link with no range is not', () => {
    expect((mapDraftEdgeToCanvas(wire({ low: 20, high: 40 }), 0).data as Record<string, unknown>).existenceHeld).toBe(true)
    expect(mapDraftEdgeToCanvas(wire(), 0).data).not.toHaveProperty('existenceHeld')
    expect(mapDraftEdgeToCanvas(wire({ low: -5, high: 10 }), 0).data).not.toHaveProperty('existenceHeld')
  })
  it('the chokepoint: a held link displays 1 (CEE\'s); CONTRAST the unheld link displays its stored 0.8', () => {
    const held = mapDraftEdgeToCanvas(wire({ low: 20, high: 40 }), 0).data as Record<string, unknown>
    const unheld = mapDraftEdgeToCanvas(wire(), 0).data as Record<string, unknown>
    expect(resolveEdgeValueDisplay(held, 'beliefExists')).toEqual({ show: true, value: 1, source: 'cee' })
    expect(resolveEdgeValueDisplay(unheld, 'beliefExists')).toMatchObject({ show: true, value: 0.8 })
  })
  it('the stored value itself is never rewritten: the held edge still carries exists_probability 0.8 (nothing persists the hold)', () => {
    const held = mapDraftEdgeToCanvas(wire({ low: 20, high: 40 }), 0).data as Record<string, unknown>
    expect(held.exists_probability).toBe(0.8)
  })
})
