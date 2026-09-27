/**
 * ⛔ A CARD THE USER HAS JUST MOVED PAINTS ON TOP (canvas audit edit-structure/F4,
 * 27 Sep 2026).
 *
 * React Flow paints nodes by `zIndex`, then by array order, and lifts a SELECTED
 * node by 1000 (`@xyflow/system` `calculateZ`, 'basic' mode). The canvas gives
 * no card a z, so once a dropped card is deselected it falls back into the
 * store's card order — alphabetical by id — and a factor dropped onto an option
 * always ends up UNDER it. Measured on the served build: half the dropped card
 * hidden, its title reading "Top… Co…", and the same after a reload.
 *
 * ⭐ So a committed move gives the moved cards a z one above every other card.
 * It lives on the node, so the autosave keeps it and a reload paints the same.
 *
 * ⚠ THE ARRAY ORDER IS NEVER TOUCHED. ELK lays out with
 * `considerModelOrder` (`layout.ts`), so moving a card to the end of the list
 * would make Auto-arrange depend on which card was touched last.
 *
 * ⚠ BOUNDED BELOW REACT FLOW'S SELECTED LIFT. Every raise climbs by one; past
 * `RAISED_Z_CEILING` the raised cards are renumbered 1…k in their current order,
 * so a resting card can never outrank a selected one (which React Flow draws at
 * its own z + 1000). A burst on one card (a held arrow key) raises it once.
 */
import type { Node } from '@xyflow/react'

/** Well under React Flow's `SELECTED_NODE_Z` (1000). */
export const RAISED_Z_CEILING = 500

const zOf = (n: Node): number => (typeof n.zIndex === 'number' ? n.zIndex : 0)

/**
 * `nodes` with every node in `ids` painted above every node not in it. Returns
 * the SAME array when they already are (so a held key churns nothing), and the
 * same object for every node it does not change.
 */
export function raiseToFront<T extends Node>(nodes: T[], ids: ReadonlySet<string>): T[] {
  if (ids.size === 0) return nodes
  let topOfRest = 0
  for (const n of nodes) if (!ids.has(n.id)) topOfRest = Math.max(topOfRest, zOf(n))
  const alreadyOnTop = nodes.every((n) => !ids.has(n.id) || zOf(n) > topOfRest)
  if (alreadyOnTop) return nodes

  const next = topOfRest + 1
  const raised = nodes.map((n) => (ids.has(n.id) ? { ...n, zIndex: next } : n))
  return next > RAISED_Z_CEILING ? renumberRaised(raised) : raised
}

/** Renumber every raised z to 1…k, keeping their relative order. */
function renumberRaised<T extends Node>(nodes: T[]): T[] {
  const levels = [...new Set(nodes.map(zOf).filter((z) => z > 0))].sort((a, b) => a - b)
  const rank = new Map(levels.map((z, i) => [z, i + 1]))
  return nodes.map((n) => {
    const z = zOf(n)
    return z > 0 && rank.get(z) !== z ? { ...n, zIndex: rank.get(z) } : n
  })
}
