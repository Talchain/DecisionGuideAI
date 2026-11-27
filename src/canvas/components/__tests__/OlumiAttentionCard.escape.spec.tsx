/**
 * ESCAPE RELEASES A HELD ATTENTION.
 *
 * Attention dims the whole model around its target. The dim is DERIVED from
 * `olumiAttention` alone, while the card renders only when there is a NOTE —
 * so the Dismiss button is not, on its own, a guaranteed way out. Escape is,
 * and it is also the key a user reaches for first when the screen dims.
 *
 * These cases bind to the STORE state rather than to the card's markup: what
 * matters is that the hold is released, not which element was on screen when
 * it was.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, cleanup } from '@testing-library/react'
import { OlumiAttentionCard } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import type { OlumiAttentionNote } from '../../utils/olumiAttention'
import { useEscapeLayer } from '../../../olumiView/v12/edit/escapeLayers'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) =>
    selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({
  openAskOlumi: vi.fn(),
}))

const note: OlumiAttentionNote = {
  move: 'challenge',
  title: 'This link is doing a lot of work',
  body: 'The ranking flips if this weakens.',
}

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

describe('OlumiAttentionCard — Escape releases the hold', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  beforeEach(() => {
    cleanup()
    useCanvasStore.setState({
      nodes: [{ id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: {} } as never],
      edges: [],
      olumiAttention: null,
    })
  })

  it('on the Olumi board, closes a newer surface before releasing a hold without a note', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useCanvasStore.setState({
      olumiAttention: { nodeIds: ['fac_price'], edgeIds: [], note: null, caveat: null, turnId: null, modelVersion: null },
    })
    render(<OlumiAttentionCard />)
    const closeNewer = vi.fn()
    function NewerSurface({ open }: { open: boolean }) {
      useEscapeLayer(open, closeNewer)
      return null
    }
    const { rerender } = render(<NewerSurface open />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(closeNewer).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()
    rerender(<NewerSurface open={false} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
  })

  it('puts a replacement hold above a surface opened during the original hold', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const initial = { nodeIds: ['fac_price'], edgeIds: [], note: null, caveat: null, turnId: 'first', modelVersion: null }
    useCanvasStore.setState({ olumiAttention: initial })
    render(<OlumiAttentionCard />)
    const closeOther = vi.fn()
    function OtherSurface() {
      useEscapeLayer(true, closeOther)
      return null
    }
    render(<OtherSurface />)

    act(() => useCanvasStore.setState({ olumiAttention: { ...initial, turnId: 'replacement' } }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
    expect(closeOther).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(closeOther).toHaveBeenCalledTimes(1)
  })

  it('clears a held attention that is showing a card', () => {
    useCanvasStore.setState({
      olumiAttention: { nodeIds: ['fac_price'], edgeIds: [], note, caveat: null, turnId: null, modelVersion: null },
    })
    render(<OlumiAttentionCard />)
    // Precondition, pinned in-test: the hold is actually on, so what follows
    // measures a release rather than an absence that was already there.
    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()

    pressEscape()

    expect(useCanvasStore.getState().olumiAttention).toBeNull()
  })

  // ⭐ THE CASE THE DISMISS BUTTON CANNOT COVER. With no note the card renders
  // nothing, so there is no Dismiss button on screen — but the dim is still
  // derived and still applied. Without this listener the user would be left
  // with a dimmed model and no exit.
  it('clears a held attention that is showing NO card, because the dim is still on', () => {
    useCanvasStore.setState({
      olumiAttention: { nodeIds: ['fac_price'], edgeIds: [], note: null, caveat: null, turnId: null, modelVersion: null },
    })
    const { container } = render(<OlumiAttentionCard />)
    expect(container).toBeEmptyDOMElement()
    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()

    pressEscape()

    expect(useCanvasStore.getState().olumiAttention).toBeNull()
  })

  // The opposite direction: a global key listener must not fire on other keys.
  it('leaves the hold alone for any other key', () => {
    useCanvasStore.setState({
      olumiAttention: { nodeIds: ['fac_price'], edgeIds: [], note, caveat: null, turnId: null, modelVersion: null },
    })
    render(<OlumiAttentionCard />)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()
  })

  it('removes the listener on unmount rather than leaving a global handler behind', () => {
    useCanvasStore.setState({
      olumiAttention: { nodeIds: ['fac_price'], edgeIds: [], note, caveat: null, turnId: null, modelVersion: null },
    })
    const { unmount } = render(<OlumiAttentionCard />)
    unmount()

    pressEscape()

    // Still held: the unmounted card must not be reaching into the store.
    expect(useCanvasStore.getState().olumiAttention).not.toBeNull()
  })
})
