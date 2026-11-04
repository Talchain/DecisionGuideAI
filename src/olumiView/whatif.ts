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
}
export type WhatIfAnswer = { scenario: string; version: { id: number; n: number }; hypothetical: true; saved: false; variants: WhatIfVariant[] }

type Shown = { sid: string; base: number; quantity: string; variant: WhatIfVariant }
export const useWhatIf = create<{ shown: Shown | null }>()(() => ({ shown: null }))
export const clearWhatIf = () => useWhatIf.setState({ shown: null })

/** Core's what-if for one figure, as typed, on version `base`; the answer replaces any what-if shown. Core's refusal is thrown as it says it. */
export async function tryWhatIf(sid: string, base: number, quantity: string, typed: string): Promise<void> {
  const a = await call<WhatIfAnswer>('POST', `/api/scenarios/${encodeURIComponent(sid)}/whatif`, { base, variants: [{ edits: [{ quantity, typed }] }] })
  const variant = a.variants[0]
  useWhatIf.setState({ shown: variant === undefined ? null : { sid, base, quantity, variant } })
}
