/**
 * A20 — Copy writes only to an in-memory clipboard (`store.ts`'s
 * `copySelected`), and Paste is gated on `canvasSemanticMutations` via
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`, which is `'disabled'` under every
 * authority state this build reaches — so Paste was always disabled, and
 * Copy's only output had no durable way to reach it. Both are hidden from
 * every menu that showed them, rather than left present (Paste inert, Copy a
 * dead end).
 *
 * `store.ts` is untouched — this is a menu-presentation change only.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMenuItems } from '../useMenuItems'
import type { PaneTarget, NodeTarget, MultiTarget, MenuEntry, MenuItemDef } from '../types'
import type { Node } from '@xyflow/react'

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
    canUndo: () => false,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
    viewMode: 'standard' as const,
    setViewMode: vi.fn(),
    applyLayout: vi.fn(),
  }
  const mockStore = vi.fn((selector: any) => selector(mockState)) as any
  mockStore.getState = () => mockState
  mockStore.setState = (_partial: any) => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  deleteAction: vi.fn(),
  addNodeAction: vi.fn(),
  addConnectedFactorAction: vi.fn(),
  markAsAssumption: vi.fn(),
  traceToGoal: vi.fn(),
  askAI: vi.fn(),
  copyAction: vi.fn(),
  cutAction: vi.fn(),
  pasteAction: vi.fn(),
  duplicateAction: vi.fn(),
  setValueBestCase: vi.fn(),
  setValueWorstCase: vi.fn(),
  setValueReset: vi.fn(),
}))

const showToast = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)
const onClose = vi.fn()

function ids(entries: MenuEntry[]): string[] {
  const out: string[] = []
  for (const e of entries) {
    if ('type' in e) continue
    const item = e as MenuItemDef
    out.push(item.id)
    if (item.submenuItems) out.push(...ids(item.submenuItems))
  }
  return out
}

describe('A20 — Copy and Paste are hidden, not shown dead', () => {
  it('the pane menu never mounts a paste row', () => {
    const target: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    expect(ids(result.current)).not.toContain('paste')
    // PRECONDITION: the pane menu itself must have rendered, or the absence
    // above is vacuous.
    expect(ids(result.current)).toContain('ask-ai-pane')
  })

  it('the factor node menu never mounts a copy row', () => {
    const node = {
      id: 'f1', type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Revenue', kind: 'factor', observedState: { value: 50 } },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'f1', nodeType: 'factor', node, screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    expect(ids(result.current)).not.toContain('copy')
    expect(ids(result.current)).toContain('delete')
  })

  it('the multi-select menu never mounts a copy row', () => {
    const target: MultiTarget = {
      kind: 'multi', nodeIds: ['f1', 'g1'], edgeIds: ['e1'], screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    expect(ids(result.current)).not.toContain('copy')
    expect(ids(result.current)).toContain('delete')
  })
})
