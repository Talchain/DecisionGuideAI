# Canonical transactional receipt consumer — schemas 0.43 handover

**Component boundary:** UI reader/consumer only, based on deployed UI
`ca8cb0c1eea98e32a57fc94026e733d3194be572`. The backend producer is not
enabled or changed here.

## Authority and settlement

1. CEE owns the committed graph and returns its schema-0.43
   `CanonicalCommittedGraphReceipt` in `draft_graph`.
2. The receipt schema and nested projection manifest own the five hash carriers
   and their field vocabulary: nodes, edges, options, goal identity, and goal
   constraints. One shared semantic boundary additionally requires explicit
   null goal identity if and only if the receipt contains no goal nodes; a
   non-null identity must name a goal node carried by that receipt.
3. The edge-strength transaction coordinator accepts only the strict receipt,
   reconciles the complete analytical projection, and proves local equality for
   all five carriers before settling readiness, freshness, or Run.
4. Readiness #983 remains the sole whole-model status authority. A valid receipt
   may settle to `needs_encoding`, `needs_user_mapping`, `needs_user_input`, or
   `blocked`; those states reconcile truthfully and keep Run closed. Receipt
   validity never implies `ready`.
5. Run inputs come from the latest settled receipt only while that receipt is
   still exactly equal to the live canvas and Run-bearing store.
6. The authenticated scenario-graph reader is graph authority only. “Check”
   and explicit “Restore” may reconcile or replace graph carriers, but cannot
   infer a current #983 verdict from persisted options/goal fields. They retain
   the prior readiness, freshness, and hash bytes and the exact
   `analysis_state_unverified` Run hold until a new transactional response
   supplies the receipt-bound `analysis_ready`. A late graph read also preserves
   a newer exact writer receipt instead of downgrading it.
7. When an explicit Check or Restore successfully reconciles one viable
   unconfirmed relationship, the coordinator replaces the stale rejected-value
   recovery with exactly one `confirm_current` CAS whose expected and target
   are both the reconciled shared tuple. The typed receipt hold remains while
   that no-op is in flight. A strict receipt clears it normally; a failed or
   malformed confirmation restores a retryable recovery containing only the
   shared tuple, never the rejected value.

Malformed, partial, legacy, or locally mismatched receipts fail closed: the
previous readiness/freshness bytes remain unchanged and transactional Run stays
held with recovery available. Under the deployed A2 first-use rail, only the
active canonical recovery affordance spends the rail override, so its promised
Olumi route opens while ordinary first-use fit and rail behaviour remain intact.

## Legacy disposition

- **KEEP:** legacy/partial response readability and the existing generic graph
  reconciler for non-transactional writers.
- **REPLACE:** the provisional copied serving-SHA/manual field vocabulary with
  the published schema-0.43 manifest and strict receipt.
- **REMOVE:** all reads/authority use of
  `canonical_graph_hash_analysis_state`; an incoming copy is deleted one-way
  before state storage. Also removed is graph-read reconstruction of Run-bearing
  readiness; persisted graph fields are not a substitute for current #983
  response authority.
- **QUARANTINE:** generic factor-writer settlement remains outside this bounded
  edge transaction. If it does not supply a new full receipt, its write may
  drain but Run remains held. Extending canonical receipt production to that
  writer is a separate producer/consumer component.

## Frozen-boundary gates

- Rebased transactional/readiness/A2 coexistence matrix: 21 files, 488 tests
  passed, including the three false goal-attestation boundary and lifecycle
  mutants.
- Typecheck ratchet: passed (3,439/3,479 tracked files; 2,332 diagnostics,
  within the 2,381 baseline, none added).
- Changed-file lint: zero errors (pre-existing/rebased warnings remain).
- Schema version guard, vendored-package checksum, and diff check: passed.
- Production CI build, PLC assertion, and bundle budget: passed (46.86 KB gzip
  against the 50 KB budget).
- Graph-recovery FIX-FIRST matrix: 67/67 focused tests passed, covering
  ready-to-needs-encoding and blocked-to-ready graph-read mutants, byte-identical
  readiness/freshness through both Check and Restore, and late hydration after a
  newer settled writer. The authorized inspector discriminator also proves a
  strict five-carrier success receipt opens Run while a legacy-partial receipt
  remains held (71/71 combined affected tests).
- Post-fix full typecheck passed with no new diagnostics; full lint passed with
  zero errors and an exact hooks ratchet; production build passed (3,847 modules).

The exact local freeze commit/tree is reported with the review handoff; no
branch publication, merge, or deployment is part of this component.
