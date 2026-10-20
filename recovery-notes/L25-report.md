DONE

S11 premium UI · authorship display contract · local real-route rung. A saved goal's `from_brief` plus nonblank target `source_quote` now renders “From your brief”. Explicit inferred/proxy targets render “Olumi’s estimate”; absent/unverified source renders “Source not recorded”. Existing target-specific user/brief stamps retain precedence. No new label vocabulary or border changes.

Files changed:
- `src/canvas/nodes/shared/valueSourceMark.tsx` — ONLY production reader changed, `goalTargetSourceMark`.
- `src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx` — existing negatives unchanged; new adapter → GoalNode DOM rows, exact label and node-id-bound source assertions.
- `recovery-notes/L25-approach.md`, `L25-mutants.py`, `L25-mutants.json`, `L25-results.json`, this report — approach, reproducible mutant probe and evidence summaries. Raw check logs remain alongside these files (git-ignored).

Rows and results:

| Real route / row | Lane base `00a60452` | Final |
| --- | --- | --- |
| Capacity: from_brief + exact target quote | RED, unknown | GREEN, From your brief |
| Second synthetic brief: monthly orders, different id/unit/value/quote | RED, unknown | GREEN, From your brief |
| inferred / proxy, each beside a quote | RED, unknown | GREEN, Olumi’s estimate |
| Same-label/same-value neighbouring goal, no target source | RED on the known-source control | GREEN; source stays on its own node |
| Missing provenance, missing/blank quote, unverified material, baseline-only source | GREEN | GREEN, Source not recorded |
| Existing target-specific brief stamp over inferred/proxy node provenance | GREEN | GREEN, From your brief |
| Existing user stamp, stale user stamp, no target, unstamped market-entry target | GREEN | GREEN, unchanged |

Final spec on the lane base: **5 failed / 14 passed**. Final reader: **19 passed / 0 failed**. Synthetic rows run `mapDraftNodeToCanvas → GoalNode → goalTargetSourceMark → ValueSourceMark`; fetch is stubbed to throw and asserted unused. **0 live provider calls.** DOM/accessible attribution only; no served or layout claim.

Scoped specs, one per process, test Supabase placeholders:

| Spec | Passed | Failed |
| --- | ---: | ---: |
| `src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx` | 19 | 0 |
| `src/canvas/nodes/__tests__/GoalNode.targetSourceMark.realMrrBoard.spec.tsx` | 5 | 0 |
| `src/canvas/domain/__tests__/goalTargetBriefSource.spec.ts` | 7 | 0 |
| `src/canvas/domain/__tests__/goalTargetSource.oneAuthority.spec.tsx` | 8 | 0 |
| `src/canvas/decisionBrief/__tests__/buildDecisionBrief.spec.ts` | 17 | 0 |

**56 passed total.** The reader's callers (canvas goal, SuccessTargetLine/inspector, decision brief) are covered by the scoped route specs. Existing MRR negatives still forbid borrowing the current level's source; node-only `ai_inferred` still stays unknown.

HIGH mutants (each restored before the next; final GREEN rerun after all mutants):

| Changed claim | Under/false-credit mutation | Failed / passed | Result |
| --- | --- | --- | --- |
| Brief | Omit new mapping | 3 / 16 | KILLED |
| Brief | Accept quote OR from_brief alone | 7 / 12 | KILLED |
| Olumi | Omit inferred/proxy mapping | 2 / 17 | KILLED |
| Olumi | Credit inferred/proxy to the brief | 2 / 17 | KILLED |
| Unknown | Credit unknown to Olumi | 9 / 10 | KILLED |
| Unknown | Credit unknown to the brief | 9 / 10 | KILLED |

Validation:
- ESLint on both changed TS/TSX files: exit 0, 0 errors (tooling emits existing npmrc / ESLintIgnoreWarning notices).
- `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec tsc --noEmit -p tsconfig.json`: exit 0. This solution stub loads no files, so it is not the substantive proof.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck`: exit 0, **coverage + ratchet PASSED**; 6219/6259 tracked files loaded, 40 declared out of scope. **0 errors in each changed file**, neither has a baseline allowance. Repo-wide diagnostics remain 2021 across 511 files (baseline 2055); this is not a whole-tree zero-errors claim. Typecheck Drift remains CI's required gate.
- Process check limitation: sandbox denies `ps`; `pgrep` cannot obtain the process list (sysmond unavailable). No concurrency claim is made. This builder ran its typecheck processes sequentially, after specs.
- `python3 ~/olumi-work/recovery/tools-dl/new-cycles.py /private/tmp/cx-l25 00a60452`: head 2 cycles / 6 files, base 2, **NEW/GROWN 0**. No production imports changed.
- `git diff --check`: exit 0.

Shape (`tools-dl/pr-shape.sh` unchanged parser, fed local diff by disposable read-only gh adapter; no remote PR/network): source **+16 / −27, net −11**, 1 file; tests **+55 / −1**, 1 file; fixtures 0. Parser reports 1 added export line and 4 if-lines: the export is the EXISTING function's reflowed signature (0 net exports); if-lines rise from 2 to 4 (+2 net). 0 refusal/reason codes, 0 regexes. Executable lines grow by 6; the net −11 also includes shortening the superseded threshold-only explanation. Reuses the target resolver/validity guard, marks and mapper; replaces the old brief-only condition and duplicate validity checks. No lease extension.

HIGH trace / product test:
- NUMBER / source: user says “Goal: weekly support capacity of at least 100 tickets per week.” Stored raw target is 100 in that goal's unit; this lane performs no number extraction or calculation.
- AUTHOR / approval: no new approval is inferred or exercised; the supplied saved record carries from_brief and that exact target quote. Adoption is not treated as authorship.
- Persisted readback: supplied `capacity/reads/01-02-range.json`, node `weekly_support_capacity`, contains raw=100, provenance=from_brief, source_quote. The adapter preserves these fields on the same node.
- THIS Run used: local replay/render consumes that node's declared raw/unit/source fields. No live analysis Run/provider request was made.
- User saw / first loss: criterion 7's served capture read “Source not recorded”; the first loss is `goalTargetSourceMark` ignoring those carried fields. Final local DOM/aria reads “From your brief”.
- Product test: people can distinguish their stated goal from an Olumi estimate or an unrecorded source while retaining authorship of the model. No new numerical/scientific claim is made.

Buddy (3 lines):
Correct: quoted declared brief source is shown; inferred/proxy and unknown stay distinct; the target's own stamp wins. Two-brief class proof and existing negatives pass.
Simpler: amend ONE existing reader, consolidate duplicate validity checks; no new classifier, writer, parser or schema. SIMPLER-ALTERNATIVE: none within the requested display contract.
OpenAI / efficiency: AI already declares the source; no host interpretation of quotation meaning, no SDK mechanism needed for this local label mapping, no added provider calls or network latency.

Assumption: as the lane brief specifies, `from_brief` plus the carried target `source_quote` is authoritative for this saved target. The reader does not inspect unrelated nodes or parse quotation text. Node provenance alone and current-level provenance remain insufficient.

Exact commit message: `fix(canvas): preserve declared goal target authorship`

No commit, push or deployment performed. Disk cleanup: none; only disposable temporary pr-shape adapter directories were automatically removed (under 1 KB of script content); evidence retained.

- Progress: S11 authorship contract, local real route GREEN; 56 specs rows passed, 6/6 mutants killed.
- Next 2 (highest-value? Y): DL commits/ships this tree; fresh review and served criterion-7 witness.
- Mistake: initial test selector looked for the title inside the target-only resting element; self-review also caught stamp precedence.
- Correction APPLIED: exact title lookup scoped to its node render; own target stamps take precedence, with two regression rows; final base RED and all final checks rerun.

Plan: L25 · Simplest approach? Y — one existing reader, declared fields, no parsing · Net src lines: −11
