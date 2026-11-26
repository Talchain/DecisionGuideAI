/** V12 Simple: every card and link is drawn at both levels (Simple removes text, not structure); each card kind has its visual; the pill switches per scenario. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useCanvasStore } from '../../../canvas/store'
import { useViewStore } from '../../store'
import { useSimpleBudgetKey, useViewCanvas, VIEW_CARD, VIEW_LINK } from '../../canvas'
import { cardLinks, drawnModelOf } from '../../layout'
import { cardGroupsOf } from '../bands/groups'
import { useLaneInspector } from '../edit/inspectorStore'
import { useWhatIf } from '../../whatif'
import { chanceParts, headlineChanceRow } from '../cards/words'
import { levelOf, setDefaultLevel, showSimple, showWholeModel, useSimpleLevel } from '../simpleStore'
import { bandAxisOf, bandRowsOf, chanceWordsOf, SimpleFace } from '../SimpleFace'
import { LensesMenu } from '../lenses/LensesMenu'
import { figureRange } from '../contract'
import { RangeBar } from '../scale/RangeBar'
import { axisOf, pctOf } from '../scale/axis'
import { tipOf } from '../../__tests__/tipHelpers'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../canvas/hydrate/serverGraphHydration', async (real) => ({ ...(await real<object>()), hydrateCanvasFromServer: vi.fn(async () => 'merged') }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const SID = 's_0123456789ab'
const european: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/european.view3.json'), 'utf8'))
const model = european.model!
const whole = drawnModelOf(model)
const card = (id: string) => model.cards.find((c) => c.id === id)!
const face = (id: string, noted = false) => render(<SimpleFace card={card(id)} model={model} noted={noted} />)

beforeEach(() => {
  window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }); setDefaultLevel('simple')
  useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true, currentScenarioId: null })
  useViewStore.setState({ uuid: 'a', sid: SID, view: european, status: 'ready', error: null })
})
afterEach(() => { setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' }); useLaneInspector.setState({ current: null }); useWhatIf.setState({ shown: null }) })

// S1 puts two of Olumi's own figures into a pending proposal (core's `change` mark, an invented title), the one field that makes them unreviewed.
const PENDING = { glyph: '+', title: 'An invented proposal', kind: 'added' }
const PROPOSED = ['horizon', 'existing_market_acquisitions']
const proposing = { ...european, model: { ...model, cards: model.cards.map((c) => (PROPOSED.includes(c.id) ? { ...c, kind: 'driver', change: PENDING } : c)) } } as unknown as View
const wholeP = drawnModelOf(proposing.model!)
const groups = cardGroupsOf(wholeP, proposing), grouped = new Set(groups.flatMap((g) => g.cards))
const drawnOnSimple = wholeP.cards.filter((c) => !grouped.has(c.id)).map((c) => c.id)
/** The served model, approved throughout: only its sentence-only records fold (S1a, the room rows). */
const approvedGroups = cardGroupsOf(whole, european), approvedGrouped = new Set(approvedGroups.flatMap((g) => g.cards))
const drawnApproved = whole.cards.filter((c) => !approvedGrouped.has(c.id)).map((c) => c.id)
/** The served model's records that are only a sentence: its assumptions and its condition (no figure). */
const SENTENCES = ['country_readiness', 'customer_flow_assumptions', 'shared_churn_stress']
const drawn = () => useCanvasStore.getState().nodes.filter((n) => n.type === VIEW_CARD).map((n) => n.id)
const groupCounts = () => useCanvasStore.getState().nodes.filter((n) => (n.data as { group?: unknown }).group !== undefined).map((n) => [n.id, (n.data as { count: number }).count])
describe('V12 Simple draws the model\'s structure; Olumi\'s proposed and approved notes folded (D1)', () => {
  it('S1 Simple draws every card but the folded ones, each row\'s group card standing for them by count; Detailed draws every card and every link', async () => {
    act(() => useViewStore.setState({ view: proposing }))
    const { rerender } = renderHook(() => useViewCanvas(true))
    const links = () => useCanvasStore.getState().edges.filter((e) => e.type === VIEW_LINK).length
    expect(levelOf(SID)).toBe('simple')
    expect(PROPOSED.filter((id) => grouped.has(id))).toEqual([])
    expect(PROPOSED.map((id) => card(id).author?.by)).toEqual(['olumi', 'olumi'])
    await vi.waitFor(() => expect(drawn()).toEqual(drawnOnSimple))
    expect(groupCounts()).toEqual(groups.map((g) => [g.id, g.cards.length]))
    expect(wholeP.cards.length, 'CONTRAST: a model with many cards').toBeGreaterThan(10)
    expect(links()).toBeGreaterThan(5)
    act(() => showWholeModel(SID)); rerender()
    await vi.waitFor(() => expect(drawn()).toEqual(wholeP.cards.map((c) => c.id)))
    expect(groupCounts(), 'Detailed folds nothing').toEqual([])
    expect(links()).toBe(cardLinks(wholeP).length)
  })
  it('S1a the approved model as served: notes fold and Olumi\'s figure with no value yet is drawn', async () => {
    expect(european.proposal ?? null).toBeNull()
    expect([card('profitability').author?.by, card('profitability').figure?.text, card('profitability').figure?.title.startsWith('not sized yet')], 'precondition: Olumi\'s, no value yet').toEqual(['olumi', '', true])
    expect([...approvedGroups.filter((g) => g.kind === 'notes').flatMap((g) => g.cards)].sort()).toEqual(SENTENCES)
    expect(approvedGrouped.has('profitability')).toBe(false)
    expect(approvedGroups.every((g) => g.kind !== 'proposed'), 'nothing is pending').toBe(true)
    expect(SENTENCES.map((id) => card(id).figure ?? null), 'precondition: none of them holds a figure').toEqual([null, null, null])
    renderHook(() => useViewCanvas(true))
    expect(levelOf(SID)).toBe('simple')
    await vi.waitFor(() => expect(drawn()).toEqual(drawnApproved))
    // CONTRAST: approved structural cards, Olumi's included, are drawn.
    for (const id of ['horizon', 'customers', 'reach_customer_target', 'investment_limit', 'broader_entry']) expect(drawn(), id).toContain(id)
    expect(groupCounts()).toEqual(approvedGroups.map((g) => [g.id, g.cards.length]))
  })
  it('S1b Olumi\'s figure stays drawn before, during and after details or a what-if', async () => {
    renderHook(() => useViewCanvas(true))
    await vi.waitFor(() => expect(drawn()).toEqual(drawnApproved))
    expect(drawn(), 'drawn at rest').toContain('profitability')
    const before = useViewStore.getState().view
    act(() => useLaneInspector.getState().open({ kind: 'card', id: 'profitability' }))
    await vi.waitFor(() => expect(drawn()).toContain('profitability'))
    act(() => useLaneInspector.getState().close())
    await vi.waitFor(() => expect(drawn()).toContain('profitability'))
    act(() => useWhatIf.setState({ shown: { sid: european.id, base: 1, quantity: 'profitability', typed: '5', variant: {} as never } }))
    await vi.waitFor(() => expect(drawn()).toContain('profitability'))
    act(() => useWhatIf.setState({ shown: null }))
    await vi.waitFor(() => expect(drawn()).toContain('profitability'))
    expect(useViewStore.getState().view, 'the View never changed').toBe(before)
  })
  it('S1c the options read A, B, C left to right in core\'s option order', async () => {
    const options = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect(options.length, 'precondition: three options').toBe(3)
    const leftToRight = () => [...useCanvasStore.getState().nodes].filter((n) => options.includes(n.id)).sort((a, b) => a.position.x - b.position.x).map((n) => n.id)
    renderHook(() => useViewCanvas(true))
    await vi.waitFor(() => expect(leftToRight()).toEqual(options))
  })
})

describe('V12 Simple follows the room (Codex 006: Fit after a resize left cards outside)', () => {
  const widthIs = (w: number) => { Object.defineProperty(window, 'innerWidth', { value: w, configurable: true }); act(() => { window.dispatchEvent(new Event('resize')) }) }
  const wide = () => Math.max(...useCanvasStore.getState().nodes.filter((n) => n.type === VIEW_CARD).map((n) => n.position.x))
  const was = window.innerWidth
  afterEach(() => { Object.defineProperty(window, 'innerWidth', { value: was, configurable: true }) })

  it('S1b CHANGED BY DESIGN (Paul 17 Nov, a card\'s max width): a much narrower room lays the Simple board out again with fewer cards across; a wider one with more (cards never widen past SIMPLE_CARD_MAX_W, so a room that keeps the count keeps the board)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 2400, configurable: true })
    const { rerender } = renderHook(() => useViewCanvas(true))
    // The served model is approved throughout: Simple draws all of it but its sentence-only records (S1a).
    await vi.waitFor(() => expect(drawn()).toEqual(drawnApproved))
    const atWide = wide()
    widthIs(600); rerender()
    await vi.waitFor(() => expect(wide(), 'the board is laid out again, narrower').toBeLessThan(atWide))
    const atNarrow = wide()
    widthIs(2400); rerender()
    await vi.waitFor(() => expect(wide(), 'and wider again').toBeGreaterThan(atNarrow))
  })

  it('S1c a few pixels change nothing; Detailed does not follow the room', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true })
    const simple = renderHook(() => useSimpleBudgetKey(true, true)), detailed = renderHook(() => useSimpleBudgetKey(true, false))
    const n = simple.result.current
    widthIs(1606)
    expect(simple.result.current).toBe(n)
    expect(detailed.result.current).toBe('')
    widthIs(900)
    const budgetOf = (key: string) => Number(key.split(':')[0])
    expect(budgetOf(simple.result.current), 'the row budget follows the room').toBeLessThan(budgetOf(n))
  })
})

describe('V12 Simple faces', () => {
  it('S2r a ranged figure says core\'s own figure words at rest, above its range bar; the bar\'s ends are only its axis (UI reviewer #27: "50,000 GBP" read as a £30,000 limit)', () => {
    // The served shape (contract `figure.range`, as scale.spec adds it), on a person's figure whose words are core's; invented values.
    const base = model.cards.find((c) => c.family === 'quantity' && c.figure != null)!
    const r = { ...base, author: { by: 'person', text: 't', title: 't' }, figure: { ...base.figure!, text: 'at most 30,000 GBP', range: { low: 0, likely: null, high: 30000, unit: 'GBP' } } } as typeof base
    expect(figureRange(r), 'precondition: a range the bar draws').not.toBeNull()
    const { container } = render(<SimpleFace card={r!} model={model} noted={false} scale={<RangeBar card={r!} view={model} />} />)
    const words = container.querySelector(`[data-simple-figure-text="${r!.id}"]`)
    expect(words?.textContent).toBe(r!.figure!.text)
    const bar = container.querySelector('[data-testid="range-bar"]')
    expect(bar).not.toBeNull()
    expect(words!.compareDocumentPosition(bar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // the words lead, the bar under them
  })
  it('S2 an option with a chance shows dots: core\'s own value words beside ten dots', () => {
    const c = card('broader_entry'), words = chanceWordsOf(c)
    expect(words).not.toBeNull()
    const { container } = face('broader_entry')
    expect(container.querySelector('[data-simple-face="chance"]')).not.toBeNull()
    expect(container.querySelector(`[data-simple-chance="broader_entry"]`)!.textContent).toBe(chanceParts(words!).head)
    expect(container.querySelectorAll('[data-chance-dot]')).toHaveLength(10)
    expect(container.querySelector('.ok-track')).toBeNull()
    expect(container.querySelector('[data-simple-face="no-chance"]')).toBeNull()
  })

  it('S2b keeps the chance lead on the face and moves the whole qualifier to hover', async () => {
    const long = 'about 31% chance, on Olumi\'s assumption for \'Weeks until the second venue opens if nothing else changes\''
    const base = card('broader_entry'), h = base.headline!
    const c = { ...base, rows: base.rows.map((r) => (r.kind === 'chance' && (r as { aim_id?: string | null }).aim_id === h.aim_id ? { ...r, value: long } : r)) } as typeof base
    expect(chanceWordsOf(c)).toBe(long)
    const { container } = render(<SimpleFace card={c} model={model} noted={false} />)
    const words = container.querySelector<HTMLElement>('[data-simple-chance="broader_entry"]')!
    const qual = container.querySelector<HTMLElement>('[data-simple-qual="broader_entry"]')!
    const parts = chanceParts(long)
    expect(words.textContent).toBe(parts.head)
    expect(container.textContent).not.toContain(parts.qualifier)
    expect((await tipOf(qual)).split('\n').slice(0, 2)).toEqual([parts.head, parts.qualifier])
    expect(words.className, 'the number\'s words wrap whole').not.toContain('line-clamp')
    expect(words.className).toContain('break-words')
    expect(words.className).toContain('min-w-0')
    expect(words.className, 'the words may shrink: never the unshrinkable line that ran across the canvas').not.toContain('flex-none')
    const dots = words.parentElement!.querySelector('[data-chance-dots]')!
    expect(words.compareDocumentPosition(dots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([{ chance: null }, { state: 'withheld' as const }])('keeps Core’s chance words with no dots for %j', (fields) => {
    const base = card('broader_entry'), served = headlineChanceRow(base)!
    const c = { ...base, rows: base.rows.map((row) => row === served ? { ...served, ...fields } : row) }
    const { container } = render(<SimpleFace card={c} model={model} noted={false} />)
    expect(container.querySelector('[data-simple-chance]')?.textContent).toBe(chanceParts(served.value).head)
    expect(container.querySelector('[data-chance-dots]')).toBeNull()
  })

  it('S2c (R6) an option with no chance is ONE quiet line in core\'s own words, its long reason the hover: no "?", no "Why not", no empty track, no zero', async () => {
    const base = card('broader_entry')
    const why = 'The chance is not worked out: in 170 samples a figure went outside what it can be, such as below zero.'
    const add = 'Give a value for the first cheque'
    const withheld = { ...base, headline: { ...base.headline!, state: 'none' as const, text: 'No chance yet', why, title: why, range: null, add } }
    const { container } = render(<SimpleFace card={withheld} model={model} noted={false} />)
    const face = container.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect(face.textContent).toBe('')
    expect(face.querySelector('[data-face-mark="chance"]')).not.toBeNull()
    expect((await tipOf(face)).split('\n').slice(0, 3)).toEqual([add, why, add])
    expect(container.querySelector('summary'), 'no "Why not"').toBeNull()
    expect(container.querySelector('.ok-empty, [data-testid$="-empty-bar"]'), 'no dashed empty track at rest').toBeNull()
    expect(container.textContent, 'no "?" and no figure drawn for what is unknown').not.toMatch(/\?|0%/)
    expect(face.className).not.toContain('line-clamp')
    // CONTRAST: core sends no next step: its headline\'s own text.
    const bare = { ...withheld, headline: { ...withheld.headline, add: null } }
    const b = render(<SimpleFace card={bare} model={model} noted={false} />).container
    expect(b.querySelector('[data-simple-face="no-chance"]')!.textContent).toBe('')
    expect((await tipOf(b.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!)).split('\n').slice(0, 2)).toEqual(['No chance yet', why])
  })

  it('S4 a figure with a modelled band is one range bar per option on one axis, inside 0 to 100', () => {
    const rows = bandRowsOf(card('churn_rate'), model)
    expect(rows.length).toBe(card('churn_rate').values!.length)
    for (const r of rows) { expect(r.lo).toBeGreaterThanOrEqual(0); expect(r.hi).toBeLessThanOrEqual(100); expect(r.lo).toBeLessThanOrEqual(r.hi) }
    const { container } = face('churn_rate')
    expect(container.querySelectorAll('[data-simple-band]').length).toBe(rows.length)
    expect(container.querySelector('[data-simple-face="figure"]'), 'CONTRAST: a stated figure draws its words instead').toBeNull()
  })

  it('S4b (v10 review item 5) Simple\'s bars sit on the real 0-based axis with its two ends printed once and the gold goal tick at the aim\'s value; near-equal ranges draw near-equal bars', () => {
    const c = card('customers'), aim = model.aim!
    const { container } = face('customers')
    const axis = axisOf(0, Math.max(...c.values!.map((v) => v.p90), aim.value))
    expect(container.querySelector('[data-testid="simple-axis-min"]')!.textContent).toBe('0')
    expect(container.querySelector('[data-testid="simple-axis-max"]')!.textContent).toBe(`${axis.max.toLocaleString('en-GB')} ${aim.unit}`)
    const tick = container.querySelector<HTMLElement>('[data-testid="simple-goal-tick"]')!
    expect([tick.getAttribute('data-at'), tick.style.getPropertyValue('--chart-x')]).toEqual([String(aim.value), `${pctOf(axis, aim.value)}%`])
    for (const r of bandRowsOf(c, model)) expect(container.querySelector<HTMLElement>(`[data-simple-band="${r.option}"] i[data-band-from]`)!.getAttribute('data-band-from')).toBe(r.lo.toFixed(1))
    // CONTRAST: a card that is not the aim's quantity has the axis ends but no goal tick.
    const other = face('churn_rate').container
    expect(other.querySelector('[data-testid="simple-axis-ends"]')).not.toBeNull()
    expect(other.querySelector('[data-testid="simple-goal-tick"]')).toBeNull()
    // Near-equal ranges: the old min-to-max axis stretched 100-110 against 101-111 to the whole bar; on the real axis they are near-equal and short.
    const [a, b] = c.values!
    const near = { ...c, values: [{ ...a!, p10: 100, p50: 105, p90: 110 }, { ...b!, p10: 101, p50: 106, p90: 111 }] } as typeof c
    const rows = bandRowsOf(near, model)
    expect([Math.abs(rows[0]!.lo - rows[1]!.lo) < 2, rows[0]!.hi - rows[0]!.lo < 5]).toEqual([true, true])
    expect(bandAxisOf(near, model)!.min).toBe('0')
  })

  it('S4c an unsized figure uses an empty track', () => {
    const q = face('profitability').container.querySelector<HTMLElement>('[data-simple-face="no-figure"]')!
    expect(q.querySelector('[data-face-mark="track"]')).not.toBeNull()
    expect(q.textContent).toBe('')
  })

  it('S5 a stated figure shows core\'s words on one line; a figure with no value is a dashed empty bar', () => {
    const { container } = face('starting_customers')
    expect(container.querySelector('[data-simple-face="figure"]')!.textContent).toBe(card('starting_customers').figure!.text)
    const empty = face('profitability').container
    expect(empty.querySelector('[data-simple-face="no-figure"]')).not.toBeNull()
    expect(empty.querySelector('[data-simple-face="figure"]')).toBeNull()
  })

  it('S6 a withheld chance puts its reason in hover and uses an empty outline', async () => {
    const opt = card('broader_entry')
    const built = { ...opt, headline: { ...opt.headline!, state: 'none' as const, why: 'A figure is missing' }, rows: [] }
    const { container } = render(<SimpleFace card={built as never} model={model} noted={false} />)
    const f = container.querySelector('[data-simple-face="no-chance"]')!
    expect(await tipOf(f as HTMLElement)).toContain('A figure is missing')
    expect(f.querySelector('[data-face-mark="chance"]')).not.toBeNull()
    expect(container.querySelector('[data-chance-dots], .ok-track')).toBeNull()
  })

  it('S7 an aim shows its bound and a target mark', () => {
    const { container } = face('reach_customer_target')
    expect(container.querySelector('[data-simple-face="target"]')!.textContent).toContain(card('reach_customer_target').bound!.text)
  })

  it('S8 authorship is a glyph (Olumi\'s or a person\'s) with the words on hover; Olumi\'s note is a badge only where it sits', () => {
    expect(face('horizon').container.querySelector('[data-simple-author="olumi"]')).not.toBeNull()
    expect(face('starting_customers').container.querySelector('[data-simple-author="person"]')!.getAttribute('aria-label')).toBe(card('starting_customers').author!.text + (card('starting_customers').author!.title ? ` · ${card('starting_customers').author!.title}` : ''))
    expect(face('horizon', true).container.querySelector('[data-simple-note="horizon"]')).not.toBeNull()
    expect(face('horizon', false).container.querySelector('[data-simple-note]')).toBeNull()
  })
})

describe('V12 Simple | Detailed, in the left Lenses menu (Paul, 18 Nov: no panel of its own at the canvas foot)', () => {
  it('S9 two choices at the head of the Lenses menu; the choice is kept per scenario and another scenario is unaffected', () => {
    render(<LensesMenu />)
    // Closed, the menu draws neither choice: nothing sits on the canvas at rest.
    expect(screen.queryByTestId('view-level-simple')).toBeNull()
    fireEvent.click(screen.getByTestId('v12-layers-button'))
    expect([screen.getByTestId('view-level-simple').getAttribute('aria-checked'), screen.getByTestId('view-level-detailed').getAttribute('aria-checked')]).toEqual(['true', 'false'])
    expect([screen.getByTestId('view-level-simple').textContent, screen.getByTestId('view-level-detailed').textContent]).toEqual(['Simple', 'Detailed'])
    fireEvent.click(screen.getByTestId('view-level-detailed'))
    expect(levelOf(SID)).toBe('working')
    expect(window.localStorage.getItem(`olumi.v12.level.${SID}`)).toBe('working')
    expect(levelOf('s_other')).toBe('simple')
    // The press closes the menu; reopened, it shows the choice made.
    expect(screen.queryByTestId('view-level-detailed')).toBeNull()
    fireEvent.click(screen.getByTestId('v12-layers-button'))
    expect(screen.getByTestId('view-level-detailed').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('view-level-simple'))
    expect(levelOf(SID)).toBe('simple')
    act(() => showSimple(SID))
  })
})
