import { useId } from 'react'
import { useCanvasStore } from '../../../store'
import { useShowToastSafe } from '../../../ToastContext'
import { useConnectGesture } from '../../../hooks/useConnectGesture'
import { resolveElementLabel } from '../../../domain/elementLabel'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../../mutations/mutationAuthority'
import { controls } from '../../../../styles/controls'
import { typography } from '../../../../styles/typography'
import { isViewerSession, useIsViewer } from '../../../../lib/viewerMode'

interface InspectorConnectPickerProps {
  nodeId: string
  label?: string
  /** Option panels narrow the canvas's valid targets to controllable factors. */
  candidateIds?: readonly string[]
  candidateValueDisplays?: ReadonlyMap<string, string | null>
  onConnected?: (targetId: string) => void
}

/** A new entrance to the canvas gesture, with its authority, validator and writer. */
export function InspectorConnectPicker({
  nodeId,
  label = 'Connect to…',
  candidateIds,
  candidateValueDisplays,
  onConnected,
}: InspectorConnectPickerProps) {
  const selectId = useId()
  const nodes = useCanvasStore(s => s.nodes)
  // The validator reads the live store; subscriptions also refresh its offered
  // pairs when a duplicate, cycle or engine limit changes without a node edit.
  useCanvasStore(s => s.edges)
  useCanvasStore(s => s.engineLimits)
  const isViewer = useIsViewer()
  const showToast = useShowToastSafe()
  const { onConnect, isValidConnection } = useConnectGesture({
    enabled: hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash) && !isViewer,
    showToast,
  })
  const candidateIdSet = candidateIds ? new Set(candidateIds) : null
  const targets = nodes.some(node => node.id === nodeId)
    ? nodes.filter(candidate =>
        (!candidateIdSet || candidateIdSet.has(candidate.id)) &&
        isValidConnection({ source: nodeId, target: candidate.id }),
      )
    : []

  if (targets.length === 0) {
    return (
      <p className={`${typography.panelMeta} text-text-light mt-2`} data-testid="inspector-connect-picker">
        No other elements can link here.
      </p>
    )
  }

  return (
    <div className="mt-2" data-testid="inspector-connect-picker">
      <label htmlFor={selectId} className="sr-only">{label}</label>
      <select
        id={selectId}
        value=""
        className={`${typography.panelMeta} ${controls.editableField}`}
        onChange={event => {
          if (isViewerSession()) return
          const targetId = event.target.value
          if (!targets.some(target => target.id === targetId)) return
          if (!isValidConnection({ source: nodeId, target: targetId })) return
          const edgeIdsBefore = new Set(useCanvasStore.getState().edges.map(edge => edge.id))
          onConnect({ source: nodeId, target: targetId, sourceHandle: null, targetHandle: null })
          const edge = useCanvasStore.getState().edges.find(candidate =>
            !edgeIdsBefore.has(candidate.id) && candidate.source === nodeId && candidate.target === targetId,
          )
          if (edge) onConnected?.(targetId)
        }}
      >
        <option value="" disabled>{label}</option>
        {targets.map(target => {
          const display = candidateValueDisplays?.get(target.id)
          const targetLabel = resolveElementLabel(target.data)
          return (
            <option key={target.id} value={target.id}>
              {display ? `${targetLabel} — ${display}` : targetLabel}
            </option>
          )
        })}
      </select>
    </div>
  )
}
