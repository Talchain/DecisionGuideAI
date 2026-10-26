import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { NodeTarget, MenuEntry, MenuItemDef } from '../types'
import { useMenuItems, STRUCTURAL_EDITS_NOTE_ID } from '../useMenuItems'

const model = vi.hoisted(() => ({
  state: 'program' as 'program' | 'not_program' | 'unknown',
}))

// The reader's pending, failed and pre-hash cases are covered by G18.
vi.mock('../../nodes/shared/savedModelProgram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../nodes/shared/savedModelProgram')>()),
  useSavedModelProgramState: () => model.state,
}))

vi.mock('../../store', () => {
  const state = {
    nodes: [], edges: [], clipboard: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
    canUndo: () => false, canRedo: () => false,
    viewMode: 'standard',
  }
  return {
    useCanvasStore: Object.assign(vi.fn(<T,>(selector: (s: typeof state) => T) => selector(state)), {
      getState: () => state,
      setState: vi.fn(),
    }),
    selectResultsStatus: (s: typeof state) => s.results.status,
    selectReport: (s: typeof state) => s.results.report,
  }
})

const target: NodeTarget = {
  kind: 'node', nodeId: 'factor_a', nodeType: 'factor',
  node: {
    id: 'factor_a', type: 'factor', position: { x: 0, y: 0 },
    data: { kind: 'factor', label: 'Capacity' },
  },
  screenPos: { x: 0, y: 0 },
}
const options = {
  target, showToast: vi.fn(),
  screenToFlowPosition: (p: { x: number; y: number }) => p,
  onClose: vi.fn(),
}

function flatten(entries: MenuEntry[]): MenuItemDef[] {
  return entries.flatMap((entry) => 'type' in entry
    ? []
    : [entry, ...flatten(entry.submenuItems ?? [])])
}

const connectedIds = ['add-connected-factor', 'add-connected-outcome', 'add-connected-risk']
const connectedRows = (entries: MenuEntry[]) => flatten(entries).filter((entry) => connectedIds.includes(entry.id))

beforeEach(() => { model.state = 'program' })

describe('connected additions use the executable model authority', () => {
  it.each(['program', 'unknown'] as const)('%s has no connected addition and keeps the existing explanation and reading controls', (state) => {
    model.state = state
    const { result } = renderHook(() => useMenuItems(options))
    const entries = flatten(result.current)
    expect(connectedRows(result.current)).toEqual([])
    expect(entries.find((entry) => entry.id === STRUCTURAL_EDITS_NOTE_ID)).toMatchObject({ enabled: false })
    expect(entries.find((entry) => entry.id === 'open-details')).toMatchObject({ enabled: true })
    expect(entries.find((entry) => entry.id === 'ask-ai')).toMatchObject({ enabled: true })
  })

  it('a confirmed non-program board retains all three current controls', () => {
    model.state = 'not_program'
    const { result } = renderHook(() => useMenuItems(options))
    expect(connectedRows(result.current).map(({ id, enabled }) => ({ id, enabled }))).toEqual(
      connectedIds.map((id) => ({ id, enabled: true })),
    )
  })

  it('rebuilds the same menu when the saved-model state changes', () => {
    model.state = 'unknown'
    const { result, rerender } = renderHook(() => useMenuItems(options))
    expect(connectedRows(result.current)).toEqual([])
    model.state = 'not_program'
    rerender()
    expect(connectedRows(result.current)).toHaveLength(3)
    model.state = 'program'
    rerender()
    expect(connectedRows(result.current)).toEqual([])
  })
})
