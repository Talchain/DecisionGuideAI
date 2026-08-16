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
  before state storage.
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

The exact local freeze commit/tree is reported with the review handoff; no
branch publication, merge, or deployment is part of this component.
