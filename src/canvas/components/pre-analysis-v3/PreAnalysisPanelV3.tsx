/**
 * PreAnalysisPanelV3 — composition shell for the outcome-centred pre-analysis
 * panel (grounded spec v2; docs/pre-analysis-panel-solution-design-v1.md).
 *
 * Flag-gated by `preAnalysisV3`; mounted by OutputsDock in the Analysis tab
 * pre-run slot. All data derives from usePreAnalysisModel (single source of
 * truth); run authority stays with OutputsDock via the onAnalyse props.
 */

import { memo, useCallback, useState } from 'react'
import { CanvasErrorBoundary } from '../../ErrorBoundary'
import { useShowToast } from '../../ToastContext'
import { FOOTER_COPY } from './constants'
import { guardCeeText } from './signals/ceeTextGuard'
import { usePreAnalysisModel } from './hooks/usePreAnalysisModel'
import { useConversationActions } from './hooks/useConversationActions'
import { useSensitivityRanking } from './hooks/useSensitivityRanking'
import { GoalTargetNudge } from '../pre-analysis/GoalTargetNudge'
import { PanelHeader } from './header/PanelHeader'
import { HeroSection, GOAL_INPUT_ID, SUCCESS_INPUT_ID } from './hero/HeroSection'
import { SharpenSection } from './sharpen/SharpenSection'
import { YourDecisionSection } from './model/YourDecisionSection'
import { AdvancedSection } from './advanced/AdvancedSection'
import { PanelFooter } from './footer/PanelFooter'
import type { LadderStep, SignalView } from './types'

export interface PreAnalysisPanelV3Props {
  onAnalyse: () => void
  isAnalysing: boolean
  /** The run gate (OutputsDock's canRunAnalysis). The single gate authority. */
  canRun: boolean
  /**
   * OutputsDock's run tooltip. Advisory when canRun is true (ignored for
   * gating); the blocked explanation when canRun is false.
   */
  blockedReason?: string
}

function PanelBody({ onAnalyse, isAnalysing, canRun, blockedReason }: PreAnalysisPanelV3Props) {
  const model = usePreAnalysisModel()
  const { sendPrompt } = useConversationActions()
  const showToast = useShowToast()
  useSensitivityRanking(true)

  // The ladder gates on CEE readiness, but OutputsDock's gate also covers
  // validation blockers and in-flight runs — a "run" action against a closed
  // gate must explain itself, never silently no-op.
  const runOrExplain = useCallback(() => {
    if (canRun && !isAnalysing) {
      onAnalyse()
      return
    }
    showToast(
      blockedReason
        ? guardCeeText(blockedReason, FOOTER_COPY.notReadySubFallback).text
        : FOOTER_COPY.notReadySubFallback,
      'info',
    )
  }, [canRun, isAnalysing, onAnalyse, blockedReason, showToast])

  const [estimateFocus, setEstimateFocus] = useState<{ nodeId: string; seq: number } | null>(null)

  const handleLadderAct = useCallback(
    (step: LadderStep) => {
      switch (step.kind) {
        case 'set_goal':
          document.getElementById(GOAL_INPUT_ID)?.focus()
          break
        case 'set_success':
          document.getElementById(SUCCESS_INPUT_ID)?.focus()
          break
        case 'calibrate_top':
          if (step.targetFactorId) {
            setEstimateFocus(prev => ({ nodeId: step.targetFactorId!, seq: (prev?.seq ?? 0) + 1 }))
          }
          break
        case 'run_first':
          runOrExplain()
          break
        case 'readiness_blocker':
          // The copy itself names the gap (CEE explanation); nothing to focus.
          break
      }
    },
    [runOrExplain],
  )

  const handleSignalAction = useCallback(
    (view: SignalView) => {
      const action = view.detection.action
      if (!action) return
      switch (action.type) {
        case 'focus_goal_field':
          document.getElementById(GOAL_INPUT_ID)?.focus()
          break
        case 'focus_success_field':
          document.getElementById(SUCCESS_INPUT_ID)?.focus()
          break
        case 'open_estimates':
          setEstimateFocus(prev => ({
            nodeId: action.nodeId ?? '',
            seq: (prev?.seq ?? 0) + 1,
          }))
          break
        case 'send_prompt':
          sendPrompt(action.spark)
          break
        case 'run_analysis':
          runOrExplain()
          break
      }
    },
    [runOrExplain, sendPrompt],
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pre-analysis-v3">
      {/* No flex-1: content sits at natural height (footer follows it), and
          shrinks to keep the footer visible only when it overflows. */}
      <div className="min-h-0 overflow-y-auto">
        {/* Success-target elicitation nudge (also mounted in the legacy
            PreAnalysisPanel). On the deployed staging build the V3 panel is
            the LIVE surface (flags baked via the Netlify dashboard env, not
            netlify.toml), so the nudge must live here too or it is dark. Same
            gating as the legacy mount — a goal exists AND no success target is
            set — expressed in V3 model terms (hero.goal / hero.success.isSet).
            Routes into the V3 panel's OWN setter seam: focus the inline
            success field by id, the same route handleLadderAct('set_success')
            and handleSignalAction('focus_success_field') use — no second
            editor. Unlocks the honestly-gated Goal-fit lens; vanishes the
            instant a target is set; never blocks analysis. */}
        <div className="px-4 pt-4">
          <GoalTargetNudge
            hasGoalNode={model.hero.goal != null}
            hasSuccessTarget={model.hero.success.isSet}
            onSetTarget={() => document.getElementById(SUCCESS_INPUT_ID)?.focus()}
          />
        </div>
        <PanelHeader bars={model.bars} onAction={sendPrompt} />
        <HeroSection
          hero={model.hero}
          ladder={model.ladder}
          onSendPrompt={sendPrompt}
          onLadderAct={handleLadderAct}
        />
        <SharpenSection
          signals={model.sharpen}
          onSendPrompt={sendPrompt}
          onAction={handleSignalAction}
        />
        <YourDecisionSection model={model} onSendPrompt={sendPrompt} estimateFocus={estimateFocus} />
        <AdvancedSection advanced={model.advanced} />
      </div>
      <PanelFooter
        footer={model.footer}
        onAnalyse={onAnalyse}
        isAnalysing={isAnalysing}
        canRun={canRun}
        blockedReason={blockedReason}
        // ROADMAP 2.332 / 2.339 — when the readiness CHECK failed, this footer
        // is the surface that used to claim "Analysis available" about a model
        // nothing had assessed. It says so instead. Run authority is unchanged.
        readinessCheck={model.readinessCheck}
      />
    </div>
  )
}

export const PreAnalysisPanelV3 = memo(function PreAnalysisPanelV3(props: PreAnalysisPanelV3Props) {
  return (
    <CanvasErrorBoundary>
      <PanelBody {...props} />
    </CanvasErrorBoundary>
  )
})

export default PreAnalysisPanelV3
