/**
 * Shared template → Blueprint loader.
 *
 * Extracted verbatim from TemplatesPanel's `handleInsert` so that BOTH the
 * Templates panel (opened with `T`) and the first-run starter strip go through
 * ONE fetch → validate → map path. Previously this logic lived only inside the
 * panel; duplicating it for a second surface would have created exactly the
 * hand-maintained mirror this repo keeps getting bitten by.
 *
 * Deliberately side-effect free: no store writes, no toasts, no canvas
 * application. Callers own the confirm gate (`confirmReplaceCanvas`) and the
 * application step (`blueprintEventBus.emit`).
 */

import { plot } from '../../adapters/plot'
import type { Blueprint } from '../../templates/blueprints/types'
import { toUiKind } from '../adapters/backendKinds'
import { useCanvasStore } from '../store'

/** What the loader returns: the mapped blueprint plus the raw detail the
 *  Templates panel still needs (version capture, default_seed). */
export interface LoadedTemplateBlueprint {
  blueprint: Blueprint
  /** Raw detail from `plot.template(id)` — panel reads version/default_seed. */
  templateDetail: any
  /** The validated raw graph — panel reads graph.version for its fallback. */
  graph: any
}

/**
 * P0-6 replace-canvas gate.
 *
 * Returns true when it is safe to proceed. On an EMPTY first-run canvas
 * `hasUnsavedChanges` is false, so this returns true WITHOUT prompting —
 * which is why the starter strip can share it without the first-run user ever
 * seeing a confirm dialog for a canvas that holds nothing.
 */
export function confirmReplaceCanvas(): boolean {
  const state = useCanvasStore.getState()
  const hasUnsavedChanges = state.isDirty || state.nodes.length > 0

  if (hasUnsavedChanges) {
    return window.confirm(
      'Start from Template will replace your current canvas. Any unsaved changes will be lost. Continue?'
    )
  }
  return true
}

/**
 * Fetch a template by id and map it into a Blueprint.
 *
 * @throws when the template's graph structure is invalid, or the fetch fails.
 */
export async function loadTemplateBlueprint(templateId: string): Promise<LoadedTemplateBlueprint> {
  // Fetch template from API (works for both mock and httpv1)
  const templateDetail = await plot.template(templateId)

  // Validate graph structure (graph is typed as 'unknown' in TemplateDetail)
  const graph = templateDetail.graph as any
  if (!graph || typeof graph !== 'object') {
    throw new Error(`Template ${templateId} has invalid graph structure`)
  }

  if (!Array.isArray(graph.nodes)) {
    throw new Error(`Template ${templateId} graph.nodes is not an array`)
  }

  // S1-MAP: Convert backend graph to Blueprint format using kind mapping shim
  const blueprintNodes = (graph.nodes || []).map((node: any, index: number) => ({
    id: node.id,
    label: node.label || node.id,
    kind: toUiKind(node.kind), // S1-MAP: Safe kind mapping with fallback
    body: node.body, // v1.2: preserve body text
    position: node.position || { x: 200 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 200 }, // Grid layout if no position
  }))

  // Backend edges may not have IDs, generate them
  const blueprintEdges = (graph.edges || []).map((edge: any) => ({
    id: edge.id || `${edge.from}-${edge.to}`, // Generate ID if missing
    from: edge.from,
    to: edge.to,
    probability: edge.probability,
    weight: edge.weight,
    belief: edge.belief, // v1.2: epistemic confidence
    provenance: edge.provenance, // v1.2: source tracking
  }))

  const blueprint: Blueprint = {
    id: templateDetail.id,
    name: templateDetail.name,
    description: templateDetail.description,
    nodes: blueprintNodes,
    edges: blueprintEdges,
  }

  return { blueprint, templateDetail, graph }
}
