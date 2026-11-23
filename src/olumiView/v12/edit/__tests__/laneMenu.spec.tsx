/**
 * V12 right-click menus on the lane: the pure builder says which rows exist and what each opens; the mounted menu then calls the real route.
 * A row that cannot act is OMITTED (Paul, 19 Nov: "a menu that does nothing new goes"): no Delete (core has no route), no connected card, no
 * Rename, Add or Undo while core takes no edit or has nothing to undo. Nothing is shown disabled with a reason.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { CanvasContextMenu } from '../../../../canvas/contextMenu/CanvasContextMenu'
import { buildLaneMenu, edgeIdOf, type LaneMenuCtx } from '../../../../canvas/contextMenu/laneMenu'
import { isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from '../../../../canvas/contextMenu/types'
import { clearLayoutUndo, chooseRedo, chooseUndo, useLayoutUndo } from '../undo'
import { AddFigure } from '../../../AddFigure'
import { AddFigureRow } from '../../../model/structure'
import { ModelCardRow } from '../../../model/ModelCardRow'
import { CardDetail, LinkDetail } from '../../../model/detail'
import { selectedRename } from '../../../SelectedRename'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { LaneLinkRemoveButton } from '../LaneLinkRemoveButton'
import { useWhatIf } from '../../../whatif'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
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
  it('has Hand mode, Add (figure, option, risk, claim, open question), Ask Olumi, Undo, Auto-arrange and the whole-model switch (Redo only where a moved card can be put back)', () => {
    const m = buildLaneMenu(pane, ctx())
    expect(flat(m).map((i) => i.label)).toEqual(expect.arrayContaining(['Hand mode', 'Add', 'Figure', 'Option', 'Risk', 'Claim', 'Open question', 'Ask Olumi', 'Auto-arrange', 'Show the whole model']))
    expect(byId(m, 'undo'), 'nothing to undo: no row, not a disabled one').toBeUndefined()
    expect(byId(m, 'redo')).toBeUndefined()
    const withRedo = ctx({ undo: { undo: noUndo.undo, redo: { kind: 'layout', label: 'Redo move', note: null } } })
    expect(byId(buildLaneMenu(pane, withRedo), 'redo')).toMatchObject({ label: 'Redo move', enabled: true })
  })
  it('Add > Option opens the item form for a choice on the version core offers', () => {
    byId(buildLaneMenu(pane, ctx()), 'add-option')!.action()
    expect(spec[0]).toMatchObject({ kind: 'item', item: 'choice', sid: SID, base: BASE, concerns: [] })
  })
  it('Add > Risk from the canvas offers the model\'s figures to pick from; with none the row explains why it is unavailable', () => {
    byId(buildLaneMenu(pane, ctx()), 'add-risk')!.action()
    expect((spec[0] as { pickFigure: unknown[] }).pickFigure.length).toBeGreaterThan(0)
    const none = byId(buildLaneMenu(pane, ctx({ model: { ...approved().model!, cards: [] } })), 'add-risk')
    expect(none).toMatchObject({ enabled: false, disabledReason: 'Add a figure for this risk to affect.' })
    expect(byId(buildLaneMenu(pane, ctx({ model: { ...approved().model!, cards: [] } })), 'add'), 'CONTRAST: Add stays while any of its rows can act').toBeDefined()
  })
  it('while core takes no edit (Olumi\'s change held) there is no Add row at all, and no row says "Not right now"', () => {
    const held = ctx({ gate: { ok: false, why: 'Set aside the pending change first.' } })
    const m = buildLaneMenu(pane, held)
    for (const id of ['add', 'add-factor', 'add-option', 'add-risk', 'add-claim', 'add-question']) expect(byId(m, id), id).toBeUndefined()
    expect(byId(m, 'ask-olumi'), 'CONTRAST: what can still act stays').toBeDefined()
    for (const t of [pane, nodeT('starting_customers')]) for (const i of flat(buildLaneMenu(t, held))) expect(i.label).not.toMatch(/Not right now|Not available yet|can't be undone/)
    expect(flat(buildLaneMenu(pane, ctx())).map((i) => i.id), 'CONTRAST: the same menu with an edit open to core has them').toEqual(expect.arrayContaining(['add', 'add-option']))
    expect(spec).toHaveLength(0)
  })
  it('no divider leads, trails or doubles in any menu, held or not', () => {
    for (const gate of [GATE_OK, { ok: false, why: 'x' } as const]) for (const t of [pane, nodeT('starting_customers'), nodeT(QUESTION)]) {
      const m = buildLaneMenu(t, ctx({ gate }))
      expect(isMenuItem(m[0]!), 'first is a row').toBe(true); expect(isMenuItem(m[m.length - 1]!), 'last is a row').toBe(true)
      m.forEach((e, i) => { if (!isMenuItem(e)) expect(isMenuItem(m[i - 1]!)).toBe(true) })
    }
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
  it('Open details, Ask Olumi, Rename, Change figure and Add a claim; Add a risk only on a figure; no Delete and no connected card (core has no route)', () => {
    const m = buildLaneMenu(nodeT('starting_customers'), ctx())
    expect(flat(m).map((i) => i.label)).toEqual(expect.arrayContaining(['Open details', 'Ask Olumi', 'Rename', 'Change figure', 'Add a risk to this', 'Add a claim about this']))
    expect(byId(m, 'delete')).toBeUndefined()
    expect(byId(buildLaneMenu(nodeT('broader_entry'), ctx()), 'add-risk')).toBeUndefined()
  })
  it('Paul\'s option menu (audit F32): Add outcome from this, Cut and Other model edits each put a question about the card in the box; none without a box to receive it', () => {
    const asked: string[] = []
    const withBox = ctx({ act: { ...ctx().act, prefill: (text, _label, target) => asked.push(`${target}|${text}`) } })
    const m = buildLaneMenu(nodeT('starting_customers'), withBox), name = approved().model!.cards.find((c) => c.id === 'starting_customers')!.heading
    for (const id of ['ask-add-outcome', 'ask-cut', 'ask-other-edits']) { expect(byId(m, id)).toMatchObject({ enabled: true }); byId(m, id)!.action() }
    expect(asked).toEqual([`starting_customers|Add an outcome that follows from ${name}: `, `starting_customers|Take ${name} out of the model, because `, `starting_customers|About ${name}: `])
    expect(spec).toHaveLength(0) // nothing is written: the person sends it
    expect(byId(buildLaneMenu(nodeT('starting_customers'), ctx()), 'ask-cut')).toBeUndefined() // CONTRAST: no box to receive it, no row
    expect(byId(buildLaneMenu(nodeT(QUESTION), withBox), 'ask-cut')).toBeUndefined() // the question is not cut from the model
  })
  it('a connected card has no row: core has no way to draw a link', () => {
    expect(byId(buildLaneMenu(nodeT('starting_customers'), ctx()), 'add-connected')).toBeUndefined()
    expect(byId(buildLaneMenu({ kind: 'multi', nodeIds: [], screenPos: { x: 1, y: 1 } } as never, ctx()), 'delete')).toBeUndefined()
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
  afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null }) })
  // As ViewCanvas mounts it: the menu is the one surface store's, and the layer draws the one small form that takes the menu's place.
  const Host = ({ children }: { children?: React.ReactNode }): JSX.Element => {
    const target = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
    return <ToastProvider>{children}{target === null ? null : <CanvasContextMenu target={target} onClose={() => useLaneInspector.getState().close('menu')} screenToFlowPosition={(p) => p} interactionMode="select" onSetInteractionMode={() => undefined} />}<LaneEditingLayer /></ToastProvider>
  }
  const mount = (target: ContextTarget) => { useLaneInspector.getState().show({ kind: 'menu', target }); return render(<Host />) }
  const fig = 'starting_customers'
  const openCard = (id: string) => act(() => useLaneInspector.getState().open({ kind: 'card', id }))
  const context = (target: ContextTarget) => act(() => useLaneInspector.getState().show({ kind: 'menu', target }))

  it.each(['card menu', 'sheet menu', 'Model detail', 'Model heading', 'chat selection', 'heading click'])('%s edits the sheet heading in place', async (opener) => {
    const model = approved().model!, card = model.cards.find((c) => c.id === fig)!
    render(<Host>
      {opener === 'Model detail' ? <CardDetail model={model} card={card} /> : null}
      {opener === 'Model heading' ? <ul><ModelCardRow model={model} card={card} kind="factor" number={null} /></ul> : null}
      {opener === 'chat selection' ? selectedRename({ id: fig, kind: 'node' }) : null}
    </Host>)
    if (opener === 'card menu') {
      context(nodeT(fig))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    } else if (opener === 'sheet menu') {
      openCard(fig)
      fireEvent.click(screen.getByTestId('lane-inspector-more'))
      fireEvent.click(screen.getByTestId('lane-inspector-rename'))
    } else if (opener === 'Model heading') {
      fireEvent.doubleClick(document.querySelector(`[data-model-select="${fig}"]`)!)
    } else if (opener === 'heading click') {
      openCard(fig)
      fireEvent.click(within(screen.getByTestId('lane-inspector-title')).getByRole('button'))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    }
    const field = await screen.findByTestId('lane-inspector-name')
    expect(field).toHaveFocus()
    expect(field.closest('h2')).toBe(screen.getByTestId('lane-inspector-title'))
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
    fireEvent.change(field, { target: { value: 'Discard this name' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    const heading = within(screen.getByTestId('lane-inspector-title')).getByRole('button', { name: card.heading })
    expect(heading).toHaveFocus()
    expect(stub.posts()).toHaveLength(0)
    // A native heading button responds to Enter with a click.
    fireEvent.click(heading, { detail: 0 })
    const reopened = screen.getByTestId('lane-inspector-name')
    expect(reopened).toHaveValue(card.heading)
    fireEvent.change(reopened, { target: { value: 'Opening customer base' } })
    fireEvent.keyDown(reopened, { key: 'Enter' })
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/rename`, body: { base: BASE, record: fig, label: 'Opening customer base' } })
    await waitFor(() => expect(screen.queryByTestId('lane-inspector-name')).toBeNull())
  })

  it.each(['claim', 'left_out'])('a %s cannot be renamed by the menu or the sheet', async (family) => {
    const view = approved()
    view.model!.cards = view.model!.cards.map((card) => card.id === fig ? { ...card, family } : card)
    stub = install(view)
    mount(nodeT(fig))
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull()
    openCard(fig)
    fireEvent.click(screen.getByTestId('lane-inspector-more'))
    expect(screen.queryByTestId('lane-inspector-rename')).toBeNull()
    expect(within(screen.getByTestId('lane-inspector-title')).queryByRole('button')).toBeNull()
  })

  it.each(['rail', 'canvas', 'Model Factors'])('%s opens the same Add list and figure draft', async (opener) => {
    render(<Host><AddFigure /><AddFigureRow /></Host>)
    if (opener === 'rail') fireEvent.click(screen.getByTestId('canvas-add-to-model'))
    if (opener === 'Model Factors') fireEvent.click(screen.getByTestId('model-add'))
    if (opener === 'canvas') {
      context(pane)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add' }))
    }
    const suggestions = [
      ['Figure', 'factor', 'var(--factor)'],
      ['Option', 'option', 'var(--option)'],
      ['Risk', 'risk', 'var(--danger)'],
      ['Claim', 'factor', 'var(--factor)'],
      ['Open question', 'factor', 'var(--factor)'],
    ] as const
    const figure = await screen.findByRole('menuitem', { name: 'Figure' })
    const menu = within(figure.closest('[role="menu"]')!)
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(suggestions.map(([name]) => name))
    for (const [name, kind, colour] of suggestions) {
      const mark = menu.getByRole('menuitem', { name }).querySelector('svg')
      expect(mark).toHaveAttribute('data-node-shape', kind)
      expect(mark?.querySelector('circle, rect, polygon')).toHaveAttribute('fill', colour)
    }
    fireEvent.click(figure)
    expect(screen.getByTestId('lane-edit-form')).toHaveAttribute('data-kind', 'figure-add')
    const label = screen.getByTestId('lane-edit-label')
    expect(label).toHaveFocus()
    fireEvent.change(label, { target: { value: 'New figure' } })
    fireEvent.change(screen.getByTestId('lane-edit-typed'), { target: { value: '5 to 10' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/figures`, body: { base: BASE, label: 'New figure', typed: '5 to 10' } })
    await waitFor(() => expect(screen.queryByTestId('lane-edit-form')).toBeNull())
  })

  it.each(['edge menu', 'sheet', 'inline edge', 'Model relationship'])('%s opens one removal summary naming the exact sum and input', async (opener) => {
    const view = approved(), model = view.model!
    const link = { ...model.links[1]!, remove: { record: 'sum_of_customers', part: fig } }
    model.links[1] = link
    model.links[2] = { ...model.links[2]!, role: 'measures' }
    stub = install(view)
    const id = edgeIdOf(link)
    render(<Host>{opener === 'Model relationship' ? <LinkDetail model={model} link={link} row="relationship" /> : opener === 'inline edge' ? <LaneLinkRemoveButton edge={id} link={link} /> : null}</Host>)
    if (opener === 'edge menu') {
      context({ kind: 'edge', edgeId: id, edge: { id, data: { link } } as never, isStructural: true, screenPos: { x: 10, y: 10 } })
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove link' }))
    } else {
      if (opener === 'sheet') act(() => useLaneInspector.getState().open({ kind: 'link', id }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove link' }))
    }
    expect(screen.getAllByRole('dialog', { name: 'Remove this link?' })).toHaveLength(1)
    const review = screen.getByTestId('lane-link-removal-summary')
    const heading = (id: string) => model.cards.find((card) => card.id === id)!.heading
    expect(review).toHaveTextContent(heading(fig))
    expect(review).toHaveTextContent(heading(link.to))
    expect(review).not.toHaveTextContent(heading(model.links[2]!.to))
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(stub.posts()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/links/remove`, body: { base: BASE, record: 'sum_of_customers', part: fig } })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a Try completing after another sheet opens leaves the newer sheet and its field in place', async () => {
    let resolve!: (response: Response) => void
    const pending = new Promise<Response>((done) => { resolve = done })
    const view = approved()
    const fetchStub = vi.fn(async (path: string) => path === '/api/me'
      ? new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }))
      : pending)
    setTeamFetch(fetchStub as unknown as typeof fetch)
    render(<Host />)
    act(() => useLaneInspector.getState().openFigure({ kind: 'card', id: fig }))
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '700' } })
    fireEvent.click(screen.getByTestId('inspector-figure-try'))
    await waitFor(() => expect(fetchStub).toHaveBeenCalledWith(`/api/scenarios/${SID}/whatif`, expect.anything()))
    act(() => useLaneInspector.getState().openFigure({ kind: 'card', id: 'customer_target' }))
    const next = useLaneInspector.getState().current
    await act(async () => resolve(new Response(JSON.stringify({ variants: [{}] }))))
    expect(useWhatIf.getState().shown?.quantity).toBe(fig)
    expect(useLaneInspector.getState().current).toBe(next)
    expect(screen.getByTestId('lane-inspector')).toHaveAttribute('data-box-card', 'customer_target')
    expect(screen.getByTestId('inspector-figure-typed')).toHaveFocus()
    useWhatIf.setState({ shown: null })
  })

  it('Add > Option: the form posts /strategy/items as a choice and the menu closes itself after', async () => {
    mount(pane)
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Add/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Option/ }))
    fireEvent.change(await screen.findByTestId('lane-edit-text'), { target: { value: ' Pilot in Spain ' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/strategy/items`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, kind: 'choice', text: 'Pilot in Spain' })
    await waitFor(() => expect(screen.queryByTestId('lane-edit-form')).toBeNull())
    expect(screen.queryByRole('menu')).toBeNull()
  })
  // Surfaces step 5: the row opens the card's details with the Value row's field focused; that field is the one place the size is changed.
  it('a risk card: Set chance and size opens its Value row, which posts /size, never /edit', async () => {
    mount(nodeT('slow_ramp'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Set chance and size/ }))
    expect(screen.queryByTestId('lane-edit-form'), 'not the small form').toBeNull()
    const field = await screen.findByTestId('inspector-figure-chance')
    expect(document.activeElement).toBe(field)
    fireEvent.change(field, { target: { value: '1 in 5' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, record: 'slow_ramp', chance: '1 in 5' })
  })
  it('core\'s refusal is shown in the Value row in its own words, and the typing stays', async () => {
    stub.answer = { status: 400, body: { error: 'A chance is between 0% and 100%.' } }
    mount(nodeT('slow_ramp'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Set chance and size/ }))
    fireEvent.change(await screen.findByTestId('inspector-figure-chance'), { target: { value: '150%' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    expect(await screen.findByTestId('inspector-figure-note')).toHaveTextContent('A chance is between 0% and 100%.')
    expect((screen.getByTestId('inspector-figure-chance') as HTMLInputElement).value).toBe('150%')
  })
  it('the menu draws no Delete and no "(Not available yet)" row, and every row it draws is enabled', async () => {
    mount(nodeT('broader_entry'))
    await screen.findByRole('menuitem', { name: /Open details/ })
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).toBeNull()
    expect(screen.queryByText(/Not available yet|Not right now/)).toBeNull()
    for (const r of screen.getAllByRole('menuitem')) expect(r).not.toHaveAttribute('aria-disabled', 'true')
    expect(stub.posts()).toHaveLength(0)
  })
  it('the legacy menu\'s own rows are not on the lane (no Add node, no legacy Undo)', async () => {
    mount(pane)
    await screen.findByRole('menuitem', { name: /^Add/ })
    expect(screen.queryByRole('menuitem', { name: /Add node/ })).not.toBeInTheDocument()
    expect(useViewStore.getState().sid).toBe(SID)
  })
})
