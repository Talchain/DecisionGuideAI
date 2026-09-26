/**
 * A RELATIONSHIP SAYS ITS SIZE IN THE TARGET'S OWN UNITS — never "Negligible"
 * for a real effect on a percentage.
 *
 * ## The defect (DL #70 5845676292)
 *
 * The Model tab's relationship row said the |β| band
 * (`model-tab/strengthBands.ts:44-48`). On a percentage target a real effect is
 * a small β: "AI cuts churn by 1 point at 4%" is β −0.01, and the row read
 * **"Negligible effect"**, so the user was told the effect he stated does not
 * matter.
 *
 * ## The contract (Model Generation, #70 5845713522)
 *
 * The producer persists the size it admitted on `edge.provenance`
 * (`magnitude` + `natural_effect`). The UI SAYS it; it never converts β itself.
 * Legacy edges keep the band. `provenance.source === 'user_specified'` reads as
 * the user's. The staleness key `strength_mean` is R&C's ask (#70 5845818897):
 * the amount describes ONE β, so a moved β must bring the band back.
 *
 * ## Binding
 *
 * Every row goes WIRE → the real ingestion mapper (`mapDraftEdgeToCanvas`) →
 * the real row projection (`toModelRows`), so the reader, the schema slot and
 * the phrase are exercised together. Every "the band speaks" row names the exact
 * band text AND a present control on the same wire with the natural effect.
 *
 * DERIVED (labelled): the wire edges are built to MG's posted contract. No
 * served producer carries `natural_effect` yet (MG PR1, gated on Paul).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { toModelRows, type ModelProjectionInput } from '../adapters'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { getDirectionalStrengthLabel } from '../../components/model-tab/strengthBands'
import { naturalEffectPhrase, readWireNaturalEffect, unitForAmount } from '../../domain/naturalEffect'
import { resolveEdgeDirectionDisplay } from '../../domain/edgeValueProvenance'

const SOURCE_ID = 'ai_feature_release'
const TARGET_ID = 'monthly_churn'

const NODES = [
  { id: SOURCE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'AI feature release' } },
  { id: TARGET_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn' } },
] as unknown as Node[]

/** Paul's edge: AI cuts churn by 1 point, at 4% churn → β −0.01. */
const CHURN_NATURAL = { amount: -1, unit: 'points of churn', per_source_change: 1, source_unit: 'switch', strength_mean: -0.01 }

function wireEdge(over: {
  mean?: number
  direction?: 'positive' | 'negative'
  provenance?: Record<string, unknown> | undefined
} = {}): Record<string, unknown> {
  return {
    from: SOURCE_ID,
    to: TARGET_ID,
    strength: { mean: over.mean ?? -0.01, std: 0.005 },
    exists_probability: 0.9,
    effect_direction: over.direction ?? 'negative',
    ...(over.provenance !== undefined ? { provenance: over.provenance } : {}),
  }
}

const OLUMI_ESTIMATE = { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: CHURN_NATURAL }

function rowValue(edgeData: Record<string, unknown>): string | null {
  const input: ModelProjectionInput = {
    nodes: NODES,
    edges: [{ id: 'e1', source: SOURCE_ID, target: TARGET_ID, data: edgeData }] as never,
    goalThreshold: null,
  }
  const row = toModelRows(input).find(r => r.kind === 'relationship')
  expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
  return row!.primaryValue
}

const ingest = (wire: Record<string, unknown>) => mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>

describe('the relationship row says the size in the target\'s own units', () => {
  it('⭐ RED: AI → churn, β −0.01 with a natural effect of −1 point → "Decrease of about 1 point of churn", never "Negligible effect"', () => {
    const data = ingest(wireEdge({ provenance: OLUMI_ESTIMATE }))
    // Present control: the band on its own DOES call this edge negligible — the defect.
    expect(getDirectionalStrengthLabel(-0.01, resolveEdgeDirectionDisplay(data))).toBe('Negligible effect')
    expect(rowValue(data)).toBe("Decrease of about 1 point of churn · Olumi's estimate")
  })

  it('CONTRAST (legacy): the SAME edge with no natural effect keeps today\'s band, unchanged', () => {
    const data = ingest(wireEdge({ provenance: { source: 'cee_hypothesis' } }))
    expect(data).not.toHaveProperty('naturalEffect')
    expect(rowValue(data)).toBe('Negligible effect')
    // …and with no provenance at all.
    expect(rowValue(ingest(wireEdge()))).toBe('Negligible effect')
  })

  it('STALE: once the β moves (a user edit), the old amount never speaks — the band for the NEW β does', () => {
    const data = ingest(wireEdge({ provenance: OLUMI_ESTIMATE }))
    expect(rowValue(data)).toBe("Decrease of about 1 point of churn · Olumi's estimate")
    const edited: Record<string, unknown> = { ...data, weight: 0.3, weightSource: 'user' }
    // The natural effect is still on the edge: only its key disagrees.
    expect(edited.naturalEffect).toBeDefined()
    expect(rowValue(edited)).toBe(getDirectionalStrengthLabel(-0.3, resolveEdgeDirectionDisplay(edited)))
    expect(rowValue(edited)).not.toMatch(/point of churn/)
  })

  it('a natural effect with no staleness key is not said (fail closed → the band)', () => {
    const { strength_mean: _k, ...unkeyed } = CHURN_NATURAL
    const data = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, natural_effect: unkeyed } }))
    expect(data).not.toHaveProperty('naturalEffect')
    expect(rowValue(data)).toBe('Negligible effect')
  })

  it('an amount whose sign contradicts the STATED direction is not said; the direction is never read off the sign', () => {
    const data = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, natural_effect: { ...CHURN_NATURAL, amount: 1 } } }))
    expect(data.naturalEffect).toBeDefined()
    expect(rowValue(data)).toBe('Negligible effect')
  })

  it('whose figure: a placeholder says so; the user\'s own (user_specified) carries no Olumi label', () => {
    const placeholder = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, magnitude: 'olumi_placeholder' } }))
    expect(rowValue(placeholder)).toBe('Decrease of about 1 point of churn · a placeholder, not an estimate')
    const users = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, source: 'user_specified' } }))
    expect(rowValue(users)).toBe('Decrease of about 1 point of churn')
    const stated = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, magnitude: 'user_stated' } }))
    expect(rowValue(stated)).toBe('Decrease of about 1 point of churn')
    // An unknown magnitude label is not a size we can attribute → the band.
    const unknown = ingest(wireEdge({ provenance: { ...OLUMI_ESTIMATE, magnitude: 'guess' } }))
    expect(rowValue(unknown)).toBe('Negligible effect')
  })

  it('a continuous source says what the change is per; a switch does not', () => {
    const perPound = ingest(wireEdge({
      mean: 0.2,
      direction: 'positive',
      provenance: {
        source: 'cee_hypothesis',
        magnitude: 'olumi_estimate',
        natural_effect: { amount: 5, unit: 'customers', per_source_change: 1, source_unit: '£', strength_mean: 0.2 },
      },
    }))
    expect(rowValue(perPound)).toBe("Increase of about 5 customers per £1 · Olumi's estimate")
  })
})

describe('the phrase helpers', () => {
  it('singular only for exactly one, only the first plain-plural word', () => {
    expect(unitForAmount(1, 'points of churn')).toBe('point of churn')
    expect(unitForAmount(2, 'points of churn')).toBe('points of churn')
    expect(unitForAmount(1, 'customers')).toBe('customer')
    expect(unitForAmount(1, 'GBP per month')).toBe('GBP per month')
    expect(unitForAmount(1, '£')).toBe('£')
    expect(unitForAmount(1, 'business')).toBe('business')
  })

  it('a zero amount is not an effect to phrase', () => {
    const effect = readWireNaturalEffect(wireEdge({ provenance: { ...OLUMI_ESTIMATE, natural_effect: { ...CHURN_NATURAL, amount: 0 } } }))
    expect(effect).toBeDefined()
    expect(naturalEffectPhrase(effect, -0.01, { show: true, direction: 'negative', source: 'cee' })).toBeNull()
  })
})
