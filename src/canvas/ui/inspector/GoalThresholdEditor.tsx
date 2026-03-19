/**
 * GoalThresholdEditor — success threshold input for goal nodes
 *
 * Writes to both store.goalThreshold (for the run pipeline) and the goal node's
 * data fields (for serialisation) via setGoalThresholdAndUpdateNode.
 */

import { useState, useCallback, useEffect } from 'react'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'

interface GoalThresholdEditorProps {
  /** Optional unit to display after the input (e.g. "£", "%") */
  unit?: string
  /** The specific goal node being inspected. When provided, threshold writes target this node
   *  rather than falling back to outcomeNodeId, preventing writes to the wrong node. */
  nodeId?: string
  /** Raw threshold value from the brief (goal_threshold_raw on node data).
   *  Pre-populates the input when goalThreshold is unset and the brief provided a value. */
  thresholdRaw?: string | number | null
}

export function GoalThresholdEditor({ unit, nodeId, thresholdRaw }: GoalThresholdEditorProps = {}) {
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const setGoalThresholdAndUpdateNode = useCanvasStore(s => s.setGoalThresholdAndUpdateNode)
  const setGoalThreshold = useCanvasStore(s => s.setGoalThreshold)

  // Pre-populate from brief when goalThreshold is unset
  const rawString = thresholdRaw != null ? String(thresholdRaw) : ''
  const initialValue = goalThreshold != null
    ? String(goalThreshold)
    : rawString

  const [localValue, setLocalValue] = useState<string>(initialValue)
  // Track whether value came from brief (no user edit yet)
  const [fromBrief, setFromBrief] = useState<boolean>(
    goalThreshold == null && rawString !== '' && initialValue === rawString
  )

  // Sync when store changes externally
  useEffect(() => {
    if (goalThreshold != null) {
      setLocalValue(String(goalThreshold))
      setFromBrief(false)
    } else if (rawString !== '') {
      setLocalValue(rawString)
      setFromBrief(true)
    } else {
      setLocalValue('')
      setFromBrief(false)
    }
  }, [goalThreshold, rawString])

  const handleChange = useCallback((value: string) => {
    setLocalValue(value)
    setFromBrief(false) // user modified — dismiss provenance indicator
  }, [])

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim()
    // Use inspected nodeId first, then outcomeNodeId fallback, then scalar-only
    const targetNodeId = nodeId ?? outcomeNodeId
    const setFn = targetNodeId
      ? (v: number | null) => setGoalThresholdAndUpdateNode(targetNodeId, v)
      : setGoalThreshold
    if (!trimmed) {
      setFn(null)
      return
    }
    const parsed = parseFloat(trimmed)
    if (!isNaN(parsed)) {
      setFn(parsed)
    }
  }, [localValue, nodeId, outcomeNodeId, setGoalThresholdAndUpdateNode, setGoalThreshold])

  return (
    <div className="pt-2 border-t border-panel-border">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`${typography.panelBody} text-text-body`}>Success means reaching</span>
        <input
          id="goal-threshold"
          type="number"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="e.g. 200"
          step="any"
          className={`${typography.panelBody} border border-panel-border rounded px-2 py-1 w-28`}
        />
        {unit && <span className={`${typography.panelBody} text-text-light`}>{unit}</span>}
        {fromBrief && (
          <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2 py-0.5 rounded-full bg-transparent text-text-body border border-info/30`}>
            From your brief
          </span>
        )}
      </div>

      <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
        Analysis calculates the probability of reaching or exceeding this target
      </p>
    </div>
  )
}
