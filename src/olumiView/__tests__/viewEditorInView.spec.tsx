/**
 * R5 (github-3c on Paul's "visible through canvas reflow"; set-visible.mjs check 3 on 7457343d4: the open editor's card grew near the window's
 * foot and Set ended 29 px below it): while a card's editor is open, the canvas pans just enough to keep the whole form in the free canvas,
 * once per change of the form's place, and never touches the pointer or focus. jsdom: the form's box is given; the free canvas is the
 * window less the camera's own insets (computeFitPadding). Fixture: core's european golden.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
// The viewport as the node moves it: a mounted canvas is not needed (React Flow's setViewport is a no-op without one), only what is asked.
const moves = vi.hoisted(() => ({ calls: [] as { x: number; y: number; zoom: number }[] }))
vi.mock('@xyflow/react', async (real) => {
  const rf = await real<typeof import('@xyflow/react')>()
  return { ...rf, useReactFlow: () => ({ ...rf.useReactFlow(), getViewport: () => ({ x: 0, y: 0, zoom: 1 }), setViewport: async (v: { x: number; y: number; zoom: number }) => { moves.calls.push(v); return true } }) }
})
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { computeFitPadding } from '../../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../../canvas/utils/cameraComfort'

const SID = 's_0123456789ab'
const view: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')), id: SID }
const card = view.model!.cards.find((c) => c.figure?.edit)!
let formBox = { left: 300, top: 600, width: 268, height: 160 }
beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const b = this.tagName === 'FORM' ? formBox : { left: 0, top: 0, width: 0, height: 0 }
    return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => b } as DOMRect
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const node = () => <ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>
const show = () => { moves.calls = []; return render(node()) }

describe('an open editor stays wholly in the free canvas', () => {
  it('its form\'s foot past the free canvas: the canvas pans up by exactly that much, once; pointer and focus untouched', async () => {
    const pad = paddingToInsets(computeFitPadding(null)), freeBottom = window.innerHeight - pad.bottom
    formBox = { left: 300, top: freeBottom - 120, width: 268, height: 160 } // 40 px past the free canvas
    const { rerender } = show()
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    const typed = screen.getByTestId(`view-figure-typed-${card.id}`)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(moves.calls).toEqual([{ x: 0, y: -40, zoom: 1 }])
    expect(document.activeElement).toBe(typed)
    // Once per change of the form's place: a further render with the form where it was asks for no second pan.
    rerender(node())
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(moves.calls).toHaveLength(1)
  })

  it('CONTRAST: a form already inside the free canvas does not move it', async () => {
    formBox = { left: 300, top: 300, width: 268, height: 160 }
    show()
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(moves.calls).toEqual([])
  })
})
