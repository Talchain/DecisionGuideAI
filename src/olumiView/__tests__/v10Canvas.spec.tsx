/**
 * v10 on the mounted core-lane canvas (Codex review dgai-v10 00002 #2): ViewCanvas itself draws every View card through v10's wrapper
 * (its Olumi corner and driver badge) and carries v10's rulings attribute while it is up. The dock and the attention card are left out
 * (they are not v10's and need the whole app), so this binds the canvas's own wiring, not what lives beside it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { currentModel } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { drawViewCanvas, useViewFocusCard, useViewFocusLink } from '../canvas'
import { causalPlaces } from '../layout'
import { ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'

vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
afterEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }) })

describe('the mounted core-lane canvas', () => {
  it('draws every View card on the previous card frame with core\'s body, the driver badge where core gives one, and carries v10\'s rulings while it is up', async () => {
    const model = currentModel({ view: golden('bakery'), error: null, stale: false })!
    const places = await causalPlaces(model, new Map())
    act(() => { drawViewCanvas(model, places) })
    const { container, unmount } = render(<div style={{ width: 1440, height: 900 }}><ViewCanvas /></div>)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.documentElement.dataset['presentation']).toBe('v10')
    const wrapped = [...container.querySelectorAll('[data-core-card]')]
    expect(wrapped.map((e) => e.getAttribute('data-core-card')).sort()).toEqual(model.cards.map((c) => c.id).sort())
    const withDriver = model.cards.filter((c) => c.driver !== null).map((c) => c.id).sort()
    const badges = [...container.querySelectorAll('[data-testid^="view-driver-"]:not([data-testid^="view-driver-mark-"])')]
    expect(badges.map((e) => e.getAttribute('data-testid')!.slice('view-driver-'.length)).sort()).toEqual(withDriver)
    // Each in the previous frame's corner place (`cornerSlot`); the Olumi corner's place is bound in v10Lane.spec, where a chat receives asks.
    expect(withDriver.length, 'contrast: the bakery has drivers').toBeGreaterThan(0)
    unmount()
    expect(document.documentElement.dataset['presentation']).toBeUndefined()
  })
  it('catch (DL 7 Nov: words on focus alone): focus landing on a link\'s edge in the mounted canvas names that link; leaving it names none', async () => {
    const model = currentModel({ view: golden('bakery'), error: null, stale: false })!
    const places = await causalPlaces(model, new Map())
    // The scenario core holds (UI restore stage 1, row 4: a scenario with no brief yet shows the welcome composer, which takes focus).
    act(() => { useViewStore.setState({ uuid: 'u', sid: golden('bakery').id, view: golden('bakery'), status: 'ready' } as never); drawViewCanvas(model, places) })
    const { container, unmount } = render(<div style={{ width: 1440, height: 900 }}><ViewCanvas /></div>)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    // React Flow's focusable edge wrapper as it draws one (jsdom measures no card, so it draws no edge of its own here).
    const pane = container.querySelector('[data-testid="view-canvas"]')!
    pane.insertAdjacentHTML('beforeend', '<svg><g class="react-flow__edge" data-id="a->b:plain" tabindex="0"><path></path></g></svg>')
    fireEvent.focusIn(pane.querySelector('g.react-flow__edge')!)
    expect(useViewFocusLink.getState().id).toBe('a->b:plain')
    fireEvent.focusOut(pane.querySelector('g.react-flow__edge')!)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) // focus going nowhere is decided once the page settles
    expect(useViewFocusLink.getState().id).toBeNull()
    // Catch (7 Nov run 0758): a control replaced by its own press ("Remove link" → its ask) takes focus with it; the link stays named.
    pane.insertAdjacentHTML('beforeend', '<div data-link-for="a->b:plain"><button data-press="">Remove link</button></div>')
    const press = pane.querySelector('[data-press]')!
    fireEvent.focusIn(press)
    expect(useViewFocusLink.getState().id).toBe('a->b:plain')
    fireEvent.focusOut(press, { relatedTarget: null }); press.remove()
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(useViewFocusLink.getState().id).toBe('a->b:plain')
    useViewFocusLink.setState({ id: null })
    // A card: focus on a control inside it names the card (plan v3: its words open on keyboard focus); leaving names none.
    pane.insertAdjacentHTML('beforeend', '<div class="react-flow__node" data-id="c1"><button>✎</button></div>')
    fireEvent.focusIn(pane.querySelector('.react-flow__node[data-id="c1"] button')!)
    expect([useViewFocusCard.getState().id, useViewFocusLink.getState().id]).toEqual(['c1', null])
    // Moving between two controls of the card keeps it named (no close for a render); leaving the canvas names none.
    pane.querySelector('.react-flow__node[data-id="c1"]')!.insertAdjacentHTML('beforeend', '<button data-second="">Rename</button>')
    const inCard = pane.querySelector('.react-flow__node[data-id="c1"] [data-second]')!
    fireEvent.focusOut(pane.querySelector('.react-flow__node[data-id="c1"] button')!, { relatedTarget: inCard })
    expect(useViewFocusCard.getState().id).toBe('c1')
    fireEvent.focusOut(inCard, { relatedTarget: null })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(useViewFocusCard.getState().id).toBeNull()
    // Focus landing anywhere outside the canvas (the dock's "Add a figure") names no card (DL 7 Nov run 0717: F1 stayed open beside the next).
    const outside = document.body.appendChild(document.createElement('button'))
    fireEvent.focusIn(inCard)
    fireEvent.focusIn(outside)
    expect(useViewFocusCard.getState().id).toBeNull()
    outside.remove()
    // A press on the empty canvas lets go; so does the canvas leaving.
    fireEvent.focusIn(inCard)
    fireEvent.click(container.querySelector('.react-flow__pane')!)
    expect(useViewFocusCard.getState().id).toBeNull()
    fireEvent.focusIn(inCard)
    unmount()
    expect(useViewFocusCard.getState().id).toBeNull()
  })
})
