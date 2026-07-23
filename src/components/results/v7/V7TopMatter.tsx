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

import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DecisionState } from '../types'
import { V7FreshnessStrip } from './V7FreshnessStrip'
import { V7SharpenLine, type V7SharpenInput } from './V7SharpenLine'
import { V7Hero } from './V7Hero'

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
    </div>
  )
}

export default V7TopMatter
