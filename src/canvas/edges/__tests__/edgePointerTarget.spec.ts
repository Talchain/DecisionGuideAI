/**
 * F8 — THE CLICK AND THE RIGHT-CLICK ACT ON THE LINE THE HOVER SHOWS
 * (`edgePointerTarget.ts`, review r08 blockers 1 and 2).
 *
 * The shape is the served one: build-vs-buy at the landing, "Engineering
 * Capacity → On-Time Delivery" (e-9) and "Engineering Capacity → Engineering
 * Overload" (e-10) 6px apart, e-10 painted later so its hit area is on top, the
 * pointer on e-9's line. The hover highlights e-9 (`edgeHoverArbiter`); before
 * this, a right-click there opened the menu — Delete, Reverse — for e-10.
 *
 * Driven with the REAL resolver over stubbed straight-line geometry
 * (`__helpers__/edgeLineGeometry.ts`), the real xyflow change shape, and store
 * edges bound by IDENTITY (`toBe`, never a lookalike). The call sites in
 * `ReactFlowGraph.tsx` are pinned by `reactFlowGraph.edgePointerTarget.spec.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { EdgeChange } from '@xyflow/react'
import { retargetEdgeClick, resolveContextMenuEdge, type EdgeClickFlowStore } from '../edgePointerTarget'
import { edgeGroup, stubElementsFromPoint, restoreElementsFromPoint } from './__helpers__/edgeLineGeometry'

afterEach(() => {
  document.body.innerHTML = ''
  restoreElementsFromPoint()
})

/** e-9 at y=200 and e-10 at y=206, e-10 on top (it paints later). */
function gutter() {
  const e9 = edgeGroup('e-9', 0, 200, 400, 200, { focusable: true })
  const e10 = edgeGroup('e-10', 0, 206, 400, 206, { focusable: true })
  stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
  return { e9, e10 }
}
const ON_E9_LINE = { clientX: 150, clientY: 200.5 }
const ON_E10_LINE = { clientX: 150, clientY: 205.5 }

function flowStore(selected: Record<string, boolean> = {}, multiSelectionActive = false) {
  const changes: EdgeChange[][] = []
  const flow: EdgeClickFlowStore = {
    multiSelectionActive,
    edgeLookup: { get: (id: string) => (id in selected ? { selected: selected[id] } : undefined) },
    triggerEdgeChanges: (c) => changes.push(c),
  }
  return { flow, changes }
}

describe('a click (handleEdgeClick) — the selection goes to the nearest line', () => {
  it('pointer on e-9\'s line inside e-10\'s hit area: e-10 deselected, e-9 selected, in ONE change batch', () => {
    gutter()
    const { flow, changes } = flowStore()
    expect(retargetEdgeClick(ON_E9_LINE, { id: 'e-10', selected: false }, flow)).toBe('e-9')
    expect(changes).toEqual([[
      { id: 'e-10', type: 'select', selected: false },
      { id: 'e-9', type: 'select', selected: true },
    ]])
  })

  it('CONTRAST: pointer on e-10\'s own line — xyflow\'s own click stands, no change is written', () => {
    gutter()
    const { flow, changes } = flowStore()
    expect(retargetEdgeClick(ON_E10_LINE, { id: 'e-10', selected: false }, flow)).toBe('e-10')
    expect(changes).toEqual([])
  })

  it('no pointer event (a programmatic click) — nothing is re-pointed', () => {
    gutter()
    const { flow, changes } = flowStore()
    expect(retargetEdgeClick(undefined, { id: 'e-10' }, flow)).toBeNull()
    expect(changes).toEqual([])
  })

  it('keyboard focus follows the selection to e-9 (xyflow\'s Escape / Enter act on the FOCUSED edge)', () => {
    const { e9, e10 } = gutter()
    ;(e10.g as unknown as HTMLElement).focus()
    expect(document.activeElement).toBe(e10.g) // PRECONDITION: the mousedown focused the topmost edge
    retargetEdgeClick(ON_E9_LINE, { id: 'e-10', selected: false }, flowStore().flow)
    expect(document.activeElement).toBe(e9.g)
  })
})

describe('a multi-selection click (Meta / Control held) — the TOGGLE moves to the nearest line', () => {
  it('toggle-ON: e-10 is put back as it was (unselected), e-9 is added', () => {
    gutter()
    const { flow, changes } = flowStore({ 'e-9': false, 'e-10': false }, true)
    retargetEdgeClick(ON_E9_LINE, { id: 'e-10', selected: false }, flow)
    expect(changes).toEqual([[
      { id: 'e-10', type: 'select', selected: false },
      { id: 'e-9', type: 'select', selected: true },
    ]])
  })

  it('toggle-OFF of a selected e-9 turns e-9 OFF (never selects it), and e-10 keeps its selection', () => {
    gutter()
    // Both selected before the click; xyflow toggled e-10 off (edge.selected was true).
    const { flow, changes } = flowStore({ 'e-9': true, 'e-10': true }, true)
    retargetEdgeClick(ON_E9_LINE, { id: 'e-10', selected: true }, flow)
    expect(changes).toEqual([[
      { id: 'e-10', type: 'select', selected: true },
      { id: 'e-9', type: 'select', selected: false },
    ]])
  })
})

describe('a right-click (onEdgeContextMenu) — the menu acts on the nearest line, from the store', () => {
  const storeE9 = { id: 'e-9', source: 'engineering_capacity', target: 'on_time_delivery' }
  const storeE10 = { id: 'e-10', source: 'engineering_capacity', target: 'engineering_overload' }
  const STORE = [storeE10, storeE9]

  it('pointer on e-9\'s line inside e-10\'s hit area: the menu edge IS the store\'s e-9', () => {
    gutter()
    const xyflowEdge = { ...storeE10 } // xyflow hands a COPY of the topmost edge
    expect(resolveContextMenuEdge(ON_E9_LINE, xyflowEdge, STORE)).toBe(storeE9)
  })

  it('CONTRAST: pointer on e-10\'s own line — xyflow\'s edge stands', () => {
    gutter()
    const xyflowEdge = { ...storeE10 }
    expect(resolveContextMenuEdge(ON_E10_LINE, xyflowEdge, STORE)).toBe(xyflowEdge)
  })

  it('the nearest line is not in the store — xyflow\'s edge, never undefined', () => {
    gutter()
    const xyflowEdge = { ...storeE10 }
    expect(resolveContextMenuEdge(ON_E9_LINE, xyflowEdge, [storeE10])).toBe(xyflowEdge)
  })
})
