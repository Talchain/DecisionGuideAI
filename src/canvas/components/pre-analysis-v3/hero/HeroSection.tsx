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
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, FIELD_FEEDBACK_COPY, HERO_COPY, SPARK_PROMPTS } from '../constants'
import { kindOf } from '../selectors/graphFacts'
import { PanelIconButton } from '../ui/PanelIconButton'
import { BestNextStep } from './BestNextStep'
import { CoachingSlot } from './CoachingSlot'
import { InlineField } from './InlineField'
import { parseSuccessTarget } from './parseSuccessTarget'
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

// UI-SEM-086: the old digit-strip parse here (`raw.replace(/[^0-9.,-]/g,'')`)
// fabricated targets from prose — "Reach £500k … within 12 months" became
// 50012 (dress-rehearsal 2026-07-20: "Target: 50,012" on the goal node,
// "5,001,200% likelihood" in the Model tab). parseSuccessTarget extracts the
// amount the user actually stated, or fails closed.

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
      const parsed = parseSuccessTarget(raw)
      if (parsed === null) return FIELD_FEEDBACK_COPY.successFormatHint
      useCanvasStore
        .getState()
        .setGoalThresholdAndUpdateNode(
          goalNodeId,
          parsed.value,
          parsed.unit ? { unit: parsed.unit } : undefined,
        )

      // ROADMAP 1.1 fix (Gate 3 blocker, acceptance-evidence/6b-goal-capture):
      // the store write above is LOCAL-ONLY — CEE never learns this target,
      // so run_analysis (which reads goal_constraints off its OWN server-side
      // scenario graph, never off anything the client sends — confirmed in
      // olumi-assistants-service's chip-click-dispatch.ts header comment)
      // computes goal-fit against a graph with no threshold, and Goal fit
      // never unlocks. There is no deterministic/structured wire call for
      // this — `add_constraint`'s handler only accepts parameters that
      // Sonnet's own ORIENT step produced from a natural-language message
      // (see add-constraint.ts's resolveParams reading invocation.proposal.
      // parameters, not the client's chip.parameters). The chat path already
      // proves this works (6B evidence clause 3): a plain-language message
      // gets interpreted into a real add_constraint graph_patch. Reuse that
      // exact mechanism — same action_type, same free-text-description
      // shape SuccessTarget.tsx already sends (the older, non-v3 panel) —
      // instead of inventing a new one. `hidden: true` keeps this a silent
      // background sync (no chat bubble) since the user already "confirmed"
      // via the Hero's own Save-success button, not the composer.
      const dispatch = useGuidanceStore.getState()._dispatchAction
      if (dispatch) {
        const trimmed = raw.trim()
        // The user's own text is often already a full sentence (e.g. "Reduce
        // annual operating costs by at least 15%") — prefer it verbatim so
        // Sonnet has the richest signal. Bare numbers ("15") get a minimal
        // templated sentence naming the goal so the constraint isn't
        // ambiguous about which entity it targets.
        const isDescriptive = /[a-zA-Z]{3,}/.test(trimmed)
        const goalLabel = hero.goal?.label?.trim()
        const message = isDescriptive
          ? `My success target is: ${trimmed}`
          : goalLabel
            ? `My success target for "${goalLabel}" is ${parsed.value}.`
            : `My success target is ${parsed.value}.`
        dispatch({
          action_type: 'add_constraint',
          parameters: { description: message },
          label: 'Save success',
          message,
          source: 'chip',
          hidden: true,
        })
      }
      return true
    },
    [hero.goalNodeId, hero.goal],
  )

  // Attribution honesty (lane 35 fix 2): "Olumi estimate" ONLY for values
  // Olumi derived/defaulted. A target the user stated (explicit-provenance
  // stored goal constraint, or their own typed value) is credited to them.
  const successAttribution = hero.success.isSet ? (
    hero.success.attribution?.kind === 'olumi' ? (
      <Pill variant="default" size="small">
        {ATTRIBUTION_COPY.olumiEstimate}
      </Pill>
    ) : hero.success.attribution?.kind === 'person' ? (
      <Pill variant="default" size="small">
        {ATTRIBUTION_COPY.yourTarget}
      </Pill>
    ) : null
  ) : null

  return (
    <div className="px-4 py-4" data-testid="pre-analysis-v3-hero">
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

      <div className="mt-4 grid gap-2">
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
