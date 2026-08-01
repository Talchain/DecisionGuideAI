/**
 * GoalSection — goal node label + editable success target.
 *
 * Shows: goal diamond icon, goal label, success threshold (raw value + unit from
 * goal node data), source provenance pill. All editable inline.
 *
 * "Show full detail" expansion: normalised threshold, node ID.
 */

import { useCallback, useContext } from 'react'
import type { Node } from '@xyflow/react'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { SourceProvenancePill } from './SourceProvenancePill'
import { InlineEdit } from './InlineEdit'
import { formatSmartNumber, formatValueWithUnit } from './utils'
import { DetailToggleContext } from './DetailToggleContext'

interface GoalSectionProps {
  goalNode: Node | undefined
  onSendMessage?: (message: string) => void
}

/**
 * ROADMAP 2.263 — `goalNode` is REQUIRED here, and that is the hooks fix.
 *
 * This component used to take `Node | undefined` and early-return `null` at the
 * top, ABOVE two `useCallback`s further down. React counts hooks per mounted
 * instance, so the moment the goal node arrived from the draft the count went
 * 2 → 4 and React threw `Rendered more hooks than during the previous render.`
 * — precisely when the model first appears, which is the worst moment for a
 * first-time tester and exactly when they are watching. It fired in reverse
 * (4 → 2) on scenario switch or clear.
 *
 * The guard moved UP into the wrapper, which has no hooks of its own, so the
 * unmount happens instead of a mid-render bail-out. Narrowing the prop is what
 * stops the guard being reintroduced here: there is no `undefined` left to test.
 */
function GoalSectionInner({ goalNode, onSendMessage }: GoalSectionProps & { goalNode: Node }) {
  const { showDetail } = useContext(DetailToggleContext)
  // ROADMAP 2.121 slice 1 — the ONE production writer of a user success target
  // (this file's own comment below has always named it). Every other
  // success-target editor in the product already commits through it:
  // GoalThresholdEditor, HeroSection, PreAnalysisPanel, OutputsDock.
  const setGoalThresholdAndUpdateNode = useCanvasStore(s => s.setGoalThresholdAndUpdateNode)

  const data = goalNode.data as Record<string, unknown>
  const label = String(data.label ?? goalNode.id)

  // Success threshold — representation contract (store.ts getGoalContext,
  // computeSuccessState, the ONLY production writer setGoalThresholdAndUpdateNode):
  // `success_threshold` under threshold_source 'user' is RAW user units, never 0–1.
  // Priority mirrors computeSuccessState: user raw → CEE raw anchor → normalised.
  // (Dress-rehearsal 2026-07-20: routing a user raw value through the ×100
  // normalised branch rendered the 50012 mis-parse as "5,001,200% likelihood".)
  const rawThreshold = data.goal_threshold_raw as number | undefined
  const thresholdUnit = data.goal_threshold_unit as string | undefined
  const thresholdSource = data.threshold_source as string | undefined
  const userRawThreshold = thresholdSource === 'user' && typeof data.success_threshold === 'number'
    ? data.success_threshold as number
    : undefined
  const thresholdNorm = (typeof data.goal_threshold === 'number' ? data.goal_threshold as number : undefined)
    ?? (thresholdSource !== 'user' && typeof data.success_threshold === 'number'
      ? data.success_threshold as number
      : undefined)
  const effectiveRaw = userRawThreshold ?? rawThreshold

  const thresholdCap = data.goal_threshold_cap as number | undefined

  const displayThreshold = effectiveRaw !== undefined && thresholdUnit
    ? formatValueWithUnit(effectiveRaw, thresholdUnit)
    : effectiveRaw !== undefined
      ? formatSmartNumber(effectiveRaw)
      : thresholdNorm !== undefined
        ? `${formatSmartNumber(thresholdNorm * 100)}% likelihood`
        : null

  // Feasibility warning: shown when target is within 15% of the model's upper bound.
  // This is a presentation heuristic (not a semantic transform) — no UI-SEM tag.
  // Rationale: targets near the cap are harder to achieve and may yield unreliable results.
  const showFeasibilityWarning = effectiveRaw !== undefined && thresholdCap !== undefined
    && thresholdCap > 0 && effectiveRaw > thresholdCap * 0.85

  /**
   * ROADMAP 2.121 slice 1 — a target edit here now moves the number the run
   * path actually forwards.
   *
   * The hand-rolled write this replaces set `goal_threshold_raw` and stamped
   * `threshold_source: 'user'` — and stopped there. Two consequences, both live:
   *
   *   1. The GLOBAL `goalThreshold` scalar never moved, so the number the run
   *      path forwards was still the pre-edit one.
   *   2. `success_threshold` never moved either — and the display priority
   *      twelve lines above prefers `success_threshold` the moment
   *      `threshold_source` is 'user'. Stamping the source while leaving the
   *      number made a STALE value OUTRANK the one the user had just typed. The
   *      edit could render as no change at all.
   *
   * `setGoalThresholdAndUpdateNode` is the atomic store+node pair: scalar,
   * `success_threshold`, `threshold_source`, `threshold_confirmed: false`, and
   * `invalidateAnalysisReady` in one action. No `opts.unit` is passed — the old
   * handler did not touch the unit and neither does this one; the action leaves
   * an existing (CEE-backfilled) unit alone.
   */
  const handleThresholdSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setGoalThresholdAndUpdateNode(goalNode.id, num)
  }, [goalNode.id, setGoalThresholdAndUpdateNode])

  const validateThreshold = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= 0
  }, [])

  return (
    <div
      className="bg-panel border border-panel-border rounded-xl p-3"
      data-testid="model-goal-section"
    >
      {/* Header: diamond icon + label */}
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-3.5 h-3.5 bg-goal shrink-0 mt-0.5"
          style={{ clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }}
          aria-hidden="true"
        />
        <span className={`${typography.panelHeader} text-text-header flex-1 min-w-0 break-words`}>
          {label}
        </span>
      </div>

      {/* Success target row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`${typography.panelMeta} text-text-light`}>Target:</span>
        {displayThreshold !== null ? (
          <InlineEdit
            value={effectiveRaw !== undefined ? String(effectiveRaw) : String((thresholdNorm ?? 0) * 100)}
            displayValue={displayThreshold}
            onSave={handleThresholdSave}
            validate={validateThreshold}
            maxWidth="max-w-[120px]"
            numeric
            tooltip="Click to edit success threshold"
            testId="goal-threshold"
          />
        ) : (
          <InlineEdit
            value=""
            placeholder="Not set"
            onSave={handleThresholdSave}
            validate={validateThreshold}
            maxWidth="max-w-[120px]"
            numeric
            tooltip="Click to set a success target"
            testId="goal-threshold-not-set"
          />
        )}
        <SourceProvenancePill source={thresholdSource} showWhenAbsent={false} />
      </div>

      {/* Coaching prompt when no target is set */}
      {displayThreshold === null && (
        <div className="mt-1" data-testid="goal-threshold-coaching">
          <span className={`${typography.panelMeta} text-text-light`}>Set a success target to help the analysis measure your options</span>
        </div>
      )}

      {/* Feasibility warning */}
      {showFeasibilityWarning && (
        <div
          className="flex items-center gap-1.5 mt-1.5"
          data-testid="goal-feasibility-warning"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden="true" />
          <span className={`${typography.panelMeta} text-danger`}>
            Near range limit: target is close to the model's upper bound
          </span>
        </div>
      )}

      {/* Discuss with AI */}
      {onSendMessage && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => onSendMessage(`Help me understand my goal '${label}' and whether the target of ${displayThreshold ?? 'not set'} is appropriate`)}
            className="text-text-light hover:text-info cursor-pointer transition-colors"
            title="Discuss this with the AI"
            data-testid="goal-discuss"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Full detail expansion */}
      {showDetail && (
        <div className="mt-2.5 pt-2.5 border-t border-panel-border space-y-0.5">
          <div className={`${typography.panelMeta} text-text-light font-medium`}>Goal threshold</div>
          <div className={`${typography.panelBody} text-text-body`}>
            The probability you need to hit for this to count as success
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
            <span className={`${typography.panelMeta} text-text-light`}>Normalised target</span>
            <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
              {thresholdNorm !== undefined ? thresholdNorm.toFixed(2) : 'Not set'}
            </span>
            {thresholdUnit && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Unit</span>
                <span className={`${typography.panelBody} text-text-body font-mono text-right`}>{thresholdUnit}</span>
              </>
            )}
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelBody} text-text-body font-mono text-right truncate`}>
              {goalNode.id}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function GoalSection({ goalNode }: GoalSectionProps) {
  // The absence guard lives HERE, in a component with no hooks, so an arriving
  // or departing goal node mounts/unmounts the inner component rather than
  // changing its hook count mid-render. See `GoalSectionInner`'s header.
  if (!goalNode) return null
  return (
    <SectionErrorBoundary section="goal">
      <GoalSectionInner goalNode={goalNode} />
    </SectionErrorBoundary>
  )
}
