# Canonical transactional receipt consumer — schemas 0.43 handover

**Component boundary:** UI reader/consumer only, based on deployed UI
`51175c8bfe0138b8dd3f38f47013650c0831dde5`. The backend producer is not
enabled or changed here.

## Authority and settlement

1. CEE owns the committed graph and returns its schema-0.43
   `CanonicalCommittedGraphReceipt` in `draft_graph`.
2. The receipt schema and nested projection manifest own the five hash carriers
   and their field vocabulary: nodes, edges, options, goal identity, and goal
   constraints.
3. The edge-strength transaction coordinator accepts only the strict receipt,
   reconciles the complete analytical projection, and proves local equality for
   all five carriers before settling readiness, freshness, or Run.
4. Readiness #983 remains the sole whole-model status authority. A valid receipt
   may settle to `needs_encoding`, `needs_user_mapping`, `needs_user_input`, or
   `blocked`; those states reconcile truthfully and keep Run closed. Receipt
   validity never implies `ready`.
5. Run inputs come from the latest settled receipt only while that receipt is
   still exactly equal to the live canvas and Run-bearing store.

Malformed, partial, legacy, or locally mismatched receipts fail closed: the
previous readiness/freshness bytes remain unchanged and transactional Run stays
held with recovery available.

## Legacy disposition

- **KEEP:** legacy/partial response readability and the existing generic graph
  reconciler for non-transactional writers.
- **REPLACE:** the provisional copied serving-SHA/manual field vocabulary with
  the published schema-0.43 manifest and strict receipt.
- **REMOVE:** all reads/authority use of
  `canonical_graph_hash_analysis_state`; an incoming copy is deleted one-way
  before state storage.
- **QUARANTINE:** generic factor-writer settlement remains outside this bounded
  edge transaction. If it does not supply a new full receipt, its write may
  drain but Run remains held. Extending canonical receipt production to that
  writer is a separate producer/consumer component.

## Frozen-boundary gates

- Transactional/hydration matrix: 10 files, 203 tests passed.
- Request/readiness contracts: 3 files, 147 tests passed.
- Typecheck ratchet: passed (3,437/3,477 tracked files; 2,332 diagnostics,
  within the 2,381 baseline, none added).
- Changed-file lint: zero errors (pre-existing/rebased warnings remain).
- Schema version guard, vendored-package checksum, and diff check: passed.
- Production CI build, PLC assertion, and bundle budget: passed (46.86 KB gzip
  against the 50 KB budget).

The exact local freeze commit/tree is reported with the review handoff; no
branch publication, merge, or deployment is part of this component.
