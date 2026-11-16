/**
 * V12 Undo: a dragged card is undone locally and writes nothing; a saved edit is undone by core's route with {base, undoes, op}, one level, no redo;
 * the control is labelled by what it will undo; with no `model.undo` the tooltip says saved edits cannot be undone yet; core's refusal is shown in its words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { useCanvasStore } from '../../../../canvas/store'
import { viewUndoOf } from '../editRoutes'
import { chooseRedo, chooseUndo, clearLayoutUndo, noteSavedVersion, pressUndo, recordLayoutMove, trackLayoutMoves, UNDO_WORDS, useLayoutUndo } from '../undo'
import { UndoControl } from '../../UndoControl'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useViewStore } from '../../../store'
import type { View } from '../../../client'
import { BASE, SID, approved, install, uninstall, type Stub } from './harness'

let stub: Stub
const withUndo = (u: unknown): View => { const v = approved(); return { ...v, model: { ...v.model!, undo: u } } as never }
const CORE = { available: true, version: 7, n: 3, label: 'Undo: rename of Entry', why_not: null }
const NONE = (why: string | null) => ({ available: false, version: null, n: null, label: null, why_not: why })
const viewUndo = (u: unknown) => viewUndoOf(withUndo(u))
beforeEach(() => { stub = install(); clearLayoutUndo(); useLayoutUndo.setState({ undo: [], redo: [], seq: 0, savedSeq: 0, last: null }) })
afterEach(() => { cleanup(); uninstall(); useCanvasStore.setState({ nodes: [] } as never) })
const nodes = (xs: Array<[string, number, number]>) => useCanvasStore.setState({ nodes: xs.map(([id, x, y]) => ({ id, type: 'viewCard', position: { x, y }, data: {} })) } as never)
const at = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.position

describe('which act Undo reaches', () => {
  it('a layout move alone is layout; the control says "Undo move" and that saved edits cannot be undone yet when the View has no undo', () => {
    recordLayoutMove(SID, { a: { x: 1, y: 1 } })
    const c = chooseUndo(useLayoutUndo.getState(), null)
    expect(c).toMatchObject({ kind: 'layout', label: 'Undo move', note: UNDO_WORDS.savedNotYet })
  })
  it('a saved edit offered by core is labelled with core\'s own label', () => {
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo(CORE))).toMatchObject({ kind: 'saved', label: 'Undo: rename of Entry', undoes: 7 })
  })
  it('the newer act wins: a move made after the last saved version is undone first; after a newer saved version, core\'s', () => {
    recordLayoutMove(SID, { a: { x: 1, y: 1 } })
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo(CORE)).kind).toBe('layout')
    noteSavedVersion()
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo(CORE)).kind).toBe('saved')
  })
  it('nothing to undo says core\'s why_not, else a plain sentence; with no undo at all the saved-edits words', () => {
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo(NONE('Someone else has changed the model since your last change.')))).toMatchObject({ kind: 'none', note: 'Someone else has changed the model since your last change.' })
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo(NONE(null)))).toMatchObject({ kind: 'none', note: UNDO_WORDS.nothingToUndo })
    expect(chooseUndo(useLayoutUndo.getState(), null)).toMatchObject({ kind: 'none', note: UNDO_WORDS.savedNotYet })
  })
  it('model.undo is read as core gives it: absent, null or not the contract\'s shape is no offer', () => {
    expect(viewUndoOf(approved())).toBeNull()
    expect(viewUndo(null)).toBeNull()
    expect(viewUndo({ undo: { op: 'x' } })).toBeNull()
    expect(viewUndo(CORE)).toEqual(CORE)
  })
  it('an available offer with no version to name is not offered (nothing is guessed)', () => {
    expect(chooseUndo(useLayoutUndo.getState(), viewUndo({ ...CORE, version: null })).kind).toBe('none')
  })
  it('redo is a dragged card only: nothing to redo without one, a saved edit has none', () => {
    expect(chooseRedo(useLayoutUndo.getState())).toMatchObject({ kind: 'none', note: UNDO_WORDS.nothingToRedo })
    useLayoutUndo.setState({ redo: [{ seq: 3, sid: SID, places: { a: { x: 0, y: 0 } } }], last: 'layout' })
    expect(chooseRedo(useLayoutUndo.getState())).toMatchObject({ kind: 'layout', label: 'Redo move' })
  })
})

describe('a layout undo writes nothing and puts the cards back', () => {
  it('undo then redo of a move, and no request leaves the page', async () => {
    nodes([['a', 5, 5], ['b', 50, 50]])
    recordLayoutMove(SID, { a: { x: 1, y: 2 } })
    expect(await pressUndo('undo')).toMatchObject({ ok: true, kind: 'layout' })
    expect(at('a')).toEqual({ x: 1, y: 2 })
    expect(await pressUndo('redo')).toMatchObject({ ok: true, kind: 'layout' })
    expect(at('a')).toEqual({ x: 5, y: 5 })
    expect(stub.posts()).toHaveLength(0)
  })
  it('watching the canvas: a finished drag is one move; a layout run with no drag in progress is none', async () => {
    const stop = trackLayoutMoves()
    nodes([['a', 0, 0]])
    useCanvasStore.setState({ nodes: [{ id: 'a', type: 'viewCard', position: { x: 0, y: 0 }, data: {}, dragging: true }, ] } as never)
    useCanvasStore.setState({ nodes: [{ id: 'a', type: 'viewCard', position: { x: 40, y: 10 }, data: {}, dragging: true }] } as never)
    useCanvasStore.setState({ nodes: [{ id: 'a', type: 'viewCard', position: { x: 40, y: 10 }, data: {}, dragging: false }] } as never)
    expect(useLayoutUndo.getState().undo).toHaveLength(1)
    expect(useLayoutUndo.getState().undo[0]!.places).toEqual({ a: { x: 0, y: 0 } })
    useCanvasStore.setState({ nodes: [{ id: 'a', type: 'viewCard', position: { x: 99, y: 99 }, data: {} }] } as never) // a layout run: no drag
    expect(useLayoutUndo.getState().undo).toHaveLength(1)
    stop()
  })
})

describe('a saved undo is core\'s route', () => {
  it('posts {base, undoes, op}: the View\'s edit_base, the version core named, and a fresh idempotency key; then reads the View again', async () => {
    useViewStore.setState({ view: withUndo(CORE) })
    const r = await pressUndo('undo')
    expect(r).toMatchObject({ ok: true, kind: 'saved' })
    const p = stub.posts()
    expect(p).toHaveLength(1)
    expect(p[0]!.path).toBe(`/api/scenarios/${SID}/undo`)
    expect(p[0]!.body).toMatchObject({ base: BASE, undoes: 7 })
    expect(Object.keys(p[0]!.body as object).sort()).toEqual(['base', 'op', 'undoes'])
    expect(typeof (p[0]!.body as { op: unknown }).op).toBe('string')
    expect((p[0]!.body as { op: string }).op.length).toBeGreaterThan(7)
    expect(stub.calls.some((c) => c.method === 'GET' && c.path.includes('/view'))).toBe(true)
  })
  it('an unavailable offer posts nothing and says core\'s why_not', async () => {
    useViewStore.setState({ view: withUndo(NONE('A change is pending: approve or set it aside first.')) })
    expect(await pressUndo('undo')).toEqual({ ok: false, words: 'A change is pending: approve or set it aside first.' })
    expect(stub.posts()).toHaveLength(0)
  })
  it('a conflict (409) is core\'s sentence, nothing else changes', async () => {
    useViewStore.setState({ view: withUndo(CORE) })
    stub.answer = { status: 409, body: { error: 'Priya has changed the model since your last change, so it cannot be undone here.' } }
    expect(await pressUndo('undo')).toEqual({ ok: false, words: 'Priya has changed the model since your last change, so it cannot be undone here.' })
  })
  it('with no undo in the View and no moves, nothing is sent', async () => {
    expect(await pressUndo('undo')).toEqual({ ok: false, words: UNDO_WORDS.savedNotYet })
    expect(stub.posts()).toHaveLength(0)
  })
  it('redo with nothing moved posts nothing (no saved redo in this slice)', async () => {
    useViewStore.setState({ view: withUndo(CORE) })
    expect(await pressUndo('redo')).toEqual({ ok: false, words: UNDO_WORDS.nothingToRedo })
    expect(stub.posts()).toHaveLength(0)
  })
})

describe('the control and the keys', () => {
  const mount = () => render(<ToastProvider><UndoControl /><LaneEditingLayer /></ToastProvider>)
  it('is labelled by what it will undo, and a disabled one says why', () => {
    mount()
    expect(screen.getByTestId('lane-undo')).toHaveAttribute('aria-label', 'Undo: nothing of yours to undo yet')
    expect(screen.getByTestId('lane-undo')).toHaveAttribute('title', UNDO_WORDS.savedNotYet)
    act(() => recordLayoutMove(SID, { a: { x: 1, y: 1 } }))
    expect(screen.getByTestId('lane-undo')).toHaveAttribute('aria-label', 'Undo move')
    expect(screen.getByTestId('lane-undo').getAttribute('title')).toContain(UNDO_WORDS.savedNotYet)
  })
  it('⌘Z undoes a move; ⇧⌘Z redoes it; never while typing in a field', async () => {
    nodes([['a', 5, 5]])
    mount()
    act(() => recordLayoutMove(SID, { a: { x: 1, y: 2 } }))
    const field = document.createElement('input'); document.body.appendChild(field)
    fireEvent.keyDown(field, { key: 'z', metaKey: true })
    expect(at('a')).toEqual({ x: 5, y: 5 }) // typing: the field's own undo
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true })
    await waitFor(() => expect(at('a')).toEqual({ x: 1, y: 2 }))
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true, shiftKey: true })
    await waitFor(() => expect(at('a')).toEqual({ x: 5, y: 5 }))
    field.remove()
  })
  it('a refusal is shown in core\'s words as a toast', async () => {
    useViewStore.setState({ view: withUndo(CORE) })
    stub.answer = { status: 409, body: { error: 'Priya has changed the model since your last change, so it cannot be undone here.' } }
    mount()
    fireEvent.click(screen.getByTestId('lane-undo'))
    expect(await screen.findByText('Priya has changed the model since your last change, so it cannot be undone here.')).toBeInTheDocument()
  })
})
