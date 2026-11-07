/**
 * V11 change 6, a trustworthy change preview (Paul, 6 Nov): "'0–6% → 0–3% fewer orders' would display evidence does not support this change,
 * rather than an approval button." Core's verdict on a held proposal, requested of the DL 7 Nov (`proposal.verdict`, producer olumi-core
 * src/view/view.ts with the proposal): whether the evidence supports the change, core's words for it, and what would (`asks`). Undefined
 * from a core that does not send it, and the card then offers Approve as before.
 */
import type { View } from './client'

export type Verdict = { readonly supported: boolean; readonly text: string; readonly asks: string | null }

export function verdictOf(p: NonNullable<View['proposal']>): Verdict | undefined {
  const v = (p as { verdict?: unknown }).verdict as { supported?: unknown; text?: unknown; asks?: unknown } | null | undefined
  if (v == null || typeof v.supported !== 'boolean' || typeof v.text !== 'string' || v.text === '') return undefined
  return { supported: v.supported, text: v.text, asks: typeof v.asks === 'string' && v.asks !== '' ? v.asks : null }
}
