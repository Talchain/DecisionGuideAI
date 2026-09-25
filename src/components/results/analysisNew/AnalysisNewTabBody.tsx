/**
 * Analysis (New) — the experimental Analysis surface (Paul, 27 Aug 2026).
 *
 * A SECOND, SEPARATE tab beside the existing Analysis tab, rendering THE SAME
 * analysis run through a reasoning-led information architecture so the two can
 * be compared directly on one scenario. The existing Analysis tab is untouched.
 *
 * The questions, IN MOUNT ORDER — and it is mount order deliberately, because
 * a list like this is a hand-maintained mirror (CLAUDE.md trap 12) and the only
 * thing that stops one drifting is being able to read it against the render:
 *
 *   How can we strengthen this?       → Strengthen the reasoning
 *   What did the run CHECK?           → What we checked
 *   How do the options compare?       → Options comparison
 *   What should we notice?            → Key insights
 *   What is shaping the situation?    → Drivers and dynamics
 *   What is still uncertain?          → Uncertainty and gaps
 *   (everything deeper)               → one collapsed region
 *
 * ⚠ THE ORDER IS NOT AUTHORITATIVE HERE. It is pinned by the spec ("the
 * coaching sits directly under the reading it responds to"), which is what will
 * actually go RED if the render moves; this list is orientation, not a guard.
 *
 * ⭐ SINGLE DATA AUTHORITY. `resultsSectionData` arrives as a PROP — the same
 * instance `OutputsDock` hands `ResultsBody`. This surface calls no analysis
 * hook of its own, issues no request, and writes to no store. Switching tabs
 * therefore cannot re-run analysis, produce a second result, change canonical
 * state, change readiness or change staleness. That is what makes this a
 * presentation comparison rather than an A/B test on different data, and it is
 * the property `canvas/components/__tests__/OutputsDock.analysisNewTab.spec.tsx`
 * pins ("switching tabs issues NO network request and mutates NO canonical state").
 *
 * ⚠ ON WIDTH (§11), STATED AS A LIMITATION RATHER THAN SOLVED — and CORRECTED
 * at the mounted build. This said "the dock's outer width is 416px, fixed by the
 * workspace shell". It is NOT fixed: `dockWidth.ts` makes it responsive between
 * DOCK_MIN_WIDTH 280 and DOCK_RESPONSIVE_MAX_WIDTH 416, with a persisted user
 * drag overriding both up to 480. The content measure therefore ranges 238–320px
 * and this surface is verified across it. Varying the dock per surface remains a
 * shell-level change that would alter the existing Analysis tab's container, so
 * it is deliberately NOT done. The narrower, calmer treatment is scoped to this
 * tab's INNER content measure — wider gutters, a capped measure, and far fewer
 * elements per screen. The outer panel is unchanged.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Star, TrendingUp, GitBranch } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { attentionNoteForRecommendation } from '../strengthen/recommendationAttention'
import { openDecisionRecord, useDecisionRecordForScenario, hasAnalysedOptions } from '../modals'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { distinctDriverSubjects } from './driverSubjectCount'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import { ANALYSIS_NEW_LIMITS } from './buildAnalysisNewViewModel'
import type { AnalysisNewFinding, AnalysisNewViewModel } from './analysisNewTypes'

/** Stable empty list, so a withheld run does not hand the memo a new array per render. */
const NO_FINDINGS: AnalysisNewFinding[] = []
import { useAnalysisNewViewModel } from './useAnalysisNewViewModel'
import { buildNodeInsights, mentionSectionsFrom } from './nodeInsights'
import { buildModelStrip, stripHasContent, stripRendersTargetAffordance } from './buildModelStrip'
import { FocusNowContainer } from '../../../canvas/components/coaching-panel/focus-now'
import { applicableStaticFocusIds } from './focusNowApplicability'
import { useCanvasStore } from '../../../canvas/store'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../strengthen/buildRecommendations'
import { WhyNoAnalysisYet } from './sections/WhyNoAnalysisYet'
import { useAnalysisRunState } from '../analysisState/useAnalysisRunState'
import { deriveLatestRunNote } from './latestRunNote'
import {
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_POINTER,
  ANALYSIS_REFUSAL_REASON_COPY,
} from '../../../canvas/store/analysisRefusalNotice'
import type { GateBlockedListing } from '../../../canvas/utils/canRunAnalysis'
// The act below takes its geometry from the tier, never from this call site —
// `everyInlineActIsReachableByTouch` exists to keep that the single source.
import { action, PANEL_RULE } from './panelSurfaces'
import { AnalysisNewSection } from './sections/AnalysisNewSection'
import { DriverInfluenceChart } from './sections/DriverInfluenceChart'
import {
  WhatIWasGivenSection,
  useEstimatedValueActIsAvailable,
} from '../contextIntegrity/WhatIWasGivenSection'
import type { WhatIWasGivenSectionHandle } from '../contextIntegrity/WhatIWasGivenSection'
import { useWhatIWasGivenWillRender } from '../contextIntegrity/WhatIWasGivenSection'
import { ModelStrip } from './sections/ModelStrip'
import { WhatsChanged } from './sections/WhatsChanged'
import { AtAGlance } from './sections/AtAGlance'
import { ModelHeldUp } from './sections/ModelHeldUp'
import { RobustnessCaveat } from './sections/RobustnessCaveat'
import { BiasGrounding } from './sections/BiasGrounding'
import { OptionsComparison } from './sections/OptionsComparison'
import { SectionShell } from './sections/SectionShell'
import { MethodStrip } from './sections/MethodStrip'
import { CommitmentSummary } from './sections/CommitmentSummary'
import { buildCommitmentSynthesis } from './commitmentSynthesis'
import { ChallengeCard } from './sections/ChallengeCard'
import { ReasoningSignals } from './sections/ReasoningSignals'
import { AboutThisAnalysis } from './sections/AboutThisAnalysis'
import { ModelReviewTool } from './sections/ModelReviewTool'
import { disagreeWithRecommendationPayload } from './buildReviewQueue'
import { runMethod } from './runMethod'
import { METHOD_CATALOGUE } from '../decision-overview/actionsCatalogue'
import { methodIdsRaisedBy } from './recommendationMethod'
import { buildBiasGrounding } from './biasGrounding'
import { ZERO_REASON_BADGE_LABELS } from '../influenceScaleCopy'
import { buildCommitmentQualifier } from './commitmentQualifier'

/**
 * ⭐ THIS TAB OPTS IN TO CORRECTING AN ESTIMATE WHERE IT IS STATED, and says so
 * ONCE. Two surfaces read it: the `WhatIWasGivenSection` mount, which turns the
 * per-row control on, and `useEstimatedValueActIsAvailable`, which tells the
 * withheld-designation act whether there is anything here to reveal. A second
 * literal would let those two disagree, and the disagreement would present as a
 * control that routes nowhere.
 *
 * ⚠ IT IS NOT A FLAG AND MUST NOT BECOME ONE. `offerEstimatedValueControl`
 * defaults to `false` so the PARKED Analysis tab (`ResultsBody`) does not
 * acquire a writer; this constant is the Reasoning tab's answer to that
 * default, pinned by `WhatIWasGivenSection.estimatedValueControl.spec.tsx`
 * at the mount.
 */
const REASONING_TAB_EDITS_ESTIMATES = true

export interface AnalysisNewTabBodyProps {
  /**
   * ⭐ THE RUN GATE'S OWN PUBLISHED REFUSAL, passed rather than recomputed.
   *
   * `OutputsDock` already holds `runGateResult.blockedListing` — the gate
   * publishes the summary string BESIDE the itemised list from one computation
   * so consumers can prove they came from the same place. This panel renders it
   * pre-run and adds no rung of its own. Optional: absent from every caller that
   * has no gate result (specs, the legacy mount), and absence renders nothing.
   */
  blockedListing?: GateBlockedListing | null

  /** THE SAME instance OutputsDock hands ResultsBody. Never re-derived here. */
  resultsSectionData: ResultsSectionDataReturn
  isPreRun: boolean
  isRunning: boolean
  /**
   * ⭐ THE COMPOSED RUN AUTHORITY, AND IT IS A DIFFERENT QUESTION FROM
   * `isRunning` ABOVE — which is why it is a second prop and not a swap.
   *
   * `isRunning` feeds `useAnalysisNewViewModel`, so it decides `vm.status` and
   * every sentence derived from it; changing what it carries would move all of
   * that. This one decides ONE thing: whether the content is marked busy for
   * assistive tech.
   *
   * They must not diverge, and they did. Review of the first cut demonstrated
   * by execution that the marker read the dock's LOCAL `isRunning` while
   * `AnalysisRunStateCover` and `AnalysisRunAnnouncer` — mounted beside it, on
   * the same tab — read the composed `localRunning || wireRunning`. In the
   * wire-asserted-run class the user was TOLD an analysis was running and the
   * content was NOT marked: `cover=present`, `isRunning_prop=false`,
   * `aria-busy=null`. This surface was the one thing #1201 exists to stop it
   * being: the surface blind to a wire-asserted run.
   *
   * Absent, it falls back to `isRunning` — today's behaviour for any caller
   * that has not been given the composed value, never a silent "not running".
   */
  isBusy?: boolean
  /**
   * ⭐⭐ THE CLIENT HAS STOPPED WAITING FOR THIS RUN — a DIFFERENT fact from
   * `isBusy`, and the reason it is a third prop rather than a swap.
   *
   * `isBusy` reports what the producer last said. This reports what THIS CLIENT
   * has done about it: its delivery schedule reached
   * `PROVISIONAL_DELIVERY_DEADLINE_MS` and, in the hook's own words, "past this
   * the hook stops and writes nothing". A surface cannot derive that from
   * `isBusy` alone, because `isBusy`'s wire half never expires.
   *
   * ⚠ COMPUTED BY THE HOST, NOT HERE, AND CI PROVED IT LOAD-BEARING.
   * `OutputsDock` subtracts it from ONE identifier that feeds both this body's
   * `isBusy` and the `AnalysisRunStateCover` mounted directly above it. An
   * earlier cut bounded only this side; `busyMarkerSharesTheCoversAuthority`
   * RED'd, and it was right — a skeleton would have kept shimmering over a
   * sentence saying nothing is coming (trap 21).
   *
   * Absent = false: a caller that has not been given it keeps today's
   * behaviour, never a silent "given up".
   */
  waitExhausted?: boolean
  /** The displayed report predates the current model. Freshness only. */
  isStale: boolean
  /**
   * WHY the report may not match the model. The dock hands this surface ONE
   * boolean over `'stale' || 'unknown'`, so without this the panel asserted a
   * CHANGE on a run nobody could VERIFY. Absent = 'unconfirmed', fail-closed.
   */
  staleReason?: 'changed' | 'unconfirmed' | null
  nSamples?: number
  seedUsed?: number | string
  responseHash?: string
  /** OutputsDock's canvas-focus handler, shared with the existing tab. */
  onFocusNode?: (nodeId: string) => void
  /**
   * The dock's own re-analyse handler. Absent = the staleness ribbon offers no
   * control, which is the honest render — never a dead button.
   */
  onReanalyse?: () => void
  /**
   * ⭐⭐ THE DOCK'S ROUTE TO THE ESTIMATES — the FALLBACK half of the act that
   * answers a withheld leader designation. `AtAGlance` renders the producer's
   * refusal sentence, whose words name their own remedy ("until you have set at
   * least one of them"); this prop is where a reader goes when they cannot set
   * one where they already are.
   *
   * ⚠⚠ AMENDED 11 Sep 2026 — THIS SAID the sentence "names its remedy in words
   * and can reach it from nowhere; this is the move that goes there", i.e. that
   * this prop was the ONLY way to reach an estimate. True the day it was written
   * and false the next morning: the value control on "what I estimated" shipped
   * onto THIS tab, about two sections below that button, so the remedy is now
   * reachable in page. `reviewEstimates` in the body composes the two and tries
   * the in-page act FIRST — its derivation is there, beside the composition.
   * Left standing, this rationale would have taught the next reader the exact
   * mental model that produced the defect this change exists to close
   * (CLAUDE.md trap 21).
   *
   * ⚠ THE DOCK OWNS IT, NOT THIS FILE, AND THAT IS THE POINT — UNMOVED BY THE
   * AMENDMENT ABOVE. The destination is the outputs dock's own active tab plus
   * the Model tab's pending section — both `useUIStore` state that `OutputsDock`
   * already holds and already writes for its sibling handlers. `useUIStore` is
   * imported NOWHERE under `components/results/analysisNew/`; threading the
   * handler keeps it that way, so the tab that renders the sentence does not
   * also become an authority on where the dock is pointing. Same shape as
   * `onReanalyse` and `onSendMessage` directly above and below.
   *
   * ⚠ AMENDED 11 Sep 2026 — THIS SAID "Absent = `AtAGlance` renders the refusal
   * sentence with no control", AND THAT IS NO LONGER WHAT ABSENCE MEANS. This
   * prop's absence now decides nothing on its own: the body hands `AtAGlance`
   * its own `reviewEstimatesHere` whenever this tab holds an act, so with this
   * prop absent and `estimatedActIsAvailable` true the control RENDERS and the
   * press is served in page. That is the case `refusalActStaysOnTheTab.spec.tsx`
   * pins as `offers the act even where the host has no route at all`.
   *
   * The sentence renders alone only where there is NEITHER an in-page act NOR
   * this prop. The in-page act is absent in three separately-pinned states: the
   * canvas no longer holds the node the manifest names; the manifest was never
   * written (it is a cold-read snapshot — `serverGraphHydration` reaches
   * `setContextIntegrity` only on `status === 'graph'` — so a freshly-drafted
   * decision lists no estimated factors at all); or there is no conversation to
   * carry the edit. The neither-state is pinned beside them as `renders the
   * sentence alone when there is neither an act here nor a route`. Note that
   * `AtAGlance` also renders no control unless `designationWithheldRemedy ===
   * 'estimate'` — that is its gate on the CAUSE, not this prop's. Still
   * fail-closed, still never a dead button.
   */
  onReviewEstimates?: () => void
  /**
   * Routes a finding's subject to its editor on the Model tab.
   *
   * ⚠ THE DOCK OWNS THE DESTINATION, NOT THIS FILE — the same rule, and the
   * same reason, as `onReviewEstimates` above: the destination is the outputs
   * dock's own active tab plus the Model tab's pending section, both
   * `useUIStore` state the dock already holds. `useUIStore` is imported NOWHERE
   * under `components/results/analysisNew/`, and threading the handler is what
   * keeps it that way.
   *
   * ⚠ AND IT IS A DIFFERENT DESTINATION FROM `onReviewEstimates`, not a
   * generalisation of it. That one lands on the FACTORS section because the
   * refusal it answers names no particular estimate; this one carries an edge
   * id the finding already holds, so it lands on the exact row. Folding them
   * would lose the targeting that is the whole value of this act.
   */
  onReviewTarget?: (targetId: string) => void
  /**
   * ⭐⭐ THE DOCK'S RUN GATE — `runGateResult.allowed`, which `OutputsDock`
   * binds as `canRunAnalysis` and passes unchanged to `AnalysisReadinessBar`'s
   * `canRun`, to `PreAnalysisPanelV3`'s `canRun`, and to this prop. (It has
   * further consumers in that file — `runCanonicalAnalysis`'s own guard among
   * them — so this is a list of the prop bindings, not of every read.) One
   * computation, several readers — never several predicates that happen to
   * agree (CLAUDE.md trap 21).
   *
   * This surface offers the re-run twice: the staleness ribbon inside
   * `AtAGlance`, and the shell footer bar `shellContract.ts` declares for
   * `analysisNew` (`footerBar: 'reanalyse'`, which renders `ReanalyseBar`).
   * Without this prop the ribbon control answered "may I re-analyse?" with a
   * bare handler and could not refuse at all.
   *
   * ⭐ THE FOOTER CONTROL READS IT TOO, SINCE #1212. `OutputsDock` hands
   * `ReanalyseBar` the same gate value and refusal sentence it hands this
   * prop, plus the running flag, and that bar disables on
   * `!onReanalyse || blocked || isAnalysing`. This prop closes the ribbon's
   * half; both halves have landed, so the surface is coherent — and neither
   * control may grow a predicate of its own.
   *
   * `null` = no verdict supplied, which is treated as blocked. Absent behaves
   * as `null` for the same reason: a host that has not answered the question
   * has not answered it, and the fail-closed render is no control at all.
   */
  canRunAnalysis?: boolean | null
  /**
   * `getRunButtonTooltip(runGateResult)` — the gate's own refusal sentence,
   * passed rather than re-composed. Two expressions of one refusal is the
   * defect `runBlockedListing` was introduced to close one level up.
   */
  runBlockedReason?: string | null
  /**
   * The dock's own chat sender, shared with the existing tab.
   *
   * ⚠ ITS ABSENCE IS NOT A FAILURE — `WhatIWasGivenSection` gates its "Add
   * this" affordance on this prop precisely so an unmodelled figure never
   * offers an action nobody can carry out. Absent, the register still renders
   * and simply offers no button (the fail-closed pre-gate this panel uses for
   * focus targets too).
   */
  onSendMessage?: (message: string) => void
}

/**
 * Which honest sentence the Drivers section shows when it has no findings.
 *
 * Split out so the three truth conditions sit together and can be read as a
 * set, rather than as a ternary chain inside JSX. Each returns the string whose
 * documented truth condition (`analysisNewCopy.ts`) the run actually satisfies.
 */
/**
 * The coaching list, WHOLE. Nothing is removed.
 *
 * ⚠⚠ THIS SUMMARY SAID "with the promoted card removed" AFTER THE REMOVAL WAS
 * REVERTED. The body was corrected and the JSDoc — the tooltip every call site
 * hovers — was left describing behaviour that no longer exists, above a long
 * and correct explanation of why it does not. A reader meets the summary first.
 * Caught by review; it is the same defect this PR fixes two commits earlier
 * ("close the provenance leak two comments say is already closed").
 *
 * `focused` is accepted and IGNORED on purpose: it keeps the decision visible
 * at the call site rather than leaving a bare array pass-through that reads as
 * an oversight. The reasoning is in the body.
 */
export function selectAlsoWorthDoing<T extends { id: string }>(
  interventions: readonly T[],
  _focused: { id: string } | null,
): T[] {
  /**
   * ⚠⚠ THIS EXCLUDED THE PROMOTED CARD, AND THAT WAS A CAPABILITY REGRESSION.
   * Reverted 5 Sep 2026 on an independent review's finding, which was right and
   * which I should have caught: my own argument for keeping the card at n=1 —
   * "the dismissal is how a human stays authoritative over the coaching" —
   * applies just as hard at every n, and I did not notice.
   *
   * The two surfaces are NOT interchangeable. The glance card is a pointer:
   * icon, label, method chip, one sentence, one click. The Strengthen card
   * carries the severity, the method as a dispatchable control, the science
   * grounding, "show on canvas", "I disagree", the source line — and DISMISS.
   *
   * And dismiss is load-bearing in a way that makes the regression worse than
   * "some buttons moved": retiring a recommendation is the ONLY thing that
   * advances `glancePrimary`. Exclude the promoted card and the user cannot
   * reach its dismiss, so the focus card can never be advanced — one
   * recommendation pinned to the top of the panel for the life of the run.
   *
   * ⚠ AMENDED 7 Sep 2026 — THE PARAGRAPH REPEAT IS CLOSED; THE ITEM REPEAT
   * IS NOT. Superseded text: ~~It costs a repeated paragraph to someone who
   * OPENS the section~~. `primaryIntervention` is now `{ id, label, title,
   * signalCode? }` (`AtAGlance.tsx:129-154`) and the finding's paragraph
   * (`signal`) is not among those fields, so the glance card cannot print it;
   * the paragraph is left to the row, which renders
   * `strengthenWhyLine(rec.signal, rec.whyNow)`. Guarded by
   * `theFocusCardReferencesRatherThanReprints.spec.tsx`.
   *
   * What still sits in two places is the ITEM. This function keeps returning
   * the promoted recommendation, so its `title` heads the glance card and the
   * row below. The severity, the grounding, the source line and the
   * disagreement controls stay row-only — the card's props carry none of them.
   * That trade is unchanged: the exclusion cost a capability to everyone.
   * The right fix is the Focus/Also split the design pack draws, where the
   * affordances live on the focus card — which is an IA change, and is with
   * Paul.
   *
   * Kept as a function, and exported, so the decision has one place to live and
   * its guard can pin it rather than being reasoned about again from scratch.
   */
  return [...interventions]
}

/**
 * ⭐⭐ WHAT A READER MUST KNOW TO READ THESE BARS — the basis they are on, and
 * what the section left out.
 *
 * ⚠⚠ THE BASIS SENTENCE IS CONDITIONAL AND THAT IS THE POINT. `displayProvenance`
 * is `'influence_score' | 'normalised_elasticity'` (`results/types.ts`), and only
 * the first is the structural score. A brief for this work proposed putting
 * "derived from the graph, not from this run" in the section SUBTITLE, which is
 * unconditional; that sentence is FALSE on the elasticity branch, where the
 * figure is a run output and a re-run can move it. So the two branches get two
 * sentences and neither can reach the run it would lie about.
 *
 * ⚠⚠ CORRECTED 7 Sep 2026 — THE PARAGRAPH ABOVE DESCRIBES A BRANCHING THIS
 * FUNCTION NO LONGER PERFORMS, AND THE TWO THAT USED TO STAND HERE WERE FALSE.
 * They read "THE STRUCTURAL BRANCH HAD NO VISIBLE ANSWER BEFORE … This is that
 * disclosure, made visible, in the section that still renders the bars" and
 * "THE REFERENCE-OPTION LINE KEEPS ITS PRECEDENCE OVER THE STRUCTURAL ONE".
 * Since #1228 made `influenceIsSetRelative` equal `drivers.length > 0`, neither
 * lower arm can reach a run that renders bars — see the unreachability note on
 * the ternary below, and `theBasisLineHasNoReferentWithoutBars`.
 *
 * ⭐⭐ NO BARS, NO BASIS LINE — AND THIS IS THE DEFECT THIS GATE CLOSES.
 * MEASURED at staging `f4966c20` and reproduced through this component at
 * `cdd2f9d8`: with `drivers: []` the section rendered
 *   "Each bar shows Olumi's structural influence score, scaled against the
 *    strongest factor in this run."
 * directly above "This run did not return factor influence.", with ZERO bars —
 * `AnalysisNewSection` early-returns only when `findings.length === 0 &&
 * !emptyMessage`, and `driversEmptyMessage` is non-null post-run, so the
 * section renders and the caveat renders with it. Two more shapes did the same
 * thing on the OTHER two arms: with a disclosed `sensitivityReference` it said
 * "Sensitivities are measured / against <option>." over the same empty state,
 * and on an all-suppressed run it said "Influence is relative to the other
 * factors in this run…" over "…every factor came back at zero." All three arms,
 * over nothing.
 *
 * A caveat exists to explain how to read something. With nothing on display it
 * has no referent, and the empty message already states what happened — so the
 * basis line is withheld entirely rather than reworded. Rewording it would
 * leave a sentence with no job, and it would have to be true both when bars
 * exist and when they do not, which makes it vaguer in the case that matters.
 *
 * ⚠ GATED ON WHAT IS ON DISPLAY, NOT ON `influenceIsSetRelative`. That flag
 * answers the SCALE question ("is this figure a share of the outcome?"); "is
 * there anything here to qualify?" is a different question, and using the flag
 * as a proxy for it is the substitution `panelCopyNamesOlumiNotTheProducer`
 * already had to correct once (CLAUDE.md trap 21). ⚠ AMENDED AT THE #1262
 * MERGE, 8 Sep 2026: ~~the disjunction is deliberate~~ — #1260 gated on
 * `influenceRows.length > 0 || findings.length > 0`, and the merged gate is
 * `influenceRows` alone. The two CANNOT DISAGREE on any view model the builder
 * can produce, derived at the bytes rather than inherited:
 * `live = drivers.filter((d) => d.zeroReason == null)`,
 * `findings = live.map(...)`, and `influenceRows` is `live.slice().sort()
 * .map(...)` with NO filter, so the three lengths are equal by construction.
 * #1262's binding argument decides it: `influenceRows` is what the chart draws
 * and what the word "bar" refers to, so the gate binds to the thing the
 * sentence describes rather than to a sibling that moves with it (trap 19).
 *
 * ⚠⚠ THE EXCLUSION LINE IS ADDITIVE, NEVER A REPLACEMENT. It answers a different
 * question from the basis (CLAUDE.md trap 21) — "what scale are these on" versus
 * "what is missing from them" — and a run can owe the reader both. Suppressed
 * rows reached the DOM through `driversEmptyMessage` alone, which renders only
 * when there are NO findings, so a partial suppression said nothing at all.
 *
 * ⚠ AND THAT SENTENCE IS EXACTLY WHY THE GATE COSTS NOTHING. Partial
 * suppression is the state the exclusion clause was written for, and it is the
 * state where `findings.length > 0`, so the empty message does not render and
 * `influenceRows` is non-empty — the gate does not fire and the clause is
 * appended as before. Where the gate DOES fire, every row was suppressed, and
 * `empty.noneRanked` names the count and the reasons in one sentence.
 */
/**
 * ⭐⭐ THREE CLAUSES, THREE JOBS, THREE PLACES — the approved prototype's Move 5.
 *
 * Measured on the served build `315d7982`: this composed to ONE paragraph of
 * 32 words and 49px, sitting above a chart with two bars —
 *
 *   "Influence is relative to the strongest factor in this run, not a share of
 *    the outcome. The top driver always shows 100%. 1 factor is not ranked
 *    here: controlled by your options."
 *
 * Every clause is true and every one was fought for. ⛔ READ AS A BLOCK, NONE
 * OF THEM IS READ AT ALL.
 *
 * ⚠⚠ AND THEY ANSWER DIFFERENT QUESTIONS, WHICH IS WHY ONE STRING WAS WRONG
 * (CLAUDE.md trap 21). "What scale are these on" · "why does the top bar reach
 * the edge" · "what is missing from this ranking" are three questions with
 * three different referents, fused by a `join(' ')` into a block whose only
 * shared property is that it is above the chart.
 *
 * ⛔ NOTHING MOVES BEHIND A DISCLOSURE AND NO CLAIM IS DROPPED. A caveat that
 * does not travel with its number stops being a caveat; each clause moves ONTO
 * the thing it qualifies. Same constants, same surface, attached rather than
 * stacked — `driversSeamSaysOneThing.theCaveatHasOneSourceOfTruth` still bans
 * a second spelling, and this function still composes none.
 */
function driversCaveatParts(vm: AnalysisNewViewModel): {
  /** Denies a reading of the SCALE. Renders under the chart's scale legend. */
  scaleNote: string | null
  /** A claim about the FIRST row's figure. Renders on that row. */
  topRowNote: string | null
  /** What is missing from the ranking. Stays above the chart, alone. */
  sectionCaveat: string | null
} {
  /**
   * ⚠⚠ EVERY ARM OF THE BASIS BRANCH IS A CLAIM ABOUT RANKED ROWS, SO IT MAY
   * ONLY BE SAID WHERE THE RANKING HAS MEMBERS. `AnalysisNewSection` renders
   * this caveat ABOVE the empty state (`:114` early-returns only when there is
   * no `emptyMessage` either), so on a run with no surviving rows the basis
   * sentence was rendered over nothing — and contradicted the sentence
   * directly beneath it:
   *
   *   "Each bar shows Olumi's structural influence score, scaled against the
   *    strongest factor in this run."
   *   "This run did not return factor influence."
   *
   * There are no bars, and `strongest` is 0 — `buildDrivers` computes it as
   * `Math.max(...live.map(magnitude), 0)`, which is 0 on an empty `live`. The
   * set-relative arm fails the same way ("relative to the other factors in this
   * run" — there are none).
   *
   * ⚠ THE ROOT CAUSE IS ONE NAME ANSWERING TWO QUESTIONS (CLAUDE.md trap 21).
   * `influenceIsSetRelative` is `drivers.length > 0` — "did the producer send
   * anything?" — while the basis sentence needs "is there a ranked set to be
   * relative to?". They differ exactly when every row is suppressed. The
   * existing guard chooses WHICH basis and is blind to whether one exists.
   *
   * ⚠ NOT `findings.length`: `influenceRows` is what the chart draws and what
   * the word "bar" refers to, so the gate binds to the thing the sentence
   * describes rather than to a sibling that happens to move with it.
   *
   * ⚠⚠ TWO INDEPENDENT FIXES FOR THIS DEFECT MET AT THIS MERGE (8 Sep 2026),
   * AND THE OTHER ONE'S EXTRA BRANCH IS WITHDRAWN ON EVIDENCE, NOT ON TASTE.
   * #1260 gated the BASIS ALONE and let the exclusion clause through on an
   * all-suppressed run (`return basis === null ? excluded : ...`), for a reason
   * that was true against ITS base: the empty message there was
   * `empty.driversAllZero` — "every factor came back at zero" — which stated
   * the OUTCOME and never named the reasons, so without that branch the reasons
   * reached no surface at all.
   *
   * ⚠ THAT PREMISE IS DEAD, KILLED BY THE OTHER HALF OF #1262 IN THIS SAME
   * MERGE. `driversAllZero` is gone; `driversEmptyMessage` now returns
   * `empty.noneRanked(count, reasons)` — "No factor is ranked in this run. N
   * factors were returned and set aside: <reasons>." — which names the count
   * AND the reason labels, from the same `ZERO_REASON_BADGE_LABELS` map
   * `coverage.notRanked` uses. Keeping both would print one fact twice, in two
   * adjacent paragraphs, on the tab #1243 had just stopped printing a paragraph
   * twice on. Derived at the bytes, not inherited: `AnalysisNewSection` renders
   * `emptyMessage` only when `findings.length === 0`, and renders the caveat
   * directly above it (`:148` and `:160`).
   *
   * ⚠ NOTHING IS LOST BY WITHDRAWING IT, AND THAT IS THE LOAD-BEARING CHECK.
   * The exclusion clause exists for PARTIAL suppression — rows survive, some
   * were set aside, and the empty message does NOT render because
   * `findings.length > 0`. In that state `influenceRows` is non-empty, so this
   * gate does not fire and the clause is appended exactly as before. The gate
   * removes the clause only where `noneRanked` has already said it.
   */
  if (vm.drivers.influenceRows.length === 0) {
    return { scaleNote: null, topRowNote: null, sectionCaveat: null }
  }

  /**
   * ⚠⚠ THE TWO LOWER ARMS ARE UNREACHABLE FROM ANY RUN THE BUILDER CAN PRODUCE,
   * AND THEY ARE KEPT DELIBERATELY. `buildDrivers` filters `live` OUT OF
   * `drivers`, so a non-empty `influenceRows` implies a non-empty `drivers`
   * implies `influenceIsSetRelative` — and the gate above means the ternary is
   * only evaluated when `influenceRows` is non-empty. So the first arm always
   * wins. That composition is pinned, on builder-produced view models rather
   * than fabricated ones, by `theBasisLineHasNoReferentWithoutBars`.
   *
   * ⭐ WHY NOT DELETE THEM. `coverage.referencePrefix` names the option the
   * producer says sensitivities were measured against — a real disclosure that
   * #1228 starved as a side effect, not one this fix decided to drop. Deleting
   * the arm would ratify that loss silently and erase the evidence of the open
   * question (should the reference line be ADDITIVE alongside the scale line,
   * the way `notRanked` is?). `coverage.structuralInfluence` is retained for a
   * second, independent reason: it is the single spelling of the grounding noun
   * that `driverFinding.groundedIn` — which IS rendered, per row — is bound to
   * in `driversSeamSaysOneThing`. Deleting it would force that assertion to
   * retype the sentence, which is the hand-maintained mirror the same file
   * exists to forbid (CLAUDE.md trap 12).
   *
   * ⚠ #1262 REACHED THE SAME "KEEP THEM" CONCLUSION BY ITS OWN ROUTE and left
   * the decision with the basis-branch owner: whether to delete them, or to
   * re-gate the reference line on something other than `!influenceIsSetRelative`
   * so it can be said ALONGSIDE a ranking. That question is still open, and
   * `records that two basis arms are now unreachable` is the case that keeps it
   * from being closed by accident.
   */
  /**
   * ⭐ THE SCALE CLAUSE AND THE "ALWAYS 100%" CLAUSE ARE TWO STATEMENTS, AND
   * ONLY THE FIRST IS UNCONDITIONALLY TRUE (CLAUDE.md trap 21 — two claims
   * fused under one constant).
   *
   * The first denies a reading ("not a share of the outcome"). The second
   * asserts a FACT about the top row's FIGURE — and that fact fails whenever
   * `buildDrivers` drops the producer's strongest row, because the bars
   * rescale to the survivors and the figures do not. The composition, not the
   * constant, is where the condition belongs: the sentence has one owner
   * (`analysisNewCopy`) and `driversSeamSaysOneThing.theCaveatHasOneSourceOfTruth`
   * bans a second spelling here.
   */
  /* ⚠ THE SPLIT IS EXACTLY WHERE THE `join(' ')` WAS, AND NOWHERE ELSE. The
     two arms below are the same two arms, reading the same constants, in the
     same order; only the ROUTING changed. A rewrite here would be a copy
     change wearing a layout change's clothes. */
  const scaleNote = vm.drivers.influenceIsSetRelative
    ? COPY.coverage.setRelativeInfluence
    : vm.drivers.referenceOptionLabel
      ? `${COPY.coverage.referencePrefix} ${vm.drivers.referenceOptionLabel}.`
      : COPY.coverage.structuralInfluence
  /* ⚠ ONLY THE SET-RELATIVE ARM EVER CARRIED THIS CLAUSE, and it is still the
     only one that does: the other two arms describe a basis that has no "top
     bar" to be about. It stays nullable for its own reason — `buildDrivers`
     can drop the producer's strongest row, and then the figure is not 100. */
  const topRowNote = vm.drivers.influenceIsSetRelative
    ? COPY.coverage.guaranteedHundredClause(vm.drivers.topRowFigurePercent)
    : null
  /* ⚠ GATED ON THE REASONS, NOT ON THE COUNT. They move together by
     construction, but the count is what a sentence naming reasons cannot be
     written from: a non-empty count with an empty reason list would render
     "1 factor is not ranked here: ." — the blank-reason state the total copy map
     exists to make impossible. Reading the list the sentence actually consumes
     is the fail-closed order. */
  const reasons = vm.drivers.suppressedZeroReasons
  if (reasons.length === 0) return { scaleNote, topRowNote, sectionCaveat: null }
  const excluded = COPY.coverage.notRanked(
    vm.drivers.suppressedZeroCount,
    reasons.map((code) => ZERO_REASON_BADGE_LABELS[code]),
  )
  /* ⚠ THE EXCLUSION CLAUSE IS APPENDED, NEVER ALONE. `basis` cannot be null
     past the gate above, and the state where it once could — every row
     suppressed — is now carried in one sentence by `empty.noneRanked`. See the
     withdrawal note on the gate. */
  /* ⚠ ALONE ABOVE THE CHART NOW, NOT APPENDED TO A BASIS SENTENCE. It was only
     ever appended because there was one slot; it is the one clause with no
     number of its own to attach to, so it keeps the slot and the other two
     leave it. */
  return { scaleNote, topRowNote, sectionCaveat: excluded }
}

function driversEmptyMessage(vm: AnalysisNewViewModel): string | null {
  // Pre-run: nothing has been returned OR not returned. No claim either way.
  if (vm.status.isPreRun) return null
  // The producer sent rows and NONE of them survived to be ranked. What it
  // said about them is the producer's reason, not a zero we did not measure:
  // `intervention_override` rows carry a real, often rank-1 influence score.
  if (vm.drivers.suppressedZeroCount > 0) {
    const reasons = vm.drivers.suppressedZeroReasons
    return reasons.length > 0
      ? COPY.empty.noneRanked(
          vm.drivers.suppressedZeroCount,
          reasons.map((code) => ZERO_REASON_BADGE_LABELS[code]),
        )
      : COPY.empty.noneRankedUnexplained
  }
  // The producer's own word for "I did not look" — distinct from having looked
  // and come back with nothing.
  if (vm.drivers.driversStatus === 'skipped') return COPY.empty.driversNotComputed
  // 'unavailable' / 'error' / a 'computed' that returned no rows all reduce to
  // the same fact, and this sentence states exactly it.
  return COPY.empty.drivers
}

/** V2 commit-zone ask drafts. The user's own editable draft, never a claim. */
const COMMIT_ZONE_ASK = {
  optionDraft: (label: string) =>
    `What would have to be true for ${label} to turn out as this model suggests, and what evidence could challenge it?`,
} as const

export function AnalysisNewTabBody({
  resultsSectionData,
  isPreRun,
  isRunning,
  isBusy,
  waitExhausted,
  isStale,
  staleReason = 'unconfirmed',
  nSamples,
  seedUsed,
  responseHash,
  onFocusNode,
  onReanalyse,
  onReviewEstimates,
  onReviewTarget,
  canRunAnalysis = null,
  runBlockedReason = null,
  onSendMessage,
  blockedListing = null,
}: AnalysisNewTabBodyProps) {
  /**
   * ⭐ THE PRESENTATION PREDICATE, IN THE SHAPE THE OTHER READERS OF THIS
   * VERDICT ALREADY USE (`AnalysisReadinessBar`, `PanelFooter`, and the dock's
   * own two copies): `!canRun && !isAnalysing`.
   *
   * ⚠ `isRunning` IS LOAD-BEARING. The gate refuses a double-run, so
   * `canRunAnalysis` is FALSE for the whole time an analysis is in flight —
   * `!canRun` alone would put the gate's refusal copy on a control whose
   * action is already happening. `isRunning` is the dock's LOCAL flag, which
   * is also the flag the gate itself consumed; pairing the verdict with the
   * composed `isBusy` would test a different run than the one that produced
   * the verdict.
   */
  /* V2 gap 24: the controlled "How this was worked out" group is gone — its
     contents fold into About (see the About mount). Nothing else opened it. */


  /**
   * ⭐⭐ ONE PREDICATE, THE GATE'S OWN VERDICT, READ BY EVERY CONTROL ON THIS
   * SURFACE THAT COULD START A RUN — the ribbon's Re-analyse and the pre-run
   * act. It was named `reanalyseBlocked` while only the ribbon read it, and
   * the pre-run act meanwhile asked a DIFFERENT, coarser question
   * (`blockedListing == null`) and reached the opposite answer in every state
   * the gate refuses by early return (witnessed, staging `1f77130d`).
   * Renaming it to the question removes the invitation to grow a second one
   * (CLAUDE.md trap 21).
   */
  const runRefusedByGate = !canRunAnalysis && !isRunning
  /**
   * ⭐⭐ THE COMPOSED RUN AUTHORITY, RESOLVED ONCE AND READ TWICE — never two
   * predicates that happen to agree (CLAUDE.md trap 21).
   *
   * `isBusy` is `composedAnalysisState.trust.isRunning` (`localRunning ||
   * wireRunning`), the value `AnalysisRunStateCover` and `AnalysisRunAnnouncer`
   * read; `isRunning` is the dock's LOCAL flag. This prop's own note records
   * what happens when a reader takes the narrower one: on a wire-asserted run
   * the user was told an analysis was running and this content was NOT marked
   * (`cover=present`, `isRunning_prop=false`, `aria-busy=null`).
   *
   * `??`, NOT `||`: an explicit `isBusy={false}` is a host ANSWERING "not
   * running", and must outrank a stale local true. The fallback is for a caller
   * that has not been given the composed value at all — the prop's documented
   * behaviour, unchanged.
   *
   * ⚠ `aria-busy` below and the pre-run sentence read THIS const, so the panel
   * cannot end up marked busy while denying that a run has started.
   *
   * ⚠ IT IS DELIBERATELY NOT USED FOR `runRefusedByGate` ABOVE. That predicate
   * pairs the gate's verdict with the flag the GATE consumed, which is the
   * local one; swapping it would test a different run than the one that
   * produced the verdict. Two questions, two flags — see that comment.
   */
  /**
   * ⭐⭐ ONE EXPRESSION, EVERY READER — which is why the bound lives HERE and
   * not beside the sentence it produces.
   *
   * Four things downstream ask "is a run in flight?": the `aria-busy` marker,
   * the running sentence, the suppression of `WhyNoAnalysisYet`, and the
   * suppression of the run affordance. Bounding only the sentence would leave a
   * panel that says the analysis never arrived while still marked busy, with
   * its explanation and its only way out both withheld — i.e. it would move the
   * contradiction rather than close it.
   *
   * ⚠ THE REPORTED VALUE IS KEPT SEPARATELY, because the new sentence needs to
   * distinguish "no run was ever asserted" from "a run was asserted and this
   * client gave up on it". Collapsing them would make the exhausted state
   * indistinguishable from a cold panel.
   */
  const isBusyNow = isBusy ?? isRunning
  /**
   * ⚠ NOT BOUNDED AGAIN HERE, AND CI PROVED WHY. The first cut subtracted the
   * exhaustion from `isBusyNow` in this file while the host still handed the
   * COVER the unbounded value, and `busyMarkerSharesTheCoversAuthority` — a
   * source scan that exists for exactly this pair — RED'd with "the marker and
   * the cover must read ONE authority". The host now bounds both with one
   * identifier, so `isBusy` arrives already correct and this line is unchanged
   * from before the fix.
   *
   * `waitExhausted` therefore says only WHY the panel is not busy, which is the
   * one thing `isBusy` cannot carry: a cold panel and an abandoned run are both
   * "not busy" and need different sentences.
   */
  const runWaitExhausted = !isBusyNow && waitExhausted === true
  /**
   * The fail-closed notice channel for canvas focus. `Safe` because this
   * surface renders inside the dock in tests without a ToastProvider, and a
   * missing provider must not throw — the same hook `OptionsComparison` uses
   * one directory down, so both sibling call sites report failure identically.
   */
  const showToast = useShowToastSafe()

  const vm = useAnalysisNewViewModel({
    data: resultsSectionData,
    isPreRun,
    isRunning,
    isStale,
    staleReason,
    nSamples,
    seedUsed,
    responseHash,
  })

  /**
   * ⭐⭐ ONE RESOLVER, AND ITS ANSWER IS HONOURED — the fix for a structurally
   * dead button and a silently-failing one, in the same three lines.
   *
   * This read `if (onFocusNode) onFocusNode(id); else focusModelTarget(id)`.
   * There is exactly ONE production mount (`OutputsDock.tsx:3504`, the only
   * non-test reference to this component) and it ALWAYS supplies
   * `onFocusNode`, so the `else` branch was DEAD IN PRODUCTION — the capable
   * resolver was reachable only from tests.
   *
   * ⚠ AND THE PREFERENCE WAS INVERTED, WHICH IS WHY IT MATTERED.
   * `onFocusNode` is `handleFocusResultNode` = `focusExistingTarget(id,
   * 'node')` (`OutputsDock.tsx:1524-1531`): NODE-SCOPED, and it `return`s
   * silently on an id it cannot resolve. `focusModelTarget` is the UNIVERSAL
   * resolver — canvas node id, canvas edge id, arrow-form `a->b` producer edge
   * id, or a producer id stashed on `edge.data` — and it returns whether
   * anything resolved. The fallback was the capable one.
   *
   * Two live consequences, both closed here:
   *
   * 1. A STRUCTURALLY DEAD BUTTON. `buildAnalysisNewViewModel.ts` emits
   *    `targetId: assumed.edgeId` — declared "Canvas edge id — the focus
   *    target" (`selectAssumedStrengthToResolve.ts:163`) — into the node-only
   *    path, so that "Show on canvas" could NEVER work, on any run, for any
   *    user. Its own comment says it relies on `focusModelTarget` resolving
   *    edges; it was RIGHT about the resolver and could not see that the
   *    consumer never reached it. `focusHelpers.ts:173` names this exact
   *    shape: "the audit's 'Focus on canvas does nothing' class of dead
   *    buttons". This is trap 21 — two authorities under similar names, each
   *    locally correct, disagreeing at the seam nothing pinned.
   * 2. EVERY TARGET FAILED SILENTLY. The boolean was discarded, so a stale or
   *    deleted target moved nothing and said nothing.
   *
   * ⚠ NOT FIXED WITH A NOTICE ALONE — that would have turned a silent dead
   * button into a LOUD dead button. The edge-vs-node question was settled
   * first: `focusModelTarget`'s second step matches `edges.some(e => e.id ===
   * targetId)` and `assumed.edgeId` IS a canvas edge id, so routing genuinely
   * resolves it. The notice is for the case that remains.
   *
   * The shape is not invented: it is `OptionsComparison.tsx:159` and
   * `StrengthenTheReasoning.tsx:722`, the two sibling call sites in this
   * directory that already honour the boolean, and the notice is IMPORTED
   * (`COPY.canvas.focusFailed`, itself derived from
   * `strengthen/strengthenCopy.ts:51`) rather than respelled.
   *
   * ⚠ `onFocusNode` IS NOW ADDITIVE, NOT THE RESOLVER. It also sets the dock's
   * 3-second highlight, which is worth keeping, so it is still called once the
   * target has resolved. On an edge id it no-ops exactly as before (its own
   * `focusExistingTarget(id, 'node')` returns false); on a node id it re-runs
   * the same `focusNodeById(id)` with the same argument, which is idempotent —
   * stated rather than hidden. Separating the highlight from the node-only
   * resolution would mean changing `OutputsDock`, which is outside this lane.
   */
  const focusTarget = (targetId: string) => {
    if (!focusModelTarget(targetId)) {
      showToast(COPY.canvas.focusFailed)
      return
    }
    onFocusNode?.(targetId)
  }

  /**
   * ⭐⭐ THE REFUSAL'S ACT, SERVED IN PAGE WHERE THIS TAB HOLDS ONE — 11 Sep 2026.
   *
   * ⚠⚠ WHY THIS IS COMPOSED HERE AND NO LONGER PASSED THROUGH. `AtAGlance`
   * renders CEE's withheld-designation refusal, whose sentence names its own
   * remedy ("until you have set at least one of them"), and the act beside it
   * routed to the MODEL TAB. On 10 Sep that was the only place an estimate
   * could be set. The next morning the value control on "what I estimated"
   * shipped — the SAME act, on THIS tab, about two sections below that button —
   * and the product began sending a reader to another surface to do something
   * available where they already were. Neither change was wrong and neither
   * change's tests could see it: each is correct in isolation, and the
   * rationale went stale underneath a control that still looked right
   * (CLAUDE.md trap 21).
   *
   * ⚠ THIS FILE IS THE ONLY ONE THAT CAN SEE BOTH HALVES, which is why the
   * composition belongs here and nowhere else. `AtAGlance` is presentational
   * and must not learn where the dock points; `OutputsDock` owns the Model-tab
   * route and cannot see this tab's own sections. The question this body
   * answers is a third one — *"is there an act on THIS tab?"* — and it is the
   * only surface that mounts both the refusal and the register.
   *
   * ⚠ THE MODEL-TAB ROUTE IS NOT REPLACED, IT IS THE FALLBACK, and it is
   * genuinely reachable rather than defensive. The manifest that feeds "what I
   * estimated" is written ONLY on the cold read
   * (`serverGraphHydration` → `setContextIntegrity`, reached only on
   * `status === 'graph'`); a freshly-drafted decision records its brief with
   * `manifest: null`, so the register renders and lists NO estimated factors at
   * all. The in-page act also goes when the canvas no longer holds the node the
   * manifest names, and when there is no conversation to carry the edit. In
   * every one of those states the Model tab remains the honest destination.
   *
   * ⚠ TWO ANSWERS, ON PURPOSE — do not fold them. `estimatedActIsAvailable` is
   * read at RENDER and answers *"is there an act to offer at all?"*, which is
   * what decides whether a control appears when the dock supplied no route.
   * `revealEstimatedValueAct()` answers at the PRESS, and reports whether the
   * panel actually revealed one — the section can unmount or gate itself out in
   * between. Disagreement resolves toward the fallback, never toward a control
   * that does nothing.
   */
  const whatIWasGivenRef = useRef<WhatIWasGivenSectionHandle>(null)
  const estimatedActIsAvailable = useEstimatedValueActIsAvailable(REASONING_TAB_EDITS_ESTIMATES)
  const reviewEstimatesHere = useCallback(() => {
    if (whatIWasGivenRef.current?.revealEstimatedValueAct()) return
    onReviewEstimates?.()
  }, [onReviewEstimates])
  /**
   * ⚠ FAIL-CLOSED, UNCHANGED. `AtAGlance` renders the refusal sentence alone
   * when this is `undefined`, and a refusal with a dead control beside it is
   * worse than the refusal alone. It stays `undefined` when there is NEITHER an
   * in-page act NOR a route — which is exactly the state
   * `withheldReasonHasAMove.spec.tsx`'s "renders the sentence alone through the
   * tab body when no handler is given" pins.
   */
  const reviewEstimates =
    estimatedActIsAvailable || onReviewEstimates ? reviewEstimatesHere : undefined

  /**
   * A contextual intervention runs through the SAME non-mutating route as the
   * Strengthen section's primary CTA — the Ask-Olumi drawer, prefilled and
   * never auto-sent. The recommendation is found by id, so the drawer is
   * seeded with the ENGINE's own words, not with a paraphrase of the row.
   */
  /**
   * ⭐ ONE JOIN, ONE PLACE. "What does this run say about node X" is answered
   * here and handed to the strip, rather than derived inside it — the strip is
   * not the only surface that will want the answer, and two derivations of one
   * answer disagree the first time either input changes (CLAUDE.md trap 12).
   *
   * Both inputs are the view model's own lists, passed rather than re-selected:
   * this surface never mints a recommendation or a driver.
   */
  /**
   * ⛔ ONE LICENCE-GATED LIST FOR "WHAT WOULD CHANGE YOUR MIND", READ BY EVERY
   * SURFACE THAT SHOWS ITS ROWS. Every row is a fragile edge whose weakening
   * switches the recommended option, so on a run whose leader is withheld none
   * of it may be said. Gating only the section left the Model strip pointing at
   * it: independent review 5811790177 picked the edge's source node on a
   * withheld run and read "Also in What would change your mind: … could lead".
   * The section, its caption and the strip's mentions all read THIS list.
   */
  const sensitivityFindings = vm.leaderClaimPermitted ? vm.sensitivity.findings : NO_FINDINGS

  const nodeInsights = useMemo(
    () =>
      buildNodeInsights({
        interventions: vm.strengthen.interventions,
        drivers: vm.atAGlance.drivers,
        /*
         * ⭐ THE REST OF THE PANEL. The strip's empty state claims *"nothing
         * else on this panel refers to this node"* — a claim about the WHOLE
         * panel — and it was answered from two sections only. Witnessed on
         * deployed `d82e81f0`: "Platform Capability Fit is the hinge" was on
         * screen while the card said nothing referred to it.
         *
         * ⚠⚠ AND THE FIRST FIX WAS SHORT IN THE SAME WAY, UNDER A COMMENT HERE
         * CLAIMING IT COVERED "every other section". It listed `keyInsights`
         * and `sensitivity`; the panel renders FOUR sections of
         * `AnalysisNewFinding[]`, and `drivers`/`uncertainty` both carry real
         * node `targetId`s. The drivers omission is reachable on an ordinary
         * run: `GLANCE_DRIVER_COUNT` caps `vm.atAGlance.drivers` at three while
         * the Drivers section renders every live driver, so on any run with four
         * or more drivers the rank-4 node had a null `driverLabel`, no
         * intervention, no mention — and was told nothing referred to it while
         * the Drivers section named it on screen.
         *
         * ⭐ SO THE LIST IS NO LONGER WRITTEN HERE. `mentionSectionsFrom` takes
         * an exhaustive `Record` keyed by `AnalysisNewFindingSectionKey`, which
         * is DERIVED from the view model's type: omitting a section is a
         * compile error, and a new finding-bearing section REDs this call until
         * it is covered. A comment promising completeness is what shipped the
         * gap twice; the compiler is what closes it.
         *
         * ⚠ KEY ORDER IS THE READER'S READING ORDER, top to bottom down the
         * panel: "What would change your mind" mounts above "Key insights",
         * which mounts above "Drivers and dynamics" and "Uncertainty and gaps".
         * A pointer list in DOM order is walkable; an arbitrary one is not.
         */
        mentionSections: mentionSectionsFrom({
          sensitivity: sensitivityFindings,
          keyInsights: vm.keyInsights.insights,
          drivers: vm.drivers.findings,
          uncertainty: vm.uncertainty.findings,
          // "How the options compare" cannot appear in this Record at all —
          // `rows: ComparisonOption[]` is a different shape with no
          // `AnalysisNewFinding` join, so it is outside the derived union.
          // See `BuildNodeInsightsInput.mentionSections`.
        }),
      }),
    [
      vm.strengthen.interventions,
      vm.atAGlance.drivers,
      sensitivityFindings,
      vm.keyInsights.insights,
      vm.drivers.findings,
      vm.uncertainty.findings,
    ],
  )

  /**
   * ⭐⭐ THE GLANCE'S ONE THING TO DO — SKIPPING WHATEVER THE STRIP ALREADY ASKS.
   *
   * ⚠ FOUND BY DRIVING DEPLOYED `3595403b`, not by reading the diff, and the
   * defect was MINE. Before a run the panel said one fact three times inside a
   * single viewport:
   *
   *   model strip     "Target · None set · Set a target"
   *   glance card     "Define success — No measurable success target is set."
   *   strengthen row  "Define what success looks like — No measurable success
   *                    target is set."
   *
   * — the last two sharing a sentence VERBATIM, and the canvas goal card saying
   * it a fourth time. The strip's line was added yesterday; it is the better
   * home (it names the goal, and its control edits in place) and it made the
   * glance's copy of the ask redundant the moment it shipped.
   *
   * ⚠ THE STRIP'S LINE IS RENDERED WHETHER THE STRIP IS OPEN OR CLOSED —
   * `SuccessTargetLine` sits OUTSIDE the disclosure button (`ModelStrip.tsx`,
   * and that placement is load-bearing, not stylistic). So this suppression can
   * never hide the ask; it removes a second copy of a control that is always on
   * screen.
   *
   * ⚠⚠ CONDITIONAL ON THE STRIP ACTUALLY RENDERING IT. `SuccessTargetLine`
   * returns null when there is no goal node — a target affordance writing into
   * nowhere. With no goal the glance keeps the recommendation, because then it
   * is the ONLY place the ask appears. Suppressing unconditionally would delete
   * the panel's top ask on exactly the models that most need it.
   *
   * Nothing is re-ranked and nothing is hidden: the engine's order is untouched
   * and the displaced recommendation still renders in "Strengthen the
   * reasoning" with its whyNow, its Try this, and its provenance line — which
   * is the copy that actually earns its place, because it says why a target
   * matters rather than restating that one is missing.
   */
  const nodes = useCanvasStore((state) => state.nodes)
  /**
   * ⚠ THE SCENARIO ID IS SUBSCRIBED TO, NOT READ ONCE. A record captured in
   * the modal must appear in the section below WITHOUT a tab switch, and a
   * scenario change must swap the record with it — `useDecisionRecordForScenario`
   * is the store's own reactive hook and both stores re-render this component.
   * Reading `getState()` here would render a record from whichever scenario was
   * current at mount, which is the read-back lying by one scenario.
   */
  const currentScenarioId = useCanvasStore((state) => state.currentScenarioId)
  const decisionRecord = useDecisionRecordForScenario(currentScenarioId)
  /**
   * ⭐ THE PRODUCER'S BIAS FINDINGS, READ STRAIGHT OFF THE STORE — the ONLY new
   * data this section needs, and a read like every other read on this tab.
   *
   * ⚠ NOT ROUTED THROUGH `useAnalysisNewViewModel`. That hook's load-bearing
   * property is that it is READ-ONLY over the analysis instance `OutputsDock`
   * hands both tabs; `ceeAnalysisReady` is not part of that instance, it is
   * canvas-store state with its own lifecycle (`setCeeAnalysisReady`,
   * `invalidateAnalysisReady`). Threading it through the view model would put
   * a second, differently-invalidated source inside a structure whose whole
   * point is that both tabs read one. Subscribed rather than read once, so a
   * fresh run's findings appear without a tab switch.
   *
   * ⚠ THE SELECTOR TAKES THE ARRAY, NOT THE OBJECT. `ceeAnalysisReady` is
   * replaced wholesale on every readiness write, so subscribing to the object
   * re-renders this tab on changes to fields it does not read.
   */
  const biasFindings = useCanvasStore((state) => state.ceeAnalysisReady?.bias_findings)
  const biasGroundingItems = useMemo(() => buildBiasGrounding(biasFindings), [biasFindings])

  /**
   * ⛔⛔ A GROUP HEADING IS A CLAIM THAT THERE IS SOMETHING UNDER IT — the rule
   * `AnalysisNewSection`, `WhatWeChecked` and `BiasGrounding` each enforce for
   * themselves, and GROUPING THEM BROKE IT. Every child returns null when it has
   * nothing to say; `Accordion` renders its header regardless. Pre-run, three
   * named headings would have opened onto nothing at all.
   *
   * ⚠ DERIVED FROM THE CHILDREN, NEVER FROM `isPreRun`. Pre-run is only the
   * loudest case: a completed run whose producer sent no bias findings and no
   * key insights is the same emptiness and would have shipped the same bare
   * heading. Binding to the actual contents means the gate cannot drift from
   * what the children decide (CLAUDE.md trap 12).
   */
  /**
   * ⭐ HOISTED SO THE GATE AND THE SECTION CANNOT DISAGREE. The first version of
   * `coachingHasContent` asked `insights.length > 0` and suppressed the group on
   * a completed run that produced none — hiding the section's HONEST EMPTY
   * MESSAGE, which is content: "we looked and found none" is a different
   * statement from silence, and this tab exists to keep them apart.
   *
   * ⚠ ONE EXPRESSION, TWO READERS — never two that happen to agree (trap 12).
   * The gate is literally "would any child render", derived from the same values
   * the children are handed.
   */
  const keyInsightsEmptyMessage =
    vm.status.isPreRun || vm.keyInsights.candidateCount > 0 ? null : COPY.empty.keyInsights
  const driversEmpty = driversEmptyMessage(vm)
  const driverCaveatParts = driversCaveatParts(vm)

  const coachingHasContent =
    biasGroundingItems.length > 0 ||
    vm.keyInsights.insights.length > 0 ||
    keyInsightsEmptyMessage !== null
  const whatMovesHasContent =
    vm.drivers.findings.length > 0 ||
    vm.drivers.influenceRows.length > 0 ||
    driversEmpty !== null ||
    vm.uncertainty.decisionVoi !== 'not_computed'
  /**
   * ⚠ `WhatIWasGiven` READS ITS OWN STORE AND RENDERS PRE-RUN BY DESIGN — it is
   * about the brief, not the run — so this group is never empty in practice. The
   * gate is still derived rather than hardcoded `true`, because "in practice" is
   * how the other two would have been justified too.
   */
  /**
   * ⛔⛔ `!isPreRun` WAS A BUG AND I CAUGHT IT IN SELF-REVIEW, NOT IN A TEST.
   * `WhatIWasGiven` renders PRE-RUN by design — it is about the brief, not the
   * run — so a gate that suppressed this group pre-run would have DELETED the
   * one section a reader has before any analysis exists. The convenient term
   * was the wrong one, and no case I had written could see it because they all
   * drove emptiness through run-derived data.
   *
   * ⚠ ITS CONDITION IS NOT VISIBLE FROM HERE — it lives in two stores that
   * component reads for itself. `useWhatIWasGivenWillRender` is that same
   * derivation exported, so the gate and the render cannot disagree; a second
   * predicate here that happened to agree is trap 12 and this panel has already
   * paid for it twice today.
   */
  const whatIWasGivenWillRender = useWhatIWasGivenWillRender()
  const methodHasContent =
    vm.checks.items.length > 0 ||
    vm.uncertainty.findings.length > 0 ||
    vm.deeper.critiques.length > 0 ||
    vm.deeper.caveats.length > 0 ||
    whatIWasGivenWillRender
  /**
   * ⚠⚠ THE EMPTY STATE OF "UNCERTAINTY AND GAPS" IS A TRUTH CLAIM AND IT SPLITS
   * TWO WAYS. "Nothing was flagged" is licensed ONLY when the producer actually
   * assessed evidence on this run; otherwise the honest sentence is that it was
   * not assessed. Hoisted (unchanged) so the section and the fold gate below
   * read one expression.
   */
  const uncertaintyEmptyMessage = vm.status.isPreRun
    ? null
    : vm.uncertainty.evidenceAssessed
      ? COPY.empty.uncertaintyAssessed
      : COPY.empty.uncertaintyUnassessed
  /**
   * ⭐ V2 gap 24: WILL ANY BLOCK FOLDED INTO ABOUT RENDER? The union of what
   * each folded child renders on, under the gate the deleted shells gave it —
   * so About appears pre-run exactly when the old tail had something to show
   * (in practice the input register, which renders pre-run by design).
   * `AnalysisNewSection` returns null on no findings and no empty message.
   */
  const foldedHasContent =
    coachingHasContent ||
    whatIWasGivenWillRender ||
    (methodHasContent && (vm.uncertainty.findings.length > 0 || uncertaintyEmptyMessage !== null))
  /**
   * ⚠⚠ THE DOOR'S GATE IS THE CAPTURE MODAL'S OWN PREDICATE, DERIVED — NOT
   * RESTATED. `hasAnalysedOptions` is the function `DecisionRecordModal`
   * builds its option list from, so the section cannot offer a capture the
   * modal will then refuse. Restating `results.status === 'complete' && …`
   * here would be a hand-maintained mirror of a predicate in another file
   * (CLAUDE.md trap 12), and the two would drift the first time either moved.
   *
   * ⚠ `results.status`, NOT `isPreRun`. The two diverge on every rerun, error
   * and cancellation — see `sections/DecisionRecorded.tsx`'s `canCapture`.
   */
  /**
   * ⚠ `results?.` — THE OPTIONAL CHAIN IS LOAD-BEARING, NOT DEFENSIVE PADDING.
   * `results` is typed non-nullable on the store, and the capture modal reads
   * `s.results.status` unguarded because it only ever mounts under a real one.
   * This panel does not have that luxury: it is rendered against store states
   * where `results` is genuinely `null`, and an unguarded read throws during
   * React's render phase — taking the WHOLE panel down, not just this section.
   * Measured, not supposed: the first version of this line crashed 11 tests in
   * `successTargetSurfacesAgree.spec.tsx` with
   * `Cannot read properties of null (reading 'status')`.
   *
   * `undefined` is the honest value here and needs no special case downstream —
   * `hasAnalysedOptions` takes `string | undefined` and anything that is not
   * `'complete'` means the same thing: no analysed option set to record
   * against, so no door.
   */
  const resultsStatus = useCanvasStore((state) => state.results?.status)
  const canCaptureDecision = hasAnalysedOptions(nodes, resultsStatus)
  /**
   * ⭐ WHAT HAPPENED TO THE LATEST ATTEMPT, when it did not produce what is on
   * screen: refused (CEE's typed refusal) or failed (`results.status`). Until
   * this, `useAnalysisRunState()` had one reader, the Results tab, and this tab
   * said "No analysis has run yet" over a refusal, or showed an old result
   * UNMARKED after a failed re-run. See `latestRunNote.ts`.
   */
  const runState = useAnalysisRunState()
  const refusalNotice = useCanvasStore((state) => state.analysisRefusalNotice)
  const latestRunNote = deriveLatestRunNote({
    runState,
    refusal: refusalNotice,
    resultsStatus,
    isBusy: isBusyNow,
  })
  /**
   * ⚠⚠ "THE STRIP IS OFFERING THE CONTROL", NOT "THE MODEL HAS A GOAL" — and
   * the difference is a shipped regression, caught by independent review.
   *
   * The first version of this asked `resolveGoalNodeId(nodes) !== null`, which
   * is TRUE on a goal-only or goal+decision model — where `ModelStrip` renders
   * NOTHING (`rows.length === 0`) and its target line goes with it. On exactly
   * those models this suppressed the glance's card and left the panel with no
   * visible way to set a target at all, the ask surviving only inside a
   * collapsed section. `stripRendersTargetAffordance` asks both halves in one
   * place so no caller can ask half the question.
   */
  // ⚠ ONE STRIP, TWO CONSUMERS. `stripOffersTarget` built its own; Focus Now
  // needs the same object, and two `buildModelStrip` calls over one node list
  // would be two authorities on what the model contains (trap 12).
  const modelStrip = useMemo(() => buildModelStrip(nodes ?? []), [nodes])
  const stripOffersTarget = useMemo(
    () => stripRendersTargetAffordance(modelStrip),
    [modelStrip],
  )
  /**
   * ⭐ WHICH OF FOCUS NOW'S GENERIC NUDGES ARE TRUE OF THIS MODEL.
   *
   * ⚠ COUNTS COME FROM THE STRIP, NOT FROM `nodes` DIRECTLY, so this can never
   * disagree with what the strip shows the reader two lines above. An absent
   * row IS zero — `buildModelStrip` skips a kind with no nodes.
   *
   * ⚠ AND `stripHasContent` GATES THE WHOLE THING, because "no row" and "no
   * model" are indistinguishable from the rows alone. On an empty or unloaded
   * canvas every kind is absent, and without this guard the panel would
   * announce that the model needs an outcome and a risk before the person has
   * built anything. Unknown yields `null`, which earns no row.
   */
  const focusApplicableIds = useMemo(() => {
    const known = stripHasContent(modelStrip)
    const countOf = (kind: 'risk' | 'outcome'): number | null =>
      known ? (modelStrip.rows.find((r) => r.kind === kind)?.nodes.length ?? 0) : null
    return applicableStaticFocusIds({
      // ⚠ `known` GATES THIS ONE TOO, and its absence was a real defect: the
      // real `useResultsSectionData` returns `hasGoalTarget: false` on an empty
      // canvas — a measured `false`, not an unknown — so without this gate the
      // panel asked a person to define success before they had built anything.
      // The reading is the same as the counts': no model means no fact, and no
      // fact earns no row.
      hasGoalTarget: known ? (resultsSectionData.recommendation.hasGoalTarget ?? null) : null,
      outcomeCount: countOf('outcome'),
      riskCount: countOf('risk'),
    })
  }, [modelStrip, resultsSectionData.recommendation.hasGoalTarget])
  /** V2: the method the user picked in the strip; the Challenge card shows it. */
  const [pickedMethodId, setPickedMethodId] = useState<string | null>(null)
  const glancePrimary = useMemo(() => {
    const interventions = vm.strengthen.interventions
    if (!stripOffersTarget) return interventions[0] ?? null
    return (
      interventions.find((rec) => rec.id !== SUCCESS_MEASURE_RECOMMENDATION_ID) ?? null
    )
  }, [vm.strengthen.interventions, stripOffersTarget])

  /**
   * ⭐ WHICH METHODS THIS RUN RAISED — the engine's own findings, asked through
   * the ONE owner of "is this finding and this technique the same move?"
   * (`methodForRecommendation`). Nothing is judged here and nothing is ranked:
   * `MethodsYouCanRun` partitions the catalogue with this set and keeps the
   * catalogue's order in both groups.
   *
   * ⚠ READS THE SAME `vm.strengthen.interventions` the Strengthen section
   * renders — already filtered against the lifecycle store — so a dismissed
   * finding cannot keep promoting its method after the reader retired it.
   */
  const raisedMethodIds = useMemo(
    () => methodIdsRaisedBy(vm.strengthen.interventions),
    [vm.strengthen.interventions],
  )

  /**
   * ⭐⭐ THE GLANCE ANSWERED NOTHING, SO THE FIGURES COME UP TO FILL THE GAP.
   *
   * ⚠ THIS DOES NOT OVERTURN THE ORDERING RULING, AND THE DISTINCTION IS THE
   * WHOLE JUSTIFICATION. `the coaching sits directly under the reading it
   * responds to` (AnalysisNewTabBody.spec) pins `glance -> strengthen ->
   * detail` as "WHAT HAPPENED -> WHAT TO DO ABOUT IT -> THE DETAIL", and calls
   * burying Strengthen below the detail the defect it exists to prevent. That
   * stays. Its UNSTATED PRECONDITION is that the glance answered.
   *
   * ⛔ WITNESSED BY PAUL ON A RUN WHERE IT DID NOT. When the verdict withholds
   * the leader, `AtAGlance` renders no reading at all — so "what happened" is
   * empty, the coaching beneath has no subject, and the only figures the run
   * produced sit ELEVEN sections lower. His screenshot carries "Most likely
   * option not confirmed" and a 72% / 16% / 2% comparison, in that order, a
   * whole scroll apart.
   *
   * ⭐ THE PREDICATE IS NOT NEW — IT IS HOISTED. `OptionsComparison` already
   * computed exactly this for `defaultOpen`, and its docblock states the
   * consequence in terms: "on a WITHHELD run the glance renders NO reading at
   * all, and then a closed row means a collaborator sees no numbers anywhere —
   * from an analysis that computed them and is licensed to show them." The
   * component had diagnosed its own burial and could only open itself IN
   * PLACE. Hoisting lets the same fact move it.
   *
   * ⚠ BOTH CONJUNCTS ARE LOAD-BEARING. `headline === null` alone would promote
   * an empty section on a run that returned no figures either — a heading over
   * nothing, which is exactly what `AnalysisNewSection` refuses to do
   * elsewhere. The second conjunct is the estate's own "absence is not zero"
   * rule: promote only when there is something to promote.
   *
   * ⚠ NOT `comparativeClaim`. That answers "may a MAGNITUDE be drawn" and is
   * gated separately inside the section. Two shares, named apart (trap 21).
   */
  /**
   * ⛔ RETIRED. This decided WHICH OF TWO PLACES `answerBlock` rendered in. The
   * answer now renders in ONE place, beside the glance, on every run — so the
   * question it answered no longer exists. Its reasoning is kept above because
   * the DIAGNOSIS was right (the figures were eleven sections down) even though
   * the remedy was a conditional where a move was wanted.
   */

  /**
   * ⭐⭐ THE ANSWER AND ITS CAPTION ARE ONE BLOCK, DEFINED ONCE.
   *
   * ⛔ WHY A FRAGMENT AND NOT TWO RENDER SITES. My first attempt promoted
   * `OptionsComparison` alone and left `ModelImplication` in place — and
   * `whatYourModelImpliesReachesTheScreen` caught it within the same run:
   * "the implication must precede the option rows", because that sentence is
   * what says WHAT THE ROWS MEAN. Separating them put the caption below the
   * thing it captions on exactly the runs this change exists to serve.
   *
   * ⭐ That is this plan's own governing rule, broken by its first increment:
   * EVERY CLAIM MOVES WITH ITS ENTITLEMENT, OR IT DOES NOT MOVE. Binding them
   * into one node makes the rule structural rather than remembered — they
   * cannot be separated by a later edit without deleting this fragment, and
   * there is exactly one `<ModelImplication>` and one `<OptionsComparison>` in
   * this file, so the source-position guard reads the real order.
   */
  /**
   * ⭐ V2 — MOVE TOWARDS COMMITMENT. Three short bullets built from the view
   * model (`buildCommitmentSynthesis`: what seems well-founded, what remains
   * uncertain, what to resolve before committing; each omitted when nothing
   * true can be said), the comparison between them and the record row, which
   * reuses the existing decision record. The ModelImplication card's lead is
   * bullet one, so the card itself is no longer mounted here.
   */
  // Bullet 3 never repeats what is already asked at rest: the Challenge card's
  // own item, nor the success target when the model strip already offers it
  // (V2 census B1/B2).
  const sensitivityConvergence = vm.leaderClaimPermitted ? vm.sensitivity.convergence : null
  const sensitivityHeaderTips = vm.leaderClaimPermitted ? vm.sensitivity.tippingPoints.slice(1) : []
  const commitmentSynthesis = buildCommitmentSynthesis(vm, {
    excludeInterventionIds: [
      glancePrimary?.id,
      stripOffersTarget ? SUCCESS_MEASURE_RECOMMENDATION_ID : null,
    ],
  })
  /**
   * The glance, mounted twice: its status ribbon above the commitment block and
   * its reading after it (see the reading mount for why). One element, so the
   * two halves cannot receive different props.
   */
  const renderGlance = (part: 'status' | 'reading') => (
    <AtAGlance
      glance={vm.atAGlance}
      onFocusTarget={focusTarget}
      /* ⭐⭐ THE ACT THAT ANSWERS THE REFUSAL — IN PAGE FIRST, THE DOCK'S
         ROUTE AS THE FALLBACK. ⚠ AMENDED 11 Sep 2026: this read
         `onReviewEstimates={onReviewEstimates}`, a straight pass-through,
         on the stated rationale that "the estimates live on the Model tab".
         That was true when it was written and false the next morning — see
         `reviewEstimates` above for the derivation and for why this body,
         and only this body, can compose the two.

         `AtAGlance` is still fail-closed and still not told where anything
         lives: it receives one handler or `undefined`, exactly as before,
         and `reviewEstimates` is `undefined` when there is neither an
         in-page act nor a route. */
      onReviewEstimates={reviewEstimates}
      isStale={vm.status.isStale && !vm.status.isPreRun}
      staleKind={vm.status.staleKind}
      runNote={
        latestRunNote === null
          ? null
          : latestRunNote.kind === 'did_not_run'
            ? {
                testId: 'analysis-new-status-did-not-run',
                text: `${COPY.status.latestDidNotRun} ${latestRunNote.reason} ${COPY.status.showingPrevious} ${ANALYSIS_REFUSAL_POINTER}`,
              }
            : latestRunNote.kind === 'blocked'
              ? {
                  testId: 'analysis-new-status-blocked',
                  text: `${COPY.status.latestBlocked} ${COPY.status.showingPrevious}`,
                }
              : {
                  testId: 'analysis-new-status-run-failed',
                  text: `${COPY.status.latestRunFailed} ${COPY.status.showingPrevious}`,
                }
      }
      isProvisional={vm.status.isProvisional}
      /* ⚠ THE ACT BINDS TO RECOVERABILITY, NOT TO PERMISSION. Both are
         passed because they answer different questions and the section uses
         each for its own. */
      rerunWouldNotHelp={vm.checks.rerunWouldNotHelp}
      onReanalyse={onReanalyse}
      /* ⭐ DERIVED FROM THE GATE'S VERDICT, NOT A SECOND EXPRESSION OF
         IT — and not the verdict itself. `runRefusedByGate` is
         `!canRunAnalysis && !isRunning` (see above for why `isRunning` is
         in it), and the reason is masked by that same boolean so a
         permitted control carries no refusal text. What `AtAGlance` gets
         is therefore a PRESENTATION predicate over the one admission, in
         the shape `AnalysisReadinessBar` and `PanelFooter` already use —
         not either of the two values the dock handed this component. */
      reanalyseBlocked={runRefusedByGate}
      reanalyseBlockedReason={runRefusedByGate ? runBlockedReason : null}
      /* ⭐⭐ THE RUNNING STATE, THREADED UNCHANGED — the second of the two
         questions the ribbon control has to answer. `reanalyseBlocked`
         above says whether the gate REFUSED; this says whether a run is
         ALREADY IN FLIGHT, and the button is disabled on either while only
         the first may caption it.

         ⚠ IT IS THE SAME `isRunning` THE PREDICATE ABOVE WAS DERIVED
         AGAINST — this prop, the dock's local flag — and deliberately NOT
         `isBusy`. `isBusy` is `composedAnalysisState.trust.isRunning`,
         which answers the cover's question, not the gate's; pairing the
         verdict with it would test a different run than the one that
         produced the verdict. Two flags, two questions, and this is the
         one the gate itself consumed. */
      isRunning={isRunning}
      missingResults={vm.status.missingResults}
      part={part}
    />
  )

  const answerBlock = (
    <CommitmentSummary
      synthesis={commitmentSynthesis}
      isPreRun={vm.status.isPreRun}
      canCapture={canCaptureDecision}
      record={decisionRecord}
      onRecord={openDecisionRecord}
      onAsk={openAskOlumi}
      qualifier={buildCommitmentQualifier(vm, { runProvisional: vm.status.runProvisional })}
    >
        <OptionsComparison
          options={vm.optionsComparison}
          /* ⭐ ONE OWNER FOR THE CAUSE IN THIS SECTION. "What remains uncertain"
             already states it when bullet (a) fires, a few lines above the
             comparison it wraps; appending it to the qualifier too printed the
             same sentence twice at rest (served V2, scenario 3d00c023). Keyed
             on the bullet's own SOURCE, so the comparison keeps the cause
             whenever the bullet did not say it. */
          leaderWithholdCause={
            commitmentSynthesis.open?.source === 'leader_withheld_cause' ? null : vm.checks.leaderWithholdCause
          }
          sharesExcludeLimits={vm.checks.sharesExcludeLimits}
          /* The SAME writer this body already hands `WhatIWasGivenSection` for
             its own ask (:1253). One composer, one validation, one policy — a
             second route to the chat would be a second thing to keep honest. */
          onSendMessage={onSendMessage}
          /* ⭐⭐ V2 FIDELITY (24 Sep 2026, gap 17): BARE, AND ALWAYS OPEN.
             This chart is the answer "Move towards commitment" promises, not
             a sub-section of it: `SectionShell` gave it its own 14px heading
             beside the zone's own and closed it at rest on every run that
             named a leader (the fidelity finding's own measurement, deployed
             `4549b66b`), hiding the only evidence this zone has on the run it
             most needs to be read. `bare` renders the identical rows with no
             heading, no count and no chevron — see `OptionsComparison.tsx`'s
             own docblock on the prop for what stays gated (leader-naming,
             ordinals, comparative magnitude are unchanged; this moves
             VISIBILITY only). Replaces the `defaultOpen` conditional below,
             which is now moot: a bare mount has no disclosure state. */
          bare
          /* ⭐⭐ THE ONE STATE WHERE THE READER IS LEFT WITH NOTHING, AND IT IS
             THE STATE THIS SECTION EXISTS FOR.

             Measured, jsdom, on `decisionWithLeaderWithheld()` against its
             permitted twin `genuineDecision()` — the two fixtures differ in one
             boolean:

               win readouts       collapsed   opened
               withheld run       []          ['31%', '69%']
               permitted run      []          ['31%', '69%']

             The per-option figures ALREADY render on a withheld run, in
             canonical order, with no ordinal and no leader marker — exactly
             what ROADMAP 1.267 commissions. They were invisible only because
             the row was closed.

             On a PERMITTED run that costs the reader nothing: the glance above
             has already named the leading option and its share, so the panel
             has answered before this row is reached. On a WITHHELD run the
             glance renders NO reading at all, and then a closed row means a
             collaborator sees no numbers anywhere — from an analysis that
             computed them and is licensed to show them.

             That is `SectionShell`'s own licensing rule, met: something above
             depends on the content being visible, because the thing above is
             empty.

             ⚠ `headline` IS THE GLANCE'S OWN WITHHOLD AUTHORITY, CONSUMED, NOT
             RE-DERIVED. `AtAGlance.tsx:568-572` derives it: `winShare`,
             `winFraction` and `leaderLabel` are each non-null only where
             `headline` is. So "the glance is showing no reading" has exactly
             one spelling and this is it.

             ⛔ AND IT IS NOT `comparativeClaim`. That is a DIFFERENT question —
             may a comparative MAGNITUDE be drawn — with its own three-plus-one
             valued authority, and the bars are gated on it inside the section.
             Two shares, named apart (CLAUDE.md trap 21): the glance's
             LEADER-share, which is what `headline` governs, and this section's
             PER-OPTION shares, which it does not. Keying the disclosure on the
             magnitude licence would quietly make one of them stand for the
             other, and the next change would read them as one concept.

             ⚠ THE SECOND CONJUNCT IS NOT DECORATION. Opening a row with no
             figures behind it supplies nothing the glance withheld, and spends
             the collapsed IA — 1,584px against a 769px viewport — for it. The
             licence is "the content below answers what is missing above", so
             the content has to exist.

             ⚠ A DEFAULT, NOT A LOCK: `SectionShell` seeds `useState`, so the
             state belongs to the toggle from the first render on, and a reader
             who closes it keeps it closed. The collapsed IA is UNCHANGED on
             every run that names a leader, which is the state its measurement
             was taken in. Superseded by `bare` above (gap 17): a bare mount
             has no disclosure state left for `defaultOpen` to set, so the
             conditional that used to sit here is removed rather than left
             dead. */
          onFocusOption={focusTarget}
          onInspectOption={onReviewTarget}
          onAskAboutOption={(optionId, label) =>
            openAskOlumi({
              context: label,
              draft: COMMIT_ZONE_ASK.optionDraft(label),
              label: COPY.disclosure.askOlumi,
              targetId: optionId,
            })
          }
        />
    </CommitmentSummary>
  )

  /**
   * ⭐⭐ WORK THROUGH THIS FINDING WITH OLUMI — the act Paul said the Reasoning
   * tab had lost, and the census agrees with him.
   *
   * MEASURED on the served build `d3c818f2`, guest, every section opened, all
   * 36 buttons enumerated by name: sensitivity rows 3 with no act at all,
   * options rows 3 with focus only, model-strip marks 4 with focus only, and
   * the two rows that DO carry acts carry canvas and review but never the AI
   * one. ZERO routes to Olumi from any finding on the panel.
   *
   * ⛔ THE SLOT WAS NOT MISSING. #1643 restored it; it is gated on
   * `finding.intervention`, and no finding carries one on a real run, so the
   * capability shipped DARK. A restored affordance that no data reaches is the
   * estate's most expensive pattern, and it passed a full mutant kit because
   * every mutant asked whether the test could detect a change rather than
   * whether the act ever renders.
   *
   * ⚠ THIS SEEDS THE DRAWER FROM THE ROW'S OWN WORDS AND CLAIMS NOTHING ELSE.
   * No producer record is looked up because there is none to look up — that is
   * the whole difference between an ask and a dispatch. `context` is the row's
   * own detail so the drawer shows what the reader was looking at, `draft` is
   * the row's headline so the drawer never opens blank, and `targetId` rides only
   * where the producer named one.
   *
   * ⛔ NO `parameters`, AND THE ABSENCE IS DELIBERATE. The intervention route
   * carries `block_id` because the producer minted the recommendation and can
   * be told which one came back. An ask about a row has no producer record, so
   * inventing an identifier here would put a claim on the wire that nothing
   * upstream authored — the fabrication class this panel has spent the day
   * removing, one layer down.
   */
  const askOlumiAbout = (finding: AnalysisNewFinding) => {
    openAskOlumi({
      context: finding.detail ?? finding.implication,
      draft: finding.headline,
      label: COPY.disclosure.askOlumi,
      ...(finding.targetId ? { targetId: finding.targetId } : {}),
    })
  }

  const runIntervention = (recommendationId: string) => {
    const rec = vm.strengthen.interventions.find((r) => r.id === recommendationId)
    if (!rec) return
    openAskOlumi({
      context: rec.whyNow || rec.signal,
      // ⚠ `tryThis` MAY BE `null` NOW, AND `draft` IS A REQUIRED STRING. The
      // title is the last resort rather than an empty draft: on the producer
      // path `action.prompt` IS the title, so this falls back to what that path
      // would have sent anyway, and a drawer that opens blank is a worse
      // failure than one seeded with the finding's own name.
      draft: rec.action.prompt ?? rec.tryThis ?? rec.title,
      label: rec.action.label,
      ...(rec.targetId ? { targetId: rec.targetId } : {}),
      /**
       * ⭐⭐ THE ONLY THING ON THE WIRE THAT SAYS *WHICH FINDING* — and this
       * route was the one of five that dropped it.
       *
       * `buildRecommendations.ts:501` puts the producer's finding id on the
       * recommendation as `action.parameters = { block_id: item.id }`, and
       * `AskOlumiDrawer.handleSend` forwards `parameters` verbatim on the
       * dispatched turn. The finding's own paragraph rides `context`, which the
       * drawer renders read-only and never sends — so with `parameters` dropped
       * the coaching turn arrived carrying the action prompt and NOTHING that
       * identifies what it is about.
       *
       * This is wired to five mount points on this tab, so it is the surface's
       * primary "Work through with Olumi" route, not an edge.
       *
       * ⛔ THIRD ROUND OF THE SAME CLASS ON THIS SURFACE.
       * `askRoutesCarryTheFinding.spec.tsx` was written because an earlier fix
       * "closed one instance of the class and stopped", and it states the
       * enumeration in words — *"every `openAskOlumi` call that HOLDS a
       * recommendation"* — then pins three of them BY HAND, so a fourth route in
       * a different file was invisible to it. The enumeration is now DERIVED
       * from the source (`everyAskCarriesItsBlockId.spec.ts`): a new
       * rec-holding ask route fails the day it is written, wherever it lives.
       *
       * ⚠ THE GUARD WATCHES THE CARRIER, NOT THE BEHAVIOUR. It proves this call
       * site passes the id; it proves nothing about whether CEE can resolve it.
       * That is a question for Core and is not evidenced here.
       */
      ...(rec.action.parameters ? { parameters: rec.action.parameters } : {}),
      // The FOURTH rec-bearing ask route, and the one an earlier pass of this
      // change missed while claiming the class was closed. Same reason as the
      // other three: `rec.targetId` makes the drawer's "Focus on canvas" button
      // render, so without this the finding is left behind at exactly the
      // moment the user asks to see the thing it is about.
      attentionNote: attentionNoteForRecommendation(rec),
    })
  }

  return (
    <div
      className="flex-1 min-h-0 olumi-scrollbar overflow-y-auto"
      data-testid="analysis-new-tab-body"
      data-run-identity={responseHash ?? ''}
      /* ⚠⚠ ON THE ELEMENT THAT ALREADY EXISTS — AND THE FIRST ATTEMPT AT THIS
         ADDED A NEW ONE, WHICH BROKE THE TAB.
         A previous cut put `aria-busy` on a classless wrapper `<div>` inserted
         in `OutputsDock` between the tabpanel and this root. `SectionErrorBoundary`
         renders its children with no DOM node of its own, so this root WAS a
         direct flex item; demoted to a block child, its `flex-1 min-h-0` went
         inert. Measured in a real browser: the body grew 400px → 2000px, stopped
         scrolling, and 1600px of content became unreachable inside the panel's
         `overflow: hidden`. Caught in review; it never shipped.
         All four sibling surfaces put the attribute on an element that already
         exists — `CompareTabBody:263-265` puts it on the very
         `flex-1 min-h-0 overflow-y-auto` scroll container, which is exactly the
         shape of this one. So does this.
         `|| undefined` so the attribute is ABSENT when false rather than
         `aria-busy="false"` — the same form the four siblings use, and the
         difference matters to assistive tech.
         ⚠ `isBusy`, NOT `isRunning`: the marker answers the same question the
         cover and the announcer answer, and must read the same authority they
         read. See the prop's own note for the divergence this closes. */
      aria-busy={isBusyNow || undefined}
    >
      {/* The narrower measure (§11): wider gutters and a capped line length
          inside the unchanged 416px dock. */}
      <div className="px-4 py-4 space-y-4 max-w-[440px] mx-auto">
        {/* ⭐ V2 — ONE METHOD STRIP, FIRST (Paul + ChatGPT brief, 23 Sep 2026).
            It replaces BOTH the "Methods you can run" chip shelf and this tab's
            Actions dropdown, which rendered the same seven methods twice. Five
            icons + one overflow; the overflow keeps the rest of the catalogue
            and the global actions (edit brief, review inputs, re-run). Choosing a
            method shows it in the Challenge card; choosing it again clears it. */}
        <MethodStrip
          activeMethodId={pickedMethodId}
          onSelectMethod={(id) => setPickedMethodId((cur) => (cur === id ? null : id))}
          raisedMethodIds={raisedMethodIds}
          canRerun={canRunAnalysis === true && !vm.status.isPreRun}
        />
        {/* ⚠ THE INTRO ASSERTS A RUN, SO IT IS GATED ON THERE BEING ONE.
            "A second reading of the same analysis run" is true of this tab and
            false of this model when nothing has run — mounted pre-run it sat
            directly above "No analysis has run yet for this model", which is
            the surface contradicting itself in two consecutive lines. */}
        {/* The self-describing preamble ("A second reading of the same analysis
            run…") was REMOVED 30 Aug 2026. A panel that explains itself before
            doing its job spends the top of the first viewport on nothing the
            reader came for. */}

        {/* ── STATUS ────────────────────────────────────────────────────────
            Contextualises the content; never dominates it (§20). One line,
            not a banner stack. The Rerun control is the shell's footer bar,
            declared by this surface's `footerBar: 'reanalyse'` in the shell
            contract — the SAME control and the SAME handler the Model tab
            uses, so no second run authority exists. */}
        {/* ⚠⚠ PRE-RUN NOW SAYS WHAT THIS PANEL IS. Removing the intro that
            asserted a run was correct — it sat above "No analysis has run yet"
            and contradicted it — but nothing replaced the ORIENTATION, and a
            first-time user landing here had strictly less to go on than on the
            existing Analysis tab, which states what the panel reports on AND
            offers a route forward. Witnessed on the deployed build at
            `a9fc1564`. This says what the panel is WITHOUT asserting a run, so
            the original defect stays closed. */}
        {/* ⚠⚠ AND A FIRST RUN IN FLIGHT IS STATED, NOT DENIED — the third
            instance of this panel's own contradiction shape, after the intro
            and after staleness.

            `isPreRun` means "no COMPLETED analysis is being displayed", so on a
            model's FIRST run it is true AT THE SAME TIME as the run flags.
            Measured at this render path on `staging` `3b2df4ce`: the panel said
            "No analysis has run yet for this model." on an element it had
            itself marked `aria-busy="true"`, beneath the shell's in-flight
            treatment — which pre-run is `AnalysisRunSkeleton`, because
            `OutputsDock` passes `contentRetained={!isPreRun}`. A skeleton
            carries no words. So the only SENTENCE on screen during a first run
            said nothing was happening.

            ⭐ THE SENTENCE FOR IT WAS ALREADY WRITTEN AND HAD NO READER.
            `COPY.status.running` is declared and documented and had ZERO
            production references repo-wide, while `vm.status.isRunning` was
            computed and read by nothing on this surface. This plugs it in
            rather than authoring a second one.

            ⚠ THE ORIENTATION LINE STAYS IN BOTH STATES. It asserts no run
            ("When one has, this panel reads it back…"), so it is true while one
            is in flight and it is the only thing telling a first-time reader
            what is about to appear.

            ⚠ AND THE REFUSAL IS SUPPRESSED WHILE BUSY — stated honestly as
            HARDENING, not as a witnessed fix. `canRunAnalysis` returns EARLY on
            `isRunning` and that early return publishes NO `blockedListing`
            (`canRunAnalysis.ts:782-787`; the comment above it says the early
            returns deliberately publish none), so the box is already absent
            during a run in production. This makes that a property of THIS code
            rather than of the gate's current behaviour — the move
            `buildAnalysisNewViewModel`'s header argues for its own pre-run
            gates: "Gating here makes it a property of the code." A refusal has
            no subject while the thing it refuses is happening. */}
        {vm.status.isPreRun ? (
          <div className="space-y-1" data-testid="analysis-new-status-pre-run">
            {!isBusyNow && !runWaitExhausted && latestRunNote?.kind === 'did_not_run' ? (
              <p
                className={`${typography.panelBody} text-text-body`}
                data-testid="analysis-new-status-did-not-run"
              >
                {ANALYSIS_REFUSAL_HEADLINE} {latestRunNote.reason} {ANALYSIS_REFUSAL_POINTER}
              </p>
            ) : !isBusyNow && !runWaitExhausted && latestRunNote?.kind === 'blocked' ? (
              <p
                className={`${typography.panelBody} text-text-body`}
                data-testid="analysis-new-status-blocked"
              >
                {ANALYSIS_REFUSAL_REASON_COPY.analysis_not_ready}
              </p>
            ) : !isBusyNow && !runWaitExhausted && latestRunNote?.kind === 'failed' ? (
              <p
                className={`${typography.panelBody} text-text-body`}
                data-testid="analysis-new-status-run-failed"
              >
                {COPY.status.firstRunFailed}
              </p>
            ) : (
              <p className={`${typography.panelBody} text-text-body`}>
                {isBusyNow
                  ? COPY.status.running
                  : runWaitExhausted
                    ? COPY.status.waitExhausted
                    : COPY.status.preRun}
              </p>
            )}
            {/* ⭐⭐⭐ WHY, AND IT IS THE HALF THAT MAKES THE SENTENCE USABLE.
                "This analysis has not reached this page." on its own reads as a
                fault the reader caused. This line says what the client actually
                knows — that the run may well have completed somewhere it could
                not be sent from — and names the one act that can change it.

                ⚠ IT IS NOT A SECOND ORIENTATION LINE. `preRunWhatThisIs` above
                stays in every state and describes what the panel is FOR; this
                describes what happened to one run, and only in the state where
                something did. */}
            {runWaitExhausted ? (
              <p className={`${typography.panelMeta} text-text-light`}>
                {COPY.status.waitExhaustedWhy}
              </p>
            ) : null}
            <p className={`${typography.panelMeta} text-text-light`}>{COPY.status.preRunWhatThisIs}</p>
            {/* ⭐⭐ AND WHY IT HAS NOT — the half this state was missing. The two
                sentences above orient a reader who has not run one yet; neither
                says anything to the reader who TRIED and was refused, which on
                a saved model is the common case. Every line below is the run
                gate's own; see `WhyNoAnalysisYet`. */}
            {isBusyNow ? null : (
              <WhyNoAnalysisYet
                listing={blockedListing}
                /* ⭐⭐ THE GATE'S SINGLE-BLOCKER SENTENCE, so a refusal that
                   publishes no itemised listing is still explained rather than
                   silent. Passed only when the gate actually refuses — the
                   tooltip is also the carrier for a `warning` on an ALLOWED
                   run, and printing that under "Why no analysis yet" would
                   invent an obstacle. */
                reason={runRefusedByGate ? runBlockedReason : null}
                onFocusTarget={focusTarget}
                onAsk={openAskOlumi}
              />
            )}
            {/* ⭐⭐⭐ A REFUSAL CARRIES ITS REMEDY, OR IT IS A DEAD END.
                This block states the blocker — "No analysis has run yet" — and
                until now offered no way past it, on the FIRST SCREEN a new user
                meets. `onReanalyse` was already passed to this body
                (`OutputsDock` hands it `handleRunAnalysis`) and reached only
                `AtAGlance`, which ZONE: ANSWER gates off pre-run. So the handler
                was present and unreachable in the one state that needs it.

                ⛔ WITNESSED, which is why this is not a nicety: a user sent a
                brief, read a substantial coaching reply, and concluded an
                analysis had run. CEE was returning a `run_analysis` suggested
                action on that very turn. The panel rendered seven "Methods you
                can run" and no way to run the analysis.

                ⚠⚠ ABSENT WHEN A RUN WOULD FAIL, NEVER DISABLED. The remedy for
                a refused run is resolving its blockers, which the box above
                states; offering a button that refuses is the defect one level
                down, and this panel has adjudicated it out twice.

                ⛔ AND IT ASKS THE GATE, NOT THE LISTING — corrected 22 Sep
                2026, witnessed on staging `1f77130d`. This condition read
                `blockedListing == null`, on the strength of a contract line
                that said a null listing means the run is not blocked. It does
                not: `canRunAnalysis` publishes NO listing from any of its early
                returns, and says so above them. On a model whose registration
                CEE had aborted (`graph/register` → `net::ERR_ABORTED`, `/graph`
                → 404) the hold was armed, the gate refused, and this control
                rendered ENABLED with no reason anywhere on the tab — one click
                from asking CEE to analyse a graph it answers 404 for.
                `canRunAnalysis` is the gate's own `allowed`, already passed
                here by `OutputsDock` and already read by the ribbon one section
                down: present and unreachable, exactly as `onReanalyse` was.

                ⚠ AND ABSENT WITH NO HANDLER: a host with no run affordance
                renders nothing rather than a control that does nothing — the
                same fail-closed shape `onSendMessage` uses one section over. */}
            {!isBusyNow && !runRefusedByGate && onReanalyse ? (
              <button
                type="button"
                onClick={onReanalyse}
                className={`${typography.panelMeta} ${action('primary')} mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid="analysis-new-status-pre-run-act"
              >
                {COPY.status.preRunRunAction}
              </button>
            ) : null}
          </div>
        ) : null}
        {/* ⚠⚠ AND STALENESS IS SUPPRESSED PRE-RUN — THE SAME CONTRADICTION AS
            THE ONE ABOVE, IN A DIFFERENT PAIRING. Witnessed on the deployed
            build at `4401d6d8` (30 Aug 2026), guest, saved example
            "Usage-Based Billing System Approach": this panel rendered BOTH
            `analysis-new-status-pre-run` — "No analysis has run yet for this
            model." — and `analysis-new-status-stale` — "The model has changed
            since this analysis ran." Two sentences, one panel, mutually
            exclusive claims. There is no "this analysis" for the model to have
            changed since.

            The types already settle which one is wrong. `isPreRun` is declared
            "No completed analysis is being displayed"; `isStale` is declared
            "The DISPLAYED run predates the current model". Staleness is a
            property OF a displayed result, so with nothing displayed it has no
            subject — it is not a smaller truth, it is a claim about a thing
            that is not there.

            The pre-run branch stays and the staleness line goes, rather than
            the reverse: pre-run is the state the reader is actually in, and it
            is the sentence that tells them what to do next. */}
        
        {/* ⚠ A PARTIAL RESULT SAYS SO HERE, NOT ONLY IN A COLLAPSED REGION.
            `status.isProvisional` was computed and read by NONE of the six
            render components; the sole disclosure was the bare enum "partial"
            inside `Deeper analysis`, which opens collapsed. On a surface whose
            claim is a five-to-ten-second read, that is a partial result
            presented exactly like a complete one. */}
        
        {vm.status.statusNote ? (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-status-note">
            {vm.status.statusNote}
          </p>
        ) : null}

        {/* ── WHAT THE ENGINE WARNED — BESIDE WHAT IT QUALIFIES, NOT ABOVE IT ──
            ⚠ THIS REVERSES A RECORDED RULING, KNOWINGLY (Reasoning V2, 24 Sep
            2026). The strips stood here because "a caveat that arrives after the
            reading it qualifies is not a caveat, it is a footnote". Measured on
            served `c5000550` (withheld run, 1440×900): the box took the second
            slot on screen and pushed the options chart it qualifies below the
            fold, so the caveat arrived a screen BEFORE the reading.

            The V2 prototype meets the same need the other way round: one
            borderless line directly under the chart ("Provisional · …",
            `commitmentQualifier.ts`), and the full list in About › Limitations,
            where `AboutThisAnalysis` now mounts these same two components
            unchanged (the legacy tab's mount in `ResultsBody` is untouched). */}

        {/* ── YOUR MODEL SO FAR ────────────────────────────────────────────
            First, because it is the only element that is true in every state:
            before a run, during one, and after. It says what the model CONTAINS
            and routes to each node — it makes no claim about the run, and no
            claim about whose values these are (see `buildModelStrip.ts`).

            It also fixes what this tab could not do at all: describe its own
            subject. The panel could report a run in detail and never say what
            the run was about. */}
        {/* ⭐ …and it is now a TOOL rather than a census: a mark opens the
            run's own coaching for that node — the engine's finding, its one
            practical instruction, and the technique the finding warrants —
            while still routing to the node on canvas. Nothing on that detail is
            authored by this surface; see `nodeInsights.ts`. */}
        {/* ⭐ THE BODY DECIDES WHO LEADS, BECAUSE ONLY THE BODY SEES BOTH.
            The strip has no access to the view model and must not grow one —
            the same rule `insights` already follows. ⛔ NOTHING ARBITRATES
            THE 18px SLOT ANY MORE. This passed `answerLeads`, which LOANED that
            slot to the conclusion whenever the producer named a leader, so the
            loudest element on screen was Olumi's answer and the decision the team
            is making stood down to section-title size.

            ⛔ RULED OUT BY PAUL, 18 Sep 2026: "Lead with the decision label and
            goal, not the conclusion - there shouldn't be a conclusion. We are a
            reasoning enhancement tool, not a generic AI and analysis answering
            tool." A surface whose largest type is a verdict does the thinking for
            the reader. The arbitration is REMOVED rather than inverted: a flag
            that can still swing is a flag that will. */}
        <ModelStrip
          isPreRun={vm.status.isPreRun}
          insights={nodeInsights}
        />
        {/* ⭐ V2 — ONE REVIEW AFFORDANCE FOR THE WHOLE MODEL. The strip's
            "to verify" badge counted factors only; the engine's findings about
            framing, assumptions, relationships and alternatives lived in a
            separate wall of cards ("Strengthen the reasoning"). One queue now
            holds both (`buildReviewQueue`), one item at a time, with edit /
            inspect / focus / ask. The finding the glance promotes is excluded so
            it is never offered twice. */}
        <ModelReviewTool
          interventions={vm.strengthen.interventions}
          excludeId={glancePrimary?.id ?? null}
          onAsk={openAskOlumi}
          onInspect={onReviewTarget}
          onFocus={(id) => {
            if (!focusModelTarget(id)) {
              showToast(COPY.canvas.focusFailed)
              return false
            }
            onFocusNode?.(id)
            return true
          }}
          analysisHash={responseHash ?? null}
        />

        {/* ── FOCUS NOW ──────────────────────────────────────────────────────
            ⭐ THE PROTOTYPE'S PRIMARY ACTION, AND IT WAS BUILT ON THE WRONG TAB.
            `reasoningpanelv3` puts FOCUS NOW immediately under the model strip —
            one thing to do next, with the reason it applies to you. Every part
            of it already exists: `FocusNowContainer` has been the Analysis tab's
            second panel since it shipped, and Paul's scope ruling excludes that
            tab. So the panel he does use had no primary action at all; the slot
            was held by "Strengthen the reasoning", which renders EMPTY whenever
            the producer sends no phase-3 coaching.

            ⛔ MOUNTED NARROWED, AND IT WOULD HAVE BEEN A REGRESSION OTHERWISE.
            `useFocusNow` passes only `coachingSummary`, and that is gated off
            (`CERTIFY_SUMMARY=false`), so the container renders six UNCONDITIONAL
            hygiene nudges. Dropped here unchanged they would tell a person with
            a goal, three options and two outcomes to "define what success looks
            like" — the surface asserting a gap it never measured, in the one
            slot a reader trusts most. `focusApplicableIds` narrows them to the
            rows this model demonstrably lacks, and an empty list renders
            nothing at all. */}
        {/* ⛔ RENDERS ONLY WHEN IT HAS SOMETHING TO SAY, AND THE RATCHET IS WHY.
            `thePanelCannotRegrow.spec.tsx` caught this mount at 9 blocks against
            a ceiling of 8 on all three fixtures. Its header names the exact
            failure: "the dump is what twenty individually-reasonable additions
            look like from the reader's chair" — and this addition is a good one,
            which is precisely the case the ratchet exists to stop.

            The breach was not the nudges: those fixtures set no canvas nodes, so
            `stripHasContent` is false, every fact is unknown and NO row is
            earned. It was the SHELL — `FocusNowPanel` renders its own empty
            state, so the block cost a reader a heading over nothing. That is the
            rule this tab already enforces on every sibling
            (`aGroupHeadingClaimsSomethingIsUnderIt.spec.tsx`).
            So the gate is here, and the ceiling is UNCHANGED at 8/8/6 rather
            than argued upward. */}
        {/* ── ZONE: FOCUS ─────────────────────────────────────────────
            ⭐ ONE BLOCK, NOT A LABEL PLUS N BLOCKS. Wrapping the group is what
            makes the zone grammar a REDUCTION: the panel goes from a flat stack
            of equal-weight cards to a few named groups, and the regrowth
            ratchet counts it as one child rather than several. A label added
            loose would have raised the count by five and the ceiling with it,
            which is the opposite of what the prototype asks for. */}
        {/* ⛔⛔ THE ZONE IS GATED ON ITS OWN CONTENT, AND THE COMMENT DIRECTLY
            ABOVE SAYS WHY. The block above me was gated for exactly this reason
            — "the block cost a reader a heading over nothing" — and my first cut
            put a label above that gate rather than inside it, so "Focus now"
            rendered alone on ALL SEVEN fixtures (measured: content beyond the
            label = 0 characters, every one). A zone label is a heading like any
            other; `aGroupHeadingClaimsSomethingIsUnderIt.spec.tsx` is the rule
            it was breaking, and the fix is the gate, not a wider ceiling. */}
        {/* ⛔⛔ THE GATE WIDENED, AND THE RULE IT PROTECTS IS UNCHANGED.
            This read `focusApplicableIds.length > 0`, because the comment above
            is right that a zone label over nothing is the defect. `Focus now`
            now heads something on EVERY run: `MethodsYouCanRun` renders the
            static `METHOD_CATALOGUE`, which is never empty. So the heading still
            claims something that is under it — the gate moved, the rule did not.

            ⭐ PAUL'S INSTRUCTION, 18 Sep 2026: "make it first-screen — put it in
            ZONE: FOCUS." It was in ZONE: ALSO, below the fold. This zone renders
            above the answer, so the methods are now the first thing under the
            decision itself.

            ⚠ THE NUDGES KEEP THEIR OWN GATE, inside. They are run-specific and
            frequently absent; the methods are not. Two different questions, and
            folding them into one gate is what would bring the heading-over-
            nothing defect back. */}
        {/* V2: "Focus now" now follows the answer — see the note at its new mount. */}

        {/* ── AT A GLANCE — the 5-to-10-second read ───────────────────────── */}
        {/* ⛔ `driverTotal` NO LONGER PASSED. It let the glance declare its cap
            of three ("+N more drivers in this run"); the glance's driver list
            was removed at `e15416ad` because it restated the drivers section's
            ranking from the same fields, so there is no cap here to declare.
            `primaryIntervention` is the ENGINE's top recommendation, passed
            rather than re-derived: this surface never mints one. */}
        {/* ── ZONE: ANSWER ─────────────────────────────────────────────
            ⭐ ONE BLOCK, NOT A LABEL PLUS N BLOCKS. Wrapping the group is what
            makes the zone grammar a REDUCTION: the panel goes from a flat stack
            of equal-weight cards to a few named groups, and the regrowth
            ratchet counts it as one child rather than several. A label added
            loose would have raised the count by five and the ceiling with it,
            which is the opposite of what the prototype asks for. */}
        {/* ⚠⚠ 8px INSIDE THIS ZONE, 12px IN THE OTHERS, AND THAT ASYMMETRY IS
            DELIBERATE. #1658 gave every zone 12px against the column's 16px on
            the argument that "if the gap INSIDE a zone equalled the gap BETWEEN
            zones the groups would stop reading as groups". 8px does not weaken
            that argument, it strengthens it — the inside gap moves FURTHER from
            the 16px between zones.

            This is the zone that has to fit the most content above the fold, and
            it is the only one that was failing to. `theZonesCarryTheirOwnRhythm`
            requires each zone to be strictly tighter than the column and on the
            sanctioned scale; it does NOT require the zones to match, and 8px
            satisfies both. Worth 16px of fold margin across four gaps. */}
        {/* ⛔⛔ A ZONE LABEL NEEDS A ZONE — AND I CREATED THIS DEFECT YESTERDAY.
            #1711 gated `TrustLine` off the pre-run state, correctly: it was
            claiming "How far this holds was not established · 0 checks ran ·
            0 open questions" about a result that did not exist. What I did not
            check is that `TrustLine` was this zone's ONLY pre-run occupant, so
            removing it left "What your model shows" heading nothing, running
            straight into "Also worth doing".

            ⛔ WITNESSED BY PAUL ON THE SERVED BUILD within an hour of that merge,
            in the screenshot he took to confirm the fix worked. The fix DID work;
            it opened this beside it. A change that removes the last child of a
            labelled group has to be checked against the GROUP, not only against
            the child — the guard I wrote for ZONE: FOCUS in #1694 says exactly
            this ("a zone label over nothing is the defect") and I did not apply
            my own rule one zone over.

            ⭐ THE PREDICATE IS SEMANTIC, NOT A CONTENT SNIFF. This zone is
            "What your model shows" — every child of it is analysis output
            (`AtAGlance`, `WhatsChanged`, drivers, options, robustness, the
            sensitivity section). A pre-run state has no analysis, so the zone
            has nothing to show BY DEFINITION rather than by coincidence. Gating
            on `isPreRun` therefore cannot go stale the way a hand-listed
            "does any child render?" conjunction would (trap 12).

            ⚠ EVERY POST-RUN PATH IS UNTOUCHED, including a withheld run — which
            is the one that matters most here, because that is where `AtAGlance`
            carries "no option can be called the leader until you have set at
            least one". */}
        {/* ⭐ THE RULE BETWEEN THE MODEL AND THE FIRST ZONE (fidelity gap
            6/11) — the design authority's `.section:before`, drawn as its
            own element because the model block (`ModelStrip` /
            `ModelReviewTool`) and "Challenge the thinking" are sibling
            top-level blocks with no shared wrapper to carry it on. Empty and
            `aria-hidden`, so `topLevelBlockElements()` — which already skips
            `MethodStrip` for the same reason — skips this too; it never
            counts against `thePanelCannotRegrow` or reads as a stray section
            in `everySectionBelongsToAZone`. Same `role="separator"`
            convention `PreAnalysisPanel.tsx` already uses for its own
            decorative rules. */}
        <div className={PANEL_RULE} role="separator" aria-hidden="true" data-testid="analysis-new-rule-model-challenge" />
        {/* ── ZONE: ALSO ─────────────────────────────────────────────
            ⭐ ONE BLOCK, NOT A LABEL PLUS N BLOCKS. Wrapping the group is what
            makes the zone grammar a REDUCTION: the panel goes from a flat stack
            of equal-weight cards to a few named groups, and the regrowth
            ratchet counts it as one child rather than several. A label added
            loose would have raised the count by five and the ceiling with it,
            which is the opposite of what the prototype asks for. */}
        <div className="!mt-0 pt-1 space-y-3" data-testid="analysis-new-zone-also-group">
        {/* ⭐ A ZONE LABEL — the approved prototype's grammar. It names a GROUP
            of blocks, so it carries no border, no fill and no radius of its
            own: furniture that looked like a block would add the weight this
            change exists to remove. Sized and coloured as `panelMeta`, the
            quietest of the panel's three sizes. */}
        {/* ⭐ V2 (fidelity gap 16): the zone is a SECTION TITLE, the same
            grammar as "Move towards commitment" (a rule, then a 14px h3), not an
            11px caption over a bold item. That inverted hierarchy read the
            zone's name as a footnote to its own finding. */}
        {/* ⭐⭐ SPACE-1 / FIRST-2 (panel-lane design audit 2026-09-25): the rule's
            own pt-[11px] (panelSurfaces.ts PANEL_RULE), the ambient space-y-4
            margin this group used to inherit (16px), and this title's own
            pt-3 (12px) stacked to a 44px band above "Challenge the thinking" —
            against the prototype's 18px (.section{margin-top:11px;padding-top:11px}
            measured rule-to-cap). The group now overrides the ambient margin
            with !mt-0 and states its own pt-1, so the total is 11 (rule) + 4
            (group) ≈ the prototype's figure; the title no longer carries pt-3. */}
        <h3
          className={`${typography.panelHeader} text-text-header m-0`}
          data-testid="analysis-new-zone-also"
        >
          Challenge the thinking
        </h3>
        {/* ⭐⭐⭐ WHAT TO THINK ABOUT NEXT — MOVED HERE 18 Sep 2026, on Paul's
            instruction to shorten the answer zone so both "what matters most"
            and "how the options compare" fit at 1440.

            It rendered inside `AtAGlance`, which put a NEXT ACTION in the zone
            that holds the ANSWER. Its own heading there said so: "WHAT TO THINK
            ABOUT NEXT". This zone is labelled "Also worth doing".

            ⭐ MEASURED, not preferred. At 1440×860 (fold 729) the options
            comparison sat 89px below the fold. Every information-preserving
            spacing trim COMBINED saved 63px — still 26 short. Moving this card
            saves 90px including its gap, on its own, and deletes nothing.

            ⚠ The composition stays in this body rather than moving into the
            component, for the reason every other composition does: the card is
            presentational and must not grow a second derivation of what the
            producer recommended. */}
        {/* ⭐ V2 — ONE GROUNDED INTERVENTION, then the few signals that matter.
            The card shows the method the user picked, else the engine's top
            finding (`glancePrimary`), verbatim. The signals are the top three
            drivers (rank + bar, no percentage), one tipping condition and one
            gap.
            ⛔ THE TIPPING ROW IS LEADER-GATED HERE. Its sentence says "before
            <option> leads", which presupposes a current leader; on a run whose
            leader claim is withheld that is the panel naming an order it may not
            state (the same rule #1881 applies to the panel's own leader words).
            So the thresholds are passed only when the claim is permitted. */}
        <ChallengeCard
          intervention={glancePrimary}
          methodId={pickedMethodId}
          onRunIntervention={runIntervention}
          onRunMethod={(id) => {
            const method = METHOD_CATALOGUE.find((m) => m.id === id)
            if (method) runMethod(method)
          }}
          onDisagree={(rec) => openAskOlumi(disagreeWithRecommendationPayload(rec))}
          analysisHash={responseHash ?? null}
        />
        <ReasoningSignals
          vm={vm}
          flipThresholds={vm.leaderClaimPermitted ? resultsSectionData.recommendation.flipThresholds : undefined}
          onFocus={focusTarget}
          onInspect={onReviewTarget}
          onAsk={openAskOlumi}
          closedAtRest={true}
        />
        {/* V2: "Strengthen the reasoning" and this tab's Actions dropdown are
            gone from here. Their findings are the review tool's queue (under
            the model strip) and their methods/actions are the method strip. */}

        {/* ── THE MOVES A PERSON CAN ASK FOR, WITHOUT WAITING TO BE OFFERED ──
            ⭐⭐ EVERY METHOD ON THIS TAB WAS PRODUCER-INVOKED, AND NONE WAS
            USER-INVOKED. Derived at the mapping (`recommendationMethod.ts`),
            with a contrast control:

              pre_mortem        reachable — only on PRE_MORTEM / overconfidence
              review_bias       reachable — only on COGNITIVE_BIAS
              outside_view      reachable — only on an anchoring finding
              different_option  reachable — only on LOW_OPTION_COUNT
              consider_opposite reachable — only when a flip condition exists
              reframe_problem   ⛔ NOT REACHABLE FROM THIS TAB
              explore_tradeoffs ⛔ NOT REACHABLE FROM THIS TAB

            Every one of the first five is gated on the PRODUCER emitting a
            particular signal. Not one was available because the PERSON wanted
            it — and a tool for critical and creative thinking has to let the
            thinker choose the move. The two needing no signal at all are the
            two most generative: "is the question too narrow?" and "what does
            each option gain and give up?".

            ⛔ THEY WERE BUILT, AND SHIPPED TO THE WRONG SURFACE — AND THAT WAS
            ALREADY FALSE BY THREE DAYS WHEN THIS BLOCK WAS WRITTEN.

            The sentence here read: *"Its only mount is inside
            `DecisionOverviewCard` — on the ANALYSIS tab, which Paul's scope
            ruling parks."* That was the whole argument for adding a second
            surface, and it was untrue at the time. Derived at the history:

              15 Sep  #1590 `9dc8cf47`  mounts `<ActionsMenu />` on THIS tab
              18 Sep  #1694 `c522af9e`  adds this shelf, arguing from the
                                        pre-#1590 state

            `<ActionsMenu />` sits 25 lines ABOVE this comment. So the premise
            was refutable by reading the same file, and every session since has
            inherited it.

            ⚠ THE SHELF IS NOT WITHDRAWN AND MUST NOT BE. Paul's 18 Sep ruling
            was "make it first-screen", and a collapsed menu near the foot of
            the panel does not satisfy that whatever its reachability. The shelf
            earns its place on the RULING; it never needed the false premise.

            ⚠ WHAT THE TAB ACTUALLY SHIPS, measured on deployed `b6673341` via
            the guest path: the `Actions` menu carries TEN items — all seven
            methods verbatim, plus `Edit decision brief`, `Review all inputs`
            and `Rerun analysis`. Seven of ten duplicate the shelf above.
            `ActionsMenu.tsx` knows this and resolves the part that matters:
            both surfaces build their payload through one `runMethod`, so there
            is no second answer to "what does this method ask?".

            ⛔ WHETHER TWO SURFACES SHOULD CARRY THE SAME SEVEN IS A DESIGN CALL
            AND IS PAUL'S, NOT THIS FILE'S. It is recorded, not acted on: he has
            ruled on this placement twice, an approved prototype governs it, and
            no measurement here shows the duplication costs a reader anything.
            Do not "reconcile" it by deleting either surface on a tidiness
            argument. This estate's chronic failure #1 is real — but the cure is
            not a third mount minted from a stale sentence.

            ⚠ NO NEW COMPONENT AND NO NEW PROPS. `ActionsMenu` takes none, and
            routes every ask through `openAskOlumi` — the same drawer this file
            already opens at :1163 — with an EDITABLE prefilled draft rather
            than a hidden dispatch. Nothing here decides what the method says.

            ⚠ PLACED AFTER THE PRODUCER'S OWN SUGGESTIONS, DELIBERATELY. What
            the run raised comes first; this is the shelf for when it raised
            nothing, or nothing you wanted. Ahead of the decision record,
            because a method is a move you make BEFORE you write down what you
            decided. */}
        {/* ⭐ MOVED BELOW THE ACT — witnessed on the deployed build, 15 Sep.
            On a real run this rendered between the trust line and "What would
            change your mind", asking the reader to RECORD A DECISION before
            they had met the thing that would change it. The prompt is honest
            and the placement was not: it belongs after the act, where a reader
            who has finished reading can use it.

            ⚠ No new block — the same one, later. The panel stays at its
            ratcheted count. */}
        {/* ── RECORD WHAT YOU DECIDED ───────────────────────────────────────
            ⭐⭐ THE ACT, AND THE PANEL'S ONLY UNCONDITIONAL ONE. Every section
            above reads the model. This is the one place the team writes down
            what they will DO, and the one place a later session reads it back.

            ⚠⚠ THE GATE CARRIES NOTHING ABOUT THE RUN'S QUALITY — see the
            component header. `ModelHeldUp` above renders on almost no runs by
            design; the read-back here renders on all of them, because the
            quality of a result has no bearing on whether a team may record, or
            re-read, the choice they made from it. A fragile or stale run is
            when the reasoning is most worth keeping.

            ⚠ WHAT IT DOES CARRY IS `canCapture`, AND ONLY OVER THE DOOR. The
            first version gated on `!isPreRun` alone and offered a door onto a
            modal that opens disabled during any rerun — see `canCapture`.

            ⚠ THE RECORD IS SCENARIO-KEYED, NOT RUN-KEYED.
            `useDecisionRecordForScenario` resolves `currentScenarioId` through
            `resolveScenarioKey`, so it survives re-runs and returns to the same
            scenario — which is the capability — and cannot distinguish the run
            it was captured against. The section's copy is scoped accordingly. */}

        {/* ⛔⛔ TWO RULINGS COLLIDED HERE AND GROUPING IS WHAT MADE THEM
            COLLIDE (CLAUDE.md trap 21). `whatIWasGivenMount` pins "what I was
            given" ABOVE the coaching; `AnalysisNewTabBody.spec` and
            `whatTheRunCouldNotSettleIsOnePlace` pin the coaching above EVERY
            detail section, checks included. Those two members now sit in one
            group, so the group cannot be both above and below the act.

            ⭐ RESOLVED BY WHAT EACH RULING PROTECTS, not by which is older. The
            coaching-above-detail rule guards FOUR sections and is stated twice.
            The what-I-was-given rule guards ONE, and its stated argument is
            that the section must not be buried below the detail — which a
            NAMED, CLOSED group one click from the trust line does not do. The
            protection survives; the literal ordering does not.

            ⚠ The other spec was updated to assert the protection rather than
            the position, and says so in its own file. */}
        {/* ── COACHING AND METHOD ───────────────────────────────────────────
            ⭐⭐ THE SCIENCE-GROUNDED HALF, GROUPED AND KEPT. `BiasGrounding` is
            the most method-bearing payload the producer sends — a mechanism, a
            citation and a costed micro-intervention per finding — and it was
            sitting TWELFTH, below four caveat boxes. Grouping it with key
            insights gives it a named home a reader can go to, instead of a
            position in a stack they were scrolling past.

            ⚠ CLOSED BY DEFAULT IS NOT DEMOTION. It is one click from the top of
            the panel under a heading that says what is inside; before, it was
            twelve blocks down under a heading that did not. */}
        {/* V2: the detail behind the challenge signals — the full driver
            section and "What would change your mind" — lives in this zone,
            closed, instead of in the answer zone. Post-run only, as before. */}
        {/* ⭐ "WHAT WOULD CHANGE YOUR MIND" STAYS IN THE CHALLENGE (review of
            #1946, 5818389086). On a run allowed to name a leader it IS the
            challenge to that answer, and it must be read before the answer —
            the prototype keeps it inside "Challenge the thinking" too. Only
            "What moves the outcome" moved below the answer. */}
        {vm.status.isPreRun ? null : (
        <>
        {/* ── WHAT WOULD CHANGE YOUR MIND ──────────────────────────────────
            ⭐⭐ PROMOTED FROM ROW 3 OF A COLLAPSED SECTION, TWELFTH OF FOURTEEN.
            Witnessed on staging `e685dafa`: the single most decision-relevant
            sentence this product emits —

              "If \"Bottom-Up Adoption Friction → Bottom-Up Adoption Rate\"
               changes significantly, \"A Full Switch at Renewal\" could become
               the better choice"

            — rendered inside "Uncertainty and gaps", a heading that reads as a
            list of caveats. Meanwhile "How the options compare", which restates
            the headline, had a section of its own higher up. That is an
            inverted information architecture, and this is the correction.

            ⚠ ABOVE THE COACHING, DELIBERATELY, AND IT DOES NOT CONTRADICT THE
            NOTE BELOW. That note's rule is WHAT HAPPENED → WHAT TO DO → THE
            DETAIL. "What would change your mind" is the last half of what
            happened, not the first half of what to do: it is a property of the
            result the glance just stated, and the coaching that follows is a
            response to BOTH. Placed under the coaching it would be detail
            again, which is where it came from.

            ⚠⚠ `emptyMessage={null}` IS THE GATE, AND IT IS THE WHOLE OF IT.
            An empty list here cannot distinguish "nothing would flip this" from
            "the run did not test it", and only one of those is reassurance —
            so the section must be ABSENT rather than empty. `AnalysisNewSection`
            already owns that rule (`findings.length === 0 && !emptyMessage`
            returns null, §19), so a `length > 0` conditional at this mount was
            REDUNDANT — and a mutant proved it: deleting it left all 59 tests
            green. Dead code shaped like a safety gate is worse than none, because
            it tells the next reader the mount decides when the section does.
            The mutant that bites is giving this an emptyMessage.

            ⚠ AND THE ROWS ARE MOVED, NOT COPIED — `uncertainty` no longer
            carries them. A reader meeting one sentence in two sections is a
            defect this panel has already shipped.

            ⛔⛔ LEADER-GATED AS A WHOLE — 24 Sep 2026, witnessed live (UI
            `3cf9fbd0`, OpenAI path, scenario `aca54686`). With `leader_claim
            {permitted: false, producer_cause: 'constraint_verdict_withheld'}`
            this section still read: *Bars show how often a different option
            was stronger in the runs where that assumption came out weak. /
            Enterprise price → MRR / If this changes significantly, "Raise Pro
            to £59" could lead in this model / 24%*. "Could lead" and "a
            different option was stronger" both presuppose a current leader —
            the order this run refused to state. #1933 withheld the glance's
            "Could change if" and the hinge line for exactly that; the header
            above was already gated on `leaderClaimPermitted`. The rows were the
            one place left saying it.

            ⚠ THE WHOLE SECTION, NOT THE SENTENCE, AND THAT IS NOT CAUTION FOR
            ITS OWN SAKE. Every row here is a fragile edge — a relationship
            whose weakening SWITCHES THE RECOMMENDED OPTION (`switch_probability`
            is defined that way), so the row, its bar and the caption are all
            statements about a leader. Blanking `implication` alone would not
            hold: on a set whose rows cannot be titled, the row's HEADLINE is
            that same sentence, cut, alternative included. And the header is
            already empty on this run, so what would remain is a heading over
            relationship names whose only meaning is the withheld comparison.
            The rule is the same one `sensitivityHeaderTips` follows, one level
            up: no leader licence, nothing that speaks relative to a leader —
            and no heading left over nothing. */}

        {vm.leaderClaimPermitted ? (
        <AnalysisNewSection
          title={COPY.sections.sensitivity}
          findings={sensitivityFindings}
          /* ⭐⭐ THE SHARED CONCLUSION, SAID ONCE, ABOVE THE ROWS THAT SAY IT
             THREE TIMES.

             ⛔ A DE-DUPLICATION, NOT A NEW CLAIM, and that is the entitlement
             argument in full: every row below already names this option inside
             the producer's own sentence, so stating it once above them is
             strictly LESS assertion than the section already makes. The view
             model decides WHETHER it may be said (all rows agree, by id, and
             none unnamed); this slot only renders it.

             ⚠ THE EXISTING `header` SLOT, not a new prop. `AnalysisNewSection`
             is shared by four sections, and a `convergence` prop on the shared
             component would be a field three of them can never fill — the
             shape that invites a fourth caller to fill it with something
             else. */
          /* ⛔ V2: LEADER-GATED, AND THE FIRST TIPPING POINT HAS ONE OWNER.
             Both sentences presuppose a current leader ("…before <option>
             leads", "…towards <option>"), so on a run whose leader claim is
             withheld they are the panel naming an order it may not state (the
             rule #1881 applies to its own leader words; DATA-MAP truth risk 1).
             And the first tipping point is already the Challenge signals row,
             so this header carries only the rest — otherwise a header-only
             section opened itself and put the same sentence on screen twice. */
          header={
            sensitivityConvergence || sensitivityHeaderTips.length > 0 ? (
              <>
                {sensitivityConvergence ? (
                  <p
                    className={`${typography.panelBody} text-text-body`}
                    data-testid="analysis-new-sensitivity-convergence"
                  >
                    {COPY.disclosure.convergence(sensitivityConvergence.label)}
                  </p>
                ) : null}
                {/* ⭐ THE THRESHOLD THE RUN FOUND, STATED. This array reached the
                    store already and this surface read it only through
                    `attestsNoFactorFlip` — the NEGATIVE attestation — so a row
                    the producer marked `found` rendered nowhere. Every number
                    and both names are the producer's; see `tippingPoints.ts`
                    for why the gate is `flip_reason` and not a non-null value. */}
                {sensitivityHeaderTips.map((t) => (
                  <p
                    key={`${t.factorLabel}:${t.flipValue}`}
                    className={`${typography.panelBody} text-text-body`}
                    data-testid="analysis-new-sensitivity-tipping-point"
                  >
                    {COPY.disclosure.tippingPoint(
                      t.factorLabel,
                      t.currentValue,
                      t.flipValue,
                      t.alternativeLabel,
                      t.unit,
                    )}
                  </p>
                ))}
              </>
            ) : null
          }
          /* ⭐ THE COLUMN'S CAPTION, SAID ONCE — and gated on there BEING a
             column. A caption describing bars renders only where at least one
             row drew one; on a run whose rows carry no measurement it would be
             furniture describing nothing, which is the same defect as the
             per-row label it replaces, one level up. */
          caveat={
            sensitivityFindings.some((f) => f.flipFraction !== undefined)
              ? COPY.disclosure.flipCaption
              : null
          }
          preview={ANALYSIS_NEW_LIMITS.UNCERTAINTY_PREVIEW}
          emptyMessage={null}
          onFocusTarget={focusTarget}
          onReviewTarget={onReviewTarget}
          onRunIntervention={runIntervention}
          onAskOlumi={askOlumiAbout}
          icon={GitBranch}
          testId="analysis-new-sensitivity"
          /* Closed at rest, as this zone's note says. Measured 25 Sep 03:00Z on
             a permitted pricing run: its one finding opened itself (323px at
             1440, 387px at 290) and pushed "Move towards commitment" to the
             fold and the chart below it. */
          opensForOneFinding={false}
        />
        ) : null}
        </>
        )}
        </div>
        {vm.status.isPreRun ? null : (
        <div className="space-y-2" data-testid="analysis-new-zone-answer-group">
        {/* ⭐ A ZONE LABEL — the approved prototype's grammar. It names a GROUP
            of blocks, so it carries no border, no fill and no radius of its
            own: furniture that looked like a block would add the weight this
            change exists to remove. Sized and coloured as `panelMeta`, the
            quietest of the panel's three sizes. */}
        {/* V2: no separate zone label here — the commitment block below carries
            the zone's heading ("Move towards commitment") with its own acts. */}
        {renderGlance('status')}
        {/* ⭐⭐ THE PRODUCER'S OWN SENTENCE ABOUT HOW FAR THE RANKING HELD —
            reachable on this tab for the first time. `robustness_caveat` rides
            `results.report.decision_brief`, which the browser already holds; it
            had exactly one consumer estate-wide and that consumer mounts only on
            the parked tab.

            ⚠⚠ GATED ON THE LEADER AUTHORITY, REQUIRED AND NEVER DEFAULTED. It is
            a LEADER-RANKING member: CEE strips it on a withheld turn, so its
            presence must never be read as licence to speak about a ranking. The
            value is quoted from the view model's single call, not re-derived.

            ⚠ AND HANDED THE VERDICT SENTENCE ALREADY ON SCREEN, so it cannot say
            the same thing twice — the defect `ModelHeldUp` records having shipped
            when it quoted `display_verdict_reason` beside a glance that already
            did. Different wire fields, but the reader sees only the words. */}
        {/* ── WHAT'S CHANGED ────────────────────────────────────────────────
            ⭐ DIRECTLY UNDER THE GLANCE, BECAUSE IT QUALIFIES THE READING THE
            GLANCE JUST GAVE. A person who changed something and re-ran arrives
            asking "did that do anything?", and the glance answers a different
            question — it describes THIS result, not its relationship to the last
            one. Put below the fold this would be a footnote on a reading already
            made (the placement rule this file states at the warning strips).

            It renders on re-runs only: the producer emits no delta on a first
            run, and absence renders nothing at all. */}
        {/* ⭐⭐⭐ WHAT MATTERS MOST READS FIRST — Paul's ruling, 18 Sep 2026.
            "Take option (d) — reorder so drivers come first."

            ⛔ THE FOLD WIN FROM #1665 WAS WORTH ±20px OF RUN CONTENT. Measured
            on three deployed states at 1600×1000 (fold 869): a fresh withheld
            run cleared it by +17px; #1668's touch-target repair took that to
            +10px; and after one estimate and a re-run it was **−3px, BELOW the
            fold**. A bar item that depends on which factors a reader happens to
            have estimated is not met, it is lucky.

            ⭐ THIS REORDER COSTS NO HEIGHT AND BUYS 366px OF MARGIN. Measured
            by moving the node on the deployed build before writing this: the
            drivers' bottom goes 858 → 491 against the same 869 fold — **+12px
            of margin becomes +378px** — and the options comparison stays above
            it (bottom 778, +91px). No copy, no behaviour, no new element.

            ⚠ AND THE HONEST LIMIT, MEASURED AT A SECOND VIEWPORT: at 1440×860
            (fold 729) the answer zone EXCEEDS the viewport and this becomes an
            either/or — drivers +238px above, options −49px below. So this does
            not "solve" the fold; it decides WHICH of the two sits above it, the
            way Paul's earlier ruling already did. Shortening the zone is the
            only route to having both on a 1440 laptop, and that is rowed.

            ⛔ IT GOES BEFORE THE WHOLE PAIR, NOT BETWEEN ITS HALVES, AND THAT
            IS NOT A PREFERENCE. `answerBlock` binds `ModelImplication` to
            `OptionsComparison` because "every claim moves with its
            entitlement" — splitting them is what once put a withheld claim on
            screen. Inserting between them would be exactly that split, so the
            only placement that respects the binding is above both. */}

        {/* ⭐⭐ THE ANSWER, ALWAYS HERE. This used to render in one of TWO places
            depending on whether the glance withheld its figures — promoted to
            the top on a withheld run, and fifteen blocks down otherwise. The
            conditional was solving the right problem in the wrong direction:
            "how the options compare" and "what your model implies" ARE the
            answer, so they belong beside the glance on every run, not only on
            the runs where the glance had nothing to say.

            ⚠ THE PAIR STAYS BOUND. `answerBlock` carries `ModelImplication`
            and `OptionsComparison` together because the claim moves with its
            entitlement; splitting them is what put a withheld claim on screen
            before. Moving the fragment moves both. */}
        {answerBlock}
        {/* ⭐ V2: THE READING FOLLOWS THE ANSWER. The prototype has no reading above
            the chart; its stale row sits in the commitment block, above it. The
            glance's status ribbon therefore stays above "Move towards
            commitment" and its reading (the withheld reason and its act, the
            reading, the scope, the condition) moves here, so the chart and its
            qualifier reach the first screen (fidelity gap 1; #63 5825359499). */}
        {renderGlance('reading')}

        {/* ── HOW FAR THIS HOLDS ────────────────────────────────────────────
            One line where seven sections answered one question. It states the
            producer's verdict and routes to the method; it combines nothing and
            scores nothing. See `TrustLine` for why a single "trust score" is
            the one thing this must never render. */}
        {/* ⭐⭐ NO TRUST READOUT BEFORE A RUN — AND THIS IS NOT A REVERSAL OF
            "ABSENCE IS A STATE". `TrustLine`'s own header rules that a missing
            verdict must SAY the basis was never established rather than render
            nothing, and that ruling stands untouched for the case it was written
            about: a run that HAPPENED and returned no verdict. That is a fact
            about the analysis and the reader deserves it.

            ⛔ IT WAS ALSO FIRING WHERE NO RUN HAD HAPPENED AT ALL, and there the
            same words make a statement about a result that does not exist.
            Witnessed by Paul on his own manual test, 18 Sep 2026: the panel said
            "No analysis has run yet for this model" and then, on the same first
            screen, "How far this holds was not established · 0 checks ran ·
            0 open questions". "How far this holds" has no referent there, and
            the two zeros are the shape this estate's own rule refuses — a count
            of nothing read as a measurement of nothing.

            ⚠ TWO QUESTIONS UNDER ONE ABSENCE (trap 21). "The producer sent no
            verdict" and "there is no producer output" are different facts with
            different honest answers; `verdict === null` cannot tell them apart,
            so the caller — which knows the run state — makes the distinction and
            the component stays presentational, as every other section here is.

            ⚠ SCOPED TO THE PRE-RUN STATE ONLY. Every post-run path still renders
            it, including the no-verdict one. */}

        <WhatsChanged view={vm.whatsChanged} />

        <RobustnessCaveat
          leaderClaimPermitted={vm.leaderClaimPermitted}
          verdictReason={vm.atAGlance.verdict?.reason ?? null}
        />

        {/* ── THE MODEL HELD UP ─────────────────────────────────────────────
            ⭐ DIRECTLY UNDER THE GLANCE, and it renders on almost no runs —
            which is the point. It is the panel's TERMINAL state: when the model
            holds up, every section below has nothing to say and the surface
            goes quiet at exactly the moment the team should be handed their
            decision. Placed after the reading it concludes, never before it. */}
        <ModelHeldUp
          /**
           * ⛔⛔ THESE TWO WERE MISSING AND THE DEFAULTS WERE DOING REAL WORK.
           * `ModelHeldUp` consults `useRobustnessCaveatOnScreen` so the two
           * trust surfaces cannot contradict each other. That hook needs the
           * SAME two inputs `RobustnessCaveat` is given four lines up — and this
           * mount passed neither, so it fell back to `leaderClaimPermitted =
           * true` on every run.
           *
           * The consequence was the exact failure the fix exists to prevent,
           * inverted: on a WITHHELD run the caveat correctly renders nothing,
           * while this section believed one was on screen and silenced itself —
           * so the reader got NEITHER statement. My spec passed
           * `leaderClaimPermitted={false}` explicitly and was green; the product
           * used the default. A guard that supplies what the mount omits tests
           * the component and not the product (CLAUDE.md trap 3b's shape).
           *
           * ⚠ QUOTED FROM THE SAME TWO EXPRESSIONS `RobustnessCaveat` reads, not
           * recomputed — two spellings of one question is how this pair came to
           * disagree in the first place.
           */
          leaderClaimPermitted={vm.leaderClaimPermitted}
          verdictReason={vm.atAGlance.verdict?.reason ?? null}
          verdictTone={vm.atAGlance.verdict?.tone ?? null}
          /* ⚠⚠ BOTH LIMBS, AND THE FIRST IS WHAT KEEPS THIS HONEST. "Assessed,
             none found" and "never assessed" both produce an empty array, and
             congratulating a team on a model whose evidence was never examined
             is a lie told in the surface's most confident voice. */
          evidenceAssessed={vm.uncertainty.evidenceAssessed}
          gapCount={vm.uncertainty.findings.length}
          isStale={vm.status.isStale}
          isPreRun={vm.status.isPreRun}
          /* ⚠⚠ THE FIFTH LIMB, from independent review. `AtAGlance` directly
             above renders `missingResults` on a provisional run — without this
             the panel names the results that did not come back and then
             congratulates the reader on the model, in that order. */
          isProvisional={vm.status.isProvisional}
          /* ⚠⚠ `onRecord={openDecisionRecord}` STOOD HERE AND HAS MOVED DOWN.
             The banner's predicate answers "did this model hold up?"; the act
             answers "may I write down what we chose?" — and hanging the second
             off the first made recording a decision reachable ONLY on a run
             that held up, which is backwards (CLAUDE.md trap 21). The act is
             now the section directly below, on its own gate. */
          testId="analysis-new-held-up"
        />

        {/* ── WHAT MOVES THE OUTCOME, AFTER THE ANSWER (Reasoning V2, 24 Sep 2026)
            It stood in the Challenge zone, above the answer: closed at rest, but
            its header row plus the zone gap were part of what put the options
            chart below the fold on served `c5000550`. What the answer turns on
            is still read FIRST — the challenge's "Top drivers" signal rows — and
            the full chart (drivers, value of information, receipts) follows the
            answer it explains, still closed, still post-run only. "What would
            change your mind" did NOT move: it stays in the challenge. */}
        {vm.status.isPreRun ? null : (
        <>
        {/* ── WHAT MOVES THE OUTCOME ────────────────────────────────────────
            ⭐⭐⭐ MOVED INTO THE ANSWER ZONE, 17 Sep 2026, ON PAUL'S RULING.

            Against Paul's own acceptance bar — *"a user opens the Reasoning
            panel and immediately understands the decision, the current state of
            the reasoning, what Olumi can and cannot responsibly conclude, WHAT
            MATTERS MOST, and what they can do next"* — this was the one question
            of six the panel could not answer in the first viewport.

            Measured on deployed `66854e6c`, guest, an answered run at 1600x1000,
            panel box 869px: the decision at 20 · the state of the reasoning at
            177 · what it CAN conclude at 185 · what it CANNOT at 542 · what to
            do next at 355 — and **this section's title at 1118, 249px below the
            fold** (358px on a stale run, which carries the ribbon). It sat in
            ZONE: FURTHER, below "Coaching and method", second from last.

            ⛔ THE RATIONALE THIS REPLACES IS RECORDED RATHER THAN DELETED,
            because it was reasoned and it is what made me refuse to move this
            on my own reading. It said: *"The last group: what the answer turns
            on, what is worth resolving before committing, and the method
            receipts. All three are DETAIL a reader goes looking for — none of
            them is something the panel needs to say unprompted, and stacked
            open they were most of the length Paul was scrolling through."*

            That is a density argument, and it was right about the length. What
            it got wrong is the classification: Paul ruled that "what matters
            most" MEANS the drivers — what the answer turns on — not the
            recommended next move. A reader who has to scroll for that is
            scrolling for part of the answer. **The section still rests CLOSED,
            so the density argument is honoured: this costs 61px, not the
            stacked-open length that argument was written against.**

            ⚠ PLACED AFTER THE CAVEAT AND BEFORE "WHAT WOULD CHANGE YOUR MIND",
            and the position was measured rather than preferred. Both candidate
            positions clear the fold; this one reads in the right order — here is
            the answer, how far it held, what moves it, what would change it —
            and gives the drivers the higher of the two slots, which is what the
            ruling asks for.

            ⚠ THE TRADE, STATED: on a STALE run the ribbon costs 44px and
            "What would change your mind" then ends 22px below the fold. The
            ruling buys the drivers that space. Measured, not hidden. */}
        {whatMovesHasContent ? (
          <SectionShell
            title={COPY.sections.whatMovesTheOutcome}
            /* ⛔ A COUNT IS A PROMISE. This read
               `findings.length + influenceRows.length` and so advertised 4 while
               holding TWO factors — witnessed on deployed `219209ad`. The two
               lists are one-to-one by this codebase's own stated invariant ("a
               row can never appear without its bar"), so adding them double-counts
               every driver. Counted as SUBJECTS, by union, so a future divergence
               grows the number honestly instead of hiding inside it.
               ⭐ TAIL-1 (panel-lane design audit 2026-09-25): the badge no
               longer draws (variant="disclose" drops it), but the count still
               reaches `data-section-count` on the wrapping <section> —
               "the count is always carried here, whether or not the badge
               draws" (SectionShell's own doc). */
            count={distinctDriverSubjects(vm.drivers.findings, vm.drivers.influenceRows)}
            testId="analysis-new-what-moves-the-outcome"
            /* ⭐⭐ TAIL-1: the prototype's tail door is `.disclose` — a chevron
               and one line, no icon slot, no subtitle and no count badge (the
               auditor's citation: aboutHTML()/insightsHTML() disclosures carry
               none of those). `COPY.sectionSubtitles.whatMovesTheOutcome`
               (analysisNewCopy.ts) stops being RENDERED here, deliberately —
               the constant itself is kept, unread, so the file's line count
               (and the ui-decides-baseline.txt keying pinned to it) is
               unchanged. */
            variant="disclose"
          >
          {/* ── DRIVERS AND DYNAMICS ────────────────────────────────────────── */}
          {/* V2 gap 23: this section is NESTED inside the "What moves the
              outcome" SectionShell above, so its own SectionShell used to
              repeat the identical h3/panelHeader grammar one level down — the
              "Top drivers rows sit directly above a 'What moves the outcome'
              header with a nested 'Drivers and dynamics' header" gap.
              `headingLevel="label"` drops the nested heading tag entirely (not
              just its weight — see `SectionShell`'s doc for why a visual-only
              demotion would not have closed this); content, count, rows and
              every testid are unchanged. */}
          <AnalysisNewSection
            title={COPY.sections.drivers}
            subtitle={COPY.sectionSubtitles.drivers}
            headingLevel="label"
            findings={vm.drivers.findings}
            preview={ANALYSIS_NEW_LIMITS.DRIVER_PREVIEW}
            // ⚠ The caveat is a function of the PRODUCER's provenance token, not
            // of taste: a set-relative influence is "largest in this set", never
            // a causal share of the outcome.
            caveat={driverCaveatParts.sectionCaveat}
            // ⚠⚠ THREE STATES, THREE SENTENCES — ONE SENTENCE FOR ALL THREE WAS
            // A LIVE FALSEHOOD. A run whose factors all came back with a producer
            // `zero_reason` DID return influence and measured it at zero, and was
            // told the run returned nothing — in the same words as a run that
            // genuinely returned nothing. The two were indistinguishable.
            //
            // ⚠ THE ORDER IS LOAD-BEARING AND `driversStatus` IS NOT THE FIRST
            // TEST. `useResultsSectionData.ts:3235` defaults `drivers_status` to
            // 'computed' when absent on the V5 path, so 'computed' does NOT imply
            // rows were returned; keying the zero claim on it would manufacture
            // the MIRROR falsehood on a rows-empty run. `suppressedZeroCount` is
            // the sufficient one — it is non-zero only because the producer sent a
            // row it had scored at zero.
            emptyMessage={driversEmpty}
            onFocusTarget={focusTarget}
            onRunIntervention={runIntervention}
            onAskOlumi={askOlumiAbout}
            icon={TrendingUp}
            testId="analysis-new-drivers"
            /* ⭐ THE ONLY CHART ON THIS PANEL, AND IT SITS INSIDE THE SECTION
               WHOSE QUESTION IT ANSWERS rather than becoming a tenth heading.
               The consolidation that took this panel from fourteen elements to
               six is the reason: a chart and the prose about the same drivers are
               one subject, and splitting them would re-open the restatement the
               consolidation closed. */
            header={
              <DriverInfluenceChart
                rows={vm.drivers.influenceRows}
                onFocusTarget={focusTarget}
                scaleNote={driverCaveatParts.scaleNote}
                topRowNote={driverCaveatParts.topRowNote}
                /* ⚠ THE THREE OUTCOMES KEEP THEIR THREE SENTENCES. The chart
                   reports which of them happened and this surface owns the
                   words — the same vocabulary the model strip's editor uses,
                   because it is the same write through the same authority. */
                onCommitOutcome={(outcome) =>
                  showToast(
                    outcome === 'dispatched'
                      ? COPY.modelStrip.valueDispatched
                      : outcome === 'local_only'
                        ? COPY.modelStrip.valueLocalOnly
                        : COPY.modelStrip.valueNotEncodable,
                  )
                }
                testId="analysis-new-driver-chart"
              />
            }
          />


          {/* Whole-decision value of information — a VERDICT, never the number.
              'not_computed' renders nothing: it is a distinct state from a
              measured zero and must not be collapsed into one.

              ⭐⭐ THE LABEL IS THE FIX, AND IT IS A TOPIC RATHER THAN A CLAIM.
              This shipped as a bare `<p>` at the body's TOP LEVEL, between two
              accordions, with no heading — so the sentence's subject was never
              named. "This run did not come back at zero" leaves a reader asking
              *what* did not come back at zero, and the answer was nowhere on
              screen. Witnessed on staging `e685dafa`.

              ⚠ THE SENTENCE ITSELF IS UNCHANGED, DELIBERATELY. It answers to
              `UNLICENSED_SIGNIFICANCE_CLAIMS` — `decision_evpi` arrives with no
              noise floor, no CI and no `n_samples`, so a small positive is not
              distinguishable from estimator noise and NOTHING here may say the
              value MEANS anything. The label names the measure, which is the
              owner's own vocabulary (`RESOLVE_NEXT_COPY.note` — "value of
              information"), and it is checked against the same imported ceiling
              by `analysisNewCopyCeiling.spec.ts`.

              ⚠ AND IT TAKES `WhatWeChecked`'S SHELL RATHER THAN A NEW ONE. A
              third micro-section shape on a panel already criticised for
              inconsistency would be the defect, not the fix. */}
          {vm.uncertainty.decisionVoi !== 'not_computed' ? (
            <section
              className="border-t border-panel-border pt-3"
              data-testid="analysis-new-decision-voi-section"
              aria-labelledby="analysis-new-decision-voi-heading"
            >
              {/* V2 gap 23: WAS an h3/`panelHeader` — an orphan THIRD section
                  title nested inside "What moves the outcome", below "Drivers
                  and dynamics". Demoted to a plain `<p>` at the same quiet
                  `panelMeta` weight the nested driver label now uses: not a
                  heading at all, so it does not compete with the section's
                  own h3 in a screen reader's heading navigation, and it reads
                  as a sub-part of the section it sits in rather than a peer
                  of it. `id`, `data-testid` and the `aria-labelledby` link on
                  the wrapping `<section>` are unchanged, so the region keeps
                  the same accessible name. */}
              <p
                id="analysis-new-decision-voi-heading"
                className={`${typography.panelMeta} text-text-header mb-1`}
                data-testid="analysis-new-decision-voi-heading"
              >
                {COPY.decisionVoi.label}
              </p>
              <p
                className={`${typography.panelMeta} text-text-light m-0`}
                data-testid="analysis-new-decision-voi"
              >
                {vm.uncertainty.decisionVoi === 'measured_non_zero'
                  ? COPY.decisionVoi.measuredNonZero
                  : COPY.decisionVoi.measuredZero}
              </p>
            </section>
          ) : null}

          {/* ── LEVEL 3 ─────────────────────────────────────────────────────── */}
          </SectionShell>
        ) : null}
        </>
        )}


        </div>
        )}

        {/* ── FOCUS NOW, AFTER THE ANSWER (Reasoning V2, 24 Sep 2026) ─────────
            ⚠ REVERSES Paul's 18 Sep "make it first-screen". The methods that
            instruction was about now live in the MethodStrip at the top; what is
            left here is `FocusNowContainer`'s run-specific nudges ("Strengthen
            your model · Add an outcome you care about"). The V2 prototype has no
            such block between the model and the challenge, and on served
            `c5000550` it was 108px of what kept the chart below the fold. */}
        {focusApplicableIds.length > 0 ? (
          <div className="pt-3 space-y-3" data-testid="analysis-new-zone-focus-group">
            {/* ⭐ A ZONE LABEL — the approved prototype's grammar. It names a
                GROUP of blocks, so it carries no border, no fill and no radius
                of its own: furniture that looked like a block would add the
                weight this change exists to remove.
                ⭐ V2 (fidelity gap 10): a SECTION TITLE, the same class string
                as "Challenge the thinking" (gap 16). As an 11px caption over
                14px rows it read as a footnote to its own items. */}
            {/* ⭐ SPACE-1 (panel-lane design audit 2026-09-25): this zone has no
                preceding rule, so its title's former pt-3 is relocated onto
                this group unchanged — a byte-for-byte visual no-op here — so
                the title's own className stays identical to the also-zone
                title's, which theFocusZoneHasASectionTitle.spec.tsx pins. */}
            <h3
              className={`${typography.panelHeader} text-text-header m-0`}
              data-testid="analysis-new-zone-focus"
            >
              Focus now
            </h3>
            {/* ⚠ THE RUN'S OWN NUDGES COME FIRST WHERE THEY EXIST. They are
                specific to THIS model; the methods are always available. A
                reader who has a run-specific prompt should meet it before the
                general shelf — prominence for the shelf was the instruction,
                not precedence over the run. */}
            {focusApplicableIds.length > 0 ? (
              <FocusNowContainer applicableStaticIds={focusApplicableIds} bare />
            ) : null}
          </div>
        ) : null}

        {/* ── STRENGTHEN THE REASONING ──────────────────────────────────────
            ⭐⭐ DIRECTLY UNDER THE GLANCE — MOVED HERE FROM SEVENTH OF TEN.
            The standing explanation for this tab's incoherence was that "the
            panel coaches you until you press Analyse, then switches to
            reporting". Derived at the bytes, that is FALSE:
            `strengthen:success-measure` gates on `goalThreshold == null`, not
            on the run completing, so it fires PRE-RUN, and post-run the
            coaching gets RICHER (one card becomes five). The coaching never
            stops. It was BURIED — seventh of ten mounts, below the ranked
            options and below Key insights.

            The order this restores is the reading order the surface always
            claimed: WHAT HAPPENED (the glance) → WHAT TO DO ABOUT IT (this) →
            THE DETAIL (everything below). `AtAGlance` stays above because it
            is the five-second read and this section is a RESPONSE to it —
            coaching that arrives before the finding it answers has no subject.

            ⚠ SCOPE, STATED SO IT IS NOT INHERITED AS MORE THAN IT IS: this is
            a MOVE and nothing else. No section is renamed, merged, deleted,
            restyled or re-scoped here. The consolidation proper — the four
            slots in `2-consolidation-map.html` — is a separate decision, and
            mixing it into this commit would make both unjudgeable. Order is a
            property of THIS file, so it is pinned in this file's own spec
            (`AnalysisNewTabBody.spec.tsx`, "the coaching sits directly under
            the reading it responds to"); no per-section spec can see it. */}

        {/* ⚠ THE PROMOTED RECOMMENDATION IS NOT EXCLUDED, AND THAT IS A KNOWN
            DUPLICATION rather than an oversight — recorded here because the
            obvious fix is wrong.

            ⚠ AMENDED 7 Sep 2026 — THE `signal` REPEAT IS CLOSED; THE ITEM
            REPEAT IS NOT. Superseded text: ~~`glancePrimary` lifts one
            intervention into the glance card and nothing removes it from this
            list, so the producer's `signal` — a long sentence — renders TWICE
            in one panel, at 11px in the glance and 12px here.~~ The
            `primaryIntervention` call site above now hands the card
            `title: glancePrimary.title`, and the card's prop type
            (`AtAGlance.tsx:129-154`) has no `signal` field, so the card cannot
            print the paragraph.

            The capture below is kept as the record of the build it was taken
            on — it is history from this date, not current behaviour. Witnessed
            on the deployed build `b14cd478` (guest, 291px dock, completed run,
            every section expanded): "The ordering holds in about 68% of
            variations, but is exposed to uncertainty around how your largest
            accounts would react to usage pricing." — verbatim, in
            `analysis-new-glance-primary-intervention` and again in
            `analysis-new-strengthen-why`.

            Still true, and why this comment stays: `glancePrimary` is not
            removed from this list, so the finding's `title` heads both the
            glance card and a row here.

            ⚠⚠ FILTERING THE PROMOTED ROW OUT WAS TRIED AND REVERTED. On a run
            with exactly ONE intervention it empties this section completely —
            `AnalysisNewTabBody.spec.tsx`'s "a grounded intervention reaches the
            screen through the real engine" REDs, and a section that renders
            zero rows is a worse outcome than a repeated sentence. Any real fix
            has to decide what the glance card owns versus what this list owns,
            which is an IA decision for the design pack
            (`2-consolidation-map.html` slot "Focus now"), not a filter. */}
        {/* ⭐⭐ PRE-RUN THIS SECTION OPENS, AND IT IS THE ONLY ONE THAT DOES.
            Derived at this render path on `staging` `3b2df4ce`: pre-run the
            panel's entire text ended "…Pick a mark to show that part of the
            model on the canvas. Strengthen the reasoning1" — a collapsed row,
            a bare count, and not one word of the finding behind it.

            What is behind it is the thing the reader needs most in that state.

            ⚠ NOT "EXACTLY ONE" — that is what this comment used to claim, and
            it is refuted twice in this repo. The pre-run list is SHORT, not
            single-item: `strengthen:broaden` is gated on
            `inputs.biasFindingTypes` and NOT on `analysisComplete`
            (`buildRecommendations.ts:629`), and the producer's own coaching
            blocks are promoted onto the same list — both fed from the
            draft-coaching and phase-3 channels, which carry before any run
            (`biasTypesFromGuidance.ts`). `strengthenOpensPreRun.spec.tsx`
            measures the pre-run count at 2 with one producer block seeded.

            The count is not what carries the argument; UNIQUENESS is. The
            success-measure recommendation is the one the engine grounds from
            the MODEL rather than from a run (`buildRecommendations.ts`, and
            `StrengthenTheReasoningProps.analysisHash` already documents the
            state), it is present pre-run whenever the target is unset, and it
            is the ONLY surface on this tab that says what the gap COSTS:
            "Without a target the analysis cannot say how likely each option is
            to succeed, only how they compare with one another."
            `successTargetAskedOnce.spec.tsx` argues exactly that when it keeps
            this row while removing the glance's. The strip's "Set a target"
            control states the gap; only this says why it matters. It was built,
            grounded, counted — and put behind a click nothing gave the reader a
            reason to make. Everything else the pre-run list can carry is
            additional reason to open it, never a substitute for that row.

            ⚠ SCOPED THREE WAYS, because the collapsed IA is a MEASURED budget
            (`SectionShell`'s header: 1,584px against a 769px viewport) and not
            a default nobody thought about:
              · pre-run only — a displayed run is unchanged;
              · only when there is a finding — a forced-open empty state spends
                a viewport on an absence the collapsed row already states;
              · a DEFAULT, not a lock — the toggle owns the state afterwards.

            ⚠⚠ AND IT IS A DEFAULT ONLY — THE SECTION IS NOT FORCED SHUT AGAIN
            WHEN THE RUN LANDS. An earlier cut of this change re-keyed the
            component on `isPreRun` so `SectionShell` would re-read the default
            and collapse. That was measured and REVERTED, because it discarded
            the reader's work: `SectionShell` unmounts a closed region, and this
            section's "I disagree" composer holds UNSAVED text. Driven at this
            render path — open the composer pre-run, type, complete a run — the
            keyed version lost the draft while pristine kept it.

            It was also INCONSISTENT. A section the reader opened BY HAND
            already survives that transition, because nothing remounts; the key
            would have made a section opened by DEFAULT behave differently from
            the identical section opened by the identical toggle. One control,
            two behaviours.

            So the state belongs to the toggle after mount, which is
            `SectionShell`'s own rule, and the post-run panel is exactly what it
            is today for a reader who opened this section themselves. The
            collapsed IA is unchanged for everyone who lands on a completed run,
            which is the state its 1,584px measurement was taken in. */}
        {/* ⭐⭐ THE CONSIDER-THE-OPPOSITE ACT IS FED THE RUN'S OWN REVERSAL
            CONDITION, and it is the SAME object the glance renders as "Could
            change if …" — not a second derivation of it. `glanceCondition`
            already chose which producer flip row is the one; a mount that
            picked its own would be the two-choosers defect `selectFlipRisk`'s
            header exists to end, and the two surfaces could then disagree about
            which factor the run said turns the ordering.

            ⚠ `vm.atAGlance.condition` IS NULL PRE-RUN (the pre-run arm nulls
            every glance field), so the act cannot appear before there is a run
            to be about. That is the correct gate and it is inherited rather
            than restated here. */}
        {/* ⚠ ONE BLOCK, NOT TWO — AND THE RATCHET IS WHY I LOOKED FOR ONE.
            Mounted loose, the menu took the panel from 8 top-level blocks to 9
            and `thePanelCannotRegrow` REDded by name. The ceiling was the right
            question to be asked: the acts belong TOGETHER, so the answer was a
            shared wrapper rather than a raised ceiling. What the run suggests
            and what you can ask for regardless are one zone. */}
        {/* ── THE TAIL FOLDS INTO ABOUT (V2 fidelity gap 24, 24 Sep 2026) ──
            ⛔ THE "If you want to go further" ZONE IS GONE, and with it its label
            and both group shells ("Coaching and method", "How this was worked
            out"). The prototype's `reasoningHTML()` ends
            `${challengeHTML()}${commitHTML()}${aboutHTML()}`: nothing sits
            between "Move towards commitment" and About, and the whole tail at
            rest is one quiet line.

            ⭐ NOTHING THE READER COULD REACH HAS BECOME UNREACHABLE. Every block
            the two shells held is handed to About as `folded` — the SAME
            components with the SAME gates, props, testids and acts — so a block
            that was one click away (its group's toggle) is one click away (About's
            toggle). The gates are the shells' own expressions, unchanged:
            `coachingHasContent` for the grounding and key insights,
            `methodHasContent` for "Uncertainty and gaps", and the register's own
            `useWhatIWasGivenWillRender` for itself.

            ⚠ WHAT THIS DELIBERATELY DOES NOT DO — gap 24's reviewer ruled each a
            product decision, not presentation: it does not drop Key insights,
            does not move the bias grounding into the Challenge card's "Why
            this?" basis, and does not put the input register (and its value-edit
            control) behind an extra text button. */}
        <AboutThisAnalysis
          vm={vm}
          nSamples={nSamples}
          seedUsed={seedUsed}
          outcomeFormat={{
            unit: resultsSectionData.recommendation.outcomeUnit,
            symbol: resultsSectionData.recommendation.outcomeUnitSymbol,
            isNormalised: resultsSectionData.recommendation.isNormalised,
          }}
          offerFactorValueControl={true}
          onAsk={openAskOlumi}
          foldedHasContent={foldedHasContent}
          folded={
            foldedHasContent ? (
            <>
              {coachingHasContent ? (
                <>
                {/* ── WHERE THESE CHECKS COME FROM ─────────────────────────────────
                    ⭐⭐ THE MOST SCIENCE-GROUNDED PAYLOAD THE PRODUCER SENDS, AND IT HAD
                    NO RENDERER ANYWHERE. `analysis_ready.bias_findings[]` carries a
                    `mechanism`, a `citation` and a costed `micro_intervention`; derived
                    at `08a3724d` with contrast controls, `mechanism` had zero product
                    renderers, `citation` had zero readers of any kind, and
                    `estimated_minutes` had none either. The transport drops nothing:
                    `client.ts:302` assigns `analysis_ready` wholesale with no zod and
                    no key allowlist, `bias_findings` is absent from the pinned contract
                    entirely, and `store.ts:6095` stores the object as it arrived.

                    ⚠ IT SITS DIRECTLY UNDER "WHAT WE CHECKED" BECAUSE IT ANSWERS THE
                    NEXT QUESTION. That section says what the run looked at; this says
                    what the looking rests on, and the pairing is the reason a reader
                    can check the science instead of trusting it.

                    ⛔ IT NEVER NAMES A BIAS. The producer's `code` is read for nothing:
                    the mechanism, the technique and the paper are the product, and a
                    classification handed back to the reader is a diagnosis of them
                    (#1438's register, which this matches).

                    Renders NOTHING when the producer sent no grounding — pre-run,
                    on a run with no findings, and on findings that carried none of the
                    three fields. Absence produces silence, never a placeholder. */}
                <BiasGrounding items={biasGroundingItems} />

                {/* ── KEY INSIGHTS ────────────────────────────────────────────────── */}
                <AnalysisNewSection
                  title={COPY.sections.keyInsights}
                  findings={vm.keyInsights.insights}
                  preview={ANALYSIS_NEW_LIMITS.KEY_INSIGHT_PREVIEW}
                  // ⚠ "No insight is grounded well enough to lead with yet" is FALSE
                  // when the run DID produce insights and the glance is simply stating
                  // them — witnessed on a real run, where the glance carried all three
                  // and this line then contradicted the surface directly above it. An
                  // empty list with a non-zero candidate count means "shown above", so
                  // the section renders nothing at all rather than a claim that is not
                  // true. The honest empty state survives for a run that genuinely
                  // produced none.
                  emptyMessage={keyInsightsEmptyMessage}
                  onFocusTarget={focusTarget}
                  onRunIntervention={runIntervention}
                  onAskOlumi={askOlumiAbout}
                  icon={Star}
                  testId="analysis-new-key-insights"
                />
                </>
              ) : null}
                {/* ⭐ THE SEVENTH TRUST SECTION, JOINING ITS SIX SIBLINGS. "What you
                    gave me, and what I did with it" answers the same question as the
                    checks and the gaps — how far can I trust this? — and it was the last
                    one still standing at top level, between the act and the reader. */}
                {/* ── WHAT YOU GAVE ME, AND WHAT I DID WITH IT ──────────────────────
                    ⭐ LIFTED FROM THE OLD ANALYSIS TAB, WHERE IT WAS THE ONE SURFACE
                    THAT NAMES A CONCRETE GAP IN THE USER'S OWN INPUT — "1 of 2 figures
                    you mentioned aren't in the model yet". A driven comparison of both
                    tabs on one completed run found it absent here (accordions opened,
                    positive control firing at 6151 chars), and this is the mount.

                    ⚠ IT IS A LIFT, NOT A COPY. The component reads its own store and
                    enforces its own identity gate (it once rendered a PREVIOUS
                    decision's brief verbatim), so re-implementing it for this tab would
                    fork both the gate and the manifest vocabulary — the twin defect
                    this estate keeps paying for. One component, two mounts.

                    ⚠ PLACED DIRECTLY ABOVE STRENGTHEN, not with the model strip. It is
                    a WORKLIST — every row is something to validate or add, and its
                    "Add this" starts the conversation to include a figure. That makes
                    it kin to the coaching below it, not to the census above it. Putting
                    it under the strip would have pushed the answer below the fold, and
                    the reading order this panel restored is WHAT HAPPENED → WHAT TO DO
                    ABOUT IT → THE DETAIL. */}
                {/* ⭐ THE GRAMMAR IS OPT-IN AND ONLY THIS TAB OPTS IN. `ResultsBody` on
                    the PARKED Analysis tab mounts the same component and keeps its
                    existing rendering — see the prop's declaration for why the default
                    may not move. */}
                {/* ⭐ AND THIS TAB IS THE ONE THAT OPTS IN TO THE VALUE CONTROL on
                    "what I estimated". The register stated "The numbers behind these
                    are mine, not yours. If you have better ones, tell me and I'll use
                    them." over a list with no way to tell it — an invitation with no
                    means of accepting it. The control is the proven factor-value edit
                    (`useFactorValueCommit`), bound to each row by the `node_id` CEE
                    itself supplies. It is opt-in so the PARKED Analysis tab does not
                    acquire a writer — see the prop's declaration. */}
                <WhatIWasGivenSection
                  ref={whatIWasGivenRef}
                  onSendMessage={onSendMessage}
                  useSurfaceGrammar={true}
                  /* ⚠ THE SAME CONSTANT THE AVAILABILITY READ ABOVE USES, not a second
                     `true`. Two literals for one opt-in would let the refusal's act
                     believe this register offers an edit on a build where it does not
                     (CLAUDE.md trap 12). */
                  offerEstimatedValueControl={REASONING_TAB_EDITS_ESTIMATES}
                />
              {methodHasContent ? (
                <>
                {/* ⭐⭐ §4 — ONE PLACE FOR WHAT THE RUN COULD NOT SETTLE.
                    Measured on a reconstruction of the run Paul screenshotted: EIGHT
                    "could not establish" statements, and only two of them anything
                    like duplicates. They are NOT redundant — which is why this is a
                    re-composition and not a cull. What made them a drain is that one
                    category of information lived in SIX places: both warning strips,
                    the glance ribbon, this readout, the section below, and the value-
                    of-information line eleven sections further down.

                    ⚠ THE TOP STRIPS DO NOT MOVE. `mounts the warning strip ABOVE the
                    glance, not below the sections` pins them there and it is right:
                    an engine critique qualifies the whole run, so a reader must meet
                    it before the reading it qualifies. This joins the two that were
                    merely far apart, and leaves the ruled positions alone.

                    ⚠ ORDER CONSTRAINTS CHECKED, NOT ASSUMED: Strengthen still
                    precedes both (`keeps the coaching above every detail section`),
                    and `analysis-new-sensitivity` still precedes uncertainty. */}
                {/* ── UNCERTAINTY AND GAPS ────────────────────────────────────────── */}
                <AnalysisNewSection
                  title={COPY.sections.uncertainty}
                  subtitle={COPY.sectionSubtitles.uncertainty}
                  findings={vm.uncertainty.findings}
                  preview={ANALYSIS_NEW_LIMITS.UNCERTAINTY_PREVIEW}
                  // ⚠⚠ THE EMPTY STATE HERE IS A TRUTH CLAIM AND IT SPLITS TWO WAYS.
                  // "Nothing was flagged" is licensed ONLY when the producer actually
                  // assessed evidence on this run; otherwise the honest sentence is
                  // that it was not assessed. An empty list cannot tell them apart —
                  // `evidenceGapsAssessed` can.
                  emptyMessage={uncertaintyEmptyMessage}
                  onFocusTarget={focusTarget}
                  onReviewTarget={onReviewTarget}
                  onRunIntervention={runIntervention}
                  onAskOlumi={askOlumiAbout}
                  icon={AlertTriangle}
                  testId="analysis-new-uncertainty"
                />
                </>
              ) : null}
            </>
            ) : null
          }
        />
      </div>
    </div>
  )
}
