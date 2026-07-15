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
import type { TemplateDetail } from '../../adapters/plot/types'
import type { Blueprint } from '../../templates/blueprints/types'
import { toUiKind, defaultGridPosition } from '../adapters/backendKinds'
import { useCanvasStore } from '../store'

/**
 * The one user-facing failure string for a template load, shared by every
 * surface that starts from a template (Templates panel + first-run starter
 * strip) AND by their specs. Two surfaces failing in two dialects is how copy
 * drift starts; importing one constant makes the parity a compile-time fact
 * instead of a hope pinned by string-equality tests.
 */
export const TEMPLATE_LOAD_FAILED_MESSAGE = 'Failed to load template.'

/**
 * Fetch the template LIST, normalised to a plain array.
 *
 * One fetch, one shape-guard, one module — previously the array-vs-{items}
 * envelope guard existed in three hand-maintained copies (TemplatesPanel's
 * initial load, its retry path, and the starter strip), and the strip + panel
 * each issued their own GET of the same endpoint on the same first-run screen.
 *
 * The success is cached for the life of the page (the template catalogue is
 * static per deploy); a FAILURE is never cached — the in-flight promise is
 * dropped on rejection so a retry actually refetches.
 */
let templateListCache: Promise<any[]> | null = null

/** Test hook ONLY: the cache is per-page in production (the catalogue is
 *  static per deploy) but per-FILE in vitest, where specs legitimately serve
 *  a different fixture per test. Never call from product code. */
export function __resetTemplateListCacheForTests(): void {
  templateListCache = null
}

export function fetchTemplateList(): Promise<any[]> {
  if (!templateListCache) {
    templateListCache = plot.templates().then((list: any) =>
      Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : []
    )
    templateListCache.catch(() => {
      templateListCache = null
    })
  }
  return templateListCache
}

/** What the loader returns: the mapped blueprint plus the raw detail the
 *  Templates panel still needs (version capture, default_seed). */
export interface LoadedTemplateBlueprint {
  blueprint: Blueprint
  /** Typed detail from `plot.template(id)` — panel reads version/default_seed.
   *  Typed (not `any`) so a misspelt field read in a consumer fails tsc, as it
   *  did before this logic was extracted out of the panel. */
  templateDetail: TemplateDetail
  /** The validated raw graph (TemplateDetail types it `unknown`) — panel reads
   *  graph.version for its version fallback. */
  graph: any
}

/**
 * P0-6 replace-canvas gate.
 *
 * Returns true when it is safe to proceed. On a PRISTINE first-run canvas
 * (no nodes AND not dirty) this returns true WITHOUT prompting — which is why
 * the starter strip can share it without the first-run user ever seeing a
 * confirm dialog for a canvas that holds nothing. Note the gate is
 * deliberately conservative: a canvas that is EMPTY but dirty (add a node,
 * delete it) still prompts, because isDirty may represent state beyond nodes.
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

  // S1-MAP: Convert backend graph to Blueprint format using kind mapping shim.
  // UI-SEM-081: template-blueprint mapping defaults — label falls back to the
  // node id, a missing position falls back to the shared grid layout, and a
  // missing edge id is generated from from/to (below). Adapter concern (same
  // class as UI-SEM-002); extracted verbatim from TemplatesPanel.handleInsert.
  const blueprintNodes = (graph.nodes || []).map((node: any, index: number) => ({
    id: node.id,
    label: node.label || node.id,
    kind: toUiKind(node.kind), // S1-MAP: Safe kind mapping with fallback
    body: node.body, // v1.2: preserve body text
    position: node.position || defaultGridPosition(index),
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
