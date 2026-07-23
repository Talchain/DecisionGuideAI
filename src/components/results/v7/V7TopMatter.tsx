/**
 * V7TopMatter — the V7 (new) top group's L4 content (V7 Lane L4).
 *
 * Mounts inside the `v7-top-group` slot in ResultsBody, ABOVE the
 * "Current view" divider (the L3 scaffold). Composes the L4 components:
 *   1. V7FreshnessStrip — current / changed / cannot-confirm, honest
 *   2. V7SharpenLine    — brief quote + inputs to confirm + model-limit caveat
 *   3. V7Hero           — gauge + live headline + subline + signal row + chips
 *
 * ADDITIVE and PASSTHROUGH: every part reads existing store data and renders
 * nothing when its backing data is absent. The whole group is gated on
 * analysis presence — pre-analysis it returns null, so `v7-top-group`'s
 * `empty:hidden` keeps it out of layout entirely (spec: renders NOTHING
 * pre-analysis; nothing below the divider changes).
 */

import { useMemo } from 'react'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DecisionState } from '../types'
import { V7FreshnessStrip } from './V7FreshnessStrip'
import { V7SharpenLine, type V7SharpenInput } from './V7SharpenLine'
import { V7Hero } from './V7Hero'
import { V7LensGroup } from './V7LensGroup'
import { V7EvidenceDisclosure } from './V7EvidenceDisclosure'
import { V7GuidanceSection } from './V7GuidanceSection'
import { V7BiasSection } from './V7BiasSection'
import { buildV7Lenses } from './buildV7Lenses'

export interface V7TopMatterProps {
  resultsSectionData: ResultsSectionDataReturn
  /** `buildResultsVM(...).decisionState` — the SAME tri-state the live hero uses. */
  decisionState: DecisionState
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}

export function V7TopMatter({
  resultsSectionData,
  decisionState,
  onFocusNode,
  onSendMessage,
}: V7TopMatterProps) {
  const { recommendation, drivers, confidence, isLoading, isError } = resultsSectionData

  // Analysis-presence gate — mirror the live hero: there is analysis to show
  // once options with results exist and the panel is neither loading nor errored.
  const hasAnalysis = !isLoading && !isError && (recommendation.allOptions?.length ?? 0) > 0
  if (!hasAnalysis) return null

  // Sharpen inputs — the evidence gaps worth confirming (honest, store-backed).
  const sharpenInputs: V7SharpenInput[] = (confidence.topEvidenceGaps ?? []).map(gap => ({
    label: gap.factorLabel,
    nodeId: gap.targetNodeId,
  }))
  const briefWording = recommendation.goalText ?? resultsSectionData.goalLabel ?? null

  // L5 lens group + evidence disclosure — passthrough over the SAME
  // resultsSectionData the live panel consumes. The lens model is built ONCE
  // here (memoised on resultsSectionData) and handed to BOTH the lens group and
  // the evidence disclosure; the lens group still reads local run history for
  // the What-changed lens itself.
  const model = useMemo(() => buildV7Lenses(resultsSectionData), [resultsSectionData])

  return (
    <div className="flex flex-col gap-4" data-testid="v7-top-matter">
      <V7FreshnessStrip />
      <V7SharpenLine briefWording={briefWording} inputs={sharpenInputs} onFocusNode={onFocusNode} />
      <V7Hero
        recommendation={recommendation}
        decisionState={decisionState}
        topDrivers={drivers.topDrivers}
        fragileEdges={confidence.challengeFragileEdges}
        onFocusNode={onFocusNode}
        onSendMessage={onSendMessage}
      />
      <V7LensGroup model={model} />
      <V7EvidenceDisclosure evidence={model.evidence} onFocusNode={onFocusNode} />
      {/* L6 — "What to do next" (guidance + held-proposal pointer card) and
          "Challenge your assumptions" (bias coaching). Both read their own
          stores (guidance store / canvas ceeReview) and render nothing when
          their backing data is absent. */}
      <V7GuidanceSection onFocusNode={onFocusNode} onSendMessage={onSendMessage} />
      <V7BiasSection />
    </div>
  )
}

export default V7TopMatter
