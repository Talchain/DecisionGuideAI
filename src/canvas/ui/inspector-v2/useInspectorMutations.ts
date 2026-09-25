/**
 * Inspector v2 — typed mutation hooks
 *
 * All panels use these instead of raw store calls.
 * Single interception point for validate-patch migration.
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../../store'
import type { RiskImpact } from '../../domain/nodes'
import { useOptionalConversationContext } from '../../conversation/ConversationContext'
import { settleSystemEventSend } from '../../conversation/settleSystemEventSend'
import { markEdgeEditInFlight, resolveEdgeEditSettlement } from '../../conversation/pendingEdgeEdit'
import type { SystemEventSendSettlement, SystemEventSendSettlementDetail } from '../../conversation/settleSystemEventSend'
import {
  buildEdgeStrengthEditEvent,
  buildEdgeDirectionEditEvent,
  buildEdgeStrengthConfirmEvent,
} from '../../conversation/edgeStrengthEdit'
import { serverStatedStrengthOf } from '../../conversation/edgeServerStatedStrength'

// ─── Editor-written-field manifest (single source of truth) ────────────
//
// Every setter below writes one or more top-level `data` fields. Which fields
// each setter writes is declared ONCE here, co-located with the setters, rather
// than re-typed into a hand-list inside a distant guard spec (that mirror
// silently drifted and OMITTED edge `label`, so `label` could be denylisted with
// the deny-direction guard staying green — Codex P2).
//
// This map CANNOT drift from the setters: the co-located behavioural spec
// (__tests__/useInspectorMutations.writtenFields.spec.tsx) renders the hooks,
// asserts the returned setter names EQUAL these keys (a new/removed setter fails
// RED), and DRIVES every setter to assert the data-field keys it actually writes
// EQUAL the value here (a setter that starts writing a new/renamed field fails
// RED). `analyticalNodeFields.registry.spec.ts` imports EDITOR_WRITTEN_FIELDS as
// its deny-direction persist set (no persistent editor field may be denylisted),
// so the manifest, the setters and the guard can no longer disagree.
//
// Fields written by editors OUTSIDE this hook (e.g. the goal-threshold store
// action, the baseline toggle, the model-action apply path) are NOT listed here
// — they are named in the registry guard's residual list with their write sites.

/**
 * The node-label length limit, OWNED BY THE SETTER THAT ENFORCES IT (L-04).
 *
 * The inspector input previously allowed 500 characters while this setter
 * sliced to 100 and reported nothing — a silent truncation the user could not
 * see coming. The input now imports this constant rather than re-typing a
 * number, so the two cannot drift apart again: there is one limit, and it is
 * this one.
 */
export const NODE_LABEL_MAX_LENGTH = 100

/** node setter name → the top-level `data` field(s) that setter writes. */
export const NODE_SETTER_FIELDS = {
  setLabel: ['label'],
  setDescription: ['description'],
  setThreshold: ['goal_threshold_raw', 'goal_threshold_unit'],
  // Also clears the top-level `display_value` — CEE writes that key at either
  // level, and a value commit invalidates BOTH copies of the old prose.
  // ⚠ THREE FIELDS, AND THE THIRD IS A WITHDRAWAL RATHER THAN A WRITE.
  // `extractionType` is cleared at the TOP LEVEL here for the same reason
  // `display_value` is: it described the PREVIOUS value, and the previous value
  // is gone. The field has two storage locations in this codebase
  // (`observedState.extractionType`, and `data.extractionType`, which is what
  // `setExtractionType` below writes and what a real starter carries); clearing
  // only the nested one leaves a card calling a typed value Olumi's estimate as
  // soon as a reader consults either spelling.
  //
  // ⭐ THIS MANIFEST CAUGHT THAT CHANGE IN CI AND IT WAS RIGHT TO. The entry is
  // updated because the setter's behaviour genuinely changed — never to quiet
  // the guard. Trap 12 exists because a list a human must remember to sync
  // drifts silently; this one failed loud instead, which is the whole point.
  setObservedValue: ['observedState', 'display_value', 'extractionType'],
  setIntervention: ['interventions'],
  removeIntervention: ['interventions'],
  setPriorRange: ['prior'],
  setObservedRawValue: ['observedState'],
  setObservedUnit: ['observedState'],
  setObservedCap: ['observedState'],
  setObservedBaseline: ['observedState'],
  setObservedStd: ['observedState'],
  setObservedSource: ['observedState'],
  // `categoryInferredByUi` rides with the value on the same `*Source` pattern
  // as the edge markers above: a human picking a category is the one thing
  // that turns the ingestion adapter's edge-shape guess into a stated fact, so
  // the admission is cleared in the SAME update as the value and can never lag
  // behind it. Absent it, the Model tab would keep withholding a
  // classification the user had just authored.
  setCategory: ['category', 'categoryInferredByUi'],
  setExtractionType: ['extractionType'],
  setFactorType: ['factor_type'],
  setStateSpaceRange: ['state_space'],
  setUncertaintyDrivers: ['uncertainty_drivers'],
  setGoalCap: ['goal_threshold_cap'],
  setProbability: ['probability'],
  setImpact: ['impact'],
} as const satisfies Record<string, readonly string[]>

/**
 * edge setter name → the top-level `data` field(s) that setter writes.
 *
 * ⛔ SETTERS ONLY. `confirmCurrentStrength` is deliberately ABSENT: it writes no
 * `data` field at all, so it is not a setter, and a row here would be a claim
 * that a user edits a field through it. The shared contract agrees and enforces
 * it — `editableFieldTable.pinAndParity.spec.ts` requires every name in this map
 * to have a row in `@talchain/schemas`' EDITABLE FIELD table, and confirming
 * edits nothing. A member that writes nothing is classified in the spec's
 * `EDGE_NON_WRITERS` list instead, where the claim is DRIVEN rather than
 * declared.
 */
export const EDGE_SETTER_FIELDS = {
  // The `*Source` markers ride along with the value each setter writes: a
  // user moving the slider is the ONLY thing that turns a defaulted number
  // into a set one, so the stamp is written in the same update as the value
  // and can never lag behind it.
  // `direction` is the SIGNED-mean path, which is the default and what the
  // guard spec drives. A caller passing `{ preserveDirection: true }` writes
  // `weight` + `weightSource` only, deliberately leaving `direction` alone —
  // see the setter's own header for why a magnitude cannot carry a sign.
  setStrength: ['weight', 'direction', 'weightSource', 'directionSource'],
  setStd: ['strengthStd', 'strengthStdSource'],
  setExistsProbability: ['beliefExists', 'beliefExistsSource'],
  setLabel: ['label'],
  setDirection: ['direction', 'directionSource'],
} as const satisfies Record<string, readonly string[]>

/**
 * The flattened, de-duplicated set of node/edge `data` fields the inspector
 * setters write. Derived from the per-setter maps above so it cannot disagree
 * with them. This is the export the deny-direction registry guard consumes.
 */
export const EDITOR_WRITTEN_FIELDS = {
  node: [...new Set(Object.values(NODE_SETTER_FIELDS).flat())],
  edge: [...new Set(Object.values(EDGE_SETTER_FIELDS).flat())],
} as const

/**
 * ⭐ THE INSPECTOR'S READ-ONLY POLICY LIVES IN ITS ENFORCEMENT, NOT IN A TABLE.
 *
 * Two authority manifests used to sit here — `NODE_SETTER_AUTHORITY` (21 keys)
 * and `EDGE_SETTER_AUTHORITY` (5), every value `'disabled'`. They were DELETED
 * on 26 Aug 2026 because they had **zero code consumers**: outside their own
 * definition and `mutationAuthority.spec.ts`, every reference to either was a
 * comment or a documentation string, and NONE WAS A CONSUMER. Nothing branched
 * on them. A table nothing reads cannot drift — and cannot enforce either; it
 * was a hand-maintained mirror of a decision that is actually made somewhere
 * else.
 *
 * ⚠ THAT SENTENCE SAID "every reference … was a COMMENT" UNTIL 27 Aug 2026,
 * AND THAT WAS FALSE — corrected after an independent review found the
 * counter-example. `canvas/domain/analyticalNodeFields.ts:158` names
 * `NODE_SETTER_AUTHORITY.setPriorRange` inside a RUNTIME STRING LITERAL, in a
 * file imported by `useAutosave`, `graphChangeDiff`, `analyticalChange` and
 * `useGraphEditEvents` — so it ships to browsers. The narrow claim the
 * deletion actually rests on ("zero code CONSUMERS": nothing branches on
 * either table) is true and was always the load-bearing one; "a COMMENT" was a
 * careless widening of it. **The distinction matters because a string that
 * ships is prose the PRODUCT carries, not prose the repo carries** — this
 * deletion converts that literal from true to false, and repairing it is a
 * separate owned follow-up, deliberately not done here because you cannot
 * write "the table was deleted" before it is.
 *
 * WHERE IT IS ACTUALLY MADE: `InspectorRouter` wraps every panel — node
 * (`InspectorRouter.tsx:334`) and edge (`:221`) — in an unconditional
 * `<fieldset disabled data-authority="disabled">`, beneath a note rendering
 * `INSPECTOR_READ_ONLY_REASON` and bound to it by `aria-describedby`.
 *
 * ⭐ THE FIELDSET IS STRUCTURAL WHERE THE MANIFESTS WERE CLERICAL. It disables
 * every descendant FORM CONTROL — `button`, `input`, `select`, `textarea` —
 * without anyone remembering to classify it. The manifests could only record a
 * decision after the fact; the fieldset makes it. Their one real contribution —
 * a completeness check that every setter was classified — is replaced by a
 * DOM-level claim that no control escapes the boundary, which holds however
 * many setters exist.
 *
 * ⚠ THIS PARAGRAPH SAID "STRICTLY STRONGER … a setter added tomorrow is inert"
 * UNTIL 27 Aug 2026. AN INDEPENDENT REVIEW REFUTED IT BY EXECUTION, so the
 * scope is now stated exactly. `<fieldset disabled>` inerts form-associated
 * descendants ONLY. It does NOT inert a `[role="button"]` div, a
 * `[contenteditable]`, or an `a[href]`. Measured inside this very boundary:
 * one such div (`EmptyDescriptionPrompt`, `tabindex=0`) takes focus, fires its
 * handler and opens an editor, while the two real `<button>`s beside it are
 * disabled in the same run. "A setter added tomorrow is inert" is therefore
 * true of a form control and false of a div with a click handler — which is
 * exactly the kind of control someone adds without thinking of it as a setter.
 *
 * ⭐ THE BOUND ON THAT FINDING, CARRIED EXACTLY AND NOT UPGRADED: **NO WRITE
 * ESCAPES.** The `<textarea>` that opens is itself inside the fieldset and
 * natively disabled, and the review explicitly DECLINED to claim user
 * reachability, because the store write it exercised came from a synthetic
 * `fireEvent.change` that bypasses the browser's own gating. So this is a
 * recorded SCOPE LIMIT of the mechanism, not a known user-facing defect. Do
 * not cite it as one; do not widen it without measuring it yourself. The exact
 * set of non-inerted controls is pinned in
 * `__tests__/inspectorAuthorityBinding.spec.tsx`
 * (`NOT_INERTED_BY_THE_FIELDSET_NODE`), so it REDs if it grows or shrinks
 * rather than living only in this comment.
 *
 * The setters below remain exported because producer/reconciliation code uses
 * them; being callable in code has never been what made a control reachable to
 * a user, and the fieldset is what decides that.
 *
 * ⚠ DO NOT REINTRODUCE A CLASSIFICATION TABLE HERE. If you want to know why a
 * control is inert, read the fieldset and the notice; both are pinned by
 * `__tests__/inspectorAuthorityBinding.spec.tsx`, which fails if the boundary,
 * the copy, or the aria binding between them is removed — per region, so a
 * break in one is not masked by the other.
 *
 * ⚠ AND NOTE WHICH QUESTION THIS IS. `CANONICAL_EDIT_AUTHORITY`
 * (`canvas/mutations/mutationAuthority.ts`) answers a DIFFERENT one — see its
 * header. It governs whether a control may LOOK like a shared-model edit. This
 * file governs whether the Inspector's controls are reachable at all.
 */

/**
 * Receipt-bearing actions mounted elsewhere and intentionally preserved.
 *
 * ⚠⚠ NARROWED, schemas 0.50.0 — AND THE NARROWING IS THE POINT, NOT A TIDY-UP.
 * This sentence used to open "This inspector is read-only because these changes
 * cannot yet be saved to the shared model." That was true of every control in
 * the panel when it was written. It stopped being true the moment the title
 * gained a durable `structural_rename` carrier: the NAME now writes to
 * `scenarios.graph` and survives a reload, while the panel body still cannot.
 *
 * A blanket claim over a control that no longer obeys it is this estate's trap
 * 21 — two questions under one sentence — and the failure mode is specific and
 * bad: a user reads "changes cannot be saved", renames anyway because the
 * pencil is right there, and then does not trust the rename that DID save. The
 * copy therefore names the exception rather than being quietly left to rot.
 *
 * ⚠ SCOPE, EXACTLY. The `<fieldset disabled>` in `InspectorRouter` is unchanged
 * and still wraps the whole panel body; it never wrapped the shell header, which
 * is where the title lives, so nothing about the enforcement boundary moved
 * here. Only the sentence describing it did.
 */
/**
 * ⭐⭐ ONE MECHANISM, ONE SENTENCE — AND IT IS A CONSTANT BECAUSE FOUR COPIES OF
 * IT IS WHAT WENT WRONG (18 Sep 2026, third pass).
 *
 * ⛔ UNRUN AS COMMITTED. No vitest, no tsc, no install — this lane was
 * cost-constrained to reading code and writing a patch. CI is the authority for
 * every assertion that moved with it.
 *
 * The Inspector's authority notice has FOUR arms (`InspectorRouter.tsx:519-525`)
 * and every one of them sits above the SAME rename: `InspectorShell`'s
 * `onLabelChange` is wired to `handleLabelChange` for every node panel type
 * (`InspectorRouter.tsx:173-179, 500`), which calls `store.updateNodeLabel`. One
 * chokepoint, one durability answer.
 *
 * The second pass repaired the rename claim in the EXTERNAL arm only and
 * recorded the other three as "out of this lane's scope; reported, not edited".
 * That left the product giving TWO DIFFERENT DURABILITY ANSWERS FOR ONE
 * MECHANISM, decided by which factor the user happened to click: the external
 * pane said the reach was conditional, the other three asserted the outcome
 * flatly ("the name saves to the shared model" / "The name saves." / "The name
 * and the value save to the shared model"). A user who renames a
 * locally-created factor is told a different thing about the same silent
 * stand-down depending on the pane. That is trap 21 read backwards — not two
 * questions under one name, but ONE question under four names — and a scoping
 * decision made it, not a mistake about the facts.
 *
 * ⭐ RECONCILED RATHER THAN NAMED APART, because nothing genuinely differs.
 * There is no per-panel rename path to name apart: `resolvePanelType` picks the
 * BODY, never the title writer. If a future change does give one panel its own
 * rename carrier, this constant is where that split becomes visible.
 *
 * ⛔ AND IT IS A SINGLE DEFINITION, NOT FOUR MATCHING LITERALS. Four
 * hand-copied sentences about one mechanism is the hand-maintained mirror
 * (trap 12) that produced this finding in the first place; the next lane
 * correcting the condition would have had to remember all four. Interpolated
 * once, a correction cannot land in three places out of four.
 *
 * ⚠ THE CLAUSE IS A NECESSARY CONDITION AND ASSERTS NO OUTCOME, which is what
 * makes it true on every arm — the `node_not_server_held` stand-down (local
 * write applied, nothing sent, and NO notice, because the toast is gated on
 * `result.deferred`), the deferred arm, the happy path, and the `unproven`
 * sub-case. The full derivation sits on `INSPECTOR_FACTOR_EXTERNAL_REASON`
 * below, where it was first written; it is not repeated here.
 *
 * ⚠ WHAT THIS DOES NOT TOUCH, deliberately and with the reason stated. "The
 * value saves to the shared model" in the controllable arm is a claim about
 * `factor_value_edit` — a DIFFERENT mechanism, and one with a single sentence,
 * so it carries no contradiction for a reader to hit. It may still be
 * over-flat; that is a separate audit, and folding it in here would smuggle an
 * unrelated correction into a reconciliation.
 */
export const RENAME_AUTHORITY_CLAUSE =
  'reaches the shared model, but only for elements the model already holds'

/**
 * ⭐ THE ONE HUMAN-AGENCY STATEMENT (Paul 23 Sep contract feedback point 11:
 * "One human-agency statement, not three versions of the same disclaimer").
 *
 * Rendered ONCE per inspector pane by `InspectorRouter`, beside — never inside —
 * the pane's authority notice, so the notice stays the exact element the
 * `<fieldset disabled>` names in `aria-describedby` and every spec that binds
 * the notice by `textContent` still binds the SAME truth.
 *
 * ⚠ It states a ROLE, not an outcome: the human decides, the model informs.
 * No recommendation, no ranking, no claim about what a run will do. The
 * save / not-saved facts stay in the per-pane constants below — this line does
 * not repeat them, and they no longer repeat each other's boilerplate.
 */
export const INSPECTOR_AGENCY_STATEMENT =
  "You decide. Olumi's model informs your thinking; it doesn't choose for you."

/**
 * ⚠ Paul 23 Sep contract feedback point 11 — SHORTENED, NOT DELETED. Every
 * pinned truth survives: the rename is reachable and conditional
 * (`RENAME_AUTHORITY_CLAUSE`), the other fields can't yet be saved, and the two
 * routes that DO save (Model tab for supported factor values; asking Olumi) are
 * still named. What went: "read-only for now because", which restated the
 * same fact as "can't yet be saved" in the same sentence.
 */
export const INSPECTOR_READ_ONLY_REASON =
  `You can rename this; renaming ${RENAME_AUTHORITY_CLAUSE}. Other fields here can't yet be saved. Use the Model tab for supported factor values, or ask Olumi to change structure.`

/**
 * ⭐ THE SAME FACTS, FOR THE ONE PANE THAT NOW FENCES ITSELF.
 *
 * `INSPECTOR_READ_ONLY_REASON` above is written for a pane where the Router has
 * disabled EVERYTHING below the header, so it has to explain a blanket. The
 * option pane no longer has one: navigation, disclosure and coaching work, and
 * only the writers are fenced. A notice describing a blanket that is not there
 * would be the same trap-21 mismatch the longer string was itself narrowed to
 * fix — a sentence and a surface disagreeing.
 *
 * ⚠ IT SAYS LESS BECAUSE THE PANE SAYS MORE. The Model-tab route is repeated
 * once, in place, at the top of the factor list where a reader is actually
 * looking for it (`OPTION_EDIT_ROUTE_NOTE`) — so this line does not have to
 * carry the whole explanation, and the pane does not say it twice.
 */
// ⚠ "The name saves." STOOD HERE and was the shortest of the four flat rename
// claims — short enough that its unconditionality read as brevity rather than
// as an assertion. It is the same claim as the other three and it shares their
// single carrier, so it takes the same clause. The pane still says less than
// the blanket string above; it now says less about the same thing, rather than
// something different.
// ⚠ Paul 23 Sep contract feedback point 11: "links, details and coaching still
// work" was boilerplate repeated on five arms. It is dropped rather than moved:
// those controls are visibly enabled, and "Other fields" already scopes the
// fence to writers, so no blanket is implied (the trap-21 concern above).
// ⭐⭐ DEFECT 5 + ED #63 §9 (served `a4434670`): this read "Renaming … Other
// fields here are read-only for now." on the one pane where a SECOND writer is
// live — the option's factor targets, which reach CEE as
// `option_intervention_edit` (`OptionPanel`'s `disabled={false}` paragraph, and
// the card's own route: "N factor targets. Open the inspector to change them.").
// A reader told "other fields are read-only" beneath rows whose boxes write to
// the model was being told the opposite of what the pane does. It now names
// BOTH editable things — the name and the factor targets — and the complement
// ("other fields") stays open, as the controllable arm's rule (1) requires.
// ⚠ "below" is a REACHABLE control: each target row either carries its box in
// the default view, or the list names "Show technical detail" — the control
// that opens it — once, above the rows (`OPTION_TARGET_EDIT_ROUTE_NOTE` in
// `OptionPanel.tsx`).
// ⚠ It states the ACTION, never an outcome: a target edit can still be refused
// by the server, and that refusal is the row's to disclose.
export const INSPECTOR_OPTION_READ_ONLY_REASON =
  `Renaming ${RENAME_AUTHORITY_CLAUSE}. You can also change this option's factor targets below. Other fields here are read-only for now.`

/**
 * ⭐⭐ THE FACTOR PANE, AND IT IS THE FIRST NOTICE HERE THAT ANNOUNCES A SAVE
 * RATHER THAN EXPLAINING A REFUSAL.
 *
 * The controllable-factor VALUE has a durable carrier (`factor_value_edit`),
 * so on this pane it genuinely saves. Reusing either string above would have
 * been a lie in the expensive direction: both say the non-name fields cannot
 * be saved, and a user who believed that would route a change they had just
 * successfully made through the Model tab instead.
 *
 * ⚠ AND IT NAMES WHAT STILL DOES NOT SAVE. `setDescription` has no carrier and
 * stays fenced. A notice that only advertised the win would leave the reader to
 * discover the exception by losing a description to the next rehydrate.
 */
export const INSPECTOR_FACTOR_CONTROLLABLE_REASON =
  // ⚠ THREE CORRECTIONS LIVE IN THIS ONE NOTICE.
  //
  // (1) DELIBERATELY NOT A CLOSED CLAIM. An earlier wording named description as
  // THE exception; the panel also fences its advanced editor (14 writers with no
  // carrier), so "description is the one read-only thing" was false the moment it
  // was written. This says what saves and leaves the complement open — it stays
  // true as carriers are added, and a reader is never told a control saves when
  // it does not.
  //
  // (2) IT STATES THE ACTION, NEVER THE STORAGE. My first rewrite said the other
  // edits "stay on this device" — caught by `guestStorageClaims.spec.ts`, and
  // caught correctly: A GUEST'S GRAPH ALSO EXISTS SERVER-SIDE, so any "only on
  // this device" claim is simply false, however reassuring it sounds. What is
  // true is that these edits are not SENT, which is a claim about this app's
  // behaviour rather than about where bytes live.
  //
  // (3) THE NAME AND THE VALUE ARE NOW TWO SENTENCES, because they are two
  // carriers with two truth conditions and the conjunction hid that. "The name
  // and the value save to the shared model" gave the rename the value's
  // flatness for free. The rename clause is shared with the other three arms
  // (see `RENAME_AUTHORITY_CLAUSE`); the value clause is left exactly as it
  // was, unaudited, and that is recorded rather than quietly fixed.
  //
  // (4) Paul 23 Sep contract feedback point 11: the "links, details and
  // coaching still work" tail is dropped (repeated boilerplate on five arms);
  // every save / not-sent fact above is kept.
  `Renaming ${RENAME_AUTHORITY_CLAUSE}. The value saves to the shared model. Other edits here are not sent yet.`

/**
 * ⭐ THE EXTERNAL-FACTOR PANE, AND IT EXISTS SO THE THIRD PANEL CANNOT INHERIT
 * THE SECOND'S SENTENCE.
 *
 * `InspectorRouter`'s own comment demanded this: the notice is keyed by panel
 * type "so adding a third cannot silently inherit a sentence written about
 * another surface", and the ternary there fell through to the OPTION string for
 * any authority-owning pane that was not `factor-controllable`. A third panel
 * added without this constant would have told the reader "the name saves" while
 * the range saved too.
 *
 * What saves here: the name, and the prior RANGE — ⛔ BUT NOT TO THE SAME
 * PLACE, AND THE SENTENCE NO LONGER PRETENDS OTHERWISE (18 Sep 2026).
 *
 * It read: *"The name and the range save to the shared model."* BOTH clauses
 * were wrong, in different ways, and the 18 Sep edit caught only one of them.
 *
 * The RANGE clause was flatly FALSE.
 * `setPriorRange` writes `data.prior` through `updateNode` (round trip pinned
 * in `useAutosave.analysisFieldPersist.spec.ts`) and emits `prior_range_edit`,
 * which CEE handles `'fact_and_commit'`: a typed TURN FACT, and NO graph
 * write. This panel's own body has said so all along
 * (`FactorExternalPanel.tsx`: *"which CEE persists as a typed turn FACT and
 * which writes no graph"*), so the file contradicted itself across two
 * hundred lines and the rendered half was the wrong one.
 *
 * ⛔ WHY IT MATTERS MORE THAN A WORDING NIT. "the shared model" is this
 * estate's RESERVED PHRASE for a receipt-bearing GraphV3 write —
 * `mutationAuthority.ts` opens by defining it that way, and
 * `SHARED_MODEL_AUTHORITY_COPY` spends it on exactly that. Using it for a turn
 * fact tells the user their judgement is in the model the next analysis
 * reloads. It is not: CEE reloads `scenarios.graph`, and the range is not
 * there. That is the "believes their judgement is in the model when it is not"
 * failure, arriving through COPY rather than through a dead control.
 *
 * ⚠ IT STILL CLAIMS THE SAVE, because there genuinely is one. The range is
 * not dropped, not local-only and not lost: it reaches CEE and the
 * prior-facts loader reads it back. Downgrading this to "not sent yet" would
 * be the opposite error, and this slot has already shipped two sentences that
 * failed in opposite directions.
 *
 * ⭐⭐ AND THE NAME CLAUSE, WHICH THE 18 Sep EDIT LEFT UNCONDITIONAL WHILE
 * AUDITING ITS NEIGHBOUR — repaired here (18 Sep 2026, second pass).
 *
 * *"The name saves to the shared model."* asserts an OUTCOME. The rename's own
 * authority row does not: `mutationAuthority.ts` calls
 * `canvasNodeRenameWithServerHash` "⚠ CONDITIONAL", and this spec file's frozen
 * evidence line for it reads "accepted structural_rename with MATCHING SERVER
 * GRAPH HASH AND matching expected_label". A sentence auditing one clause for
 * truth while leaving the other asserting unconditionally is the same defect
 * one column across.
 *
 * ⛔ THE MECHANISM IS NOT THE ONE THE REVIEW NAMED, AND THE DIFFERENCE IS WHY
 * THIS WORDING IS WHAT IT IS. The review traced the harm to `store.ts:2513`
 * branching on `result.reason === 'no_server_graph_hash'`. That line is inside
 * `recordStructuralDeleteIntent` — the DELETE path. `captureStructuralRename`
 * does not own that reason at all; its own header is explicit that "A MISSING
 * BASE HASH IS NO LONGER A STAND-DOWN — it is a DEFERRAL", and it returns
 * `ok: true, deferred: baseGraphHash === null`. So the review's scenario — a
 * restored scenario renamed before any hash — does NOT go local-only; it is
 * queued and stamped by `resolveStructuralRenameBase` on the next turn.
 * (Trap 16: a grepped symbol proves presence in the repo, never presence on
 * the path you named.)
 *
 * ⭐ THE CONCLUSION SURVIVES ANYWAY, THROUGH TWO ARMS I DERIVED INSTEAD:
 *
 *   1. `node_not_server_held` — `structuralRename.ts` stands down when
 *      `authoritativeNodeIds` is a record we hold and the node is absent from
 *      it. `recordStructuralRenameIntent` then `return`s on `!result.ok` and
 *      `updateNodeLabel` applies the LOCAL write regardless. Nothing is
 *      queued, nothing is sent, AND NO NOTICE FIRES — the deferral toast is
 *      gated on `result.deferred`, which this arm never reaches. Reachable on
 *      this very pane: `CommandPalette` `add-factor` creates a factor
 *      client-side, `setCategory('external')` routes it to THIS panel, and the
 *      rename is then silently local-only under a notice promising a save.
 *   2. The DEFERRED arm — honest, but not a save yet. `store.ts` says it in
 *      terms: "until a turn supplies one the model genuinely does not hold the
 *      name — and the queue is memory-only, so a reload before that turn still
 *      loses it."
 *
 * ⛔⛔ AND THE WORDING THIS FILE ALREADY FORBIDS. "with your next message" was
 * the obvious repair and it is FALSE here, for the reason the edge sibling
 * records forty lines down: `useStructuralRenameEvents` is "⚠ NOT DEBOUNCED" —
 * on the happy path the drain runs "on the effect after the gesture's render"
 * and sends its OWN turn, not the user's next message. That phrasing is
 * correct ONLY on the deferred arm, which is exactly where
 * `STRUCTURAL_RENAME_DEFERRED_NOTICE` already spends it. A panel-level notice
 * covers every arm, so it cannot borrow an arm-specific sentence.
 *
 * ⭐ SO IT STATES A NECESSARY CONDITION AND ASSERTS NO OUTCOME. "only for
 * elements the model already holds" is TRUE on every arm — the stand-down arm
 * (absent from the record, never sent), the deferred arm (held, sent later),
 * the happy path (held, sent now), and the null-record sub-case where a send
 * is attempted for a node CEE has never seen and comes back `unproven`, so it
 * still does not REACH `scenarios.graph`. A necessary condition cannot be
 * falsified by an arm where it is merely insufficient, which is precisely the
 * property a static panel-level string needs.
 *
 * ⚠ WHY NOT A CONDITIONAL STRING, the way the EDGE pane picks between three.
 * That pane branches on `edgeStrengthReaches`, a property readable AT RENDER.
 * This condition is not: it is evaluated per gesture inside the store, against
 * `lastAuthoritativeGraph` and `lastServerGraphHash` at the moment the user
 * commits the name. Rendering a verdict minutes earlier would be a TOCTOU
 * claim — a turn can land between the read and the rename — so a render-time
 * branch here would be a confident sentence about a state nobody read.
 *
 * ⚠⚠ THE SIBLING IS NO LONGER UNTOUCHED, AND LEAVING IT WAS THE DEFECT.
 * This block used to end "It is out of this lane's scope; reported, not
 * edited." Correct about the facts, wrong about the consequence: three other
 * arms asserting the rename flatly, above the same `updateNodeLabel`
 * chokepoint, meant the product answered one durability question two ways
 * depending on which pane was open. All four now share
 * `RENAME_AUTHORITY_CLAUSE` — the reasoning is on that constant.
 *
 * ⭐⭐ AND THE RANGE CLAUSE, WHICH THE SECOND PASS WROTE UNCONDITIONALLY WHILE
 * MAKING ITS NEIGHBOUR CONDITIONAL — repaired here (18 Sep 2026, third pass).
 *
 * It read *"The range is recorded as your judgement for Olumi, not written
 * into the shared model."* The negative half is unconditionally true: there is
 * no graph write on any arm. The POSITIVE half — "is recorded" — asserts an
 * OUTCOME, and `setPriorRange` has three arms where no record is made and the
 * user is told nothing:
 *
 *   1. NO CARRIER. `if (!sendSystemEvent) return` (this file, in
 *      `setPriorRange`). `useOptionalConversationContext()` is null wherever no
 *      `ConversationProvider` is mounted — `MaybeConversationProvider`
 *      (`ReactFlowGraph.tsx:3173`) mounts one only under `isAiPanelV2Enabled()`.
 *      ⚠ SCOPE, STATED: that flag is ON for every fresh user on the deployed
 *      posture, so this is the LEAST reachable of the three and I am not
 *      claiming it as the live one.
 *   2. AN INVERTED OR NON-FINITE PAIR. `if (!Number.isFinite(min) ||
 *      !Number.isFinite(max) || min > max) return` — AFTER the local
 *      `updateNode`. Reachable on this pane in tech mode: `handleMinBlur`
 *      calls `setPriorRange(parsed, rangeMax ?? parsed)`, so on a 0.2-0.8 range
 *      a user typing a Min of 0.9 and stopping gets the inverted pair written
 *      locally and NOTHING sent. No toast, no return value, no disclosure.
 *   3. A REFUSED OR FAILED SEND. The emit is `.catch(() => {})` by design —
 *      "the local edit stands; re-editing re-emits". Honest as a policy, silent
 *      as an outcome.
 *
 * ⭐ SO THE CLAUSE STATES WHAT THE RANGE IS, NOT WHAT HAPPENED TO IT. "A range
 * you set here is a judgement for Olumi, not an edit to the shared model" is a
 * ROLE claim plus the unconditional negative, and a role claim cannot be
 * falsified by an arm where the send did not happen — the same property that
 * makes the rename clause's necessary condition safe. Both clauses now say only
 * what they can support, which is what the pair should have done together the
 * first time.
 *
 * ⛔ AND IT DOES NOT DOWNGRADE, WHICH IS THE OTHER DIRECTION THIS SLOT KEEPS
 * FAILING IN (trap 22b — a predicate guarding two opposite harms needs two
 * treatments). "Not sent yet" would be false: on the ordinary path the range
 * reaches CEE and the prior-facts loader reads it back, and a reader who
 * believed it was unsent would re-state the range in chat or route it through
 * the Model tab. The sentence still names Olumi as what the range is FOR.
 *
 * ⚠ "a range YOU SET HERE", not "the range". This panel's own body records why
 * `"your judgement"` is avoided for the DISPLAYED range: a drafted prior
 * arrives from CEE already populated, so the panel cannot establish who
 * authored what is on screen. Scoping the clause to the user's own action
 * sidesteps that without weakening it — the notice is about what your edits do,
 * which is a different subject from what the field currently holds.
 *
 * ⚠ THE SILENCE IN ARMS 2 AND 3 IS REPORTED, NOT FIXED. Making `setPriorRange`
 * disclose a stand-down is a behaviour change with a return-value contract
 * (the edge setters already model it — they return `'local_only'`), and it is
 * not a copy correction. Rowing it is the honest move; smuggling it into a
 * notice audit is not.
 *
 * ⚠ IT CLAIMS NO EFFECT ON RESULTS, DELIBERATELY. PLoT's prior pass is gated
 * four ways and one gate is silent: an `observed_state.value` present skips the
 * prior with no warning, as do a non-external category, a non-uniform
 * distribution and a degenerate range. "Your results will change" would be a
 * third false sentence in a slot that has already shipped two, failing in
 * opposite directions. This states the ROLE and the SAVE, never a per-run
 * outcome.
 *
 * ⚠ AND IT LEAVES THE COMPLEMENT OPEN, for the same reason the controllable
 * string does: `setDescription` has no carrier and stays fenced, and naming it
 * as THE exception would be false the moment another fence is added.
 */
// ⚠ Paul 23 Sep contract feedback point 11: boilerplate tail dropped; the
// three truths (conditional rename, the range's role, other edits unsent) kept.
export const INSPECTOR_FACTOR_EXTERNAL_REASON =
  `Renaming ${RENAME_AUTHORITY_CLAUSE}. A range you set here is a judgement for Olumi, not an edit to the shared model. Other edits here are not sent yet.`

/**
 * ⭐⭐ THE EDGE PANEL, once the blanket fence came off it.
 *
 * What saves here: the LINK STRENGTH. `setStrength` emits `edge_strength_edit`,
 * the contract member CEE has consumed since schemas 0.42.0, dispatched at
 * `system-events/dispatch.ts` and routed through the canonical
 * `adjust_edge_strength` handler. The direction rides with it when the user
 * drags the SIGNED slider, because stating a sign IS stating a direction.
 *
 * ⚠ IT NAMES THE STRENGTH AND NOTHING ELSE, DELIBERATELY. `setExistsProbability`
 * and `setStd` perform a local `updateEdge` and emit nothing at all, and
 * `setLabel` likewise — all three stay fenced inside the panel. Naming them as
 * THE exceptions would be false the moment a fourth is added, which is the same
 * reasoning the external-factor string above records.
 *
 * ⚠ AND IT PROMISES NO PER-RUN OUTCOME. Whether CEE's `graphCas.rpcEnforce`
 * posture lets the write land in `scenarios.graph` or answers a typed
 * `edge_strength_edit_reader_only` refusal is, in CEE's own words, "UNOBSERVABLE
 * FROM ANY CLIENT by construction". Under BOTH postures this sentence is true:
 * the edit is sent, and a refusal arrives as a message the user can read rather
 * than as silence. What was false before was the control moving with nothing
 * leaving the browser at all.
 */
// ⚠ Paul 23 Sep contract feedback point 11: boilerplate tail dropped.
export const INSPECTOR_EDGE_REASON =
  'The link strength saves to the shared model. Other edits here are not sent yet.'

/**
 * ⛔ THE SAME PANEL, FOR AN EDGE WHOSE STRENGTH CANNOT BE ASSERTED.
 *
 * `buildEdgeStrengthEditEvent` refuses to build an event for an edge with no
 * strength anybody set: the wire event carries an `expected` tuple, and there is
 * nothing truthful to put in it. `edgeStrengthEditIsAssertable` asks the builder
 * that question rather than re-deriving it, and it FAILS CLOSED.
 *
 * On those edges the strength control stays fenced and this sentence explains
 * why, rather than the panel offering a slider whose write returns
 * `not_wire_encodable` and stops before the wire — which is the silent lie this
 * whole change exists to end, and it would be worse for having a fresh coat of
 * paint on it.
 */
/**
 * ⭐ THE DRAWN-LINK POPULATION — a link the SERVER HAS NEVER RECEIVED.
 *
 * Its sibling below says *"Ask Olumi to set its strength"*, which is sound for a
 * server-held link and wrong here: `EdgePanel` offers this reader a control that
 * states it directly. It promises no outcome — the sender has no revert
 * lifecycle, so "sent" is honest and "saved" is not.
 */
export const INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON =
  'This connection is on your canvas only. Set its strength here to send it to the model.'
// ⛔ "SEND", NOT "SAVE", AND NOT "WITH YOUR NEXT MESSAGE" — both were in a draft
// of this line and both were false. `useStructuralAddEdgeEvents` is NOT
// debounced: it drains the queue as its own turn rather than riding the user's
// next message, so the deferred sibling's wording does not apply here. And that
// hook's own header is explicit that it has no revert lifecycle — "a refused
// edge stays on the canvas and the user learns of the refusal only from CEE's
// own sentence" — so the honest reading is "the edge is SENT", never "SAVED".

// ⚠ Paul 23 Sep contract feedback point 11: boilerplate tail dropped; the
// reason, the unsent state and the remedy (the Ask Olumi route at the top of
// the inspector) are kept.
export const INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON =
  'This connection has no strength on record for the model to check a change against, so edits here are not sent yet. Ask Olumi to set its strength.'

// ─── Node mutations ────────────────────────────────────────────────
export function useNodeMutations(nodeId: string) {
  const updateNode = useCanvasStore(s => s.updateNode)
  // P4 transport — prior-range edits ride the conversation dispatcher when a
  // provider is present; optional so isolated renders still edit locally.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent
  const getNode = useCallback(() => {
    return useCanvasStore.getState().nodes.find(n => n.id === nodeId)
  }, [nodeId])

  const setLabel = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, NODE_LABEL_MAX_LENGTH)
    if (trimmed && trimmed !== node.data?.label) {
      updateNode(nodeId, { data: { ...node.data, label: trimmed } })
    }
  }, [nodeId, updateNode, getNode])

  const setDescription = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, 500)
    if (trimmed !== node.data?.description) {
      updateNode(nodeId, { data: { ...node.data, description: trimmed || undefined } })
    }
  }, [nodeId, updateNode, getNode])

  const setThreshold = useCallback((raw: number, unit: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, {
      data: {
        ...node.data,
        goal_threshold_raw: raw,
        goal_threshold_unit: unit,
      },
    })
  }, [nodeId, updateNode, getNode])

  /**
   * Write `observedState.value` — ALWAYS the MODEL-scale number (for a capped
   * factor, raw/cap), never a display magnitude. The advanced editors bind
   * straight to it as "Normalised value" (0-1), which is why this setter does
   * NO normalising of its own: it stores exactly what it is given.
   *
   * `rawValue` (ROADMAP 1.346) is the OPTIONAL user-unit magnitude that
   * produced `value`. It exists so the panel's number input — which shows the
   * user-unit magnitude — can commit BOTH halves in ONE `updateNode`. Two
   * separate setter calls would push two history entries and fire two
   * freshness invalidations for a single user edit, and would leave a window in
   * which `value` and `raw_value` disagree about the same number. Callers that
   * genuinely edit only the normalised value (the advanced editors) pass one
   * argument and are unaffected.
   *
   * `opts.source` (ROADMAP 2.121 slice 1) is the OPTIONAL provenance stamp for
   * the number being committed, written in the SAME update for the same reason
   * `rawValue` is: `observedState.source` gates the "AI estimate" / "User
   * edited" pill and the "N to verify" count, so a marker committed in a second
   * `updateNode` would lag the number it describes by one history entry. It is
   * OPT-IN and defaults to no write — existing callers (the inspector panels and
   * advanced editors) are byte-identical without it, so this widening adds a
   * capability to the #513 arc rather than changing its behaviour. Callers that
   * want it pass the marker they can justify; nothing is defaulted to 'user'.
   */
  const setObservedValue = useCallback((value: number, rawValue?: number, opts?: { source?: string }) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        // `display_value` is CEE-authored prose for the PREVIOUS value ("£30k").
        // The formatter only lets a fresh raw_value outrank it when the unit is
        // a meaningful one — so after a commit with no raw_value, or with a
        // unitless/"scale" unit, a stale display_value keeps rendering verbatim
        // on the canvas node. Clearing both locations (CEE writes it at the top
        // level, the canonical home is inside observedState) drops the renderer
        // to its live fallback until the server's graph_patch supplies a fresh
        // one. Clearing is right and re-deriving here would be wrong: this
        // string is the server's to author.
        display_value: undefined,
        // ⭐⭐ THE TOP-LEVEL `extractionType`, FOR THE REASON THE LINE ABOVE
        // ALREADY GIVES — and this is the SECOND half of "clearing both
        // locations", which that comment names but only `display_value` got.
        //
        // `extractionType` has TWO storage locations in this codebase and they
        // are both live on a real board (measured on deployed `b6673341`,
        // usage-based-billing starter):
        //   · `observedState.extractionType` — the CEE-derived spelling,
        //     cleared inside the nested object below.
        //   · `data.extractionType` — what `setExtractionType` (:806) writes,
        //     and what `fac_vendor_cost` on that starter actually carries.
        // `usePreAnalysisData.ts:763-766` enumerates both in prose, so this is
        // the estate's own documented pair, not a new claim.
        //
        // ⚠⚠ WHY THIS LINE IS NOT OPTIONAL ONCE #1811 LANDS — the two PRs are
        // each correct ALONE and the pair is not (CLAUDE.md trap 21 / the
        // #1096-#1097 split-predicate shape). #1811 widens the READER to
        // `factorValueIsUnconfirmedEstimate`, which returns true on EITHER
        // spelling. Clearing only the nested one would leave a factor carrying
        // the `data` spelling still labelled Olumi's estimate after the user
        // typed a value — the exact defect this PR exists to close, reopened by
        // its neighbour. Fixed HERE rather than in #1811 so this setter is
        // complete on its own and the two are safe in EITHER merge order.
        //
        // ⚠ Cleared, not re-authored — same ruling as `display_value`.
        //
        // ⚠⚠ `null`, NOT `undefined` (independent review, PR #2046 Blocking 2).
        // `JSON.stringify` DROPS a key whose value is `undefined`, so the
        // withdrawal this comment describes did not survive the autosave round
        // trip (`scenarios.ts` `saveAutosave`) or a boot restore with no server
        // readback: after `JSON.parse(JSON.stringify(...))` the key is gone
        // entirely, which `valueSourceMark.tsx`'s `extractionMarkerWithdrawn`
        // cannot tell apart from a producer draft that never wrote one — so a
        // withdrawn (pending, unconfirmed) edit read back as "Olumi's estimate"
        // after a reload. `null` is a present key that survives serialisation
        // and is still overridden by anything spread after it, so "cleared, not
        // re-authored" is unchanged.
        extractionType: null,
        observedState: {
          ...existing,
          value,
          ...(typeof rawValue === 'number' && Number.isFinite(rawValue) ? { raw_value: rawValue } : {}),
          ...(opts?.source ? { source: opts.source } : {}),
          display_value: undefined,
          // ⭐⭐ AND `extractionType`, FOR EXACTLY THE REASON ABOVE — it described
          // the PREVIOUS value's origin, and the previous value is gone.
          //
          // CEE writes `extractionType: 'inferred'` beside `source:
          // 'cee_inference'` (`observedStateHelpers.ts:186-187`), and
          // `FactorNode.tsx:199` reads THAT field — not `source` — to decide
          // whether to print the `est.` marker. So without this line a user
          // typed a number and the card went on labelling it Olumi's estimate,
          // indefinitely: the spread preserved the stale marker while every
          // other trace of the old value was replaced.
          //
          // Measured on deployed `fd992149`: 5 of 5 valued factors on a starter
          // board carry `extractionType: 'inferred'` (contrast control: the same
          // 5 carry `source`), so this reached EVERY factor a user could edit.
          //
          // ⚠ CLEARED, NOT RE-AUTHORED, and that is the same ruling
          // `display_value` above is under: this field is the SERVER's to write.
          // Setting it to `'explicit'` here would be the client asserting an
          // extraction it did not perform. Clearing drops the card to its honest
          // fallback until the server's `graph_patch` re-authors it.
          //
          // ⚠ NOT A PROVENANCE CLAIM, so it is NOT receipt-gated (ROADMAP 2.304
          // stands). Withdrawing a statement that is now FALSE is not the same
          // act as asserting a new one — and a refusal restores it anyway, because
          // `revertOptimisticFactorEdit` puts back the whole captured
          // `observedState`, including the absence of keys that were absent.
          //
          // ⚠⚠ `null`, NOT `undefined` — see the top-level clear above for why.
          extractionType: null,
        },
      },
    })
  }, [nodeId, updateNode, getNode])

  const setIntervention = useCallback((factorId: string, value: number) => {
    const node = getNode()
    if (!node) return
    // Cast to `unknown` (not `number`) — existing intervention map may contain
    // V3 objects ({ value, source, ... }) under other keys. The spread below
    // preserves heterogeneous values; downstream display paths route every
    // read through `unwrapInterventionValue` (see labelUtils.ts).
    const existing = (node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: { ...existing, [factorId]: value },
      },
    })
  }, [nodeId, updateNode, getNode])

  const removeIntervention = useCallback((factorId: string) => {
    const node = getNode()
    if (!node) return
    const existing = { ...((node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined) }
    delete existing[factorId]
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: existing,
      },
    })
  }, [nodeId, updateNode, getNode])

  const setPriorRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.prior as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        prior: { ...existing, range_min: min, range_max: max },
      },
    })
    // P4 transport (schemas 0.34.0) — the user-set range REACHES THE SERVER.
    // This is the single seam every prior-range editor shares, so emitting
    // here covers all callers. Best-effort AFTER the local write (an absent
    // conversation context or failed send never breaks the local edit);
    // fail-closed on shapes the wire's own rule would refuse (inverted or
    // non-finite bounds build no event — never a production 422). CEE
    // persists the event as a typed turn fact and writes NO graph: carrying
    // the judgement is this seam's whole job; whether confirmed ranges feed
    // the maths is a separate, explicit design decision.
    if (!sendSystemEvent) return
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return
    const distribution = typeof existing?.distribution === 'string' && existing.distribution.length > 0
      ? existing.distribution
      : undefined
    void Promise.resolve(
      sendSystemEvent({
        type: 'prior_range_edit',
        payload: {
          target_id: nodeId,
          range_min: min,
          range_max: max,
          ...(distribution !== undefined ? { distribution } : {}),
        },
      }),
    ).catch(() => {
      // Background judgement receipt — the local edit stands; re-editing
      // re-emits. Mirrors the other best-effort background sends.
    })
  }, [nodeId, updateNode, getNode, sendSystemEvent])

  // ── observedState sub-field mutations ──

  const setObservedField = useCallback((field: string, val: unknown) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: { ...node.data, observedState: { ...existing, [field]: val } },
    })
  }, [nodeId, updateNode, getNode])

  const setObservedRawValue = useCallback((v: number) => setObservedField('raw_value', v), [setObservedField])
  const setObservedUnit = useCallback((v: string) => setObservedField('unit', v || undefined), [setObservedField])
  const setObservedCap = useCallback((v: number) => setObservedField('cap', v), [setObservedField])
  const setObservedBaseline = useCallback((v: number) => setObservedField('baseline', v), [setObservedField])
  const setObservedStd = useCallback((v: number) => setObservedField('std', v), [setObservedField])
  const setObservedSource = useCallback((v: string) => setObservedField('source', v || undefined), [setObservedField])

  // ── classification mutations ──

  const setCategory = useCallback((category: 'controllable' | 'observable' | 'external') => {
    const node = getNode()
    if (!node) return
    // `false`, not a delete: the user stated this, and an explicit denial is
    // readable by a surface that only ever asks `=== true`.
    updateNode(nodeId, { data: { ...node.data, category, categoryInferredByUi: false } })
  }, [nodeId, updateNode, getNode])

  const setExtractionType = useCallback((extractionType: 'explicit' | 'inferred') => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, extractionType } })
  }, [nodeId, updateNode, getNode])

  const setFactorType = useCallback((factor_type: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, factor_type: factor_type || undefined } })
  }, [nodeId, updateNode, getNode])

  // ── normalisation range ──

  const setStateSpaceRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.state_space as Record<string, unknown> | undefined
    const range = (existing?.range as Record<string, unknown>) ?? {}
    updateNode(nodeId, {
      data: { ...node.data, state_space: { ...existing, range: { ...range, min, max } } },
    })
  }, [nodeId, updateNode, getNode])

  // ── uncertainty drivers ──

  const setUncertaintyDrivers = useCallback((drivers: string[]) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, uncertainty_drivers: drivers } })
  }, [nodeId, updateNode, getNode])

  // ── goal cap ──

  const setGoalCap = useCallback((cap: number) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, goal_threshold_cap: cap } })
  }, [nodeId, updateNode, getNode])

  // ── risk probability × impact (P1.7) ──
  // Canonical scales (RiskNodeDataSchema): probability is a 0-1 number, impact is
  // the RiskImpact enum. Callers pass values already on those scales — the panel
  // owns any percentage↔decimal conversion. The clamp here is defensive
  // normalisation only (same class as the observed/belief clamps).

  const setProbability = useCallback((probability: number) => {
    const node = getNode()
    if (!node) return
    if (Number.isNaN(probability)) return
    const clamped = Math.min(1, Math.max(0, probability))
    updateNode(nodeId, { data: { ...node.data, probability: clamped } })
  }, [nodeId, updateNode, getNode])

  const setImpact = useCallback((impact: RiskImpact) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, impact } })
  }, [nodeId, updateNode, getNode])

  return {
    setLabel, setDescription, setThreshold, setObservedValue,
    setIntervention, removeIntervention, setPriorRange,
    setObservedRawValue, setObservedUnit, setObservedCap,
    setObservedBaseline, setObservedStd, setObservedSource,
    setCategory, setExtractionType, setFactorType,
    setStateSpaceRange, setUncertaintyDrivers, setGoalCap,
    setProbability, setImpact,
  }
}

/**
 * How an edge-strength commit left the seam.
 *
 * ⭐⭐ FOUR TOKENS, NOT THE REFERENCE'S THREE, AND THE FOURTH IS THE POINT.
 * `FactorValueProposalOutcome` (`canvas/hooks/useModelEditAuthority.ts`) is
 * `dispatched | local_only | not_encodable`, and the standing rule it exists to
 * enforce is that a NON-SAVE IS NEVER FLATTENED INTO "SAVED" — a boolean return
 * would have made the collapse the path of least resistance.
 *
 * Edge strength has one non-save the factor path does not: an edit that landed
 * LOCALLY but could not be encoded for the wire, because the edge's `expected`
 * tuple is not assertable (its weight or direction is a UI default, so we do not
 * know what the server holds). Folding that into `local_only` would put two
 * genuinely different states under one name — this estate's signature defect,
 * CLAUDE.md trap 21 — and the two need opposite follow-ups: `local_only` is
 * fixed by mounting a ConversationProvider, `not_wire_encodable` is fixed by
 * the model gaining a producer-stated strength for that edge.
 *
 * - `dispatched`         — the local write landed AND the wire event is with the
 *                          conversation dispatcher. NOT a claim that the server
 *                          accepted it: CEE may answer a typed refusal (see
 *                          `edgeStrengthEdit.ts` on the `rpcEnforce` gate), and
 *                          nothing here can observe that.
 * - `local_only`         — the local write landed; no ConversationProvider is
 *                          mounted, so no turn was sent. The same degradation
 *                          every other setter has: isolated renders edit
 *                          locally, never throw.
 * - `not_wire_encodable` — the local write landed; the edit could not be
 *                          truthfully described to the server, so it was not
 *                          sent. The user's edit is real on this canvas and the
 *                          server does not have it.
 * - `not_encodable`      — nothing happened anywhere. No such edge, or a
 *                          non-finite number.
 *
 * ⚠ NO CALLER READS THIS TOKEN YET, and that is recorded rather than hidden.
 * Four call sites drive `setStrength`. ⚠ CORRECTED: `EdgePanel` now READS the return — an outcome other than `dispatched` means no settlement is coming and the panel must not wait for one. The token
 * exists so the states are NAMEABLE and testable at the seam; giving each one a
 * user-visible sentence is a copy change, and a sibling lane owns copy today.
 * Under the reachable posture CEE itself discloses the refusal in the
 * conversation, which is the estate's existing channel for exactly this.
 */
export type EdgeStrengthCommitOutcome =
  | 'dispatched'
  | 'local_only'
  | 'not_wire_encodable'
  | 'not_encodable'

/**
 * The outcome of RATIFYING a strength the server already holds.
 *
 * ⚠ NAMED APART FROM `EdgeStrengthCommitOutcome`, AND THE SPLIT IS TRAP 21.
 * That one answers *"will the server accept this NUMBER?"*; this answers *"did a
 * statement of agreement leave?"* — and it deliberately has NO member meaning
 * "committed", because confirming writes NOTHING locally.
 *
 * ⛔ `dispatched` MEANS A STATEMENT LEFT, NOT THAT IT LANDED. No caller may
 * render it as agreement recorded. That is `proposeEdgeStrengthConfirmation`'s
 * own ruling and it is repeated here because the caller this type exists for is
 * the one that broke it.
 */
export type EdgeStrengthConfirmOutcome =
  | 'dispatched'
  | 'refused_unassertable'
  | 'no_carrier'
  | 'not_encodable'

// ─── Edge mutations ────────────────────────────────────────────────
export function useEdgeMutations(edgeId: string) {
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent
  const getEdge = useCallback(() => {
    return useCanvasStore.getState().edges.find(e => e.id === edgeId)
  }, [edgeId])

  /**
   * `mean` is a SIGNED strength: the magnitude is `|mean|` and, by default, the
   * direction is derived from its sign. That is the right contract for a signed
   * control (`EdgePanel`, `EdgeAdvancedEditor` both drive a signed slider).
   *
   * `opts.preserveDirection` (adversarial review F1/F2) writes the MAGNITUDE
   * ONLY and leaves the edge's `direction` exactly as it is — including ABSENT.
   *
   * WHY THIS LIVES HERE AND NOT IN THE CALLER. A magnitude cannot encode a
   * direction, so no arithmetic at a call site can express "set the size, leave
   * the sign alone" through a signed parameter:
   *
   *   - AT ZERO the sign is not ambiguous, it is UNREPRESENTABLE. `-0 >= 0` is
   *     `true` in JavaScript, so a caller re-applying a negative direction as
   *     `-n` hands over `-0` and this rule reads it as POSITIVE. That is the
   *     proven regression: zeroing a negative edge's weight flipped its
   *     direction, silently, and a later magnitude restore came back with the
   *     wrong sign.
   *   - ABSENCE has no encoding at all. An edge with no `direction` would have
   *     one FABRICATED by any sign-derived write — and edges are in the
   *     canonical graph-hash keep-list, so that is analysis-relevant state.
   *
   * A caller-side patch could only skip the write (dropping the user's edit) or
   * invent a non-zero magnitude, and would leave the identical trap armed for
   * the next magnitude-only editor. What was missing is an interface, not a
   * calculation. The sign rule itself is left alone: for a genuinely signed
   * control `-0` and `0` are the same number and neither direction is more
   * honest than the other, which is precisely why zero must be preserved rather
   * than re-derived.
   *
   * With `preserveDirection` the emitted patch is `{...edge.data, weight,
   * weightSource}` — byte-identical in shape to the hand-rolled write the Model
   * tab used to do, now inside the manifest.
   */
  const setStrength = useCallback((
    mean: number,
    opts: {
      preserveDirection?: boolean
      /**
       * ⛔⛔ REQUIRED, AND THE FIRST VERSION OF THIS CHANGE HAD IT OPTIONAL —
       * WHICH REPRODUCED THE DEFECT INSIDE THE FIX FOR IT.
       *
       * `settleSystemEventSend` was EXTRACTED so the next carrier would get the
       * derivation by construction. It did not work: four carriers shipped a
       * bare send past it, because a helper you must REMEMBER to call leaves
       * the silent form available and attractive.
       *
       * The CEE lane's equivalent seam did not suffer this, and the difference
       * is structural, not cultural: `mayPresentLeaderClaimForFact` REPLACED the
       * narrow accessor at every call site, so the composed answer is the only
       * thing to reach for. Same word, "extraction"; opposite outcomes.
       *
       * ⭐ So this is not optional. Making it required forced FOUR callers to
       * decide — one of which (`EdgeAdvancedEditor:80`) was passing no options
       * at all and was discovered only because the compiler demanded it. A gap
       * a type system can find is worth more than a rule a reader must recall.
       */
      onSendSettled: (settlement: SystemEventSendSettlement, detail: SystemEventSendSettlementDetail) => void
    },
  ): EdgeStrengthCommitOutcome => {
    const edge = getEdge()
    if (!edge) return 'not_encodable'
    if (!Number.isFinite(mean)) return 'not_encodable'
    // Built from the edge as it was BEFORE the local write — `expected` is an
    // assertion about the PAST, and the same read feeds both halves so the wire
    // event and the store update can never describe different edges.
    const event = buildEdgeStrengthEditEvent({
      edge,
      requestedMean: mean,
      preserveDirection: opts?.preserveDirection,
    })
    const absWeight = Math.abs(mean)
    updateEdge(edgeId, {
      data: {
        ...edge.data,
        weight: absWeight,
        // The key is OMITTED, not set to undefined: the store merges
        // `{...e.data, ...updates.data}`, so an explicit `direction: undefined`
        // would overwrite a real direction with nothing.
        // The direction stamp rides with the direction, exactly as
        // `weightSource` rides with the weight: a user dragging the SIGNED
        // slider IS stating a direction, so the value stops being a default in
        // the same update. Under `preserveDirection` neither key is written —
        // a magnitude edit must not mint a direction claim (ROADMAP 2.263).
        ...(opts?.preserveDirection
          ? {}
          : { direction: mean >= 0 ? 'positive' : 'negative', directionSource: 'user' }),
        weightSource: 'user',
      },
    })

    // ⭐ THE LOCAL WRITE ABOVE IS UNCONDITIONAL, AND THAT IS A DECISION, NOT AN
    // OVERSIGHT. `useModelEditAuthority.proposeFactorValue` fails CLOSED — an
    // unencodable factor value writes nothing at all — and the temptation is to
    // copy that here. It would be wrong: a factor value has a wire carrier for
    // every reachable value, whereas an edge whose weight came from
    // `DEFAULT_EDGE_DATA` has no assertable `expected` AT ALL, so failing
    // closed would make the slider do NOTHING for a whole class of edges. That
    // trades a disclosed gap for a silently dead control, which is the worse of
    // the two. The outcome token below is how the gap is disclosed instead.
    if (!event) return 'not_wire_encodable'
    if (!sendSystemEvent) return 'local_only'
    /**
     * ⛔⛔ THE COMMENT THAT USED TO SIT HERE STATED THE MECHANISM CORRECTLY AND
     * DREW THE OPPOSITE CONCLUSION. It read: *"a server REFUSAL is not a
     * failure — the promise resolves normally."* True, and that is precisely
     * WHY the refusal was invisible: a resolved promise carries the server's
     * "no" straight past a `.catch`.
     *
     * `settleSystemEventSend`'s own header names this exact family — *"the two
     * `edge_strength_edit` `confirm_current` carriers each shipped
     * `.catch(() => {})`: every settlement collapsed to silence, INCLUDING THE
     * SERVER SAYING NO."* Both of those were fixed. This one, the EDIT carrier,
     * was not — the rule was written on one carrier and swept to its siblings
     * but not to this one, which is the defect that module exists to end.
     *
     * ⚠ SCOPE, UNCHANGED: this settles what the CALLER MAY SAY ABOUT THE SEND.
     * `'sent'` still means a POST left and the server has not answered. Whether
     * the MODEL changed arrives separately, on the turn. This is not an applied
     * channel and must not be rendered as one.
     *
     * ⭐ ALL THREE LIVE CALLERS ARE COVERED BY THIS ONE EDIT — the band buttons
     * (`EdgePanel:627`), the fine-tune slider (`EdgePanel:676`) and the Model
     * tab's relationship row (`useModelEditAuthority.proposeEdgeStrength`) all
     * come through here. `deferIfBusy` is deliberately NOT passed: changing it
     * would alter behaviour for all three at once, and that is a separate
     * decision, taken deliberately or not at all.
     */
    /**
     * ⚠ `opts?.` AT RUNTIME WHILE THE TYPE STAYS REQUIRED — and the two are
     * doing different jobs, deliberately.
     *
     * The REQUIRED type is the enforcement: it is what forced all four carriers
     * to decide and what surfaced `EdgeAdvancedEditor`'s silent β field. That
     * does not change.
     *
     * But `useInspectorMutations.writtenFields.spec.tsx` is a DERIVED manifest
     * guard — it casts the setters to `Record<string, (...a: unknown[]) => void>`
     * so it can drive every one generically, which means TypeScript cannot see
     * its calls at all. A one-argument call therefore passed the typecheck and
     * threw at `opts.preserveDirection` inside a shard.
     *
     * ⛔ A THROW HERE IS THE WRONG FAILURE. This runs in a click handler on a
     * live panel; a caller that omits the handler should lose the disclosure,
     * not crash the inspector. So the optional chain is defence against a
     * dynamic caller, and the type is what stops a real one omitting it.
     */
    //
    // ⭐ ONE WRITER (served witnesses 23 Sep 02:49Z and, after #1895, 4c6ec07b):
    // the send now has a life after it leaves. While the canvas shows a
    // magnitude the server has not confirmed, registration is held
    // (`editDeliveryHold` signal 5). The turn carries its own write
    // (`optimisticEdgeEdit`) so an APPLIED receipt acknowledges the model past
    // it — no whole-graph register follows, and none can drop the provenance
    // CEE just recorded. A proven no-write reverts; anything unconfirmed keeps
    // the number and stays held. `edge.data` is the PRE-write read above.
    const before = (edge.data ?? {}) as Record<string, unknown>
    markEdgeEditInFlight(edgeId, absWeight, before)
    settleSystemEventSend(
      sendSystemEvent(event, { optimisticEdgeEdit: { edgeId, sentMagnitude: absWeight, before } }),
      // The detail rides beside the resolved settlement: WHICH no-write it was (a stopped
      // turn is not a moved model) is the envelope's fact, not the resolver's.
      (settlement, detail) => opts?.onSendSettled?.(resolveEdgeEditSettlement(edgeId, absWeight, settlement), detail),
    )
    return 'dispatched'
  }, [edgeId, updateEdge, getEdge, sendSystemEvent])

  const setStd = useCallback((std: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, strengthStd: std, strengthStdSource: 'user' } })
  }, [edgeId, updateEdge, getEdge])

  const setExistsProbability = useCallback((ep: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, {
      data: { ...edge.data, beliefExists: ep, beliefExistsSource: 'user' },
    })
  }, [edgeId, updateEdge, getEdge])

  const setLabel = useCallback((value: string) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, label: value || undefined } })
  }, [edgeId, updateEdge, getEdge])

  /**
   * ⭐ THE DEFECT THIS CLOSES, as the user experiences it: picking "helps" or
   * "hurts" changed the line, stamped `directionSource: 'user'` — and told the
   * server nothing. The claim survived until the next reload and then silently
   * vanished, which is the harm CEE's own dispatch table names in terms ("a lie
   * told by omission"). Direction is the most load-bearing fact in a causal
   * model, so an analysis re-run after the fix silently used the OLD sign.
   *
   * ⚠ THE LOCAL WRITE IS UNCONDITIONAL, AND IT IS THE SAME DECISION `setStrength`
   * MAKES AND DOCUMENTS ABOVE — read that note rather than re-deriving this one.
   * An edge with no server-stated `expected` tuple has nothing truthful to
   * assert, so failing closed would make the control do NOTHING for a whole
   * class of edges: a disclosed gap traded for a silently dead affordance, the
   * worse of the two.
   *
   * ⛔ CORRECTED FORWARD, 10 Sep 2026 (independent review) — THE TWO CLAIMS THAT
   * USED TO CLOSE THIS PARAGRAPH EACH ASSERTED A BEHAVIOUR NOTHING PERFORMS.
   * They are corrected rather than deleted so they are not re-derived.
   *
   *   · IT READ *"The outcome token is how the gap is disclosed instead"*.
   *     NOTHING IS DISCLOSED TO A USER TODAY. Both `setDirection` call sites
   *     DISCARD the return — `EdgeAdvancedEditor.tsx:127` and
   *     `RelationshipsSection.tsx:284`, neither assigns it — and the token's own
   *     note at `:516` above says so in terms: "NO CALLER READS THIS TOKEN YET,
   *     and that is recorded rather than hidden." Citing that honest disclosure
   *     and then stating its opposite is the defect, not a wording slip. What
   *     the token actually does is make the states NAMEABLE and testable AT THE
   *     SEAM. On an edge with no server-stated tuple the user still gets a local
   *     write, no event and no message of any kind, and the edit still vanishes
   *     on reload, silently. That is a gap this lane does not close and does not
   *     regress; giving each outcome a user-visible sentence is a copy change a
   *     sibling lane owns.
   *   · IT READ *"`edgeDirectionEditIsAssertable` is how a surface gates the
   *     affordance PER EDGE before offering it"*. IT HAS ZERO PRODUCT
   *     CONSUMERS: one definition (`edgeStrengthEdit.ts:373`), six spec
   *     references and four comments, and no import anywhere outside its own
   *     module. Contrast control from the same sweep, so this is a real absence
   *     and not a blind probe: `edgeStrengthEditIsAssertable` IS consumed —
   *     imported at `ModelTabV2Panel.tsx:85`, used at `:519`. The gate is real,
   *     correct and tested; it is what a surface WOULD ask per edge before
   *     offering the affordance. Restore the present tense when a caller asks
   *     it.
   *
   * ⛔ CORRECTED FORWARD, 9 Sep 2026 (independent review) — DO NOT ACT ON THE
   * PARAGRAPH BELOW AS CURRENT. It was honest when written and is now false in
   * both limbs, and it is kept rather than deleted because it is the record of
   * why CEE #1393 happened.
   *
   *   · THE POSTURE IS `enforce` ON THE DEPLOYED BUILD — measured, not read off
   *     a config default. So the demotion described below DOES NOT FIRE, and the
   *     "user who changed direction is told about strength" case is not
   *     reachable on staging.
   *   · THE COPY NO LONGER EXISTS. CEE `083e0da` replaced it, live 12:35:24Z on
   *     9 Sep, citing this review. So the closing instruction — "THE FIX IS ONE
   *     STRING IN THE OTHER REPO, deliberately not made here" — would now send a
   *     reader to make a fix that is already deployed.
   *
   * The lesson worth keeping is the one this block now demonstrates twice: a
   * posture inferred from a config file is not the deployed posture, and a
   * disclosed gap goes stale exactly like any other hand-maintained claim.
   *
   * ─── THE ORIGINAL DISCLOSURE, HISTORIC ───
   *
   * ⚠⚠ THE ONE KNOWN IMPRECISION THIS OPENS, DISCLOSED RATHER THAN LEFT TO BE
   * DISCOVERED — and it is the first thing to attack in review. CEE demotes
   * `edge_strength_edit` to a typed refusal while `config.features.graphCas
   * .rpcEnforce !== true`, which is the DEFAULT-SHADOW posture, and its
   * per-kind refusal copy reads *"I can't apply this link-strength change in
   * this version"*. A user who changed DIRECTION is then told about STRENGTH.
   * CEE's own dispatch table states the standard this falls short of, in terms:
   * *"a refusal that names the wrong gesture is worse than a generic one,
   * because it tells the user something false about their own action"*
   * (`system-events/dispatch.ts`, above `READER_ONLY_REFUSAL_COPY`).
   *
   * WHY IT IS SHIPPED ANYWAY, stated so the trade is reviewable rather than
   * assumed: before this change the same gesture produced SILENCE and an edit
   * that vanished on reload, which is strictly worse than an imprecise but
   * non-fabricated refusal. Under `ENFORCE` the write lands and no refusal is
   * emitted at all.
   *
   * THE FIX IS ONE STRING IN THE OTHER REPO, deliberately not made here: that
   * copy is CEE-owned and its entry now serves two gestures, so it should read
   * neutrally about which half changed (the table's own header notes an
   * unlisted kind falls back to *"I can't apply this change"*, which "can never
   * produce a FALSE sentence"). Scope-expansion rule: named at the boundary,
   * not crossed.
   */
  const setDirection = useCallback((
    direction: 'positive' | 'negative',
    opts?: {
      /** How the send settled, resolved against the model — the same channel `setStrength` reports on. */
      onSendSettled?: (settlement: SystemEventSendSettlement, detail: SystemEventSendSettlementDetail) => void
    },
  ): EdgeStrengthCommitOutcome => {
    const edge = getEdge()
    if (!edge) return 'not_encodable'
    // Built from the edge as it was BEFORE the local write — `expected` is an
    // assertion about the PAST, and the same read feeds both halves so the wire
    // event and the store update can never describe different edges.
    const event = buildEdgeDirectionEditEvent({ edge, direction })
    const before = (edge.data ?? {}) as Record<string, unknown>
    // The user picking +/− is the ONLY thing that turns the defaulted
    // `direction: 'positive'` into a stated one (ROADMAP 2.263).
    updateEdge(edgeId, { data: { ...edge.data, direction, directionSource: 'user' } })
    if (!event) return 'not_wire_encodable'
    if (!sendSystemEvent) return 'local_only'
    // ⛔ THIS USED TO FIRE AND FORGET (`.catch(() => {})`), so a refused flip
    // stayed on screen, in the store and in autosave while the model kept the
    // old sign (independent review of #1950, 5820041073). It now takes the
    // `setStrength` route: in flight, settled, reverted on a proven no-write.
    // The magnitude is the one the event asserts (`buildEdgeDirectionEditEvent`
    // sends `|expected.mean|`); the SIGN is what this edit changes, so it is
    // carried as `sentDirection` and every proof asks it.
    const sentMagnitude = Math.abs(serverStatedStrengthOf(before)?.mean ?? Number.NaN)
    markEdgeEditInFlight(edgeId, sentMagnitude, before, direction)
    settleSystemEventSend(
      sendSystemEvent(event, { optimisticEdgeEdit: { edgeId, sentMagnitude, before, sentDirection: direction } }),
      (settlement, detail) =>
        opts?.onSendSettled?.(resolveEdgeEditSettlement(edgeId, sentMagnitude, settlement, direction), detail),
    )
    return 'dispatched'
  }, [edgeId, updateEdge, getEdge, sendSystemEvent])

  /**
   * ⭐⭐ "I AGREE WITH THIS ESTIMATE", SENT AS THE ACT IT IS.
   *
   * ⛔⛔ THE DEFECT THIS CLOSES WAS WIRE-WITNESSED ON SERVED `1d0306a0`, not
   * reasoned. The inspector's Confirm routed through `setStrength`, which emits
   * `intent: 'set'` at a magnitude EQUAL to the persisted value — precisely the
   * case CEE refuses as `set_target_unchanged`. Captured response, verbatim:
   * *"That link already has exactly that strength and direction, so I haven't
   * recorded it as your judgement. Confirm the current strength explicitly if
   * you want to adopt the existing value."* `blocks: []`, `graph_hash`
   * UNCHANGED, `weightSource` still `cee`. The person's agreement went nowhere.
   *
   * `buildEdgeStrengthConfirmEvent` is the carrier that CAN land it. It takes no
   * requested value, so this cannot become a silent `set` wearing a
   * confirmation's name.
   *
   * ⛔ IT WRITES NOTHING LOCALLY — the same load-bearing decision
   * `proposeEdgeStrengthConfirmation` documents at length: stamping provenance
   * before the server agrees would make the product assert that a person
   * ratified a value on a turn that may still be refused. CEE owns this
   * provenance; the canvas learns it from the response, or does not claim it.
   */
  const confirmCurrentStrength = useCallback((): EdgeStrengthConfirmOutcome => {
    const edge = getEdge()
    if (!edge) return 'not_encodable'
    // Asks the BUILDER, never a local re-derivation: an edge whose strength
    // nothing proves the server stated has no `expected` tuple to ratify.
    const event = buildEdgeStrengthConfirmEvent({ edge })
    if (!event) return 'refused_unassertable'
    if (!sendSystemEvent) return 'no_carrier'
    void Promise.resolve(sendSystemEvent(event)).catch(() => {
      /* Swallowed as every sibling send is. Nothing local was written, so there
         is nothing to revert. */
    })
    return 'dispatched'
  }, [getEdge, sendSystemEvent])

  return { setStrength, setStd, setExistsProbability, setLabel, setDirection, confirmCurrentStrength }
}
