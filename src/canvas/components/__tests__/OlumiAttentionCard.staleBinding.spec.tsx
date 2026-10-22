/**
 * ⭐ "THE MODEL HAS CHANGED SINCE OLUMI SAID THIS" MEANS THE SAVED MODEL MOVED (DL, 22 Oct 2026). Served before (CEE
 * 0bee826e): every freshly drafted note said it, on a model nobody edited, because the note bound to `layoutVersion` and
 * the draft laid itself out again after the note was pinned. The note now binds to the turn's saved model (`graph_hash`),
 * and the card compares it to `lastServerGraphHash`. The real negative stays: a saved change after the note says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))

import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import { requestOlumiAttention } from '../../utils/olumiAttention'

const ANCHOR = 'goal_launch'
const STALE = `${OLUMI_ATTENTION_CARD_TESTID}-stale`
function seed(savedHash: string | null) {
  useCanvasStore.setState({
    nodes: [{ id: ANCHOR, type: 'goal', position: { x: 0, y: 40 }, measured: { width: 200, height: 80 }, data: { label: 'Launch within six months' } } as never],
    edges: [],
    olumiAttention: null,
    lastServerGraphHash: savedHash,
  } as never)
}

afterEach(() => { cleanup(); useCanvasStore.setState({ olumiAttention: null, lastServerGraphHash: null } as never) })

describe('a note says the model changed only when the saved model moved', () => {
  it('⭐ a draft\'s note, bound to its turn\'s hash before the store records it, is current once that hash lands; a layout re-run changes nothing', () => {
    seed(null)
    act(() => { requestOlumiAttention({ nodeIds: [ANCHOR], note: { body: 'What must the first version include?' }, modelVersion: 'h_draft' }) })
    expect(useCanvasStore.getState().olumiAttention?.modelVersion).toBe('h_draft')
    act(() => { useCanvasStore.getState().setLastServerGraphHash('h_draft') })
    render(<OlumiAttentionCard />)
    act(() => { useCanvasStore.setState({ layoutVersion: useCanvasStore.getState().layoutVersion + 3 } as never) })
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).textContent).toContain('What must the first version include?')
    expect(screen.queryByTestId(STALE)).toBeNull()
  })

  it('⛔ NEGATIVE KEPT: a saved change after the note (a new server hash) says the model has changed', () => {
    seed('h_draft')
    act(() => { requestOlumiAttention({ nodeIds: [ANCHOR], note: { body: 'What must the first version include?' }, modelVersion: 'h_draft' }) })
    render(<OlumiAttentionCard />)
    expect(screen.queryByTestId(STALE)).toBeNull()
    act(() => { useCanvasStore.getState().setLastServerGraphHash('h_after_edit') })
    expect(screen.getByTestId(STALE).textContent).toBe('The model has changed since Olumi said this.')
  })

  it('a caller with no turn hash binds to the saved model it is shown on; with none held, the card claims nothing', () => {
    seed('h_held')
    act(() => { requestOlumiAttention({ nodeIds: [ANCHOR], note: { body: 'Is this figure yours?' } }) })
    expect(useCanvasStore.getState().olumiAttention?.modelVersion).toBe('h_held')
    seed(null)
    act(() => { requestOlumiAttention({ nodeIds: [ANCHOR], note: { body: 'Is this figure yours?' } }) })
    render(<OlumiAttentionCard />)
    act(() => { useCanvasStore.getState().setLastServerGraphHash('h_later') })
    expect(screen.queryByTestId(STALE)).toBeNull()
  })

  it('⛔ NEGATIVE KEPT: renaming the item the note is about says the model changed (the saved hash leaves labels out)', () => {
    seed('h_draft')
    act(() => { requestOlumiAttention({ nodeIds: [ANCHOR], note: { body: 'What must the first version include?' }, modelVersion: 'h_draft' }) })
    render(<OlumiAttentionCard />)
    expect(screen.queryByTestId(STALE)).toBeNull()
    act(() => {
      useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => ({ ...n, data: { ...(n.data as object), label: 'Launch a paid beta' } })) } as never)
    })
    expect(screen.getByTestId(STALE).textContent).toBe('The model has changed since Olumi said this.')
  })
})
