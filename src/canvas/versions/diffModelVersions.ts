/**
 * THE canonical diff authority for model versions.
 * British English: visualisation, colour, initialise.
 *
 * ONE DIFF, ONE PLACE. Every surface that reports what changed between two
 * versions of the user's model consumes `diffModelVersions` and the
 * `ModelChangeset` it returns. Restore and variants, when they land, consume
 * the same function. Do not add a second implementation — the estate already
 * carries the cost of that pattern elsewhere (two same-named `generateGraphHash`
 * twins, CLAUDE.md trap #10; a separate `VisualDiff` in the unwired
 * `canvas/snapshots/` module).
 *
 * PURE BY CONSTRUCTION. No store reads, no storage, no clock, no React. Given
 * the same two versions it returns the same changeset, and it never mutates
 * either argument. This is what makes it testable without a canvas mount and
 * reusable from any surface.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not interpret, rank, summarise or explain. It reports the fields
 * that differ and nothing else — captions are built from the changeset by
 * `describeChange.ts` (encode before caption). A changeset never contains a
 * sentence, and no renderer may state a change that is not present here.
 */

import type {
  EdgeChange,
  FieldChange,
  FieldValue,
  ModelChangeset,
  ModelVersion,
  NodeChange,
  VersionRef,
  VersionedEdge,
  VersionedNode,
} from './types'

/**
 * Read a field, mapping BOTH "absent" and "explicitly undefined" to `null`.
 *
 * ⚠ Deliberately not a truthiness check. `0`, `''` and `false` are legitimate
 * user-set values; a `value ? ... : null` here would report an edit from 0 to
 * absent as no change at all, silently swallowing a real edit. Pinned by three
 * separate cases in the spec.
 */
function readField(fields: Readonly<Record<string, FieldValue>>, key: string): FieldValue {
  const value = fields[key]
  return value === undefined ? null : value
}

/**
 * Compare two field bags and return only what differs, ordered by field name
 * so a rendered list is stable between runs.
 *
 * Comparison is strict equality over scalars, so `1` and `'1'` are a change —
 * a type flip on a value field is exactly the kind of thing a user needs to
 * see, not something to normalise away.
 */
function diffFields(
  before: Readonly<Record<string, FieldValue>>,
  after: Readonly<Record<string, FieldValue>>,
): FieldChange[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)])
  const changes: FieldChange[] = []

  for (const field of [...keys].sort()) {
    const from = readField(before, field)
    const to = readField(after, field)
    if (from !== to) changes.push({ field, before: from, after: to })
  }

  return changes
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) map.set(item.id, item)
  return map
}

function sortedById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function refOf(version: ModelVersion): VersionRef {
  return { id: version.id, name: version.name, createdAt: version.createdAt }
}

/**
 * Node fields participating in the comparison: the explicit `fields` bag plus
 * the two identity-adjacent attributes a user reads as content.
 *
 * `label` and `kind` are folded in here rather than special-cased so that a
 * rename and a value edit are reported through ONE mechanism and render
 * identically. `id` is never a field — it is the pairing key.
 */
function nodeComparable(node: VersionedNode): Record<string, FieldValue> {
  return { ...node.fields, label: node.label, kind: node.kind }
}

/**
 * Edge fields participating in the comparison.
 *
 * `from`/`to` are included so a re-pointed edge reports as a modification of a
 * surviving edge rather than a delete plus an add — the user moved one arrow,
 * and that is what they should read.
 */
function edgeComparable(edge: VersionedEdge): Record<string, FieldValue> {
  const comparable: Record<string, FieldValue> = { ...edge.fields, from: edge.from, to: edge.to }
  if (edge.label !== undefined) comparable.label = edge.label
  return comparable
}

/**
 * Compare two model versions and return the typed changeset between them.
 *
 * Elements are paired BY ID and only by id. Never by label and never by a
 * value predicate: two nodes routinely share a label ("Cost", "Revenue"), and
 * pairing on one would resolve the wrong object and report a confident, wrong
 * change — CLAUDE.md trap #19 at the level of the product rather than a test.
 *
 * @param before the earlier version
 * @param after  the later version
 */
export function diffModelVersions(before: ModelVersion, after: ModelVersion): ModelChangeset {
  const beforeNodes = byId(before.nodes)
  const afterNodes = byId(after.nodes)
  const beforeEdges = byId(before.edges)
  const afterEdges = byId(after.edges)

  const addedNodes: VersionedNode[] = []
  const removedNodes: VersionedNode[] = []
  const modifiedNodes: NodeChange[] = []

  for (const [id, afterNode] of afterNodes) {
    const beforeNode = beforeNodes.get(id)
    if (!beforeNode) {
      addedNodes.push(afterNode)
      continue
    }
    const fields = diffFields(nodeComparable(beforeNode), nodeComparable(afterNode))
    if (fields.length > 0) {
      // Label and kind are taken from the LATER version: the user is looking
      // at what the element is called now, not what it used to be called.
      modifiedNodes.push({ id, label: afterNode.label, kind: afterNode.kind, fields })
    }
  }

  for (const [id, beforeNode] of beforeNodes) {
    if (!afterNodes.has(id)) removedNodes.push(beforeNode)
  }

  const addedEdges: VersionedEdge[] = []
  const removedEdges: VersionedEdge[] = []
  const modifiedEdges: EdgeChange[] = []

  for (const [id, afterEdge] of afterEdges) {
    const beforeEdge = beforeEdges.get(id)
    if (!beforeEdge) {
      addedEdges.push(afterEdge)
      continue
    }
    const fields = diffFields(edgeComparable(beforeEdge), edgeComparable(afterEdge))
    if (fields.length > 0) {
      modifiedEdges.push({
        id,
        from: afterEdge.from,
        to: afterEdge.to,
        label: afterEdge.label,
        fields,
      })
    }
  }

  for (const [id, beforeEdge] of beforeEdges) {
    if (!afterEdges.has(id)) removedEdges.push(beforeEdge)
  }

  const changeset: Omit<ModelChangeset, 'isEmpty'> = {
    from: refOf(before),
    to: refOf(after),
    addedNodes: sortedById(addedNodes),
    removedNodes: sortedById(removedNodes),
    modifiedNodes: sortedById(modifiedNodes),
    addedEdges: sortedById(addedEdges),
    removedEdges: sortedById(removedEdges),
    modifiedEdges: sortedById(modifiedEdges),
  }

  return {
    ...changeset,
    // Derived, never set by hand, so it cannot disagree with the collections.
    isEmpty:
      changeset.addedNodes.length === 0 &&
      changeset.removedNodes.length === 0 &&
      changeset.modifiedNodes.length === 0 &&
      changeset.addedEdges.length === 0 &&
      changeset.removedEdges.length === 0 &&
      changeset.modifiedEdges.length === 0,
  }
}
