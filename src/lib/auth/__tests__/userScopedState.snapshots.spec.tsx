/**
 * The identity boundary covers MANUAL SNAPSHOTS (⌘S / Model ▸ Snapshots).
 *
 * `persist.saveSnapshot` writes a whole graph, labels included, to `canvas-snapshot-<ts>`, and
 * `persist.listSnapshots` lists every key with that prefix with no owner check. Before this row existed
 * the sign-out sweep removed none of them, so the next account on the same browser saw the previous
 * account's snapshots, and its Restore put that model on its own canvas and armed a register into its
 * own scenario (`store.importCanvas` → `importPendingServerRegistration`).
 *
 * Every row uses the REAL writer (`persist.saveSnapshot`), the REAL sweep and the REAL store; nothing
 * here is mocked except `window.confirm` (the Restore confirmation).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { clearUserScopedState, USER_SCOPED_STORAGE_PREFIXES } from '../userScopedState'
import { listSnapshots, loadSnapshot, saveSnapshot } from '../../../canvas/persist'
import { IDENTITY_EPOCH_KEY } from '../../../canvas/store/scenarios'
import { setGuidancePersistenceContext, useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { rememberPendingApply } from '../../../collab/panelApplyHandoff'
import { rememberOpenRound } from '../../../collab/openRoundRecord'
import { markGraphImported } from '../../../canvas/store/importRegistrationMarker'
import { useCanvasStore } from '../../../canvas/store'
import { SnapshotManager } from '../../../canvas/components/SnapshotManager'
import { ToastProvider } from '../../../canvas/ToastContext'

/** A label only account A's model carries, so "nothing of A remains" is a check by identity. */
const A_SENTINEL = 'A-only label 7c41e2'

const aGraph = {
  nodes: [
    { id: 'a-goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: A_SENTINEL } },
    { id: 'a-opt', type: 'option', position: { x: 200, y: 0 }, data: { label: 'A option' } },
  ],
  edges: [{ id: 'a-e1', source: 'a-opt', target: 'a-goal', data: {} }],
} as never

/** Every localStorage key whose value still mentions account A's sentinel label. */
function keysHoldingA(): string[] {
  const hits: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && (localStorage.getItem(key) ?? '').includes(A_SENTINEL)) hits.push(key)
  }
  return hits.sort()
}

/** Account A saves one snapshot through the real writer and names it; returns its key. */
function accountASavesASnapshot(): string {
  expect(saveSnapshot(aGraph)).toBe(true)
  const [only] = listSnapshots()
  expect(only).toBeDefined()
  localStorage.setItem(`${only.key}-name`, 'A pricing plan')
  return only.key
}

function openSnapshotManager(): void {
  render(
    <ToastProvider>
      <SnapshotManager isOpen={true} onClose={() => {}} />
    </ToastProvider>,
  )
}

describe('identity boundary: manual snapshots', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useCanvasStore.setState({ importPendingServerRegistration: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('CONTRAST (no boundary): the snapshot is listed, and Restore puts it on the canvas and arms a register', () => {
    const key = accountASavesASnapshot()
    expect(keysHoldingA()).toEqual([key])
    openSnapshotManager()
    expect(screen.getByText('A pricing plan')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    const st = useCanvasStore.getState()
    expect(st.nodes.map((n) => (n.data as { label?: string }).label)).toContain(A_SENTINEL)
    expect(st.importPendingServerRegistration).toBe(true)
  })

  it('⭐ after the A→B boundary, nothing of A\'s snapshot is left in storage, by key or by content', () => {
    const key = accountASavesASnapshot()
    clearUserScopedState()
    expect(localStorage.getItem(key)).toBeNull()
    expect(localStorage.getItem(`${key}-name`)).toBeNull()
    expect(listSnapshots()).toEqual([])
    expect(keysHoldingA()).toEqual([])
  })

  it('⭐ after the A→B boundary, B\'s Snapshots list is empty: no Restore exists and no register is armed', () => {
    accountASavesASnapshot()
    clearUserScopedState()
    openSnapshotManager()
    expect(screen.getByText('No snapshots yet')).toBeTruthy()
    expect(screen.queryByText('A pricing plan')).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'Restore' })).toHaveLength(0)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    expect(useCanvasStore.getState().nodes.map((n) => (n.data as { label?: string }).label)).not.toContain(A_SENTINEL)
  })

  it('the sweep\'s snapshot prefix is the one the real writer produces, and it never matches a device setting', () => {
    const key = accountASavesASnapshot()
    const prefix = USER_SCOPED_STORAGE_PREFIXES.find((p) => key.startsWith(p))
    expect(prefix).toBe('canvas-snapshot-')
    // A device setting that shares the `canvas` stem survives the sweep.
    localStorage.setItem('canvas.lastStarter', 'device')
    clearUserScopedState()
    expect(localStorage.getItem('canvas.lastStarter')).toBe('device')
  })
})

describe('identity boundary: the owner fence on snapshots (CAN-F2w epoch), for what the sweep cannot remove', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useCanvasStore.setState({ importPendingServerRegistration: false })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  /** A snapshot exactly as the pre-fence writer stored it: no epoch stamp. */
  function legacySnapshotOfA(): string {
    const key = 'canvas-snapshot-1700000000000'
    localStorage.setItem(key, JSON.stringify({ version: 1, timestamp: 1700000000000, ...(aGraph as object) }))
    return key
  }

  it('⭐ a snapshot written before the sweep covered snapshots is not B\'s once a boundary has happened', () => {
    const key = legacySnapshotOfA()
    // A signed out on the earlier build: its boundary wrote an epoch and left the snapshot behind.
    localStorage.setItem(IDENTITY_EPOCH_KEY, 'epoch-after-a-signed-out')
    expect(localStorage.getItem(key)).not.toBeNull()
    expect(listSnapshots()).toEqual([])
    expect(loadSnapshot(key)).toBeNull()
    openSnapshotManager()
    expect(screen.getByText('No snapshots yet')).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: 'Restore' })).toHaveLength(0)
  })

  it('⭐ a removal the sweep could not make still never reaches B', () => {
    const key = accountASavesASnapshot()
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      if (k.startsWith('canvas-snapshot-')) throw new DOMException('denied', 'SecurityError')
      return realRemove.call(this, k)
    })
    expect(() => clearUserScopedState()).not.toThrow()
    vi.restoreAllMocks()
    expect(localStorage.getItem(key)).not.toBeNull()
    expect(listSnapshots()).toEqual([])
    expect(loadSnapshot(key)).toBeNull()
  })

  it('CONTRAST: after an earlier boundary, the current identity still sees and loads its own new snapshot', () => {
    clearUserScopedState()
    const key = accountASavesASnapshot()
    expect(listSnapshots().map((s) => s.key)).toEqual([key])
    expect(loadSnapshot(key)?.nodes.map((n) => (n.data as { label?: string }).label)).toContain(A_SENTINEL)
  })

  it('CONTRAST: before any boundary, a legacy unstamped snapshot is still listed (nothing changes for a browser with one user)', () => {
    const key = legacySnapshotOfA()
    expect(listSnapshots().map((s) => s.key)).toEqual([key])
  })

  it('an unreadable epoch writes no snapshot rather than an unowned one', () => {
    const realGet = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (k === IDENTITY_EPOCH_KEY) throw new DOMException('denied', 'SecurityError')
      return realGet.call(this, k)
    })
    expect(saveSnapshot(aGraph)).toBe(false)
    vi.restoreAllMocks()
    const snapshotKeys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k?.startsWith('canvas-snapshot-')) snapshotKeys.push(k)
    }
    expect(snapshotKeys).toEqual([])
  })
})

describe('identity boundary: the rest of the class (Codex #2501 r1)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useGuidanceStore.getState().clearGuidanceItems()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    setGuidancePersistenceContext(null)
    useGuidanceStore.getState().clearGuidanceItems()
    localStorage.clear()
    sessionStorage.clear()
  })

  const aGuidance = [{ id: 'g-a-1', title: `Test ${A_SENTINEL}`, body: `Why ${A_SENTINEL} matters` }] as never

  it('⭐ (P1) A\'s coaching is gone at the boundary, from memory and from the tab, even with the canvas unmounted', () => {
    // A's canvas is mounted: the real writer persists the blob for A's scenario.
    setGuidancePersistenceContext(() => ({ scenarioId: 'scn-a', graphHash: 'h-a' }))
    useGuidanceStore.getState().setGuidanceItems(aGuidance)
    expect(sessionStorage.getItem('guidance.items.v1')).toContain(A_SENTINEL)
    // A leaves the canvas (the boot path uninstalls nothing it does not own; model the worst case: no provider).
    setGuidancePersistenceContext(null)
    sessionStorage.setItem('canvas.viewMode', 'device')
    clearUserScopedState()
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
    expect(sessionStorage.getItem('guidance.items.v1')).toBeNull()
    expect(sessionStorage.getItem('canvas.viewMode')).toBe('device')
    // B's canvas mounts on A's old scenario id: nothing is adoptable.
    expect(useGuidanceStore.getState().rehydrateGuidance({ scenarioId: 'scn-a', currentAnalysisHash: 'h-a', currentGraphHash: 'h-a' } as never)).toBe(0)
  })

  it('⭐ (P2) A Panel round\'s pending change and participants, and an unregistered import\'s shape, are gone at the boundary', () => {
    rememberPendingApply({ scenarioId: 'scn-a', roundId: 'r-a', participantId: 'p-a', targetId: 'a-sentinel-node', value: 0.7 })
    rememberOpenRound({ roundId: 'r-a', scenarioId: 'scn-a', participants: [{ participant_id: 'p-a', display_name: A_SENTINEL }] })
    markGraphImported([{ id: 'a-sentinel-node' }, { id: 'a-goal' }] as never, [{ source: 'a-sentinel-node', target: 'a-goal' }] as never)
    const holding = (needle: string): string[] => {
      const hits: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i)
        if (k && (localStorage.getItem(k) ?? '').includes(needle)) hits.push(k)
      }
      return hits.sort()
    }
    expect(holding('a-sentinel-node')).toEqual([
      'olumi.collab.pending-apply.scn-a', 'olumi.import.pendingServerRegistration.v1',
    ])
    expect(holding(A_SENTINEL)).toEqual(['olumi.collab.open-round.scn-a'])
    clearUserScopedState()
    expect(holding('a-sentinel-node')).toEqual([])
    expect(holding(A_SENTINEL)).toEqual([])
  })

  it('⭐ (P2) a Snapshot Manager left open across the boundary drops A\'s rows', () => {
    accountASavesASnapshot()
    openSnapshotManager()
    expect(screen.getByText('A pricing plan')).toBeTruthy()
    act(() => { clearUserScopedState() })
    expect(screen.queryByText('A pricing plan')).toBeNull()
    expect(screen.getByText('No snapshots yet')).toBeTruthy()
  })

  it('⭐ (P2) a stale row cannot write a name for a snapshot this identity cannot load', () => {
    expect(saveSnapshot(aGraph)).toBe(true)
    const [only] = listSnapshots()
    openSnapshotManager()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByDisplayValue('Untitled Snapshot')
    fireEvent.change(input, { target: { value: 'renamed by B' } })
    // The snapshot becomes unloadable behind the open manager (a boundary in another tab) with NO re-render here, so
    // the commit below runs on the stale row. The input must still be mounted, or this row would prove nothing.
    localStorage.setItem(IDENTITY_EPOCH_KEY, 'epoch-of-another-identity')
    expect(input.isConnected).toBe(true)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(localStorage.getItem(`${only.key}-name`)).toBeNull()
    expect(useCanvasStore.getState().nodes.map((n) => (n.data as { label?: string }).label)).not.toContain(A_SENTINEL)
  })
})
