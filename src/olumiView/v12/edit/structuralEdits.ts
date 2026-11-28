import { useCanvasStore } from '../../../canvas/store'
import { viewLinkDataOf } from '../../canvas'
import type { ViewLink } from '../../client'
import { dismissMenuFromOpener } from '../../look/menuArbiter'
import { editGateNow } from './editGate'
import { writeKeyOf, type EditSpec } from './EditForm'
import { useLaneInspector, type DetailsTarget, type Point } from './inspectorStore'

// The older details panel opens its form at this fixed point.
export const OLDER_DETAILS_FORM_ANCHOR: Point = { x: 372, y: 112 }

export function openLaneForm(spec: EditSpec, anchor?: Point, beside?: DetailsTarget, opener?: HTMLElement): boolean {
  return useLaneInspector.getState().show({ kind: 'form', spec, anchor, beside, opener, busyKey: writeKeyOf(spec) })
}

export function openLaneAdd(opener: HTMLElement): boolean {
  return dismissMenuFromOpener(opener) || (editGateNow().ok && useLaneInspector.getState().show({ kind: 'add-menu', opener }))
}

export function openLinkRemoval(link: ViewLink, opener?: HTMLElement): boolean {
  const gate = editGateNow()
  if (!gate.ok || link.remove == null) return false
  const edge = useCanvasStore.getState().edges.find((e) => viewLinkDataOf(e)?.link === link)
  return openLaneForm({ ...gate, kind: 'remove-link', remove: link.remove, link }, undefined,
    edge === undefined ? undefined : { kind: 'link', id: edge.id }, opener)
}
