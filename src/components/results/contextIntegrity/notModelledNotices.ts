/**
 * notModelledNotices — the "Not modelled yet" pane's copy authority, and the
 * one rule deciding which of the draft turn's attested omissions may appear
 * under that heading. ROADMAP 2.1379.
 *
 * ── THE PROBLEM THIS EXISTS TO SOLVE ───────────────────────────────────────
 * On a FIRST session `WhatIWasGivenSection` has `manifest === null` and refuses:
 * *"I can't show this yet for this decision, so please don't read the absence
 * as everything having made it in."* Correct, and incomplete — the same turn's
 * chat bubble is already displaying *"Olumi left N things out of this model"*
 * two panels away. One screen, two answers to one question.
 *
 * ⛔ THE REFUSAL IS NOT DELETED AND DOES NOT FALL SILENT. The section's header
 * rules that `manifest === null` must refuse EXPLICITLY — *"never an empty
 * list, and never silence"* — because both read as "everything made it in". So
 * there are TWO refusals here, not one and a gap: the unqualified one for when
 * this pane has nothing either, and a RE-SCOPED one that names the thing which
 * genuinely cannot be shown and points at the thing that can.
 *
 * ── ⛔ WHY THE MANIFEST CANNOT SIMPLY BE FILLED IN INSTEAD ─────────────────
 * `not_modelled` IS NOT IN THE CONTRACT. Measured in the version this branch
 * pins (`vendor/talchain-schemas-0.55.0.tgz`, read at the tarball rather than
 * `node_modules`): zero occurrences as a declared key, the only hits being the
 * enum member `target_not_modelled_as_threshold`. CONTRAST CONTROL in the same
 * sweep: `model_building_notices` → declared, `boundary/olumi-response.js:245`.
 * The manifest reaches the store through ONE undeclared passthrough on the
 * scenario-graph cold read, which answers `absent` for a decision this fresh.
 * The UI cannot conjure one and must not try.
 *
 * ── ⛔ WHY ONLY SOME KINDS REACH THIS PANE — THE RULE IS IMPORTED ──────────
 * `KIND_OUTCOME` in `modelBuildingNotices.ts` already rules which kinds every
 * producer reason leaves OFF the graph. Only those may sit under a heading that
 * says "Not modelled yet"; the rest are in the model, handled differently, or
 * mixed, and listing them here would be the exact over-claim that authority
 * exists to prevent — and would contradict the bubble two panels up, on the
 * same payload. So the rule is ASKED, never re-spelled: a second copy is
 * CLAUDE.md trap 12, and on this surface it is the kind that puts two different
 * numbers for one question on one screen.
 *
 * ── ⛔ AND WHY NO ROW NAMES AN ITEM ────────────────────────────────────────
 * `details_redacted` is a literal `true`: the producer sends aggregate counts
 * per kind and NOTHING else. No free text, no per-item detail, no next step.
 * A row here can honestly show a KIND and a COUNT, and nothing finer. Naming an
 * example would fabricate detail the wire explicitly redacted.
 */
import {
  modelBuildingNoticeOutcome,
  type ModelBuildingNoticeRow,
  type ModelBuildingNoticesView,
} from '../../../canvas/conversation/modelBuildingNotices'

/**
 * The pane's copy, in ONE place and exported so its claims can be asserted
 * whole rather than as negatives. An audit recorded in `modelBuildingNotices.ts`
 * found a whole copy arm replaced by `return ''` under a fully green suite,
 * because every assertion touching it was a `not.toMatch` — and a negative
 * passes on the empty string.
 *
 * ⚠ ATTRIBUTION IS THE DIFFERENCE BETWEEN THE TWO LEADS, AND IT IS EARNED, NOT
 * CHOSEN. #1524 established that this wire carries NO per-item provenance, so
 * copy may not call these losses the user's or Olumi's except where a kind is
 * unanimously one thing. `KIND_ATTRIBUTION` is that ruling. The manifest-fed
 * lead says *"These are in your brief"* and is entitled to: its rows ARE
 * figures found in the brief. The notices-fed lead is NOT entitled to it —
 * every kind it can show is `olumi_authored` or `mixed`, never `user_stated` —
 * so it claims neither side and stops. The tripwire that keeps it that way is
 * derived over the whole enum in
 * `WhatIWasGivenSection.notModelledFromNotices.spec.tsx`, so a seventh kind, or
 * a changed outcome on an existing one, turns RED rather than quietly
 * licensing a possession claim the wire cannot support.
 *
 * ⚠ AND NOTHING HERE NAMES A LOSS. "Not modelled yet" is an invitation, never a
 * confession: no "dropped", no "lost", no "discarded", and no pipeline
 * vocabulary. Pinned over every string in this object, so a new one cannot
 * arrive unchecked.
 */
export const NOT_MODELLED_NOTICES_COPY = {
  heading: 'Not modelled yet',
  /** The manifest-fed lead. Its possession claim is earned; see above. */
  manifestLead: 'These are in your brief but not in the model. Ask about any that matter.',
  /**
   * The notices-fed lead. Same invitation, no possession claim in either
   * direction, and no example — the producer redacted the items.
   */
  noticesLead: 'These are not in the model yet. Ask about any that matter.',
  /**
   * The unqualified refusal, UNCHANGED and carried here byte-for-byte with the
   * note it was shipped under. It stands whenever this pane has nothing honest
   * to add, which is the state the section's header is about.
   *
   * ⚠ THE "so" IS LOAD-BEARING AND WAS BRIEFLY LOST (11 Sep 2026). Splitting
   * the em dash out of this sentence first produced two flat statements, which
   * dropped the causal link: the reason not to read the silence as completeness
   * IS that we cannot show it. A comma plus "so" carries that without a dash.
   * The re-scoped twin below keeps the same construction for the same reason.
   */
  unknown:
    "I can't show this yet for this decision, so please don't read the absence as everything having made it in.",
  /**
   * The re-scoped refusal. It refuses the SAME thing — which of the user's own
   * figures reached the model, which is what the manifest would have answered —
   * keeps the clause the header calls load-bearing, and then stops pretending
   * the product knows nothing, because it plainly does.
   *
   * ⚠ ITS CLOSING POINTER IS TRUE BY CONSTRUCTION, NOT BY CONVENTION: this
   * string is rendered ONLY when `notModelledNoticeRows` returned at least one
   * row, i.e. only when there IS something below it. One condition, asked once.
   * A pointer keyed on "did a payload arrive?" rather than "is there an honest
   * row?" would point at empty space on a payload whose every kind is still in
   * the model.
   */
  unknownWithNotices:
    "I can't yet show which of your figures reached the model, so please don't read that absence as everything having made it in. What I can show is below.",
} as const

/**
 * The rows this pane may honestly render, from the draft turn's attestation.
 *
 * ⚠ `modelBuildingNoticeOutcome` IS ASKED, NOT RE-IMPLEMENTED. It is the single
 * authority for "did every producer reason leave this content off the graph?",
 * and it is already what the chat bubble groups by. A predicate written here
 * would be a second answer to that question on the same screen.
 *
 * ⚠ AND IT FILTERS `view.rows`, WHICH IS ALREADY FAIL-CLOSED UPSTREAM: a kind
 * this UI cannot phrase never reaches `rows` at all, so it cannot be claimed as
 * an omission. `totalCount` is deliberately NOT used here — it is the
 * producer's count of EVERYTHING it noticed, including content still in the
 * model, and the heading above these rows says "Not modelled yet".
 *
 * ⚠⚠ THE ABSENT GUARD IS TRUTHINESS, NOT `=== null`, AND THAT IS A MEASURED
 * CORRECTION RATHER THAN A STYLE CHOICE. It was written `view === null`,
 * against the state the STORE declares — and `undefined` is reachable, because
 * a `vi.mock` factory REPLACES the module, so any consumer's spec that mocks
 * `contextIntegrityStore` with a hand-listed object returns `undefined` for a
 * field added after it was written (CLAUDE.md trap 12, in its original form).
 * `view.rows` then threw and took the WHOLE SECTION down: five tests about
 * container geometry in `givenSectionGrammarIsOptIn.spec.tsx` REDing on a
 * null-guard two panes away, and on a real build it would have been the panel
 * disappearing rather than a pane staying quiet.
 *
 * That is trap 13d: an invariant written against the failure mode in hand
 * rather than against the domain the runtime admits. An absent view now yields
 * an empty pane and the unqualified refusal, which is the honest reading of
 * "we were told nothing" in either spelling. Pinned, with a positive control
 * beside it so an unconditional `[]` cannot pass.
 */
export function notModelledNoticeRows(
  view: ModelBuildingNoticesView | null | undefined,
): readonly ModelBuildingNoticeRow[] {
  if (!view) return []
  return view.rows.filter((row) => modelBuildingNoticeOutcome(row.kind) === 'absent')
}
