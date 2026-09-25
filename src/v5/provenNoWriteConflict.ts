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
 *   · `stale_base_graph_hash` — `system-events/dispatch.ts`, the
 *     `option_intervention_edit` arm's `outcome.reason === 'stale_graph'`
 *     branch (CEE `99b80680`, served). It returns `commitPerformed: false,
 *     graph: null` and reads the CURRENT persisted hash purely to hand back a
 *     followable recovery — the refusal path is taken BEFORE any write, the
 *     same shape of guarantee as `BASE_HASH_DIVERGED`.
 *
 *     ⚠ IT IS A SECOND SPELLING OF `BASE_HASH_DIVERGED`, AND THAT IS A CEE
 *     FINDING, NOT A UI ONE. Two arms of one service name one concept twice —
 *     the differently-drifting-twins defect, one level up from the one this
 *     module exists to prevent. Both are carried here rather than one being
 *     silently mapped onto the other, because a consumer inventing a
 *     translation is how a name divergence stops being visible to anyone.
 *     Swept at CEE `origin/staging` `3ff6c8db` with a contrast control
 *     (`BASE_HASH_DIVERGED`, 5+ files, PRESENT): `stale_base_graph_hash` has
 *     exactly TWO occurrences, that arm and its own test — so no other writer
 *     can receive it and this addition changes no existing consumer's
 *     behaviour.
 *
 *   · `turn_fence_superseded` — CEE #1868 (`013fae8d`, served `92b1bf8`),
 *     `system-events/dispatch.ts`, the `factor_value_edit` arm. A
 *     `TurnFenceRejectedError` with verdict `superseded` returns 409
 *     `GRAPH_DIVERGED`, `retryable: false`, `commitPerformed: false`, and the
 *     arm states the guarantee: *"The turn fence refused the write inside the
 *     append transaction, so nothing of this edit landed."* The error's only
 *     throw site, `session/supabase-store.ts:1185-1208`, logs *"Nothing was
 *     written; the turn row rolled back with it"* and, on the atomic channel,
 *     *"The fence check ran INSIDE the append transaction
 *     (append_turn_atomic_v4); the whole turn rolled back."*
 *   · `turn_fence_stopped`    — the same arm, the same 409, the same stated
 *     guarantee, for verdict `stopped`.
 *
 *     ⛔ `turn_fence_unclaimed` AND `turn_fence_unavailable` ARE NOT MEMBERS,
 *     though they share the prefix. #1868 deliberately keeps them the retryable
 *     500 on that arm — infrastructure refusals, "until their code is decided"
 *     — so the producer makes no no-write statement for them on the edit path.
 *     Membership is by exact name, never by prefix.
 *
 *     ⚠ THE COPY IS NOT THE PROVEN-NO-WRITE COPY. Every writer's revert notice
 *     for the first three members says the saved model changed under the user,
 *     which is false for a turn the user STOPPED. A reverting writer asks
 *     `fenceRefusalCopyForCategory` (`v5/failureTypeRetryability.ts`) first and
 *     shows the fence's own per-verdict sentence when it answers.
 *
 * All of them arrive identically: `system-events/dispatch.ts:1176-1197` copies
 * `err.conflict_category` onto `graphConflict`, and `orchestrator/route-v2.ts`
 * sends it as a 409 `GRAPH_DIVERGED` with the category in
 * `details.conflict_category` and `retryable: false`. The UI reads exactly that
 * field via `extractConflictCategory`.
 *
 * ⚠ THIS IS A CLOSED SET AND MUST STAY ONE. A category absent from it — the
 * two infrastructure fence verdicts, the untyped 500 a contended commit
 * actually returns, or any future category — is an UNKNOWN, and an unknown
 * takes the cannot-confirm line. Add a member only with the producer line that
 * states the guarantee, and pin its opposite-direction twin: widening a set is
 * safe only if the OUTSIDE of the set is pinned too.
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
  'stale_base_graph_hash',
  'turn_fence_superseded',
  'turn_fence_stopped',
])

/**
 * Is this `details.conflict_category` one the producer guarantees wrote
 * nothing? Fail CLOSED: absent, empty, or unknown → false, i.e. no revert.
 */
export function isProvenNoWriteConflict(category: string | undefined | null): boolean {
  return typeof category === 'string' && PROVEN_NO_WRITE_CONFLICT_CATEGORIES.has(category)
}

/**
 * ⭐ THE SAME QUESTION, STATED ON A SECOND FIELD — `details.reason`.
 *
 * A conflict category is not the producer's only way of saying "nothing was
 * written". CEE also refuses a request that can never be honoured — an option
 * and factor that are not linked, a stored target it cannot read, a value off
 * the model scale — and for that class it states the no-write in the envelope's
 * `details.reason`, not in a conflict category. Before this set the UI read
 * only the category, so that refusal arrived as an UNKNOWN and every surface
 * said "could not confirm" about a request the server had told us it declined
 * without writing (witnessed on served UI `a4434670`, 24 Sep 2026: 422 on two
 * option-target rows of the CDP starter).
 *
 * ⚠ DERIVED FROM THE PRODUCER, ONE ENTRY PER STATED GUARANTEE (CEE
 * `3f412be11ae68c06ad4955a56f0cf4e9821e5946`, the served build):
 *
 *   · `system_event_refused_no_write` — `orchestrator/route-v2.ts:3516-3530`
 *     emits it ONLY for `commitSkippedReason === 'refused_no_write'`, as a 422
 *     `INGRESS_CONTRACT_VIOLATION` with `retryable: false`. That skip reason is
 *     defined at `system-events/dispatch.ts:97` in terms: *"a gate declined and
 *     NOTHING was written"*, and `:108-110` refuses to mint a skip reason for
 *     "unverified" precisely so this one can never mean "we do not know". Its
 *     one assignment is `dispatch.ts:2265`, the `option_intervention_edit` arm's
 *     non-stale refusal.
 *
 * ⛔ THE OUTSIDE OF THE SET STAYS PINNED. `system_event_commit_failed` is the
 * retryable 500 a writer that could NOT confirm its commit returns — the exact
 * opposite guarantee, sent on the same envelope shape — and it must stay out.
 * The same rules as the category set apply: closed, exact, fail CLOSED, and a
 * member is added only with the producer line that states the guarantee.
 */
export const PROVEN_NO_WRITE_REASONS: ReadonlySet<string> = new Set([
  'system_event_refused_no_write',
])

/**
 * Is this `details.reason` one the producer guarantees wrote nothing? Fail
 * CLOSED: absent, empty, or unknown → false.
 */
export function isProvenNoWriteReason(reason: string | undefined | null): boolean {
  return typeof reason === 'string' && PROVEN_NO_WRITE_REASONS.has(reason)
}
