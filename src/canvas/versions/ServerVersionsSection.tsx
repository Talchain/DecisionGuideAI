/**
 * ServerVersionsSection — SHARED versions of this scenario's model.
 * British English: visualisation, colour, initialise.
 *
 * ── WHAT THIS IS, AND HOW IT DIFFERS FROM THE LOCAL HISTORY ─────────────────
 * The rest of this panel (#739) is BROWSER-LOCAL: capture + compare of the
 * canvas, localStorage, one device, honest about it. This section is the other
 * half: versions of the SERVER's shared model (`scenarios.graph` — the graph
 * every turn and every analysis is computed from), persisted by CEE in
 * `model_versions`, visible from ANY browser with access to the scenario, and
 * restorable. Two different objects, deliberately side by side:
 *   · a LOCAL version answers "what did I change on this canvas?";
 *   · a SHARED version is a durable state of the team's model itself.
 *
 * ── RESTORE, GUARDED TWICE ──────────────────────────────────────────────────
 * Restore overwrites the working model for everyone with access, so:
 *   1. the UI arms an explicit CONFIRM before calling the server (a mutant
 *      that skips the confirm REDs ServerVersionsSection.spec §PIN 1);
 *   2. the server snapshots the current state FIRST (provenance
 *      `pre_restore`) and names it in the response — rendered here as UNDO.
 * The apply path is `reconcileAppliedGraph` — the receipt-class reconcile
 * with authoritative deletion semantics and layout preservation — never a
 * second bespoke merge. Restores THEMSELVES are versions (the server appends,
 * history is never rewritten), which is why undo is just another restore.
 *
 * ── GUESTS ──────────────────────────────────────────────────────────────────
 * Server-side versions require sign-in (DB-level: guest scenarios cannot own
 * durable rows — CEE's D3 Branch A ruling). Guests see the honest invitation,
 * and their LOCAL history above keeps working exactly as before. No network
 * call is spent to learn what we already know.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, RotateCcw } from 'lucide-react'
import { PanelSection } from '../panels/_shared/PanelSection'
import { typography } from '../../styles/typography'
import { useAuth } from '../../contexts/AuthContext'
import { getSessionIdentity } from '../../lib/supabase'
import { useCanvasStore } from '../store'
import {
  listModelVersions,
  restoreModelVersion,
  saveModelVersion,
  type ServerModelVersion,
} from '../../adapters/cee/modelVersions'
import type { SignInRefusalCause } from '../../adapters/cee/signInRefusal'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { findRestoredInterventionMismatches } from './restoreInterventionAudit'
import { logger } from '../../lib/logger'
// ⚠ THE ADDRESSABILITY AND IDENTITY GATES ARE NOT DEFINED HERE ANY MORE.
// The undo-gesture notice must promise restore ONLY where this section will
// actually offer it, so both read the SAME definition. A local copy of the
// UUID regex is how the notice and the panel start disagreeing (trap 12).
import {
  isRestoreCapableIdentity,
  isScenarioServerAddressable,
} from './sharedVersionsAvailability'


/** Storage-scope disclosure — the shared counterpart of the local one. */
export const SERVER_VERSIONS_DISCLOSURE =
  'Shared versions are stored with the scenario. Anyone who can open this scenario can see and restore them, from any browser.'

/**
 * A fresh restore identity, one per GESTURE.
 *
 * ⚠ WHY FRESHNESS IS A SAFETY PROPERTY, NOT AN OPTIMISATION. CEE's restore RPC
 * resolves replay BEFORE the CAS and says so itself
 * (`20260824200000_c8_atomic_model_version_restore.sql:311-314`): "A successful
 * original call may legitimately be retried after later graph changes; it
 * returns the original operation receipt and performs no writes."
 *
 * So a REUSED id on a genuinely-new restore of the same version — restore v1,
 * edit, restore v1 again — returns HTTP 200, `restored: true` and a real
 * receipt WHILE THE SERVER'S WORKING GRAPH IS NEVER REVERTED. The wire cannot
 * tell: CEE computes `replayed` and only LOGS it, and the response schema is
 * `.strict()` without it. We would then reconcile the canvas to the old graph
 * and tell the user "the shared model and this canvas now show that version",
 * which would be false about the shared model. A fabricated success is worse
 * than the honest 422 this PR removes.
 *
 * DO NOT hoist this, memoise it per versionId, or derive it from
 * (scenarioId, versionId). The append path's `deterministicMutationId` is NOT
 * a precedent: there a `turn_id` already identifies the logical mutation, and
 * a restore gesture has no such pre-existing identity. Reuse is correct only
 * WITHIN one gesture, and there is no in-gesture retry to serve — `postOnce`
 * issues exactly one fetch. The user clicking Restore again is a NEW gesture
 * and must get a NEW id. If an automatic retry of a timed-out restore is ever
 * added, THAT retry reuses this id; nothing else ever does.
 *
 * Shape follows `conversation/systemEvents.ts:51-61` — the only UUID-valid
 * fallback in this tree. Deliberately NOT `utils/idempotency.ts`, whose
 * fallback returns `idk_<hex>_<hex>` and would fail CEE's `z.string().uuid()`,
 * reproducing this very defect somewhere far harder to see.
 */
function newRestoreMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * ── OUTCOME COPY ────────────────────────────────────────────────────────────
 * Every string here begins "Nothing was changed" because on every one of these
 * arms nothing was. The rule they exist to enforce: NO STRING MAY IMPLY A
 * RETRY WILL HELP WHERE THE FAILURE IS DETERMINISTIC. The old single default
 * ("The version could not be restored right now. Nothing was changed.") was
 * literally true and read as transient — it was the copy shown for three days
 * while restore was 100% broken by a contract skew no retry could clear.
 */

/** We hold no observed head, so we cannot state the CAS expectation. */
export const RESTORE_NO_KNOWN_HEAD =
  'Nothing was changed. Olumi cannot tell which state this shared model is in, so it will not replace it. Reload the page to see the current shared model and its versions.'

/**
 * The server restored, the apply ran, and the canvas STILL does not carry every
 * option value the restored graph states.
 *
 * This must never be reachable by the mechanism it was written for — a stale
 * `ceeAnalysisReady` overwriting the applied values — because `handleRestore`
 * now retires that snapshot before the apply. It stays because the check is a
 * POST-CONDITION, not a description of one bug: any future write that lands on
 * top of a restore lands here, loudly, instead of under a success message.
 *
 * The copy points at a reload deliberately and narrowly. A reload IS a real
 * recovery for this state — the restored graph is already committed
 * server-side, so a fresh load renders it — but it is a containment, not the
 * promise, which is why this arm does not claim the canvas was restored.
 */
export const RESTORE_CANVAS_VALUES_NOT_APPLIED =
  'Restored on the server, but this canvas did not take every value from that version. Reload the page to see the restored model. Please report this.'

/** A property of the STORED VERSION. Permanent for that version. */
export const RESTORE_VERSION_NOT_RESTORABLE =
  'That version cannot be restored: its stored model is empty or structurally invalid. Nothing was changed, and repeating this will not help. Restore a different version.'

/**
 * Our bytes were refused. `payloadRejected` and `mutationIdReused` stay
 * DISTINCT statuses — they are different diagnoses and are logged apart — but
 * they share this string because the user's question ("what can I do?") has
 * one honest answer: nothing, this is ours to fix. That is one question with
 * one answer, not two questions collapsed under one name.
 */
export const RESTORE_CLIENT_FAULT =
  'Nothing was changed. Olumi sent this server a request it rejected, so this is a fault in Olumi and not in your model. Repeating it will not help — please report it.'

/**
 * CEE told us the TOKEN was the problem (`sessionLapsed`). Its own words:
 * *"recovery is signing in"*. Worded for the whole arm — missing, invalid AND
 * expired — rather than for `expired_token` alone, because an invalid token is
 * not literally an ended session and the string must be true across every
 * `auth_reason` that reaches it.
 */
export const RESTORE_SESSION_ENDED =
  'Nothing was changed. Your session is no longer valid. Sign in again, then restore.'

/**
 * The refusal was NOT about our token. Either the scenario has no owner row
 * (MV001: `scenarios.user_id IS NULL` — a property of the SCENARIO, which is
 * why a fully signed-in user hits it), or Olumi cannot verify sign-ins at all
 * right now. Different diagnoses — they are classified apart and logged apart —
 * but the user's question ("what can I do?") has ONE honest answer on both:
 * nothing, this is ours. Same reasoning as `RESTORE_CLIENT_FAULT` above; one
 * question with one answer, not two questions collapsed under one name.
 *
 * ⚠ It must NOT say "sign in again" on either arm. On the unowned-scenario arm
 * the user is already signed in; on the unverifiable arm a fresh token fails to
 * verify exactly as the old one did, so the instruction would simply loop.
 *
 * ⚠⚠ "WHILE YOU ARE SIGNED IN" IS A CLAIM ABOUT THE CALLER, AND ONLY ONE OF
 *   THE TWO ARMS THAT SHARE THIS STRING CAN SUPPORT IT FROM THE WIRE. The
 *   unverifiable arm carries `validator: "user_jwt"`, which CEE reaches only
 *   when a token was presented — there the claim is a tautology and therefore
 *   safe. The unowned-scenario arm is the UPPER `SIGN_IN_REQUIRED`, whose body
 *   carries nothing about the caller at all, and a lapsed session reaches it
 *   guest-shaped. So this string is only ever selected once the CALLER's own
 *   identity has been consulted — see `signInRefusalCopy`.
 */
export const RESTORE_REFUSED_WHILE_SIGNED_IN =
  'Nothing was changed. The server refused this restore as signed-out while you are signed in — a fault in Olumi, not something a retry can fix.'

export const SAVE_SESSION_ENDED =
  'Nothing was saved. Your session is no longer valid. Sign in again, then save.'

export const SAVE_REFUSED_WHILE_SIGNED_IN =
  'Nothing was saved. The server refused this save as signed-out while you are signed in — a fault in Olumi, not something a retry can fix.'

/**
 * ⚠ THE OUTCOME IS GENUINELY UNKNOWN, AND SAYING SO IS THE ONLY HONEST MOVE.
 *
 * CEE commits graph + undo + version + head + event in ONE RPC
 * (`assist.v1.scenario-versions.ts:1181-1195`) and egress-validates AFTERWARDS:
 * `:1243-1253` parses the response and, on failure, returns `unavailable(…)` —
 * a 503 raised when the write has ALREADY COMMITTED. This client maps that to
 * `unavailable`. A transport timeout (`unusable`) has the same shape from here:
 * the server may have committed and the answer never arrived.
 *
 * The v2 receipt is `.strict()` and carries no replay signal, so the client
 * cannot recover the outcome — which is exactly why it must not assert one.
 * "Nothing was changed" on these arms is a false claim, and it is the dangerous
 * direction: read as transient, the user retries with a FRESH mutation id, the
 * server cannot see a replay, and a second restore buries their pre-restore
 * snapshot one version deeper.
 *
 * Under the no-hiding ruling, *"we could not confirm this — here is the current
 * state"* is legitimate. Refusing to guess is not the same as hiding, provided
 * we say so and then show the truth: this arm refreshes the list.
 */
export const RESTORE_OUTCOME_UNKNOWN =
  'Olumi could not confirm whether that restore completed, so it will not claim either way. The versions list has been refreshed to show the shared model as it now stands — check it before restoring again.'

/**
 * Did the request we are reporting on CARRY a signed-in identity?
 *
 * ⚠ THIS IS NOT A NEW IDENTITY PREDICATE, AND AS OF THIS COMMIT THAT IS TRUE BY
 * DELEGATION RATHER THAN BY ASSERTION. #965 wrote it as `sanitiseUserId(…) !==
 * null` and recorded the intent — *"when #961 lands `isRestoreCapableIdentity`,
 * both call sites move to it together"*. This is that move. What remains here is
 * a NAME for applying the one predicate to a DIFFERENT OBJECT: the identity we
 * actually sent on this request, rather than the `useAuth` value we rendered
 * with. Those two objects disagreeing is the whole subject of pin 8.
 *
 * ⚠ THE REBASE THAT PROMPTED THIS DID NOT CONFLICT. #965 added this function
 * and #961 removed the `sanitiseUserId` import in non-overlapping hunks, so git
 * merged them cleanly into a tree that does not compile (`TS2304`). No test
 * could see it — the specs that cover this file mock the module. It was caught
 * by running the required check's FULL step sequence rather than its tests.
 *
 * `getSessionIdentity` returns `{userId, accessToken}` both-or-neither
 * (`lib/supabase.ts:99-106`: a failed refresh yields `{null, null}`), so the id
 * and the token cannot disagree here and one of them is the whole question.
 */
function requestCarriedIdentity(identity: { userId: string | null }): boolean {
  return isRestoreCapableIdentity(identity.userId)
}

/**
 * The sign-in refusal's copy, chosen by the arm CEE ACTUALLY SENT — and, on the
 * ONE arm whose body cannot settle it, by the identity we actually sent.
 *
 * ⚠ THE TWO `user_jwt` ARMS NEVER CONSULT THE CLIENT, AND THE REASON IS NOT A
 * PREFERENCE. `sessionLapsed` and `signInUnverifiable` both carry
 * `validator: "user_jwt"`, which `resolveUserIdentity` reaches only when a JWT
 * candidate was PRESENTED — a token-less request resolves `service_legacy` and
 * is never refused there (`user-identity.ts:107-118`, CEE staging `f18d941b`).
 * So on those arms `userId !== null` is TRUE ON EVERY OCCURRENCE: a split on our
 * own session object would send 100% of `sessionLapsed` to the "a fault in
 * Olumi" copy — false, and it withholds the one remedy the producer names
 * (`buildSignInRequiredError`: *"recovery is signing in"*). There the client's
 * state is a tautology and the wire is the whole evidence.
 *
 * ⚠⚠ `scenarioUnowned` IS THE ARM WHERE THAT REASONING DOES NOT HOLD, AND
 *   ASSUMING IT DID SHIPPED THE MIRROR DEFECT. It is the UPPER
 *   `SIGN_IN_REQUIRED` (`assist.v1.scenario-versions.ts:462-473`), raised from
 *   SQLSTATE MV001 whose condition is `scenarios.user_id IS NULL` — a property
 *   of the SCENARIO. `preflightEnsureScenario` enforces ownership ONLY on an
 *   OWNED scenario, so an unowned one admits a token-less caller too, and BOTH
 *   of these reach this arm with byte-identical bodies:
 *
 *     · a fully signed-in user, on an unowned scenario   → "you are signed in"
 *     · a LAPSED session, on an unowned scenario         → "sign in again"
 *
 *   The response carries no field that tells them apart. Asserting either from
 *   the body alone is a confident claim on evidence that cannot support one —
 *   so this arm, and only this arm, reads the identity the request carried.
 *   That is not a third guess: it is the exact fact, held by the only party
 *   that has it.
 *
 * No `default`. The union is exhaustive, so a new cause is a COMPILE error
 * ("lacks ending return statement") rather than a silently mis-worded notice —
 * the fail-loud direction for a mapping that must never quietly widen.
 */
function signInRefusalCopy(
  cause: SignInRefusalCause,
  carriedIdentity: boolean,
  copy: { lapsed: string; olumiFault: string },
): string {
  switch (cause) {
    case 'sessionLapsed':
      return copy.lapsed
    case 'signInUnverifiable':
      return copy.olumiFault
    case 'scenarioUnowned':
      return carriedIdentity ? copy.olumiFault : copy.lapsed
  }
}

export const SERVER_VERSIONS_SIGNIN =
  'Sign in to save shared versions. Version history for the shared model is available when you are signed in; the local history above still works in this browser.'

/**
 * The v2 `creation.kind` union, hand-written from CEE's wire schema
 * (`orchestrator-v5/model-management/history-v2.ts:19-32`, `.strict()`
 * discriminated union) at staging `d0544243`, where the same six members are
 * declared FOUR times independently — DB CHECK constraint
 * (`20260824200000_c8_atomic_model_version_restore.sql:123-128`), TS union
 * (`model-management/types.ts:49-56`), Zod enum (`contracts.ts:128-137`) and
 * the wire schema itself.
 *
 * ⚠ THIS IS A HAND-MAINTAINED MIRROR AND THERE IS NO WAY TO DERIVE IT TODAY
 * (trap 12, stated rather than hidden): the pinned `@talchain/schemas` 0.48.0
 * does not carry the v2 creation union, so there is nothing to import. If CEE
 * adds a seventh kind, this list is short and the new kind falls to the
 * unrecognised path below — no badge, never a raw token, never a wrong label.
 * That is the fail-QUIET-to-the-user, fail-SAFE direction; it is not fail-loud
 * to us, and the honest deletion condition for this comment is the day the
 * shared package exports the union.
 */
export const SERVER_VERSION_CREATION_KINDS = [
  'initial',
  'committed_mutation',
  'restore',
  'variant_creation',
  'variant_promotion',
  'unknown',
] as const

/**
 * One shared version's origin, in the product's own words — never a wire token.
 *
 * ── WHY THIS IS NOT THE OLD SWITCH ──────────────────────────────────────────
 * This switched on the RETIRED v1 vocabulary (`user_save | commit |
 * pre_restore | restore`) long after the adapter moved to v2, and its `default`
 * returned the token VERBATIM — so a user read `committed_mutation`, `initial`
 * and `unknown` on screen. Exactly one v1 arm still worked, and only by
 * coincidence: `restore` is spelled the same in both vocabularies.
 *
 * v1 CANNOT REACH HERE ANY MORE, derived rather than assumed: `parseSummaryV2`
 * (`adapters/cee/modelVersions.ts:370`) is the SOLE constructor of
 * `ServerModelVersion` in this repo, and `listModelVersions` fails closed on
 * anything but `model_versions_list.v2` (same file, :462). So `user_save`,
 * `commit` and `pre_restore` are unreachable. `restore` is the contrast control
 * for that claim — it IS reachable, so the sweep was not simply blind.
 *
 * ── EVERY STRING BELOW IS DERIVED FROM THE PRODUCER, NOT FROM THE TOKEN NAME ─
 * (trap 13c: a mutant kit measures whether a test can DETECT a change, never
 * whether the EXPECTATION is right.) Per-token derivation, at CEE `d0544243`:
 *
 *  · `initial` / `committed_mutation` — the two arms of ONE `CASE` in
 *    `append_turn_atomic_v5` (migration :820-828): `initial` iff the scenario
 *    has no versions yet, else `committed_mutation`. The latter is inserted
 *    (:832-847) with `label='Committed model change'` and a `source_turn_id`,
 *    and `store-adapter.ts:335` reads it keyed by (source_turn_id,
 *    mutation_id) — it is what a committed TURN leaves behind, automatically.
 *
 *  · `restore` — `restore_model_version_atomic_v1` (:416-431) writes
 *    `creation_kind='restore'` with `source_version_id`; the graph was COPIED
 *    from an earlier version.
 *
 *  · `variant_creation` / `variant_promotion` — ⚠ NO PRODUCER EXISTS. Both
 *    appear 6 times each in CEE and every occurrence is a declaration site
 *    (CHECK constraint, validator, wire schema, TS union, contracts enum, and
 *    `summaryV2`'s pass-through case). Zero writes, zero RPC parameters;
 *    contrast control in the same sweep, the fabricated token
 *    `variant_rebase`, read 0 while both real tokens read 6. So their copy is
 *    CONTRACT-derived, not producer-derived, and says only what the contract
 *    guarantees: both arms REQUIRE a non-null `source_version_id`, so the
 *    version was made from an earlier one. They share one arm deliberately —
 *    splitting them would mean inventing "variant of…" / "promoted from…",
 *    naming a product feature that does not exist. Revisit when a producer
 *    lands; the grouping makes the shared copy visibly intentional rather than
 *    an accident two mutants could swap undetected.
 *
 *  · `unknown` — THREE genuinely different situations collapse here, and the
 *    copy is true of all three: (a) the pre-restore safety snapshot, written
 *    explicitly as `unknown` (:404-409); (b) ⭐ EVERY DELIBERATE USER SAVE —
 *    the save RPC `create_model_version` (migration
 *    `20260705120000_v5_model_versions.sql`) contains ZERO occurrences of
 *    `creation_kind`, so a save persists NULL and `summaryV2`'s `case null`
 *    resolves it to `unknown`; (c) genuine legacy rows, per the DB column's own
 *    comment, "NULL is legacy unknown". A label like "you saved this" would be
 *    FALSE for (a) and (c). What is true of all three is that the server did
 *    not record the mechanism.
 *
 * ── THE UNRECOGNISED CASE, AND WHY IT IS SILENCE ────────────────────────────
 * Returning the raw token is the defect. Inventing copy for a value we by
 * definition do not understand is worse. And reusing the `unknown` copy would
 * answer a DIFFERENT QUESTION under the same words (trap 21): "the server did
 * not record it" versus "we have no words for it" — here the server DID record
 * something, so "origin not recorded" would misreport a UI gap as a server gap.
 * Silence is the only thing that is true when there is nothing true to say.
 *
 * Silence is unambiguous *because* every emittable kind above returns a label:
 * under v1, no-badge meant "a deliberate save"; under v2 nothing maps to null
 * but the unrecognised path, so `null` now has exactly one meaning.
 */
export function provenanceLabel(provenance: string | null): string | null {
  switch (provenance) {
    case 'initial':
      return 'first version'
    case 'committed_mutation':
      return 'auto — saved on a model change'
    case 'restore':
      return 'restored from an earlier version'
    case 'variant_creation':
    case 'variant_promotion':
      return 'made from an earlier version'
    case 'unknown':
      return 'origin not recorded'
    default:
      return null
  }
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  try {
    return parsed.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return parsed.toISOString()
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; versions: ServerModelVersion[]; currentVersionId: string | null }
  | { kind: 'disabled' }
  | { kind: 'failed' }

export function ServerVersionsSection() {
  const { user } = useAuth()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  /** Row whose confirm is armed (pin 1) — id, never an index. */
  const [armedVersionId, setArmedVersionId] = useState<string | null>(null)
  /** One in-flight write at a time; buttons disable on it. */
  const [busy, setBusy] = useState(false)
  /** Honest, in-place outcome copy (conflicts, no-ops, partial restores). */
  const [message, setMessage] = useState<string | null>(null)
  /** The server-named pre-restore snapshot — restore it to undo. */
  const [undoVersionId, setUndoVersionId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const mountedRef = useRef(true)

  const userId = user?.id ?? null
  const signedIn = isRestoreCapableIdentity(userId)
  const addressable = isScenarioServerAddressable(scenarioId)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!addressable || !signedIn || typeof scenarioId !== 'string') return
    // Both fields from ONE read — see the note on `handleSave` below.
    const identity = await getSessionIdentity()
    const result = await listModelVersions(scenarioId, {
      userId: identity.userId,
      accessToken: identity.accessToken,
    })
    if (!mountedRef.current) return
    if (result.status === 'list') {
      setPhase({
        kind: 'ready',
        versions: result.versions,
        currentVersionId: result.currentVersionId,
      })
      return
    }
    if (result.status === 'disabled') {
      setPhase({ kind: 'disabled' })
      return
    }
    // notReadable / unavailable / refused / unusable: one honest retry state.
    // A failed read must never render as "no versions" — that would be an
    // empty claim about history we simply could not see.
    setPhase({ kind: 'failed' })
  }, [addressable, signedIn, scenarioId, userId])

  useEffect(() => {
    if (addressable && signedIn) {
      setPhase({ kind: 'loading' })
      void refresh()
    }
  }, [addressable, signedIn, refresh])

  // No server-addressable scenario ⇒ nothing to offer; the local history
  // above is the whole story. Rendering a dead section would be an
  // affordance that cannot keep its promise.
  if (!addressable) return null

  if (!signedIn) {
    return (
      <PanelSection title="Shared versions">
        <p
          className={`${typography.panelBody} text-text-light`}
          data-testid="server-versions-signin"
        >
          {SERVER_VERSIONS_SIGNIN}
        </p>
      </PanelSection>
    )
  }

  const handleSave = async () => {
    if (typeof scenarioId !== 'string') return
    setBusy(true)
    setMessage(null)
    const label = draftLabel.trim()
    // ⚠ BOTH FIELDS FROM ONE READ. These three handlers are user-initiated
    //    and have no AbortController and no cancellation, so the gap between
    //    the click and the request is the widest in this change: `userId` would
    //    be bound from the render closure while the token is read fresh.
    //
    //    VERIFIED at the dependency's bytes (@supabase/gotrue-js 2.62.2,
    //    `GoTrueClient.js:778-787`): `getSession()` compares
    //    `expires_at <= Date.now()/1000` and, when expired, performs a NETWORK
    //    REFRESH — so the token returned is fresh, never the stale one, and a
    //    refresh FAILURE yields `session: null`, i.e. a guest-shaped request
    //    with no headers rather than a 401-bait one.
    //
    //    ⚠ THE ONE CASE THAT CHECK DOES NOT COVER: the comparison is HARD, with
    //      no margin on this path (`EXPIRY_MARGIN` is referenced only in the
    //      background `_recoverAndRefresh`, not in `getSession()`), so a token
    //      expiring moments from now is returned as-is and can expire in
    //      flight. `autoRefreshToken: true` mitigates it in practice. No claim
    //      is made about the margin's VALUE — only about where it is and is
    //      not referenced.
    //
    //    Two of these three handlers are WRITES. Reading both fields from the
    //    same session object closes the mismatch window by construction.
    const identity = await getSessionIdentity()
    const result = await saveModelVersion(scenarioId, {
      userId: identity.userId,
      accessToken: identity.accessToken,
      ...(label.length > 0 ? { label } : {}),
    })
    if (!mountedRef.current) return
    setBusy(false)
    switch (result.status) {
      case 'saved':
        setDraftLabel('')
        if (result.version.deduped) {
          setMessage('This state is already the latest shared version — nothing new to save.')
        }
        await refresh()
        return
      case 'nothingToSave':
        setMessage('There is no model content to version yet. Add to your model, then save.')
        return
      case 'signInRequired':
        // Same split as the restore arm, and for the same reason: on the arms
        // CEE sends when the TOKEN failed, `identity.userId` is non-null by
        // construction, so branching on it would blame Olumi every time — while
        // on `scenarioUnowned` it is the only thing that CAN tell a lapsed
        // session from a signed-in one.
        setMessage(
          signInRefusalCopy(result.cause, requestCarriedIdentity(identity), {
            lapsed: SAVE_SESSION_ENDED,
            olumiFault: SAVE_REFUSED_WHILE_SIGNED_IN,
          }),
        )
        return
      // THE 404/403 ARM A LAPSED SESSION ACTUALLY REACHES, and the reason this
      // case exists at all. A token-less request on an OWNED scenario resolves
      // `service_legacy`, fails `preflightEnsureScenario` with
      // `scenario_requires_authenticated_owner`, and is answered by the route's
      // family `refuse()` — a 404, not the 401 above. Since most scenarios have
      // an owner, that is the COMMON lapsed path, and "Try again" on it invites
      // a retry that cannot succeed. For everyone else this arm is unchanged.
      case 'notReadable':
      case 'refused':
        setMessage(
          requestCarriedIdentity(identity)
            ? 'The version could not be saved right now. Try again.'
            : SAVE_SESSION_ENDED,
        )
        return
      case 'conflict':
        setMessage('The model changed since you last loaded it. Refresh and try again.')
        await refresh()
        return
      case 'disabled':
        setPhase({ kind: 'disabled' })
        return
      default:
        setMessage('The version could not be saved right now. Try again.')
        return
    }
  }

  const handleRestore = async (versionId: string) => {
    if (typeof scenarioId !== 'string' || phase.kind !== 'ready') return

    // The CAS expectation is the CURRENT head's identity hash — the state the
    // list showed the user. The server chains it through its own pre-restore
    // snapshot, so a concurrent change fails loudly instead of silently losing.
    const head =
      phase.versions.find((v) => v.id === phase.currentVersionId) ?? phase.versions[0]

    setArmedVersionId(null)

    // ⚠ NO HEAD ⇒ NO CALL. We must send `expected_graph_identity_hash`, and
    // `null` is NOT an opt-out: CEE's CAS is `IS DISTINCT FROM`, so null
    // ASSERTS "this model is currently empty" and 409s when it is not — which
    // this panel would then render as "the model changed since you looked",
    // a false statement about a model that did not change. Omitting the key
    // is worse still: that is the 422 this PR exists to fix. With nothing
    // observed we can make no claim, so we refuse and say so. (Reachable only
    // when an undo is offered while the refreshed list came back empty; the
    // undo target still exists server-side, which is why the copy points at a
    // reload rather than declaring it lost.)
    if (head === undefined) {
      logger.warn('server_versions.restore_refused_no_known_head', { scenarioId, versionId })
      setMessage(RESTORE_NO_KNOWN_HEAD)
      return
    }

    setBusy(true)
    setMessage(null)

    // Fresh, per gesture. See `newRestoreMutationId` for why this must not be
    // hoisted, memoised or derived.
    const mutationId = newRestoreMutationId()
    // Both fields from ONE read — see the note on `handleSave`.
    const identity = await getSessionIdentity()
    const result = await restoreModelVersion(scenarioId, {
      userId: identity.userId,
      accessToken: identity.accessToken,
      versionId,
      mutationId,
      expectedGraphIdentityHash: head.graphIdentityHash,
    })
    if (!mountedRef.current) return
    setBusy(false)

    switch (result.status) {
      case 'restored': {
        // ⚠⚠ RETIRE THE PRE-RESTORE READY SNAPSHOT **BEFORE** THE APPLY. THIS
        // ORDERING IS THE FIX; AFTER THE APPLY IS TOO LATE.
        //
        // `reconcileAppliedGraph` commits the restored graph and then, still
        // inside itself (`mergeAppliedGraph.ts:746-749`), reads the CURRENT
        // store `ceeAnalysisReady` and calls
        // `backfillInterventionsOntoOptionNodes`. That backfill REPLACES a
        // differing interventions map rather than filling gaps
        // (`applyDraftResult.ts:569-594` → `batchUpdateNodes` at `:609`). On a
        // restore the snapshot still in the store came from a turn BEFORE the
        // restore, so it describes the model the user has just replaced — and
        // it wins. Measured on the deployed build (UI 138d9560): two real
        // mounted-store transitions 3ms apart, `0.2 → restored 0.7` through the
        // reconcile's setState, then `0.7 → 0.2` back through
        // `batchUpdateNodes`, while the panel reported success.
        //
        // WHY INVALIDATE RATHER THAN SUPPLY A MATCHING SNAPSHOT. Both of the
        // obvious sources fail, and the second fails dangerously:
        //   · the response's top-level `analysis_state` carries `run_state`,
        //     `readiness`, `leader_claim`, `requires_rerun` … and NO
        //     `options[]` at all, so it cannot express a ready snapshot;
        //   · `graph.analysis_ready` DOES carry `options[].interventions` — and
        //     CONTRADICTS the restored nodes. On the capture behind this fix,
        //     option 70180763 is `0.3 user_specified` at the node root and
        //     `0.7 cee_hypothesis` in the embedded `analysis_ready`. Adopting
        //     it would have overwritten the restored value with a different
        //     wrong one and called that a matching snapshot. The reconcile
        //     already strips it (`mergeAppliedGraph.ts:179`).
        // So the honest state after a restore is "no ready snapshot", not a
        // fabricated one. That is also what the server itself says on this very
        // response: `run_state.kind = 'complete_stale'`, `requires_rerun: true`.
        //
        // The canonical setter, not a raw `setState`: its null branch clears
        // the readiness fields AND removes the `olumi-cee-analysis-ready`
        // sessionStorage keys, so a reload cannot rehydrate the stale snapshot
        // and replay this on the cold path (`store.ts:4997-5004`).
        //
        // SCOPE — this is the RESTORE path only, deliberately. The reconcile's
        // other caller (`useConversation.ts:4516`, the applied-edit receipt)
        // gets its `ceeAnalysisReady` from the SAME turn, so its backfill is
        // legitimate and load-bearing (a newly added option node needs
        // `data.interventions` mirrored onto it). Restore is the only caller
        // whose graph and whose ready snapshot come from different responses.
        // Nothing is deleted or weakened for the other callers.
        useCanvasStore.getState().setCeeAnalysisReady(null)

        // The receipt-class apply: adds + updates + deletions in one history
        // entry, layout preserved, removals gated on acknowledged elements.
        const applied = reconcileAppliedGraph(
          // The restore payload carries only `graph`; the reconcile reads
          // `.graph.nodes/.graph.edges` on exactly this shape.
          { graph: result.graph } as unknown as Parameters<typeof reconcileAppliedGraph>[0],
        )

        // The success claim is EARNED, not assumed. The counts below say the
        // apply DID something; only this says it did the right thing, and it is
        // the only check that can observe a write landing on top of the apply.
        const mismatches = findRestoredInterventionMismatches(
          result.graph,
          useCanvasStore.getState().nodes,
        )
        const changedNothing =
          applied.addedNodeCount === 0 &&
          applied.addedEdgeCount === 0 &&
          applied.updatedNodeCount === 0 &&
          applied.updatedEdgeCount === 0 &&
          applied.removedNodeCount === 0 &&
          applied.removedEdgeCount === 0
        setUndoVersionId(result.undoVersionId)
        if (mismatches.length > 0) {
          // FIRST, ahead of every other arm including `deduped`: if the canvas
          // does not carry the restored values, no other sentence about this
          // restore is safe to print. A deduped restore whose values disagree
          // is not "nothing changed" — it is the same failure with a calmer
          // face.
          logger.warn('server_versions.restore_values_not_applied', {
            scenarioId,
            mismatchCount: mismatches.length,
            // Ids and numbers only — no labels, no user prose.
            sample: mismatches.slice(0, 5).map((m) => ({
              optionId: m.optionId,
              targetNodeId: m.targetNodeId,
              restored: m.restored,
              onCanvas: m.onCanvas,
              missingFromCanvas: m.missingFromCanvas,
            })),
          })
          setMessage(RESTORE_CANVAS_VALUES_NOT_APPLIED)
        } else if (result.deduped) {
          setMessage('The model is already at that version — nothing changed.')
        } else if (changedNothing) {
          // Honest about ambiguity: the server restored, but the canvas
          // reconcile reported no change (it may have refused an unrelated
          // graph, or the canvas already matched). Never claim silently.
          setMessage(
            'Restored on the server. If the canvas looks unchanged, reload the page to see the restored model.',
          )
          logger.warn('server_versions.restore_applied_no_canvas_change', { scenarioId })
        } else {
          setMessage('Restored. The shared model and this canvas now show that version.')
        }
        await refresh()
        return
      }
      case 'conflict':
        setMessage('The model changed since you looked. The list has been refreshed — try again.')
        await refresh()
        return
      case 'mutationIdReused':
      case 'payloadRejected':
        logger.warn('server_versions.restore_refused_client_fault', {
          scenarioId,
          status: result.status,
        })
        setMessage(RESTORE_CLIENT_FAULT)
        return
      case 'versionNotRestorable':
        setMessage(RESTORE_VERSION_NOT_RESTORABLE)
        await refresh()
        return
      case 'versionNotFound':
        setMessage('That version is no longer available. Nothing was changed.')
        await refresh()
        return
      case 'signInRequired':
        // Split on the ARM CEE SENT — never on `useAuth`. On the two `user_jwt`
        // arms the client's own session is a tautology and the wire is the
        // whole evidence; on `scenarioUnowned` the wire is silent about the
        // caller and the identity we SENT is the only thing that knows. See
        // `signInRefusalCopy` for why those are different questions.
        setMessage(
          signInRefusalCopy(result.cause, requestCarriedIdentity(identity), {
            lapsed: RESTORE_SESSION_ENDED,
            olumiFault: RESTORE_REFUSED_WHILE_SIGNED_IN,
          }),
        )
        return
      case 'disabled':
        setPhase({ kind: 'disabled' })
        return
      // PROVABLY PRE-COMMIT. The route decides identity → UUID → EXISTENCE →
      // ownership → body BEFORE the RPC, so a 404 (`notReadable`) or a
      // 401/403/429 (`refused`) is refused with nothing written. Here the claim
      // is EARNED, and withholding it would be its own dishonesty — vagueness
      // about a state we do know.
      //
      // ⚠ AND THIS IS THE ARM A LAPSED SESSION ACTUALLY LANDS ON, WHICH IS WHY
      //   IT IS NOT A SINGLE STRING. Derived at CEE staging `f18d941b`: a
      //   token-less request resolves `service_legacy` rather than being
      //   refused (`user-identity.ts:107-118`), then fails ownership on an
      //   OWNED scenario (`preflightEnsureScenario` →
      //   `scenario_requires_authenticated_owner`) and is answered by the
      //   route's family `refuse()` — a 404, NOT the 401 handled above. Most
      //   scenarios have an owner, so this is the COMMON lapsed path, and
      //   "could not be restored right now" reads as transient on a refusal
      //   that no retry can clear. The pre-commit claim is kept on BOTH
      //   branches: `RESTORE_SESSION_ENDED` also opens "Nothing was changed."
      case 'notReadable':
      case 'refused':
        setMessage(
          requestCarriedIdentity(identity)
            ? 'The version could not be restored right now. Nothing was changed.'
            : RESTORE_SESSION_ENDED,
        )
        return
      // OUTCOME UNKNOWN — see `RESTORE_OUTCOME_UNKNOWN`. `unavailable` covers
      // CEE's post-commit egress 503, `unusable` a transport failure that may
      // have raced a commit, and `default` anything this client has not
      // classified, which is unknown by definition. Refresh, so the sentence is
      // followed by the truth rather than by a guess.
      case 'unavailable':
      case 'unusable':
      default:
        logger.warn('server_versions.restore_outcome_unknown', {
          scenarioId,
          status: result.status,
        })
        setMessage(RESTORE_OUTCOME_UNKNOWN)
        await refresh()
        return
    }
  }

  return (
    <PanelSection title="Shared versions">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="server-versions-disclosure">
        {SERVER_VERSIONS_DISCLOSURE}
      </p>

      {phase.kind === 'loading' && (
        <p className={`${typography.panelBody} text-text-light`}>Loading shared versions…</p>
      )}

      {phase.kind === 'disabled' && (
        <p
          className={`${typography.panelBody} text-text-light`}
          data-testid="server-versions-unavailable"
        >
          Shared version history is not available on this service right now.
        </p>
      )}

      {phase.kind === 'failed' && (
        <div className="space-y-1.5">
          <p className={`${typography.panelBody} text-text-light`}>
            Shared versions could not be loaded — this says nothing about whether any exist.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: 'loading' })
              void refresh()
            }}
            className={`${typography.panelBody} px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
          >
            Try again
          </button>
        </div>
      )}

      {message !== null && (
        <p
          className={`${typography.panelBody} text-text-body`}
          role="status"
          data-testid="server-versions-message"
        >
          {message}
        </p>
      )}

      {undoVersionId !== null && (
        <button
          type="button"
          data-testid="server-restore-undo"
          disabled={busy}
          onClick={() => {
            const target = undoVersionId
            setUndoVersionId(null)
            if (target !== null) void handleRestore(target)
          }}
          className={`${typography.panelBody} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo restore
        </button>
      )}

      {phase.kind === 'ready' && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="server-version-name" className="sr-only">
              Shared version name
            </label>
            <input
              id="server-version-name"
              type="text"
              value={draftLabel}
              disabled={busy}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Name this shared version"
              className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body placeholder:text-text-light`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              aria-label="Save shared version"
              className={`${typography.panelBody} shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color disabled:opacity-60`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Save shared version
            </button>
          </div>

          {phase.versions.length === 0 && (
            <p className={`${typography.panelBody} text-text-light`} data-testid="server-versions-empty">
              No shared versions yet. Save one to give the team a restorable state of this model.
            </p>
          )}

          {phase.versions.length > 0 && (
            <ul className="space-y-1">
              {phase.versions.map((version) => {
                const isCurrent = version.id === phase.currentVersionId
                const origin = provenanceLabel(version.provenance)
                const armed = armedVersionId === version.id
                return (
                  <li
                    key={version.id}
                    className="space-y-1"
                    data-testid="server-version-row"
                    data-version-id={version.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className={`${typography.panelBody} text-text-body`}>
                          v{version.versionNumber}
                          {version.label !== null ? ` · ${version.label}` : ''}
                        </span>
                        <span className={`${typography.panelMeta} text-text-light ml-2`}>
                          {formatTimestamp(version.createdAt)}
                        </span>
                        {origin !== null && (
                          <span
                            data-testid="server-version-origin"
                            className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          >
                            {origin}
                          </span>
                        )}
                        {isCurrent && (
                          <span
                            className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          >
                            current
                          </span>
                        )}
                      </span>
                      {!isCurrent && !armed && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Restore version ${version.versionNumber}`}
                          onClick={() => setArmedVersionId(version.id)}
                          className={`${typography.panelBody} shrink-0 px-2 py-1 rounded-md border border-panel-border text-text-body hover:bg-panel-hover disabled:opacity-60`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    {armed && (
                      <div
                        className="space-y-1.5 rounded-md border border-panel-border p-2"
                        data-testid="server-restore-confirm"
                      >
                        <p className={`${typography.panelBody} text-text-body`}>
                          Replace the current shared model with v{version.versionNumber}?
                          Everyone who can open this scenario sees the change, and any
                          analysis results you already have go out of date — nothing
                          re-runs on its own, so you will need to analyse again. The
                          current state is saved first, so you can undo.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRestore(version.id)}
                            className={`${typography.panelBody} px-3 py-1.5 rounded-md bg-primary text-text-on-color disabled:opacity-60`}
                          >
                            Confirm restore
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setArmedVersionId(null)}
                            className={`${typography.panelBody} px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </PanelSection>
  )
}
