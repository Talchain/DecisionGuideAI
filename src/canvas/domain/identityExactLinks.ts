/**
 * ⭐ IDENTITY-EXACT LINKS (DL 8 Oct; design lane-placeholder-licence.md; copy ruling DL 8 Oct).
 *
 * After Yes to "MRR = price × subscribers" the chance read "on Olumi's estimates for N links" while the canvas still
 * marked price → MRR and subscribers → MRR "strength not set": the two surfaces disagreed about what needs sizing.
 *
 * CEE's rule, mirrored exactly (`goal-certainty.ts` `exact`): a link is exact when its TARGET carries a
 * `nonlinear_identity`, THIS Run evaluated that identity (`report.identity_evaluated_node_ids`), and the identity's
 * `factor_ids` include the link's SOURCE. Nothing broader: not "the user confirmed it" (the wire cannot prove that).
 *
 * Bound to the Run: only while the displayed Run is current (`selectRunAffirmedCurrent`). A stale or unattested Run
 * leaves every link as it was (fail toward today's marking, never a false "exact").
 *
 * Words (DL ruling): "Exact: ‘<identity>’ = ‘<A>’ × ‘<B>’" — the arithmetic, crediting nobody's confirmation.
 */
import { useCanvasStore } from '../store'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'

type NodeLike = { id: string; data?: unknown }
type EdgeLike = { id: string; source: string; target: string }

const OPERATOR: Record<string, string> = { product: '×', sum: '+' }

const labelOf = (n: NodeLike | undefined, id: string): string => {
  const label = (n?.data as { label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.trim() !== '' ? label : id
}

/** The ruled sentence for an exact operand link of an evaluated identity, or null when the identity is not readable. */
export function identityExactWords(identity: NodeLike, nodes: readonly NodeLike[]): string | null {
  const id = (identity.data as { nonlinear_identity?: unknown } | undefined)?.nonlinear_identity as
    { operation?: unknown; factor_ids?: unknown } | undefined
  const op = typeof id?.operation === 'string' ? OPERATOR[id.operation] : undefined
  if (op === undefined || !Array.isArray(id?.factor_ids) || id.factor_ids.length < 2) return null
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parts = (id.factor_ids as unknown[]).map((f) => (typeof f === 'string' ? `‘${labelOf(byId.get(f), f)}’` : null))
  if (parts.some((p) => p === null)) return null
  return `Exact: ‘${labelOf(identity, identity.id)}’ = ${parts.join(` ${op} `)}`
}

/**
 * Edge id → its ruled words, for every link CEE's rule calls exact. Empty when `evaluated` is null (not attested).
 */
export function identityExactLinks(
  nodes: readonly NodeLike[],
  edges: readonly EdgeLike[],
  evaluated: readonly string[] | null | undefined,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  if (!evaluated || evaluated.length === 0) return out
  const done = new Set(evaluated)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const e of edges) {
    if (!done.has(e.target)) continue
    const target = byId.get(e.target)
    const factors = ((target?.data as { nonlinear_identity?: { factor_ids?: unknown } } | undefined)?.nonlinear_identity)?.factor_ids
    if (!Array.isArray(factors) || !factors.includes(e.source)) continue
    const words = identityExactWords(target!, nodes)
    if (words !== null) out.set(e.id, words)
  }
  return out
}

type State = ReturnType<typeof useCanvasStore.getState>
const EMPTY: ReadonlyMap<string, string> = new Map()
let memo: { nodes: unknown; edges: unknown; evaluated: unknown; out: ReadonlyMap<string, string> } | null = null

/** The store's exact links: the current Run's evaluated identities over the canvas graph (memoised by reference). */
export function selectIdentityExactLinks(s: State): ReadonlyMap<string, string> {
  const report = s.results?.report as { identity_evaluated_node_ids?: readonly string[] } | null | undefined
  const evaluated = report?.identity_evaluated_node_ids
  if (!evaluated || evaluated.length === 0 || !Array.isArray(s.nodes) || !Array.isArray(s.edges) || !selectRunAffirmedCurrent(s)) return EMPTY
  if (memo && memo.nodes === s.nodes && memo.edges === s.edges && memo.evaluated === evaluated) return memo.out
  const out = identityExactLinks(s.nodes as NodeLike[], s.edges as EdgeLike[], evaluated)
  memo = { nodes: s.nodes, edges: s.edges, evaluated, out }
  return out
}

/** This edge's exact words, or null. */
export function useIdentityExactWords(edgeId: string): string | null {
  return useCanvasStore((s) => selectIdentityExactLinks(s).get(edgeId) ?? null)
}

/** Is this link still unsized? The placeholder predicate, unless CEE's rule makes it exact on the current Run. */
export function isUnsizedLink(edgeId: string, placeholder: boolean, exact: ReadonlyMap<string, string>): boolean {
  return placeholder && !exact.has(edgeId)
}
