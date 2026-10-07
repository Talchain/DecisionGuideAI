/**
 * S-G slice 2 — WHICH PART OF THIS DECISION CAME FROM BEFORE THE USER SIGNED IN (lane SIGNIN-IMPORT, DL ruling (a), 7 Oct).
 *
 * At sign-in a guest's decision is COPIED into the account (`copy_guest_scenario`; CEE #2493). From v2 the copy carries
 * the guest's conversation, re-keyed to the copy, but never the guest's Run. So the open decision can hold replies that
 * quote figures from an analysis this decision does not have.
 *
 * ── HOW THE COPIED PART IS KNOWN, WITHOUT A NEW WIRE FIELD ───────────────────
 * The copy is a new `scenarios` row made at sign-in, with `source_scenario_id` set. The copied turns keep their own
 * `created_at`, which is earlier than the copy's: a decision's own turns are always written after its row exists. So
 * "a turn before the copy's `created_at`" is exactly "a turn from before you signed in". The owner load
 * (`useScenario.loadScenario`) reads the row and records it here, keyed by scenario id; the cold read's chat offer
 * (`serverGraphHydration`) and the Analysis/Model surfaces read it. A duplicate made by `duplicate_scenario` also has a
 * source, but carries no turns, so nothing in it reads as copied.
 *
 * In memory only, and keyed by scenario: another decision, or another account (RLS keeps a copy owner-only), never
 * matches it.
 */
import { create } from 'zustand'

export interface GuestCopyOrigin {
  readonly scenarioId: string
  /** The copy row's `created_at`: every turn before it came from the guest decision. */
  readonly copiedAt: string
  /** At least one copied reply quotes figures (set by the chat offer): the guest had an analysis this copy has not. */
  readonly earlierAnalysisCopied: boolean
}

interface GuestCopyOriginState {
  origin: GuestCopyOrigin | null
  /** The owner load: the row's own words. A row with no source, or no valid time, clears it. */
  recordScenarioRow: (row: { id: string; source_scenario_id?: string | null; created_at?: string | null }) => void
  noteEarlierAnalysisCopied: (scenarioId: string) => void
  reset: () => void
}

export const useGuestCopyOriginStore = create<GuestCopyOriginState>((set, get) => ({
  origin: null,
  recordScenarioRow: (row) => {
    const copiedAt = typeof row.created_at === 'string' && Number.isFinite(Date.parse(row.created_at)) ? row.created_at : null
    const isCopy = typeof row.source_scenario_id === 'string' && row.source_scenario_id.length > 0
    const prior = get().origin
    set({
      origin: isCopy && copiedAt !== null
        ? { scenarioId: row.id, copiedAt, earlierAnalysisCopied: prior?.scenarioId === row.id ? prior.earlierAnalysisCopied : false }
        : null,
    })
  },
  noteEarlierAnalysisCopied: (scenarioId) => {
    const origin = get().origin
    if (origin?.scenarioId === scenarioId && !origin.earlierAnalysisCopied) set({ origin: { ...origin, earlierAnalysisCopied: true } })
  },
  reset: () => set({ origin: null }),
}))

/** The copy time for THIS scenario, or null (not a copy, or not loaded yet). */
export function readGuestCopiedAt(scenarioId: string | null | undefined): string | null {
  const origin = useGuestCopyOriginStore.getState().origin
  return scenarioId && origin?.scenarioId === scenarioId ? origin.copiedAt : null
}

/** "Run again to see results here": this scenario is a guest copy whose copied replies quote an analysis it does not have. */
export function selectGuestCopyRunAgain(state: { origin: GuestCopyOrigin | null }, scenarioId: string | null | undefined): boolean {
  return !!scenarioId && state.origin?.scenarioId === scenarioId && state.origin.earlierAnalysisCopied
}

export const GUEST_COPY_RUN_AGAIN = 'Run again to see results here.'
