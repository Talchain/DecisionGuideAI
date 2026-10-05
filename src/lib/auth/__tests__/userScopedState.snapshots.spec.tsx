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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { clearUserScopedState, USER_SCOPED_STORAGE_PREFIXES } from '../userScopedState'
import { listSnapshots, saveSnapshot } from '../../../canvas/persist'
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
