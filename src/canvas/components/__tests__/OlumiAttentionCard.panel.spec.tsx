/**
 * ⛔ NEVER OVER A CARD ON THE CORE LANE (DL 4 Nov, the real capacity model's witness: "Olumi's note covers no card" failed on the causal
 * graph). Where the whole canvas has no free spot for the note, it goes into the Olumi tab under Next step, which is opened for it; it
 * is never drawn over a card. Off the lane, and wherever a free spot exists, it stays on the canvas as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID, spotCovers } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import { VIEW_NOTE_SLOT, VIEW_NOTE_TURN } from '../../../olumiView/note'

vi.mock('@xyflow/react', () => ({ useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }) }))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
const revealed = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: () => { revealed.n += 1 } }))
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))

const W = 1200, H = 800
type R = { left: number; top: number; width: number; height: number }
const rect = (r: R) => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect
/** The board as drawn: the anchor, and `others` (the cards around it) in screen px. */
function board(others: R[], turnId: string | null = null, banner: R | null = null) {
  useCanvasStore.setState({
    nodes: [{ id: 'a', type: 'factor', position: { x: 500, y: 300 }, measured: { width: 200, height: 80 }, data: {} } as never],
    edges: [],
    olumiAttention: { nodeIds: ['a'], edgeIds: [], note: { title: 'What would change your mind?', body: 'What evidence would settle it?' }, caveat: null, turnId, modelVersion: null },
  })
  return render(
    <div>
      <div className="react-flow">
        <div className="react-flow__node" data-id="a" data-r={JSON.stringify({ left: 500, top: 300, width: 200, height: 80 })} />
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
    const measure = screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-measure`)
    expect([measure.style.visibility, measure.getAttribute('aria-hidden')]).toEqual(['hidden', 'true'])
    expect(screen.getAllByTestId(OLUMI_ATTENTION_CARD_TESTID)).toHaveLength(1)
    await vi.waitFor(() => expect(revealed.n).toBe(1))
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
  it('the icon never sits under the top bar: below its bottom when the card\'s top is under it; at the card otherwise', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    board([], turn, { left: 0, top: 0, width: W, height: 340 })
    await vi.waitFor(() => expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).style.top).toBe('344px'))
    cleanup()
    board([], turn)
    expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-icon`).style.top).toBe('306px')
  })
})
