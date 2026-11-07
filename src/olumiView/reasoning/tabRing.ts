/**
 * The Reasoning tab's one ring slot on the canvas (`attCards`), shared by the parts of the tab that point into the model: the glance and
 * the option rack each hold their own set of card ids, and the slot lights their union, so neither clears the other's ring.
 */
import { attCards } from '../ring'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { useCanvasStore } from '../../canvas/store'

const held = new Map<string, readonly string[]>()

/** Hold `ids` for `source` (its earlier set replaced); an empty set lets go. */
export function ringFrom(source: string, ids: readonly string[]): void {
  if (ids.length === 0) held.delete(source); else held.set(source, ids)
  attCards([...new Set([...held.values()].flat())])
}

/**
 * A press on a mark that points at a card: the canvas selects and centres that card (`focusNodeById`); pressed again, it lets go of that
 * card only, so the rest of a multi-selection stays as it is.
 */
export function pressCard(id: string): void {
  const canvas = useCanvasStore.getState(), selected = canvas.selection.nodeIds
  if (!selected.has(id)) focusNodeById(id)
  else if (selected.size > 1) canvas.selectNodes([...selected].filter((x) => x !== id))
  else canvas.clearSelection()
}
