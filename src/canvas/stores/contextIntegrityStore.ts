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

/**
 * ── WHY THERE IS NO `scenarioId` HERE ──────────────────────────────────────
 * There was one, and its comment claimed it "guards against a stale read from a
 * previous scenario being shown against the current one". It guarded nothing:
 * it was WRITE-ONLY. `serverGraphHydration` set it and no consumer ever read it
 * — `V7WhatIWasGivenSection` selects `briefText` and `manifest` and nothing
 * else. A field with zero readers cannot fork identity and cannot gate a
 * render, so its blast radius was zero by construction (CLAUDE.md trap 10),
 * and a comment asserting a guarantee nobody enforces is worse than no field:
 * the next reader trusts it and stops looking.
 *
 * The staleness question itself is real but is answered UPSTREAM, before this
 * store is written: `serverGraphHydration` compares the requested scenario
 * against `useCanvasStore.currentScenarioId` and returns `'skipped'` on a
 * mismatch, so a hydration for a scenario the user has left never reaches
 * `setContextIntegrity` at all. If that ever stops being true, the fix is a
 * guard with a reader and a test — not a field that records the answer and
 * throws it away.
 */
export interface ContextIntegrityState {
  /** The brief as the user wrote it, byte-verbatim. `null` = none persisted. */
  briefText: string | null
  /** CEE's manifest. `null` = we were told nothing. NEVER "nothing dropped". */
  manifest: NotModelledManifest | null
  setContextIntegrity: (input: {
    briefText: string | null
    manifest: NotModelledManifest | null
  }) => void
  reset: () => void
}

const EMPTY = {
  briefText: null,
  manifest: null,
} as const

export const useContextIntegrityStore = create<ContextIntegrityState>((set) => ({
  ...EMPTY,
  setContextIntegrity: ({ briefText, manifest }) => set({ briefText, manifest }),
  reset: () => set({ ...EMPTY }),
}))
