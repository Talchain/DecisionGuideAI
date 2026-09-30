/**
 * A relationship's size reads as a sentence a person would write, and the row lets it wrap (Panel, 30 Sep 2026).
 *
 * Served Model tab, Paul's funding brief at the 360 dock (`7fc20dff`, scenario `1b6d986f`):
 *   "Increase of about 1 conversations/month per 20 emails/m…"  ← cut at the panel edge, and "1 conversations"
 *   "Increase of about 1 introductions/month per 2,500 £/month"  ← "2,500 £/month", where the card says "£0 / month"
 *
 * Two defects:
 * - WORDS: `unitForAmount` singularised only whole words, so "conversations/month" stayed plural after 1, and a
 *   money-per-period unit fell through to "number, then unit".
 * - LAYOUT: the phrase carries digits, so the value cell (rightly) would not cut it, and with `whitespace-nowrap`
 *   it ran off the panel. The row now says the value is a SENTENCE (`valueIsSentence`, from the typed
 *   `naturalEffect` it came from) and only that value wraps.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { toModelRows, type ModelProjectionInput } from '../adapters'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { unitForAmount } from '../../domain/naturalEffect'

const EMAILS = 'fac_emails'
const CONVERSATIONS = 'out_conversations'
const SPEND = 'fac_spend'
const INTROS = 'fac_intros'

const NODES = [
  { id: EMAILS, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Investment-firm cold emails' } },
  { id: CONVERSATIONS, type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Institutional investor conversations' } },
  { id: SPEND, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Fundraising support spend' } },
  { id: INTROS, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Warm investor connections' } },
] as unknown as Node[]

function edge(from: string, to: string, mean: number, natural: Record<string, unknown> | null): Record<string, unknown> {
  return mapDraftEdgeToCanvas({
    from,
    to,
    strength: { mean, std: 0.05 },
    exists_probability: 0.8,
    effect_direction: 'positive',
    provenance: natural === null
      ? { source: 'cee_hypothesis' }
      : { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: { ...natural, strength_mean: mean, strength_mean_frame: 'edge_strength' } },
  }, 0).data as Record<string, unknown>
}

function relationship(data: Record<string, unknown>, from: string, to: string) {
  const input: ModelProjectionInput = { nodes: NODES, edges: [{ id: 'e1', source: from, target: to, data }] as never, goalThreshold: null }
  const row = toModelRows(input).find(r => r.kind === 'relationship')
  expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
  return row!
}

describe('the words: a unit after "1", and money per period', () => {
  it('a compound unit singularises the noun before the slash, only after 1', () => {
    expect(unitForAmount(1, 'conversations/month')).toBe('conversation/month')
    expect(unitForAmount(1, 'introductions/month')).toBe('introduction/month')
    expect(unitForAmount(20, 'emails/month')).toBe('emails/month')
    // CONTRASTS, unchanged: a bare symbol, a "per" phrase, a word ending in "ss".
    expect(unitForAmount(1, '£/month')).toBe('£/month')
    expect(unitForAmount(1, 'GBP per month')).toBe('GBP per month')
    expect(unitForAmount(1, 'business')).toBe('business')
    expect(unitForAmount(1, 'customers')).toBe('customer')
  })

  it('served row 1: "1 conversation/month per 20 emails/month", never "1 conversations/month"', () => {
    const row = relationship(edge(EMAILS, CONVERSATIONS, 0.3, {
      amount: 1, amount_unit: 'conversations/month', per_source_change: 20, per_source_change_unit: 'emails/month',
    }), EMAILS, CONVERSATIONS)
    expect(row.primaryValue).toBe("Increase of about 1 conversation/month per 20 emails/month · Olumi's estimate")
  })

  it('served row 3: money per period leads with the symbol, "per £2,500 / month", as the factor card writes "£0 / month"', () => {
    const row = relationship(edge(SPEND, INTROS, 0.4, {
      amount: 1, amount_unit: 'introductions/month', per_source_change: 2500, per_source_change_unit: '£/month',
    }), SPEND, INTROS)
    expect(row.primaryValue).toBe("Increase of about 1 introduction/month per £2,500 / month · Olumi's estimate")
    expect(row.primaryValue).not.toMatch(/\d £/)
  })
})

describe('the layout: the sentence is flagged, from the typed natural effect, never from the text', () => {
  it('a natural-effect value is a sentence (the cell wraps it)', () => {
    const row = relationship(edge(EMAILS, CONVERSATIONS, 0.3, {
      amount: 1, amount_unit: 'conversations/month', per_source_change: 20, per_source_change_unit: 'emails/month',
    }), EMAILS, CONVERSATIONS)
    expect(row.valueIsSentence).toBe(true)
  })

  it('CONTRAST: a band ("Moderate effect") is not flagged, so its no-wrap rule is unchanged', () => {
    const row = relationship(edge(EMAILS, CONVERSATIONS, 0.3, null), EMAILS, CONVERSATIONS)
    expect(row.primaryValue).not.toMatch(/per/)
    expect(row.valueIsSentence).toBeUndefined()
  })
})
