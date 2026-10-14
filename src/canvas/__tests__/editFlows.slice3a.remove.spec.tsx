/** EDIT-UX slice 3a row 2: the real inspector calls the existing delete door. */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { InspectorRouter } from '../ui/inspector-v2/InspectorRouter'
import { ToastProvider, useShowToast } from '../ToastContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useConfirmDialogStore } from '../stores/confirmDialogStore'
import * as actions from '../contextMenu/actions'
import { useMenuItems } from '../contextMenu/useMenuItems'
import { isMenuItem, type ContextTarget } from '../contextMenu/types'
import { setViewerScenario } from '../../lib/viewerMode'

const { commit } = vi.hoisted(() => ({ commit: vi.fn() }))
vi.mock('../mutations/commitValidatedMutation', () => ({ commitValidatedMutation: commit }))
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const onClose = vi.fn()
let toast: ReturnType<typeof useShowToast>
const node = (id: string, type: string, extra: Record<string, unknown> = {}): Node => ({
  id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type, ...extra },
})
const baseNodes = [node('remove-factor', 'factor'), node('keep-factor', 'factor'),
  node('remove-risk', 'risk'), node('last-goal', 'goal'), node('last-decision', 'decision')]
const causalLink: Edge = {
  id: 'remove-link', source: 'remove-factor', target: 'keep-factor',
  data: { weight: 0.4, weightSource: 'user', direction: 'positive' },
}

function seed(nodes: Node[] = baseNodes, edges: Edge[] = []) {
  useCanvasStore.setState({
    currentScenarioId: null, nodes, edges, lastServerGraphHash: null,
    lastAuthoritativeGraph: null, pendingStructuralDeletes: [], _externalMutationActive: 0,
    results: { status: 'none', report: null }, analysisStateV1: null, analysisFreshness: null,
    ceeAnalysisReady: null, hasCompletedFirstRun: false, v5AnalysisFact: null,
    goalThreshold: null, goalThresholdRepresentation: null, goalConstraints: null,
    confirmedNodeIds: new Set(), _internal: {},
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

function ToastIdentity() { toast = useShowToast(); return null }
function ConfirmHost() {
  const pending = useConfirmDialogStore(s => s.pending)
  const dismiss = useConfirmDialogStore(s => s.dismiss)
  return pending ? <ConfirmDialog {...pending} onCancel={dismiss} onConfirm={() => {
    pending.onConfirm()
    dismiss()
  }} /> : null
}
function Host({ nodeId, edgeId }: { nodeId: string | null; edgeId: string | null }) {
  const [open, setOpen] = useState(true)
  return <ToastProvider><ToastIdentity /><ConfirmHost />{open &&
    <InspectorRouter nodeId={nodeId} edgeId={edgeId} onClose={() => { onClose(); setOpen(false) }} />
  }</ToastProvider>
}
function SelectionBoundHost() {
  const selectedNodeId = useCanvasStore(s => [...s.selection.nodeIds][0] ?? null)
  const [open, setOpen] = useState(true)
  // The live InspectorModal stops rendering Router when deletion clears selection.
  return <ToastProvider><ToastIdentity /><ConfirmHost />{open && selectedNodeId &&
    <InspectorRouter nodeId={selectedNodeId} edgeId={null} onClose={() => { onClose(); setOpen(false) }} />
  }</ToastProvider>
}
function open(nodeId: string | null, edgeId: string | null = null) {
  return render(<Host nodeId={nodeId} edgeId={edgeId} />)
}
function remove() {
  fireEvent.click(screen.getByTestId('inspector-header-menu'))
  const item = screen.getByRole('menuitem', { name: /^Remove$/ })
  expect(item).toHaveAttribute('data-testid', 'inspector-remove')
  expect(item).toHaveClass('text-danger')
  expect(item.querySelector('svg.lucide-trash2')).not.toBeNull()
  expect(item.querySelector('svg')).toHaveAttribute('fill', 'none')
  fireEvent.click(item)
}
function inspectorOpen() {
  expect(screen.getByRole('region', { name: 'Inspector panel' })).toBeVisible()
  expect(onClose).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.restoreAllMocks()
  onClose.mockClear()
  commit.mockReset().mockImplementation(async (_ops, localApply: () => void) => {
    localApply()
    return { success: true }
  })
  setViewerScenario(null)
  useConfirmDialogStore.setState({ pending: null })
  useGuidanceStore.setState({ guidanceItems: [], _sendChip: vi.fn(), _prefillChat: vi.fn(),
    _sendMessage: null, _dispatchAction: vi.fn(), _isConversationBusy: () => false } as never)
  seed()
})
afterEach(() => {
  cleanup()
  setViewerScenario(null)
  useConfirmDialogStore.setState({ pending: null })
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
})

describe('Remove names exactly the inspected element and toast', () => {
  it.each([
    ['node', 'remove-risk'], ['edge', 'remove-link'],
  ] as const)('%s calls the existing deleteAction once with its id and provider toast', (kind, id) => {
    if (kind === 'edge') seed(baseNodes, [causalLink])
    const deleting = vi.spyOn(actions, 'deleteAction').mockResolvedValue(undefined)
    open(kind === 'node' ? id : null, kind === 'edge' ? id : null)
    remove()
    expect(deleting).toHaveBeenCalledTimes(1)
    expect(deleting).toHaveBeenCalledWith(
      kind === 'node' ? { kind, nodeId: id } : { kind, edgeId: id }, toast,
    )
    inspectorOpen()
  })

  it('keeps Remove available to an editor even without a conversation surface', () => {
    useGuidanceStore.setState({ _sendChip: null, _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    open('remove-risk')
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByTestId('inspector-remove')).toBeVisible()
    expect(screen.queryByTestId('inspector-back-to-conversation')).toBeNull()
  })

  it.each(['node', 'edge'] as const)('hides %s Remove reactively for a viewer, with the editor as positive control', kind => {
    if (kind === 'edge') seed(baseNodes, [causalLink])
    open(kind === 'node' ? 'remove-risk' : null, kind === 'edge' ? 'remove-link' : null)
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByTestId('inspector-remove')).toBeVisible()
    act(() => setViewerScenario('shared-read-only'))
    expect(screen.queryByTestId('inspector-remove')).toBeNull()
    act(() => setViewerScenario(null))
    if (screen.getByTestId('inspector-header-menu').getAttribute('aria-expanded') === 'false') {
      fireEvent.click(screen.getByTestId('inspector-header-menu'))
    }
    expect(screen.getByTestId('inspector-remove')).toBeVisible()
  })
})

describe('Remove preserves the context-menu guards and waits for disappearance', () => {
  it.each(['last-decision', 'last-goal'])('%s retains the same menu availability and existing refusal', async id => {
    const selected = baseNodes.find(n => n.id === id)!
    const target: ContextTarget = { kind: 'node', nodeId: id, node: selected,
      nodeType: selected.type as never, screenPos: { x: 0, y: 0 } }
    const { result } = renderHook(() => useMenuItems({ target, showToast: vi.fn(),
      onClose: vi.fn(), screenToFlowPosition: pos => pos }))
    const deleteItem = result.current.filter(isMenuItem).find(item => item.id === 'delete')
    // Current context menus offer both; deleteAction refuses the last of each.
    expect(deleteItem?.enabled).toBe(true)
    const deleting = vi.spyOn(actions, 'deleteAction')
    open(id)
    remove()
    await waitFor(() => expect(deleting).toHaveBeenCalledTimes(1))
    expect(useCanvasStore.getState().nodes.some(n => n.id === id)).toBe(true)
    expect(commit).not.toHaveBeenCalled()
    expect(useConfirmDialogStore.getState().pending).toBeNull()
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveTextContent('Every model needs')
    inspectorOpen()
  })

  it.each(['node', 'edge'] as const)('%s confirmation cancelled leaves that element and inspector open', async kind => {
    const option = node('change-option', 'option', { interventions: { 'remove-factor': { value: 1 } } })
    seed([...baseNodes, option], [{ id: 'option-change', source: option.id, target: 'remove-factor', data: {} }])
    const deleting = vi.spyOn(actions, 'deleteAction')
    open(kind === 'node' ? 'remove-factor' : null, kind === 'edge' ? 'option-change' : null)
    remove()
    await waitFor(() => expect(useConfirmDialogStore.getState().pending).not.toBeNull())
    expect(deleting).toHaveBeenCalledWith(kind === 'node'
      ? { kind: 'node', nodeId: 'remove-factor' } : { kind: 'edge', edgeId: 'option-change' }, toast)
    inspectorOpen()
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    expect(useConfirmDialogStore.getState().pending).toBeNull()
    expect(useCanvasStore.getState().nodes.some(n => n.id === 'remove-factor')).toBe(true)
    expect(useCanvasStore.getState().edges.some(e => e.id === 'option-change')).toBe(true)
    expect(commit).not.toHaveBeenCalled()
    inspectorOpen()
  })

  it('validation refusal keeps the named node and inspector open', async () => {
    commit.mockImplementation(async (_ops, _apply, showToast) => {
      showToast('Removal refused', 'error')
      return { success: false, error: 'refused' }
    })
    open('remove-risk')
    remove()
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1))
    expect(useCanvasStore.getState().nodes.some(n => n.id === 'remove-risk')).toBe(true)
    inspectorOpen()
  })

  it.each(['node', 'edge'] as const)('%s closes once after its existing delete actually removes it', async kind => {
    if (kind === 'edge') seed(baseNodes, [causalLink])
    open(kind === 'node' ? 'remove-risk' : null, kind === 'edge' ? 'remove-link' : null)
    remove()
    if (kind === 'edge') {
      // This isolated link orphans its ends, so honour the existing confirmation.
      fireEvent.click(await screen.findByRole('button', { name: /^Remove$/ }))
    }
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(kind === 'node'
      ? useCanvasStore.getState().nodes.some(n => n.id === 'remove-risk')
      : useCanvasStore.getState().edges.some(e => e.id === 'remove-link')).toBe(false)
    expect(screen.queryByRole('region', { name: 'Inspector panel' })).toBeNull()
  })

  it('a resolved action and unrelated disappearance do not close; its own disappearance does', async () => {
    vi.spyOn(actions, 'deleteAction').mockResolvedValue(undefined)
    open('remove-risk')
    remove()
    await act(async () => {})
    inspectorOpen()
    act(() => useCanvasStore.setState({ nodes: baseNodes.filter(n => n.id !== 'keep-factor') }))
    inspectorOpen()
    act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.filter(n => n.id !== 'remove-risk') }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('region', { name: 'Inspector panel' })).toBeNull()
  })

  it('closes the live host when removal clears selection before Router can render again', async () => {
    useCanvasStore.setState({ selection: { nodeIds: new Set(['remove-risk']), edgeIds: new Set(), anchorPosition: null } })
    render(<SelectionBoundHost />)
    remove()
    await waitFor(() => expect(useCanvasStore.getState().nodes.some(n => n.id === 'remove-risk')).toBe(false))
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => useCanvasStore.getState().selectNodeWithoutHistory('keep-factor'))
    expect(screen.queryByRole('region', { name: 'Inspector panel' })).toBeNull()
  })

  it('a removal from a previous inspector cannot close the newly inspected node', () => {
    vi.spyOn(actions, 'deleteAction').mockResolvedValue(undefined)
    const view = open('remove-risk')
    remove()
    view.rerender(<Host nodeId="keep-factor" edgeId={null} />)
    act(() => useCanvasStore.setState({ nodes: baseNodes.filter(n => n.id !== 'remove-risk') }))
    expect(screen.getByTestId('inspector-header')).toHaveTextContent('keep-factor')
    inspectorOpen()
  })

  it('unmounting the inspector stops its pending removal watcher', () => {
    vi.spyOn(actions, 'deleteAction').mockResolvedValue(undefined)
    const view = open('remove-risk')
    remove()
    view.unmount()
    act(() => useCanvasStore.setState({ nodes: baseNodes.filter(n => n.id !== 'remove-risk') }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
