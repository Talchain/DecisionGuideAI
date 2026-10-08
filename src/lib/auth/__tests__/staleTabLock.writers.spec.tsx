/**
 * S-G2 class boundary: a stale document cannot reach user-driven writers.
 *
 * The six small controls below are an explicit interaction harness, wired to
 * real production actions (no persistence mocks). They test the mounted lock's
 * event barrier, not the full canvas UX. Snapshot rows mount the real manager,
 * including its body portal and rename Enter handler. An already-running
 * asynchronous writer is outside this user-interaction claim.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EPOCH_KEY = 'olumi-canvas-identity-epoch'
const SCENARIO = 'bbbbbbbb-0000-4000-8000-00000000000b'
const SNAPSHOT_KEY = 'canvas-snapshot-1720000000000'
const LOCK_COPY = 'Someone signed in or out in another tab. Reload this tab to carry on.'
const PRIVATE_GRAPH = {
  nodes: [
    { id: '1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'A private assumption' } },
    { id: '2', type: 'goal', position: { x: 30, y: 40 }, data: { label: 'A private goal' } },
  ],
  edges: [{ id: '1-2', source: '1', target: '2' }],
}

async function loadLock(): Promise<ComponentType> {
  // Import after resetModules so component, lock and writers share this
  // document's captured epoch. A missing production component must fail.
  return (await import('../../../components/auth/StaleTabLock')).default
}

async function bootTab() {
  vi.resetModules()
  localStorage.setItem(EPOCH_KEY, 'epoch-A')
  const scenarios = await import('../../../canvas/store/scenarios')
  const { useCanvasStore } = await import('../../../canvas/store')
  useCanvasStore.setState({ nodes: PRIVATE_GRAPH.nodes as never, edges: PRIVATE_GRAPH.edges as never })
  const Lock = await loadLock()
  return { scenarios, store: useCanvasStore, Lock }
}

/** Bytes owned by the current identity, captured after its boundary/sweep. */
function storageBytes(keys: string[]): Array<[string, string | null]> {
  return keys.map(key => [key, localStorage.getItem(key)])
}

function rotateInOtherTab(seedCurrentWork: () => void) {
  localStorage.setItem(EPOCH_KEY, 'epoch-B')
  seedCurrentWork()
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: EPOCH_KEY, oldValue: 'epoch-A', newValue: 'epoch-B', storageArea: localStorage,
    }))
  })
}

function assertLock() {
  expect.soft(screen.queryByRole('alertdialog'), 'BLOCKED BY THE LOCK: the full-page barrier is mounted').not.toBeNull()
  expect.soft(screen.queryByText(LOCK_COPY), 'the barrier explains the changed tab identity').not.toBeNull()
}

type Tab = Awaited<ReturnType<typeof bootTab>>
interface WriterRow {
  name: string
  keys: string[]
  prepare: (tab: Tab) => Promise<{ seed: () => void; write: () => void }>
}

const writerRows: WriterRow[] = [
  {
    name: 'Transcripts: Start fresh',
    keys: ['olumi-canvas-transcript'],
    prepare: async tab => ({
      seed: () => {
        localStorage.setItem('olumi-canvas-current-scenario-id', SCENARIO)
        localStorage.setItem('olumi-canvas-transcript', JSON.stringify({
          [SCENARIO]: { savedAt: '2026-10-08T00:00:00Z', dropped: 0, messages: [{ id: 'b', content: 'B current words' }] },
        }))
      },
      // Actual Start fresh store path reads B's shared pointer, then invokes
      // transcriptStore.clearTranscript for an unsaved server scenario.
      write: () => { tab.store.getState().resetCanvas() },
    }),
  },
  {
    name: 'Versions',
    keys: ['olumi-canvas-model-versions-v1'],
    prepare: async () => {
      const versions = await import('../../../canvas/versions/versionStorage')
      return {
        seed: () => localStorage.setItem(versions.VERSIONS_STORAGE_KEY, JSON.stringify({ data: [] })),
        // useModelVersions.saveVersion and autoCapture use this exact writer.
        write: () => { versions.appendVersion({
          id: 'a-private-version', name: 'A private model', createdAt: 1, origin: 'manual',
          nodes: [{ id: '1', kind: 'factor', label: 'A private assumption', fields: {} }], edges: [],
        }) },
      }
    },
  },
  {
    name: 'Dissent',
    keys: [`olumi.dissent.v2.${SCENARIO}:finding`],
    prepare: async () => {
      const dissent = await import('../../../canvas/stores/dissentStore')
      return {
        seed: () => { dissent.recordDissent(SCENARIO, 'finding', 'B current objection', 'b-run', 1) },
        // StrengthenTheReasoning's Record this calls this durable writer.
        write: () => { dissent.recordDissent(SCENARIO, 'finding', 'A old objection', 'a-run', 2) },
      }
    },
  },
  {
    name: 'Layout options',
    keys: ['canvas-layout-options-v6'],
    prepare: async () => {
      const { useLayoutStore } = await import('../../../canvas/layoutStore')
      return {
        seed: () => { useLayoutStore.getState().setDirection('DOWN') },
        write: () => { useLayoutStore.getState().setDirection('RIGHT') },
      }
    },
  },
  {
    name: 'Import markers',
    keys: ['olumi.import.pendingServerRegistration.v1'],
    prepare: async tab => ({
      seed: () => localStorage.setItem('olumi.import.pendingServerRegistration.v1', '[]'),
      // Real importCanvas calls markGraphImported before it replaces the graph.
      write: () => { tab.store.getState().importCanvas(JSON.stringify(PRIVATE_GRAPH)) },
    }),
  },
  {
    name: 'Guest-work ledger: a stale guest turn',
    keys: [`olumi.guestWork.v1:${SCENARIO}`],
    prepare: async () => {
      const guest = await import('../../guestWork')
      return {
        seed: () => { guest.noteGuestTurn({ kind: 'message', source: 'composer', scenario_id: SCENARIO, message: 'B work' }, 1) },
        // Both production turn transports call noteGuestTurn; this is the
        // ledger mutation user Send would reach before any response arrives.
        write: () => { guest.noteGuestTurn({ kind: 'message', source: 'composer', scenario_id: SCENARIO, message: 'A old turn' }, 2) },
      }
    },
  },
]

function ActionSurface({ label, onClick, onKeyDown, children }: {
  label: string; onClick: () => void; onKeyDown: (key: string) => void; children: ReactNode
}) {
  return <>
    <button onClick={() => onClick()} onKeyDown={event => onKeyDown(event.key)}>{label}</button>
    {children}
  </>
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => cleanup())

describe('S-G2 writer classes — BLOCKED BY THE LOCK', () => {
  it.each(writerRows)('$name: click and keyboard cannot reach the real writer; current-era bytes survive', async row => {
    const tab = await bootTab()
    const writer = await row.prepare(tab)
    const clickReceived = vi.fn(writer.write)
    const keyReceived = vi.fn((key: string) => { if (key === 'Enter') writer.write() })
    render(<ActionSurface label={row.name} onClick={clickReceived} onKeyDown={keyReceived}><tab.Lock /></ActionSurface>)
    const control = screen.getByRole('button', { name: row.name })
    rotateInOtherTab(writer.seed)
    const before = storageBytes(row.keys)

    assertLock()
    // fireEvent intentionally targets the underlying DOM directly: jsdom has
    // no hit testing. The capture barrier must refuse even this stronger input.
    fireEvent.click(control)
    fireEvent.keyDown(control, { key: 'Enter' })
    fireEvent.keyDown(control, { key: 's', metaKey: true })
    fireEvent.keyDown(control, { key: 'k', metaKey: true })

    expect.soft(clickReceived, 'the underlying control receives no click').not.toHaveBeenCalled()
    expect.soft(keyReceived, 'the underlying control receives no keypress, including ⌘S and palette').not.toHaveBeenCalled()
    expect.soft(storageBytes(row.keys), 'the current identity storage is byte-for-byte unchanged').toEqual(before)
  })

  it.each(['delete', 'rename'] as const)('Snapshot %s: real portalled manager is unreachable and B snapshot bytes survive', async operation => {
    const tab = await bootTab()
    const { SnapshotManager } = await import('../../../canvas/components/SnapshotManager')
    const { ToastProvider } = await import('../../../canvas/ToastContext')
    const snapshot = (epoch: string) => JSON.stringify({
      version: 1, timestamp: 1720000000000, nodes: PRIVATE_GRAPH.nodes, edges: [], identityEpoch: epoch,
    })
    localStorage.setItem(SNAPSHOT_KEY, snapshot('epoch-A'))
    localStorage.setItem(`${SNAPSHOT_KEY}-name`, 'Current snapshot')
    const onClose = vi.fn()
    render(<ToastProvider><SnapshotManager isOpen onClose={onClose} /><tab.Lock /></ToastProvider>)
    let renameInput: HTMLElement | null = null
    if (operation === 'rename') {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
      renameInput = screen.getByRole('textbox')
      fireEvent.change(renameInput, { target: { value: 'A overwrites B name' } })
    }
    const deleteControl = screen.getByRole('button', { name: 'Delete' })
    const clickReceived = vi.fn()
    deleteControl.addEventListener('click', clickReceived)
    const keyReceived = vi.fn()
    renameInput?.addEventListener('keydown', keyReceived)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    rotateInOtherTab(() => {
      localStorage.setItem(SNAPSHOT_KEY, snapshot('epoch-B'))
      localStorage.setItem(`${SNAPSHOT_KEY}-name`, 'B current snapshot')
    })
    const before = storageBytes([SNAPSHOT_KEY, `${SNAPSHOT_KEY}-name`])

    assertLock()
    if (operation === 'delete') {
      fireEvent.click(deleteControl)
      expect.soft(clickReceived, 'the portalled Delete control receives no click').not.toHaveBeenCalled()
      expect.soft(confirm, 'the destructive store action is not reachable').not.toHaveBeenCalled()
    } else {
      // Lock focus can blur and cancel inline rename. If so, its Enter action
      // is no longer mounted; otherwise even a directly targeted Enter is refused.
      // Query the actual DOM, not the accessibility tree: inert/aria-hidden
      // must not make a still-mounted input look as though it was removed.
      const mountedInput = document.querySelector('input[type="text"]')
      if (mountedInput) fireEvent.keyDown(mountedInput, { key: 'Enter' })
      expect.soft(keyReceived, 'rename Enter is cancelled or receives no keypress').not.toHaveBeenCalled()
    }
    expect.soft(storageBytes([SNAPSHOT_KEY, `${SNAPSHOT_KEY}-name`]), 'B snapshot and name are byte-for-byte unchanged').toEqual(before)
  })
})
