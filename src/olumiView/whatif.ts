/**
 * What-if on a copy (olumi-core API v1.9 `POST /api/scenarios/:s/whatif`): one figure as the person typed it, run by core's engine on a
 * copy of the version shown, with nothing saved and no AI call. Core answers with the copy's option rows in the View's own row shape and
 * its most likely line, so they are drawn by the same code as the real ones. The View never carries a what-if (core stores none), so the
 * last answer is held here while it is shown, and dropped once the View moves to another version. Saving the figure stays the edit route.
 */
import { create } from 'zustand'
import { call } from '../olumiCore/team/api'
import type { ViewRow } from './client'

export type WhatIfVariant = {
  hypothetical: true
  edits: { quantity: string; label: string; words: string }[]
  blocked: string | null
  stopped: string | null
  moved: boolean
  why_not: string | null
  rows: { option_id: string; rows: ViewRow[] }[]
  most_likely: { text: string; title: string } | null
  /** Core's numbered facts for this copy. A chance fact carries the number behind an option row's words, bound by option and aim ids
   *  (core 55c0c03f sends the what-if rows without `chance`; measured 10 Nov). Read only to place a mark, never to write a figure. */
  facts?: { id: string; about?: { kind: string; option?: string; goal?: string; chance?: number } }[]
  /** SCI-13 (core wip/science-size 7e998523, `### SCI-13 field`): for each live option and aim, what happens beside the chance, read over
   *  the same draws: core's sentence (`line`) and the numbers behind it. Only `line` is drawn, verbatim; the numbers are typed, never shown. */
  size?: WhatIfSize[]
}
export type WhatIfSize =
  | { option: string; goal: string; read: true; line: string
      chance: { before: number; after: number; status: 'separated' | 'unresolved' | 'same_on_draws' | 'exact_equal'; difference: number; precision_95: [number, number] | null; draws: number; differ: number | null }
      middle: { before: number; after: number; shift: number; shift_of_spread: number | null; beyond_cut: boolean; before_text: string; after_text: string }
      emphasis: 'both' | 'chance' | 'size' | 'none' }
  | { option: string; goal: string; read: false; reason: 'no_draws' | 'different_draws' | 'invalid_domain' | 'not_finite' | 'unordered' | 'no_outcome'; line: string }
export type WhatIfAnswer = { scenario: string; version: { id: number; n: number }; hypothetical: true; saved: false; variants: WhatIfVariant[] }

/** `typed`: the figure as the person typed it, drawn on its card while the What if lens is on (their words, never core's or ours). */
type Shown = { sid: string; base: number; quantity: string; typed: string; variant: WhatIfVariant }
export const useWhatIf = create<{ shown: Shown | null }>()(() => ({ shown: null }))
export const clearWhatIf = () => useWhatIf.setState({ shown: null })

/** Core's what-if for one figure, as typed, on version `base`; the answer replaces any what-if shown. Core's refusal is thrown as it says it. */
export async function tryWhatIf(sid: string, base: number, quantity: string, typed: string): Promise<void> {
  const a = await call<WhatIfAnswer>('POST', `/api/scenarios/${encodeURIComponent(sid)}/whatif`, { base, variants: [{ edits: [{ quantity, typed }] }] })
  const variant = a.variants[0]
  useWhatIf.setState({ shown: variant === undefined ? null : { sid, base, quantity, typed, variant } })
}
