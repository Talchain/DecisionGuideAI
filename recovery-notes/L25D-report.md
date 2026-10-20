DONE

S11 premium UI · target-authorship contract · local real-route rung. `cee_inference` now shows the existing “Olumi’s estimate” wording. No served or CI completion claim.

Files changed in L25D:
- `src/canvas/domain/goalTarget.ts`: map the target-specific `cee_inference` stamp to `olumi` in the existing resolver and its return type.
- `src/canvas/nodes/shared/valueSourceMark.tsx`: route that resolved source through the existing Olumi mark branch. Preserve L25C brief/user precedence and legacy inferred/proxy behavior.
- `src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx`: add two synthetic brief rows through `mapDraftNodeToCanvas → GoalNode → valueSourceMark`; exact node-bound DOM/aria label assertions.
- Evidence only: `recovery-notes/L25D-*`. Earlier L25/L25C notes and uncommitted work retained. No lease extension, writer, parser, quote inference, imports or live provider calls.

Rows and results:

| Row | L25C lane base | L25D |
| --- | --- | --- |
| Capacity: `cee_inference`, beside node-level brief quote/current-level stamp | RED: unknown | GREEN: Olumi’s estimate |
| Monthly orders: same declared target-source class | RED: unknown | GREEN: Olumi’s estimate |
| No target stamp + node quote (both briefs) | GREEN | GREEN: Source not recorded |
| `brief_extraction` target stamp (both briefs) | GREEN | GREEN: From your brief |
| User-stamped edit after brief, old quote retained | GREEN | GREEN: Set by you |
| Every other L25C negative/control | GREEN | GREEN |

Acceptance spec on the lane base: **2 failed / 24 passed**. Final: **26 passed / 0 failed**. Evidence: `L25D-base-red.log`, `L25D-GoalNode.targetSourceMark.paul23Sep.spec.tsx.log`.

HIGH mutant pair, each run separately on the real GoalNode route:
- Map `cee_inference` to `unrecorded`: killed, **2 failed / 24 passed**.
- Map `cee_inference` to `brief`: killed, **2 failed / 24 passed**.
- Restored correct source before final tests; `L25D-mutants.json` records both exits/counts.

Only the five L25C specs ran, sequentially, one file per process, with the specified Supabase test placeholders:

| Spec | Pass | Fail |
| --- | ---: | ---: |
| GoalNode.targetSourceMark.paul23Sep.spec.tsx | 26 | 0 |
| GoalNode.targetSourceMark.realMrrBoard.spec.tsx | 5 | 0 |
| goalTargetBriefSource.spec.ts | 7 | 0 |
| goalTargetSource.oneAuthority.spec.tsx | 8 | 0 |
| buildDecisionBrief.spec.ts | 17 | 0 |
| Total | 63 | 0 |

No whole suite or contract guards: the specific “only those specs” instruction overrides the generic preamble. Fetch throws if called in the synthetic route rows and is asserted unused.

Checks:
- ESLint on all three changed files: exit 0, zero lint errors.
- `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec tsc --noEmit -p tsconfig.json`: exit 0. This is a solution stub loading no files; the substantive check is below.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck`: exit 0, coverage + per-file ratchet PASSED. **0 errors in each changed file**, established by the passing ratchet with zero baseline allowances and no coverage exemptions for those files. Evidence: `L25D-typecheck-results.json`.
- Gate coverage: 6219/6259 tracked TS files; 40 declared out of scope. Repository diagnostics: 2021 across 511 files versus baseline 2055. Nine identity-drift notices concern untouched files; no baseline edited. CI Typecheck Drift remains the required DL gate and was not observed locally.
- `python3 ~/olumi-work/recovery/tools-dl/new-cycles.py /private/tmp/cx-l25 00a6045270f1817ae140eb25dbfcd5bc92cd5dc2`: head 2, base 2, **NEW/GROWN 0**. Tool scope: relative static imports in production `.ts` files.
- `git diff --check`: exit 0. No commit/push/merge/deployment. `pgrep` cannot enumerate processes in this sandbox; this builder ran typechecks sequentially. No machine-load check.

`tools-dl/pr-shape.sh` numbers (unchanged parser, actual local diffs supplied through a disposable `gh` adapter, no network):
- **L25D vs starting uncommitted L25C:** source **+6/−5 = +1**, two files; tests +5/−0, one file. Zero codes, regexes or exports. Parser counts one added if-line replacing an existing if-line: zero net if-branches; one additional literal comparison in the resolver and one added OR operand in the existing mark branch. The net source growth is documentation of the newly recognized source.
- **Uncommitted tree vs HEAD 0d2fbfe7f:** source +11/−12 = **−1**, tests +31/−3.
- **Whole PR vs 00a60452:** source +19/−31 = **−12**, tests +83/−1. The parser’s one export is an existing signature reflow; no net export added.
- Superseded: the default-to-unrecorded handling for an explicitly `cee_inference`-stamped target. L25C’s deleted node-quote authority remains deleted.

HIGH trace:
- Value/source: synthetic declared targets 100 tickets/week and 250 orders/month; producer stamps `cee_inference`, despite node-level brief provenance/quote/current-level source.
- Approval: no new approval/write exercised; retained user-stamped edit supplies `threshold_source: user` and `success_threshold: 150`.
- Persisted/readback: adapter/render replay of stamped wire-shaped records; this lane does not claim a fresh served readback.
- This Run: no scientific Run or provider call; existing resolver consumes the target-specific stamp.
- User saw: exact local “Olumi’s estimate” mark and accessible label; no-stamp, brief and editor controls retain their own words.
First boundary: `resolveGoalTarget` previously discarded the producer’s declared `cee_inference` authorship. The real route rows sit at that loss.

Product test: people can distinguish an Olumi-proposed target from their brief, an editor’s value and an unrecorded source, preserving human authorship and the provisional model.

Buddy (3 lines):
Correct: reads the producer’s target-specific declaration; all L25C protections retained; assumption is the producer contract supplied in this brief.
Simpler: reuse the existing resolver and mark branch; no new authority, parser or bespoke OpenAI replacement; AI declares authorship, host reads the literal.
Efficient: 0 provider calls, no added imports or I/O; SIMPLER-ALTERNATIVE: none within scope. DL-prescribed approach supplies the approach ACK; fresh PR review remains with DL.

Instruction note: current repository/global CLAUDE.md were read. Recovery/CLAUDE.md is absent; its available `CLAUDE.md.pre-streamline-20261012T2239Z` §4 was read, as in L25C. No credential section or path containing `sealed` read. Overnight plan read first, then current plan §4 and streamlined rules/lease. No shared cleanup; only this run’s disposable shape adapter directory was automatically removed. Disk space freed was not measured.

Exact commit message: `fix(canvas): credit declared CEE inference targets to Olumi`

- Progress: S11 target-source contract, local real-route GREEN; 63/0 tests, 2/2 mutants killed.
- Next 2 (highest-value? Y): DL commits/ships this tree; fresh review and served stamp-to-mark witness.
- Mistake: existing reader treated a known CEE inference stamp as unrecorded.
- Correction APPLIED: literal source mapping through the existing authority; no quote inference or weakened negatives.

Plan: L25D · Simplest approach? Y — reuse declared target source and existing Olumi mark · Net src lines: +1 R3 / −12 whole PR
