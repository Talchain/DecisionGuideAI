/**
 * REGRESSION GUARD: flipping the BLANKET key (`canvasSemanticMutations`) must
 * never bring the old screen-only undo back. Since Undo S5 (no undo key at all)
 * every gesture runs the SAVED-change command; the store history never runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    CANONICAL_EDIT_AUTHORITY: { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: 'server_graph' },
  }
})
const runCanvasUndo = vi.fn(async () => 'done')
vi.mock('../undoCommand', () => ({ runCanvasUndo: (...a: unknown[]) => runCanvasUndo(...(a as [])) }))

import { useKeyboardShortcuts } from '../../useKeyboardShortcuts'
import { useCanvasStore } from '../../store'

beforeEach(() => {
  runCanvasUndo.mockClear()
  useCanvasStore.getState().resetCanvas()
  // Real local history in BOTH directions, so the old screen-only branches
  // (`state.canUndo() && state.undo()`) WOULD fire if they were reachable.
  const snap = { nodes: [], edges: [] }
  useCanvasStore.setState({ history: { past: [snap], future: [snap] } } as never)
  expect(useCanvasStore.getState().canUndo()).toBe(true)
  expect(useCanvasStore.getState().canRedo()).toBe(true)
})

describe('blanket key flipped (Undo S5: no undo key)', () => {
  it.each([
    ['undo', { key: 'z', ctrlKey: true }],
    ['redo', { key: 'y', ctrlKey: true }],
    ['redo', { key: 'z', ctrlKey: true, shiftKey: true }],
  ] as const)('%s: the store\'s screen-only history never runs; the saved-change command does', (method, init) => {
    const local = vi.spyOn(useCanvasStore.getState(), method)
    renderHook(() => useKeyboardShortcuts())
    window.dispatchEvent(new KeyboardEvent('keydown', init))
    expect(local).not.toHaveBeenCalled()
    expect(runCanvasUndo.mock.calls).toEqual([[method]])
    local.mockRestore()
  })
})
