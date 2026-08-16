/**
 * `<AnalysisStateRegion>` — the layout-level owner of the Analysis surface's
 * truth-state slot and body slot (brief step 6, ruling R1).
 *
 * THE ONE PROPERTY IT EXISTS TO GUARANTEE
 * ---------------------------------------
 *     At most ONE truth-state banner mounts on this surface, and WHICH one is
 *     a function of the run state alone.
 *
 * It is structural, not defensive. There is a SINGLE banner expression here,
 * so two banners cannot co-render without deleting this component — which
 * REDs `AnalysisStateRegion.singleTruthBanner.spec.tsx`. That is what "row-
 * exclusive by construction" means, and it is why the fix is a region rather
 * than a neighbour check inside `AnalysisFreshnessNotice` ("am I next to a
 * refusal?"). Neighbour checks were the shape that produced L-36: seven
 * independently-sourced children, each correct alone, none gating any other.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 *  - It does not derive freshness, readiness, refusal or leader entitlement.
 *    It consumes an `AnalysisRunStateKind` and renders the components that
 *    already own those verdicts. The banners keep their own null-render rules,
 *    so a state we do not hold still produces no banner: selecting the
 *    freshness slot is permission to speak, never an instruction to.
 *  - It does not gate the ranked leader (brief step 7).
 *  - It does not dim (Paul's Ruling 3 / ROADMAP 2.651 — stale results are
 *    labelled, never withheld or dimmed). `prior` marks; it does not obscure.
 */
import type { ReactNode } from 'react'

import { AnalysisFreshnessNotice } from '../AnalysisFreshnessNotice'
import { AnalysisRefusalNotice } from '../AnalysisRefusalNotice'
import {
  selectBodyPresentation,
  selectTruthBanner,
  type AnalysisRunStateKind,
} from './analysisStateContract'

export interface AnalysisStateRegionProps {
  /** The composed run state (`useAnalysisRunState()` at the call site). */
  runState: AnalysisRunStateKind
  /**
   * Whether there is a result body to present at all. The caller's existing
   * gate is passed in rather than re-derived here — a second authority for
   * "is there a report" is exactly the duplication this region removes.
   */
  hasReport: boolean
  /**
   * Provenance attribution for a body showing an EARLIER run's numbers
   * (ROADMAP 2.1127's `stale-results-banner`). Rendered INSIDE the body slot,
   * because it answers "whose numbers are these?" — a different question from
   * "did the analysis run, and is it current?" (trap 21). It is therefore not
   * a truth-state banner and does not compete for the single slot.
   */
  bodyAttribution?: ReactNode
  /** The result body. */
  children?: ReactNode
}

export function AnalysisStateRegion({
  runState,
  hasReport,
  bodyAttribution,
  children,
}: AnalysisStateRegionProps) {
  const banner = selectTruthBanner(runState)
  const presentation = selectBodyPresentation(runState, hasReport)

  return (
    <div
      data-testid="analysis-state-region"
      data-run-state={runState}
      data-truth-banner={banner}
      data-body-presentation={presentation}
      className="flex flex-col gap-6"
    >
      {/* ⭐ THE SINGLE TRUTH-STATE SLOT. One expression, one element. Adding a
          second banner here — or mounting either notice anywhere else on this
          surface — is the defect; both are pinned. */}
      {banner === 'refusal' ? (
        <AnalysisRefusalNotice />
      ) : banner === 'freshness' ? (
        <AnalysisFreshnessNotice />
      ) : null}

      {presentation !== 'hidden' && (
        <div className="flex flex-col gap-6" data-testid="analysis-state-region-body">
          {presentation === 'prior' && bodyAttribution}
          {children}
        </div>
      )}
    </div>
  )
}

export default AnalysisStateRegion
