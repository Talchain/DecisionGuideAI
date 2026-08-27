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
 * ⚠ ON WIDTH (§11), STATED AS A LIMITATION RATHER THAN SOLVED. The dock's outer
 * width is 416px, fixed by the workspace shell and asserted at every viewport by
 * `e2e/visual/shellLayout.visual.spec.ts`. Varying it per surface is a
 * shell-level change that would alter the existing Analysis tab's container, so
 * it is deliberately NOT done. The narrower, calmer treatment is scoped to this
 * tab's INNER content measure — wider gutters, a capped measure, and far fewer
 * elements per screen. The outer panel is unchanged.
 */

import { typography } from '../../../styles/typography'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import { ANALYSIS_NEW_LIMITS } from './buildAnalysisNewViewModel'
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
      <div className="px-5 py-4 space-y-5 max-w-[360px] mx-auto">
        <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-intro">
          {COPY.tabIntro}
        </p>

        {/* ── STATUS ────────────────────────────────────────────────────────
            Contextualises the content; never dominates it (§20). One line,
            not a banner stack. The Rerun control is the shell's footer bar,
            declared by this surface's `footerBar: 'reanalyse'` in the shell
            contract — the SAME control and the SAME handler the Model tab
            uses, so no second run authority exists. */}
        {vm.status.isPreRun ? (
          <p className={`${typography.panelBody} text-text-light`} data-testid="analysis-new-status-pre-run">
            {COPY.status.preRun}
          </p>
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
        {vm.status.statusNote ? (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-new-status-note">
            {vm.status.statusNote}
          </p>
        ) : null}

        {/* ── AT A GLANCE — the 5-to-10-second read ───────────────────────── */}
        <AtAGlance glance={vm.atAGlance} onFocusTarget={focusTarget} />

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
          testId="analysis-new-key-insights"
        />

        {/* ── 2. STRENGTHEN THE REASONING ──────────────────────────────────
            Second from the top by design. This is the placement the
            experiment is testing. */}
        <StrengthenTheReasoning
          interventions={vm.strengthen.interventions}
          scienceGrounding={vm.strengthen.scienceGrounding}
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
          emptyMessage={vm.status.isPreRun ? null : COPY.empty.drivers}
          onFocusTarget={focusTarget}
          onRunIntervention={runIntervention}
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
