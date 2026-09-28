/**
 * THE DRAW-A-LINK GESTURE, driven through the handlers `ReactFlowGraph` mounts,
 * against the REAL canvas store.
 *
 * edit-structure/F5 (canvas audit, 27 Sep 2026): releasing a new connection on
 * the target card's BODY toasted "This connection is not allowed." and made
 * nothing, although no self-loop, duplicate, limit or cycle applied (served,
 * pricing-model: D1 body centre and D2 body 25px below the handle both refused;
 * D5 6px from the invisible top handle created the link; D6 on the body AFTER
 * the link existed said "already exists", so the body drop already knew its
 * target). It now makes the link. Drops on empty canvas stay silent, and the
 * real refusals keep their messages.
 *
 * edit-structure/F3 (disclosure half): a drawn link with no strength stands down
 * and is never sent; the gesture now selects it and raises its panel, where the
 * add-control states the strength that sends it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useConnectGesture, CONNECTION_REFUSAL_COPY } from '../useConnectGesture'
import { useCanvasStore } from '../../store'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'
import { SHARED_MODEL_AUTHORITY_COPY } from '../../mutations/mutationAuthority'

const FALSE_REASON = 'This connection is not allowed.'

function node(id: string, type: string, label: string) {
  return { id, type, position: { x: 0, y: 0 }, data: { label, kind: type } }
}

function seed(edges: Array<{ id: string; source: string; target: string; data?: unknown }> = []) {
  useCanvasStore.setState({
    currentScenarioId: null,
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    _externalMutationActive: 0,
    pendingStructuralAddEdges: [],
    nodes: [
      node('fac_adoption_friction', 'factor', 'Bottom-Up Adoption Friction'),
      node('out_nrr', 'outcome', 'Net Revenue Retention'),
      node('opt_hybrid', 'option', 'Hybrid pricing'),
      node('goal_revenue', 'goal', 'Revenue'),
    ],
    edges: edges.map((e) => ({ type: 'styled', data: {}, ...e })),
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
  } as never)
}

/** A card as React Flow renders it, with an inner element to release the pointer over. */
function cardBody(id: string): HTMLElement {
  const card = document.createElement('div')
  card.className = 'react-flow__node react-flow__node-outcome'
  card.setAttribute('data-id', id)
  const body = document.createElement('p')
  body.textContent = 'card body text'
  card.appendChild(body)
  document.body.appendChild(card)
  return body
}

function pane(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'react-flow__pane'
  document.body.appendChild(el)
  return el
}

const release = (target: HTMLElement) => ({ target } as unknown as MouseEvent)
const edgePairs = () => useCanvasStore.getState().edges.map((e) => `${e.source}>${e.target}`)

let toasts: Array<[string, string]>
const showToast = vi.fn((m: string, t: string) => { toasts.push([m, t]) })
let inspectorOpens: number
const onInspector = () => { inspectorOpens += 1 }

beforeEach(() => {
  toasts = []
  inspectorOpens = 0
  showToast.mockClear()
  seed()
  window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onInspector)
})

afterEach(() => {
  window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onInspector)
  document.body.innerHTML = ''
})

function gesture(enabled = true) {
  return renderHook(() => useConnectGesture({ enabled, showToast })).result.current
}

describe('F5 — a release on the target card body', () => {
  it('⭐ makes the link (the connection is allowed), and never says "not allowed"', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('out_nrr')))

    expect(edgePairs()).toEqual(['fac_adoption_friction>out_nrr'])
    expect(toasts.map(([m]) => m)).not.toContain(FALSE_REASON)
  })

  it('a drag begun on a top (input) handle reads the other way round', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'out_nrr', handleType: 'target' })
    g.onConnectEnd(release(cardBody('fac_adoption_friction')))
    expect(edgePairs()).toEqual(['fac_adoption_friction>out_nrr'])
  })

  it('CONTRAST: a release on empty canvas stays silent and makes nothing', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(pane()))
    expect(edgePairs()).toEqual([])
    expect(toasts).toEqual([])
  })

  it('CONTRAST: the real refusals keep their reasons — duplicate', () => {
    seed([{ id: 'e1', source: 'fac_adoption_friction', target: 'out_nrr' }])
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('out_nrr')))
    expect(edgePairs()).toEqual(['fac_adoption_friction>out_nrr'])
    expect(toasts).toEqual([[CONNECTION_REFUSAL_COPY.duplicate, 'warning']])
  })

  it('CONTRAST: the real refusals keep their reasons — cycle', () => {
    seed([{ id: 'e1', source: 'out_nrr', target: 'fac_adoption_friction' }])
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('out_nrr')))
    expect(edgePairs()).toEqual(['out_nrr>fac_adoption_friction'])
    expect(toasts).toEqual([[CONNECTION_REFUSAL_COPY.cycle, 'warning']])
  })

  it('a release back on the source card is a silent no-op', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('fac_adoption_friction')))
    expect(edgePairs()).toEqual([])
    expect(toasts).toEqual([])
  })

  it('a card that is not on the model (a ghost suggestion) is not a target', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('__ghost-option-1')))
    expect(edgePairs()).toEqual([])
    expect(toasts).toEqual([])
  })

  it('a handle drop (onConnect) creates once; the end callback that follows does not add a second', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnect({ source: 'fac_adoption_friction', target: 'out_nrr', sourceHandle: null, targetHandle: null })
    g.onConnectEnd(release(cardBody('out_nrr')))
    expect(edgePairs()).toEqual(['fac_adoption_friction>out_nrr'])
  })

  it('with the edge-draw carrier off, nothing is made and the authority sentence is given', () => {
    const g = gesture(false)
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('out_nrr')))
    expect(edgePairs()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
  })
})

describe('F3 — the drawn link that cannot be sent yet is put in front of the user', () => {
  it('⭐ the new link stood down, so it is selected and its panel is raised', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_adoption_friction', handleType: 'source' })
    g.onConnectEnd(release(cardBody('out_nrr')))

    const drawn = useCanvasStore.getState().edges.find((e) => e.source === 'fac_adoption_friction')!
    expect((drawn.data as { structuralAddStandDown?: string }).structuralAddStandDown).toBe('strength_not_stated')
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([drawn.id])
    expect(inspectorOpens).toBe(1)
  })

  it('the same through a handle drop (onConnect)', () => {
    const g = gesture()
    g.onConnect({ source: 'fac_adoption_friction', target: 'out_nrr', sourceHandle: null, targetHandle: null })
    const drawn = useCanvasStore.getState().edges[0]
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([drawn.id])
    expect(inspectorOpens).toBe(1)
  })

  it('CONTRAST: a structural option → factor link rides its convention (no stand-down), so no panel is forced open', () => {
    const g = gesture()
    g.onConnect({ source: 'opt_hybrid', target: 'fac_adoption_friction', sourceHandle: null, targetHandle: null })
    const drawn = useCanvasStore.getState().edges[0]
    expect((drawn.data as { structuralAddStandDown?: string }).structuralAddStandDown).toBeUndefined()
    expect(inspectorOpens).toBe(0)
  })
})
