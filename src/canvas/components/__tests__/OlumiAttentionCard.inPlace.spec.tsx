/**
 * Olumi's note on the model (canvas vision step 2, 20 Oct 2026): the card says only what the producer said, labels a
 * note with a move only when the producer named one, opens the inspector from "Open details", and stays clear of the
 * dock by standing on the card's left when the right would run under it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID, attentionCardSpot } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import type { OlumiAttentionNote } from '../../utils/olumiAttention'
import { useAnsweredQuestionsStore } from '../../stores/answeredQuestionsStore'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
const asked = vi.hoisted(() => ({ calls: [] as unknown[], result: 'sent' as string }))
vi.mock('../../conversation/askAi', () => ({ askAi: (req: unknown) => { asked.calls.push(req); return asked.result } }))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: () => undefined }))
const dock = { inset: 0 }
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => dock.inset }))

const ANCHOR = 'dev_capacity'
function hold(note: OlumiAttentionNote, x = 0) {
  useCanvasStore.setState({
    nodes: [{ id: ANCHOR, type: 'factor', position: { x, y: 40 }, measured: { width: 200, height: 80 }, data: {} } as never],
    edges: [],
    olumiAttention: { nodeIds: [ANCHOR], edgeIds: [], note, caveat: null, turnId: null, modelVersion: null },
  })
}
const card = () => screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)

afterEach(() => { cleanup(); dock.inset = 0; asked.calls.length = 0; asked.result = 'sent'; useCanvasStore.setState({ olumiAttention: null }) })

describe('Olumi’s note on the model', () => {
  it('a note with no move is labelled as Olumi’s, never given a move nobody chose', () => {
    hold({ title: 'Two developers lean on one untested link', body: 'New hires usually cost senior time first.' })
    render(<OlumiAttentionCard />)
    expect(card().querySelector('[data-icon="olumi-brand-mark"]'), 'Olumi is the mark, not a coloured word').not.toBeNull()
    expect(card().textContent).toContain('Olumi')
    expect(card().textContent).not.toContain('Challenge')
    expect(card().hasAttribute('data-move')).toBe(false)
  })

  it('⭐ a question is answered where it is asked: the person\'s words go to Olumi about this item, and the note steps aside', () => {
    hold({ body: 'How much angel funding do you need, and in which currency?' })
    render(<OlumiAttentionCard />)
    const box = screen.getByRole('textbox', { name: 'Your answer' })
    const send = screen.getByRole('button', { name: 'Send your answer to Olumi' })
    expect(send).toHaveProperty('disabled', true)
    fireEvent.change(box, { target: { value: '£250,000, committed in writing' } })
    fireEvent.click(send)
    expect(asked.calls).toEqual([{ userWords: '£250,000, committed in writing', nodeIds: [ANCHOR] }])
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
  })

  it('⭐ the answered item keeps the question and the answer, for its tick (this scenario only); a send that did not go records nothing', () => {
    useCanvasStore.setState({ currentScenarioId: 'scn-answered' } as never)
    hold({ body: 'Which currency is the funding in?' })
    render(<OlumiAttentionCard />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: ' Sterling ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send your answer to Olumi' }))
    expect(useAnsweredQuestionsStore.getState().byScenario['scn-answered']?.[ANCHOR]).toMatchObject({ question: 'Which currency is the funding in?', answer: 'Sterling' })
    cleanup()
    asked.result = 'busy'
    hold({ body: 'By which date?' }, 0)
    useCanvasStore.setState({ currentScenarioId: 'scn-busy' } as never)
    render(<OlumiAttentionCard />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: 'March' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send your answer to Olumi' }))
    expect(useAnsweredQuestionsStore.getState().byScenario['scn-busy']).toBeUndefined()
  })

  it('a send that does not go (Olumi busy) keeps the answer and the note', () => {
    asked.result = 'busy'
    hold({ body: 'Which month does the deadline fall in?' })
    render(<OlumiAttentionCard />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: 'March' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send your answer to Olumi' }))
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveProperty('value', 'March')
    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()
  })

  it('CONTRAST: a note that asks nothing has no answer box', () => {
    hold({ body: 'This link carries most of the result.' })
    render(<OlumiAttentionCard />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('CONTRAST: a move the producer named is the label', () => {
    hold({ move: 'challenge', title: 'Look here', body: 'This link carries most of the result.' })
    render(<OlumiAttentionCard />)
    expect(card().textContent).toContain('Challenge')
  })

  it('a plain-string note (the contract’s form) shows just its sentence', () => {
    hold({ body: 'This link carries most of the result.' })
    render(<OlumiAttentionCard />)
    expect(card().querySelectorAll('p')[0]?.textContent).toBe('This link carries most of the result.')
  })

  it('"Open details" opens the inspector on the item and the note steps aside', () => {
    hold({ title: 't', body: 'b', actions: [{ id: 'x:details', label: 'Open details', kind: 'details' }] })
    let opened = false
    const onOpen = () => { opened = true }
    window.addEventListener('olumi:open-full-inspector', onOpen)
    render(<OlumiAttentionCard />)
    fireEvent.click(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-action`))
    expect(opened).toBe(true)
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
    window.removeEventListener('olumi:open-full-inspector', onOpen)
  })

  it('stands on the card’s left when its right would run under the dock', () => {
    const innerWidth = window.innerWidth
    hold({ body: "b" }, innerWidth - 600)
    render(<OlumiAttentionCard />)
    expect(parseFloat(card().style.left)).toBe(innerWidth - 600 + 200 + 14)
    cleanup()
    dock.inset = 360
    render(<OlumiAttentionCard />)
    expect(parseFloat(card().style.left)).toBe(innerWidth - 600 - 268 - 14)
  })
})

describe('where the note sits (Paul\'s pre-flight, 22 Oct: on the left it covered the next option\'s title)', () => {
  // Served shape at 1440: O2 is the anchor, O1 sits to its left, the dock starts at 1080 (room right 1066).
  const O1 = { x: 178, y: 320, w: 335, h: 98 }
  const O2 = { x: 554, y: 320, w: 335, h: 98 }
  const F2 = { x: 178, y: 510, w: 335, h: 100 }
  it('⭐ right runs under the dock and left covers O1 → below the anchor, where nothing is', () => {
    expect(attentionCardSpot(O2, { w: 268, h: 110 }, [O1, F2], 0, 1066)).toEqual({ left: 554, top: 432 })
  })
  it('⭐ nothing fully free (served café board, 22 Oct): the spot that covers least, never back over O1', () => {
    const question = { x: 256, y: 115, w: 602, h: 85 } // bottom at 200: the spot above O2 touches it by 4px
    const F3 = { x: 554, y: 510, w: 335, h: 100 }
    expect(attentionCardSpot(O2, { w: 268, h: 110 }, [question, O1, F2, F3], 0, 1066)).toEqual({ left: 554, top: 196 })
  })
  it('CONTRAST: a free spot on the right or left is exactly as before; unmeasured, or all covered alike → as before', () => {
    expect(attentionCardSpot(O1, { w: 268, h: 110 }, [F2], 0, 1066), 'right of O1 is free').toEqual({ left: 527, top: 320 })
    expect(attentionCardSpot(O2, { w: 268, h: 110 }, [F2], 0, 1066), 'left of O2, nothing there').toEqual({ left: 272, top: 320 })
    expect(attentionCardSpot(O2, { w: 268, h: 0 }, [O1, F2], 0, 1066), 'unmeasured').toEqual({ left: 272, top: 320 })
    const wall = { x: 0, y: 0, w: 1100, h: 2000 }
    expect(attentionCardSpot(O2, { w: 268, h: 110 }, [wall], 0, 1066), 'nothing free').toEqual({ left: 272, top: 320 })
  })
})
