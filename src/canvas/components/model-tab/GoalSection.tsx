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

function GoalSectionInner({ goalNode, onSendMessage }: GoalSectionProps) {
  const { showDetail } = useContext(DetailToggleContext)
  const updateNode = useCanvasStore(s => s.updateNode)

  if (!goalNode) return null

  const data = goalNode.data as Record<string, unknown>
  const label = String(data.label ?? goalNode.id)

  // Success threshold — prefer raw value with unit, fall back to normalised
  const rawThreshold = data.goal_threshold_raw as number | undefined
  const thresholdUnit = data.goal_threshold_unit as string | undefined
  const thresholdNorm = data.success_threshold as number | undefined ?? data.goal_threshold as number | undefined
  const thresholdSource = data.threshold_source as string | undefined

  const thresholdCap = data.goal_threshold_cap as number | undefined

  const displayThreshold = rawThreshold !== undefined && thresholdUnit
    ? formatValueWithUnit(rawThreshold, thresholdUnit)
    : rawThreshold !== undefined
      ? String(formatSmartNumber(rawThreshold))
      : thresholdNorm !== undefined
        ? `${formatSmartNumber(thresholdNorm * 100)}% likelihood`
        : null

  // Feasibility warning: shown when target is within 15% of the model's upper bound.
  // This is a presentation heuristic (not a semantic transform) — no UI-SEM tag.
  // Rationale: targets near the cap are harder to achieve and may yield unreliable results.
  const showFeasibilityWarning = rawThreshold !== undefined && thresholdCap !== undefined
    && thresholdCap > 0 && rawThreshold > thresholdCap * 0.85

  const handleThresholdSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    // Store the raw value directly — no conversion here.
    // The V2 adapter is responsible for deriving normalised values from raw_value + unit.
    updateNode(goalNode.id, {
      data: {
        ...data,
        goal_threshold_raw: num,
        threshold_source: 'user',
        threshold_confirmed: false,
      },
    })
  }, [goalNode.id, data, updateNode])

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
            value={rawThreshold !== undefined ? String(rawThreshold) : String((thresholdNorm ?? 0) * 100)}
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
  return (
    <SectionErrorBoundary section="goal">
      <GoalSectionInner goalNode={goalNode} />
    </SectionErrorBoundary>
  )
}
