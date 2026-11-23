import { edgeIdOf } from '../../../canvas/contextMenu/laneMenu'
import type { ViewLink } from '../../client'
import { dismissMenuFromOpener } from '../../look/menuArbiter'
import { editGateNow } from './editGate'
import { writeKeyOf, type EditSpec } from './EditForm'
import { useLaneInspector, type DetailsTarget, type Point } from './inspectorStore'

export function openLaneForm(spec: EditSpec, anchor: Point, beside?: DetailsTarget, opener?: HTMLElement): boolean {
  return useLaneInspector.getState().show({ kind: 'form', spec, anchor, beside, opener, busyKey: writeKeyOf(spec) })
}

export function openLaneAdd(opener: HTMLElement): boolean {
  return dismissMenuFromOpener(opener) || (editGateNow().ok && useLaneInspector.getState().show({ kind: 'add-menu', opener }))
}

export function openLinkRemoval(link: ViewLink, opener?: HTMLElement): boolean {
  const gate = editGateNow()
  if (!gate.ok || link.remove == null) return false
  return openLaneForm({ ...gate, kind: 'remove-link', remove: link.remove, link }, { x: 372, y: 112 },
    { kind: 'link', id: edgeIdOf(link) }, opener)
}
