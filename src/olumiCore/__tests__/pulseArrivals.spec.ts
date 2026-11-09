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

  it('must not change: the cards a first look\'s folds bring are the person\'s model already, so they arrive unpulsed (77cdc6f6)', async () => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    // The fold read lands, once the first drawing is on the canvas, the View with the card the folds held; it is not an approval.
    const { setOpened } = useViewStore.getState()
    useViewStore.setState({ sid: 's_pulse0000005', opened: { open: new Map(), all: false }, setOpened: async () => { await vi.waitFor(() => expect(on(v1.model!.cards[0]!.id)).toBe(true)); useViewStore.setState({ view: v2 }); return true } } as never)
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: v1, status: 'ready' }) })
    await vi.waitFor(() => expect(on(added.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    expect(v2.model!.cards.some((c) => has(c.id))).toBe(false)
    useViewStore.setState({ setOpened })
  })

  // One applied version, drawn on a held one: core names what it changed (R2a `version.changed`), or, from a core before R2a, the cards are
  // compared. Either way the edited figure and the approved card pulse; another figure, and a worked-out figure that moved with them, do not.
  const appliedRow = async (sid: string, named: boolean) => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    const base = v2.model!, n = v2.version!.n
    const [edited, marked, still] = base.cards.filter((c) => (c.figure?.edit ?? null) !== null)
    const worked = base.cards.find((c) => c.figure !== null && (c.figure.edit ?? null) === null)!
    const held: View = { ...v2, id: sid, model: { ...base, cards: base.cards.map((c) => (c.id === marked!.id ? { ...c, change: { glyph: '+', title: 'Proposed addition', kind: 'added' as const } } : c)) } }
    const version = named ? { ...v2.version!, n: n + 1, changed: [edited!.id, marked!.id, still!.id] } : ({ id: v2.version!.id, n: n + 1, label: v2.version!.label } as unknown as View['version'])
    const applied: View = { ...held, version, model: { ...base, cards: base.cards.map((c) => (c.id === edited!.id || c.id === worked.id ? { ...c, figure: { ...c.figure!, text: `${c.figure!.text} (new)` } } : c)) } }
    useViewStore.setState({ sid })
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: held, status: 'ready' }) })
    await vi.waitFor(() => expect(on(marked!.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    act(() => { useViewStore.setState({ view: applied }) })
    await vi.waitFor(() => { vi.advanceTimersByTime(PULSE_COALESCE_MS + 20); expect(has(edited!.id)).toBe(true) })
    // `still` changed in a way its words do not show (core names it): pulsed only when core says so.
    expect([has(marked!.id), has(still!.id), has(worked.id)]).toEqual([true, named, false])
  }
  it('a newer version pulses the records core names it changed (version.changed), even one whose words did not change, and nothing else', () => appliedRow('s_pulse0000001', true))
  it('from a core before R2a: the figure a person sets that core now words differently and the card the proposal marked', () => appliedRow('s_pulse0000003', false))

  it('core names only the records it modified (its `version.changed` leaves additions out): a card the proposal drew as an addition, its ghost already on the canvas, still pulses', async () => {
    const on = (id: string) => useCanvasStore.getState().nodes.some((n) => n.id === id)
    const base = v2.model!, n = v2.version!.n, sid = 's_pulse0000004'
    const [ghost, other] = base.cards.filter((c) => c.family !== 'option')
    // `other` is a proposed change the approval left out (core names it in no `changed`): it keeps its old words and is not pulsed.
    const held: View = { ...v2, id: sid, model: { ...base, cards: base.cards.map((c) => (c.id === ghost!.id ? { ...c, change: { glyph: '+', title: 'Proposed addition', kind: 'added' as const } }
      : c.id === other!.id ? { ...c, change: { glyph: '↻', title: 'Proposed change', kind: 'changed' as const } } : c)) } }
    // As core serves it after approving an addition alone (service.ts changedOf: the stored change list's `changed`, never `added`).
    const applied: View = { ...v2, id: sid, version: { ...v2.version!, n: n + 1, changed: [] }, model: base }
    useViewStore.setState({ sid })
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ view: held, status: 'ready' }) })
    await vi.waitFor(() => expect(on(ghost!.id)).toBe(true))
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    act(() => { useViewStore.setState({ view: applied }) })
    await vi.waitFor(() => { vi.advanceTimersByTime(PULSE_COALESCE_MS + 20); expect(has(ghost!.id)).toBe(true) })
    expect(has(other!.id)).toBe(false)
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
