/**
 * ROADMAP 2.467 + 2.503 — THE ACCEPTANCE CASE, and the release handshake.
 *
 * THE CASE, live-witnessed 5 Aug: **import → PLAIN RELOAD (no save) → the
 * imported value must SURVIVE.** It did not. `mergeServerGraphOnHydrate` applies
 * server VALUES over the local canvas at boot (`overlayNode` does
 * `{...existing.data, ...mapped.data}`), so CEE's label won and the user's
 * import was silently undone. `verdicts.json` recorded `canvasHasSentinel`
 * **true** at step 2 (post-import) and **false** at steps 4 and 5 (post-reload).
 *
 * The fix belongs to THIS train and is not a standalone patch of the merge rule:
 * server-wins is CORRECT once the server holds the graph, and destructive only
 * in the window before it does. So the merge refuses while the hold is armed,
 * and the refusal ENDS at the registration acknowledgement.
 *
 * FIXTURE PROVENANCE: byte copies of the walk's own files (see
 * `buildRegistrationGraph.spec.ts`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'

/** The store's own edge type — `Edge<EdgeData>`, not the bare `Edge`. */
type CanvasStoreEdges = ReturnType<typeof useCanvasStore.getState>['edges']
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import {
  clearImportRegistrationMarkers,
  isGraphPendingImportRegistration,
  markGraphImported,
  releaseImportRegistration,
} from '../../store/importRegistrationMarker'

import IMPORTED_CANVAS from './fixtures/walk-import-modified.canvas.json'
import ORIGINAL_CANVAS from './fixtures/walk-export-original.canvas.json'

type CanvasFile = { nodes: Node[]; edges: Edge[] }
const IMPORTED = IMPORTED_CANVAS as unknown as CanvasFile
const ORIGINAL = ORIGINAL_CANVAS as unknown as CanvasFile

const SENTINEL = 'ZZZ IMPORTED OPTION'
const SERVER_LABEL = 'Alpha Hall'

/**
 * The graph CEE holds — the PRE-import model, in wire shape (`from`/`to`, one
 * kind spelling), derived from the walk's own "original" export so the server
 * side of the test is the producer's data too.
 */
function serverPreImportGraph(): unknown {
  return {
    nodes: ORIGINAL.nodes.map((n) => ({
      id: n.id,
      kind: (n.data as Record<string, unknown>).kind,
      label: (n.data as Record<string, unknown>).label,
    })),
    edges: ORIGINAL.edges.map((e) => ({ from: e.source, to: e.target })),
  }
}

/** Put the imported canvas on the store, exactly as a boot-from-autosave does. */
function installImportedCanvas(pendingRegistration: boolean): void {
  useCanvasStore.setState({
    nodes: JSON.parse(JSON.stringify(IMPORTED.nodes)) as Node[],
    edges: JSON.parse(JSON.stringify(IMPORTED.edges)) as unknown as CanvasStoreEdges,
    currentScenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
    importPendingServerRegistration: pendingRegistration,
  })
}

function sentinelOnCanvas(): string | undefined {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === 'opt_alpha')
  return (node?.data as Record<string, unknown> | undefined)?.label as string | undefined
}

beforeEach(() => {
  clearImportRegistrationMarkers()
  vi.restoreAllMocks()
})

describe('2.503 acceptance case — import → reload without saving', () => {
  it('POSITIVE CONTROL: without the hold, the boot merge really does overwrite the imported label', () => {
    // Trap 13, and it is the load-bearing control of this whole file. If the
    // merge could not clobber, the refusal below would prove nothing. This is
    // the WITNESSED defect, reproduced.
    installImportedCanvas(false)
    expect(sentinelOnCanvas()).toBe(SENTINEL)

    const result = mergeServerGraphOnHydrate(serverPreImportGraph())

    expect(result.accepted).toBe(true)
    expect(sentinelOnCanvas()).toBe(SERVER_LABEL)
  })

  it('THE ACCEPTANCE CASE: under an armed import hold, the imported value SURVIVES the boot merge', () => {
    installImportedCanvas(true)
    expect(sentinelOnCanvas()).toBe(SENTINEL)

    const result = mergeServerGraphOnHydrate(serverPreImportGraph())

    expect(result.accepted).toBe(false)
    expect(result.refusedReason).toBe('importUnregistered')
    expect(result.changed).toBe(false)
    // Bound BY IDENTITY (node id), not by "some node still says the sentinel".
    expect(sentinelOnCanvas()).toBe(SENTINEL)
  })

  it('the refusal does not record an authoritative identity for a graph it did not apply', () => {
    installImportedCanvas(true)
    const before = useCanvasStore.getState().lastAuthoritativeGraph
    mergeServerGraphOnHydrate(serverPreImportGraph())
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBe(before)
  })

  it('server-wins RESUMES once the hold is released — the refusal is a window, not a new rule', () => {
    // This is why 2.503 was folded into this row rather than patched alone: the
    // fix must not weaken server-wins in general, only defer it until the
    // server actually holds the user's graph.
    installImportedCanvas(true)
    expect(mergeServerGraphOnHydrate(serverPreImportGraph()).refusedReason).toBe(
      'importUnregistered',
    )

    useCanvasStore.setState({ importPendingServerRegistration: false })
    const after = mergeServerGraphOnHydrate(serverPreImportGraph())
    expect(after.accepted).toBe(true)
  })

  it('the refusal is scoped to the import hold — an ordinary canvas still merges', () => {
    // DISCRIMINATING HALF: without this, "refuses" could mean "refuses always".
    installImportedCanvas(false)
    expect(mergeServerGraphOnHydrate(serverPreImportGraph()).accepted).toBe(true)
  })
})

describe('the marker handshake — armed by import, released only by an acknowledgement', () => {
  it('POSITIVE CONTROL: the marker really can arm on the captured graph', () => {
    expect(isGraphPendingImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(false)
    markGraphImported(IMPORTED.nodes, IMPORTED.edges)
    expect(isGraphPendingImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(true)
  })

  it('releases the acknowledged identity, and reports that it did', () => {
    markGraphImported(IMPORTED.nodes, IMPORTED.edges)
    expect(releaseImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(true)
    expect(isGraphPendingImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(false)
  })

  it('DISCRIMINATING PAIR: releasing one identity leaves ANOTHER held graph held', () => {
    // The release is bound to the graph that was registered, by identity —
    // never "clear the hold". A session that imported two graphs and registered
    // one keeps holding the other.
    const other: CanvasFile = {
      nodes: [{ id: 'zzz-only-node', type: 'goal', data: { kind: 'goal', label: 'Z' } }] as unknown as Node[],
      edges: [],
    }
    markGraphImported(IMPORTED.nodes, IMPORTED.edges)
    markGraphImported(other.nodes, other.edges)

    expect(releaseImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(true)
    expect(isGraphPendingImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(false)
    expect(isGraphPendingImportRegistration(other.nodes, other.edges)).toBe(true)
  })

  it('releasing an identity that was never held is a no-op that SAYS SO', () => {
    expect(releaseImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(false)
  })

  it('the release is label-independent, so a relabel after registration does not silently re-arm or mis-release', () => {
    // The digest is structural on purpose. Registering and then relabelling
    // must not resurrect a hold, and must not release someone else's.
    markGraphImported(IMPORTED.nodes, IMPORTED.edges)
    expect(releaseImportRegistration(ORIGINAL.nodes, ORIGINAL.edges)).toBe(true)
    expect(isGraphPendingImportRegistration(IMPORTED.nodes, IMPORTED.edges)).toBe(false)
  })
})
