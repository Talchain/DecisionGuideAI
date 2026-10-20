BLOCKED

The CEE writer omits the target stamp. The local R2 correction is complete, but the captured capacity target cannot honestly show “From your brief” until CEE carries its own `threshold_source`. No CEE or editor-writer files changed.

S11 premium UI · target-authorship contract · local real-route rung only; no served completion claim.

Files changed:
- `src/canvas/nodes/shared/valueSourceMark.tsx`: remove node-provenance + quote inference; use `resolveGoalTarget`'s existing target-source authority. User, brief, Olumi and unknown labels remain distinct.
- `src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx`: retain existing negatives and exact source assertions; positive brief fixtures now explicitly carry the target stamp required by this brief. Add both reviewer probes, user-stamped edit and two unstamped-quote negatives.
- New evidence only: `recovery-notes/L25C-{approach.md,live-shape.json,mutants.py,mutants.json,specs.json,results.json,typecheck-results.json,report.md}` and ignored `L25C-*.log` files. Existing `L25-*` notes were present at start and remain untouched.

Authority and blocker:
- `src/canvas/domain/goalTarget.ts:167–197`: `threshold_source: brief_extraction` attests the brief target; `threshold_source: user` + `success_threshold` attests a user edit. This is the authority protected by `goalTargetSource.oneAuthority`.
- Captured read: `/Users/paulslee/olumi-work/recovery/live/runs/2026-10-20T090411Z-capacity-full-core-c471b121-00a60452/capacity/reads/01-02-range.json:224–313`. Node `weekly_support_capacity` has raw target 100, unit tickets per week, node `from_brief` and a quote; NO `threshold_source` or `success_threshold`. It also contains target-scoped `user_statements`; these are not the target-source stamp consumed by the existing resolver. Evidence: `L25C-live-shape.json`.
- CEE source inspected in `/private/tmp/cx-l1/src/orchestrator-v5/path-b/tools/candidate-to-graph.ts:293–299`: the `goalNumbers` filter and `goalNode` writer omit `threshold_source` while carrying threshold numbers and the node quote. Smallest unblock: the CEE owner carries the existing target-specific source stamp alongside the declared target. Do not infer it from node provenance in the UI.
- The reviewer’s actual unstamped edit path (`src/canvas/ui/inspector-v2/useInspectorMutations.ts:720–730`) changes raw/unit only. Its honest attribution is unknown. “Set by you” is proven when the existing edit stamp is supplied; this lane does not claim to repair that unstamped writer.

Rows (adapter → GoalNode → mark, node-id-bound exact DOM/aria assertions):

| Row | R2 base 0d2fbfe7 | Final |
| --- | --- | --- |
| Today-level quote beside unknown target | RED: brief | GREEN: Source not recorded |
| Unstamped edit 100→150, old quote retained | RED: brief | GREEN: Source not recorded |
| Capacity + monthly-orders node quotes without target stamp | RED: brief, 2 rows | GREEN: Source not recorded |
| Target-specific brief stamp, both synthetic briefs | GREEN | GREEN: From your brief |
| User-stamped edit to 150 over old brief quote | GREEN | GREEN: Set by you |
| Existing inferred/proxy, unknown, stale stamp, neighbour and no-target negatives | GREEN | GREEN |
| Actual captured capacity target → From your brief | BLOCKED: no stamp | BLOCKED: CEE writer required |

Final acceptance spec on base: **4 failed / 20 passed**. Final restored reader: **24 passed / 0 failed**. Both reviewer probes are reproduced exactly in substance; no expectation was weakened. No live provider calls; fetch throws if called in the replay rows and is asserted unused.

Named R1 specs only, sequential, one file per process, Supabase test placeholders:

| Spec | Passed | Failed |
| --- | ---: | ---: |
| GoalNode.targetSourceMark.paul23Sep.spec.tsx | 24 | 0 |
| GoalNode.targetSourceMark.realMrrBoard.spec.tsx | 5 | 0 |
| goalTargetBriefSource.spec.ts | 7 | 0 |
| goalTargetSource.oneAuthority.spec.tsx | 8 | 0 |
| buildDecisionBrief.spec.ts | 17 | 0 |

**61 passed / 0 failed.** No broad guard suite or unrelated specs run, per the lane’s “only those” override. Final goal route rerun after restoring every mutant: 24/0.

HIGH mutant pairs, all killed (failed/passed):
- Brief: omit target brief mapping **5/19**; restore node-based overcredit **7/17**.
- Editor: omit user mapping **2/22**; miscredit brief to editor **5/19**.
- Unknown: miscredit to Olumi **13/11**; miscredit to brief **13/11**.
- Preserved Olumi distinction: omit mapping **2/22**; miscredit to brief **2/22**.

Checks:
- ESLint on both changed TS/TSX files: exit 0, no lint errors.
- `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec tsc --noEmit -p tsconfig.json`: exit 0. This solution stub loads no files; substantive verification is the next command.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck`: exit 0, coverage + ratchet PASSED. **0 errors in each changed file**; neither has a baseline allowance. Gate coverage: 6219/6259 tracked files loaded, 40 declared out of scope. Repo diagnostics: 2021 across 511 files, baseline 2055; nine identity-drift notices concern untouched files and were not investigated in this lane. CI Typecheck Drift remains the required gate, not witnessed here.
- `python3 ~/olumi-work/recovery/tools-dl/new-cycles.py /private/tmp/cx-l25 00a60452`: head/base 2 cycles, NEW/GROWN 0. No imports changed.
- `git diff --check`: exit 0. No commit, push, merge or deployment.
- `pgrep` could not obtain the process list (sysmond unavailable). This builder ran one typecheck at a time, after tests; no machine-wide concurrency claim. No load check attempted, per DL instruction.

Shape from the unchanged `tools-dl/pr-shape.sh` parser, fed the actual local source/test diff through a disposable local gh adapter (no remote/network):
- **R2 vs 0d2fbfe7:** source +5/−7 = **−2**, one file; tests +26/−3, one file. Parser: 0 codes, 0 regex, 0 exports, 1 added if-line (replaces the existing compound if; zero net branches).
- **Whole PR vs 00a60452:** source +14/−27 = **−13**; tests +78/−1. Parser’s 1 export is the existing function signature reflow; zero net exports. Retires the node+quote brief-authority path. No lease extension.

HIGH trace: value/source = supplied target 100 in tickets/week, user’s quoted goal; approval = no new approval or write exercised; persisted readback = captured target lacks `threshold_source`; this run = local adapter/render replay, no analysis Run; user saw = exact local source label, with stamped fixtures distinct from the captured unstamped target. First loss = CEE target writer omits its source stamp. Product test: people can distinguish their own target, an Olumi estimate and an unrecorded source without manufacturing authorship.

Buddy (3 lines):
Correct locally: existing target authority only; captured capacity remains explicitly BLOCKED. Assumption: only the resolver’s existing stamp licenses brief/editor attribution.
Simpler: delete the quote inference; no new authority, parser, store, SDK replacement or schema. AI/producer declares source; host does not interpret quote meaning.
Efficient: 0 provider calls, no added imports/latency; existing one-reader contract reused. SIMPLER-ALTERNATIVE: none within this lane.

Instruction note: requested recovery/CLAUDE.md is absent; repository/global CLAUDE.md were read, and §4 was read from the available `CLAUDE.md.pre-streamline-20261012T2239Z`. Current user instructions govern. Disposable local shape-adapter files removed by their temporary-directory owner; under 1 KB of script content, no measured disk-space claim. No shared files deleted.

Exact commit message: `fix(canvas): use target stamps for goal attribution`

- Progress: S11 target-authorship contract, local route GREEN; 61 rows and 8/8 mutants; served capacity BLOCKED.
- Next 2 (highest-value? Y): CEE owner carries the target stamp; DL ships and obtains fresh review/served witness.
- Mistake: prior reader treated a node quote as target-specific authority.
- Correction APPLIED: delete that inference; exact reviewer negatives and target-stamped controls now pass.

Plan: L25C · Simplest approach? Y — delete inference, reuse target authority · Net src lines: −2 R2 / −13 whole PR
