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
import { typography } from '@/styles/typography'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import type { ResultsVM } from './types'
import { buildAnalysisHeroViewModel } from './analysisHeroV17/buildAnalysisHeroViewModel'
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

// Widened factor filter — covers nodes whose React Flow `type` is
// 'factor' OR whose `data.kind === 'factor'`. Schema-v2 nodes can use
// either convention; we count both.
function isFactorNode(n: { type?: string | undefined; data?: unknown }): boolean {
  if (n.type === 'factor') return true
  const data = n.data as { kind?: string } | undefined
  return data?.kind === 'factor'
}

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
  // Provenance-grounded inputs: factor count + confirmed-factor count from
  // the canvas store. Verified bar uses these per investigation §5.3 +
  // brief §3 step 9. The pre-analysis `verifiedCount` prop is a separate
  // signal (pre-analysis verifications) and is deliberately not used here.
  const confirmedFactorCount = useCanvasStore(s => {
    if (!s.confirmedNodeIds || !s.nodes) return 0
    const factorIds = new Set(s.nodes.filter(isFactorNode).map(n => n.id))
    let count = 0
    s.confirmedNodeIds.forEach(id => { if (factorIds.has(id)) count += 1 })
    return count
  })
  const totalFactorCount = useCanvasStore(s => s.nodes?.filter(isFactorNode).length ?? 0)

  const heroVm = useMemo(
    () => buildAnalysisHeroViewModel({
      data,
      vm,
      confirmedFactorCount,
      totalFactorCount,
      fragileEdgeCount: fragileEdgeCount ?? 0,
    }),
    [data, vm, confirmedFactorCount, totalFactorCount, fragileEdgeCount],
  )

  // Chat wires. Read from guidance store at dispatch time so a
  // re-registration after ConversationPanel mounts is picked up cleanly.
  //
  // IMPORTANT: prefillChat must NEVER auto-send. Per Paul's direction
  // (brief §3 step 6 + §4.3), only the reflect-state CTA may auto-send.
  // If `_prefillChat` is unavailable (e.g. ConversationPanel hasn't
  // mounted yet), this no-ops — far better than silently amplifying the
  // user's intent to an unrequested send.
  const prefillChat = (text: string) => {
    const p = useGuidanceStore.getState()._prefillChat
    if (p) p(text)
  }
  // sendMessage IS auto-send. Used only by the reflect-state CTA. If
  // `_sendMessage` isn't available, fall back to prefill — degrading
  // from auto-send to prefill is safe; promoting prefill to auto-send
  // would not be.
  const sendMessage = (text: string) => {
    const s = useGuidanceStore.getState()._sendMessage
    if (s) s(text)
    else prefillChat(text)
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
  // prefills (no auto-send, no timing hacks). Reflect state auto-sends.
  // All others prefill only. (Investigation §11.4 + brief §3 step 6.)
  const handleCtaClick = () => {
    const cta = heroVm.footerCta
    if (cta.kind === 'check-key-estimate') {
      if (cta.focusTargetId && onFocusNode) {
        // Focus is synchronous — fire it first, then prefill in the same
        // call stack. No setTimeout, no sleeps.
        onFocusNode(cta.focusTargetId)
      }
      prefillChat(cta.chatPrompt)
      return
    }
    if (cta.kind === 'challenge-result') {
      sendMessage(cta.chatPrompt) // reflect state — auto-send is approved
      return
    }
    // weak / strong: prefill only.
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
            {heroVm.contribution.text && (
              <p className={`mt-1.5 ${typography.panelMeta} text-text-light`} data-testid="hero-v17-contribution">
                {heroVm.contribution.text}
              </p>
            )}
          </div>
          <HeroActionsMenu onPrefillChat={prefillChat} />
        </header>

        <HeroResultContext
          resultLine={heroVm.resultLine}
          reasonLine={heroVm.reasonLine}
          metaPills={heroVm.metaPills}
        />

        {heroVm.keyQuestion && (
          <HeroKeyQuestion keyQuestion={heroVm.keyQuestion} onPrefillChat={prefillChat} />
        )}

        <HeroInputRows
          inputRows={heroVm.inputRows}
          hiddenRows={heroVm.hiddenRows}
          dispatchRowAction={dispatchRowAction}
        />

        <HeroFooter
          alsoLinks={heroVm.alsoLinks}
          footerChecks={heroVm.footerChecks}
          footerHint={heroVm.footerHint}
          footerCta={heroVm.footerCta}
          onAlsoClick={handleAlsoClick}
          onCtaClick={handleCtaClick}
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
        />
      </div>
    </div>
  )
})

export default AnalysisHeroV17
