/**
 * Where the person was before "Show in the workspace": the camera and everything the show may change, so that a return puts back exactly
 * that. One snapshot, scoped to the reader, the scenario, the version and the level on screen: a snapshot of another reader, scenario,
 * version or level is never restored (the cards and the camera it names may no longer mean anything).
 *
 * What it holds and how each goes back:
 *   - the camera, whether the person held it, and the pane  through the camera port (show.ts)
 *   - the badges open, with `all`                           `setOpened`: a new read of the View, awaited
 *   - the folds a show opened (the inputs, a row's group)   foldStore's own writers shut exactly those again; a fold the person opened
 *                                                           themselves, before or while the cards were shown, stays open (the canvas
 *                                                           owner's rule, 17 Nov)
 *   - the layer chosen, with the scenario it was for        the layer store, both fields as they were
 *   - the lens                                              the lens store
 *   - the nodes AND links selected                          the canvas store: each element's own flag, and its selection record
 */
import type { Pane, ShowCameraPort, Viewport } from './cameraPort'
import { groupOpen, setGroupOpen, setInputsOpen, useCanvasStore, useInputsOpen, useLayer, useViewLens, useViewStore, type LayerId, type Opened, type View, type ViewLens } from './deps'

/**
 * Reader, scenario, version and level as one key. A held proposal is part of it (its model is the one on screen while it is held), and so
 * is the level: Simple and Detailed are different boards, and a camera kept for one means nothing on the other.
 */
export const scopeOf = (s: { readonly sid: string | null; readonly at: number | null; readonly view: View | null }, level: string): string =>
  JSON.stringify([s.view?.you_id ?? null, s.sid, s.at, s.view?.version?.id ?? null, s.view?.proposal?.id ?? null, level])

export interface Snapshot {
  readonly scope: string
  readonly sid: string | null
  readonly viewport: Viewport
  readonly held: boolean
  /** The free canvas the camera was framed for: a return to a pane of another size hands the camera back to the board instead. */
  readonly pane: Pane | null
  readonly opened: Opened
  /**
   * The folds the shows since this snapshot have opened, each shut at the time (show.ts notes them as it opens them): a return shuts
   * these and no other.
   */
  readonly unfolded: { inputs: boolean; readonly groups: Set<string> }
  readonly layer: { readonly layer: LayerId; readonly sid: string | null }
  readonly lens: ViewLens
  /** The elements whose own `selected` flag was set. */
  readonly nodes: readonly string[]
  readonly edges: readonly string[]
  /** The canvas store's selection record, which is kept apart from the flags (a layout rebuilds links without theirs). */
  readonly selection: { readonly nodeIds: readonly string[]; readonly edgeIds: readonly string[]; readonly anchorPosition: { x: number; y: number } | null }
}

export function takeSnapshot(port: ShowCameraPort, scope: string): Snapshot {
  const { sid, opened } = useViewStore.getState()
  const camera = port.capture()
  const canvas = useCanvasStore.getState()
  const layer = useLayer.getState()
  return {
    scope, sid,
    viewport: { ...camera.viewport }, held: camera.held, pane: port.pane(),
    opened: { open: new Map(opened.open), all: opened.all },
    unfolded: { inputs: false, groups: new Set<string>() },
    layer: { layer: layer.layer, sid: layer.sid },
    lens: useViewLens.getState().lens,
    nodes: canvas.nodes.filter((n) => n.selected === true).map((n) => n.id),
    edges: canvas.edges.filter((e) => e.selected === true).map((e) => e.id),
    selection: { nodeIds: [...canvas.selection.nodeIds], edgeIds: [...canvas.selection.edgeIds], anchorPosition: canvas.selection.anchorPosition },
  }
}

const sameOpened = (a: Opened, b: Opened): boolean =>
  a.all === b.all && a.open.size === b.open.size && [...a.open].every(([card, records]) => { const other = b.open.get(card); return other !== undefined && other.length === records.length && other.every((r, i) => r === records[i]) })

/** A show opened these folds of this snapshot's scenario: noted so that a return shuts them, and only them. */
export function noteUnfolded(snap: Snapshot, what: { readonly inputs: boolean; readonly groups: readonly string[] }): void {
  if (what.inputs) snap.unfolded.inputs = true
  for (const g of what.groups) snap.unfolded.groups.add(g)
}

/** Put back what is this page's own and needs no read: the layer (with its scenario), the lens, and the folds a show opened. */
export function restoreLocal(snap: Snapshot): void {
  const layer = useLayer.getState()
  if (layer.layer !== snap.layer.layer || layer.sid !== snap.layer.sid) useLayer.setState({ layer: snap.layer.layer, sid: snap.layer.sid })
  if (useViewLens.getState().lens !== snap.lens) useViewLens.setState({ lens: snap.lens })
  const sid = snap.sid
  if (sid !== null) {
    if (snap.unfolded.inputs && useInputsOpen.getState().open[sid] === true) setInputsOpen(sid, false)
    for (const g of snap.unfolded.groups) if (groupOpen(sid, g)) setGroupOpen(sid, g, false)
  }
  snap.unfolded.inputs = false
  snap.unfolded.groups.clear()
}

/**
 * Put back the layer, the lens, the folds and the badges. The badges are a new read of the View, so this resolves false when that
 * read fails or a newer read overtakes it (the caller then says so and restores nothing more).
 */
export async function restoreStores(snap: Snapshot): Promise<boolean> {
  restoreLocal(snap)
  if (sameOpened(useViewStore.getState().opened, snap.opened)) return true
  return useViewStore.getState().setOpened({ open: new Map(snap.opened.open), all: snap.opened.all })
}

/** Put back the selection: each node's and each link's own flag, and the selection record. Called once the board has settled, since a layout drops link flags. */
export function restoreSelection(snap: Snapshot): void {
  const nodes = new Set(snap.nodes), edges = new Set(snap.edges)
  useCanvasStore.setState((s) => ({
    nodes: s.nodes.map((n) => ((n.selected === true) === nodes.has(n.id) ? n : { ...n, selected: nodes.has(n.id) })),
    edges: s.edges.map((e) => ((e.selected === true) === edges.has(e.id) ? e : { ...e, selected: edges.has(e.id) })),
    selection: { nodeIds: new Set(snap.selection.nodeIds), edgeIds: new Set(snap.selection.edgeIds), anchorPosition: snap.selection.anchorPosition },
  }))
}
