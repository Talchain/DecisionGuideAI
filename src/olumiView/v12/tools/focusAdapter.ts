/**
 * LOCAL ADAPTER for lane B's one focus state (05-PANEL-DESIGN-AMENDMENTS.md, A1), written by lane C because lane B's hook was not yet on
 * wip/s4-lane-b-panel. S4 swaps every import of this file for lane B's hook at the join; keep the signature.
 * The subject is what the person has selected on the canvas: exactly one card, else nothing. Read only; it never selects.
 */
import { useCanvasStore } from '../../../canvas/store'

export type ToolSubject = { readonly kind: 'card'; readonly id: string } | null

export function useToolSubject(): ToolSubject {
  const ids = useCanvasStore((s) => s.selection.nodeIds)
  if (ids.size !== 1) return null
  const [id] = [...ids]
  return id === undefined ? null : { kind: 'card', id }
}
