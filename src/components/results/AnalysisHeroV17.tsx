/**
 * AnalysisHeroV17 — decision-strengthening hero panel.
 *
 * Renders as the top section of the post-analysis Analysis tab when the
 * `analysisHeroV17` feature flag is on (replaces `DecisionConfidencePanel`
 * at that render slot). Source of truth:
 *   - docs/investigations/analysis-hero-v17.md
 *   - docs/brief-analysis-hero-v17-implementation.md
 *   - docs/Design/analysis-hero-v17-reference.html (visual reference only)
 *
 * Composer only: every visible subsection lives in its own file under
 * `./analysisHeroV17/`. This file wires VM → handlers → subcomponents,
 * nothing more. Keeps the hero easy to retire by deleting the
 * `analysisHeroV17/` directory and this component.
 */

import { memo, useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
// `typography` import removed (Fix 1) — the contribution-line `<p>` that
// referenced it was dropped, and no other JSX in this composer reads
// typography classes directly (children handle their own).
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import type { ResultsVM } from './types'
import { buildAnalysisHeroViewModel } from './analysisHeroV17/buildAnalysisHeroViewModel'
import {
  isFactorNode,
  isRiskNode,
  isGoalNode,
} from './analysisHeroV17/canvasSignals'
import type { AlsoLink } from './analysisHeroV17/analysisHeroVM.types'
import { ReadinessColourStrip } from './analysisHeroV17/ReadinessColourStrip'
import { HeroResultContext } from './analysisHeroV17/HeroResultContext'
import { HeroKeyQuestion } from './analysisHeroV17/HeroKeyQuestion'
import { HeroInputRows } from './analysisHeroV17/HeroInputRows'
import { HeroFooter } from './analysisHeroV17/HeroFooter'
import { HeroActionsMenu } from './analysisHeroV17/HeroActionsMenu'
import { makeRowActionDispatcher } from './analysisHeroV17/dispatchAction'
import { TriageActionCardsBody } from './TriageActionCardsBody'

// ── Public props ────────────────────────────────────────────────────────────
// Matches `DecisionConfidencePanel` so the substitution in `ResultsBody`
// is a one-line ternary swap. No new prop plumbing through `OutputsDock`.
export interface AnalysisHeroV17Props {
  data: ResultsSectionDataReturn
  vm: ResultsVM
  /** From OutputsDock's local meta — fragile-edge count for state selection. */
  fragileEdgeCount?: number
  verifiedCount?: number
  influenceCoverage?: number
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onSetValue?: (nodeId: string, rawValue: number) => void
  onConfirm?: (nodeId: string) => void
  expertMode?: boolean
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Used by the action-card body's dominant-factor "Research" chip — pass through unchanged. */
  onSendMessage?: (text: string) => void
  aiAffordance?: ReactNode
}

// Factor / risk / goal node guards live in canvasSignals.ts — typed
// without `as any`, narrowing via the `in` operator. The hero pulls
// them in to compute the Verified denominator, Structure score, and
// Coverage score (P1.1 + P1.6).

export const AnalysisHeroV17 = memo(function AnalysisHeroV17({
  data,
  vm,
  fragileEdgeCount,
  verifiedCount: _verifiedCount,
  influenceCoverage: _influenceCoverage,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  expertMode: _expertMode,
  nodeValueLookup,
  onSendMessage,
  aiAffordance,
}: AnalysisHeroV17Props) {
  // Single canvas-store subscription covering every signal we need.
  // Iterates `nodes` exactly once per change and returns a primitive
  // record so `useShallow` re-renders the hero only when one of the
  // values actually changes — not on every unrelated canvas state shift.
  // (Performance fix: replaces 5 separate useCanvasStore subscriptions
  // that each re-evaluated independently and re-filtered s.nodes.)
  const canvasDerived = useCanvasStore(useShallow(s => {
    const nodes = s.nodes ?? []
    const factorIds = new Set<string>()
    let hasGoal = false
    let riskCount = 0
    for (const n of nodes) {
      if (isFactorNode(n)) factorIds.add(n.id)
      else if (isGoalNode(n)) hasGoal = true
      else if (isRiskNode(n)) riskCount += 1
    }
    let confirmedFactorCount = 0
    if (s.confirmedNodeIds) {
      s.confirmedNodeIds.forEach(id => { if (factorIds.has(id)) confirmedFactorCount += 1 })
    }
    return {
      confirmedFactorCount,
      totalFactorCount: factorIds.size,
      hasGoalNode: hasGoal,
      edgeCount: s.edges?.length ?? 0,
      riskCount,
    }
  }))
  const { confirmedFactorCount, totalFactorCount, hasGoalNode, edgeCount, riskCount } = canvasDerived

  // Recommendation-derived signals. Defensive against bundles that lack
  // a recommendation slice — render the hero in its empty state rather
  // than crashing the SectionErrorBoundary.
  const recommendation = data?.recommendation
  const optionCount = recommendation?.allOptions?.length ?? 0
  const hasBaseline = !!recommendation?.baselineId
  const hasGoalThreshold =
    typeof recommendation?.goalThreshold === 'number'
    && Number.isFinite(recommendation.goalThreshold)

  // Track chat-prefill availability. When the conversation panel is
  // mounted, it registers `_prefillChat`; when unmounted/closed, the
  // wire is null. Subscribing here re-renders subcomponents so prefill-
  // dependent actions can render as disabled — visually clear rather
  // than a dead-click no-op. (Per the "actions appear dead" improvement.)
  const chatPrefillAvailable = useGuidanceStore(s => s._prefillChat !== null)

  const heroVm = useMemo(
    () => buildAnalysisHeroViewModel({
      data,
      vm,
      confirmedFactorCount,
      totalFactorCount,
      fragileEdgeCount: fragileEdgeCount ?? 0,
      structureSignals: {
        hasGoal: hasGoalNode,
        hasMultipleOptions: optionCount >= 2,
        hasFactors: totalFactorCount > 0,
        hasConnections: edgeCount > 0,
      },
      coverageSignals: {
        hasMultipleOptions: optionCount >= 2,
        hasRisks: riskCount > 0,
        hasBaseline,
        hasGoalThreshold,
      },
    }),
    [
      data, vm, confirmedFactorCount, totalFactorCount, fragileEdgeCount,
      hasGoalNode, optionCount, edgeCount, riskCount,
      hasBaseline, hasGoalThreshold,
    ],
  )

  // Chat wires. Read from guidance store at dispatch time so a
  // re-registration after ConversationPanel mounts is picked up cleanly.
  //
  // IMPORTANT: prefillChat must NEVER auto-send. If `_prefillChat` is
  // unavailable (e.g. ConversationPanel hasn't mounted), this no-ops —
  // the affected action buttons are already hidden via the
  // chatPrefillAvailable plumbing (Fix 6), so this is belt-and-braces.
  //
  // (Fix 9) The reflect-state CTA used to auto-send via `_sendMessage`.
  // Per Paul's directive — to keep clear of the `run_devils_advocacy`
  // contract zone — reflect is now also prefill-only. The hero has zero
  // auto-send paths.
  const prefillChat = (text: string) => {
    const p = useGuidanceStore.getState()._prefillChat
    if (p) p(text)
  }

  // prefillChat is a stable getState() closure; only re-bind when the
  // external handlers change.
  const dispatchRowAction = useMemo(
    () => makeRowActionDispatcher({ prefillChat, onFocusNode, onConfirm }),
    [onFocusNode, onConfirm],
  )

  const handleAlsoClick = (link: AlsoLink) => {
    prefillChat(link.chatPrompt)
  }

  // State-dependent CTA. Moderate state focuses the factor first, then
  // prefills. All states are prefill-only now (Fix 9 — reflect-state
  // auto-send removed for V5 contract v1.3 alignment).
  //
  // When chat is closed, prefill-dependent CTAs are hidden upstream in
  // HeroFooter. The moderate-state CTA stays visible with a softer
  // label ("Focus key estimate") because its focus side-effect remains
  // useful without chat.
  const handleCtaClick = () => {
    const cta = heroVm.footerCta
    if (cta.kind === 'check-key-estimate') {
      if (cta.focusTargetId && onFocusNode) {
        onFocusNode(cta.focusTargetId)
      }
      prefillChat(cta.chatPrompt)
      return
    }
    // weak / strong / reflect (challenge-result): prefill only.
    prefillChat(cta.chatPrompt)
  }

  return (
    <div className="space-y-4 animate-fade-in" data-testid="analysis-hero-v17">
      <div
        className="rounded-lg border border-panel-border bg-panel p-3 space-y-3"
        data-testid="analysis-hero-v17-card"
      >
        {/* Top: header + dimension strip + Actions menu */}
        <header className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <ReadinessColourStrip
              checkedCount={heroVm.checkedCount}
              dimensions={heroVm.dimensions}
            />
            {/* (Fix 1) `contribution` line removed — `checkedCount` is the
                single source of truth for the verified-count display.
                The VM field is preserved for backward compatibility but
                its text is always null. */}
          </div>
          <HeroActionsMenu onPrefillChat={prefillChat} chatPrefillAvailable={chatPrefillAvailable} />
        </header>

        <HeroResultContext
          resultLine={heroVm.resultLine}
          reasonLine={heroVm.reasonLine}
          metaPills={heroVm.metaPills}
        />

        {heroVm.keyQuestion && (
          <HeroKeyQuestion
            keyQuestion={heroVm.keyQuestion}
            onPrefillChat={prefillChat}
            chatPrefillAvailable={chatPrefillAvailable}
          />
        )}

        <HeroInputRows
          inputRows={heroVm.inputRows}
          hiddenRows={heroVm.hiddenRows}
          dispatchRowAction={dispatchRowAction}
          chatPrefillAvailable={chatPrefillAvailable}
        />

        <HeroFooter
          alsoLinks={heroVm.alsoLinks}
          footerChecks={heroVm.footerChecks}
          footerHint={heroVm.footerHint}
          footerCta={heroVm.footerCta}
          onAlsoClick={handleAlsoClick}
          onCtaClick={handleCtaClick}
          chatPrefillAvailable={chatPrefillAvailable}
        />

        {/* Action-card body — same component DecisionConfidencePanel uses.
            v17 owns the input-row surface above; the body's EVPI-ranked
            queue is suppressed here to avoid showing the same items
            twice (P1.3). The body's contextual blocks (flip-risk
            callout, conditional scenarios, dominant-factor nudge, T1
            checks footer) still render — those are signals the v17 top
            section does not duplicate. */}
        <TriageActionCardsBody
          data={data}
          onFocusNode={onFocusNode}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          onSetValue={onSetValue}
          onConfirm={onConfirm}
          nodeValueLookup={nodeValueLookup}
          onSendMessage={onSendMessage}
          aiAffordance={aiAffordance}
          suppressTriageQueue
          useV17Copy
        />
      </div>
    </div>
  )
})

export default AnalysisHeroV17
