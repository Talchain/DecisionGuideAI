/**
 * REGRESSION GUARD: flipping the BLANKET key (`canvasSemanticMutations`) must
 * never bring the old screen-only undo back. Undo answers to its own key only.
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

describe('blanket key flipped, undo key off', () => {
  it.each([
    ['undo', { key: 'z', ctrlKey: true }],
    ['redo', { key: 'y', ctrlKey: true }],
    ['redo', { key: 'z', ctrlKey: true, shiftKey: true }],
  ] as const)('%s: neither the store history nor the command runs; the notice answers', (method, init) => {
    const local = vi.spyOn(useCanvasStore.getState(), method)
    const toasts: string[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent).detail.message)
    window.addEventListener('topbar:show-toast', onToast)
    renderHook(() => useKeyboardShortcuts())
    window.dispatchEvent(new KeyboardEvent('keydown', init))
    expect(local).not.toHaveBeenCalled()
    expect(runCanvasUndo).not.toHaveBeenCalled()
    window.removeEventListener('topbar:show-toast', onToast)
    local.mockRestore()
  })
})
