/**
 * GoalThresholdEditor — success threshold input for goal nodes
 *
 * B.I.8: Store path is authoritative. Adapter line 1190 overwrites analysisReady.
 * Do not also write to node data — that creates a precedence bug.
 * Writes to store.setGoalThreshold() ONLY.
 */

import { useState, useCallback, useEffect } from 'react'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'

interface GoalThresholdEditorProps {
  /** Optional unit to display after the input (e.g. "£", "%") */
  unit?: string
}

export function GoalThresholdEditor({ unit }: GoalThresholdEditorProps = {}) {
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const setGoalThreshold = useCanvasStore(s => s.setGoalThreshold)

  const [localValue, setLocalValue] = useState<string>(
    goalThreshold != null ? String(goalThreshold) : ''
  )

  // Sync when store changes externally
  useEffect(() => {
    setLocalValue(goalThreshold != null ? String(goalThreshold) : '')
  }, [goalThreshold])

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim()
    if (!trimmed) {
      // B.I.8: Clear threshold — store path is authoritative
      setGoalThreshold(null)
      return
    }
    const parsed = parseFloat(trimmed)
    if (!isNaN(parsed)) {
      // B.I.8: Write to store only. Adapter line 1190 overwrites analysisReady.
      setGoalThreshold(parsed)
    }
  }, [localValue, setGoalThreshold])

  return (
    <div className="pt-2 border-t border-panel-border">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`${typography.panelBody} text-text-body`}>Success means reaching</span>
        <input
          id="goal-threshold"
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="e.g. 200"
          step="any"
          className={`${typography.panelBody} border border-panel-border rounded px-2 py-1 w-28`}
        />
        {unit && <span className={`${typography.panelBody} text-text-light`}>{unit}</span>}
      </div>

      <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
        Analysis calculates the probability of reaching or exceeding this target
      </p>
    </div>
  )
}
