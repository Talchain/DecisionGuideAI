/**
 * Design QA 9: approving a change shows a pulse on the card it adds. On the lane the canvas follows the View (src/olumiView/canvas.ts):
 * a card that arrives on a canvas already holding the model is pulsed once it is drawn; the first drawing of a scenario pulses nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { useCanvasStore } from '../../canvas/store'
import { PULSE_COALESCE_MS } from '../../canvas/utils/appliedEditPulse'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { useViewCanvas } from '../../olumiView/canvas'

const v2: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
const added = v2.model!.cards.at(-1)!
const v1: View = { ...v2, model: { ...v2.model!, cards: v2.model!.cards.filter((c) => c.id !== added.id), links: v2.model!.links.filter((l) => l.from !== added.id && l.to !== added.id) } }
const has = (id: string) => useCanvasStore.getState().highlightedNodes.has(id)

beforeEach(() => {
  vi.useFakeTimers()
  useCanvasStore.setState({ nodes: [], edges: [], highlightedNodes: new Set() } as never)
  useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view: null, status: 'none', error: null, stale: false })
})
afterEach(() => { vi.useRealTimers() })

describe('the card an approval adds is pulsed when it arrives', () => {
  it('the first drawing of a scenario pulses nothing; a card a later View adds is pulsed once it is on the canvas', async () => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: v1, status: 'ready' }) })
    await vi.waitFor(() => expect(on(v1.model!.cards[0]!.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    expect(v1.model!.cards.some((c) => has(c.id))).toBe(false)
    act(() => { useViewStore.setState({ view: v2 }) })
    await vi.waitFor(() => expect(on(added.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    expect(has(added.id)).toBe(true)
    expect(v1.model!.cards.some((c) => has(c.id))).toBe(false)
  })

  it('a newer version pulses the cards it applied: the one whose figure core now words differently and the one the proposal marked; others stay still', async () => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    const base = v2.model!, n = v2.version!.n
    const [edited, marked, still] = base.cards.filter((c) => c.figure !== null)
    const held: View = { ...v2, id: 's_pulse0000001', model: { ...base, cards: base.cards.map((c) => (c.id === marked!.id ? { ...c, change: { glyph: '+', title: 'Proposed addition' } } : c)) } }
    const applied: View = { ...held, version: { ...v2.version!, n: n + 1 }, model: { ...base, cards: base.cards.map((c) => (c.id === edited!.id ? { ...c, figure: { ...c.figure!, text: `${c.figure!.text} (new)` } } : c)) } }
    useViewStore.setState({ sid: held.id })
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: held, status: 'ready' }) })
    await vi.waitFor(() => expect(on(marked!.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    act(() => { useViewStore.setState({ view: applied }) })
    await vi.waitFor(() => expect(has(edited!.id)).toBe(false))
    await vi.waitFor(() => { vi.advanceTimersByTime(PULSE_COALESCE_MS + 20); expect(has(edited!.id)).toBe(true) })
    expect([has(marked!.id), has(still!.id)]).toEqual([true, false])
  })

  it('CONTRAST: the same version redrawn with a different figure (a proposal held, nothing applied) pulses nothing', async () => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    const base = v2.model!, edited = base.cards.find((c) => c.figure !== null)!
    const first: View = { ...v2, id: 's_pulse0000002' }
    const proposed: View = { ...first, model: { ...base, cards: base.cards.map((c) => (c.id === edited.id ? { ...c, figure: { ...c.figure!, text: `${c.figure!.text} (new)` } } : c)) } }
    useViewStore.setState({ sid: first.id })
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: first, status: 'ready' }) })
    await vi.waitFor(() => expect(on(edited.id)).toBe(true))
    act(() => { useViewStore.setState({ view: proposed }) })
    await vi.waitFor(() => expect((useCanvasStore.getState().nodes.find((x) => x.id === edited.id)?.data as { card: { figure: { text: string } } }).card.figure.text).toContain('(new)'))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    expect(base.cards.some((c) => has(c.id))).toBe(false)
  })
})
