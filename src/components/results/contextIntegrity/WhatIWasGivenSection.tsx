/**
 * WhatIWasGivenSection — ROADMAP 2.973.
 *
 * Four calm answers to the question a strategist actually asks:
 *
 *   1. What you gave me      — their brief, as they wrote it.
 *   2. What I used           — figures from the brief that reached the model.
 *   3. What I estimated      — figures the product supplied that they did not.
 *   4. Not modelled yet      — what has not made it in, and how to add it.
 *
 * ── WHY IT READS THE WAY IT DOES ───────────────────────────────────────────
 * The 2026-08-08 context-integrity trace measured that the brief is persisted
 * byte-verbatim and read by nothing, while most of what a strategist quantifies
 * never reaches the model. That is a real gap — but a screen full of loss
 * counts is a DIAGNOSTIC ARTEFACT, not a product. The register here is a good
 * analyst showing their working, not a system apologising:
 *
 *   · "Not modelled yet" — an invitation to add something, never a confession.
 *     Nothing on screen says "dropped", "lost", or "discarded".
 *   · NO PIPELINE VOCABULARY. No extraction types, no provenance labels, no
 *     stage names, no error codes. A user should never have to know our
 *     architecture to read their own decision.
 *   · The internal manifest stays precise and technical; only the RENDERING is
 *     human. The two are deliberately kept apart.
 *   · Actionable where honest: an unmodelled figure gets an "Add this" that
 *     starts the conversation to include it. Where no real action exists —
 *     everything in "what I estimated" — none is offered.
 *
 * ── THE HONESTY RULE THIS COMPONENT ENFORCES ───────────────────────────────
 * `manifest === null` means CEE told us NOTHING. It renders as an explicit
 * "I can't show this yet" — never an empty list, and never silence. Both of
 * those read as "everything made it in", which on a brief we demonstrably lose
 * content from is a worse lie than the silence it replaces.
 *
 * ── THE IDENTITY GATE ──────────────────────────────────────────────────────
 * This surface renders ONLY when the context-integrity store's `scenarioId`
 * positively matches the live `currentScenarioId`. It shipped without that
 * check and rendered A PREVIOUS DECISION'S BRIEF, verbatim, under "What you
 * gave me" — the trust anchor telling the user something false about their own
 * input, with a cross-decision data-leak shape on any shared session. See the
 * store's header for the mechanism. The gate lives at the point of RENDER, not
 * only at the point of write, so that a store nobody cleared cannot defeat it.
 *
 * ── MOUNT ──────────────────────────────────────────────────────────────────
 * Hosted in the UNCONDITIONAL `v7-top-group`. `ResultsBody` forks on
 * `analysisHeroPanel` and this estate has twice shipped a feature dark by
 * binding it to the arm the deployed flags switch off (CLAUDE.md trap 3b).
 */

import { useId, useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'

import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../../canvas/store'
import { useContextIntegrityStore } from '../../../canvas/stores/contextIntegrityStore'
import { useOptionalConversationContext } from '../../../canvas/conversation/ConversationContext'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import type { InferredFactor, NotModelledItem } from '../../../adapters/cee/notModelled'
import { ClampToggle } from '../ClampToggle'
import { figureTallySubtitle } from './figureTallySubtitle'
import { surface } from '../analysisNew/panelSurfaces'
/**
 * ⭐⭐ THE ONE CONTROL FOR THIS ACT, IMPORTED — NOT A SECOND ONE WRITTEN HERE.
 *
 * This control was authored inline in this file. It moved to
 * `FactorValueControl` the moment a SECOND surface needed the same act (the
 * Reasoning tab's "Model gaps the analysis worked around" rows, whose sentences
 * end "Add its current value." and offered nothing to press). Nothing about its
 * behaviour changed in the move: the positive node resolution, the
 * no-carrier-no-control rule, the three-outcome mapping and the
 * stays-open-on-refusal rule all travelled with it.
 *
 * Underneath, it still commits through `useFactorValueCommit` — the same hook
 * the model strip and the driver influence chart use — which owns the parse
 * rule and delegates to `useModelEditAuthority.proposeFactorValue`, which owns
 * the SCALE contract, the optimistic local write and the undo. This surface
 * supplies an identity and decides nothing else. A parallel writer, or a second
 * copy of the control, is how two authorities under one name get created
 * (CLAUDE.md trap 12/21).
 */
import { FactorValueControl } from '../analysisNew/FactorValueControl'
/**
 * The control's words are the model strip's words, imported rather than
 * re-typed. One act, one vocabulary: a second set of strings for "change this
 * value" would drift from the first the day either is adjusted.
 */
import { ANALYSIS_NEW_COPY } from '../analysisNew/analysisNewCopy'

/** Rows shown per group before "show all". Keeps the open state scannable. */
const VISIBLE_ROWS = 6

/**
 * ── ONE LIST RHYTHM, ONE ROW BOX ───────────────────────────────────────────
 * The container rhythm was written three times in this file and the row box
 * twice verbatim (plus once in part). A reader takes this panel to be one
 * surface, so the day one of the copies is adjusted and the others are not,
 * the drift is visible to them — the hand-maintained mirror at user-facing
 * scale (CLAUDE.md trap 12).
 */
const LIST_CLASS = 'mt-1 space-y-0.5'
const ROW_BOX = 'rounded px-2 py-1 odd:bg-panel-hover/40'
/** A plain text row. */
const TEXT_ROW_CLASS = `${typography.panelBody} ${ROW_BOX} text-text-body`
/** A row that also carries an action on the right. */
const ACTION_ROW_CLASS = `flex items-baseline justify-between gap-2 ${ROW_BOX}`

const COPY = {
  heading: 'What you gave me, and what I did with it',
  givenHeading: 'What you gave me',
  usedHeading: 'What I used',
  estimatedHeading: 'What I estimated',
  // ⚠ THE PREVIOUS WORDING WAS FALSE ON OUR OWN FIXTURE, and it is worth
  // stating why. It read "You didn't give me a figure for these" — but B1's
  // brief says "our NRR is 112%", and the panel showed 112% under "not
  // modelled yet" while listing Net Revenue Retention here, led by that
  // sentence. CEE answers "does this factor's number trace to the brief?";
  // the copy asserted "did you give me a figure for this?" — a DIFFERENT
  // question about the user's input (trap 21: two questions under one
  // number). The derivation was right; the sentence was wrong. It now claims
  // only what the derivation actually establishes: these numbers are ours.
  estimatedLead:
    "The numbers behind these are mine, not yours. If you have better ones, tell me and I'll use them.",
  notYetHeading: 'Not modelled yet',
  notYetLead: 'These are in your brief but not in the model. Ask about any that matter.',
  consideredLead: 'I also considered these and left them out:',
  // ⚠ SAME POPULATION CORRECTION AS THE SUBTITLE (ROADMAP 2.1000, 11 Sep 2026).
  // This read "This covers figures you mentioned", which attributes the lists
  // below to the user's own words. They are what CEE's quantity extractor found
  // in the brief, and it misses forms it was never written for. A caveat whose
  // whole job is to say "these lists are not exhaustive" may not open by
  // misdescribing what they are lists OF. See `figureTallySubtitle.ts`.
  caveatLead: 'This covers the figures I found in your brief. It does not yet track:',
  unknown:
    "I can't show this yet for this decision — so please don't read the absence as everything having made it in.",
  noBrief: "I don't have your original wording saved for this decision.",
  /**
   * ⚠ THIS LABEL SAID "Add this", AND THE PRODUCT COULD NOT DO IT. Derived
   * against the LIVE deployed router (staging `cee-staging.onrender.com`,
   * 2026-08-11, 12 arms over 12 fresh scenarios, one arm per scenario so only
   * the phrasing varied; evidence in the PR body):
   *
   *   the shipped message, a bare figure  → no mutation; the engine replies
   *     "it is not clear what it should causally connect to… Could you clarify
   *      what this figure should influence?"
   *   figure + its brief sentence, or a named factor, with NO causal target
   *                                       → the LLM DOES emit operations and the
   *     GRAPH VALIDATOR refuses them: `ORPHAN_NODE`. A worse outcome than the
   *     question — a structural error where there had been a useful sentence.
   *   connected to the options but not the goal  → `NO_PATH_TO_GOAL`.
   *   an instruction NAMING a causal target that keeps the graph valid
   *                                       → still refused, `PIPELINE_OWNED_FIELD`
   *     ("the candidate targets an analysis-derived, pipeline-owned field") — the
   *     factors that feed the goal in a drafted graph are themselves
   *     analysis-derived, so naming one does not rescue the add.
   *   control, the estate's proven edit grammar ("Change X to Y.", target derived
   *     from THIS run's graph by identity) → applied. The control is why the
   *     refusals are evidence about the phrasings and not about a sick service.
   *
   * ⚠ AN EARLIER VERSION OF THIS COMMENT SAID THE OPPOSITE — "**HELD**, then
   * confirm → applied" — AND IT WAS FALSE. Two arms were scored HELD by a probe
   * whose classifier read `d.verdict === 'held' || !!d.blocker_code`, so the
   * disjunct overrode an explicit `verdict: "rejected"` that happened to carry a
   * blocker code. Both were REJECTED, neither carried a `held_proposal` block, and
   * no arm in any round ever sent a confirmation turn — the "confirm → applied"
   * half was never executed at all. Caught in review. It is trap 13c exactly: a
   * 13-mutant kit measures whether the TESTS can detect a change, never whether
   * the ORACLE is right, so a full kill-rate certified nothing about this.
   *
   * ⚠ SO THE LADDER IS UNMEASURED, and this comment will not reassure the reader
   * that it exists. Across 15 arms over 5 rounds — the last with the corrected
   * classifier, a target derived by identity from the run's own graph, and a
   * positive control that APPLIED — no add instruction has ever been observed to
   * be accepted. Whether a user's own answer can land one is not established.
   *
   * What IS established is what the design rests on: every add phrasing the
   * receipt could compose is refused, and every ask phrasing is answered with
   * concrete, model-grounded options. The acceptance condition for an add is
   * knowledge THIS PANEL DOES NOT HAVE — what the figure should causally
   * influence — and a receipt that picked a target would be the product inventing
   * causality on the user's behalf, which is worse than the CTA doing nothing.
   * The engine itself ends in the same place: "connect 'Annual revenue' to a
   * factor that already feeds your goal. Which factor should it relate to?"
   *
   * The button therefore does the thing that measurably works and is true: it
   * asks. The user's answer names the target, and THAT turn is the one the
   * engine accepts. Two honest steps beat one false promise.
   */
  addAction: 'Where does this fit?',
} as const

/**
 * Plain-English names for the classes CEE reports as untracked. An unrecognised
 * code is rendered VERBATIM rather than hidden — the producer owns this
 * vocabulary, and silently dropping a class we have no copy for would defeat
 * the point of the field.
 */
const NOT_TRACKED_COPY: Readonly<Record<string, string>> = {
  competing_or_dissenting_proposals: "other people's suggestions",
  corrections_and_second_thoughts: 'changes of mind',
  named_evidence_sources_and_their_pedigree: 'where your evidence came from',
  qualitative_constraints_and_rules: 'rules you wrote in words rather than numbers',
  stated_confidence_and_self_flagged_weakness: 'how sure you said you were',
  statements_the_drafting_model_did_not_report_discarding: 'anything else I left out silently',
}

/**
 * ⚠ A CROSS-REPO HAND-MAINTAINED MIRROR, and it fails SAFE. `NOT_TRACKED_COPY`
 * is keyed on a vocabulary CEE owns, so the day CEE adds a class this map does
 * not know it, and the previous `?? c` fallback rendered the raw snake_case
 * code — defeating the tone guard the moment the producer moved. An unknown
 * code now collapses into one honest catch-all instead of leaking an
 * identifier onto the screen, and the caveat stays truthful either way.
 */
function notTrackedCopy(codes: readonly string[]): string {
  const known: string[] = []
  let unknown = 0
  for (const c of codes) {
    const copy = NOT_TRACKED_COPY[c]
    if (copy === undefined) unknown += 1
    else if (!known.includes(copy)) known.push(copy)
  }
  if (unknown > 0) known.push('and some other things I set aside')
  return known.join('; ')
}

/**
 * Recover the brief sentence a figure sat in, using the offset CEE already sends.
 *
 * `NotModelledItem.charOffset` is an offset into `brief_text`, and both are in
 * scope on this component's render — the brief is right there in the blockquote.
 * Until now the offset was used ONLY for identity (the React key and a data-*
 * attribute), and the CTA threw the sentence away.
 *
 * Boundaries are `.`, `!`, `?` and newlines. Deliberately NOT a general sentence
 * splitter: this text is a business brief full of decimals and currency, and
 * `£1.5 million` is exactly the string a naive `[.!?]` split cuts in half — the
 * defect CLAUDE.md trap 22 records as a guard "correct and pointed at the wrong
 * bytes". So a `.` counts as a boundary only when it is NOT between two digits.
 *
 * Returns null when the offset does not land inside the brief (a stale manifest,
 * a brief that was re-saved). The caller then asks its question without the
 * quote rather than quoting something that is not there.
 */
export function recoverBriefSentence(briefText: string | null, charOffset: number): string | null {
  if (typeof briefText !== 'string' || briefText.length === 0) return null
  if (!Number.isInteger(charOffset) || charOffset < 0 || charOffset >= briefText.length) return null

  const isBoundary = (i: number): boolean => {
    const ch = briefText[i]
    if (ch === '\n' || ch === '!' || ch === '?') return true
    if (ch !== '.') return false
    // A decimal point is not the end of a sentence.
    const prev = briefText[i - 1]
    const next = briefText[i + 1]
    if (prev >= '0' && prev <= '9' && next >= '0' && next <= '9') return false
    return true
  }

  let start = 0
  for (let i = charOffset - 1; i >= 0; i--) {
    if (isBoundary(i)) { start = i + 1; break }
  }
  let end = briefText.length
  for (let i = charOffset; i < briefText.length; i++) {
    if (isBoundary(i)) { end = i + 1; break }
  }
  const sentence = briefText.slice(start, end).trim()
  return sentence.length > 0 ? sentence : null
}

/**
 * Compose the turn the CTA fires.
 *
 * ⚠ THIS ASKS. IT DOES NOT INSTRUCT, AND THAT IS A MEASURED DECISION, not a
 * timidity. Against the LIVE deployed router (12 arms, 12 fresh scenarios, one
 * arm per scenario so only the phrasing varied — full table in `COPY.addAction`
 * above and in the PR body):
 *
 *   * every explicit "add this figure" phrasing that did NOT name a causal
 *     target was REFUSED by the graph validator — `ORPHAN_NODE`, or
 *     `NO_PATH_TO_GOAL` when it was connected to the options but not the goal.
 *     Adding the brief sentence made this WORSE, not better: it gave the model
 *     enough confidence to author a node, which the validator then rejected,
 *     turning a useful sentence into a structural error.
 *   * an instruction that DID name a causal target was ALSO refused
 *     (`PIPELINE_OWNED_FIELD`): the goal-feeding factors in a drafted graph are
 *     analysis-derived, so naming one does not rescue the add.
 *
 * ⚠ THIS PARAGRAPH ONCE CLAIMED SUCH AN INSTRUCTION WAS ACCEPTED ("HELD →
 * confirm → applied"). That was a classifier defect, not a measurement — an
 * explicit `verdict: "rejected"` overridden by a `|| !!d.blocker_code` disjunct —
 * and no confirmation turn was ever sent. Across 15 arms over 5 rounds, with a
 * positive control that applied, no add has been observed to be accepted.
 *
 * Asking is not the weaker option here; it is the only one that is true. What the
 * user's answer can then achieve is for the engine and the user to work out
 * between them — this panel does not claim it.
 *
 * The sentence is included because it makes the ANSWER better, not because it
 * makes an add possible: with it, the engine's reply named the specific existing
 * factor the figure would attach to; without it, the reply was generic.
 */
export function composeNotModelledQuestion(item: NotModelledItem, briefText: string | null): string {
  const sentence = recoverBriefSentence(briefText, item.charOffset)
  // ⚠ BYTE-IDENTICAL TO PROBE ARM J, deliberately. This read "which isn't in the
  // model" until review pointed out that no arm attested the shipped string — the
  // probed and shipped openings diverged at index 32. The claim "derived at the
  // live router" has to be about the bytes the product actually sends, not about
  // a neighbouring string, so the product now sends the string that was measured.
  const opening = `My brief mentions ${item.literal}, which is not in the model yet.`
  const context = sentence ? ` The brief says: "${sentence}"` : ''
  return `${opening}${context} What could this figure influence in this decision, and where would it belong? Don't change the model yet — tell me the options first.`
}

/**
 * One item of a plain text list.
 *
 * `key` and `attrs` exist so every row is addressed by IDENTITY — a node id, a
 * char offset — never by a value another row could also produce (trap 19).
 */
interface TextRow {
  readonly key: string
  readonly label: string
  readonly attrs?: Readonly<Record<string, string>>
}

/**
 * The unclamped text list.
 *
 * ⚠⚠ IT USED TO SERVE BOTH "what I estimated" AND "I also considered these",
 * AND THE TWO HAVE NOW DIVERGED ON PURPOSE. Superseded text: ~~The two were
 * byte-identical apart from their key, their testid and one `data-` attribute,
 * so they are one component parameterised by exactly those.~~
 *
 * "What I estimated" has its own component below because it carries an ACTION
 * and this list must never acquire one. That is not a styling preference; it is
 * the add ruling recorded in `COPY.addAction` — 15 arms over 5 rounds in which
 * every add phrasing was refused by the live router. A "considered" item is one
 * of the drafting model's OWN SENTENCES about what it set aside, not a node: it
 * has no identity to bind an edit to and no value to set, so a control here
 * would be the product inventing causality on the user's behalf.
 *
 * ⭐ SO THE DIVERGENCE IS THE SAFER SHAPE, not a duplication to be folded back.
 * Keeping one parameterised component would have put an `onEdit?` prop on the
 * list that renders the considered items — one flag away from the exact harm
 * the ruling exists to prevent. Two components cannot be switched into each
 * other's job by a truthy prop. A spec pins the inertness so this cannot drift
 * back silently.
 *
 * `<ul>`/`<li>` rather than `<div>`: each block is a list of discrete facts and
 * that is what lets assistive tech announce how many there are. The
 * "considered" block already did this, so unifying the other list DOWN to a
 * `<div>` would have been the regression. Tailwind's preflight strips list
 * markers and padding, so the rendered pixels are unchanged.
 */
function TextRowList({ rows, testId }: { rows: readonly TextRow[]; testId: string }) {
  return (
    <ul className={LIST_CLASS} data-testid={testId}>
      {rows.map((row) => (
        <li key={row.key} data-testid={`${testId}-row`} {...row.attrs} className={TEXT_ROW_CLASS}>
          {row.label}
        </li>
      ))}
    </ul>
  )
}

/** Every control in the estimated list is addressed by this prefix + node id. */
const ESTIMATED_TEST_ID = 'what-i-was-given-estimated'

/**
 * One "what I estimated" row: the factor's name, and — where it would actually
 * do something — a control that sets its value.
 *
 * ── WHY THIS IS AN EDIT AND NOT THE REFUSED ADD ────────────────────────────
 * `COPY.addAction` records that every ADD phrasing was refused by the live
 * router, and that the CONTROL which applied was *"the estate's proven edit
 * grammar ('Change X to Y.', target derived from THIS run's graph by
 * identity)"*. An estimated factor is already a node: CEE sends its `node_id`
 * in the manifest, so the target is derived by identity and nothing is guessed.
 * This is that control, not that refusal.
 *
 * ── ⚠ WHY PRESENCE IN THE GRAPH IS CHECKED AND NOT ASSUMED ─────────────────
 * The manifest is a COLD-READ SNAPSHOT. `serverGraphHydration` writes it BEFORE
 * it merges the server graph onto the canvas, and the hydration "attempts ONCE
 * PER SCENARIO ID, so it never self-corrects". Three reachable schedules leave
 * it describing nodes the canvas does not hold — a REFUSED merge (`zeroOverlap`
 * proves the two id sets disjoint), a structural delete (every `deleteNodeById`
 * filters `nodes` and touches no manifest), and the `unchanged` short-circuit
 * after a local edit. All three sit INSIDE one scenario, so the section's
 * scenario-identity gate passes straight through them: matching the decision
 * does not imply matching the node.
 *
 * ⭐ THE ID IS STILL SAFE TO BIND BY, and the reason is the SHAPE of the lookup
 * rather than the reliability of the id: `proposeFactorValue` resolves with an
 * EXACT `nodes.find(n => n.id === activeNodeId)` and answers `not_encodable` on
 * a miss. There is no fuzzy match, so a divergent id cannot address a DIFFERENT
 * factor — the failure mode is "nothing happens", never "the wrong number was
 * overwritten". What it would leave behind is a button that does nothing, and
 * this component's rule is that we never render one. Hence a POSITIVE
 * resolution, the same shape as the section's own identity gate.
 *
 * The ROW still renders when the node is missing. The estimate was genuinely
 * made and the reader is entitled to see it; only the action goes.
 */
function EstimatedFactorRow({ factor }: { factor: InferredFactor }) {
  return (
    <li
      data-testid={`${ESTIMATED_TEST_ID}-row`}
      data-node-id={factor.nodeId}
      className={ACTION_ROW_CLASS}
    >
      <span className={`${typography.panelBody} text-text-body`}>{factor.label}</span>
      {/* ⭐ THE CONTROL MOVED OUT AND NOTHING ABOUT IT CHANGED. It is the same
          component the Reasoning tab's gap rows now use — the node resolution,
          the conversation gate, the three-outcome mapping and the
          stays-open-on-refusal rule all travelled with it. Keeping a second
          copy here once a second surface needed the same act is how one act
          becomes two spellings (trap 12). */}
      <FactorValueControl
        nodeId={factor.nodeId}
        label={factor.label}
        testIdPrefix={ESTIMATED_TEST_ID}
      />
    </li>
  )
}

/**
 * "What I estimated" — the one list on this panel that carries an action.
 *
 * Keyed by `nodeId`: CEE's own identity for the factor, never the label. Two
 * factors can share a label; they cannot share a node id, and the id is what
 * the edit is addressed to.
 */
function EstimatedFactorList({ items }: { items: readonly InferredFactor[] }) {
  return (
    <ul className={LIST_CLASS} data-testid={ESTIMATED_TEST_ID}>
      {items.map((factor) => (
        <EstimatedFactorRow key={factor.nodeId} factor={factor} />
      ))}
    </ul>
  )
}

function Rows({
  items,
  testId,
  onAdd,
}: {
  items: readonly NotModelledItem[]
  testId: string
  onAdd?: (item: NotModelledItem) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, VISIBLE_ROWS)
  // ⚠ `ClampToggle`'s contract is that `hiddenCount` is what the clamp HIDES
  // and does NOT change when the list expands — that is what keeps the control
  // mounted as "Show fewer". `items.length - visible.length` falls to zero on
  // expand and would unmount the affordance, which is precisely the one-way
  // behaviour this replaced.
  const hiddenCount = items.length - VISIBLE_ROWS

  return (
    <div className={LIST_CLASS}>
      <ul className="space-y-0.5" data-testid={testId}>
        {visible.map((item) => (
          // Keyed and addressed by IDENTITY (offset + literal): a brief can state
          // the same figure twice and they are two different facts.
          <li
            key={`${item.charOffset}:${item.literal}`}
            data-testid={`${testId}-row`}
            data-char-offset={item.charOffset}
            data-matched-node-id={item.matchedNodeId ?? undefined}
            className={ACTION_ROW_CLASS}
          >
            <span className={`${typography.panelBody} text-text-body`}>{item.literal}</span>
            {onAdd && (
              <button
                type="button"
                onClick={() => onAdd(item)}
                data-testid={`${testId}-add`}
                className={`${typography.panelMeta} flex-none rounded px-1.5 py-0.5 text-text-light underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                {COPY.addAction}
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* The panel's ONE clamp affordance (`./ClampToggle`), in the directory
          that component's own header names. The copy this replaced rendered in
          a different colour from every other clamp in the results panel and
          offered no way back.

          `rowInset` MUST track `ROW_BOX`'s horizontal padding: preflight zeroes
          a bare button, so without it the control hangs 8px left of the rows it
          belongs to. This is the ONLY consumer that passes one — the other
          three render rows with no horizontal padding and sit flush. */}
      <ClampToggle
        testId={`${testId}-show-all`}
        hiddenCount={hiddenCount}
        expanded={showAll}
        onToggle={() => setShowAll((s) => !s)}
        rowInset="px-2"
      />
    </div>
  )
}

export interface WhatIWasGivenSectionProps {
  /** Starts the conversation to add an unmodelled figure. When absent, no
   *  action is offered — we never render a button that does nothing. */
  onSendMessage?: (text: string) => void
  /**
   * ⭐⭐ OPT IN TO THE ANALYSIS (NEW) CONTAINER GRAMMAR. **Default `false`, and
   * the default is the whole design of this prop.**
   *
   * This component has TWO consumers: `AnalysisNewTabBody` (the Reasoning tab)
   * and `ResultsBody` (the **PARKED** Analysis tab). Paul's scope ruling puts
   * the Analysis tab out of bounds, so this may not change how that surface
   * renders — not "probably won't", *may not*. An unflagged change here would
   * be a change to a parked surface wearing a Reasoning-tab commit message.
   *
   * ── WHY IT IS WORTH A PROP AT ALL ──────────────────────────────────────
   * Seen on the deployed Reasoning tab, this section is the single most jarring
   * instance of the inconsistency Paul named. Three sections sit at the same
   * level and one of them wears a box:
   *
   *     What would change your mind        3  ›     ← borderless row
   *     ┌────────────────────────────────────┐
   *     │ What you gave me, and what I did … │      ← BOXED
   *     └────────────────────────────────────┘
   *     Strengthen the reasoning           1  ›     ← borderless row
   *
   * A measurement said it was a fourth container treatment (14px radius,
   * `6px 12px` padding, against the boxes' 14px/`10px 12px` and the ribbon's
   * 12px/`6px 8px`). LOOKING said it was the worst one — because its two
   * NEIGHBOURS are the thing it disagrees with, and neighbours are what a
   * reader compares.
   */
  useSurfaceGrammar?: boolean
  /**
   * ⭐⭐ OFFER THE INLINE VALUE CONTROL ON "what I estimated". **Default
   * `false`, and the default is deliberate, for the same reason
   * `useSurfaceGrammar`'s is.**
   *
   * This component has TWO consumers: `AnalysisNewTabBody` (the Reasoning tab)
   * and `ResultsBody` (the **PARKED** Analysis tab). Paul's scope ruling is
   * Reasoning and Model ONLY, so an unflagged change here would put a new
   * writer on a parked surface wearing a Reasoning-tab commit message.
   *
   * ⚠ IT IS A SEPARATE PROP FROM `useSurfaceGrammar` ON PURPOSE. That one
   * answers *"which container grammar does this section wear?"*; this one
   * answers *"may this surface offer a shared-model edit?"*. Two questions
   * under one name is this estate's signature defect (CLAUDE.md trap 21), and
   * folding the second into the first would mean a future grammar change
   * silently switched a writer on.
   *
   * ── WHY AN ACTION IS HONEST HERE AT ALL ────────────────────────────────
   * The header above says none is offered in "what I estimated", and for an
   * ADD that ruling stands — `COPY.addAction` records 15 refused arms. This is
   * not an add. These factors are already nodes, CEE sends their `node_id`, and
   * a value edit on an identified node is the ruling's own working CONTROL. The
   * row-level component states the full derivation, including the premise that
   * did NOT hold and what is checked instead.
   */
  offerEstimatedValueControl?: boolean
}

export function WhatIWasGivenSection({
  onSendMessage,
  useSurfaceGrammar = false,
  offerEstimatedValueControl = false,
}: WhatIWasGivenSectionProps = {}) {
  const [open, setOpen] = useState(false)
  const recordedScenarioId = useContextIntegrityStore((s) => s.scenarioId)
  const briefText = useContextIntegrityStore((s) => s.briefText)
  const manifest = useContextIntegrityStore((s) => s.manifest)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)

  // ── THE IDENTITY GATE — read the store's header before touching this ───────
  //
  // This panel's whole claim is *"this is what YOU gave ME, on THIS decision"*.
  // It is the one surface where showing the right shape of the wrong content is
  // worse than showing nothing, so it renders ONLY on a POSITIVE identity match
  // and treats every other case as "we have nothing for this decision".
  //
  // ⚠ IT MUST BE A POSITIVE MATCH, NOT `!==`. A `!==` test passes when either
  // side is `null`, and `null` is exactly the state this store sits in for a
  // decision it was never told about — which is the P0: a freshly-minted
  // scenario's cold read answers `absent`, so `setContextIntegrity` is never
  // called, nothing is cleared, and the PREVIOUS decision's brief stays live
  // until a page reload. Requiring both ids to be present and equal makes a
  // store that was never written for this decision indistinguishable from an
  // empty one — which is the truthful reading of it.
  //
  // Suppressing rather than refetching is deliberate: there is no fetch this
  // component owns (`serverGraphHydration` writes the store on the cold read,
  // and the draft turn records a fresh decision's brief — neither is this
  // component's), and inventing one here would race the boot path. Silence is
  // the honest answer; the previous decision's brief never is.
  const isForCurrentDecision =
    typeof recordedScenarioId === 'string' && recordedScenarioId === currentScenarioId
  if (!isForCurrentDecision) return null

  if (briefText === null && manifest === null) return null

  const tally = manifest?.status === 'derived' ? manifest.quantities : null
  const items = tally?.items ?? []
  const used = items.filter((i) => i.verdict === 'in_model')
  // A figure quoted only in commentary is not in the model. To a reader that is
  // one fact, not two, so the surface folds it in here while the manifest keeps
  // the distinction.
  const notYet = items.filter((i) => i.verdict === 'absent' || i.verdict === 'prose_only')
  const estimated = manifest?.inferredFactors.items ?? []
  const considered =
    manifest?.declaredExclusions.status === 'reported' ? manifest.declaredExclusions.items : []

  // Counts come from the manifest's own tallies, NOT from `items.length`:
  // `items` is capped (`truncated`) while `total` is not, so counting rendered
  // rows against an uncapped total silently under-reports on a long brief.
  /**
   * ⚠⚠ THREE STATES, NOT ONE TEMPLATE. The single template rendered
   * "0 of 0 figures you mentioned aren't in the model yet" on a brief with no
   * figures in it — a double negative about nothing, witnessed on the deployed
   * build as this section's subtitle. It also stated the GOOD outcome
   * negatively: "0 of 5 … aren't in the model yet" is the all-clear, phrased as
   * a shortfall.
   *
   *   no figures at all  → say there is nothing to track, and count nothing
   *   all of them landed → say so positively; it is the reassuring state
   *   some are missing   → the original sentence, which is right for that case
   *
   * The counting rule above is unchanged: totals come from the manifest's
   * tallies, never from the capped `items` array.
   */
  /**
   * The sentence is derived by `figureTallySubtitle`, which owns the arm order
   * and the noun/verb agreement and is enumerated over the whole quantity
   * domain in its own spec. Three passes of patching it inline each shipped a
   * defect while closing one; that file's header records all three.
   */
  const subtitle = figureTallySubtitle(tally)

  const addMessage = (item: NotModelledItem) =>
    onSendMessage?.(composeNotModelledQuestion(item, briefText))

  return (
    <section
      data-testid="what-i-was-given-section"
      /* ⚠ THE FILL IS KEPT IN BOTH MODES. `surface('neutral')` carries no fill,
         and this section sits directly on the panel — without `bg-panel` the
         open state shows the page through it. The grammar governs GEOMETRY;
         the fill is this section's own and is unaffected by the choice. */
      className={
        useSurfaceGrammar
          ? `${surface('neutral')} bg-panel`
          : 'rounded-lg border border-panel-border bg-panel px-3 py-1.5'
      }
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="what-i-was-given-body"
        onClick={() => setOpen((o) => !o)}
        data-testid="what-i-was-given-toggle"
        className="flex w-full items-center gap-2 rounded py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>{COPY.heading}</span>
          <span
            className={`${typography.panelMeta} block text-text-light`}
            data-testid="what-i-was-given-summary"
          >
            {subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id="what-i-was-given-body" className="mt-1 space-y-3 pb-2">
          {/* ── 1. What you gave me ── */}
          <div>
            <h4 className={`${typography.panelHeader} text-text-header`}>{COPY.givenHeading}</h4>
            {briefText === null ? (
              <p className={`${typography.panelBody} text-text-light`}>{COPY.noBrief}</p>
            ) : (
              <blockquote
                data-testid="what-i-was-given-brief"
                className={`${typography.panelBody} mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-panel-border bg-panel-hover/40 px-2 py-1.5 text-text-body`}
              >
                {briefText}
              </blockquote>
            )}
          </div>

          {tally === null ? (
            <p
              data-testid="what-i-was-given-unknown"
              className={`${typography.panelBody} text-text-light`}
            >
              {COPY.unknown}
            </p>
          ) : (
            <>
              {/* ── 2. What I used ── */}
              {used.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.usedHeading}
                  </h4>
                  <Rows items={used} testId="what-i-was-given-used" />
                </div>
              )}

              {/* ── 4. Not modelled yet — an invitation, not a verdict ── */}
              {notYet.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.notYetHeading}
                  </h4>
                  <p className={`${typography.panelMeta} text-text-light`}>{COPY.notYetLead}</p>
                  <Rows
                    items={notYet}
                    testId="what-i-was-given-notyet"
                    onAdd={onSendMessage ? addMessage : undefined}
                  />
                </div>
              )}
            </>
          )}

          {/* ── 3. What I estimated — the trust-critical one ── */}
          {estimated.length > 0 && (
            <div>
              <h4 className={`${typography.panelHeader} text-text-header`}>
                {COPY.estimatedHeading}
              </h4>
              <p className={`${typography.panelMeta} text-text-light`}>{COPY.estimatedLead}</p>
              {/* ⭐ THE ACTION IS OPT-IN AND ONLY THE REASONING TAB OPTS IN —
                  see the prop's declaration. `ResultsBody` (the PARKED Analysis
                  tab) mounts the same component and keeps the inert list it
                  has. */}
              {offerEstimatedValueControl ? (
                <EstimatedFactorList items={estimated} />
              ) : (
                <TextRowList
                  testId={ESTIMATED_TEST_ID}
                  rows={estimated.map((f) => ({
                    key: f.nodeId,
                    label: f.label,
                    attrs: { 'data-node-id': f.nodeId },
                  }))}
                />
              )}
            </div>
          )}

          {/* The model's own words for what it set aside, carried verbatim. */}
          {considered.length > 0 && (
            <div>
              <p className={`${typography.panelMeta} text-text-light`}>{COPY.consideredLead}</p>
              <TextRowList
                testId="what-i-was-given-considered"
                rows={considered.map((text) => ({ key: text, label: text }))}
              />
            </div>
          )}

          {/* The caveat travels with the findings, always: without it the lists
              above read as exhaustive, and they are not. */}
          {manifest !== null && manifest.notTracked.length > 0 && (
            <p
              data-testid="what-i-was-given-caveat"
              className={`${typography.panelMeta} text-text-light`}
            >
              {COPY.caveatLead}{' '}
              {notTrackedCopy(manifest.notTracked)}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
