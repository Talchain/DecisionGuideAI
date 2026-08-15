/**
 * Imperative bridge for assistant-directed canvas focus.
 *
 * The registered camera callbacks may move the viewport, but they must never
 * write ordinary React Flow selection or the transient applied-edit pulse.
 * Visual/lifetime authority lives in assistantFocusStore; this bridge only
 * asks the mounted canvas to frame the exact target.
 */
import {
  activateAssistantFocus,
  type ActivateAssistantFocusInput,
} from '../stores/assistantFocusStore'

type AssistantNodeCameraFn = (nodeId: string) => void
type AssistantEdgeCameraFn = (edgeId: string) => void

let nodeCameraImpl: AssistantNodeCameraFn | null = null
let edgeCameraImpl: AssistantEdgeCameraFn | null = null

export function registerAssistantFocusCamera(
  focusNode: AssistantNodeCameraFn,
  focusEdge: AssistantEdgeCameraFn,
): () => void {
  nodeCameraImpl = focusNode
  edgeCameraImpl = focusEdge
  return () => {
    // Ownership guard: stale cleanup from an old canvas mount cannot remove a
    // newer mount's callbacks.
    if (nodeCameraImpl === focusNode) {
      nodeCameraImpl = null
      edgeCameraImpl = null
    }
  }
}

/**
 * Publish the persistent visual focus, then frame it when a canvas is mounted.
 * Store publication does not depend on camera availability, so the dispatcher
 * never reports a selection mutation as a substitute for missing camera work.
 */
export function focusAssistantTarget(input: ActivateAssistantFocusInput): void {
  activateAssistantFocus(input)
  if (input.kind === 'edge') edgeCameraImpl?.(input.id)
  else nodeCameraImpl?.(input.id)
}
