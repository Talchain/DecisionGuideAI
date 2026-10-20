/**
 * Olumi's note on the model (canvas vision step 2, 20 Oct 2026): the card says only what the producer said, labels a
 * note with a move only when the producer named one, opens the inspector from "Open details", and stays clear of the
 * dock by standing on the card's left when the right would run under it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import type { OlumiAttentionNote } from '../../utils/olumiAttention'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
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

afterEach(() => { cleanup(); dock.inset = 0; useCanvasStore.setState({ olumiAttention: null }) })

describe('Olumi’s note on the model', () => {
  it('a note with no move is labelled as Olumi’s, never given a move nobody chose', () => {
    hold({ title: 'Two developers lean on one untested link', body: 'New hires usually cost senior time first.' })
    render(<OlumiAttentionCard />)
    expect(card().textContent).toContain('Olumi')
    expect(card().textContent).not.toContain('Challenge')
    expect(card().hasAttribute('data-move')).toBe(false)
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
