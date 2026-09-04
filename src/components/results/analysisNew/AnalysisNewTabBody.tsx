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

import { useMemo } from 'react'
import { AlertTriangle, Wrench, Star, TrendingUp, GitBranch } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { openDecisionRecord } from '../modals'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import { ANALYSIS_NEW_LIMITS } from './buildAnalysisNewViewModel'
import type { AnalysisNewViewModel } from './analysisNewTypes'
import { useAnalysisNewViewModel } from './useAnalysisNewViewModel'
import { buildNodeInsights } from './nodeInsights'
import { buildModelStrip, stripRendersTargetAffordance } from './buildModelStrip'
import { useCanvasStore } from '../../../canvas/store'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../strengthen/buildRecommendations'
import { WhyNoAnalysisYet } from './sections/WhyNoAnalysisYet'
import type { GateBlockedListing } from '../../../canvas/utils/canRunAnalysis'
import { AnalysisNewSection } from './sections/AnalysisNewSection'
import { DriverInfluenceChart } from './sections/DriverInfluenceChart'
import { WhatIWasGivenSection } from '../contextIntegrity/WhatIWasGivenSection'
import { ModelStrip } from './sections/ModelStrip'
import { AtAGlance } from './sections/AtAGlance'
import { ModelHeldUp } from './sections/ModelHeldUp'
import { WhatWeChecked } from './sections/WhatWeChecked'
import { OptionsComparison } from './sections/OptionsComparison'
import { StrengthenTheReasoning } from './sections/StrengthenTheReasoning'
import { CritiqueWarningStrip } from '../CritiqueWarningStrip'
import { InferenceWarningStrip } from '../InferenceWarningStrip'
import { DeeperAnalysis } from './sections/DeeperAnalysis'

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
function driversEmptyMessage(vm: AnalysisNewViewModel): string | null {
  // Pre-run: nothing has been returned OR not returned. No claim either way.
  if (vm.status.isPreRun) return null
  // The producer sent rows and scored every one of them at zero.
  if (vm.drivers.suppressedZeroCount > 0) return COPY.empty.driversAllZero
  // The producer's own word for "I did not look" — distinct from having looked
  // and come back with nothing.
  if (vm.drivers.driversStatus === 'skipped') return COPY.empty.driversNotComputed
  // 'unavailable' / 'error' / a 'computed' that returned no rows all reduce to
  // the same fact, and this sentence states exactly it.
  return COPY.empty.drivers
}

export function AnalysisNewTabBody({
  resultsSectionData,
  isPreRun,
  isRunning,
  isStale,
  staleReason = 'unconfirmed',
  nSamples,
  seedUsed,
  responseHash,
  onFocusNode,
  onReanalyse,
  onSendMessage,
  blockedListing = null,
}: AnalysisNewTabBodyProps) {
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
  const nodeInsights = useMemo(
    () =>
      buildNodeInsights({
        interventions: vm.strengthen.interventions,
        drivers: vm.atAGlance.drivers,
      }),
    [vm.strengthen.interventions, vm.atAGlance.drivers],
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
  const stripOffersTarget = useMemo(
    () => stripRendersTargetAffordance(buildModelStrip(nodes ?? [])),
    [nodes],
  )
  const glancePrimary = useMemo(() => {
    const interventions = vm.strengthen.interventions
    if (!stripOffersTarget) return interventions[0] ?? null
    return (
      interventions.find((rec) => rec.id !== SUCCESS_MEASURE_RECOMMENDATION_ID) ?? null
    )
  }, [vm.strengthen.interventions, stripOffersTarget])

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
    })
  }

  return (
    <div
      className="flex-1 min-h-0 olumi-scrollbar overflow-y-auto"
      data-testid="analysis-new-tab-body"
      data-run-identity={responseHash ?? ''}
    >
      {/* The narrower measure (§11): wider gutters and a capped line length
          inside the unchanged 416px dock. */}
      <div className="px-4 py-4 space-y-4 max-w-[440px] mx-auto">
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
        {vm.status.isPreRun ? (
          <div className="space-y-1" data-testid="analysis-new-status-pre-run">
            <p className={`${typography.panelBody} text-text-body`}>{COPY.status.preRun}</p>
            <p className={`${typography.panelMeta} text-text-light`}>{COPY.status.preRunWhatThisIs}</p>
            {/* ⭐⭐ AND WHY IT HAS NOT — the half this state was missing. The two
                sentences above orient a reader who has not run one yet; neither
                says anything to the reader who TRIED and was refused, which on
                a saved model is the common case. Every line below is the run
                gate's own; see `WhyNoAnalysisYet`. */}
            <WhyNoAnalysisYet listing={blockedListing} onFocusTarget={focusTarget} />
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

        {/* ── WHAT THE ENGINE WARNED, ABOVE EVERYTHING IT QUALIFIES ────────
            ⚠ THE PLACEMENT IS THE POINT. #1039 gave these strips a consumer at
            all — they had NONE on this tab, because `CritiqueWarningStrip` is
            mounted by `ResultsBody`, which `OutputsDock` never mounts on the
            `analysisNew` branch. It landed them inside "Deeper analysis", i.e.
            at the BOTTOM.

            A caveat that arrives after the reading it qualifies has already
            been done is not a caveat, it is a footnote. The legacy tab puts
            them at the top and it is right to. Both render nothing when their
            set is empty, so a clean run pays nothing for this.

            They stay OUTSIDE any collapsible: a warning behind a toggle is a
            warning the reader has to already suspect in order to find. */}
        <CritiqueWarningStrip critiques={vm.deeper.critiques} className="mb-2" />
        <InferenceWarningStrip warnings={vm.deeper.caveats} className="mb-2" />

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
        <ModelStrip isPreRun={vm.status.isPreRun} insights={nodeInsights} />

        {/* ── AT A GLANCE — the 5-to-10-second read ───────────────────────── */}
        {/* ⚠ `driverTotal` is the RUN's non-zero driver count, not the
            glance's capped list — the glance shows at most three and must say
            so. `primaryIntervention` is the ENGINE's top recommendation,
            passed rather than re-derived: this surface never mints one. */}
        <AtAGlance
          glance={vm.atAGlance}
          onFocusTarget={focusTarget}
          isStale={vm.status.isStale && !vm.status.isPreRun}
          staleKind={vm.status.staleKind}
          isProvisional={vm.status.isProvisional}
          onReanalyse={onReanalyse}
          missingResults={vm.status.missingResults}
          driverTotal={vm.drivers.totalCount}
          primaryIntervention={
            glancePrimary
              ? {
                  id: glancePrimary.id,
                  label: glancePrimary.action.label,
                  why: glancePrimary.signal,
                  signalCode: glancePrimary.signalCode,
                }
              : null
          }
          onRunIntervention={runIntervention}
        />

        {/* ── THE MODEL HELD UP ─────────────────────────────────────────────
            ⭐ DIRECTLY UNDER THE GLANCE, and it renders on almost no runs —
            which is the point. It is the panel's TERMINAL state: when the model
            holds up, every section below has nothing to say and the surface
            goes quiet at exactly the moment the team should be handed their
            decision. Placed after the reading it concludes, never before it. */}
        <ModelHeldUp
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
          /* ⭐ THE REAL DECISION RECORD, not a chat prefill. `openDecisionRecord`
             already exists and is what the Strengthen section's own succeeded
             state commits through — routing this elsewhere would fork the one
             act the product treats as committing. */
          onRecord={openDecisionRecord}
          testId="analysis-new-held-up"
        />

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
            defect this panel has already shipped. */}
        <AnalysisNewSection
          title={COPY.sections.sensitivity}
          findings={vm.sensitivity.findings}
          preview={ANALYSIS_NEW_LIMITS.UNCERTAINTY_PREVIEW}
          emptyMessage={null}
          onFocusTarget={focusTarget}
          onRunIntervention={runIntervention}
          icon={GitBranch}
          testId="analysis-new-sensitivity"
        />

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
        <WhatIWasGivenSection onSendMessage={onSendMessage} />

        <StrengthenTheReasoning
          interventions={vm.strengthen.interventions}
          scienceGrounding={vm.strengthen.scienceGrounding}
          preview={ANALYSIS_NEW_LIMITS.STRENGTHEN_PREVIEW}
          analysisHash={responseHash ?? null}
          icon={Wrench}
        />

        {/* ── WHAT WE CHECKED ─────────────────────────────────────────────
            #1082 landed this component, its adapter and 54 tests but left it
            UNMOUNTED, because this file belongs to another lane. This is the
            mount — the delta that PR verified in a throwaway worktree, at the
            anchor it named: directly under the answer it qualifies, before
            `OptionsComparison`.

            It answers a DIFFERENT question from the glance — what the run
            CHECKED, not what it FOUND — so the two are named apart rather than
            reconciled (trap 21). It is the only surface on this tab that
            speaks for a check that was NOT made, where silence otherwise reads
            as "fine": a reader could not tell "we looked and found nothing"
            from "we did not look", and only one of those is reassurance.

            Costs one wrapped line at rest and renders NOTHING pre-run
            (`vm.checks` is `{ items: [] }`, which the component returns null
            for) — so a heading never appears without something under it. */}
        <WhatWeChecked checks={vm.checks} />

        {/* ── HOW THE OPTIONS COMPARE ──────────────────────────────────────
            ⭐ THE GLANCE'S OWN MISSING HALF. On a real completed run with four
            options this surface showed the leader and one percentage and
            nothing at all about the other three; the reader could not tell a
            runaway leader from a coin flip, and could not see that an option
            they cared about took no part in the comparison.
            ⚠ It previously sat directly under the glance; the coaching now
            takes that slot (see above), and this sentence is corrected rather
            than left describing a placement that no longer holds.

            It costs ONE collapsed row at rest — the same idiom as every
            section below it — so closing the largest content gap on the
            surface does not spend the first viewport. */}
        <OptionsComparison options={vm.optionsComparison} />

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
          emptyMessage={
            vm.status.isPreRun || vm.keyInsights.candidateCount > 0 ? null : COPY.empty.keyInsights
          }
          onFocusTarget={focusTarget}
          onRunIntervention={runIntervention}
          icon={Star}
          testId="analysis-new-key-insights"
        />

        {/* ── DRIVERS AND DYNAMICS ────────────────────────────────────────── */}
        <AnalysisNewSection
          title={COPY.sections.drivers}
          findings={vm.drivers.findings}
          preview={ANALYSIS_NEW_LIMITS.DRIVER_PREVIEW}
          // ⚠ The caveat is a function of the PRODUCER's provenance token, not
          // of taste: a set-relative influence is "largest in this set", never
          // a causal share of the outcome.
          caveat={
            vm.drivers.influenceIsSetRelative
              ? COPY.coverage.setRelativeInfluence
              : vm.drivers.referenceOptionLabel
                ? `${COPY.coverage.referencePrefix} ${vm.drivers.referenceOptionLabel}.`
                : null
          }
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
          emptyMessage={driversEmptyMessage(vm)}
          onFocusTarget={focusTarget}
          onRunIntervention={runIntervention}
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

        {/* ── UNCERTAINTY AND GAPS ────────────────────────────────────────── */}
        <AnalysisNewSection
          title={COPY.sections.uncertainty}
          findings={vm.uncertainty.findings}
          preview={ANALYSIS_NEW_LIMITS.UNCERTAINTY_PREVIEW}
          // ⚠⚠ THE EMPTY STATE HERE IS A TRUTH CLAIM AND IT SPLITS TWO WAYS.
          // "Nothing was flagged" is licensed ONLY when the producer actually
          // assessed evidence on this run; otherwise the honest sentence is
          // that it was not assessed. An empty list cannot tell them apart —
          // `evidenceGapsAssessed` can.
          emptyMessage={
            vm.status.isPreRun
              ? null
              : vm.uncertainty.evidenceAssessed
                ? COPY.empty.uncertaintyAssessed
                : COPY.empty.uncertaintyUnassessed
          }
          onFocusTarget={focusTarget}
          onRunIntervention={runIntervention}
          icon={AlertTriangle}
          testId="analysis-new-uncertainty"
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
            <h3
              id="analysis-new-decision-voi-heading"
              // `panelHeader` — a section title, for the same reason as
              // `WhatWeChecked`. These two were the only section headings on
              // this tab not rendering at 14px/600.
              className={`${typography.panelHeader} text-text-header mb-1`}
              data-testid="analysis-new-decision-voi-heading"
            >
              {COPY.decisionVoi.label}
            </h3>
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
        <DeeperAnalysis deeper={vm.deeper} />
      </div>
    </div>
  )
}
