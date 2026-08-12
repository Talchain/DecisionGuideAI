/**
 * V7ComparisonTabBody — TEMPORARY comparison surface (Paul, 12 Aug 2026).
 *
 * Hosts the ENTIRE V7 assessment group (`V7TopMatter`: freshness strip,
 * sharpen line, what-I-was-given, hero, lens group, evidence disclosure,
 * guidance, bias), MOVED here unchanged from the Analysis tab — where it
 * rendered the whole analysis a second time above a "Current view" divider
 * (the V6-RESPEC-2026-07-23 §1 "Option A — additive, never replace"
 * assessment scaffold that never retired). This tab exists so Paul can
 * compare the two renderings of the SAME analysis side by side; it retires
 * when he adjudicates the V7-vs-Current fork (COMPONENT-INVENTORY §10A).
 * Reversal = code revert. No flag (no-dark-launch doctrine).
 *
 * SINGLE DATA AUTHORITY (the estate's chronic defect is same-named twins):
 *   · `resultsSectionData` is the SAME object OutputsDock hands `ResultsBody`
 *     on the Analysis tab (one `useResultsSectionData()` call, one instance).
 *   · `decisionState` is derived by the ONE shared `buildResultsVM`, from the
 *     SAME `fragileEdgeCount`/`robustEdgeCount` inputs OutputsDock passes
 *     `ResultsBody` — the exact derivation (and value) the live hero consumes.
 *     No forked builder, no duplicated selector.
 *   · The empty state gates on `v7HasAnalysis` — the SAME predicate
 *     `V7TopMatter` itself returns-null on — so "empty invitation" and "V7
 *     content" are mutually exclusive by construction.
 */

import { useMemo } from 'react'
import { typography } from '../../../styles/typography'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { buildResultsVM } from '../buildResultsVM'
import { SectionErrorBoundary } from '../../../canvas/components/SectionErrorBoundary'
import { V7TopMatter, v7HasAnalysis } from './V7TopMatter'

export interface V7ComparisonTabBodyProps {
  /** The SAME instance OutputsDock feeds ResultsBody — never a re-derivation. */
  resultsSectionData: ResultsSectionDataReturn
  /** Same source expressions as ResultsBody's props (report.robustness.*). */
  fragileEdgeCount?: number
  robustEdgeCount?: number
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}

export function V7ComparisonTabBody({
  resultsSectionData,
  fragileEdgeCount,
  robustEdgeCount,
  onFocusNode,
  onSendMessage,
}: V7ComparisonTabBodyProps) {
  // Byte-for-byte the derivation ResultsBody performs for its own `vm` —
  // same shared builder, same inputs, therefore the same decisionState the
  // Analysis tab's live hero consumes. Kept identical ON PURPOSE; if
  // ResultsBody's derivation ever changes, change this with it (both feed
  // from the one `buildResultsVM`, so a divergence is a visible diff here).
  const robustnessEdgeTotal = (fragileEdgeCount ?? 0) + (robustEdgeCount ?? 0)
  const vm = useMemo(
    () => buildResultsVM(resultsSectionData, {
      fragileEdgeCount,
      totalEdgeCount: robustnessEdgeTotal,
    }),
    [resultsSectionData, fragileEdgeCount, robustnessEdgeTotal],
  )

  return (
    <div className="flex flex-col gap-4" data-testid="v7-comparison-tab-body">
      {/* One-line orientation header — names this a TEMPORARY comparison so
          nobody mistakes it for a second product surface. */}
      <div
        data-testid="v7-comparison-tab-header"
        className="rounded-lg border border-panel-border bg-panel px-3 py-1.5"
      >
        <p className={`${typography.panelMeta} text-text-light`}>
          Temporary comparison view — an alternate rendering of the same
          analysis shown on the Analysis tab.
        </p>
      </div>

      {v7HasAnalysis(resultsSectionData) ? (
        <SectionErrorBoundary section="V7 top matter">
          <V7TopMatter
            resultsSectionData={resultsSectionData}
            decisionState={vm.decisionState}
            onFocusNode={onFocusNode}
            onSendMessage={onSendMessage}
          />
        </SectionErrorBoundary>
      ) : (
        <p
          data-testid="v7-comparison-tab-empty"
          className={`${typography.panelMeta} text-text-light px-1`}
        >
          Run an analysis to see the alternate rendering here.
        </p>
      )}
    </div>
  )
}

export default V7ComparisonTabBody
