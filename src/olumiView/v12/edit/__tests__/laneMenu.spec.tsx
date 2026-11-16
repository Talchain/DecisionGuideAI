/**
 * V12 right-click menus on the lane: the pure builder says which rows exist and what each opens; the mounted menu then calls the real route.
 * Delete is shown DISABLED with "Not available yet" (core has no route), never faked.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { CanvasContextMenu } from '../../../../canvas/contextMenu/CanvasContextMenu'
import { buildLaneMenu, NOT_AVAILABLE_YET, type LaneMenuCtx } from '../../../../canvas/contextMenu/laneMenu'
import { isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from '../../../../canvas/contextMenu/types'
import { clearLayoutUndo, chooseRedo, chooseUndo, useLayoutUndo } from '../undo'
import { useViewStore } from '../../../store'
import { QUESTION } from '../../../layout'
import { BASE, SID, approved, install, uninstall, type Stub } from './harness'

const flat = (es: MenuEntry[]): MenuItemDef[] => es.flatMap((e) => (isMenuItem(e) ? [e, ...(e.submenuItems ? flat(e.submenuItems) : [])] : []))
const byId = (es: MenuEntry[], id: string) => flat(es).find((i) => i.id === id)
const GATE_OK = { ok: true, sid: SID, base: BASE } as const
const noUndo = { undo: chooseUndo({ undo: [], savedSeq: 0 }, null), redo: chooseRedo({ redo: [] }) }
const calls: string[] = []
const spec: unknown[] = []
const ctx = (over: Partial<LaneMenuCtx> = {}): LaneMenuCtx => ({
  gate: GATE_OK, model: approved().model!, undo: noUndo, level: 'simple', mode: 'select', questionId: QUESTION,
  act: { open: (s) => spec.push(s), openDetails: (t) => calls.push(`details:${t.kind}:${t.id}`), ask: (_t, i) => calls.push(`ask:${i}`), pressUndo: (d) => calls.push(d), autoArrange: () => calls.push('arrange'), toggleLevel: () => calls.push('level'), setMode: (m) => calls.push(`mode:${m}`) },
  ...over,
})
const pane: ContextTarget = { kind: 'pane', screenPos: { x: 10, y: 10 } }
const nodeT = (id: string): ContextTarget => ({ kind: 'node', nodeId: id, nodeType: 'factor', node: { id, position: { x: 0, y: 0 }, data: {} } as never, screenPos: { x: 10, y: 10 } })
beforeEach(() => { calls.length = 0; spec.length = 0 })

describe('canvas menu', () => {
  it('has Hand mode, Add (factor, option, risk, claim, open question), Ask Olumi, Undo, Auto-arrange and the whole-model switch (Redo only where a moved card can be put back)', () => {
    const m = buildLaneMenu(pane, ctx())
    expect(flat(m).map((i) => i.label)).toEqual(expect.arrayContaining(['Hand mode', 'Add', 'Factor', 'Option', 'Risk', 'Claim', 'Open question', 'Ask Olumi', 'Undo', 'Auto-arrange', 'Show the whole model']))
    expect(byId(m, 'redo')).toBeUndefined()
    const withRedo = ctx({ undo: { undo: noUndo.undo, redo: { kind: 'layout', label: 'Redo move', note: null } } })
    expect(byId(buildLaneMenu(pane, withRedo), 'redo')).toMatchObject({ label: 'Redo move', enabled: true })
  })
  it('Add > Option opens the item form for a choice on the version core offers', () => {
    byId(buildLaneMenu(pane, ctx()), 'add-option')!.action()
    expect(spec[0]).toMatchObject({ kind: 'item', item: 'choice', sid: SID, base: BASE, concerns: [] })
  })
  it('Add > Risk from the canvas offers the model\'s figures to pick from; with none it is disabled and says why', () => {
    byId(buildLaneMenu(pane, ctx()), 'add-risk')!.action()
    expect((spec[0] as { pickFigure: unknown[] }).pickFigure.length).toBeGreaterThan(0)
    const none = byId(buildLaneMenu(pane, ctx({ model: { ...approved().model!, cards: [] } })), 'add-risk')!
    expect(none).toMatchObject({ enabled: false, disabledReason: 'No figure yet' })
  })
  it('every Add row is disabled while core takes no edit (Olumi\'s change held), with core\'s words in its tooltip', () => {
    const m = buildLaneMenu(pane, ctx({ gate: { ok: false, why: 'Set aside the pending change first.' } }))
    for (const id of ['add-factor', 'add-option', 'add-risk', 'add-claim', 'add-question']) expect(byId(m, id)).toMatchObject({ enabled: false })
    expect(byId(m, 'add-option')!.tooltip).toContain('Set aside the pending change first.')
    expect(spec).toHaveLength(0)
  })
  it('Undo and Redo carry what they will undo; Auto-arrange and the level switch call their effects', () => {
    const c = ctx({ undo: { undo: { kind: 'saved', undoes: 7, label: 'Undo: rename of Entry', note: null }, redo: noUndo.redo } })
    const m = buildLaneMenu(pane, c)
    expect(byId(m, 'undo')).toMatchObject({ label: 'Undo: rename of Entry', enabled: true })
    byId(m, 'undo')!.action(); byId(m, 'auto-arrange')!.action(); byId(m, 'toggle-level')!.action(); byId(m, 'interaction-mode')!.action()
    expect(calls).toEqual(['undo', 'arrange', 'level', 'mode:hand'])
  })
})

describe('card menu', () => {
  it('Open details, Ask Olumi, Rename, Change figure and Add a claim; Add a risk only on a figure; Delete is disabled "Not available yet"', () => {
    const m = buildLaneMenu(nodeT('starting_customers'), ctx())
    expect(flat(m).map((i) => i.label)).toEqual(expect.arrayContaining(['Open details', 'Ask Olumi', 'Rename', 'Change figure', 'Add a risk to this', 'Add a claim about this', 'Delete']))
    expect(byId(m, 'delete')).toMatchObject({ enabled: false, disabledReason: NOT_AVAILABLE_YET, destructive: true })
    expect(byId(buildLaneMenu(nodeT('broader_entry'), ctx()), 'add-risk')).toBeUndefined()
    byId(m, 'delete')!.action()
    expect(spec).toHaveLength(0)
  })
  it('a connected card is disabled with the reason: core has no way to draw a link', () => {
    const r = byId(buildLaneMenu(nodeT('starting_customers'), ctx()), 'add-connected')!
    expect(r).toMatchObject({ enabled: false, disabledReason: NOT_AVAILABLE_YET })
    expect(r.tooltip).toMatch(/draw a link/)
  })
  it('a risk card\'s edit is a SIZE (chance and size), never the plain figure editor that posts to /edit', () => {
    const m = buildLaneMenu(nodeT('slow_ramp'), ctx())
    expect(byId(m, 'change-figure')).toBeUndefined()
    byId(m, 'size')!.action()
    expect(spec[0]).toMatchObject({ kind: 'size', edit: { route: 'size', record: 'slow_ramp' } })
  })
  it('Rename opens the form with the card\'s own name; the question is not renamed as a record', () => {
    byId(buildLaneMenu(nodeT('broader_entry'), ctx()), 'rename')!.action()
    expect(spec[0]).toMatchObject({ kind: 'rename', record: 'broader_entry', base: BASE })
    expect(byId(buildLaneMenu(nodeT(QUESTION), ctx()), 'rename')).toBeUndefined()
  })
  it('Open details and Ask Olumi reach their effects', () => {
    const m = buildLaneMenu(nodeT('broader_entry'), ctx())
    byId(m, 'open-details')!.action(); byId(m, 'ask-challenge')!.action()
    expect(calls).toEqual(['details:card:broader_entry', 'ask:challenge_element'])
  })
})

describe('link menu', () => {
  const edge = (): ContextTarget => ({ kind: 'edge', edgeId: 'e', isStructural: false, screenPos: { x: 1, y: 1 }, edge: { id: 'e', data: { link: approved().model!.links[1] } } as never })
  it('Set strength (the line\'s /size edit) and Remove link (its own handle)', () => {
    const m = buildLaneMenu(edge(), ctx())
    byId(m, 'size')!.action(); byId(m, 'remove-link')!.action()
    expect(spec[0]).toMatchObject({ kind: 'size', edit: { route: 'size', record: 'i_speed', fields: [{ key: 'typed' }] } })
    expect(spec[1]).toMatchObject({ kind: 'remove-link', remove: { record: 'i_speed', part: null } })
  })
  it('a line core offers no size or removal for has neither row', () => {
    const plain: ContextTarget = { kind: 'edge', edgeId: 'e', isStructural: false, screenPos: { x: 1, y: 1 }, edge: { id: 'e', data: { link: approved().model!.links[0] } } as never }
    expect(byId(buildLaneMenu(plain, ctx()), 'size')).toBeUndefined()
    expect(byId(buildLaneMenu(plain, ctx()), 'remove-link')).toBeUndefined()
  })
})

describe('mounted on the lane: the real route is called', () => {
  let stub: Stub
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install(); clearLayoutUndo(); useLayoutUndo.setState({ undo: [], redo: [], seq: 0, savedSeq: 0, last: null }) })
  afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs() })
  const mount = (target: ContextTarget) => render(<ToastProvider><CanvasContextMenu target={target} onClose={() => undefined} screenToFlowPosition={(p) => p} interactionMode="select" onSetInteractionMode={() => undefined} /></ToastProvider>)
  it('Add > Option: the form posts /strategy/items as a choice and the menu closes itself after', async () => {
    let closed = 0
    render(<ToastProvider><CanvasContextMenu target={pane} onClose={() => { closed += 1 }} screenToFlowPosition={(p) => p} /></ToastProvider>)
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Add/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Option/ }))
    fireEvent.change(await screen.findByTestId('lane-edit-text'), { target: { value: ' Pilot in Spain ' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/strategy/items`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, kind: 'choice', text: 'Pilot in Spain' })
    await waitFor(() => expect(closed).toBe(1))
  })
  it('a risk card: Set chance and size posts /size, never /edit', async () => {
    mount(nodeT('slow_ramp'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Set chance and size/ }))
    fireEvent.change(await screen.findByTestId('lane-edit-chance'), { target: { value: '1 in 5' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, record: 'slow_ramp', chance: '1 in 5' })
  })
  it('core\'s refusal is shown in the form in its own words and the menu stays', async () => {
    stub.answer = { status: 400, body: { error: 'A chance is between 0% and 100%.' } }
    mount(nodeT('slow_ramp'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Set chance and size/ }))
    fireEvent.change(await screen.findByTestId('lane-edit-chance'), { target: { value: '150%' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    expect(await screen.findByTestId('lane-edit-error')).toHaveTextContent('A chance is between 0% and 100%.')
    expect(screen.getByTestId('lane-edit-form')).toBeInTheDocument()
  })
  it('Delete shows "Not available yet" and does nothing', async () => {
    mount(nodeT('broader_entry'))
    const row = await screen.findByRole('menuitem', { name: /Delete/ })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(within(row).getByText(`(${NOT_AVAILABLE_YET})`)).toBeInTheDocument()
    fireEvent.click(row)
    expect(stub.posts()).toHaveLength(0)
  })
  it('the legacy menu\'s own rows are not on the lane (no Add node, no legacy Undo)', async () => {
    mount(pane)
    await screen.findByRole('menuitem', { name: /^Add/ })
    expect(screen.queryByRole('menuitem', { name: /Add node/ })).not.toBeInTheDocument()
    expect(useViewStore.getState().sid).toBe(SID)
  })
})
