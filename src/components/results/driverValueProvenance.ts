/**
 * ⭐⭐ WHO AUTHORED THIS FACTOR'S VALUE — THE ONE ANSWER, FOR EVERY SURFACE.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
 * The question had TWO implementations. `analysis-hero/buildHeroModel.ts` drove
 * the `est.` tag from one; `analysisNew/buildAnalysisNewViewModel.ts` drove the
 * glance's condition line from a declared copy of it, header and ordering
 * intact. A declared copy is still a copy: it can only ever be checked for
 * AGREEMENT, never for correctness, and keeping two in lockstep is the
 * hand-maintained mirror this estate pays for repeatedly (CLAUDE.md trap 12).
 * Both surfaces now import this. There is no second answer left to drift from.
 *
 * ── WHY IT READS THE NODE AND NOT THE FACTOR ROW ────────────────────────────
 * ⚠⚠ THE PREVIOUS DERIVATION ASKED THE WRONG FIELD, AND IT WAS MEASURABLY
 * WRONG. It read `isDefaultedConfidence`, which is
 * `confidence_source ∈ {isl, isl_default, plot_unified_from_isl_bootstrap} &&
 * sampling_stability === 0` — an ISL BOOTSTRAP-DEGENERACY signal. That answers
 * "was the CONFIDENCE a placeholder", not "who put this VALUE here". On the
 * live capture `live-analysis-turn-T3-20260808T155759Z`, `fac_switch_cost`
 * carries `value_source: 'brief_extraction'` — a number lifted from the user's
 * own brief — together with `sampling_stability: 0`, so the degeneracy signal
 * fired and the product tagged the user's own figure as Olumi's estimate.
 *
 * The authority is the NODE's `observed_state.source`, which is the field whose
 * closed vocabulary actually answers authorship (`canvas/domain/valueProvenance
 * .ts`). `isDefaultedConfidence` is gone from this path entirely.
 *
 * ── THE MAP, AND WHY `brief` IS NOT USER-OWNED ──────────────────────────────
 *   · `userOwned` (confirmed / edited / assumption / human) → `not_estimated`.
 *     A person vouched for the number; claiming it as Olumi's is the untruth.
 *   · `brief` (`brief_extraction`, `explicit`) → `undetermined`. Extraction
 *     FROM the user's brief is not the same act as the user stating a figure,
 *     and `USER_OWNED_KINDS` deliberately excludes it. Pending a founder
 *     ruling, the surface says nothing rather than picking a side — and saying
 *     nothing is available precisely because `undetermined` is a real state.
 *   · every other classified kind, `cee_inference` chief among them →
 *     `estimated`. This is Olumi's own number and the tag is correct.
 *   · no source, or a literal the classifier does not know → `undetermined`.
 *     `classifyValueProvenance` returns null rather than guessing, and a guess
 *     here is how "Estimated by Olumi" lands on a confirmed value.
 *
 * ⛔ NO THRESHOLD, NO INFERENCE FROM THE NUMBER ITSELF, AND NO COUNT. This
 * reads one closed-vocabulary string and nothing else.
 *
 * ⚠ AN UNKNOWN LITERAL IS A FINDING, NOT A PATCH SITE. `SOURCE_CLASSES` is
 * owned elsewhere and its completeness guard is the only thing that can see
 * contract drift; widening it here to silence a surprise would blind that
 * guard. Unknown literals route to `undetermined` and get reported.
 */

import { classifyValueProvenance, isAcceptedOlumiFigure } from '../../canvas/domain/valueProvenance'

/**
 * Three states, because the producer's answer is genuinely three-valued and the
 * third is the majority case. A boolean `isEstimate` cannot express "nobody
 * ever said", and collapsing silence into either answer authors a claim.
 */
export type DriverValueProvenance = 'estimated' | 'not_estimated' | 'undetermined'

/** The shape this module needs off a driver row: its join key to the graph. */
export interface DriverProvenanceKey {
  factorKey: string
  matchedNodeId?: string
  /**
   * The RUN's own `factor_sensitivity[].value_source` for this factor, when the
   * producer sent one (`DriverItem.valueSource`). R7 / X4: it is the authority for
   * what this run consumed, and it wins over the live node.
   */
  valueSource?: string
}

/**
 * One node's `observed_state.source`, or undefined.
 *
 * ⚠ IT READS BOTH SPELLINGS, AND READING ONE UNDER-COUNTS. The canvas stores
 * `observedState`; the CEE/PLoT wire uses `observed_state`; real graphs carry
 * both. Measured over this repo's JSON fixtures: 97 `observed_state` against 30
 * `observedState`. `factorNeedsVerification` and `factorHasConfirmableValue`
 * both take the same precaution, in the same order, for the same reason.
 *
 * ⚠ IT ALSO LOOKS UNDER `data`. A React Flow node keeps its payload on
 * `node.data`, while a wire node carries the field at top level; fixtures in
 * this repo hold both shapes.
 */
export function nodeValueSource(node: unknown): string | undefined {
  const n = node as Record<string, unknown> | undefined
  const inner = n?.data as Record<string, unknown> | undefined
  const obs = (n?.observedState ?? n?.observed_state ?? inner?.observedState ?? inner?.observed_state) as
    | Record<string, unknown>
    | undefined
  const source = obs?.source
  return typeof source === 'string' ? source : undefined
}

/**
 * Build the node-id → `observed_state.source` map the surfaces join against.
 *
 * Sparse BY CONSTRUCTION: a node with no source contributes no entry, so a
 * lookup miss and a sourceless node are the same answer — `undetermined` —
 * which is the honest reading of both.
 */
export function buildNodeValueSourceMap(
  nodes: ReadonlyArray<unknown> | null | undefined,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  for (const node of nodes ?? []) {
    const id = (node as { id?: unknown } | undefined)?.id
    if (typeof id !== 'string' || id.length === 0) continue
    const source = nodeValueSource(node)
    if (source !== undefined) out.set(id, source)
  }
  return out
}

/**
 * The node ids whose value is Olumi's figure the user ACCEPTED (`isAcceptedOlumiFigure`; 52f8cd). A source string
 * cannot carry that fact (`user_assumption` alone is the user's own declared guess), so the hooks build this beside
 * {@link buildNodeValueSourceMap} from the same `nodes` slice. Sparse, like the map.
 */
export function buildAcceptedNodeIds(nodes: ReadonlyArray<unknown> | null | undefined): ReadonlySet<string> {
  const out = new Set<string>()
  for (const node of nodes ?? []) {
    const n = node as { id?: unknown; data?: unknown } | undefined
    if (typeof n?.id !== 'string' || n.id.length === 0) continue
    if (isAcceptedOlumiFigure(n.data ?? n)) out.add(n.id)
  }
  return out
}

/**
 * Where one driver's VALUE came from.
 *
 * ⚠ THE JOIN KEY IS THE ONE THIS ESTATE ALREADY USES — `matchedNodeId ??
 * factorKey`, the same expression the drivers' `canFocus` target and the hero's
 * flip-risk pre-gate resolve with. Minting a second key would be a second
 * answer to "which node is this row about".
 *
 * ⚠ AND IT FAILS CLOSED. No map, no entry, or a literal the classifier does not
 * know all yield `undetermined` — never a default to either side.
 */
export function driverValueProvenance(
  driver: DriverProvenanceKey,
  nodeValueSources?: ReadonlyMap<string, string>,
  /** {@link buildAcceptedNodeIds}: Olumi's figure, ACCEPTED, is still Olumi's estimate — never "not estimated". */
  acceptedNodeIds?: ReadonlySet<string>,
): DriverValueProvenance {
  const key = driver.matchedNodeId ?? driver.factorKey
  // ⭐ R7 / X4: THE RUN'S OWN SOURCE FIRST. The live node answers "whose value is
  // on the canvas NOW"; a driver row describes a RUN, and a value edited after
  // that run changes the node without changing what the run consumed. The node
  // is read only when the run carried no `value_source` (older producers, saved
  // reports), the path every surface used before the V5 mapper carried it.
  const runSource =
    typeof driver.valueSource === 'string' && driver.valueSource.trim() !== '' ? driver.valueSource : undefined
  // ⭐ An accepted Olumi figure is an estimate, whatever the bare stamp says (52f8cd): only when the run consumed that
  // same stamp (or carried none), so a run that consumed the user's own later figure is never re-labelled.
  if (acceptedNodeIds?.has(key) === true && (runSource === undefined || runSource === 'user_assumption')) return 'estimated'
  const classified = classifyValueProvenance(runSource ?? nodeValueSources?.get(key))
  if (classified === null) return 'undetermined'
  if (classified.userOwned) return 'not_estimated'
  if (classified.kind === 'brief') return 'undetermined'
  return 'estimated'
}
