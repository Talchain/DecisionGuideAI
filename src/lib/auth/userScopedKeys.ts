/**
 * The browser storage that belongs to an authenticated user's reasoning work, and the sweep that removes it.
 *
 * A leaf on purpose: NO imports, so `main.tsx` can carry it in the main bundle. The lapse boundary runs before the app
 * renders and loads the full boundary (`userScopedState.clearUserScopedState`) as a chunk; when that chunk hangs past
 * its bound or fails to load, the boundary still sweeps with this (fails CLOSED; DL row LAPSE-FC after #2530). Both
 * paths call the one `sweepUserScopedStorage`, so the key lists cannot drift between them.
 */

/** Written by a signed-in page (`lapseBoundary.markSignedInHere`); removed only by the identity boundary's sweep. */
export const SIGNED_IN_HERE_KEY = 'olumi-signed-in-here.v1'

/** = `scenarios.IDENTITY_EPOCH_KEY` (CAN-F2w). Never swept: each boundary writes a fresh one FIRST. */
export const IDENTITY_EPOCH_STORAGE_KEY = 'olumi-canvas-identity-epoch'

export function freshIdentityEpoch(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** All browser state that belongs to an authenticated user's reasoning work. */
export const USER_SCOPED_STORAGE_KEYS = [
  'olumi-canvas-scenarios', 'olumi-canvas-autosave', 'olumi-canvas-current-scenario-id',
  'olumi-canvas-model-versions-v1', 'olumi-canvas-transcript',
  'defineSuccess.measure.v1', 'strengthen.lifecycle.v1', 'canvas-layout-options-v6',
  'canvas-layout-options-v5', 'canvas-layout-options-v4', 'olumi-cee-analysis-ready',
  'olumi-cee-analysis-ready-node-ids',
  // An unregistered import's node ids and edge pairs (`importRegistrationMarker.ts`): the previous identity's model shape.
  'olumi.import.pendingServerRegistration.v1',
  // Its sibling: which scenario's model CEE acknowledged (`importRegistrationMarker.ts`), keyed by the previous identity's
  // scenario id.
  'olumi.import.serverAcknowledged.v1',
  // Run history (`runHistory.ts`): whole reports and graph snapshots with no owner. Nothing writes it on the live path,
  // but entries from the retired Play path are still read by the palette, ShareDrawer and ReactFlowGraph's restore.
  'olumi-canvas-run-history',
  // "This browser was signed in" (`lapseBoundary.ts`): the boundary has now run, so the next guest boot is not a lapse.
  SIGNED_IN_HERE_KEY,
  // S-G: a guest id captured for the account that just ended (`lib/pendingGuestCopy.ts` v1; its v2 set and the guest-work
  // ledger are prefixes below). A lapse fires no SIGNED_OUT, so without these the NEXT person's sign-in would copy or be
  // offered the previous person's guest decisions (ACCOUNTS owner ruling, 2 Oct). A first sign-in (guest → A) is not a
  // boundary: the guest's own work reaches A's sign-in untouched. Literal: this leaf imports nothing; pinned to the owner.
  'olumi.pendingGuestCopy.v1',
] as const

// `olumi-canvas-autosave:` — a cold-load deep link's preserved copies (`scenarios.keyedAutosaveKey`): one per scenario,
// unbounded, and as private as the main slot above.
// `canvas-snapshot-` — manual snapshots (⌘S, Model ▸ Snapshots; `persist.saveSnapshot`) and their `-name` keys: whole
// graphs with labels, listed with no owner check (`persist.listSnapshots`), so the next account could restore one.
// `olumi.collab.pending-apply.` / `olumi.collab.open-round.` — a Panel round's pending model change and its participants,
// one per scenario (`collab/panelApplyHandoff.ts`, `collab/openRoundRecord.ts`).
// `olumi-thin-layout:` — a signed-in browser's layout, one per scenario (`thinClient.LAYOUT_KEY_PREFIX`): positions only,
// but keyed by node ids, and CEE derives node ids from labels (Acceptance, #2511 witness W2), so it names the model.
// `olumi.pendingGuestCopy.v2:` / `olumi.guestWork.v1:` / `olumi.guestWorkSeen.v1:` — S-G: guest decisions pending a copy,
// and offered, for the account that just ended (one key per decision; `lib/pendingGuestCopy.ts`, `lib/guestWork.ts`).
// `olumi-premortem-worksheet:` — P02: the last pre-mortem worksheet per scenario, restored after a reload of the same Run
// (`v5/readPremortemWorksheet.ts`); the stories and mitigations are the person's reasoning about their decision.
export const USER_SCOPED_STORAGE_PREFIXES = [
  'olumi.dissent.v2.', 'olumi.dissent.', 'olumi-canvas-autosave:', 'canvas-snapshot-',
  'olumi.collab.pending-apply.', 'olumi.collab.open-round.', 'olumi-thin-layout:',
  'olumi.pendingGuestCopy.v2:', 'olumi.guestWork.v1:', 'olumi.guestWorkSeen.v1:', 'olumi-premortem-worksheet:',
] as const

/**
 * Per-tab user work in sessionStorage (a same-tab reload keeps it): the analysis-ready mirror, the coaching blob
 * (`guidanceStore.ts`), the success measure (`successMeasureStore.ts`) and the Strengthen findings
 * (`strengthenStore.ts`). The full boundary also clears the last two through each store's `_reset`; the sweep must
 * name them itself, because the lapse fallback runs without those stores (Codex, #2534 r1 P1-1).
 */
export const USER_SCOPED_SESSION_KEYS = [
  'olumi-cee-analysis-ready', 'olumi-cee-analysis-ready-node-ids', 'guidance.items.v1',
  'defineSuccess.measure.v1', 'strengthen.lifecycle.v1',
] as const

/** Removes every user-scoped key, prefixed key and session key. Synchronous; never throws. */
export function sweepUserScopedStorage(): void {
  // Each removal on its own: one that throws never leaves the keys after it behind (browser storage can be unavailable).
  const remove = (storage: () => Storage, key: string): void => {
    try { storage().removeItem(key) } catch { /* the sweep goes on */ }
  }
  for (const key of USER_SCOPED_STORAGE_KEYS) remove(() => localStorage, key)
  // Enumerate first, then remove: a removal neither shifts the index nor stops the sweep.
  const prefixed: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && USER_SCOPED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) prefixed.push(key)
    }
  } catch { /* browser storage can be unavailable */ }
  for (const key of prefixed) remove(() => localStorage, key)
  for (const key of USER_SCOPED_SESSION_KEYS) remove(() => sessionStorage, key)
}
