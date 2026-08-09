/**
 * Context-Integrity Store — ROADMAP 2.973.
 *
 * Holds the two things needed to answer *"what did you keep, and what did you
 * leave out?"*: the user's ORIGINAL BRIEF as they wrote it, and CEE's
 * not-modelled manifest. Both arrive together on the cold read
 * (`POST /bff/cee/scenarios/:id/graph`) and are written here by
 * `serverGraphHydration`.
 *
 * ── WHY A STORE RATHER THAN A PROP ─────────────────────────────────────────
 * The cold read happens at canvas boot, in a hydration path; the surface that
 * shows this lives in the results panel, many levels away and mounted later.
 * Zustand is the house pattern for exactly that (see `guidanceStore`).
 *
 * ── THE INVARIANT ──────────────────────────────────────────────────────────
 * `manifest === null` means WE WERE TOLD NOTHING — the deployed CEE predates
 * the field, or its shape failed to validate at the adapter. It does NOT mean
 * "nothing was dropped". The initial state is also `null`, and those two are
 * deliberately the same value, because they warrant the same answer to the
 * user: *we cannot tell you.* Consumers must branch on `null` before reading
 * any tally.
 */
import { create } from 'zustand'

import type { NotModelledManifest } from '../../adapters/cee/notModelled'

export interface ContextIntegrityState {
  /** The brief as the user wrote it, byte-verbatim. `null` = none persisted. */
  briefText: string | null
  /** CEE's manifest. `null` = we were told nothing. NEVER "nothing dropped". */
  manifest: NotModelledManifest | null
  /** The scenario the two fields above describe. Guards against a stale read
   *  from a previous scenario being shown against the current one. */
  scenarioId: string | null
  setContextIntegrity: (input: {
    scenarioId: string
    briefText: string | null
    manifest: NotModelledManifest | null
  }) => void
  reset: () => void
}

const EMPTY = {
  briefText: null,
  manifest: null,
  scenarioId: null,
} as const

export const useContextIntegrityStore = create<ContextIntegrityState>((set) => ({
  ...EMPTY,
  setContextIntegrity: ({ scenarioId, briefText, manifest }) =>
    set({ scenarioId, briefText, manifest }),
  reset: () => set({ ...EMPTY }),
}))
