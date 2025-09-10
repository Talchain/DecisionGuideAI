import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import userEvent from '@testing-library/user-event'
import { BoardState, type Handle } from '@/sandbox/state/boardState'
import { saveSnapshot as storageSaveSnapshot, listSnapshots as storageListSnapshots } from '@/sandbox/state/snapshots'

// Keep analytics locally mocked for this test
// Flags are provided via renderSandbox

function makeAfterBoardFrom(before: ReturnType<BoardState['getBoard']>) {
  // Clone before and mutate to craft a deterministic diff
  const nodes = before.nodes.map(n => ({ ...n }))
  const edges = before.edges.map(e => ({ ...e }))

  // Label change on first node
  nodes[0].label = nodes[0].label + ' (renamed)'

  // Remove last node (if present)
  const removedNode = nodes.pop() // remove 1

  // Add a new node
  const newNodeId = 'node_new'
  nodes.push({
    id: newNodeId,
    type: 'option',
    x: 200,
    y: 200,
    label: 'New Option',
  } as any)

  // Modify first edge's likelihood and sourceHandle
  if (edges.length > 0) {
    edges[0].likelihood = (edges[0].likelihood ?? 50) + 10
    edges[0].sourceHandle = 'right' as Handle
  }

  // Remove last edge (if present)
  edges.pop()

  return {
    id: before.id,
    title: before.title,
    nodes,
    edges,
    version: before.version,
    createdAt: before.createdAt,
    updatedAt: before.updatedAt,
    isDraft: before.isDraft,
    createdBy: before.createdBy,
  }
}

describe('DiffView structural diff + telemetry + a11y', () => {
  const decisionId = 'diff-dec'

  beforeEach(() => {
    try { localStorage.clear() } catch {}
    // Mock analytics to capture diff events
    vi.doMock('@/lib/analytics', () => ({
      track: vi.fn(),
    }))
  })

  it('renders counts for new/removed/label-changed nodes and modified edges based on storage snapshot', async () => {
    // Build a small board and take a storage-level snapshot (before)
    const s = new BoardState('board-diff')
    const d = s.addNode({ type: 'decision', x: 0, y: 0, label: 'D' })
    const o1 = s.addNode({ type: 'option', x: 100, y: 0, label: 'O1' })
    const o2 = s.addNode({ type: 'option', x: 120, y: 40, label: 'O2' })
    s.addEdge({ source: d.id, target: o1.id, sourceHandle: (`option:${o1.id}` as Handle) })
    s.addEdge({ source: d.id, target: o2.id, sourceHandle: 'left' })

    const bytes = s.getUpdate()
    const meta = storageSaveSnapshot(decisionId, bytes, { note: 'before' })
    const snaps = storageListSnapshots(decisionId)
    expect(snaps.find(m => m.id === meta.id)).toBeTruthy()

    // Prepare an after board object and mock useBoardState() to return it
    const beforeBoard = s.getBoard()
    const afterBoard = makeAfterBoardFrom(beforeBoard)

    vi.doMock('@/sandbox/state/boardState', async () => {
      const actual = await vi.importActual<typeof import('@/sandbox/state/boardState')>('@/sandbox/state/boardState')
      return {
        ...actual,
        useBoardState: () => ({ board: afterBoard }),
      }
    })

    // Now import after mocks are in place
    const { DiffView: DV } = await import('@/sandbox/components/DiffView')

    // Test host to focus invoker before mounting DiffView (so it captures invoker as activeElement)
    function Host() {
      const [open, setOpen] = React.useState(false)
      React.useEffect(() => {
        const btn = document.querySelector('[data-testid="invoker"]') as HTMLButtonElement | null
        btn?.focus()
        setOpen(true)
      }, [])
      return (
        <>
          <button data-testid="invoker">Open Diff</button>
          {open && <DV lastSnapshotId={meta.id} decisionId={decisionId} onClose={() => setOpen(false)} />}
        </>
      )
    }

    renderSandbox(<Host />, { sandbox: true, scenarioSnapshots: true })

    // Assert summary labels contain counts we expect
    expect(screen.getByText(/New Nodes \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Removed Nodes \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Label Changes \(1\)/i)).toBeInTheDocument()
    // One edge modified (likelihood/handle) and one removed
    expect(screen.getByText(/New Edges \(0\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Removed Edges \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Modified Edges \(1\)/i)).toBeInTheDocument()

    // Telemetry open should have fired
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>
    expect(track).toHaveBeenCalledWith('sandbox_diff', expect.objectContaining({ op: 'open', decisionId }))

    // a11y: focus should land on Close
    const close = screen.getByRole('button', { name: /Close/i })
    expect(document.activeElement).toBe(close)

    // a11y: Esc closes and returns focus to invoker
    const user = userEvent.setup()
    const invoker = screen.getByTestId('invoker') as HTMLButtonElement
    // After render, DV sets focus to Close; simulate Esc from window
    await user.keyboard('{Escape}')
    // Close event telemetry should have fired
    expect(track).toHaveBeenCalledWith('sandbox_diff', expect.objectContaining({ op: 'close', decisionId }))
    // Focus restored to invoker
    expect(document.activeElement).toBe(invoker)
  })
})
