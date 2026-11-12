/**
 * ⛔ NEVER OVER A CARD ON THE CORE LANE (DL 4 Nov, the real capacity model's witness: "Olumi's note covers no card" failed on the causal
 * graph). Where the whole canvas has no free spot for the note, it goes into the Olumi tab under Next step, which is opened for it; it
 * is never drawn over a card. Off the lane, and wherever a free spot exists, it stays on the canvas as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID, spotCovers } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import { VIEW_NOTE_SLOT, VIEW_NOTE_TURN } from '../../../olumiView/note'
import { ATTENTION_CARD_COPY } from '../OlumiAttentionCard'

vi.mock('@xyflow/react', () => ({ useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }) }))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
const revealed = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: () => { revealed.n += 1 } }))
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))

const W = 1200, H = 800
type R = { left: number; top: number; width: number; height: number }
const rect = (r: R) => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect
/** The board as drawn: the anchor, and `others` (the cards around it) in screen px. */
function board(others: R[], turnId: string | null = null, banner: R | null = null, ax = 500) {
  useCanvasStore.setState({
    nodes: [{ id: 'a', type: 'factor', position: { x: ax, y: 300 }, measured: { width: 200, height: 80 }, data: {} } as never],
    edges: [],
    olumiAttention: { nodeIds: ['a'], edgeIds: [], note: { title: 'What would change your mind?', body: 'What evidence would settle it?' }, caveat: null, turnId, modelVersion: null },
  })
  return render(
    <div>
      <div className="react-flow">
        <div className="react-flow__node" data-id="a" data-r={JSON.stringify({ left: ax, top: 300, width: 200, height: 80 })} />
        {others.map((o, i) => <div key={i} className="react-flow__node" data-id={`c${i}`} data-r={JSON.stringify(o)} />)}
      </div>
      {banner === null ? null : <div role="banner" data-r={JSON.stringify(banner)} />}
      <div {...{ [VIEW_NOTE_SLOT]: '' }} data-testid="slot" />
      <OlumiAttentionCard />
    </div>,
  )
}

beforeEach(() => {
  revealed.n = 0
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const r = this.dataset['r']
    return rect(r ? JSON.parse(r) as R : this === document.body ? { left: 0, top: 0, width: W, height: H } : { left: 0, top: 0, width: 0, height: 0 })
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); useCanvasStore.setState({ olumiAttention: null }) })

describe('the note on the core lane never covers a card', () => {
  // Cards everywhere around the anchor: no spot in the canvas is free.
  const full = [{ left: 0, top: 0, width: W, height: 290 }, { left: 0, top: 290, width: 490, height: H - 290 }, { left: 710, top: 290, width: W - 710, height: H - 290 }, { left: 490, top: 390, width: 220, height: H - 390 }]

  it('no free spot anywhere: the note is in the Olumi tab under Next step, which is opened for it, and the canvas shows none', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board(full)
    await vi.waitFor(() => expect(screen.getByTestId('slot').querySelector(`[data-testid="${OLUMI_ATTENTION_CARD_TESTID}"]`)).not.toBeNull())
    expect(screen.getByTestId('slot').textContent).toContain('What evidence would settle it?')
    const measure = document.querySelector<HTMLElement>('[data-note-measure]')!
    expect([measure.style.visibility, measure.getAttribute('aria-hidden'), measure.hasAttribute('inert')]).toEqual(['hidden', 'true', true])
    expect(screen.getAllByTestId(OLUMI_ATTENTION_CARD_TESTID)).toHaveLength(1)
    await vi.waitFor(() => expect(revealed.n).toBe(1))
  })

  it('⛔ in the panel, the canvas copy that is only measured is not a second note (R2 witness, 4 Nov: two "Why" on a dense board, Playwright strict mode)', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useCanvasStore.setState({ nodes: [], edges: [] })
    board(full)
    useCanvasStore.setState((s) => ({ olumiAttention: { ...s.olumiAttention!, note: { ...s.olumiAttention!.note!, why: ['Because the figure is Olumi\'s estimate.'] } } }))
    await vi.waitFor(() => expect(screen.getByTestId('slot').querySelector(`[data-testid="${OLUMI_ATTENTION_CARD_TESTID}"]`)).not.toBeNull())
    // Exactly one element per note test id, all in the panel's note.
    const ids = [...document.querySelectorAll<HTMLElement>(`[data-testid^="${OLUMI_ATTENTION_CARD_TESTID}"]`)].map((e) => e.dataset['testid'])
    expect(ids.length).toBeGreaterThan(1)
    expect(new Set(ids).size, ids.join(' ')).toBe(ids.length)
    // Exactly one "Why" a person or a screen reader can reach; the measured copy is hidden, inert, and holds no test id.
    const whys = screen.getAllByText(ATTENTION_CARD_COPY.why).filter((e) => e.closest('[aria-hidden="true"], [inert]') === null)
    expect(whys).toHaveLength(1)
    const measure = document.querySelector<HTMLElement>('[data-note-measure]')!
    expect([measure.getAttribute('aria-hidden'), measure.hasAttribute('inert'), measure.querySelectorAll('[data-testid]').length]).toEqual(['true', true, 0])
  })

  it('⛔ the note never paints on the canvas before its spot is known (integrator, 900×560: on the canvas for one frame, then in the tab): on the first render it is not visible anywhere on the canvas', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board(full)
    // Before the cards are measured (the next frame), the canvas copy is drawn invisible, so nothing can flash over a card.
    const first = [...document.querySelectorAll<HTMLElement>(`[data-testid="${OLUMI_ATTENTION_CARD_TESTID}"], [data-note-measure]`)].filter((e) => !screen.getByTestId('slot').contains(e))
    expect(first.length).toBe(1)
    expect(first[0]!.style.visibility).toBe('hidden')
    // …and it then ends in the tab, as before.
    await vi.waitFor(() => expect(screen.getByTestId('slot').querySelector(`[data-testid="${OLUMI_ATTENTION_CARD_TESTID}"]`)).not.toBeNull())
  })
  it('CONTRAST: with a free spot, once measured the note is visible on the canvas', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board([{ left: 0, top: 0, width: W, height: 290 }])
    await vi.waitFor(() => expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).style.visibility).toBe(''))
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).dataset['inPanel']).toBeUndefined()
  })

  it('CONTRAST: a free spot exists → on the canvas, over no card, the tab left as it is', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board([{ left: 0, top: 0, width: W, height: 290 }])
    await new Promise((r) => setTimeout(r, 50))
    const note = screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)
    expect(note.dataset['inPanel']).toBeUndefined()
    expect(spotCovers({ left: parseFloat(note.style.left), top: parseFloat(note.style.top) }, { w: 268, h: 120 }, [{ x: 0, y: 0, w: W, h: 290 }])).toBe(false)
    expect(revealed.n).toBe(0)
  })

  it('must not change: off the lane the note stays on the canvas (the least-covered spot, as before)', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    board(full)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByTestId('slot').childElementCount).toBe(0)
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).style.visibility).toBe('')
  })
})

describe('R1.1 (Paul\'s screen): on the core lane Olumi\'s next step is an icon at its card until pressed; its words are in the Olumi tab', () => {
  const turn = `${VIEW_NOTE_TURN}s_1:t1`
  const said = (c: HTMLElement) => (c.textContent ?? '').split('What evidence would settle it?').length - 1
  it('on load: the icon at its card, the words nowhere on the canvas or in the slot, and the Olumi tab is not opened for it', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const { container } = board([], turn)
    expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).getAttribute('aria-label')).toBe('What would change your mind?')
    expect(said(container)).toBe(0)
    expect(screen.queryByTestId(OLUMI_ATTENTION_CARD_TESTID)).toBeNull()
    expect(revealed.n).toBe(0)
  })
  it('pressed: the note opens beside its card, its words once', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const { container } = board([], turn)
    fireEvent.click(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`))
    await vi.waitFor(() => expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)).not.toBeNull())
    expect(said(container)).toBe(1)
  })
  it('CONTRAST: off the lane, and on the lane a note another surface asked for, opens as before', () => {
    const off = board([], turn)
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)).not.toBeNull()
    expect(said(off.container)).toBe(1)
    cleanup()
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board([], 'some-other-turn')
    expect(screen.queryByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`)).toBeNull()
  })
  it('⛔ the icon never sits under the dock (real capacity board on the R3 layout, 4 Nov: its card at the right edge, the icon unclickable): at the card\'s left edge when its right edge has no room', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    // The room ends at the window less the dock and a gap (jsdom: 1024 − 0 − 14 = 1010); the card's right edge is at 1000.
    board([], turn, null, 800)
    const icon = screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`)
    expect(parseFloat(icon.style.left) + 24, icon.style.left).toBeLessThanOrEqual(1010)
    expect(icon.style.left).toBe('788px') // its top-left corner (12 Nov: seated on the card, not 2 px off it)
    // CONTRAST: with room on the right, on its top-right corner (the card's right edge at 700, less half the icon).
    cleanup()
    board([], turn)
    expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).style.left).toBe('688px')
  })
  it('the icon never sits under the top bar: below its bottom when the card\'s top is under it; at the card otherwise', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board([], turn, { left: 0, top: 0, width: W, height: 340 })
    await vi.waitFor(() => expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).style.top).toBe('344px'))
    cleanup()
    board([], turn)
    expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).style.top).toBe('288px') // the card's top at 300, less half the icon
  })
})

/**
 * ⛔ THE NOTE'S SPOT IS RIGHT ON THE PAGE, NOT ONLY IN ITS OWN SUMS (fit-real-model, 4 Nov: on the real hiring board at 1440 the note covered
 * onboarding_disruption in 1 run of 4). Two inputs could change after the note was placed with nothing placing it again, or place it a
 * fraction of a pixel over a card: each row below is one, exact and without timing.
 */
describe('the note is placed by the cards and itself as they are on the page', () => {
  const noteBox = (el: HTMLElement, h: number) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) , h })

  it('⛔ a card a fraction of a pixel into the spot beside it is a card in the way (the drawn boxes were rounded to the nearest pixel, so 0.4 px over read as free)', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const card = { left: 714, top: 419.6, width: 268, height: 100 }
    board([card])
    await vi.waitFor(() => expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).style.visibility).toBe(''))
    const n = noteBox(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID), 120)
    expect(spotCovers(n, { w: 268, h: n.h }, [{ x: card.left, y: card.top, w: card.width, h: card.height }]), JSON.stringify(n)).toBe(false)
  })

  it('⛔ the note growing after it is placed (its words re-wrapped: the font arriving) places it again, over no card', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const observed: ResizeObserverCallback[] = []
    vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { observed.push(cb) } observe() {} unobserve() {} disconnect() {} })
    let h = 120
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => h)
    const card = { left: 714, top: 430, width: 268, height: 100 }
    board([card])
    await vi.waitFor(() => expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).style.visibility).toBe(''))
    expect(noteBox(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID), h).left).toBe(714) // beside it on the right, clear of the card below
    h = 200
    act(() => { for (const cb of observed) cb([], {} as ResizeObserver) })
    await new Promise((r) => setTimeout(r, 50))
    const n = noteBox(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID), h)
    expect(spotCovers(n, { w: 268, h: n.h }, [{ x: card.left, y: card.top, w: card.width, h: card.height }]), JSON.stringify(n)).toBe(false)
    vi.unstubAllGlobals()
  })
})
