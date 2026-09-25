/**
 * At a glance — the strategic snapshot that IS the first viewport.
 *
 * ── WHY THIS WAS REBUILT (30 Aug 2026) ─────────────────────────────────────
 * The previous version rendered every element at the same typographic weight,
 * stacked with `space-y-2`. Everything was `panelMeta` or `panelBody`, so the
 * answer, the caveats, the scope note, the drivers and the action all competed
 * equally — and because every honesty mechanism had earned its own paragraph,
 * the caveats won on volume. Paul's read of the deployed surface: "an absolute
 * dog's dinner… a travesty".
 *
 * Nothing analytical changed. Every value below comes from the same view-model
 * field it came from before. This is a RENDERING change: rank, typeset, encode.
 *
 * ── THE FOUR RULES IT ENFORCES ─────────────────────────────────────────────
 * 1. ONE DOMINANT ANSWER. The leading option is the only large type on screen.
 *    Five equal answers in a 280px column is the density we came from.
 * 2. NO CHART UNLESS THE VALUES DIFFER. ⛔ RETIRED HERE at `e15416ad`, with the
 *    driver list this rule governed. It is recorded rather than deleted because
 *    the observation that produced it stands: the deployed surface drew three
 *    driver bars all at 100%, and three identical bars is three times no
 *    information. The bars themselves now live only in `DriverInfluenceChart`,
 *    which does not implement this rule — see the note at the retired constant.
 * 3. STALE KILLS THE PRESENT TENSE. `headline` is composed here in the present
 *    ("currently scores higher"), which is false on a run that predates the
 *    model. When stale, the eyebrow reframes it and the sentence is not used.
 * 4. ONE FACT, ONE PLACE. Stale and partial are a single ribbon attached to the
 *    answer, not two separate banners above it.
 *
 * ── WIDTH ──────────────────────────────────────────────────────────────────
 * Designed at the 280px floor first. The dock is NOT fixed at ~320: it is
 * 280-416 and drags to 480 (measured on the deployed build). Every rule here is
 * fluid or clamped; nothing assumes a single width.
 */

import { useState } from 'react'
import { PanelFigure } from '../PanelFigure'
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ComparisonScopeNote } from '../../ComparisonScopeNote'
import { EXCLUDED_LABEL_NAME_CAP } from '../../utils/goalAnchorCopy'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY, formatConjunctionList, sentenceCase } from '../analysisNewCopy'
import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import type { AtAGlance as AtAGlanceModel } from '../analysisNewTypes'
import { inset, action, icon } from '../panelSurfaces'

/**
 * How many parameter names fit before the line stops being readable. Four is a
 * layout judgement, not a claim about the set — the remainder is disclosed,
 * never dropped.
 */
const WITHHELD_PARAMETER_CAP = 4

/** Verdict tone → the accent that carries it. */
const TONE_PILL: Record<string, string> = {
  stable: 'bg-success/10 text-success',
  mixed: 'bg-warning/10 text-warning-ink',
  sensitive: 'bg-warning/10 text-warning-ink',
}

/**
 * The same word, with the reassurance taken out of it.
 *
 * Used only for a STALE `stable` verdict — see `reassuranceIsStale` below.
 */
const TONE_PILL_STALE = 'bg-panel-hover text-text-light'

/**
 * ⭐⭐ A STALE RUN MAY NOT REASSURE, BUT IT MUST STILL WARN.
 *
 * Witnessed live: after a user replaced a value Olumi had invented, every
 * subsequent rerun failed silently and this panel kept the previous result on
 * screen — a green tick, "Stable", and "came out ahead in 91% of simulated
 * scenarios". Four different inputs, including a flipped risk profile, produced
 * byte-identical output. The chat surface said the honest thing at the same
 * moment ("I've stopped rather than show you a confident wrong answer"), so the
 * two surfaces disagreed and the one a user is more likely to read was the
 * wrong one. The result was stale *precisely because the user tried to improve
 * it*, which inverts the product's own principle.
 *
 * This block already knew about staleness — the eyebrow reframes to "As last
 * analysed" and the present-tense headline is suppressed (rule 3). The verdict
 * pill was simply never given the same treatment, which is trap 21: two parts
 * of one surface answering "is this current?" differently.
 *
 * ⚠ AND IT IS DELIBERATELY ASYMMETRIC, BECAUSE THE TWO DIRECTIONS ARE NOT THE
 * SAME HARM. Demoting a stale `stable` removes false reassurance. Demoting a
 * stale `sensitive` or `mixed` would mute a TRUE warning and make a fragile
 * result look calmer than it is — the mirror defect, and the worse one. One
 * predicate, two opposite harms, so only the reassuring tone is demoted.
 *
 * The word itself stays. Removing information is not the same as removing the
 * anchor: under a ribbon that already says the model has moved — or that we
 * cannot confirm it has not — a neutral "Stable" is a record of what the last
 * run found. A green tick is a claim about the model in front of you.
 *
 * ⚠ THIS USED TO CITE THE EYEBROW ("As last analysed"), which was this panel's
 * SECOND statement of one fact and has been retired; the ribbon is now the only
 * place the panel says it. The justification is unchanged in substance — only
 * the surface carrying it is different.
 */
function reassuranceIsStale(tone: string, isStale: boolean): boolean {
  return isStale && tone === 'stable'
}

/**
 * ⛔ `DRIVER_SPREAD_MIN` DELETED WITH THE DRIVER LIST IT GATED (`e15416ad`).
 *
 * It read 0.05 and suppressed this section's driver bars when every driver's
 * `fraction` sat within five percentage points of every other — "three
 * identical bars is three times no information", rule 2 in the header above.
 * It had no consumer outside this file and none in any spec, so it goes with
 * the render rather than becoming an exported constant nothing reads.
 *
 * ⚠ THE RULE IT ENFORCED IS NOT INHERITED BY THE SURVIVING CHART, AND THAT IS
 * A KNOWN GAP RATHER THAN AN OVERSIGHT. `DriverInfluenceChart` draws a bar for
 * every row whatever the spread, and it can therefore render the flat case this
 * constant existed to refuse. It is a weaker defect there — the chart's bars
 * carry DIRECTION, so a flat set still discriminates left from right, which was
 * exactly what the suppressed list could not do — but it is not nothing. Left
 * alone deliberately: suppressing bars in a chart is a different change from
 * suppressing them in a list, and it is not this seam's question.
 */

/**
 * How many excluded options these rows name at rest.
 *
 * ⭐ THE REGISTER'S CONSTANT, NOT A SECOND NUMBER. This was a literal `2`,
 * justified by the scope note naming every option these rows name. Bounding
 * that note made the justification false and left two caps each resting on the
 * other's completeness. They are now one value.
 *
 * ⚠ SCOPE, EXACTLY — an earlier draft of this note said the two "cannot drift
 * apart", which overstated it and was caught in review. What the shared
 * constant fixes is HOW MANY each side names at rest. It does not by itself
 * make the two sides agree about the REMAINDER: the sentence counts every
 * missing option (`total - analysed`) while this list can only hold the ones
 * carrying a usable label. That gap is closed separately, by the unnamed-
 * remainder row below — not by this constant.
 */
export const EXCLUDED_OPTION_VISIBLE_CAP = EXCLUDED_LABEL_NAME_CAP

export interface AtAGlanceProps {
  glance: AtAGlanceModel
  onFocusTarget?: (targetId: string) => void
  /**
   * ⚠ `primaryIntervention` and `onRunIntervention` were REMOVED from this
   * component on 18 Sep 2026, not merely left unrendered. The card they fed
   * now lives in `sections/PrimaryIntervention.tsx`; leaving the props here
   * would be a caller-visible promise this component no longer keeps — the
   * dead-prop shape that lets a later mount site set a value and see nothing.
   */
  /** The displayed run predates the current model. Reframes the answer. */
  isStale?: boolean
  /**
   * WHY the report may not match the model. Defaults to 'unconfirmed', which is
   * the honest reading of a caller that did not say — never 'changed', because
   * that would assert a fact from an absence.
   */
  staleKind?: 'changed' | 'unconfirmed' | null
  /**
   * The LATEST attempt did not produce the result on screen (refused, or
   * failed). Leads the status line, and supersedes the vaguer "cannot confirm"
   * sentence it explains. `null`/absent = the displayed run is the latest.
   */
  runNote?: { testId: string; text: string } | null
  /** The producer disclosed the result as partial. */
  isProvisional?: boolean
  /**
   * Re-run the analysis. Absent = no control is offered, deliberately: a
   * staleness sentence with a dead button beside it is worse than the sentence
   * alone.
   */
  onReanalyse?: () => void
  /**
   * ⭐⭐ THE ACT THAT ANSWERS THE REFUSAL. Takes the reader to where an estimate
   * this comparison rests on can be reviewed or replaced with their own.
   *
   * The producer's withheld-designation sentence names its own remedy in words
   * — "until you have set at least one of them" — and then leaves the reader
   * nowhere to go. That is the complaint `honestSentenceHasAMove.spec.tsx`
   * makes about the staleness ribbon, one slot further down this panel: the
   * surface was optimised for truthfulness and never for usefulness.
   *
   * ⚠ ABSENT = NO CONTROL, exactly as `onReanalyse` above. A refusal with a
   * dead button beside it is worse than the refusal alone, and this component
   * is mounted by hosts that cannot route anywhere (every render test in the
   * tree among them), so the fail-closed branch is a legitimate state rather
   * than a defect to detect.
   *
   * ⚠ NOT A STORE READ, DELIBERATELY. `useUIStore` is imported NOWHERE under
   * `components/results/analysisNew/`, and the destination — the outputs
   * dock's active tab — is the DOCK's own state. `OutputsDock` owns this
   * handler beside `onReanalyse`, `onFocusNode` and `onSendMessage`, all of
   * which reach this surface the same way; adding a store subscription to a
   * presentational section to avoid one prop would put the tab's navigation in
   * the one file that cannot see the tab.
   */
  onReviewEstimates?: () => void
  /**
   * ⭐⭐ DERIVED FROM THE RUN GATE'S VERDICT IN ONE PLACE — NOT A SECOND
   * PREDICATE HERE. `AnalysisNewTabBody` passes `!canRunAnalysis && !isRunning`
   * over `OutputsDock`'s single `runGateResult`; this component renders that
   * and derives nothing of its own.
   *
   * This surface offers the re-run TWICE: here, on the staleness ribbon, and
   * in the shell footer (`shellContract.ts` gives `analysisNew`
   * `footerBar: 'reanalyse'`, which renders `ReanalyseBar`). This one was
   * handed a bare handler and could not refuse at all, so a model the gate
   * refuses got a live ribbon control for a run that reaches `showToast` and
   * fails.
   *
   * ⭐ THE FOOTER CONTROL IS GATED TOO, SINCE #1212 — same verdict, same
   * shape, derived one level further down. This prop arrives ALREADY derived
   * (`AnalysisNewTabBody` computes `!canRunAnalysis && !isRunning`), whereas
   * `OutputsDock` hands `ReanalyseBar` the RAW `canRunAnalysis` / `isRunning`
   * and that bar computes the identical `blocked = !canRun && !isAnalysing`
   * for itself before disabling on `!onReanalyse || blocked || isAnalysing`.
   * Two derivation sites, one verdict — which is why neither may be
   * "simplified" into a predicate of its own. While only one half had landed
   * this surface was incoherent in one direction or the other — one control
   * refusing the run beside another still offering it, the product
   * contradicting itself about whether the user may run an analysis. This
   * prop closes the ribbon's half; both are closed now.
   *
   * ⚠ REQUIRED, AND NULLABLE, DELIBERATELY. `AtAGlance` is the component that
   * RENDERS the control, so this is the boundary at which an omission causes
   * the harm — and the harm is silent. Optional-with-a-default would let a
   * future mount site reinstate the ungated control with no diagnostic at all;
   * required makes that a TS2741 at the mount. `null` is the honest value for
   * a host that holds no verdict, and it is treated as BLOCKED.
   *
   * ⚠ THE CALLER OWNS THE `isAnalysing` CLAUSE. `canRunAnalysis` is FALSE
   * while a run is in flight, so this is the already-derived
   * `!canRun && !isAnalysing` — the shape `AnalysisReadinessBar` and
   * `PanelFooter` use over the same verdict — never a bare `!canRun`, which
   * would call a RUNNING analysis a refusal.
   */
  reanalyseBlocked: boolean
  /**
   * ⭐⭐ THE SECOND QUESTION. `reanalyseBlocked` answers "does the gate REFUSE
   * this run?"; this answers "is a run ALREADY HAPPENING?" — and the button's
   * `disabled` is a function of BOTH, while the refusal COPY is a function of
   * the first alone. One name cannot carry two questions (CLAUDE.md trap 21),
   * which is exactly how the first draft of this PR left the control enabled
   * during a run. (Nothing shipped: before this PR the ribbon control read no
   * gate at all, so `reanalyseBlocked` and this prop both arrive together.)
   *
   * ⚠ WITHOUT THIS INPUT THE CONTROL IS A DEAD AFFORDANCE MID-RUN.
   * `reanalyseBlocked` is `!canRunAnalysis && !isRunning`, so it is FALSE for
   * the whole time an analysis is in flight — binding `disabled` to it alone
   * leaves a pressable button whose click reaches
   * `runCanonicalAnalysis`, returns `already-running`, and is dropped by
   * `handleRunAnalysis` (it raises a toast on `blocked` / `unavailable` only).
   * An enabled control that does nothing and says nothing.
   *
   * ⚠ THE SOURCE IS THE DOCK'S LOCAL `isRunning`, THREADED UNCHANGED — the
   * same flag `reanalyseBlocked` was derived against. Pairing this with the
   * composed `isBusy` would test a different run than the one that produced
   * the verdict (`AnalysisNewTabBody` states that reasoning at the
   * derivation). The siblings spell this same flag `isAnalysing`
   * (`PanelFooter`, `AnalysisReadinessBar`); the name here follows the value's
   * own chain, dock -> body -> glance, so one grep finds all of it.
   *
   * ⚠ REQUIRED, for the reason the prop above is required: the harm is
   * SILENT, and this is the component that renders the control. Optional with
   * a `false` default would let a future mount site reinstate the enabled
   * mid-run button with no diagnostic at all; required makes that a TS2741 at
   * the mount.
   */
  isRunning: boolean
  /**
   * The gate's own refusal sentence, or `null` when it did not supply one.
   *
   * ⚠ BLOCKED WITH NOTHING TO SAY IS NOT A DISABLED BUTTON — it is a dead
   * affordance with no explanation, which is the state this panel's other
   * pre-gates exist to prevent. No reason ⇒ no control, the same shape a
   * missing handler already gets.
   */
  reanalyseBlockedReason: string | null
  /** Which results did not come back, already named for this surface. */
  /**
   * ⭐ WOULD A RE-RUN CHANGE THIS? — the third question, and the one the
   * ribbon's act was missing.
   *
   * Supplied by the caller from `vm.checks.leaderWithheld`; this component
   * derives nothing, exactly as it does not re-derive the run gate.
   *
   * ⚠ THE WITHHELD FACT, NOT ITS NAMEABLE CAUSE. `leaderWithholdCause` is null
   * both when nothing was withheld and when the reason cannot be named, and the
   * second is the common case — `withheld_reason` is free-form at the contract.
   */
  leaderWithheld?: boolean
  /**
   * ⭐⭐⭐ WOULD A RE-RUN CHANGE THIS? The question this ribbon's act actually
   * asks, and it is NOT `leaderWithheld`.
   *
   * ⛔ An independent seat found the conflation: `leader_not_assessed` includes
   * a missing verdict, an unknown separation and an incomplete or failed
   * result, so binding the act to it removed the retry from the retryable
   * class. See `buildChecks` for the two evidenced conjuncts.
   *
   * Absent = false: a caller that has not been given it keeps the re-run, which
   * is the fail-open direction — offering a run that turns out not to help
   * costs a click; withholding one that would have helped strands the reader.
   */
  rerunWouldNotHelp?: boolean
  missingResults?: readonly string[]
  /**
   * ⭐ WHICH HALF TO RENDER. `'status'` is the ribbon alone: the freshness,
   * run-note and partial lines with the one act that answers them. `'reading'`
   * is everything else: the withheld reason and its act, the reading, the
   * provenance, the scope and the condition. The tab mounts the status above
   * "Move towards commitment" and the reading after it, as the V2 prototype
   * does (its stale row sits inside the commitment block, above the chart, and
   * it has no reading above the chart), so the chart and its qualifier reach
   * the first screen. `'all'` (the default) is both, in one section, as before.
   */
  part?: 'all' | 'status' | 'reading'
  testId?: string
}

/**
 * The small label above a block.
 *
 * ⚠ THE FIRST DRAFT BROKE DS v5 §2.4 THREE WAYS ON ONE LINE — an arbitrary
 * 10px size, a raw weight, and a caps transform — caught by the
 * shell-conformance guard and the DS ratchet. Panel scope renders exactly three
 * sizes, and only from `panelHeader` / `panelBody` / `panelMeta`.
 *
 * ⚠ AND THE GUARD SCANS COMMENTS TOO. Naming the offending utilities literally
 * here re-triggered both checks on a file that no longer uses any of them, so
 * this note describes them instead of quoting them.
 *
 * The eyebrow still reads as an eyebrow: it is the smallest step, the lightest
 * colour, and slightly tracked. The hierarchy comes from the scale and the
 * spacing, which is what the scale is for.
 */
export function AtAGlance({
  glance,
  onFocusTarget,
  isStale = false,
  staleKind = 'unconfirmed',
  runNote = null,
  isProvisional = false,
  onReanalyse,
  onReviewEstimates,
  reanalyseBlocked,
  reanalyseBlockedReason,
  isRunning,
  rerunWouldNotHelp = false,
  missingResults = [],
  testId = 'analysis-new-glance',
  part = 'all',
}: AtAGlanceProps) {
  const [showAllExcluded, setShowAllExcluded] = useState(false)
  const [withheldOpen, setWithheldOpen] = useState(false)
  const excludedKey =
    glance.comparisonScope.kind === 'partial'
      ? JSON.stringify(glance.comparisonScope.excluded.map((o) => o.id))
      : ''
  const [seenExcludedKey, setSeenExcludedKey] = useState(excludedKey)
  if (seenExcludedKey !== excludedKey) {
    setSeenExcludedKey(excludedKey)
    setShowAllExcluded(false)
  }

  // Rule 3 + 4. One ribbon, in the order a reader needs it: freshness first
  // (it invalidates the tense), completeness second (it bounds the claim).
  //
  // ⚠⚠ BUILT BEFORE `hasAnything`, AND THAT ORDER IS THE POINT — IT IS THE ONLY
  // FRESHNESS STATEMENT THIS PANEL MAKES. It used to be built AFTER the early
  // return below, so a run whose glance had no content dropped the trust bar
  // entirely and left the freshness claim to a row badge two sections down. The
  // bar is a claim about the RUN, not about the glance; gating it on the
  // glance's own content is what made it droppable, and once the restatements
  // go it would have been droppable to ZERO. `ribbon.length > 0` now counts as
  // content, so the invariant "a run that is not current says so, exactly once"
  // holds structurally rather than by luck.
  const ribbon: Array<{ testId: string; text: string }> = []
  /**
   * ⚠⚠ THIS USED TO ASSERT "the model has changed" ON A CANNOT-CONFIRM RUN.
   * The dock collapses `'stale'` and `'unknown'` into one boolean
   * (`OutputsDock.tsx:981`), so an absence of evidence was rendering as a
   * statement of fact — on this panel's FIRST line. The dock's own comment
   * forbids it and the old Analysis tab honours it with strict equality.
   */
  if (runNote) ribbon.push(runNote)
  // A run note explains an unconfirmed freshness; a model that CHANGED is a
  // separate fact and still gets its own line.
  if (isStale && !(runNote && staleKind !== 'changed')) {
    ribbon.push(
      staleKind === 'changed'
        ? { testId: 'analysis-new-status-stale', text: COPY.status.stale }
        : { testId: 'analysis-new-status-freshness-unknown', text: COPY.status.freshnessUnknown },
    )
  }
  if (isProvisional) {
    // Name them when we can; the generic sentence stands when we cannot.
    ribbon.push({
      testId: 'analysis-new-status-provisional',
      text:
        missingResults.length > 0
          ? COPY.status.provisionalNaming(missingResults)
          : COPY.status.provisional,
    })
  }

  /**
   * ⚠⚠ THE PRIMARY INTERVENTION COUNTS AS SOMETHING, AND LEAVING IT OUT MADE
   * THIS SURFACE MUTE BEFORE A RUN. Witnessed on deployed `5f2d9703`, guest,
   * on a live-drafted model: pre-run this tab rendered its placeholder
   * sentence and a collapsed "Strengthen the reasoning · 1" — and nothing
   * else. The one real, producer-grounded move ("Define what success looks
   * like") was in the view model and never reached the screen.
   *
   * The cause is that the two modules answered different questions under one
   * name. `buildAnalysisNewViewModel` blanks every RUN-DERIVED field pre-run
   * and, in terms, does NOT blank `strengthen` — "it is derived from the
   * MODEL, which exists before any run". This guard then tested only
   * run-derived fields, so it discarded the one thing its own component
   * renders that is not a reading of a run. Neither module was wrong alone;
   * the guard was simply answering "did a run produce anything?" while the
   * component's contract is "have I anything to show?" (CLAUDE.md trap 21).
   *
   * Adding it here rather than opening the collapsed section is deliberate:
   * `SectionShell`'s default-closed rule exists because this panel measured
   * 1,584px against a 769px viewport, and reopening a section would spend
   * that fix. One card is not a section.
   */
  /* ⚠ `glance.drivers.length > 0` WAS A DISJUNCT HERE AND HAD TO GO WITH THE
     LIST. This guard asks "have I anything to SHOW?" — the question the header
     above records it getting wrong once already, in the other direction. A run
     whose only glance-worthy content was drivers now genuinely has nothing to
     show here, and keeping the disjunct would have rendered the section's
     wrapper and heading over empty space: the "heading promising content"
     defect `AnalysisNewSection` records at its own early return. */
  /* ⚠ `hasAnything` MOVED — it now sits directly above `return`, because it can
     only ask the right question once every render predicate exists. See the
     docblock there. */

  /**
   * ⛔ `driversDiscriminate` AND `conditionFirst` REMOVED WITH THE DRIVER LIST.
   *
   * They answered one question: does the driver ranking discriminate enough to
   * outrank "what could change it" in the reading order? Both of the things
   * being ordered had to exist for that to be a question, and only one of them
   * does now. The condition block is unconditionally where the list used to
   * sit, which is where `conditionFirst` put it whenever the ranking was flat.
   *
   * ⚠ THE JUDGEMENT THEY ENCODED IS NOT LOST, it is relocated: a tipping point
   * is the more actionable quantity, so it keeps the position nearer the top of
   * the panel and the ranking now lives one click down in its own section.
   */

  /**
   * ⭐⭐ TWO QUESTIONS ABOUT ONE ADMISSION, ANSWERED SEPARATELY AND ON PURPOSE.
   *
   *   MAY I PRESS IT?      `reanalyseDisabled` — no, if the gate refuses OR a
   *                        run is already in flight.
   *   WAS I REFUSED?       `reanalyseBlocked` (the prop) — the gate's verdict
   *                        alone. A run in flight is NOT a refusal, so the
   *                        refusal sentence stays off the control mid-run.
   *
   * Binding `disabled` to the REFUSAL predicate is the defect this replaces:
   * `reanalyseBlocked` is `!canRunAnalysis && !isRunning`, which is false
   * during a run, so the button was ENABLED in a state where pressing it can
   * achieve nothing.
   *
   * ⭐ THE SHAPE IS THE SIBLINGS', NOT A NEW ONE. `PanelFooter` computes
   * `disabled = isAnalysing || !canRun` with its refusal copy on
   * `!isAnalysing && !canRun`; `AnalysisReadinessBar` binds
   * `disabled={isAnalysing || !canRun}` with `blocked = !canRun &&
   * !isAnalysing`. This is that same split, with the refusal half already
   * derived upstream.
   *
   * ⚠ #1212 IS THE PRECEDENT, NOT THE COUNTER-EXAMPLE — reconciled
   * deliberately, so the next reader does not "fix" one to match the other.
   * At `0666f955` it gives `ReanalyseBar` exactly this pair:
   * `blocked = !canRun && !isAnalysing` for the copy, and
   * `disabled={!onReanalyse || blocked || isAnalysing}` for pressability. The
   * two PRs agree that a run in flight DISABLES and does not REFUSE. Where
   * they genuinely differ is a DIFFERENT question — what an absent verdict
   * means: `ReanalyseBar` defaults `canRun = true` (fail-open, so the control
   * is never lost), while this panel fails CLOSED — `AnalysisNewTabBody`
   * defaults `canRunAnalysis` to `null`, which makes `reanalyseBlocked` true,
   * and this component then requires that derived boolean outright rather than
   * defaulting it. Same running-state direction; opposite absent-verdict
   * default, each argued at its own prop.
   */
  const reanalyseDisabled = isRunning || reanalyseBlocked

  /**
   * ⭐ HOISTED TO `panelLead`, NOT REWRITTEN. `ModelStrip` now asks the same
   * question — whether this panel has a conclusion to lead with — because the
   * two components share one 18px slot between them. A second copy of this
   * expression is how the estate's dominant defect starts: the copies drift,
   * and the panel renders two leads or none, with a red nowhere.
   */

  /**
   * ⚠ HOISTED SO THE READING AND ITS QUALIFIER CAN BE ONE BLOCK. The
   * provenance line qualifies the READING above it, but lived as a SIBLING of
   * the verdict inside the section's `space-y-3` — 12px below the sentence it
   * qualifies and 12px above one it does not, in identical typography.
   * Nothing bound it upward, and it read as an orphaned fragment.
   *
   * ⚠⚠ SUPERSEDED WORDING, NAMED SO IT IS NOT REINSTATED. This paragraph read
   * "modifies the verdict ABOVE IT" until 9 Sep 2026. It does not — see the
   * block below, witnessed on the deployed build: `glance.verdict` is a
   * robustness word and is NOT something this phrase can qualify. A reader who
   * took the old sentence at face value would find apparent authorisation to
   * put the verdict back into the gate, and the tests would then RED for a
   * reason the comment had denied. The LAYOUT finding above is untouched by
   * this and still holds.
   *
   * ⚠ A LOCAL MARGIN CANNOT FIX IT: `space-y-3` compiles to
   * `.space-y-3 > :not([hidden]) ~ :not([hidden])`, which out-specifies a
   * plain `.-mt-2` — measured in a browser, the override changed the file and
   * NOT the render. The gap is owned by the parent, so the fix is structural.
   */
  /**
   * ⚠⚠ `glance.verdict` IS NOT SOMETHING THIS PHRASE CAN QUALIFY — WITNESSED ON
   * THE DEPLOYED BUILD `2416ac3f`, 9 Sep 2026, guest, restored saved example,
   * COMPLETED run. The live DOM carried NO headline, NO win share and NO win
   * bar, a verdict line reading "Sensitive", and beneath it, alone:
   *
   *     "On inputs whose source Olumi could not establish"
   *
   * A bare prepositional phrase with no clause anywhere to attach to, sitting
   * between the robustness line and the action card. All six sanctioned
   * provenance sentences are QUALIFIERS of a READING — "Scored highest in 66%
   * of simulated futures", or a named leading option. A tone word plus the
   * producer's reason clause about robustness is neither.
   *
   * ⭐ AND GROUPING COULD NOT FIX IT. `glanceHoldsAtTheFloor.spec.tsx` already
   * moved this line INSIDE the reading block so the section's `space-y-3` would
   * stop spacing the qualifier away from what it qualifies. That was the right
   * fix for that defect. It cannot help when the block holds no reading at all.
   *
   * ⚠ THE STATE IS ROUTINE, NOT AN EDGE CASE. `buildAnalysisNewViewModel`
   * documents producing it above `shareOnScreen`: a leader determined by
   * expected outcome carries a null win probability, and a run with a
   * robustness verdict but no entitled leader lands here every time.
   *
   * ⚠⚠ THIS DOES NOT SUPPRESS THE HONESTY LINE, and the distinction is the
   * argument. The module exists to stop a PROMINENT READING sitting with its
   * basis stated nowhere — "the consequent in its largest type and the
   * antecedent nowhere". With no reading on screen there is no consequent for
   * this phrase to qualify, so that harm cannot occur. Every run that shows a
   * reading still shows the line; the twins in
   * `glanceQualifierNeedsAReading.spec.tsx` pin both directions.
   *
   * ⭐ WHAT "NO READING" IS DERIVED TO MEAN — this is the claim, and it is the
   * WHOLE claim. In `buildAnalysisNewViewModel.ts`, `winShare` (:1732),
   * `winFraction` (:1740) and `leaderLabel` (:1763) are each non-null only
   * where `headline` is. (This clause used to continue "and `headline` implies
   * `showAnswer`"; the conclusion `showAnswer` gated was DELETED on 18 Sep 2026
   * by Paul's ruling, so the chain now ends at `headline` — the upstream
   * derivation is unchanged, only the surface it fed is gone.) So the share and
   * the win bar can never render while this line is suppressed. A derivation over three
   * fields — NOT a statement about everything this section can draw.
   *
   * ⚠⚠ AND IT IS NARROWER THAN IT FIRST READ. Until 9 Sep 2026 this paragraph
   * also said "no option named", which is FALSE. Two sibling blocks below are
   * outside the chain above and are NOT covered by it:
   *   · SCOPE gates on `comparisonScope.kind === 'partial' &&
   *     comparativeClaim !== 'none'`, and in the suppressed state
   *     `buildAnalysisNewViewModel.ts:1755-1758` sets `comparativeClaim` to
   *     `'order'`, NOT `'none'` — so on a partial scope it renders and prints
   *     each excluded option's LABEL. Options ARE named on screen there.
   *   · CONDITION gates on `glance.condition != null`, which `glanceCondition`
   *     (:1586) ties to `flipThresholdsStatus` and a usable row, never to
   *     leader entitlement — so it can print an input-derived number here.
   * Whether either counts as a READING for this gate is OPEN. The argument
   * that they do not — an excluded row carries the NOT-ANALYSED badge and
   * states SCOPE rather than an outcome — is an argument, and the derivation
   * above does not reach it. Do not cite this comment as settling it.
   *
   * ⚠ SCOPE OF THAT, STATED PRECISELY, AND DO NOT WIDEN IT. Component-side
   * reachability is derived at the bytes here. It is NOT established that the
   * producer emits a partial comparison scope, or a computed flip threshold,
   * on a leader-withheld run — that needs a capture or a producer-side
   * derivation, and neither exists. So this bounds the JUSTIFICATION; it is
   * not a proven live regression, and the gate below is unchanged by it.
   * RE-SURFACE TRIGGER: a live capture of a leader-withheld run that carries a
   * partial comparison scope or a computed flip threshold. If one lands,
   * re-open whether SCOPE and CONDITION count as readings for this gate.
   *
   * ⚠ THIS IS NOW THE ONLY DISJUNCT. It was the second of two; the first read
   * `showAnswer`, and the conclusion it gated was deleted on 18 Sep 2026. It was
   * already written rather than inferred, which is why removing its sibling did
   * not change what this gate means: it states what THIS component renders
   * rather than depending on an upstream coupling it cannot see.
   */
  /**
   * ⭐⭐ THE PILL RENDERS ONLY WHERE THIS BLOCK CARRIES SOMETHING THE TRUST LINE
   * DOES NOT — otherwise the panel prints one producer word twice on one screen.
   *
   * ⚠ THE SPLIT IS ALREADY THE DESIGN. `TrustLine` takes `.label` and `.tone`;
   * its own docblock says the reason "belongs to `AtAGlance` and restating it
   * puts one claim on the surface twice", and a comment in its render records
   * `firstViewportCensus` catching precisely that when the reason once shipped
   * on both. The word is the trust line's; the sentence is this section's.
   *
   * ⛔ THE CASE NOBODY LOOKED AT IS THIS SECTION'S HALF BEING EMPTY, and it is
   * not an edge case — it is DERIVED and GUARANTEED for a whole class of runs:
   *
   *   · `winShare` / `winFraction` are null on a leader-withheld run (the chain
   *     through `headline` documented above).
   *   · `verdict.reason` is deleted on the SAME runs by
   *     `mayExplainByRanking = !rankingWasWithheld(rec)` in the view model — a
   *     sentence explaining the verdict by reference to a ranking is unlicensed
   *     once the ranking is withheld. That rule is right and is untouched.
   *
   * So on every withheld run this block could only ever hold the pill, and the
   * trust line prints that same word again below it, with its counts and its
   * route to the detail. Witnessed on the deployed build `bb27081a`, guest,
   * completed run: `-verdict` held exactly ONE child, and `-trust-line-verdict`
   * read the same word 200px lower.
   *
   * ⚠ TWO CORRECT RULINGS PRODUCING ONE DEFECT BETWEEN THEM (trap 21). Neither
   * side is wrong alone, which is exactly why neither side's tests could see it.
   *
   * ⭐ AND THE AMBER IS NOT SPENT FOR NOTHING. The pill is the tone carrier
   * here; `TrustLine` deliberately refuses colour and carries tone by SHAPE
   * (three shield glyphs) with the producer's word beside it, so suppressing a
   * pill that adds no words costs the reader nothing and returns a unit of the
   * rationed amber budget to the sections that earn it.
   */
  const verdictCarriesItsOwnReading = Boolean(
    glance.verdict && (glance.winShare || glance.verdict.reason || glance.winFraction !== null),
  )

  /* ⚠ THE ANSWER DISJUNCT WENT WITH THE ANSWER — the same rule recorded just
     below for the drivers, applied again. This read `showAnswer || …`; the
     conclusion it referred to no longer renders, so the disjunct would have kept
     a qualifier on screen with nothing left on this surface to qualify. */
  const readingOnScreen = Boolean(glance.verdict && glance.winShare)

  /**
   * The scope disclosure's own condition, NAMED so the emptiness guard can read
   * the same expression the child renders on. Written here rather than inlined
   * twice — two copies of one predicate is the mirror this file keeps paying
   * for (trap 12), and the guard's whole job is to agree with the renderer.
   *
   * ⚠ IT BINDS THE NARROWED SCOPE, IT DOES NOT RESTATE THE TEST — and the first
   * version got that wrong in a way the compiler caught. Extracting
   * `comparisonScope.kind === 'partial'` into a BOOLEAN discards TypeScript's
   * narrowing of the discriminated union, so the child below lost `.scope` and
   * `.excluded` and produced 8 ratchet errors. Re-testing the discriminant at
   * the child would have compiled and re-opened the mirror: two expressions,
   * free to drift, which is the whole defect this const exists to close.
   * Binding the narrowed value once gives the guard and the renderer ONE
   * source that cannot disagree, and the compiler enforces it.
   */
  const partialScope = glance.comparisonScope.kind === 'partial' ? glance.comparisonScope : null
  const scopeDisclosureOnScreen = partialScope !== null && glance.comparativeClaim !== 'none'

  /* ⚠ THE DRIVERS DISJUNCT WENT WITH THE LIST. This line says WHOSE numbers the
     run consumed, and it is a qualifier: it must render only where there is
     something on this surface for it to qualify. The driver rows were such a
     thing and are no longer here. */
  const showInputProvenance = Boolean(glance.inputProvenance) && readingOnScreen

  /**
   * ⛔⛔ AN EMPTY LABELLED LANDMARK, AND THE GUARD WRITTEN TO PREVENT ONE WAS
   * WHAT PERMITTED IT.
   *
   * This read `glance.headline || glance.verdict || glance.condition ||
   * ribbon.length > 0`, and its own note states the question correctly: "have I
   * anything to SHOW?". It answered with DATA presence, and two of its four
   * disjuncts were wrong in opposite directions:
   *
   *   · `glance.headline` renders NOTHING since 18 Sep 2026 — Paul's ruling
   *     deleted the conclusion it fed. A dead disjunct that keeps the section
   *     alive over nothing.
   *   · `glance.verdict` is far too broad. Every block a verdict feeds needs
   *     more than the verdict, and on a leader-withheld run the view model
   *     nulls `winShare` and `winFraction` and `mayExplainByRanking` deletes
   *     `verdict.reason` — all three by design. Measured: the section emitted
   *     `<section aria-label="At a glance"></section>`, a named landmark a
   *     screen-reader user can navigate to and find empty.
   *
   * ⚠ AND THE FIRST REPAIR WAS WRONG TOO, WHICH IS WHY THIS ONE IS DERIVED.
   * Rebinding the guard to `verdictCarriesItsOwnReading` alone RED 36 specs:
   * it is ONE of FIVE things this section renders, and the withheld reason and
   * the scope disclosure do not pass through it. An invariant written from the
   * failure mode in hand is narrower than the thing it guards (trap 13d).
   *
   * ⭐ SO THE DISJUNCTION IS THE SECTION'S FIVE TOP-LEVEL CHILDREN, EACH READ
   * FROM THE EXPRESSION THE CHILD ITSELF RENDERS ON — never a paraphrase of it.
   * `scopeDisclosureOnScreen` was named above for exactly that reason. Guard
   * and renderer now share their predicates and cannot drift apart silently.
   */
  const showStatus = part !== 'reading'
  const showReading = part !== 'status'
  const hasReading =
    Boolean(glance.designationWithheldReason) ||
    verdictCarriesItsOwnReading ||
    showInputProvenance ||
    scopeDisclosureOnScreen ||
    Boolean(glance.condition)
  const hasAnything = (showStatus && ribbon.length > 0) || (showReading && hasReading)
  if (!hasAnything) return null

  // The status half is a row above "Move towards commitment", not a second
  // "At a glance" region: when both halves mount, a screen reader must meet
  // one landmark of that name (pre-review of bundle 3, 25 Sep).
  const Wrapper = part === 'status' ? 'div' : 'section'
  return (
    <Wrapper
      className="space-y-3"
      data-testid={part === 'status' ? `${testId}-status` : testId}
      aria-label={part === 'status' ? undefined : COPY.sections.atAGlance}
    >
      {showStatus && ribbon.length > 0 ? (
        <div
          /* ⚠ WRAPS RATHER THAN CRUSHES. Measured in a browser at the 280px
             dock floor: "Re-run to be sure" is 102.7px — 45% of the 230px
             ribbon — leaving 85.3px for a 51-character sentence, which set it
             to FOUR lines of two words. `flex-wrap` plus the floor below drops
             the control to its own line exactly when the sentence can no
             longer afford to share one, and keeps it inline at 420px. */
          className={`flex flex-wrap items-start gap-1.5 ${inset('warning')}`}
          role="status"
          data-testid={`${testId}-ribbon`}
        >
          <AlertTriangle className={`${icon('inline')} mt-[3px] shrink-0 text-warning-ink`} aria-hidden="true" />
          {/* ⚠ `min-w-[11rem]` IS THE WRAP TRIGGER, and it is why `min-w-0`
              had to go: `min-w-0` says "I will shrink to nothing", which is
              precisely the permission that let this sentence be squeezed to
              85px at the dock floor. `text-balance` removes the widow the
              two-line wrap would otherwise leave at 420px. */}
          <span className="min-w-[11rem] flex-1 text-balance">
            {ribbon.map((r, i) => (
              <span
                key={r.testId}
                className={`${typography.panelMeta} text-warning-ink`}
                data-testid={r.testId}
              >
                {i > 0 ? ' ' : null}
                {r.text}
              </span>
            ))}
          </span>
          {/* ⭐⭐ THE MOVE THAT ANSWERS THE SENTENCE. A staleness ribbon states a
              condition the reader cannot act on from here — "we cannot confirm
              whether this analysis reflects the current model" is true, useful,
              and leaves them nowhere to go. Re-running IS the resolution of
              both states, so the one action that settles the doubt sits on the
              doubt.

              ⚠ THE SHELL'S OWN BAR DOES NOT COVER THIS. `ReanalyseBar` renders
              on `semantic === 'changed'`, plus cannot-confirm ONLY when an
              import hold is in play (`heldUnsure = importHold && ...`) — so an
              ordinary unconfirmed run gets the sentence and no control. That
              component's own comment already makes the argument: "You can be
              honestly unsure AND still offer the button."

              ⚠ FAIL-CLOSED. No handler, no button — never a dead affordance,
              the same pre-gate this panel uses for focus targets. */}
          {/* ⛔⛔ A RE-RUN IS OFFERED ONLY WHERE A RE-RUN COULD HELP.
              WITNESSED ON PAUL'S RUN, 19 Sep 14:32Z, staging `fd65f971`.

              The ribbon read *"This analysis is partial. The win share and the
              overall robustness rating did not come back"* with **Re-run to be
              sure** beside it. Both sentences were TRUE. The act was not: CEE
              had suppressed the result on
              `reason=leading_option_claim_withheld`, downstream of
              `CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED` — a property of the
              MODEL, not of the run. Pressing it reaches the same gate, spends
              the same compute, and returns the same partial answer.

              ⭐ THE GATE BELOW ANSWERED "MAY I RE-RUN?" WHEN THE READER NEEDED
              "WOULD RE-RUNNING CHANGE THIS?" — two questions under one control,
              which is the same shape as the CEE suppression that caused it and
              as trap 21 generally. The fix is to name them apart, never to
              align them.

              ⚠ SO THE RE-RUN IS NOT DELETED. Where results are missing by
              FAILURE a re-run is exactly right, and removing it would trade one
              wrong act for another. It is withheld only where the panel knows a
              DESIGNATION was withheld, and the remedy that works — the estimate
              route this component already owns — takes its place.

              ⚠ `leaderWithheld`, NOT `leaderWithholdCause`: the cause is null
              both when nothing was withheld and when the reason cannot be named,
              and the second is the common case. */}
          {onReanalyse && rerunWouldNotHelp && onReviewEstimates ? (
            <button
              type="button"
              onClick={onReviewEstimates}
              /* ⭐ V2 FIDELITY (25 Sep 2026, gap ACTION-9): `hover:text-info-hover`,
                 not `hover:opacity-80` — opacity on `text-info` composited to
                 3.33:1 on hover, below AA (measured on this exact control).
                 `text-info-hover` reads `--info-hover`, the same token the
                 prototype's own `button:hover` rule uses, and it stays AA. */
              className={`${typography.panelMeta} shrink-0 self-start ${action('inline')} underline-offset-2 hover:text-info-hover`}
              data-testid={`${testId}-ribbon-review-estimates`}
            >
              {COPY.glance.reviewEstimates}
            </button>
          ) : onReanalyse && !rerunWouldNotHelp && (!reanalyseBlocked || reanalyseBlockedReason !== null) ? (
            <button
              type="button"
              onClick={onReanalyse}
              /* ⚠ THE CALLER'S PREDICATES, NOT A RESTATEMENT OF THE GATE.
                 `reanalyseBlocked` arrives already derived from the single
                 `runGateResult` in `OutputsDock`, and `isRunning` is that same
                 dock's local flag; nothing here re-reads the gate, so this
                 control cannot form its own opinion about admission. The
                 footer control, `ReanalyseBar`, reads that same verdict since
                 #1212 and disables on
                 `!onReanalyse || blocked || isAnalysing`.

                 ⭐ THE TWO ATTRIBUTES READ DIFFERENT EXPRESSIONS, AND THAT IS
                 THE FIX. `disabled` asks whether the button may be pressed
                 (gate shut OR run in flight); `title` asks whether the gate
                 refused (gate shut only), so a run in flight disables the
                 control WITHOUT captioning it with a refusal that did not
                 happen. Binding both to `reanalyseBlocked` left it pressable
                 mid-run. */
              disabled={reanalyseDisabled}
              title={reanalyseBlocked ? reanalyseBlockedReason ?? undefined : undefined}
              /* ⚠ INFO, NOT THE RIBBON'S AMBER — colour says PRESSABLE here, not
                 SEVERE. Beside it, `r.text` is `panelMeta text-warning`: the
                 same size and the same colour, separated only by an underline
                 at 11px, so a reader scanning an amber block cannot tell the
                 sentence from the control. Amber stays on the status; the one
                 thing you can press is the one thing in the action colour. */
              /* `disabled:no-underline` is not decoration: the underline is half of
                 what says PRESSABLE on this strip (the other half is `text-info`),
                 so a refused control must stop claiming it. */
              /* ⚠⚠ NAMED, NOT SPELLED. This string used to write the tier out by
                 hand — `rounded … text-info underline` plus `ACTION_FOCUS`
                 verbatim — so #1655's touch target, which lives ON the tier,
                 could never reach it. The disabled treatment stays here because
                 it is genuinely this control's own; the geometry and the colour
                 are the tier's. */
              /* ⭐ V2 FIDELITY (25 Sep 2026, gap ACTION-9): see the review-estimates
                 control above — `hover:text-info-hover` replaces the failing
                 `hover:opacity-80`. The disabled treatment is untouched. */
              className={`${typography.panelMeta} shrink-0 self-start ${action('inline')} underline-offset-2 hover:text-info-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline disabled:hover:opacity-50`}
              data-testid={`${testId}-ribbon-reanalyse`}
            >
              {COPY.status.reanalyseToBeSure}
            </button>
          ) : null}
        </div>
      ) : null}
      {showReading ? (
      <>

      {/* ── THE ANSWER ─────────────────────────────────────────────────────
          The only large type on the surface. `headline`'s present-tense
          sentence is never rendered here (rule 3) — see the eyebrow note.

          ⚠⚠ THE EYEBROW NO LONGER SWITCHES ON FRESHNESS, AND THE REASON IS THAT
          THE SENTENCE IT WAS RE-TENSING IS NOT ON THIS SURFACE. `eyebrowStale`
          ("As last analysed") existed to put `glance.headline` — composed as
          "… currently scores higher" — into the past. But the line below renders
          `glance.leaderLabel ?? glance.headline`, and the view model sets
          `leaderLabel = headline && leader ? leader.label : null` while
          `headline` is non-null only when `leader` is: so `leaderLabel` is
          non-null exactly when `headline` is, the fallback never fires, and what
          reaches the screen is the OPTION LABEL — a noun phrase, carrying no
          tense to repair. (`freshnessSaidOnce.spec.tsx` pins that precondition
          in-test rather than trusting this paragraph.)

          What the swap DID do was cost the reader the role label on exactly the
          runs where the reading is hardest: a stale panel named an option and
          no longer said it was the leading one. The freshness condition is
          stated once, in the ribbon directly above, where it scopes the whole
          panel instead of one line — three statements of one fact is noise, and
          noise crowds out the only useful response, which is to re-run. */}
      {/* ⛔⛔ THE CONCLUSION IS GONE. DELETED, NOT MOVED, NOT HIDDEN.
          Paul's ruling, 18 Sep 2026, verbatim: "delete the conclusion entirely —
          there shouldn't be a conclusion. We are a reasoning enhancement tool,
          not a generic AI and analysis answering tool."

          WHAT STOOD HERE: an eyebrow ("Most likely to serve your goal"), the
          leading option's name, and beneath it the line disclosing that Olumi
          invented that option. #1676 had already demoted the name from 18px to
          14px; this removes it.

          ⭐ THE PROVENANCE DISCLOSURE IS NOT LOST, AND THAT WAS THE ONLY THING
          THAT MADE DELETION RISKY. "Olumi suggested this option, you did not
          name it" has a SECOND owner: `OptionsComparison` stamps
          `option-origin-mark-<id>` on the rows themselves (`sharedOrigin`,
          #1648). Checked at the bytes before deleting, because removing the one
          place the product admits AI authorship would have been a worse defect
          than the one being fixed.

          ⚠ THE MODEL'S NUMBERS ARE UNTOUCHED. Every option, its win share and
          its ranking still render in the comparison below. What is deleted is
          the panel ANNOUNCING one of them as the answer — a verdict, not data.

          The withheld branch below STAYS, and is not the same thing: it does not
          conclude, it explains why the model declined to, which is the reader's
          cue to supply their own estimate. */}
      {glance.designationWithheldReason ? (
        /* ── WHY THERE IS NO ANSWER ────────────────────────────────────────
           ⭐⭐ SILENCE IS NOT A DENIAL. Until this slot existed, a run whose
           model REFUSED to license a comparative claim rendered exactly what an
           ordinary run with no leading candidate rendered: nothing. The reader
           could not tell "the model declined to conclude this" from "there was
           nothing to conclude". `heroTypes.ts:411-412` names that hazard for the
           hero; this is its Reasoning-tab twin.

           The sentence is the PRODUCER'S, rendered unparaphrased and
           untruncated. It is not composed here and it is not templated: the
           panel may not soften, sharpen or summarise what the model refused,
           because the refusal is the model's claim to make and ours to carry.

           ⚠ `role="status"` — this is a statement about the run, in the slot
           where the answer would otherwise be, so it must reach a screen reader
           the way the ribbon above does rather than as unannounced prose. */
        /* ⭐ V2 prototype: the refusal sentence is not on the default scroll.
           It sits behind ONE door, closed at rest — still the producer's
           sentence, unparaphrased, one click away (the "Still open" bullet
           and the qualifier already say the ordering is unconfirmed). */
        <div data-testid={`${testId}-withheld-disclosure`}>
          <button
            type="button"
            aria-expanded={withheldOpen}
            onClick={() => setWithheldOpen((o) => !o)}
            className={`${typography.panelBody} ${action('disclose')}`}
            data-testid={`${testId}-withheld-toggle`}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-text-light ${withheldOpen ? 'rotate-90' : ''}`}
              aria-hidden={true}
            />
            {COPY.glance.eyebrowWhyWithheld}
          </button>
          {withheldOpen ? (
        <div role="status">
          <p
            className={`${typography.panelBody} mt-1 mb-0 text-text-body text-pretty`}
            data-testid={`${testId}-withheld-reason`}
          >
            {glance.designationWithheldReason}
          </p>
          {/* ⭐⭐ THE MOVE THAT ANSWERS THE SENTENCE — the staleness ribbon's
              argument, applied to the refusal. The producer names its own
              remedy ("until you have set at least one of them") and the reader
              has no way to reach it from here: the estimates live on the Model
              tab, which is a different surface in a dock this panel does not
              control. The sentence was legible and inert.

              ⛔⛔ WHAT THIS CONTROL DOES NOT SAY, AND WHY IT IS A MEASUREMENT.
              One user-stated value out of twenty flips CEE from
              `quantified_provisional` to `comparative_leader` while nineteen
              estimates stay Olumi's own — so a caption promising a more
              confident answer would describe a real transition and still lie
              about it. What the transition licenses is the CLAIM, because a
              human entered the loop; not a better result. It equally may not
              offer to CONFIRM the figures as they stand, which would launder a
              machine estimate into a user-stated one and satisfy the gate
              while meaning nothing. `COPY.glance.reviewEstimates` carries both
              ceilings and `withheldReasonHasAMove.spec.tsx` holds them.

              ⚠ NO FACTOR IS NAMED, AND THE ROUTE REFLECTS THAT. Measured on
              the live wire, `missing_important_inputs` is EMPTY on this
              refusal and the sentence says "at least ONE of them" — there is
              no particular estimate to point at, so the destination is the
              factors SECTION. The dock's handler passes no target id for the
              same reason; inventing one would be a deep link to an arbitrary
              row dressed as the answer.

              ⛔⛔ AND IT IS GATED ON THE CAUSE, NOT JUST ON THE HANDLER —
              THIS IS THE HALF THAT MAKES THE ACT TRUE. Every mode other than
              `comparative_leader` withholds the designation, so the sentence
              above is one of SEVERAL producer refusals, and only two of them
              name an estimate. The others say "Name at least two different
              options you are weighing", or "This model cannot be analysed
              yet". Offering "review or set an estimate" under those takes the
              reader to Factors to do something that cannot lift the refusal —
              a futile instruction under a true sentence, which is worse than
              the sentence alone, because it spends trust the refusal just
              earned. `glance.designationWithheldRemedy` is `'estimate'` only
              for the two causes whose own words ask for one, fail-closed on
              every other and on an unrecognised one. Its corpus, including the
              opposite-direction twins, is in
              `withheldReasonHasAMove.spec.tsx`.

              ⚠ FAIL-CLOSED TWICE OVER, AND THE TWO HALVES ANSWER DIFFERENT
              QUESTIONS — do not fold them. The handler asks "can this host
              route anywhere?"; the remedy asks "does the sentence above ask
              for an estimate?". A host with nowhere to send the user and a
              refusal that names an option are both reasons to render the
              sentence alone, but they are not the same reason, and collapsing
              them would put one predicate where two belong. */}
          {/* ── WHICH PARAMETERS, NAMED ─────────────────────────────────
              ⛔ THE WHOLE SET, NEVER A MEMBER. CEE publishes these in GRAPH
              ORDER and computes no priority over them, so rendering one as
              "the place to start" would be the arbitrary row dressed as the
              answer that the block above forbids. The builder returns the set
              or nothing; this renders the set or nothing.

              ⚠ THE CAP IS THE CONSUMER'S AND IT DISCLOSES ITSELF. Four names
              plus "and N more" — a reader can see the list is cut. The
              PRODUCER may not cap for exactly the inverse reason: a truncated
              wire list is an understatement nothing downstream can detect.

              ⛔ AND THE DISCLOSURE IS THE LIST'S FINAL MEMBER, NOT A SUFFIX
              BOLTED ON AFTER IT. That is what makes the sentence above come
              out as written: `formatConjunctionList` is `Intl.ListFormat`
              with `type: 'conjunction'`, so handing it five items yields
              "four names, comma-separated, AND the fifth" — which is exactly
              "Four names plus 'and N more'". The joiner owns every comma and
              the single "and", which is also why the en-GB punctuation rules
              live in one place rather than being re-derived here.

              ⚠⚠ SO `COPY.glance.withheldParametersMore` MUST NOT OPEN WITH
              "and", AND IT DID UNTIL 2026-09-12. The joiner inserted its own
              before this member and the line rendered "… Customer and Staff
              Engagement AND AND 4 more" on a refusal witnessed on deployed
              staging. Two ways to put that back: restore the "and" to the
              constant, or lift this member out of the array and append it as
              a suffix — the second reads "… Disruption and Customer and Staff
              Engagement and 4 more", which is the same clumsiness one comma
              further along, and it needs a second joiner for the labels. The
              constant carries the other half of this note.
              `withheldParametersReadAsOneSentence.spec.tsx` pins the rendered
              English in BOTH branches by exact equality. */}
          {glance.designationWithheldParameters.length > 0 ? (
            <p
              className={`${typography.panelMeta} mt-1 text-text-light`}
              data-testid={`${testId}-withheld-parameters`}
            >
              {COPY.glance.withheldParametersLeadIn}{' '}
              <span className="text-text-body">
                {formatConjunctionList([
                  ...glance.designationWithheldParameters
                    .slice(0, WITHHELD_PARAMETER_CAP)
                    .map((p) => p.label),
                  ...(glance.designationWithheldParameters.length > WITHHELD_PARAMETER_CAP
                    ? [
                        COPY.glance.withheldParametersMore(
                          glance.designationWithheldParameters.length - WITHHELD_PARAMETER_CAP,
                        ),
                      ]
                    : []),
                ])}
              </span>
            </p>
          ) : null}
          {onReviewEstimates && glance.designationWithheldRemedy === 'estimate' ? (
            <button
              type="button"
              onClick={onReviewEstimates}
              /* ⚠ INFO IS THE ACTION COLOUR ON THIS PANEL and this is a real
                 `<button>`, so `actionColourMeansPressable.spec.ts` licenses
                 it by ancestry. Underline plus `text-info` is what says
                 PRESSABLE here — the sentence above is `panelBody
                 text-text-body`, so the two cannot be confused at rest. */
              /* ⛔⛔ THIS CONTROL IS WHY #1655 EXISTED, AND #1655 COULD NOT REACH
                 IT. Its rationale named this exact button — “the ONLY route out
                 of a withheld verdict” — and put the 24px touch target on
                 `ACTION_TIER.inline`. But this className spelled the tier out by
                 HAND, so the fix landed on a tier this call site never used.
                 Measured on deployed `45659d8f`, on the surface a fresh guest
                 actually lands on: **133×15**. The per-call-site spelling is the
                 defect the tier exists to end, surviving inside the control the
                 tier was created for. */
              /* ⭐ V2 FIDELITY (25 Sep 2026, gap ACTION-9): see the ribbon's
                 review-estimates control above — `hover:text-info-hover`
                 replaces the failing `hover:opacity-80`. */
              className={`${typography.panelMeta} mt-1.5 ${action('inline')} underline-offset-2 hover:text-info-hover`}
              data-testid={`${testId}-withheld-review-estimates`}
            >
              {COPY.glance.reviewEstimates}
            </button>
          ) : null}
        </div>
          ) : null}
        </div>
      ) : null}

      {/* ── HOW MUCH TO RELY ON IT ─────────────────────────────────────────
          The share AS A SENTENCE with a bar, the verdict word as a pill beside
          it, the producer's own reason sentence beneath.

          ⚠⚠ THIS BLOCK RENDERED THE SHARE AS A BARE NUMERAL IN THE PANEL'S
          LARGEST TYPE UNTIL 2026-08-31, and that was the defect, not the
          styling. Olumi's alignment principle says the product must mitigate
          anchoring — "especially anchoring on a number the AI supplied" — and
          on a fresh run every input feeding this share is Olumi's own estimate,
          not the user's. A percentage set larger than everything around it is
          read as the answer, which is the one thing this panel is not for.

          The fix is not a smaller numeral: it is `winShare`, the producer-
          gated sentence the view model already composed and nothing rendered
          ("Ahead in 66% of simulated futures"). The number survives intact —
          it is simply no longer the largest thing on screen, and it now
          arrives inside a claim that says what it ranges over. The separate
          caption beneath it went with it; the sentence subsumes it. */}
      {/* ⭐ ONE UNIT: THE READING, AND WHAT IT RESTS ON. Grouped so the
          section's `space-y-3` spaces the PAIR from its neighbours rather than
          spacing the qualifier away from the claim it qualifies. */}
      {verdictCarriesItsOwnReading || showInputProvenance ? (
        <div data-testid={`${testId}-reading`}>
          {verdictCarriesItsOwnReading && glance.verdict ? (
            <div data-testid={`${testId}-verdict`} data-verdict-tone={glance.verdict.tone}>
              <div className="flex items-start gap-2">
                {glance.winShare ? (
                  <span
                    className={`${typography.panelBody} text-text-header`}
                    data-testid={`${testId}-win-share`}
                  >
                    {glance.winShare}
                  </span>
                ) : null}
                <span
                  className={`${typography.panelMeta} shrink-0 rounded-full px-2 py-0.5 ${
                    reassuranceIsStale(glance.verdict.tone, isStale)
                      ? TONE_PILL_STALE
                      : TONE_PILL[glance.verdict.tone]
                  }`}
                  data-testid={`${testId}-verdict-line`}
                  // The producer's own verdict, unchanged — the demotion is a
                  // display decision about currency, never a re-reading of what the
                  // analysis found.
                  data-verdict-demoted={
                    reassuranceIsStale(glance.verdict.tone, isStale) ? 'stale' : undefined
                  }
                >
                  {reassuranceIsStale(glance.verdict.tone, isStale) ? null : glance.verdict.tone ===
                    'stable' ? (
                    <CheckCircle className={`inline ${icon('inline')} -mt-px mr-1`} aria-hidden="true" />
                  ) : (
                    <AlertTriangle className={`inline ${icon('inline')} -mt-px mr-1`} aria-hidden="true" />
                  )}
                  {glance.verdict.label}
                </span>
              </div>

              {/* ⚠ DIRECTLY UNDER THE LABEL, BEFORE THE BAR — the producer's reason
                  is the SECOND CLAUSE of a sentence whose first clause is the
                  verdict label, so it begins lowercase by construction:
                  "Sensitive" + "none of the factors we could test changed which
                  option leads on its own, but…". Rendered after the win bar it
                  read as a detached fragment starting mid-sentence — witnessed on
                  the deployed build (`b14cd478`, guest, 291px dock, completed run)
                  as an 11px block with its antecedent two elements away.

                  `AnalysisFooter` already renders this exact producer string
                  directly beneath its status word, with nothing between, and
                  `AnalysisFooter.metaWrap.spec.tsx` pins the wrap treatment and
                  the verbatim text (not the adjacency).

                  ⚠ THE COPY IS UNCHANGED AND STAYS THE PRODUCER'S. An ORDERING
                  fix, not a rewrite. Capitalising the clause here would falsify a
                  sentence CEE composed as a continuation.

                  ⚠ RESOLVED AGAINST #1195, WHICH LANDED FIRST AND KEPT THE OLD
                  ORDER INSIDE A NEW WRAPPER. Both fixes are kept: the wrapper is
                  staging's, the order is this one's. Taking either side wholesale
                  reverts the other. */}
              {glance.verdict.reason ? (
                <p
                  className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
                  data-testid={`${testId}-verdict-reason`}
                >
                  {/* ⛔ THE PRODUCER COMPOSED THIS MID-SENTENCE, AND THIS PANEL
                      IS THE ONLY CONSUMER THAT OPENS ONE WITH IT. The wire
                      fixture is `robustnessVerdictReason: 'held up across the
                      ranges we varied'`, and `TriageActionCardsBody:946` spends
                      it as a native tooltip where a bare clause reads fine.
                      Here it is a standalone paragraph, so on the deployed
                      build `7ec3fed2` the glance's second line began "varying
                      any one of the factors we could test…" — lower case, mid
                      air.

                      ⚠ FIRST CHARACTER ONLY, AND THE PRECEDENT IS THIS PANEL'S
                      OWN. `sentenceCase` exists because `missingResultLabels`
                      hit the same boundary ("composed mid-sentence, behind a
                      dash… moves them to the front of the second one. Only the
                      first character is touched"). The producer stays the sole
                      owner of the words; the panel owns only where a sentence
                      begins. */}
                  {sentenceCase(glance.verdict.reason)}
                </p>
              ) : null}
              {glance.winFraction !== null ? (
                /* ⭐⭐ ADOPTED, AND THE ROUNDING DEFECT GOES WITH IT.
                   This was `Math.round(winFraction * 100)` — the exact
                   expression `OptionsComparison` removed after it shipped a
                   measured non-zero share as a 0px fill on deployed `ce32426c`
                   ("< 1%" beside an empty track). The same defect was still
                   live HERE, in the glance, which is the first figure a reader
                   meets. `PanelFigure` floors a strictly-positive fraction and
                   leaves a genuine zero empty, so the fix arrives with the
                   grammar rather than needing to be remembered a third time.

                   ⚠ AND THE TRACK WAS `h-1` — the 4px hairline #1346 ruled out
                   as "a comparison drawn at four pixels reads as no comparison
                   at all". It survived here because nothing swept for it. */
                <PanelFigure
                  variant="share"
                  tone={glance.verdict.tone === 'stable' ? 'stable' : 'caution'}
                  className="mt-1.5"
                  fraction={glance.winFraction}
                  testId={`${testId}-win-bar`}
                />
              ) : null}

            </div>
          ) : null}

          {/* ── WHAT IT RESTS ON ───────────────────────────────────────────────
              ⭐⭐ THE ANTECEDENT, AND IT BELONGS HERE RATHER THAN ANYWHERE ELSE.

              Olumi's alignment principle is conditional in form: analysis describes
              what the model implies GIVEN its assumptions and evidence, and what
              the product invented must stay distinguishable from what the user
              knows. This panel had the consequent in its largest type and the
              antecedent nowhere — on a run driven 30 Aug 2026 every factor was
              Olumi's own estimate, and the surface stating "Ahead in 68% of
              simulated futures" said so in no place a reader would reach.

              It sits immediately beneath the share, not in a disclosure and not at
              the foot of the panel, for the same reason the scope note does: it
              changes what the sentence above means, so a reader who sees one must
              see the other.

              ⚠ IT DOES NOT GO QUIET WHEN THE PRODUCER DOES. That was the defect:
              a run whose factor rows the producer left unsettled — the commonest
              real payload, 9 of the 25 factor-bearing captures in this repo —
              rendered no line at all, so the share above sat with its basis stated
              nowhere and read as though something had established it. That run now
              resolves to the `undetermined` kind and says so.

              ⚠ STILL SILENT WHERE SILENCE IS THE TRUTH. `inputProvenance` is null
              when there are no factor rows to describe, and this renders nothing
              at all in that state. There is no fallback wording, because every
              wording that attributes the figures to somebody is a claim.

              ⚠ GATED ON A READING BEING PRESENT. A bare statement of what the
              inputs were, with no conclusion above it to condition, is a caveat
              orphaned from its claim. */}
          {showInputProvenance && glance.inputProvenance ? (
            <p
              className={`${typography.panelMeta} text-text-light m-0 mt-1`}
              data-testid={`${testId}-input-provenance`}
              data-input-provenance={glance.inputProvenance}
            >
              {GLANCE_PROVENANCE_COPY[glance.inputProvenance]}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── SCOPE ──────────────────────────────────────────────────────────
          Excluded options were two full prose paragraphs each repeating the
          same sentence. They are now rows in a list: same facts, same
          sanctioned copy, a fraction of the visual mass. */}
      {scopeDisclosureOnScreen && partialScope ? (
        <div data-testid={`${testId}-scope`}>
          <ComparisonScopeNote
            scope={partialScope.scope}
            surface="analysisNew"
            withDetail={glance.comparativeClaim === 'value'}
          />
          <ul className="mt-1 space-y-0.5 list-none p-0 m-0">
            {(showAllExcluded
              ? partialScope.excluded
              : partialScope.excluded.slice(0, EXCLUDED_OPTION_VISIBLE_CAP)
            ).map((o) => (
              <li
                key={o.id}
                className={`${typography.panelMeta} text-text-light flex items-start gap-1.5`}
                data-testid={`${testId}-excluded-option`}
                data-option-id={o.id}
                /* ⛔ `null` IS NO TOOLTIP, not an empty one: the view model
                   withheld a ground it could not license (see `reasonCopy`). */
                title={o.reasonCopy ?? undefined}
              >
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-text-light" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="text-text-body">{o.label}</span>
                  {/* ⭐ A FULL STOP, NOT A DASH. Paul, 10 Sep 2026: no em dashes in
                      product content. This slot held `{' — '}` and was the last one
                      on this tab, carried as a HANDED_OFF row in
                      `noEmDashesInRenderedCopy.spec.ts` while another seat held the
                      file. That row is now deleted; leaving it would RED the guard.

                      ⚠ THE STOP IS CHOSEN FOR THE CONCATENATION, NOT FOR THE LINE.
                      The `sr-only` span below opens with its own `. `, so an
                      assistive technology reads the three parts as three complete
                      statements:

                        "<label>. Not analysed. The analysis returned no result …"

                      `NOT_ANALYSED_BADGE` is the constant 'Not analysed' and carries
                      no terminal punctuation, so nothing here doubles a full stop and
                      no fragment is left stranded. An en dash was NOT an option: it
                      is the same hedge in a narrower glyph. The two halves both
                      survive — the label and the badge are untouched. */}
                  {'. '}
                  {NOT_ANALYSED_BADGE}
                  {o.reasonCopy !== null ? <span className="sr-only">{`. ${o.reasonCopy}`}</span> : null}
                </span>
              </li>
            ))}
            {/* ⭐ THE OPTIONS THIS LIST CANNOT NAME, so the section adds up.
                `excluded` is filtered to options with a usable label
                (`buildAnalysisNewViewModel.ts` drops a blank label and one that
                is merely the node's own id). The scope sentence above counts
                ALL of them — "…and 28 others were left out" — so without this
                row the sentence and the list below it report two different
                populations, and the disclosure control offers to reveal 3 when
                the sentence just said 28. Same defect class as the two caps
                this change bound together, one level out. */}
            {(() => {
              const s = partialScope.scope
              const unnameable = s.total - s.analysed - partialScope.excluded.length
              return unnameable > 0 ? (
                <li
                  className={`${typography.panelMeta} text-text-light flex items-start gap-1.5`}
                  data-testid={`${testId}-excluded-unnamed`}
                >
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-text-light" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {COPY.disclosure.unnamedExcluded(unnameable)}
                  </span>
                </li>
              ) : null
            })()}
          </ul>
          {partialScope.excluded.length > EXCLUDED_OPTION_VISIBLE_CAP ? (
            <button
              type="button"
              onClick={() => setShowAllExcluded((v) => !v)}
              aria-expanded={showAllExcluded}
              className={`${typography.panelMeta} text-text-light mt-1 rounded underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-excluded-more`}
            >
              {showAllExcluded
                ? COPY.disclosure.collapse
                : COPY.disclosure.moreExcluded(
                    partialScope.excluded.length - EXCLUDED_OPTION_VISIBLE_CAP,
                  )}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ⛔ THE GLANCE NO LONGER LISTS DRIVERS — REMOVED AT `e15416ad`.

          It rendered "What matters most": the top three factors with a bar
          each, one scroll above "Drivers and dynamics", which renders the
          same factors again. Derived at the bytes rather than judged by eye:
          `glanceDrivers` and `buildDrivers` (both `buildAnalysisNewViewModel`)
          read the same `data.drivers.drivers`, drop the same `zeroReason`
          rows, take the same `displayInfluence` magnitude and divide by the
          same within-run maximum. This list was a strict SUBSET of the
          chart’s rows carrying a strict SUBSET of its information — it had no
          direction — so it was a summary of something one click away, not a
          second question.

          ⚠ WHAT WENT WITH IT, AND WHERE IT WENT. The basis caption
          ("Influence" / "Relative influence") disclosed which scale the bars
          were on through a `title` tooltip, which a touch reader cannot open;
          the drivers section carries that disclosure as a VISIBLE caveat.
          ⚠ CORRECTED 7 Sep 2026 — this said "both branches … (`coverage.
          structuralInfluence` / `coverage.setRelativeInfluence`)". Since #1228
          only `coverage.setRelativeInfluence` reaches a screen; the structural
          branch was reachable only on a run with no bars, where its own
          sentence opens "Each bar", and the basis line is now withheld there.
          The "+N more drivers" line declared
          this list’s cap of three; the section states the true count on its
          collapsed row and the chart renders every row, so there is no cap
          left to declare.

          ⚠ `glance.drivers` ITSELF IS NOT REMOVED. `nodeInsights.ts` still
          reads it to decide whether a node earns `ModelStrip`’s
          "What matters most" chip, which is a per-node claim rather than a
          restatement of the ranking. */}
      {/* ── WHAT COULD CHANGE IT ───────────────────────────────────────────── */}
      {glance.condition ? (
        (() => {
          const focusable = Boolean(glance.condition.targetId && onFocusTarget)
          const Row = (
            <>
              <AlertTriangle
                className={`${icon('row')} mt-[3px] shrink-0 text-warning-ink`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="text-text-header">{COPY.glance.couldChangeIf}</span>{' '}
                {glance.condition!.text}
              </span>
              {focusable ? (
                <ChevronRight className={`${icon('row')} mt-0.5 shrink-0 text-text-light`} aria-hidden="true" />
              ) : null}
            </>
          )
          return (
            <div
              className={inset('warning')}
              data-testid={`${testId}-condition`}
            >
              {focusable ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget!(glance.condition!.targetId!)}
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-condition-focus`}
                >
                  {Row}
                </button>
              ) : (
                <p
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 m-0`}
                >
                  {Row}
                </p>
              )}
            </div>
          )
        })()
      ) : null}

      {/* ⚠⚠ THE PRIMARY INTERVENTION MOVED OUT, 18 Sep 2026 — it is now
          `sections/PrimaryIntervention.tsx`, rendered by the body in
          ZONE: ALSO ("Also worth doing").

          ⭐ ITS OWN HEADING HERE SAID WHY: "WHAT TO THINK ABOUT NEXT". A next
          action is not part of the answer, and inside this component it cost
          the answer zone 90px including its gap. At 1440×860 that was the
          difference between showing "what matters most" and "how the options
          compare" together and not — every information-preserving spacing trim
          combined saved only 63px of the 89 needed.

          ⛔ `(primaryIntervention && onRunIntervention)` LEFT `hasAnything`
          WITH IT, and that is this file's own recorded rule rather than a
          judgement: the note there records a disjunct outliving its content
          once already, which "would have rendered the section's wrapper and
          heading over empty space". */}
      </>
      ) : null}
    </Wrapper>
  )
}
