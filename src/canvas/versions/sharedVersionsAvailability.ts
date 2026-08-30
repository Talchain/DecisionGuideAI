/**
 * Can THIS reader restore from Version history?
 * British English: visualisation, colour, initialise.
 *
 * ── WHY THIS MODULE EXISTS (the false promise it closes) ─────────────────────
 * "Version history" is ONE panel holding TWO different objects, and only one of
 * them can be restored:
 *
 *   · the LOCAL list (`useModelVersions` → localStorage) — save, delete and
 *     compare. There is NO restore, deliberately: `WhatChangedPanel`'s own
 *     header records the rule that keeps it unbuilt, and a local canvas history
 *     entry has no canonical counterpart to return to.
 *   · the SHARED list (`ServerVersionsSection` → CEE `model_versions`) — this
 *     one restores, with a confirm, a server-side pre-restore snapshot and an
 *     "Undo restore".
 *
 * Measured on the deployed build `9308a30c`, driven as a guest, with controls
 * in the same read: `restoreBtns: []`, positive control `delete-version
 * buttons: 2`, `document.hidden: false`. A guest gets Save version · Delete
 * version · Compare two versions, and **no restore anywhere on the surface**.
 *
 * The undo-gesture notice (`useKeyboardShortcuts`) told every reader to "Check
 * Version history to restore an earlier version of this model" — true for a
 * reader who has the shared list, and a promise the product cannot keep for a
 * reader who has only the local one. This module is the ONE definition of which
 * reader is which, so the notice and the panel cannot drift apart (trap 12 —
 * derive, don't mirror; `ServerVersionsSection` imports its own gate from here
 * rather than keeping a second copy of the same regex).
 */

import { sanitiseUserId } from '../../lib/guestIdentity'

/**
 * A scenario CEE can address is a UUID (`scenarios.id` is a `uuid` column).
 *
 * ⚠ THE SOLE DEFINITION FOR THE VERSIONS SURFACE. `ServerVersionsSection` held
 * its own copy of this regex; it now imports this predicate. Do not reintroduce
 * a local one — a second copy is how the panel and the notice start disagreeing
 * about whether restore is on offer.
 */
const SCENARIO_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Is this scenario id one CEE can address? */
export function isScenarioServerAddressable(scenarioId: unknown): boolean {
  return typeof scenarioId === 'string' && SCENARIO_UUID_RE.test(scenarioId)
}

/** Is this a real (non-guest) identity? The shared list requires one. */
export function isRestoreCapableIdentity(userId: string | null | undefined): boolean {
  return sanitiseUserId(userId ?? null) !== null
}

export interface SharedVersionsAvailabilityInput {
  /**
   * Does this session have a server identity?
   *
   * ⚠ THE TWO CALLERS SUPPLY THIS FROM DIFFERENT SOURCES, AND THE DIVERGENCE IS
   * NAMED RATHER THAN PAPERED OVER (trap 21 — two questions under similar
   * names). `ServerVersionsSection` can call `useAuth()` and passes
   * `isRestoreCapableIdentity(user?.id)`. `useKeyboardShortcuts` cannot —
   * ~150 specs render canvas hooks without an `AuthProvider`, which is exactly
   * why `lib/persistenceSession` exists — so it passes
   * `isPersistenceSessionActive()`, i.e. `authenticated && !!user && user.id
   * !== 'guest'`.
   *
   * These agree in every real session. They diverge in ONE malformed state:
   * `authenticated === true` with a truthy `user` whose `id` is `''` or
   * absent — `isPersistenceActive` says true, `sanitiseUserId` says null. In
   * that state the notice would offer restore while the panel shows the
   * sign-in invitation. It is recorded here, unfixed, because narrowing
   * `lib/persistenceActive` is a change to a canonical predicate with many
   * consumers and is not this lane's to make. A real Supabase user always
   * carries a UUID id.
   */
  signedIn: boolean
  /** `useCanvasStore.getState().currentScenarioId` — the panel reads the same field. */
  scenarioId: unknown
}

/**
 * True only when the SHARED (restorable) half of Version history is on offer to
 * this reader — the same two conditions `ServerVersionsSection` uses to decide
 * between rendering its list and rendering nothing/the sign-in invitation.
 *
 * ⚠ THIS IS A CLAIM ABOUT THE CAPABILITY, NOT ABOUT A PARTICULAR RESTORE POINT.
 * The shared list can legitimately be EMPTY for a reader this returns `true`
 * for — no version has been minted yet, or the scenario was created unowned
 * (`scenarios.user_id` NULL), which mints no `model_versions` rows at all. The
 * panel is honest about that case in place ("No shared versions yet…"), which
 * is why the notice says *check*, never *your version is there*.
 */
export function canRestoreSharedVersions(input: SharedVersionsAvailabilityInput): boolean {
  return input.signedIn && isScenarioServerAddressable(input.scenarioId)
}
