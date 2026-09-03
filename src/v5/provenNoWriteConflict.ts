/**
 * "DID THE SERVER PROVE IT WROTE NOTHING?" — asked once, for every optimistic
 * write.
 *
 * An optimistic writer shows the user a value before the server has accepted
 * it. When the turn fails, exactly one question decides what the product may
 * do next, and it is a question about CEE's ENVELOPE, not about the writer:
 *
 *   · The server STATES it wrote nothing  → REVERT. The canvas is showing a
 *     number the model never took, and leaving it is the product lying about
 *     its own state.
 *   · Anything else                       → KEEP, and say we could not
 *     confirm. We hold no committed bytes, so we know neither that the write
 *     landed nor that it did not — and reverting on a guess is DATA LOSS,
 *     which is strictly worse than the lie it would be trying to prevent.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT A CONSTANT IN EACH WRITER. It was one:
 * `structural_delete` carried this set privately, and `factor_value_edit`
 * carried nothing at all. Two writers answering one question in two places is
 * the differently-drifting-twins defect this estate pays for most often — the
 * next category added to CEE would have landed in one copy and not the other,
 * and the writer left behind would have gone on asserting a state the server
 * declined, silently and with a fully green suite. There is now ONE Set object
 * and both writers hold a reference to it, so a drift is not expressible.
 *
 * ⚠ DERIVED FROM THE PRODUCER, ONE ENTRY PER STATED GUARANTEE (CEE
 * `293da078`) — never from what a category NAME suggests:
 *
 *   · `BASE_HASH_DIVERGED` — `system-events/structural-delete.ts:475-484`.
 *     The stale gate refuses before any target is resolved; the refusal path
 *     writes no graph and no turn row.
 *   · `rpc_cas_conflict`   — `session/supabase-store.ts:309-318` (v3) and
 *     `:1070-1079` (v4). The atomic in-transaction CAS raises SQLSTATE OLGC1
 *     and the store throws `GraphStaleWriteError`, whose message is the
 *     guarantee: *"Atomic in-transaction CAS: the whole turn rolled back,
 *     nothing clobbered."*
 *
 * Both arrive identically: `system-events/dispatch.ts:1176-1197` copies
 * `err.conflict_category` onto `graphConflict`, and `orchestrator/route-v2.ts`
 * sends it as a 409 `GRAPH_DIVERGED` with the category in
 * `details.conflict_category` and `retryable: false`. The UI reads exactly that
 * field via `extractConflictCategory`.
 *
 * ⚠ THIS IS A CLOSED SET AND MUST STAY ONE. A category absent from it — a
 * turn-fence verdict, the untyped 500 a contended commit actually returns, or
 * any future category — is an UNKNOWN, and an unknown takes the cannot-confirm
 * line. Add a member only with the producer line that states the guarantee, and
 * pin its opposite-direction twin: widening a set is safe only if the OUTSIDE
 * of the set is pinned too.
 *
 * ⚠ AND MEMBERSHIP IS NOT DERIVABLE FROM `retryable: false` — do not be tempted.
 * Non-retryable means "re-sending cannot work"; it says nothing about whether
 * bytes landed. `INGRESS_CONTRACT_VIOLATION` and `TURN_BUDGET_EXCEEDED` are
 * both non-retryable and neither carries a no-write guarantee. The two
 * predicates answer different questions and must not be collapsed.
 */
export const PROVEN_NO_WRITE_CONFLICT_CATEGORIES: ReadonlySet<string> = new Set([
  'BASE_HASH_DIVERGED',
  'rpc_cas_conflict',
  // ── `edge_strength_edit` (0.42.0), CEE staging `f4c8f501` ────────────────
  // All three are raised by `applyEdgeStrengthEdit` BEFORE the canonical
  // handler is invoked and before `commitDirectAnswer` is reached, so no graph
  // and no turn row is written. Each is added with the producer line that
  // states the guarantee, per this module's own rule — never inferred from the
  // category NAME, and never from `retryable: false`.
  //
  //   · `edge_expected_tuple_mismatch` — `system-events/edge-strength-edit.ts:366-396`.
  //     The optimistic-concurrency gate: CEE compares `expected.mean` and
  //     `expected.effect_direction` against its persisted edge EXACTLY (no
  //     tolerance) and returns before any mutation.
  //   · `edge_target_not_found` — `edge-strength-edit.ts:335-342`. The
  //     canonical `(from, to)` resolves to ZERO edges in the persisted graph.
  //   · `edge_target_ambiguous` — `edge-strength-edit.ts:343-359`. The pair
  //     resolves to MORE THAN ONE edge; refusing is the only safe move, since
  //     writing would mutate an edge the user never selected.
  //
  // ⚠ THE OPPOSITE DIRECTION IS PINNED TOO, because widening a set is only safe
  // if its OUTSIDE is pinned: the reader-only refusal
  // (`error_code: 'FEATURE_NOT_ENABLED'`, `reason: 'edge_strength_edit_reader_only'`)
  // is NOT a member and must never become one — it arrives as an HTTP **200**
  // with no `conflict_category` at all, so it never reaches this predicate.
  // See `canvas/mutations/edgeStrengthEdit.ts` for why that case is handled as
  // an unconfirmed outcome rather than a proven no-write.
  'edge_expected_tuple_mismatch',
  'edge_target_not_found',
  'edge_target_ambiguous',
])

/**
 * Is this `details.conflict_category` one the producer guarantees wrote
 * nothing? Fail CLOSED: absent, empty, or unknown → false, i.e. no revert.
 */
export function isProvenNoWriteConflict(category: string | undefined | null): boolean {
  return typeof category === 'string' && PROVEN_NO_WRITE_CONFLICT_CATEGORIES.has(category)
}
