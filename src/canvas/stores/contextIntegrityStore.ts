/**
 * Context-Integrity Store — ROADMAP 2.973.
 *
 * Holds the two things needed to answer *"what did you keep, and what did you
 * leave out?"*: the user's ORIGINAL BRIEF as they wrote it, and CEE's
 * not-modelled manifest. Both arrive together on the cold read
 * (`POST /bff/cee/scenarios/:id/graph`) and are written here by
 * `serverGraphHydration` through `setContextIntegrity`.
 *
 * ── THE SECOND WRITER, AND WHY IT EXISTS ───────────────────────────────────
 * The brief ALSO exists earlier than any cold read: the user typed it, and it
 * is the `message` of the draft turn. On a fresh decision the cold read
 * answers `absent` (CEE has not written the graph back yet), so a reader of
 * this store showed nothing for the whole first session — witnessed on the
 * deployed build `127bdee7` (6 Sep 2026): a 279-character brief, a drafted
 * and analysed model, and the anchor node still reading "Question" until a
 * page reload. `recordBriefForFreshDraft` closes that: the turn that first
 * puts a graph on a scenario records that scenario's brief under ITS id, with
 * `manifest: null` (we were told nothing — the manifest only ever arrives on
 * the cold read). It NEVER overwrites a record that already exists for the
 * same scenario, so the cold read's copy — which carries the manifest — wins
 * whenever it has landed, and a follow-up turn cannot replace the brief.
 *
 * ⚠ OVERWRITE ORDER, stated because it is not guarded: `setContextIntegrity`
 * overwrites unconditionally, and `useServerGraphHydration` re-fires for a
 * scenario id minted in-session, so its absent re-ask can later replace this
 * record with the server's copy of the same brief — or with `null` if CEE
 * persisted no `brief_text`, which would take the anchor block down until the
 * next draft. Disclosed, not closed.
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
import type { ModelBuildingNoticesView } from '../conversation/modelBuildingNotices'

/**
 * ── WHY `scenarioId` IS BACK, AND WHY IT MUST HAVE A READER ────────────────
 * This field existed, was removed as write-only, and its removal shipped a
 * P0: the receipt rendered A PREVIOUS DECISION'S BRIEF under "What you gave
 * me", and survived reset-canvas → new brief → draft → analysis → edit. Only a
 * page reload cleared it (this store is in-memory, so a reload re-inits it).
 *
 * The removal note argued the staleness question was "answered UPSTREAM" by
 * `serverGraphHydration` comparing the requested scenario against
 * `useCanvasStore.currentScenarioId`. THAT WAS FALSE, and the reason is
 * CLAUDE.md trap 21 — two questions under one name:
 *
 *   · The upstream guard answers *"is this in-flight RESPONSE for the scenario
 *     the user is still on?"* It only runs on the `'graph'` path.
 *   · The render needs *"does the content I am about to SHOW belong to the
 *     scenario on screen?"*
 *
 * They differ precisely where the defect lives. `setContextIntegrity` is
 * reached ONLY on `result.status === 'graph'`; every other cold-read outcome
 * (`absent`, `notReadable`, `unavailable`, `refused`, `unusable`, and the
 * non-UUID `skipped`) returns BEFORE the write. A freshly-minted scenario
 * reliably answers `absent` — CEE has no graph for it yet at the moment
 * `useServerGraphHydration` fires — so nothing is written, nothing is cleared,
 * and the previous decision's brief simply stays. The hook attempts ONCE PER
 * SCENARIO ID, so it never self-corrects.
 * (`recordBriefForFreshDraft` now writes the NEW decision's brief under its own
 * id once its graph lands, so the fresh case renders — but between reset-canvas
 * and that landing, and for any draft the record does not reach, the store
 * still holds the previous decision. The gate at the readers stays load-bearing.)
 *
 * The removal reasoning about write-only fields (trap 10) was right in general
 * and wrong here: the answer was not to delete the field but to GIVE IT A
 * READER. `V7WhatIWasGivenSection` now refuses to render unless this id
 * positively matches `useCanvasStore.currentScenarioId`, so a stale store
 * cannot reach the screen even when nothing clears it. Keying the content is
 * what makes clearing unnecessary: an unkeyed clear must be remembered at every
 * transition (the hand-maintained mirror, trap 12), whereas content that
 * carries its own identity fails safe at the point of use.
 */
export interface ContextIntegrityState {
  /**
   * The scenario this content describes. `null` = nothing recorded.
   *
   * ⚠ HAS A READER, AND MUST KEEP ONE. `V7WhatIWasGivenSection` gates its
   * entire render on this matching the live scenario. If a future change drops
   * that comparison, the P0 above returns silently — the pinning spec is
   * `V7WhatIWasGivenSection.spec.tsx` → "never renders another decision's
   * brief".
   */
  scenarioId: string | null
  /** The brief as the user wrote it, byte-verbatim. `null` = none persisted. */
  briefText: string | null
  /** CEE's manifest. `null` = we were told nothing. NEVER "nothing dropped". */
  manifest: NotModelledManifest | null
  /**
   * ⭐⭐ THE SECOND SOURCE FOR "what did NOT make it into the model", AND THE
   * ONLY ONE A FIRST SESSION HAS — ROADMAP 2.1379.
   *
   * The manifest above arrives ONLY on the scenario-graph cold read, which
   * answers `absent` for a decision this fresh, so on a first session it is
   * `null` and the register can say nothing about omissions. The DRAFT TURN,
   * meanwhile, already carried `model_building_notices` — a declared field on
   * `OlumiResponseSchema` — and the chat bubble is displaying its count two
   * panels away. This field keeps that attestation where the register can read
   * it.
   *
   * ⚠ THEY ARE NOT THE SAME QUANTITY AND MUST NEVER BE FOLDED (CLAUDE.md trap
   * 21). The manifest answers *"which figures from the brief reached the
   * model?"*; this answers *"what did the drafting model have to leave out?"*.
   * Overlapping populations, different questions, different provenance rules —
   * the manifest's rows are the user's own figures, and these are mostly not.
   *
   * ⚠ `null` MEANS NO ATTESTATION WAS SUPPLIED, NEVER "nothing was left out".
   * The producer's contract cannot encode zero (`total_count` is positive,
   * `groups` is `.min(1)`), so absence is silence. Same invariant as the
   * manifest, for the same reason.
   */
  modelBuildingNotices: ModelBuildingNoticesView | null
  /**
   * `scenarioId` is REQUIRED, deliberately: content this store cannot attribute
   * to a decision is content the surface must never show, and making the caller
   * state it means a new writer cannot omit it by accident.
   */
  setContextIntegrity: (input: {
    scenarioId: string | null
    briefText: string | null
    manifest: NotModelledManifest | null
  }) => void
  /**
   * Record the brief for a scenario the cold read has NOT written yet. Returns
   * `true` only when it wrote. Refuses — and writes nothing — when a record for
   * this scenario already exists (the cold read's copy, or an earlier call),
   * when the brief is blank, or when the id is not a non-empty string: content
   * this store cannot attribute to a decision must never be stored.
   *
   * ⚠ WHEN IT WRITES, THE DECISION HAS CHANGED, so it clears
   * `modelBuildingNotices` for the same reason `setContextIntegrity` does —
   * the attestation belongs to the scenario, not to the writer.
   */
  recordBriefForFreshDraft: (input: { scenarioId: string; briefText: string }) => boolean
  /**
   * Record what the drafting turn attested it had to leave out, for the
   * decision it drafted. Returns `true` only when it wrote.
   *
   * ⚠ IT IS A SEPARATE WRITER FROM `recordBriefForFreshDraft`, DELIBERATELY.
   * That one answers *"what did the user write for this decision?"* and its
   * NEVER-DISPLACE rule is right for a brief, which does not change. This
   * answers *"what did THIS draft turn leave out?"*, and a later draft of the
   * same decision builds a different model — so it replaces rather than
   * refuses. Two questions under one name is trap 21; folding them would drop
   * a fresh attestation on the floor whenever a cold read had already landed.
   *
   * ⚠ FAIL-CLOSED ON IDENTITY. It writes ONLY when this store is already
   * describing that scenario. Content this store cannot attribute to the
   * decision on screen is content the surface must never show, and the P0 in
   * this file's header — a PREVIOUS decision's brief rendered verbatim — is
   * exactly what an unattributed write reopens, in a new field.
   */
  recordModelBuildingNotices: (input: {
    scenarioId: string
    notices: ModelBuildingNoticesView
  }) => boolean
  reset: () => void
}

const EMPTY = {
  scenarioId: null,
  briefText: null,
  manifest: null,
  modelBuildingNotices: null,
} as const

export const useContextIntegrityStore = create<ContextIntegrityState>((set, get) => ({
  ...EMPTY,
  setContextIntegrity: ({ scenarioId, briefText, manifest }) =>
    set((s) => ({
      scenarioId,
      briefText,
      manifest,
      /**
       * ⚠⚠ THE NOTICES BELONG TO THE SCENARIO, NOT TO THE WRITER, AND THIS ONE
       * LINE IS WHAT KEEPS BOTH DOORS WATCHED (trap 22b).
       *
       * This action overwrites unconditionally and is reached on EVERY
       * successful cold read. Clearing the notices here would blink the
       * capability out seconds into a live session, the moment the
       * scenario-graph read lands — a correct thing shipping dark. NOT
       * clearing them on a scenario CHANGE would leave decision A's omissions
       * standing under decision B's brief, which is this store's own P0.
       *
       * So the rule is derived from the identity rather than from the caller:
       * the same decision keeps what the draft turn attested; a different one
       * keeps nothing. `zustand`'s merge would preserve the field silently in
       * BOTH cases, which is why this is stated rather than left implicit.
       */
      modelBuildingNotices: s.scenarioId === scenarioId ? s.modelBuildingNotices : null,
    })),
  recordBriefForFreshDraft: ({ scenarioId, briefText }) => {
    if (typeof scenarioId !== 'string' || scenarioId.length === 0) return false
    if (typeof briefText !== 'string' || briefText.trim().length === 0) return false
    // A record for this scenario already stands — the cold read's (with its
    // manifest) or an earlier draft turn's. Never displace it.
    if (get().scenarioId === scenarioId) return false
    /**
     * ⚠⚠ THE SECOND DOOR. `setContextIntegrity` is not the only action that
     * moves `scenarioId`, and the notices belong to the SCENARIO rather than to
     * the writer (see that action's note) — so the same rule has to hold here.
     *
     * This line is reached ONLY when the decision differs: the refusal above
     * returns first for the same id. So the clear is unconditional here and
     * still means exactly what the conditional one above means — a different
     * decision keeps nothing. Leaving it out left decision A's omission counts
     * standing under decision B's brief, with the re-scoped refusal's *"What I
     * can show is below"* pointing at them: this file's own P0, wearing a new
     * field, and NOT catchable at the render gate, because after this write the
     * store genuinely IS describing B.
     *
     * ⚠ IT CANNOT CLOBBER THE NEW DECISION'S OWN ATTESTATION. `useConversation`
     * records the brief BEFORE the notices on the same turn, and
     * `recordModelBuildingNotices` fails closed unless this store is already
     * describing that scenario — so this write is what LETS the new one land.
     * The opposite-direction twin (a refused re-record keeping the
     * attestation) is pinned beside the tests for this one, because a clear
     * written without it would blink the capability out on the second turn.
     */
    set({ scenarioId, briefText, manifest: null, modelBuildingNotices: null })
    return true
  },
  recordModelBuildingNotices: ({ scenarioId, notices }) => {
    if (typeof scenarioId !== 'string' || scenarioId.length === 0) return false
    // ⚠ A POSITIVE MATCH, NOT `!==` — the same shape as the readers' identity
    // gate, and for the same reason: `!==` passes when either side is `null`,
    // and `null` is exactly the state this store sits in for a decision it was
    // never told about.
    if (get().scenarioId !== scenarioId) return false
    set({ modelBuildingNotices: notices })
    return true
  },
  reset: () => set({ ...EMPTY }),
}))
