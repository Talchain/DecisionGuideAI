/**
 * ⭐ THE SINGLE AUTHORITY FOR "WHAT SELECTION IS THIS TURN CARRYING?"
 *
 * WHY THIS MODULE EXISTS AT ALL — and the reason is the estate's dominant
 * defect, not tidiness. Two consumers now need this answer:
 *
 *   1. `buildPayload.ts`, which puts `selected_elements` on the wire.
 *   2. the composer's selection chip, which TELLS THE USER their selection is
 *      attached.
 *
 * If the chip computed its own answer, it would be a hand-maintained mirror of
 * the wire rule — and every withholding branch below (a stale id, a kindless
 * node, an over-cap selection) is a case where the chip would claim an
 * attachment the payload does not make. A chip that says "Asking about X" while
 * the wire withholds X is a lie of exactly the class this product exists not to
 * tell. So the visible claim and the wire payload are ONE derivation, and the
 * chip renders what the wire will actually send.
 *
 * The function is PURE and takes the state slice explicitly, so the wire path
 * can call it with `useCanvasStore.getState()` on the send leg while the chip
 * subscribes reactively — same code, two call styles, no drift possible.
 *
 * ⚠ THE WITHHOLDING RULES ARE LOAD-BEARING AND ARE NOT DEFAULTS. Each returns
 * ABSENCE rather than a guess, because CEE grounds its answer in this field:
 *
 *   · nothing selected;
 *   · a selected id with no matching node — a stale selection over a deleted
 *     node. `kind` is REQUIRED by the contract and there is nothing truthful to
 *     put in it, so the ref is dropped rather than invented;
 *   · a node carrying no `type` — same reason, no fabricated kind;
 *   · an edge whose opaque React Flow id no longer resolves to an exact live
 *     edge. The wire identity for a relationship is its existing canonical
 *     endpoint composite (`from→to`), never the UI-local edge id and never a
 *     neighbouring/fuzzy substitute;
 *   · a selection LARGER than the contract cap. Sending 20 of 34 would be a
 *     false statement about what the user selected, and CEE would ground an
 *     answer in a selection that never existed. Absence says nothing; a silent
 *     truncation says something wrong.
 *
 * Order is the STORE'S NODE ORDER followed by STORE EDGE ORDER, not either
 * selection Set's iteration order, so the result is a pure function of the
 * selected SETS.
 */

/**
 * The contract's cap on `selected_elements`.
 *
 * Deliberately a literal rather than a read of the published constant: the
 * contract does not export one, and inferring it from a schema internal would
 * drift silently between minor versions — a wrong read there would drop
 * selection on every turn. The drift is closed on the TEST side instead
 * (`selectionCarriage.spec.ts` asserts this equals the contract's own max), so
 * a bump REDs rather than silently mis-sizing. Too HIGH sends an over-long
 * array and 422s the turn; too LOW silently withholds selection on large
 * selections. Both are visible to the guard before they are visible to a user.
 */
export const MAX_SELECTED_ELEMENTS = 20

/** One element the turn is about, in the contract's published V5 ref shape. */
export interface SelectedElementRef {
  readonly id: string
  readonly kind: string
  readonly label?: string
}

/**
 * The structural slice this derivation reads. Typed here rather than as the
 * full store so the rule is testable without constructing one, and so a store
 * refactor cannot silently widen what this function depends on.
 */
export interface SelectionSourceState {
  readonly selection?: {
    readonly nodeIds?: ReadonlySet<string>
    readonly edgeIds?: ReadonlySet<string>
  }
  readonly nodes?: ReadonlyArray<{
    readonly id: string
    readonly type?: unknown
    readonly data?: unknown
  }>
  readonly edges?: ReadonlyArray<{
    readonly id: string
    readonly source?: unknown
    readonly target?: unknown
  }>
}

/**
 * Derive the refs this turn will carry, or `undefined` when the client has
 * nothing truthful to say. `undefined` means the key is ABSENT on the wire and
 * the chip renders nothing — the two are the same statement.
 */
export function deriveSelectedElementRefs(
  state: SelectionSourceState | null | undefined,
): SelectedElementRef[] | undefined {
  // Defensive read: a selection-less store (an early boot, a test that stubbed
  // the store) must degrade to "no selection", never throw on the send path.
  const selectedNodeIds = state?.selection?.nodeIds
  const selectedEdgeIds = state?.selection?.edgeIds
  const selectedNodeCount = selectedNodeIds?.size ?? 0
  const selectedEdgeCount = selectedEdgeIds?.size ?? 0
  if (selectedNodeCount + selectedEdgeCount === 0) return undefined
  if (selectedNodeCount + selectedEdgeCount > MAX_SELECTED_ELEMENTS) return undefined

  const refs: SelectedElementRef[] = []
  for (const node of state?.nodes ?? []) {
    if (!selectedNodeIds?.has(node.id)) continue
    const kind = typeof node.type === 'string' ? node.type.trim() : ''
    if (kind.length === 0) continue
    const rawLabel = (node.data as { label?: unknown } | undefined)?.label
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
    // `label` is optional on the contract and `.min(1)` when present — omit it
    // rather than send an empty string, which would 422 the whole turn.
    refs.push(label.length > 0 ? { id: node.id, kind, label } : { id: node.id, kind })
  }

  // UI-SEM-094: React Flow edge ids are producer-local UI identity, while the
  // existing CEE relationship-address grammar is the exact endpoint composite.
  // Resolve ONLY the selected id against the live edge collection, then convert
  // that same edge's endpoints. A stale id or unencodable endpoint fails closed
  // by omission; no array-head, neighbouring-edge, label, or fuzzy fallback.
  for (const edge of state?.edges ?? []) {
    if (!selectedEdgeIds?.has(edge.id)) continue
    const source = typeof edge.source === 'string' ? edge.source.trim() : ''
    const target = typeof edge.target === 'string' ? edge.target.trim() : ''
    if (
      source.length === 0 ||
      target.length === 0 ||
      source.includes('→') ||
      source.includes('->') ||
      target.includes('→') ||
      target.includes('->')
    ) {
      continue
    }
    refs.push({ id: `${source}→${target}`, kind: 'edge' })
  }

  return refs.length > 0 ? refs : undefined
}

/**
 * ⭐ TWO QUESTIONS UNDER ONE `undefined`, NAMED APART (trap 21).
 *
 * `deriveSelectedElementRefs` returns `undefined` for reasons that are the same
 * to the WIRE and completely different to the USER:
 *
 *   · nothing is selected — the turn carries no selection and the composer
 *     should say nothing. Silence is the truth.
 *   · a selection exists but is WITHHELD — over the contract cap, or resolving
 *     to nothing truthful. Here silence is a false statement by omission: the
 *     user has selected something, believes it is attached, and it is not.
 *
 * The wire is right to treat these identically — absence is absence. The
 * composer is not, which is why this describes rather than re-derives: it CALLS
 * the wire function so the carried case can never disagree with what is sent,
 * and only interprets the absence.
 */
export type SelectionCarriage =
  | { readonly kind: 'none' }
  | { readonly kind: 'carried'; readonly refs: readonly SelectedElementRef[] }
  | { readonly kind: 'withheld_over_cap'; readonly selectedCount: number; readonly cap: number }
  | { readonly kind: 'withheld_unresolvable'; readonly selectedCount: number }

export function describeSelectionCarriage(
  state: SelectionSourceState | null | undefined,
): SelectionCarriage {
  const selectedCount =
    (state?.selection?.nodeIds?.size ?? 0) + (state?.selection?.edgeIds?.size ?? 0)
  if (selectedCount === 0) return { kind: 'none' }

  // The wire's own answer, never a second opinion about it.
  const refs = deriveSelectedElementRefs(state)
  if (refs !== undefined) return { kind: 'carried', refs }

  if (selectedCount > MAX_SELECTED_ELEMENTS) {
    return { kind: 'withheld_over_cap', selectedCount, cap: MAX_SELECTED_ELEMENTS }
  }
  // Selected, under the cap, and still nothing truthful to send: every ref was
  // dropped as stale or kindless. The user is pointing at something the model
  // no longer holds.
  return { kind: 'withheld_unresolvable', selectedCount }
}
