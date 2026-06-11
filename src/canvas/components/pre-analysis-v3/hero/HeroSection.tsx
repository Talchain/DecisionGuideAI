/**
 * HeroSection — the decision (hexagon, per the DS shape system: diamond is
 * reserved for goals), inline goal and success fields, the reserved CEE
 * coaching slot, and the best next step.
 *
 * Commits go straight to the canonical store writes (updateNodeLabel,
 * setGoalThresholdAndUpdateNode) so every derived surface updates in one
 * pass. The success field accepts a display-scale number — the same scale
 * the existing goal-threshold editor writes.
 */

import { memo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../store'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, FIELD_FEEDBACK_COPY, HERO_COPY, SPARK_PROMPTS } from '../constants'
import { kindOf } from '../selectors/graphFacts'
import { PanelIconButton } from '../ui/PanelIconButton'
import { BestNextStep } from './BestNextStep'
import { CoachingSlot } from './CoachingSlot'
import { InlineField } from './InlineField'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'
import type { LadderStep } from '../types'

export const GOAL_INPUT_ID = 'pre-analysis-v3-goal'
export const SUCCESS_INPUT_ID = 'pre-analysis-v3-success'

interface HeroSectionProps {
  hero: PreAnalysisModel['hero']
  ladder: LadderStep
  onSendPrompt: (label: string, prompt: string) => void
  onLadderAct: (step: LadderStep) => void
}

function parseDisplayNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  if (cleaned.trim() === '') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export const HeroSection = memo(function HeroSection({
  hero,
  ladder,
  onSendPrompt,
  onLadderAct,
}: HeroSectionProps) {
  const commitGoal = useCallback(
    (raw: string): true | string => {
      const label = raw.trim()
      if (label === '') return FIELD_FEEDBACK_COPY.goalEmptyHint
      const store = useCanvasStore.getState()
      if (hero.goal) {
        store.updateNodeLabel(hero.goal.nodeId, label)
        return true
      }
      // No goal yet: create one, then name it.
      const limit = store.addNode(undefined, 'goal')
      if (limit) return FIELD_FEEDBACK_COPY.modelSizeLimit
      const created = useCanvasStore
        .getState()
        .nodes.filter(n => kindOf(n) === 'goal')
        .at(-1)
      if (!created) return FIELD_FEEDBACK_COPY.goalEmptyHint
      useCanvasStore.getState().updateNodeLabel(created.id, label)
      return true
    },
    [hero.goal],
  )

  const commitSuccess = useCallback(
    (raw: string): true | string => {
      const goalNodeId = hero.goalNodeId
      if (!goalNodeId) return FIELD_FEEDBACK_COPY.successNeedsGoalHint
      const parsed = parseDisplayNumber(raw)
      if (parsed === null) return FIELD_FEEDBACK_COPY.successFormatHint
      useCanvasStore.getState().setGoalThresholdAndUpdateNode(goalNodeId, parsed)
      return true
    },
    [hero.goalNodeId],
  )

  const successAttribution =
    hero.success.isSet && hero.success.attribution?.kind === 'olumi' ? (
      <Pill variant="default" size="small">
        {ATTRIBUTION_COPY.olumiEstimate}
      </Pill>
    ) : null

  return (
    <div className="border-b border-panel-border px-4 py-3" data-testid="pre-analysis-v3-hero">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none">
          <NodeShapeIndicator nodeKind="decision" size={14} />
        </span>
        <h1
          className={`${typography.panelHeader} line-clamp-2 min-w-0 flex-1 text-text-header`}
          title={hero.decisionTitle ?? undefined}
        >
          {hero.decisionTitle ?? HERO_COPY.decisionFallback}
        </h1>
        <Tooltip content={HERO_COPY.pressureTestDecision} delay={300}>
          <PanelIconButton
            variant="ai"
            aria-label="Pressure-test the frame with Olumi"
            onClick={() =>
              onSendPrompt(SPARK_PROMPTS.pressureTestFrame.label, SPARK_PROMPTS.pressureTestFrame.prompt)
            }
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </PanelIconButton>
        </Tooltip>
      </div>

      <div className="mt-3 grid gap-2">
        <InlineField
          inputId={GOAL_INPUT_ID}
          label={HERO_COPY.goalFieldLabel}
          ariaLabel="Goal"
          value={hero.goal?.label ?? ''}
          placeholder={HERO_COPY.goalPlaceholder}
          attention={!hero.goal}
          onCommit={commitGoal}
          trailing={
            <Tooltip content={HERO_COPY.pressureTestGoal} delay={300}>
              <PanelIconButton
                variant="ai"
                aria-label="Pressure-test the goal with Olumi"
                onClick={() =>
                  onSendPrompt(
                    SPARK_PROMPTS.pressureTestFrame.label,
                    SPARK_PROMPTS.pressureTestFrame.prompt,
                  )
                }
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </PanelIconButton>
            </Tooltip>
          }
        />
        <InlineField
          inputId={SUCCESS_INPUT_ID}
          label={HERO_COPY.successFieldLabel}
          ariaLabel="Success measure"
          value={hero.success.displayText ?? ''}
          placeholder={HERO_COPY.successPlaceholder}
          attention={hero.goal != null && !hero.success.isSet}
          onCommit={commitSuccess}
          trailing={
            <>
              {successAttribution}
              <Tooltip content={HERO_COPY.defineSuccess} delay={300}>
                <PanelIconButton
                  variant="ai"
                  aria-label="Define success with Olumi"
                  onClick={() =>
                    onSendPrompt(SPARK_PROMPTS.defineSuccess.label, SPARK_PROMPTS.defineSuccess.prompt)
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </PanelIconButton>
              </Tooltip>
            </>
          }
        />
      </div>

      <CoachingSlot coaching={hero.coaching} />
      <BestNextStep ladder={ladder} onAct={onLadderAct} />
    </div>
  )
})
