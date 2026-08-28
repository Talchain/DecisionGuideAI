/**
 * Analysis (New) — the experimental Analysis surface (Paul, 27 Aug 2026).
 *
 * A SECOND, SEPARATE tab beside the existing Analysis tab, rendering THE SAME
 * analysis run through a reasoning-led information architecture so the two can
 * be compared directly on one scenario. The existing Analysis tab is untouched.
 *
 *   What should we notice?            → Key insights
 *   How can we strengthen this?       → Strengthen the reasoning
 *   What is shaping the situation?    → Drivers and dynamics
 *   What is still uncertain?          → Uncertainty and gaps
 *   (everything deeper)               → one collapsed region
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

import { AlertTriangle, MessageSquare, Star, TrendingUp } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import { ANALYSIS_NEW_LIMITS } from './buildAnalysisNewViewModel'
import type { AnalysisNewViewModel } from './analysisNewTypes'
import { useAnalysisNewViewModel } from './useAnalysisNewViewModel'
import { AnalysisNewSection } from './sections/AnalysisNewSection'
import { AtAGlance } from './sections/AtAGlance'
import { StrengthenTheReasoning } from './sections/StrengthenTheReasoning'
import { DeeperAnalysis } from './sections/DeeperAnalysis'

export interface AnalysisNewTabBodyProps {
  /** THE SAME instance OutputsDock hands ResultsBody. Never re-derived here. */
  resultsSectionData: ResultsSectionDataReturn
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model. Freshness only. */
  isStale: boolean
  nSamples?: number
  seedUsed?: number | string
  responseHash?: string
  /** OutputsDock's canvas-focus handler, shared with the existing tab. */
  onFocusNode?: (nodeId: string) => void
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
  nSamples,
  seedUsed,
  responseHash,
  onFocusNode,
}: AnalysisNewTabBodyProps) {
  const vm = useAnalysisNewViewModel({
    data: resultsSectionData,
    isPreRun,
    isRunning,
    isStale,
    nSamples,
    seedUsed,
    responseHash,
  })

  // Canvas focus prefers the dock's own handler (shared with the existing tab);
  // `focusModelTarget` is the fail-closed fallback for edge ids the node-scoped
  // handler cannot resolve.
  const focusTarget = (targetId: string) => {
    if (onFocusNode) onFocusNode(targetId)
    else focusModelTarget(targetId)
  }

  /**
   * A contextual intervention runs through the SAME non-mutating route as the
   * Strengthen section's primary CTA — the Ask-Olumi drawer, prefilled and
   * never auto-sent. The recommendation is found by id, so the drawer is
   * seeded with the ENGINE's own words, not with a paraphrase of the row.
   */
  const runIntervention = (recommendationId: string) => {
    const rec = vm.strengthen.interventions.find((r) => r.id === recommendationId)
    if (!rec) return
    openAskOlumi({
      context: rec.whyNow || rec.signal,
      draft: rec.action.prompt ?? rec.tryThis,
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
      <div className="px-5 py-4 space-y-4 max-w-[360px] mx-auto">
        {/* ⚠ THE INTRO ASSERTS A RUN, SO IT IS GATED ON THERE BEING ONE.
            "A second reading of the same analysis run" is true of this tab and
            false of this model when nothing has run — mounted pre-run it sat
            directly above "No analysis has run yet for this model", which is
            the surface contradicting itself in two consecutive lines. */}
        {vm.status.isPreRun ? null : (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-intro">
            {COPY.tabIntro}
          </p>
        )}

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
          </div>
        ) : null}
        {vm.status.isStale ? (
          <p
            className={`${typography.panelMeta} text-warning`}
            role="status"
            data-testid="analysis-new-status-stale"
          >
            {COPY.status.stale}
          </p>
        ) : null}
        {/* ⚠ A PARTIAL RESULT SAYS SO HERE, NOT ONLY IN A COLLAPSED REGION.
            `status.isProvisional` was computed and read by NONE of the six
            render components; the sole disclosure was the bare enum "partial"
            inside `Deeper analysis`, which opens collapsed. On a surface whose
            claim is a five-to-ten-second read, that is a partial result
            presented exactly like a complete one. */}
        {vm.status.isProvisional ? (
          <p
            className={`${typography.panelMeta} text-warning`}
            role="status"
            data-testid="analysis-new-status-provisional"
          >
            {COPY.status.provisional}
          </p>
        ) : null}
        {vm.status.statusNote ? (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-status-note">
            {vm.status.statusNote}
          </p>
        ) : null}

        {/* ── AT A GLANCE — the 5-to-10-second read ───────────────────────── */}
        {/* ⚠ `driverTotal` is the RUN's non-zero driver count, not the
            glance's capped list — the glance shows at most three and must say
            so. `primaryIntervention` is the ENGINE's top recommendation,
            passed rather than re-derived: this surface never mints one. */}
        <AtAGlance
          glance={vm.atAGlance}
          onFocusTarget={focusTarget}
          driverTotal={vm.drivers.totalCount}
          primaryIntervention={
            vm.strengthen.interventions[0]
              ? {
                  id: vm.strengthen.interventions[0].id,
                  label: vm.strengthen.interventions[0].action.label,
                  why: vm.strengthen.interventions[0].signal,
                }
              : null
          }
          onRunIntervention={runIntervention}
        />

        {/* ── 1. KEY INSIGHTS ─────────────────────────────────────────────── */}
        <AnalysisNewSection
          title={COPY.sections.keyInsights}
          findings={vm.keyInsights.insights}
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

        {/* ── 2. STRENGTHEN THE REASONING ──────────────────────────────────
            Second from the top by design. This is the placement the
            experiment is testing. */}
        <StrengthenTheReasoning
          interventions={vm.strengthen.interventions}
          scienceGrounding={vm.strengthen.scienceGrounding}
          icon={MessageSquare}
        />

        {/* ── 3. DRIVERS AND DYNAMICS ─────────────────────────────────────── */}
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
        />

        {/* ── 4. UNCERTAINTY AND GAPS ─────────────────────────────────────── */}
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
            measured zero and must not be collapsed into one. */}
        {vm.uncertainty.decisionVoi !== 'not_computed' ? (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-decision-voi">
            {vm.uncertainty.decisionVoi === 'measured_non_zero'
              ? COPY.decisionVoi.measuredNonZero
              : COPY.decisionVoi.measuredZero}
          </p>
        ) : null}

        {/* ── LEVEL 3 ─────────────────────────────────────────────────────── */}
        <DeeperAnalysis deeper={vm.deeper} />
      </div>
    </div>
  )
}
