/**
 * V11 change 1, the evidence chain (Paul, 6 Nov): each piece of shared evidence is drawn on the cards it concerns, and opens in the dock as
 * a chain from what was seen to what the model uses. This file only READS core's View (`evidence[]`); it composes no words.
 *
 * Where a piece sits: on the card of each record it concerns (`concerns[]`, record ids), by the same rule as a revealed view's figure
 * (./reveal.ts cardOfQuantity: the record's own card, else the card whose badge holds it).
 *
 * The chain's steps are core's requested `evidence[].chain` (asked of the DL 7 Nov; producer olumi-core src/view/view.ts:693): absent
 * today, read here when present; until then the dock draws core's own fields (words, source, concerns, stance, `considered.why`).
 */
import type { View } from './client'
import { cardOfQuantity } from './reveal'

export type Evidence = View['evidence'][number]

/** A step of the requested chain: what was seen, the claim, the inference, the model estimate; each with core's words and status. */
export type ChainStep = { readonly level: 'observation' | 'claim' | 'inference' | 'estimate'; readonly text: string; readonly status: string | null; readonly card: string | null }
const LEVELS = new Set(['observation', 'claim', 'inference', 'estimate'])

/** Core's requested `chain` for a piece of evidence; null when core does not send it (or has not considered the evidence yet). */
export function chainOf(e: Evidence): readonly ChainStep[] | null {
  const c = (e as { chain?: unknown }).chain
  if (!Array.isArray(c) || c.length === 0) return null
  const steps = c.flatMap((x): ChainStep[] => {
    const y = (x ?? {}) as Record<string, unknown>
    if (typeof y.level !== 'string' || !LEVELS.has(y.level) || typeof y.text !== 'string' || y.text === '') return []
    return [{ level: y.level as ChainStep['level'], text: y.text, status: typeof y.status === 'string' && y.status !== '' ? y.status : null, card: typeof y.card === 'string' ? y.card : null }]
  })
  return steps.length === 0 ? null : steps
}

/** The cards a piece of evidence concerns, each once, in core's order; a record the canvas does not draw is left out. */
export function evidenceCards(view: View, e: Evidence): readonly string[] {
  const out: string[] = []
  for (const r of e.concerns) { const c = cardOfQuantity(view, r); if (c !== null && !out.includes(c)) out.push(c) }
  return out
}

/** The evidence drawn on one card, in core's order. None for a member core still holds (gated): as with the reveal, nothing of the team's is drawn on the board for them until they have given their own view. */
export function evidenceOn(view: View | null, card: string): readonly Evidence[] {
  if (view === null || view.gated || view.model == null) return []
  return view.evidence.filter((e) => evidenceCards(view, e).includes(card))
}
