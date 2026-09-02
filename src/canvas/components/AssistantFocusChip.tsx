/**
 * Visible ownership + dismissal surface for assistant-directed canvas focus.
 *
 * The assistant focus is intentionally independent of FocusModeChip (ordinary
 * user selection) and the two-second applied-edit pulse. Both chips may be on
 * screen together without either authority clearing the other.
 */
import { memo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'
import { useOverlayCell } from './CanvasOverlayBand'
import { useCanvasStore } from '../store'
import {
  dismissAssistantFocus,
  useAssistantFocusStore,
} from '../stores/assistantFocusStore'
import { ICON_STANDALONE } from '../conversation/panelIcons'

export const AssistantFocusChip = memo(function AssistantFocusChip() {
  const target = useAssistantFocusStore((state) => state.target)
  const currentScenarioId = useCanvasStore((state) => state.currentScenarioId)
  const targetExists = useCanvasStore((state) => {
    if (!target) return false
    return target.kind === 'edge'
      ? state.edges.some((edge) => edge.id === target.id)
      : state.nodes.some((node) => node.id === target.id)
  })

  const scenarioMatches =
    target?.scenarioId == null || target.scenarioId === currentScenarioId

  // Deletion and scenario replacement are identity boundaries. Hide in the
  // same render and retire the authority immediately afterwards; a same-id
  // node in another scenario must never inherit the prior focus.
  useEffect(() => {
    if (target && (!targetExists || !scenarioMatches)) dismissAssistantFocus()
  }, [target, targetExists, scenarioMatches])

  const wants = Boolean(target) && targetExists && scenarioMatches
  // `target` already names this component's focus target, so the cell's portal
  // target is aliased rather than shadowed.
  const { granted, target: cell } = useOverlayCell('bottom-centre', 'assistant-focus-chip', wants)

  if (!wants || !target || !granted) return null

  const body = (
    <div
      className="inline-flex max-w-[min(32rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-info/40 bg-panel px-3 py-2 shadow-2"
      role="status"
      aria-live="polite"
      data-testid="assistant-focus-chip"
      data-focus-id={target.id}
      data-focus-kind={target.kind}
    >
      <Sparkles size={ICON_STANDALONE} className="shrink-0 text-info" aria-hidden="true" />
      <span className="truncate text-sm text-text-body">
        Olumi focus: <strong className="font-medium">{target.label}</strong>
      </span>
      <button
        type="button"
        onClick={dismissAssistantFocus}
        className="shrink-0 rounded-full p-1 text-text-light transition-colors hover:bg-panel-hover hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info motion-reduce:transition-none"
        aria-label={`Dismiss Olumi focus on ${target.label}`}
        title="Dismiss focus"
      >
        <X size={ICON_STANDALONE} aria-hidden="true" />
      </button>
    </div>
  )

  return cell ? createPortal(body, cell) : body
})

export default AssistantFocusChip
