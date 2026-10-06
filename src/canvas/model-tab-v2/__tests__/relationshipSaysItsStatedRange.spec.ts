/**
 * A4 — A SIZE THAT IS ONE END OF THE USER'S WRITTEN RANGE IS SAID WITH THAT RANGE, AS A BOUND.
 *
 * Paul's funding brief says investment firms "do deals between £1-2 million". CEE #2409 carries it as £1,000,000 per
 * deal on "Deals closed" → the £ goal: the user's size (`magnitude: 'user_stated'`), the LOW end of the range, and puts
 * the range on the edge (`provenance.natural_effect.stated_range` {low, high, text, end}). R3 C1 (#75 5918513716): the
 * reply AND the card say the range whenever they say £1m, never "£1m" alone as the user's figure; C2: the low end is a
 * floor ("at least"). AIQ 5919755441 condition 1: this card row lands with the served witness.
 *
 * Binding: WIRE → the real ingestion mapper (`mapDraftEdgeToCanvas`) → the real row projection (`toModelRows`).
 * DERIVED (labelled): the wire edge is CEE #2409's shape, read from its test at f201a8cf (not yet served).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { toModelRows, type ModelProjectionInput } from '../adapters'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'

const SOURCE_ID = 'deals_closed'
const TARGET_ID = 'securing_funding'

const NODES = [
  { id: SOURCE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Deals closed' } },
  { id: TARGET_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Securing funding' } },
] as unknown as Node[]

const RANGE_LOW = { low: 1000000, high: 2000000, text: '£1-2 million', end: 'low' }

function natural(amount: number, statedRange?: unknown): Record<string, unknown> {
  return {
    amount, amount_unit: '£', per_source_change: 1, per_source_change_unit: 'deals',
    strength_mean: 0.4, strength_mean_frame: 'edge_strength',
    ...(statedRange !== undefined ? { stated_range: statedRange } : {}),
  }
}

function wireEdge(provenance: Record<string, unknown>): Record<string, unknown> {
  return {
    from: SOURCE_ID, to: TARGET_ID, strength: { mean: 0.4, std: 0.2 }, exists_probability: 0.8,
    effect_direction: 'positive', provenance,
  }
}

function rowValue(wire: Record<string, unknown>): string | null {
  const data = mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>
  const input: ModelProjectionInput = {
    nodes: NODES,
    edges: [{ id: 'e1', source: SOURCE_ID, target: TARGET_ID, data }] as never,
    goalThreshold: null,
  }
  const row = toModelRows(input).find(r => r.kind === 'relationship')
  expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
  return row!.primaryValue
}

const users = (ne: Record<string, unknown>) => wireEdge({ source: 'cee_hypothesis', magnitude: 'user_stated', natural_effect: ne })

describe('A4: the user\'s size from one end of their range is said with the range, as a bound', () => {
  it('⭐ RED: £1,000,000 per deal, the low end of "£1-2 million" → "at least", with the range; never the amount alone', () => {
    expect(rowValue(users(natural(1000000, RANGE_LOW))))
      .toBe('Increase of at least £1,000,000 per 1 deal · the low end of your £1-2 million range')
  })

  it('the high end reads "at most", with the range', () => {
    expect(rowValue(users(natural(2000000, { ...RANGE_LOW, end: 'high' }))))
      .toBe('Increase of at most £2,000,000 per 1 deal · the high end of your £1-2 million range')
  })

  // CEE #2644 (Science d5 #87 6009282279): served T1b "would win about 150 new subscribers, between 80 and 250" carries
  // the user's POINT inside their range. Before this reader it failed the parse, and the whole size was dropped.
  it('⭐ RED: a centre is the user\'s point, said "about" WITH the range — never a bound, never dropped', () => {
    const centre = { low: 1500000, high: 2000000, text: 'between £1.5m and £2m', end: 'centre' }
    expect(rowValue(users(natural(1750000, centre))))
      .toBe('Increase of about £1,750,000 per 1 deal · your range, between £1.5m and £2m')
  })

  it('CONTROL: a centre never reads as a floor or a ceiling', () => {
    const centre = { low: 1500000, high: 2000000, text: 'between £1.5m and £2m', end: 'centre' }
    expect(rowValue(users(natural(1750000, centre)))).not.toMatch(/at least|at most|end of your/)
  })

  // Beat 1 (Paul, 4 Oct 2026: full provenance words on links): a user's single figure now says whose it is. This wire's
  // source is `cee_hypothesis`, not `brief_extraction`, so "your figure", never "from your brief".
  it('CONTROL: the user\'s single figure (no range on the wire) carries no range clause, only whose it is', () => {
    expect(rowValue(users(natural(1000000)))).toBe('Increase of about £1,000,000 per 1 deal · your figure')
  })

  it('a bound from the user\'s range never repeats whose it is: the range already says "your"', () => {
    expect(rowValue(users(natural(1000000, RANGE_LOW)))).not.toMatch(/your figure|from your brief/)
  })

  it('the link inspector says the range with the bound too (R3 C1: never "£1m" alone as the user\'s figure)', () => {
    const data = mapDraftEdgeToCanvas(users(natural(1000000, RANGE_LOW)), 0).data as Record<string, unknown>
    const size = edgeSizePhrase(data)
    expect(size?.usersFigure).toBe(true)
    expect(resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee', usersFigure: size })).toMatch(
      /^Your figure: increase of at least £1,000,000 per 1 deal · the low end of your £1-2 million range\. Olumi sized this link from it\./,
    )
  })

  it('CONTROL: Olumi\'s own size never carries the user\'s range, even if one arrives', () => {
    const olumi = wireEdge({ source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: natural(1000000, RANGE_LOW) })
    expect(rowValue(olumi)).toBe("Increase of about £1,000,000 per 1 deal · Olumi's estimate")
  })

  it('FAIL CLOSED: a range that is present but unreadable is never dropped into "your £1,000,000" — the band speaks', () => {
    const broken = rowValue(users(natural(1000000, { low: 1000000, high: 2000000, text: '£1-2 million' })))
    expect(broken).not.toContain('£1,000,000')
    const control = rowValue(users(natural(1000000, RANGE_LOW)))
    expect(control).toContain('£1,000,000')
  })

  it('STALE: once β moves, the range goes with the amount (the band speaks)', () => {
    const moved = { ...users(natural(1000000, RANGE_LOW)), strength: { mean: 0.6, std: 0.2 } }
    expect(rowValue(moved)).not.toContain('£1,000,000')
    expect(rowValue(moved)).not.toContain('range')
  })
})
