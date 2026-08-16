# Canonical transactional receipt consumer — schemas 0.43 handover

**Component boundary:** UI reader/consumer only, rebased onto deployed UI
`8e6f7629e556595cd1b653444b84718c3080cfd4` (#728 conditional-winners,
including the #726 Alt/V7 retirement immediately beneath it). The backend
producer is not enabled or changed here. The independently reviewed #726-based
candidate remains preserved locally at
`archive/ui-canonical-receipt-consumer-043-pre-rebase-8e6-7b1477b4`; the
original pre-#726 component remains at
`archive/ui-canonical-receipt-consumer-043-pre-rebase-dd354fed`.

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

- Original #726 conflict map: only `OutputsDock.tsx` and the two generated
  typecheck baselines conflicted. The accepted component plus its bounded
  coexistence repair and evidence commits then formed the independently
  reviewed 17-commit candidate at `7b1477b4c3af7fb87e93b6ca19ca40e9cdad6b2d`
  (tree `ea8a410de30792894b5546977946bcafc1f1c471`).
- Exact deployed-tip replay: remote staging and deployed `/version.json` both
  resolved to `8e6f7629e556595cd1b653444b84718c3080cfd4`. All 17 candidate commits
  initially replayed once with zero conflicts and `=` for every patch. After
  adding exact-tip evidence to this handover, final range-diff preserves all 16
  code/baseline patches as `=` and replaces only the documentation commit.
  #728's `mapV5AnalysisToReport.ts` and conditional-winners test retain the
  exact base blob ids; its focused 12/12 tests pass on the combined tree.
- #726 coexistence repair: one exhaustive `OutputTab` runtime normaliser is
  consumed by both mounted dock-state readers. A pre-#726 persisted
  `activeTab: "altview"` now paints and persists `results` on the first mounted
  render; the retired tab, icon, import and V7 body remain absent.
- Independently reviewed #726-base transactional/readiness/A2 coexistence
  matrix: 11 files, 214 tests passed. This includes the four strict receipt
  authorities, the dock/floating recovery topology, the settled AI-panel
  fixture, Alt/V7 retirement controls, and the complete-borders successor
  guard. Exact-tip range-diff preserves every tested code patch.
- Exact deployed-tip discriminators: 168/168 tests passed across seven focused
  files. These cover #728's 12 conditional-winners cases, strict receipt
  authority/resolution/lifecycle, transactional Run hold, the settled AI-panel
  fixture, and a stale persisted `altview` first-paint normalisation case.
- Exact-tip full typecheck passes at 3,407 of 3,447 tracked TypeScript files and
  2,332 baseline diagnostics, with none added. The baseline was regenerated
  earlier only through `scripts/ci/typecheck-gate.sh --update-baseline`.
- Exact-tip full lint passes with zero errors (1,202 pre-existing warnings); the
  rules-of-hooks ratchet exactly matches 231 known violations across 14 files.
- Schema version guard, vendored-package checksum, and diff check: passed.
- Production CI build, PLC assertion, and bundle budget: passed (46.85 KB gzip
  against the 50 KB budget).
- Graph-recovery FIX-FIRST matrix: 67/67 focused tests passed, covering
  ready-to-needs-encoding and blocked-to-ready graph-read mutants, byte-identical
  readiness/freshness through both Check and Restore, and late hydration after a
  newer settled writer. The authorized inspector discriminator also proves a
  strict five-carrier success receipt opens Run while a legacy-partial receipt
  remains held (71/71 combined affected tests).
- Exact-tip production build passed (3,830 modules; largest `index` chunk
  47.98 kB gzip, within the recorded 50 kB budget).
- The local gate runner emitted non-blocking environment warnings because it
  used Node 22.16.0 while the repository declares Node 20 and had no
  `NODE_AUTH_TOKEN` for private-registry interpolation.

The exact local freeze commit/tree is reported with the review handoff; no
branch publication, merge, or deployment is part of this component.
