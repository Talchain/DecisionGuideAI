/**
 * Changeset -> plain-language lines.
 * British English: visualisation, colour, initialise.
 *
 * ENCODE BEFORE CAPTION. This module is the ONLY place a sentence is produced,
 * and it produces sentences from nothing but the typed `ModelChangeset`. It
 * cannot say anything the diff did not find: there is no store access, no
 * summarisation, no ranking, no "this looks significant". If a line appears on
 * screen, a field in the changeset produced it.
 *
 * NO FABRICATED SUMMARIES. There is deliberately no "you made 3 major changes"
 * or "this weakened your model" line anywhere. Those are judgements the product
 * has not earned and the changeset cannot support.
 *
 * FIELD NAMING IS DISPLAY-ONLY. `FIELD_LABELS` maps a few storage field names
 * to the words the UI already uses for them elsewhere. It is display naming,
 * not a semantic transform: no value is altered, and ANY unmapped field falls
 * through to its raw name, so a newly added field is rendered honestly (if
 * awkwardly) rather than silently hidden.
 */

import type {
  EdgeChange,
  FieldChange,
  FieldValue,
  ModelChangeset,
  ModelVersion,
  NodeChange,
} from './types'

export interface ChangeLine {
  /** Stable React key — element id plus field, unique within a changeset. */
  key: string
  scope: 'node' | 'edge'
  kind: 'added' | 'removed' | 'modified'
  text: string
}

/**
 * Display names for storage fields, using the vocabulary the rest of the
 * canvas already shows the user. Unmapped fields fall back to the raw name.
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  label: 'name',
  weight: 'strength',
  beliefExists: 'confidence it exists',
  beliefStrength: 'effect size',
  strengthStd: 'uncertainty',
  strength_mean: 'signed strength',
  exists_probability: 'probability it exists',
  direction: 'direction',
  confidence: 'branch probability',
  utility: 'payoff',
  prior: 'prior probability',
  probability: 'likelihood',
  provenance: 'source',
  provenanceDisplay: 'source',
  description: 'description',
  body: 'notes',
  kind: 'type',
  from: 'start',
  to: 'end',
  'observedState.value': 'value',
  'observedState.raw_value': 'value as entered',
  'observedState.unit': 'unit',
  'observedState.baseline': 'baseline',
  'observedState.display_value': 'displayed value',
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

/**
 * Render a stored value for reading.
 *
 * `null` becomes "not set" — a faithful rendering of absence, not a
 * substituted value. Numbers are printed as-is apart from trimming binary
 * floating-point noise, which is presentation, not rounding for effect.
 */
export function formatFieldValue(value: FieldValue): string {
  if (value === null) return 'not set'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    return String(Number.parseFloat(value.toFixed(6)))
  }
  return value.length === 0 ? 'empty' : `"${value}"`
}

/** Sentence-case a node kind for reading ("factor" -> "Factor"). */
function kindLabel(kind: string): string {
  if (kind.length === 0) return 'Element'
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function describeField(change: FieldChange): string {
  return `${fieldLabel(change.field)} ${formatFieldValue(change.before)} → ${formatFieldValue(change.after)}`
}

/**
 * Resolve a node id to a readable label.
 *
 * Falls back to the raw id when the node is unknown, which is honest: the id
 * is what we have, and inventing a friendly name for an element we cannot
 * resolve would be a fabrication.
 */
function resolveLabel(labels: ReadonlyMap<string, string>, id: string): string {
  return labels.get(id) ?? id
}

function edgeTitle(labels: ReadonlyMap<string, string>, from: string, to: string): string {
  return `${resolveLabel(labels, from)} → ${resolveLabel(labels, to)}`
}

/**
 * Build a label lookup from the changeset alone.
 *
 * ⚠ NECESSARILY INCOMPLETE, and that is why `describeChangeset` accepts a
 * better index. A changeset only mentions elements that CHANGED, so an edge
 * whose endpoints were untouched has no label available here and renders by
 * raw id. Callers holding the two versions should pass
 * `buildVersionLabelIndex(before, after)` instead. Rendering an id is the
 * honest degradation; inventing a name for an unresolvable node would not be.
 */
export function buildLabelIndex(changeset: ModelChangeset): Map<string, string> {
  const labels = new Map<string, string>()
  for (const node of changeset.removedNodes) labels.set(node.id, node.label)
  for (const node of changeset.addedNodes) labels.set(node.id, node.label)
  for (const node of changeset.modifiedNodes) labels.set(node.id, node.label)
  return labels
}

/**
 * Build a complete label lookup from whole versions.
 *
 * Pass the EARLIER version first and the LATER one second: later entries
 * overwrite earlier ones, so a renamed node reads by its current name while a
 * node that exists only in the earlier version (deleted) still resolves.
 */
export function buildVersionLabelIndex(...versions: readonly ModelVersion[]): Map<string, string> {
  const labels = new Map<string, string>()
  for (const version of versions) {
    for (const node of version.nodes) labels.set(node.id, node.label)
  }
  return labels
}

function describeNode(change: NodeChange): ChangeLine[] {
  return change.fields.map((field) => ({
    key: `node:${change.id}:${field.field}`,
    scope: 'node' as const,
    kind: 'modified' as const,
    text: `${kindLabel(change.kind)} "${change.label}" ${describeField(field)}`,
  }))
}

function describeEdge(change: EdgeChange, labels: ReadonlyMap<string, string>): ChangeLine[] {
  return change.fields.map((field) => ({
    key: `edge:${change.id}:${field.field}`,
    scope: 'edge' as const,
    kind: 'modified' as const,
    text: `Link ${edgeTitle(labels, change.from, change.to)} ${describeField(field)}`,
  }))
}

/**
 * Turn a changeset into ordered, readable lines.
 *
 * Order is additions, then removals, then modifications, nodes before edges —
 * structure before detail, which is how a person reads a model change. Within
 * each group the changeset's own deterministic id ordering is preserved.
 *
 * @param labels optional complete node-label index. Defaults to what the
 * changeset alone can supply, which cannot name unchanged endpoints — pass
 * `buildVersionLabelIndex(before, after)` when the versions are to hand.
 */
export function describeChangeset(
  changeset: ModelChangeset,
  labels: ReadonlyMap<string, string> = buildLabelIndex(changeset),
): ChangeLine[] {
  const lines: ChangeLine[] = []

  for (const node of changeset.addedNodes) {
    lines.push({
      key: `node-added:${node.id}`,
      scope: 'node',
      kind: 'added',
      text: `${kindLabel(node.kind)} "${node.label}" added`,
    })
  }

  for (const edge of changeset.addedEdges) {
    lines.push({
      key: `edge-added:${edge.id}`,
      scope: 'edge',
      kind: 'added',
      text: `Link ${edgeTitle(labels, edge.from, edge.to)} added`,
    })
  }

  for (const node of changeset.removedNodes) {
    lines.push({
      key: `node-removed:${node.id}`,
      scope: 'node',
      kind: 'removed',
      text: `${kindLabel(node.kind)} "${node.label}" removed`,
    })
  }

  for (const edge of changeset.removedEdges) {
    lines.push({
      key: `edge-removed:${edge.id}`,
      scope: 'edge',
      kind: 'removed',
      text: `Link ${edgeTitle(labels, edge.from, edge.to)} removed`,
    })
  }

  for (const node of changeset.modifiedNodes) lines.push(...describeNode(node))
  for (const edge of changeset.modifiedEdges) lines.push(...describeEdge(edge, labels))

  return lines
}
