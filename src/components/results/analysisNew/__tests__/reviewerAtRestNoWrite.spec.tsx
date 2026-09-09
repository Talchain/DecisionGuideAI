/** Independent reviewer probe (#1291 delta, head 4d8601fb): AT REST THE
 * RECONCILE MUST NOT TOUCH THE SHARED CANVAS CHANNEL. Acceptance clause
 * "unrelated selection is untouched" — the author's suite records ring writes
 * only AFTER a click, so a write at mount or on an unselected model change was
 * uncovered. Positive control included so the probe cannot pass blind. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
type N = { id: string; type: string; data: Record<string, unknown>; x?: number; y?: number }
const h = await vi.hoisted(async () => {
  const { create } = await import('zustand')
  const store = create<{ nodes: N[]; highlighted: string[]; setHighlightedNodes: (i: string[]) => void }>((set) => ({
    nodes: [], highlighted: [], setHighlightedNodes: (ids: string[]) => set({ highlighted: [...ids] }),
  }))
  const ringWrites: string[][] = []
  store.subscribe((s, p) => { if (s.highlighted !== p.highlighted) ringWrites.push(s.highlighted) })
  return { store, ringWrites }
})
vi.mock('../../../../canvas/store', () => ({ useCanvasStore: h.store }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: (id: string) => h.store.getState().setHighlightedNodes([id]),
  clearHighlight: () => h.store.getState().setHighlightedNodes([]),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
import { ModelStrip } from '../sections/ModelStrip'
const TID = 'analysis-new-model-strip'
const bare = (id: string, label: string): N => ({ id, type: 'factor', data: { label }, x: 0, y: 0 })
const valued = (id: string, label: string): N => ({ id, type: 'factor', data: { label, observedState: { value: 0.7, source: 'user_override' } }, x: 0, y: 0 })
const set = (nodes: N[]) => act(() => { h.store.setState({ nodes }) })
/* ⚠ ORDER IS THE INSTRUMENT. Resetting the counter BEFORE the store reset
   records the reset's own fresh `highlighted: []` reference as a ring write —
   my first run read that artefact as a product defect (CLAUDE.md trap 13). */
beforeEach(() => { h.store.setState({ nodes: [], highlighted: [] }); h.ringWrites.length = 0 })
afterEach(cleanup)
describe('reviewer: the reconcile is scoped to a narrowing this strip wrote', () => {
  it('writes NOTHING at mount and across a model change with no worklist selected', () => {
    set([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    expect(h.ringWrites).toEqual([])
    set([valued('f_a', 'Alpha'), bare('f_b', 'Beta')])
    expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('1 with no value yet')
    expect(h.ringWrites).toEqual([])
  })
  it('does not stomp a foreign highlight written while no narrowing is selected', () => {
    set([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    act(() => { h.store.getState().setHighlightedNodes(['someone_elses_node']) })
    set([valued('f_a', 'Alpha'), bare('f_b', 'Beta')])
    expect(h.store.getState().highlighted).toEqual(['someone_elses_node'])
  })
  it('POSITIVE CONTROL: the same harness does observe a write once the worklist is selected', () => {
    set([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    fireEvent.click(screen.getByTestId(`${TID}-no-value-toggle`))
    expect(h.ringWrites.length).toBeGreaterThan(0)
    expect(h.ringWrites[h.ringWrites.length - 1]).toEqual(['f_a', 'f_b'])
  })
  it('releasing the worklist clears only what the strip put there, then stays quiet', () => {
    set([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    const t = screen.getByTestId(`${TID}-no-value-toggle`)
    fireEvent.click(t); fireEvent.click(t)
    expect(h.store.getState().highlighted).toEqual([])
    const after = h.ringWrites.length
    set([valued('f_a', 'Alpha'), bare('f_b', 'Beta')])
    expect(h.ringWrites.length).toBe(after)
  })
})
