/**
 * IDENTITY-EXACT (rebuild of #2686): an operand link of an identity the CURRENT Run evaluated is exact, not
 * "strength not set".
 *
 * Example: MRR = Price × Subscribers. The engine computes MRR from its operands, so the links Price → MRR and
 * Subscribers → MRR carry no strength to estimate. Calling them "Strength not set" asks the user for a number the
 * model never uses. CEE's goal-certainty `exact` rule, mirrored: the link's target carries `nonlinear_identity`, the
 * current Run evaluated it, and the source is one of its `factor_ids`.
 *
 * CARRIERS, one reader:
 * - the scenario-graph read's `analysis_identity_evaluated_node_ids` (CEE `assist.v1.scenario-graph.ts`), applied by
 *   `applyScenarioAnalysisRead` on load and on the auto-run's delivery;
 * - the turn that ran the Run: `identity_evaluated_node_ids`, top level or the additive sidecar (CEE #3046), applied by
 *   `applyV5State`, so a Run pressed mid-session shows it at once.
 * Same array on both; `[]` = recorded, none; absent = not attested (nothing recorded).
 *
 * Bound to the Run it came with: it holds only while the displayed report is the one whose read carried it
 * (`model_card.response_hash`) and that Run is current (`selectRunAffirmedCurrent`). A stale Run or another Run's
 * report leaves every link as it was.
 *
 * Words (DL ruling on #2686): "Exact: ‘<identity>’ = ‘<A>’ × ‘<B>’". They credit nobody's confirmation.
 */
import { create } from 'zustand'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'
import { useCanvasStore } from '../store'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'

type NodeLike = { id: string; data?: unknown }
type EdgeLike = { id: string; source: string; target: string }

const OPERATOR: Record<string, string> = { product: '×', sum: '+' }

const labelOf = (n: NodeLike | undefined, id: string): string => {
  const label = (n?.data as { label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.trim() !== '' ? label : id
}

export const IDENTITY_EVALUATED_TURN_KEY = 'identity_evaluated_node_ids'

/** The array from a parsed turn: top level first, then the additive sidecar (the option-participation pattern). */
export function identityEvaluatedFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as Record<string, unknown>)[IDENTITY_EVALUATED_TURN_KEY]
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return additive?.[IDENTITY_EVALUATED_TURN_KEY]
}

/** The read's raw value → a sorted id list, or null when it is not a list of ids. */
export function readIdentityEvaluated(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string' && id !== '')) return null
  return [...new Set(raw as string[])].sort()
}

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

/** Edge id → its exact words, for every operand link into an evaluated identity. */
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

/**
 * The evaluated set, keyed by the report hash of the read that carried it. A store of its own (not the report) because
 * the read applier skips rewriting a report it already displays, which would drop the set on exactly the re-read that
 * brings it.
 */
interface HeldIdentityEvaluated { readonly responseHash: string | null; readonly ids: readonly string[] }
export const useIdentityEvaluatedStore = create<{ held: HeldIdentityEvaluated }>(() => ({
  held: { responseHash: null, ids: [] },
}))

/** Called by the read applier with the report hash its block maps to. Absent or malformed = no exact links. */
export function recordIdentityEvaluated(responseHash: string | null | undefined, raw: unknown): void {
  const ids = readIdentityEvaluated(raw)
  useIdentityEvaluatedStore.setState({
    held: typeof responseHash === 'string' && ids !== null ? { responseHash, ids } : { responseHash: null, ids: [] },
  })
}

type State = ReturnType<typeof useCanvasStore.getState>
const EMPTY: ReadonlyMap<string, string> = new Map()
let memo: { nodes: unknown; edges: unknown; held: unknown; out: ReadonlyMap<string, string> } | null = null

export function selectIdentityExactLinks(s: State, held: HeldIdentityEvaluated): ReadonlyMap<string, string> {
  const hash = (s.results?.report as { model_card?: { response_hash?: unknown } } | null | undefined)?.model_card?.response_hash
  if (held.ids.length === 0 || typeof hash !== 'string' || hash !== held.responseHash) return EMPTY
  if (!Array.isArray(s.nodes) || !Array.isArray(s.edges) || !selectRunAffirmedCurrent(s)) return EMPTY
  if (memo && memo.nodes === s.nodes && memo.edges === s.edges && memo.held === held) return memo.out
  const out = identityExactLinks(s.nodes as NodeLike[], s.edges as EdgeLike[], held.ids)
  memo = { nodes: s.nodes, edges: s.edges, held, out }
  return out
}

/** The exact words for one link, or null. */
export function useIdentityExactWords(edgeId: string): string | null {
  const held = useIdentityEvaluatedStore((s) => s.held)
  return useCanvasStore((s) => selectIdentityExactLinks(s, held).get(edgeId) ?? null)
}
