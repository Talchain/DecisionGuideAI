/**
 * SURFACES STEP 5 (18 Nov): a figure is changed in ONE place on the lane, the details panel's Value row, whichever control opened it. For each route that used to open
 * a figure editor (the card's pencil, the right-click row, the Model tab, the details panel's own field) and for each kind (a quantity's figure, a risk's chance and size,
 * a link's strength): exactly ONE figure editor is in the document, inside the details panel, with its first field focused; a Set posts what the old editor posted; a save
 * in flight is not cut off; the typing is kept per card. CONTRAST: with the lane off the older look's routes are unchanged (the pop-over under the card, the small form).
 * A risk has two fields in core's own route (chance, change); "one" is the one editor with the one focused field, never a merge of the two.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { CanvasContextMenu } from '../../../../canvas/contextMenu/CanvasContextMenu'
import { edgeIdOf } from '../../../../canvas/contextMenu/laneMenu'
import type { ContextTarget } from '../../../../canvas/contextMenu/types'
import { ViewCard } from '../../../../canvas/nodes/ViewCardNode'
import { ViewModelTab } from '../../../ViewModelTab'
import { ViewChances } from '../../../ViewChances'
import { ASIDE_WORDS, FigureEdit, useAsideEdit } from '../../../FigureEdit'
import { resetModelTab } from '../../../model/state'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { useMe } from '../../../../olumiCore/me'
import { useViewStore } from '../../../store'
import type { View } from '../../../client'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { RISK_EDIT, SID, approved } from './harness'

const PLAIN = 'starting_customers', OTHER = 'customer_target', RISK = 'slow_ramp'
const LINK = approved().model!.links.find((l) => l.size?.edit != null)!
const LINK_ID = edgeIdOf(LINK)

type Call = { method: string; path: string; body: unknown }
let calls: Call[] = []
let hold: Promise<void> | null = null
let release: () => void = () => undefined
const posts = (): Call[] => calls.filter((c) => c.method === 'POST')
const gateOn = (): void => { hold = new Promise<void>((r) => { release = r }) }
function install(view: View = approved()): void {
  calls = []; hold = null
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(useViewStore.getState().view ?? view), { status: 200 })
    if (hold !== null) await hold
    return new Response(JSON.stringify({ version: 9, n: 3, receipt: 'x:9', record: 'x' }), { status: 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' } as never)
}
const lane = (on: boolean): void => { vi.stubEnv('VITE_OLUMI_CORE', on ? '1' : '0') }
beforeEach(() => { lane(true); install() })
afterEach(() => {
  cleanup(); setTeamFetch(null); resetWrites(); resetModelTab(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, drafts: {} })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null }); useMe.setState({ me: null } as never)
})

const cardOf = (id: string) => useViewStore.getState().view!.model!.cards.find((c) => c.id === id)!
const FIELDS: Record<'plain' | 'risk' | 'link', string[]> = { plain: ['typed'], risk: ['chance', 'change'], link: ['typed'] }
type Kind = keyof typeof FIELDS
const IDS: Record<Kind, string> = { plain: PLAIN, risk: RISK, link: LINK_ID }
/** Every figure field the page could draw: the Value row's, the pop-over's, the small form's, the Model tab's. */
const ANY_FIGURE_INPUT = 'input[data-testid^="inspector-figure-"], input[data-testid^="view-figure-typed"], input[data-testid^="lane-edit-"], input[data-model-editor-input]'
const ANY_OTHER_EDITOR = '[data-figure-edit-panel], [data-testid="lane-edit-form"], [data-model-editor]'

/** The one editor is the one Value row of that item, inside the details panel, its first field focused. */
function expectOne(kind: Kind): void {
  const panel = screen.getByTestId('lane-inspector')
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(ANY_FIGURE_INPUT))
  expect(inputs.map((i) => i.getAttribute('data-testid'))).toEqual(FIELDS[kind].map((k) => `inspector-figure-${k}`))
  expect(inputs.every((i) => panel.contains(i)), 'every figure field is inside the details panel').toBe(true)
  expect(document.querySelectorAll('[data-testid="inspector-your-figure"]')).toHaveLength(1)
  expect(document.querySelectorAll(ANY_OTHER_EDITOR), 'no other editor').toHaveLength(0)
  expect(document.activeElement, 'its first field is focused').toBe(inputs[0])
}

const Layer = (): JSX.Element => <ToastProvider><LaneEditingLayer /></ToastProvider>

const menuTarget = (kind: Kind): ContextTarget => kind === 'link'
  ? { kind: 'edge', edgeId: 'e', isStructural: false, screenPos: { x: 1, y: 1 }, edge: { id: 'e', data: { link: LINK } } as never }
  : { kind: 'node', nodeId: IDS[kind], nodeType: 'factor', node: { id: IDS[kind], position: { x: 0, y: 0 }, data: {} } as never, screenPos: { x: 10, y: 10 } }
const ROW: Record<Kind, RegExp> = { plain: /Change figure/, risk: /Set chance and size/, link: /Set strength/ }

/** Each way a person asks to change a figure. A link has no pencil on a card and no Model-tab row: the routes it has are the menu and the panel. */
const ROUTES: Array<{ name: string; kinds: Kind[]; go: (k: Kind) => Promise<void> }> = [
  { name: 'the card\'s pencil', kinds: ['plain', 'risk'], go: async (k) => { render(<><ViewCard card={cardOf(IDS[k])} /><Layer /></>); fireEvent.click(screen.getByTestId(`view-figure-edit-${IDS[k]}`)) } },
  { name: 'right-click: Change figure / Set chance and size / Set strength', kinds: ['plain', 'risk', 'link'], go: async (k) => {
    const Host = (): JSX.Element => {
      const t = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
      return <ToastProvider>{t === null ? null : <CanvasContextMenu target={t} onClose={() => useLaneInspector.getState().close('menu')} screenToFlowPosition={(p) => p} interactionMode="select" onSetInteractionMode={() => undefined} />}<LaneEditingLayer /></ToastProvider>
    }
    useLaneInspector.getState().show({ kind: 'menu', target: menuTarget(k) }); render(<Host />)
    fireEvent.click(await screen.findByRole('menuitem', { name: ROW[k] }))
  } },
  { name: 'the Model tab\'s figure edit', kinds: ['plain'], go: async (k) => {
    const c = render(<><ViewModelTab model={useViewStore.getState().view!.model!} /><Layer /></>).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    fireEvent.click(c.querySelector(`[data-model-value-edit="${IDS[k]}"]`)!)
  } },
  { name: 'the details panel\'s own field', kinds: ['plain', 'risk', 'link'], go: async (k) => {
    useLaneInspector.getState().open({ kind: k === 'link' ? 'link' : 'card', id: IDS[k] }); render(<Layer />)
    ;(document.querySelector(ANY_FIGURE_INPUT) as HTMLInputElement).focus() // the person presses into the field
  } },
]

describe('surfaces step 5: one figure editor, the details panel\'s Value row', () => {
  for (const r of ROUTES) for (const k of r.kinds) {
    it(`S5-1 ${r.name} on a ${k}: exactly one editor, inside the details panel, first field focused`, async () => {
      await r.go(k)
      expectOne(k)
    })
  }

  it('S5-2 asked again, the field takes focus again (a second press of the pencil)', async () => {
    await ROUTES[0]!.go('plain')
    expectOne('plain')
    ;(document.activeElement as HTMLElement).blur()
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${PLAIN}`))
    expectOne('plain')
  })

  // A Set posts what the old editor posted: the same route and body. Compared with the older look's own editor, run in the same test (lane off).
  const OLD: Record<Kind, () => Promise<void>> = {
    plain: async () => { render(<ViewCard card={cardOf(PLAIN)} />); fireEvent.click(screen.getByTestId(`view-figure-edit-${PLAIN}`)); fireEvent.change(screen.getByTestId(`view-figure-typed-${PLAIN}`), { target: { value: ' 150 to 400 ' } }); fireEvent.click(screen.getByTestId(`view-figure-set-${PLAIN}`)) },
    risk: async () => { render(<><ViewCard card={cardOf(RISK)} /><Layer /></>); fireEvent.click(screen.getByTestId('lane-size-edit')); fireEvent.change(screen.getByTestId('lane-edit-chance'), { target: { value: '20%' } }); fireEvent.change(screen.getByTestId('lane-edit-change'), { target: { value: '-40' } }); fireEvent.click(screen.getByTestId('lane-edit-go')) },
    link: async () => { useLaneInspector.getState().open({ kind: 'link', id: LINK_ID }); render(<Layer />); fireEvent.click(screen.getByTestId('lane-inspector-size')); fireEvent.change(screen.getByTestId('lane-edit-typed'), { target: { value: '0.4' } }); fireEvent.click(screen.getByTestId('lane-edit-go')) },
  }
  const NEW: Record<Kind, () => Promise<void>> = {
    plain: async () => { await ROUTES[0]!.go('plain'); fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: ' 150 to 400 ' } }); fireEvent.click(screen.getByTestId('inspector-figure-set')) },
    risk: async () => { await ROUTES[0]!.go('risk'); fireEvent.change(screen.getByTestId('inspector-figure-chance'), { target: { value: '20%' } }); fireEvent.change(screen.getByTestId('inspector-figure-change'), { target: { value: '-40' } }); fireEvent.click(screen.getByTestId('inspector-figure-set')) },
    link: async () => { await ROUTES[3]!.go('link'); fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '0.4' } }); fireEvent.click(screen.getByTestId('inspector-figure-set')) },
  }
  const strip = (c: Call): unknown => { const { op: _op, ...rest } = (c.body ?? {}) as Record<string, unknown>; return { path: c.path, body: rest } }
  for (const k of ['plain', 'risk', 'link'] as Kind[]) {
    it(`S5-3 a Set on a ${k} posts the same route and body as the older editor did (contrast: the lane off)`, async () => {
      lane(false); await OLD[k](); await waitFor(() => expect(posts()).toHaveLength(1))
      const was = strip(posts()[0]!)
      cleanup(); resetWrites(); useLaneInspector.setState({ current: null, drafts: {} }); install(); lane(true)
      await NEW[k](); await waitFor(() => expect(posts()).toHaveLength(1))
      expect(strip(posts()[0]!)).toEqual(was)
      expect(was).toMatchObject({ path: expect.stringMatching(k === 'plain' ? /\/edit$/ : /\/size$/) })
      expect(posts()[0]!.body).toMatchObject({ op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) })
    })
  }

  it.each(['plain', 'risk', 'link'] as Kind[])('S5-4 a save in flight on a %s is not cut off: nothing replaces the panel, Escape and a press on empty canvas leave it, and it settles', async (k) => {
    const route = k === 'link' ? ROUTES[3]! : ROUTES[0]!
    await route.go(k)
    gateOn()
    fireEvent.change(document.querySelector<HTMLInputElement>(`[data-testid="inspector-figure-${FIELDS[k][0]}"]`)!, { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    const title = screen.getByTestId('lane-inspector-title').textContent
    expect(useLaneInspector.getState().openFigure({ kind: 'card', id: OTHER }), 'another card cannot take the panel while it saves').toBe(false)
    expect(useLaneInspector.getState().open({ kind: 'card', id: OTHER })).toBeUndefined()
    act(() => { useLaneInspector.getState().dismiss(true) })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByTestId('lane-inspector-title').textContent, 'still this item, still open').toBe(title)
    expect((document.querySelector('[data-testid="inspector-figure-set"]') as HTMLButtonElement).disabled).toBe(true)
    act(() => release())
    await waitFor(() => expect(screen.getByTestId('inspector-figure-note')).toHaveTextContent('Saved.'))
    expect(posts()).toHaveLength(1)
  })

  it('S5-5 the typing is kept per card: A\'s words are there when the panel comes back to A, and B starts empty (a risk\'s chance too)', async () => {
    useLaneInspector.getState().openFigure({ kind: 'card', id: PLAIN }); render(<Layer />)
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '777' } })
    act(() => { useLaneInspector.getState().openFigure({ kind: 'card', id: OTHER }) })
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value).toBe('')
    act(() => { useLaneInspector.getState().openFigure({ kind: 'card', id: RISK }) })
    fireEvent.change(screen.getByTestId('inspector-figure-chance'), { target: { value: '30%' } })
    act(() => { useLaneInspector.getState().openFigure({ kind: 'card', id: PLAIN }) })
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value).toBe('777')
    act(() => { useLaneInspector.getState().openFigure({ kind: 'card', id: RISK }) })
    expect((screen.getByTestId('inspector-figure-chance') as HTMLInputElement).value).toBe('30%')
    expect(posts()).toHaveLength(0)
  })

  it('S5-6 the version it opened on is kept: after the model moves, Set still posts the old base until "Use the latest version" is pressed', async () => {
    await ROUTES[0]!.go('plain')
    const opened = useViewStore.getState().view!.model!.edit_base!
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    expect(screen.queryByTestId('inspector-figure-moved')).toBeNull()
    act(() => { const v = useViewStore.getState().view!; useViewStore.setState({ view: { ...v, model: { ...v.model!, edit_base: opened + 1 } } }) })
    fireEvent.click(screen.getByTestId('inspector-figure-rebase'))
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value).toBe('150')
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ base: opened + 1, typed: '150' })
  })

  it('S5-6b must not change (PL 7 Nov): without the press the Set stays on the base the field opened on, never moved onto a newer version by a re-read', async () => {
    await ROUTES[0]!.go('plain')
    const opened = useViewStore.getState().view!.model!.edit_base!
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    act(() => { const v = useViewStore.getState().view!; useViewStore.setState({ view: { ...v, model: { ...v.model!, edit_base: opened + 7 } } }) })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ base: opened, quantity: PLAIN, typed: '150' })
  })

  it('S5-7 while Olumi\'s change is held the field and its typing stay, core says why, and nothing is sent', async () => {
    await ROUTES[0]!.go('plain')
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    act(() => {
      const v = useViewStore.getState().view!
      useViewStore.setState({ view: { ...v, model: { ...v.model!, edit_base: null, cards: v.model!.cards.map((c) => (c.id === PLAIN ? { ...c, figure: { ...c.figure!, edit: null } } : c)) } } as never })
    })
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value).toBe('150')
    expect(screen.getByTestId('inspector-figure-held')).toBeInTheDocument()
    expect(screen.getByTestId('inspector-figure-set')).toBeDisabled()
    expect(posts()).toHaveLength(0)
  })

  it('S5-8 Try without saving is kept on a figure (a copy, nothing saved) and a risk or a link does not offer it', async () => {
    await ROUTES[0]!.go('plain')
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    fireEvent.click(screen.getByTestId('inspector-figure-try'))
    await waitFor(() => expect(posts().length).toBeGreaterThan(0))
    expect(posts().every((p) => !p.path.endsWith('/edit'))).toBe(true)
    cleanup(); useLaneInspector.setState({ current: null })
    await ROUTES[0]!.go('risk')
    expect(screen.queryByTestId('inspector-figure-try')).toBeNull()
  })

  it('S5-9 core\'s refusal is shown under the field in core\'s own words, the typing kept', async () => {
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') { const v = useViewStore.getState().view!; return new Response(JSON.stringify(String(u) === '/api/me' ? { me: { id: v.you_id, name: v.you } } : v), { status: 200 }) }
      return new Response(JSON.stringify({ error: RISK_EDIT.ask }), { status: 400 })
    }) as unknown as typeof fetch)
    await ROUTES[0]!.go('risk')
    fireEvent.change(screen.getByTestId('inspector-figure-chance'), { target: { value: '150%' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    expect(await screen.findByTestId('inspector-figure-note')).toHaveTextContent(RISK_EDIT.ask)
    expect((screen.getByTestId('inspector-figure-chance') as HTMLInputElement).value).toBe('150%')
  })
})

describe('surfaces step 5: the other controls that open a figure editor ask for the same Value row', () => {
  it('S5-10 the panel\'s own "most likely" line: its pencil opens the named figure\'s Value row, one editor, focused. KEPT ON ITS OLD PATH: a figure with no card ("worth checking first" gives one) has no details to open, so it keeps its in-place editor, and only that', async () => {
    const model = useViewStore.getState().view!.model!
    const fig = model.run!.science[0]!.figure!, est = model.cards.find((c) => c.id === model.run!.most_likely!.estimate)!
    expect(model.cards.some((c) => c.id === fig.id), 'precondition: the line\'s figure is not a card').toBe(false)
    render(<><ViewChances model={model} /><Layer /></>)
    fireEvent.click(screen.getByTestId(`likely-edit-${est.id}`))
    expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent(est.heading)
    expect(Array.from(document.querySelectorAll(ANY_FIGURE_INPUT)).map((i) => i.getAttribute('data-testid'))).toEqual(['inspector-figure-typed'])
    expect(document.querySelectorAll(ANY_OTHER_EDITOR)).toHaveLength(0)
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '40' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ quantity: est.id, typed: '40' })
    fireEvent.click(screen.getByTestId(`worth-edit-${fig.id}`))
    expect(screen.getByTestId(`worth-typed-${fig.id}`), 'the card-less figure keeps its own editor').toBeInTheDocument()
  })

  it('S5-11 an aim\'s question (another card\'s words) opens its target\'s Value row, and its words stay on the aim, never dropped; with no edit offered they are plain words', () => {
    const edit = cardOf(PLAIN).figure!.edit
    render(<><FigureEdit id={PLAIN} edit={edit} place="view-aim" opener={<span>What target would you set?</span>} /><Layer /></>)
    fireEvent.click(screen.getByTestId(`view-aim-edit-${PLAIN}`))
    expect(screen.getByTestId(`view-aim-edit-${PLAIN}`)).toHaveTextContent('What target would you set?')
    expectOne('plain')
    cleanup(); useLaneInspector.setState({ current: null })
    render(<FigureEdit id={PLAIN} edit={null} place="view-aim" opener={<span data-testid="words">What target would you set?</span>} />)
    expect(screen.getByTestId('words')).toBeInTheDocument()
    expect(screen.queryByTestId(`view-aim-edit-${PLAIN}`)).toBeNull()
  })

  it('S5-12 set aside and edit: Olumi\'s pending change is set aside first, then the Value row opens with that said, and Set posts on the base core returned', async () => {
    const ok = approved(), base = ok.model!.edit_base!
    const proposal = { id: 41, base, heading: 'Olumi proposes 3 changes', on: 'on version 1', removed: null, problem: null, marks: [], changes: [], groups: null, from: null }
    const held = { ...ok, proposal, model: { ...ok.model!, edit_base: null, cards: ok.model!.cards.map((c) => (c.figure ? { ...c, figure: { ...c.figure, edit: null } } : c)) } } as unknown as View
    let served: View = held
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET', p = String(u)
      calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: ok.you_id, name: ok.you } }), { status: 200 })
      if (method === 'GET') return new Response(JSON.stringify(served), { status: 200 })
      if (p.endsWith('/discard')) { served = ok; return new Response(JSON.stringify({ receipt: 'discard:41' }), { status: 200 }) }
      return new Response(JSON.stringify({ version: 9, n: 2, receipt: 'approve:42' }), { status: 201 })
    }) as unknown as typeof fetch)
    useViewStore.setState({ view: held })
    const Live = (): JSX.Element => { const v = useViewStore((st) => st.view)!; return <ViewCard card={v.model!.cards.find((c) => c.id === PLAIN)!} /> }
    render(<><Live /><Layer /></>)
    fireEvent.click(screen.getByTestId(`view-figure-aside-edit-${PLAIN}`))
    fireEvent.click(screen.getByTestId(`view-figure-aside-confirm-${PLAIN}`))
    await waitFor(() => expect(screen.getByTestId('inspector-figure-typed')).toBeInTheDocument())
    expect(screen.getByTestId('inspector-figure-aside')).toHaveTextContent(ASIDE_WORDS.done)
    expectOne('plain')
    expect(document.querySelectorAll('[data-testid^="view-figure-form-"]')).toHaveLength(0)
    expect(useAsideEdit.getState().id).toBeNull()
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[0]!.path).toBe('/api/proposals/41/discard')
    expect(posts()[1]!.body).toMatchObject({ base, quantity: PLAIN, typed: '12' })
  })
})

describe('surfaces step 5 CONTRAST: the older look\'s routes are unchanged', () => {
  beforeEach(() => { cleanup(); lane(false); install() })
  it('S5-C1 the card\'s pencil opens the pop-over under the card, not the details', () => {
    render(<><ViewCard card={cardOf(PLAIN)} /><Layer /></>)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${PLAIN}`))
    expect(document.querySelectorAll('[data-figure-edit-panel]')).toHaveLength(1)
    expect(screen.queryByTestId('lane-inspector')).toBeNull()
  })
  it('S5-C2 a risk\'s pencil opens the small form, and the panel keeps its own Set chance and size button and its "Your figure" field is not drawn for a risk', () => {
    render(<><ViewCard card={cardOf(RISK)} /><Layer /></>)
    fireEvent.click(screen.getByTestId('lane-size-edit'))
    expect(screen.getByTestId('lane-edit-form')).toBeInTheDocument()
    expect(screen.queryByTestId('lane-inspector')).toBeNull()
    cleanup(); useLaneInspector.setState({ current: null })
    useLaneInspector.getState().open({ kind: 'card', id: RISK }); render(<Layer />)
    expect(screen.getByTestId('lane-inspector-size')).toBeInTheDocument()
    expect(screen.queryByTestId('inspector-your-figure')).toBeNull()
  })
  it('S5-C3 the Model tab keeps its own inline editor', () => {
    const c = render(<><ViewModelTab model={useViewStore.getState().view!.model!} /><Layer /></>).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    fireEvent.click(c.querySelector(`[data-model-value-edit="${PLAIN}"]`)!)
    expect(c.querySelectorAll('[data-model-editor]')).toHaveLength(1)
    expect(screen.queryByTestId('lane-inspector')).toBeNull()
  })
})
