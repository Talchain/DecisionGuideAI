/**
 * WHAT-IF ON THE CANVAS (slice 1): the one held change and its result. Session-only, never saved.
 *
 * Kept OUT of the canvas store on purpose, like the proposal ghost (`proposalGhostStore.ts`): nothing here enters
 * `nodes`/`edges`, so nothing can save, send in a turn, count or infer over a what-if. Its own store, not the ghost's, so
 * a conversation proposal and a what-if never overwrite or misattribute each other (Codex AMEND risk 3).
 *
 * A held change is bound to the model it was set up on (`scenarioId`, `baseGraphHash`). The key drops it when either
 * moves (`useWhatIfStaysOnItsModel`), and a result arriving for a press that is no longer current is never shown (`seq`).
 */
import { create } from 'zustand'

import type { WhatIfOutcome } from '../../adapters/cee/whatIf'

export interface HeldWhatIf {
  readonly scenarioId: string
  /** The saved model's analysis hash when the change was set up (null when CEE has not stamped one this session). */
  readonly baseGraphHash: string | null
  readonly nodeId: string
  readonly label: string
  /** The figure as the card shows it, in the factor's own unit. */
  readonly saved: number
  readonly whatIf: number
  readonly unit: string
  /** A goal's today level (sent on the goal's id in its target's unit), not a factor's value. */
  readonly level?: true
}

export type WhatIfRun = { readonly kind: 'idle' } | { readonly kind: 'running' } | { readonly kind: 'done'; readonly outcome: WhatIfOutcome }

interface WhatIfState {
  readonly held: HeldWhatIf | null
  readonly run: WhatIfRun
  /** Bumped by every hold, clear and press: a result is applied only while its press is still the current one. */
  readonly seq: number
  hold: (held: HeldWhatIf) => void
  clear: () => void
  /** Starts a press; returns its number, for `finish`. */
  start: () => number
  /** Shows a press's result, only if nothing has been held, cleared or pressed since. */
  finish: (seq: number, outcome: WhatIfOutcome) => void
}

const IDLE: WhatIfRun = { kind: 'idle' }

export const useWhatIfStore = create<WhatIfState>((set, get) => ({
  held: null,
  run: IDLE,
  seq: 0,
  hold: (held) => set((s) => ({ held, run: IDLE, seq: s.seq + 1 })),
  clear: () => { if (get().held !== null || get().run !== IDLE) set((s) => ({ held: null, run: IDLE, seq: s.seq + 1 })) },
  start: () => {
    const seq = get().seq + 1
    set({ run: { kind: 'running' }, seq })
    return seq
  },
  finish: (seq, outcome) => { if (get().seq === seq) set({ run: { kind: 'done', outcome } }) },
}))
