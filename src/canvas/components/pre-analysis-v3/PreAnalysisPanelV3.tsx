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
import { usePreAnalysisModel } from './hooks/usePreAnalysisModel'
import { useConversationActions } from './hooks/useConversationActions'
import { useSensitivityRanking } from './hooks/useSensitivityRanking'
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
  blockedReason?: string
}

function PanelBody({ onAnalyse, isAnalysing, blockedReason }: PreAnalysisPanelV3Props) {
  const model = usePreAnalysisModel()
  const { sendPrompt } = useConversationActions()
  useSensitivityRanking(true)

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
          onAnalyse()
          break
        case 'readiness_blocker':
          // The copy itself names the gap (CEE explanation); nothing to focus.
          break
      }
    },
    [onAnalyse],
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
          sendPrompt(action.label, action.prompt)
          break
        case 'run_analysis':
          onAnalyse()
          break
      }
    },
    [onAnalyse, sendPrompt],
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pre-analysis-v3">
      <div className="min-h-0 flex-1 overflow-y-auto">
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
        blockedReason={blockedReason}
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
