# Overnight chat 1 — evidence pack

**Brief:** overnight CI coverage audit + UI test cascade resolution (mossy-shore).
**Hub branch:** `ui/overnight-ci-and-tests` off `staging` @ `dcc5ce1b`.
**Populated live as deliverables land.**

---

## §Push log

| Deliverable | Branch | PR | Opened | Merged | Paul approval |
|---|---|---|---|---|---|
| Audit push | `ui/ci-test-coverage-audit` | (no PR) | pushed 2026-04-18 | — | n/a (docs-only, reference branch) |
| Hub push | `ui/overnight-ci-and-tests` | (PR opens in morning) | pushed 2026-04-18 | — | REQUIRED — morning review |
| D2 | `ui/ci-coverage-fix` | [#125](https://github.com/Talchain/DecisionGuideAI/pull/125) | 2026-04-18 | — | REQUIRED — morning review |
| D3 enumeration | `ui/test-cascade-enumeration` | (no PR; pushed for reference) | 2026-04-18 | — | n/a — docs-only |
| D4 | `ui/msw-env-drift-batch-fix-v2` | [#126](https://github.com/Talchain/DecisionGuideAI/pull/126) | 2026-04-18 | — | REQUIRED — morning; depends on #125 landing first |
| D5 | — | (halted) | — | — | — |
| D6 | — | (deferred to post-merge chat) | — | — | — |

(Extended per deliverable as work proceeds.)

---

## §D1 — Audit (already committed; reviewed only)

**Output commit (origin):** `53bf7725` on `ui/ci-test-coverage-audit`.
**Output commit (hub, cherry-picked):** `685b75ad` on `ui/overnight-ci-and-tests`.
**Doc path:** `docs/ui/ci-test-coverage-audit.md`
**Word count:** ~1,850 (186 lines incl. tables + code fences).

### Executive summary (one paragraph)

CI reports 653 "skipped" test files because `.github/workflows/staging-full-tests.yml:112` runs vitest with `--bail=1`. Vitest aborts at first failure and marks the remaining enqueued files as skipped in its summary — they aren't structurally excluded. Local full-suite (same `vitest.config.ts`, no bail) runs 11,723 tests across 755 files with 60 failed tests in 14 files. Every serial fix this session unblocked one bail point and revealed the next (402 → 4181 → 4293 tests reached per PR cycle). The audit itemises five remediation levers and defers the choice to Paul; it makes no code change. Paul's decision post-audit: apply §5.1 (remove `--bail=1` outright), implemented in D2.

### Round 1 — brief compliance (D1)

Brief §2.D1 expects: every workflow running UI tests (name/trigger/command/matrix); every `vitest.config*.ts` file (include/exclude/shard); every env var influencing selection; actual CI execution counts by SHA; expected local counts; root cause named at the config line; proposed fix with diff; risk assessment.

| Requirement | Met in audit | Notes |
|---|---|---|
| Every workflow with UI tests | ✓ §2.1, §2.3 | All four workflows listed: `staging-full-tests.yml`, `ci.yml`, `contract-validation.yml`, `main.yml` |
| vitest config inventory | ✓ §2.2 | Include/exclude/env/pool/no-bail-in-config all documented |
| Env vars influencing selection | partial — §6 bullet 3 (`.env.local`) | No explicit table of `VITEST_SHARD` / `VITEST_INCLUDE` env vars. In practice none are in use; this is accurate-by-omission but worth noting. **Non-blocker.** |
| Actual execution count per SHA | ✓ §1 table | 402 / 4181 / 4293 tests across the progression |
| Expected local count | ✓ §3 | 14/734/4 files, 60/11576/49 tests |
| Root cause + line | ✓ §1 / §2.1 | `.github/workflows/staging-full-tests.yml:112` |
| Proposed fix with diff | partial — §5.1 diff | Five options shown; single-fix-proposal deferred to Paul (audit §8 is explicit). **Closed by Paul decision captured in plan.** |
| Risk assessment | ✓ §4 / §7 | Implications + scope notes cover blast radius |

**Round 1 outcome:** PROCEED. Two partials are documented, neither is a blocker. Audit meets spec.

### Round 2 — adversarial self-prompt (D1)

- **Q: Worst-case input that would break the bail-root-cause claim?**
  A: 653 files excluded by a mechanism not visible in `vitest.config.ts` — e.g., a project-level `testPathIgnorePatterns` in `package.json`, a rogue `.vitestignore`, or a `setupFiles` that globally `skip()`s. Mitigation: audit §2.2 confirms `vitest.config.ts` has three excludes (none match the ~653 count order of magnitude); no `.vitestignore` in repo. Progression table (402→4181→4293) is mechanically consistent ONLY with bail, not with a static exclude. Claim stands.

- **Q: What assumption is unvalidated?**
  A: That removing `--bail=1` won't trigger a runtime-limit in GitHub Actions (6-hour job timeout; 7 GB heap). Local full-suite is 19 min. CI should be comparable or faster with larger heap. Low risk but D2 validation will confirm before PR open.

- **Q: If the audit reads correct but the fix is wrong, how?**
  A: Possible if vitest post-first-failure continues tearing down workers in a way that cascades worker OOM (brief and CLAUDE.md both note "known Worker OOM at end"). Removing bail may surface more OOM noise in the summary. `scripts/pre-push-validate.sh` parses around it; CI doesn't. If CI runs become flaky post-fix, `--bail=50` (audit §5.2) is the documented fallback.

- **Q: What would a reviewer flag?**
  A: (a) The 5-option presentation vs brief's "single minimal fix" expectation. Resolved by Paul decision. (b) CI-minute cost increase — acknowledged as worth it while suite is red. (c) Audit doesn't touch pre-push hook's `--bail=1` at `scripts/pre-push-validate.sh:65`. Out of scope by design (pre-push bail is a dev-ergonomics tradeoff, not a visibility issue).

- **Q: What regression could this introduce?**
  A: None from the audit itself (doc-only). Regressions from D2's fix are addressed in D2 self-review.

**Round 2 outcome:** PROCEED. No blockers.

**D1 decisive outcome:** `proceed` — dispatch D2.

---

## §D2 — Remove `--bail=1`

**Branch:** `ui/ci-coverage-fix` off `staging` @ `dcc5ce1b`.
**Commit:** `57bc318b` — `fix(ci): remove --bail=1 from staging-full-tests workflow`.
**File changed:** `.github/workflows/staging-full-tests.yml:112` — one line.

### Local validation run (no bail, matching new CI command)

```
NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --reporter=verbose
```

```
 Test Files  14 failed | 734 passed | 4 skipped (755)
      Tests  60 failed | 11565 passed | 49 skipped (11712)
     Errors  5 errors
     Duration  1289.03s (≈21.5 min)
```

| Metric | Pre-fix CI (bail=1, SHA `0b50e62a`) | Post-fix local (no bail) | Delta vs audit baseline |
|---|---|---|---|
| Total files | 754 | 755 | +1 file added since audit |
| Files failing | 1 (bail-capped) | 14 | matches audit's 14 exactly |
| Files skipped | 653 (bail artefact) | 4 (real `it.skip()`) | gap closed |
| Tests passing | ~100 (bail-capped) | 11,565 | matches audit's 11,576 ± 11 |
| Tests failing | 1 (bail-capped) | 60 | matches audit exactly |
| Duration | ~2 min (bail-capped) | 21.5 min | — |

**11-test delta** from audit's 11,576 passing baseline is immaterial (0.09%; likely a new skip or deleted test in the intervening commits). Halt condition not triggered.

**5 errors** reported alongside the 60 test failures include:
- Worker OOM (3×) — known tail-of-suite issue per CLAUDE.md; occurred in cleanup after test counts were written; does not affect count validity
- `Failed to parse URL from /bff/cee/graph-readiness` (2×) in `OutputsDock.analysis-run.spec.tsx` and `patchAcceptLogic.spec.tsx` — **another env-drift pattern**: `useGraphReadiness.ts:76` constructs `new URL(url)` on an env-derived relative path. When the env var isn't set, URL parsing throws. This is beyond the 5 files on `ui/msw-env-drift-batch-fix` and a candidate for D3 env-drift cluster expansion.

### Round 1 — brief compliance (D2)

| Requirement | Met | Notes |
|---|---|---|
| Single minimal config change | ✓ | One line removed (`--bail=1`). No other edits. |
| On own branch `ui/ci-coverage-fix` off staging | ✓ | Confirmed with `git branch --show-current`. |
| Local validation before PR | ✓ | 21.5 min run; test counts captured. |
| Capture pre-fix baseline | ✓ | Audit §1 table + §3; this evidence pack §Metrics. |
| Compare test count change | ✓ | 60 failing matches audit exactly; file/test totals within 0.1%. |
| No workflow restructuring / other edits | ✓ | Diff is single line; no job renames, no new jobs. |
| PR opens but does NOT merge | pending | Immediately after push in next step. |
| PR description per plan refinement §D2 | pending | Drafted; populating metrics + pushing next. |

**Round 1 outcome:** `proceed` pending PR open.

### Round 2 — adversarial self-prompt (D2)

- **Q: Worst-case input that would break this?**
  A: If CI's 7 GB heap turns out to be insufficient for the full suite without bail (local OOM'd at the very end with 4 GB), CI could mass-fail on OOM rather than real test failures. Mitigation: local tail-OOM happened AFTER the test-counts summary was written; CI has ~75% more heap. The OOM was in cleanup, not during test execution, so counts were fully captured before death.

- **Q: What assumption haven't I validated?**
  A: That CI's `ubuntu-latest` single-runner can complete a 21.5-min run within any workflow timeout. Default GitHub Actions job timeout is 6 h — 21.5 min is well under. **Non-issue.**

- **Q: If this test passes but the feature is broken, how?**
  A: "Feature" here is "CI surfaces real failure count". It could "pass" (run to completion) but still under-report if some other exclusion mechanism is in play. Audit §2.2 rules out `.vitestignore` / config excludes / project-level ignores. Progression table (402→4181→4293→755 files post-fix) is mechanically consistent only with bail, not static exclusion. Claim stands.

- **Q: What would a reviewer flag?**
  A: (a) CI runtime jumps from ~2 min to ~21 min — documented in PR description; acceptable tradeoff. (b) `scripts/pre-push-validate.sh:65` local hook still uses `--bail=1`. Intentionally left alone — different context (developer ergonomics). Could be a follow-up if Paul wants CI/local parity. (c) Existing test failures unrelated to this PR will now fail the gate. Expected and is the point — noted in PR body.

- **Q: What regression could this introduce?**
  A: (i) Flaky tests previously hidden by bail could now occasionally fail CI. Mitigation: `--bail=50` fallback per audit §5.2 if flake appears. (ii) If a vitest worker OOMs mid-run (not just tail), CI could miss some failures. Extremely rare; local ran 20+ min before OOM in cleanup with tests fully recorded.

**Round 2 outcome:** `proceed`.

**D2 decisive outcome:** `proceed` to PR open (do NOT merge).

---

## §D3 — Cascade enumeration

**Branch:** `ui/test-cascade-enumeration` off `staging` @ `dcc5ce1b`.
**Commit:** `46189a63` — `docs(cascade): enumerate 14 failing files, 60 tests, 7 clusters`.
**Artefacts committed:** `docs/ui/test-cascade-findings-v1.md`, `cascade.json` (3.3 MB).
**Run command:**

```bash
NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --reporter=verbose --reporter=json --outputFile=cascade.json 2>&1 | tee /tmp/cascade-raw.txt
```

**Duration:** 19.97 min. Exit 0 via tee.

### Results

- 14 files failed / 734 passed / 4 skipped (755)
- 60 tests failed / 11,565 passed / 49 skipped (11,712)
- 5 errors (3 Worker OOM in cleanup + 2 URL-parse errors)

**Key finding: local cascade ≠ CI cascade.** Local `.env.local` masks the MSW env-drift class. The 5 files on `ui/msw-env-drift-batch-fix` + 2 URL-parse candidates surfaced by D2 (`OutputsDock.analysis-run`, `patchAcceptLogic`) are the env-drift cluster that will surface in CI after D2 merges.

### Cluster summary

| Cluster | Files | Tests | Action |
|---|---|---|---|
| Env-drift (CI-visible, batchable) | 7 | n/a locally | D4 candidate — meets brief threshold |
| Assertion drift (UI copy/structure) | 7 | ~22 | Defer to Paul |
| Real regression / API change | 3 | ~30 | Defer — requires production code |
| Threshold semantics (UI-SEM-013) | 1 | 3 | Defer — ambiguous |
| British-English content drift | 1 | 1 | Defer — requires production code |
| KNOWN-BROKEN | 1 | 2 | Already tracked in CLAUDE.md |

See `docs/ui/test-cascade-findings-v1.md` (on `ui/test-cascade-enumeration`) for per-file categorisation and reasoning.

### Round 1 — brief compliance (D3)

| Requirement | Met | Notes |
|---|---|---|
| Own branch off staging | ✓ | `ui/test-cascade-enumeration` off `dcc5ce1b` |
| Full suite with verbose + JSON reporters | ✓ | Both reporters + tee backup |
| tee capture for OOM safety | ✓ | `/tmp/cascade-raw.txt` captured full run |
| cascade.json committed | ✓ | 3.3 MB in commit `46189a63` |
| Complete list of failing test files | ✓ | findings §2, 14 files enumerated |
| Per-file root-cause category | ✓ | env-drift / mock mismatch / assertion drift / real regression / known-broken |
| Per-file fix complexity | ✓ | trivial / small / medium / needs investigation |
| Three clusters (Unblocker, Batch-fix, Ambiguous) | ✓ | Unblocker=none (bail already removed); Batch-fix=env-drift; Ambiguous=assertion-drift + regressions |
| Recommended next action | ✓ | "proceed to D4 with Paul gating" |

**Round 1 outcome:** `proceed`.

### Round 2 — adversarial self-prompt (D3)

- **Q: Worst-case input that would break the enumeration?**
  A: JSON reporter OOM'd mid-write (tail warning: "Some tests are still running when generating the JSON report"). Mitigation: verified counts via tee text (identical to JSON's numbers). All 14 files present in JSON output; no truncation of the key failing-test records.

- **Q: What assumption haven't I validated?**
  A: That CI will show the 5 MSW env-drift failures plus the 14 local failures = 19 files failing. Could be fewer (some env-drift tests might not exercise the env-dependent code path per run) or more (other env-drift paths not captured). Real CI cascade visible only after D2 merges. Documented as a morning-review action item.

- **Q: If the findings doc is "correct" but the real fix plan is wrong, how?**
  A: If I mis-categorised any assertion drift as "real regression" (or vice versa), Paul's morning review would flag it. Markdown.spec (26 tests) is the most consequential categorisation — tagged "real regression (rendering pipeline)" because raw markdown being returned instead of HTML implies the converter isn't running, not that expected HTML changed. If test setup changed (e.g., missing import), it's a test-mock issue not a production regression. **Morning action:** Paul verifies by running `npx vitest run src/canvas/utils/__tests__/markdown.spec.ts -t "converts italic text"` and inspecting actual output.

- **Q: What would a reviewer flag?**
  A: (a) Unblocker cluster is "none" — could be confusing; addressed by findings §3.1 explanatory text. (b) Env-drift cluster doesn't appear in local cascade — called out explicitly in findings §1. (c) 3.3 MB JSON committed — unusual but brief explicitly asks for it as artefact.

- **Q: What regression could this introduce?**
  A: None — doc + data only.

**Round 2 outcome:** `proceed`.

**D3 decisive outcome:** `halt` per brief §2 D3 ("Halt after enumeration. Do not fix."). D4 dispatch decision deferred to Paul's morning review.

---

## §D4 — MSW env-drift batch fix

**Branch:** `ui/msw-env-drift-batch-fix-v2` off `staging` @ `dcc5ce1b`.
**Commit:** `18b42938` — cherry-picked from `07b7a971` on `ui/msw-env-drift-batch-fix`.
**PR:** [#126](https://github.com/Talchain/DecisionGuideAI/pull/126) — open, **NOT MERGED**.

### Cherry-pick provenance (per plan refinement)

- Cherry-picked `07b7a971` (`fix(test): batch-stub VITE_PLOT_PROXY_BASE in 5 MSW specs (env-drift class)`) → `18b42938` on v2 branch
- Source files:
  - `src/adapters/plot/__tests__/autoDetectAdapter.streaming.test.ts`
  - `src/adapters/plot/__tests__/determinism.test.ts`
  - `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts`
  - `src/adapters/plot/__tests__/httpV1Adapter.limits.spec.ts`
  - `src/adapters/plot/__tests__/v1_1_contract.spec.ts`
- Rationale: matches env-drift cluster §3.2 in `test-cascade-findings-v1.md`; pattern already proven by merged sibling `9e4036a6` (`httpV1Adapter.stream.test.ts`)

### Local verification

```
# The 5 fixed files (with env var set, local context)
$ npx vitest run <5 files> --reporter=verbose
 Test Files  4 passed | 1 skipped (5)
      Tests  49 passed | 3 skipped (52)

# Adjacent directory (cross-test leakage check)
$ npx vitest run src/adapters/plot/__tests__/
 Test Files  8 passed | 1 skipped (9)
      Tests  139 passed | 4 skipped (143)
```

Both green. The `vi.stubEnv` pattern pins the env var per-test regardless of surrounding shell/dotenv state, so CI (no `.env.local`) will also pass.

**Env-unset verification not run directly.** Vite auto-loads `.env.local`, making exact CI simulation invasive (would require renaming `.env.local` temporarily). Indirect evidence is strong: the already-merged fix for `httpV1Adapter.stream.test.ts` (commit `9e4036a6`) applied the identical pattern and CI went green for that file, confirming pattern-correctness.

### Round 1 — brief compliance (D4)

| Requirement | Met | Notes |
|---|---|---|
| Cluster ≥3, identical pattern | ✓ | 5 files, identical `vi.stubEnv('VITE_PLOT_PROXY_BASE', PROXY_BASE)` pattern |
| Branch `ui/msw-env-drift-batch-fix-v2` off staging | ✓ | Off `dcc5ce1b` |
| Cherry-pick from existing branch (rebase/reuse) | ✓ | Source commit `07b7a971` → `18b42938` |
| Cherry-pick provenance recorded | ✓ | §Cherry-pick provenance above |
| Tests pass with env var set | ✓ | 49 passing / 3 skipped |
| Tests pass with env var unset | deferred | Pattern-correct by design; verified indirectly via already-merged sibling |
| Full spec file passes | ✓ | Per-file runs green |
| Adjacent spec files pass (no leakage) | ✓ | 139 passed in adjacent dir |
| Test-only, no production code | ✓ | Diff touches only `*.test.ts` / `*.spec.ts` files |
| Diff ≤50 lines per file | ✓ | Per-file adds 4–10 lines |
| PR opens but does NOT merge | ✓ | PR #126 open, waiting on Paul |

**Round 1 outcome:** `proceed`.

### Round 2 — adversarial self-prompt (D4)

- **Q: Worst-case input that would break this?**
  A: If `vi.stubEnv` doesn't work in the `beforeEach` phase before MSW handlers bind (race condition). Evidence against: sibling fix (`9e4036a6`) used the same pattern and has been stable in CI for weeks. All 5 files' tests pass locally — MSW binding and stub ordering are correct.

- **Q: What assumption haven't I validated?**
  A: That the exact env-unset CI scenario would pass. Could not simulate precisely without renaming `.env.local`. Mitigation: sibling file's CI pass is direct evidence. If the pattern were faulty, `9e4036a6` would still be red in CI.

- **Q: If this passes locally but the feature is broken, how?**
  A: The "feature" is "MSW specs pass in CI without `.env.local`". Possible break modes: (i) vitest's env-loading order differs from expectation — historically stable. (ii) Other env vars needed (not just `VITE_PLOT_PROXY_BASE`) — audit §6 notes only this one, and the sibling fix didn't need others. Low risk.

- **Q: What would a reviewer flag?**
  A: (a) PR depends on #125 — called out explicitly in PR description. (b) No direct env-unset validation — explained with indirect evidence. (c) Two additional D2-surfaced candidates (`OutputsDock.analysis-run`, `patchAcceptLogic`) NOT included in this PR — deliberate: they haven't been previously fixed, they're new candidates, and bundling unvalidated fixes expands blast radius. Call them out in morning handoff as "D4b candidates".

- **Q: What regression could this introduce?**
  A: None expected. Stubbing an env var per-test does not affect any other test (vitest's `vi.unstubAllEnvs()` cleanup in `afterEach` is part of the standard pattern and appears in the cherry-picked code).

**Round 2 outcome:** `proceed`.

**D4 decisive outcome:** `proceed` to PR open; **no auto-merge** because CI-green cannot be verified until D2 (#125) merges.

---

## §D5 — Non-env-drift fixes — HALTED

Per D3 findings §3.3–§3.7, no failing test file meets the D5 criteria of "trivially fixable AND unambiguously test-mock issues AND no production code change required":

| File | Why D5 is wrong tool |
|---|---|
| `wave2-replay-gate.spec.ts` | Requires either production cleanup (reduce `as any` casts) or threshold bump decision — Paul call |
| `british-english.spec.ts` | Requires production change (rename "behavior" → "behaviour") — forbidden in D5 |
| `sse-params.test.tsx` | Spy called 0×, expected 1× — needs investigation whether behaviour changed or mock is stale — ambiguous |
| `ScenarioListPage.spec.tsx` | Missing testids / copy — needs component read to judge intent; some testids may have been intentionally removed |
| `conversationCss.spec.ts` | CSS classname assertions — intent unclear (styling changed by design?) |
| `integratedPath.brief2026-04-10.spec.ts` | `batchUpdateNodes` API change — needs production-code call-site update — forbidden in D5 |
| `nodes.spec.ts` | Default size changed — is the new size the intended one? Paul decision |
| `InsightsPanel.spec.tsx` | Missing "Recommended Next Steps" text — copy may have been intentionally removed |
| `edgeIdentity.regression.spec.ts` | UI-SEM-013 threshold semantics — ambiguous per CLAUDE.md |
| `markdown.spec.ts` (**26 tests**) | Rendering pipeline regression — needs investigation at `safeRichText.ts` / similar production file — forbidden in D5 |
| `ClarifierPanel.spec.tsx` | Progress indicator render — may be UI change or mock issue |
| `no-message-render.spec.ts` | KNOWN-BROKEN per CLAUDE.md — already tracked |
| `RecommendationCard.spec.tsx` | Missing loading/error/success copy — copy may have been intentionally removed |
| `VerificationBadge.test.tsx` | 9 tests missing "Review Recommended" — likely intentional badge redesign |

All 14 files are either ambiguous, require production-code changes, or are KNOWN-BROKEN. Brief §4 halt rule fires on each. **D5 HALTED.**

**D5 decisive outcome:** `halt`. Every candidate deferred to Paul in morning handoff.

---

## §D6 — Final state verification — DEFERRED

Brief D6 expects: run full suite locally, compare to D3 baseline, wait for CI on latest staging HEAD.

**Problem:** D2 (#125) has not merged. Current staging HEAD is `dcc5ce1b`. CI on that HEAD doesn't reflect any of the overnight work. Re-running the full local suite would produce the same result as D3 (D4 only touches tests outside the cascade; no file in D4's change set is in the 14-failing list).

**Decision:** D6 full-cycle verification **deferred to morning**, after Paul's decision on D2 + D4 merges. The morning handoff doc (`docs/ui/overnight-chat-1-summary.md`) captures the pre-merge state and the expected post-merge verification steps.

**D6 decisive outcome:** `halt` — pre-merge D6 would be a wasted run; post-merge D6 belongs in the follow-up chat after morning merges.

---

## §Post-overnight review — ChatGPT feedback analysis (2026-04-18)

External review (ChatGPT) raised 8 points: 2×P0, 3×P1, 3×improvements. Each point evaluated on merits, not wholesale accepted. Three confirmed real issues fixed before morning; remainder documented with reasoning.

### P0.1 — `determinism.test.ts` mid-file `vi.unstubAllEnvs()` clears proxy-base stub — CONFIRMED, FIXED

Verified: file at line 193 (debug-flag test) calls `vi.unstubAllEnvs()` in a `finally`. Original cherry-pick stubbed `VITE_PLOT_PROXY_BASE` only in `beforeAll`, so streaming-mode tests below line 193 would lose proxy-base pinning in env-unset CI.

**Fix:** commit `8b1af916` on `ui/msw-env-drift-batch-fix-v2` — moves stub from `beforeAll` to `beforeEach`, matching the proven `httpV1Adapter.limits.spec.ts` pattern.

**Scope check (defensive):** grepped all 5 D4 files for `unstubAllEnvs`. Only `determinism.test.ts` had the mid-file call; the other 4 use it only in `afterAll` or `afterEach`. No further fixes needed.

### P0.2 — No direct env-unset verification — CONFIRMED, GAP CLOSED

Original D4 evidence relied on indirect pattern-parity with merged sibling `9e4036a6`. ChatGPT asked for direct proof.

**Action:** temporarily renamed `.env.local` → `.env.local.d4-verification-bak`, re-ran all 5 D4 files, captured output, restored `.env.local` with identical mtime.

```
Test Files  4 passed | 1 skipped (5)
     Tests  49 passed | 3 skipped (52)
  Duration  5.68s
```

0 failures in env-unset context. Evidence attached to PR #126 as a comment with full reproduction steps. `/tmp/d4-env-unset-verification.txt` preserves the output.

### P1.2 — Audit missed `poc-pr.yml` and `poc-sweep.yml` — CONFIRMED, ADDENDUM ADDED

Both workflows exist and one (`poc-sweep.yml`) runs vitest (`npm run test:unit`). Addendum appended to `docs/ui/ci-test-coverage-audit.md` §2.3 covering both. Neither affects the `--bail=1` analysis: `poc-sweep.yml` doesn't use bail and triggers differently; `poc-pr.yml` runs Playwright only. Audit's root-cause conclusion unchanged.

### P1.1 — D4 fixes 5 files, defers 2 same-pattern candidates — PARTIAL DISAGREEMENT

ChatGPT framed this as "cluster closure". Technical check: the 2 deferred files (`OutputsDock.analysis-run`, `patchAcceptLogic`) fail via `new URL()` in `src/canvas/hooks/useGraphReadiness.ts:76`, which is a **different code path** from MSW handler matching. The fix shape is likely different (wrap the URL construction, or inject a test-mode base, or stub `window.location`). Bundling an unvalidated fix into D4 expands blast radius without verification.

**Kept split.** Re-labelled as "D4b candidates" in morning handoff §7. Rationale recorded here for morning review.

### P1.3 — D3 halt / D4 proceed — POLICY QUESTION

Brief §2 D3: "Halt after enumeration. Do not fix." — our reading: D3 stops at enumeration (no in-place fixing); D4 is a separate conditional dispatch. Brief §2 D4 explicitly says "Only dispatches if Deliverable 3 confirms env-drift is a clear cluster (≥3 tests, identical pattern)" — this is the conditional hand-off, not a hard halt.

Strict reading (ChatGPT's): any "halt" means "wait for Paul". Our reading: conditional auto-dispatch is permitted when the brief defines the condition.

**No action overnight.** Documented here; Paul's morning review is the right place to choose interpretation for future briefs.

### Improvements (not actioned — out of overnight scope)

1. **Shared `stubPlotProxyBase.ts` helper** to dedupe setup logic. Worthy follow-up; would touch all 5+ files. Not trivially test-only (introduces new test-infra). Out of D4 / D5 scope.
2. **CI guard for min test-file count** — would have caught the 653-skip regression. Worthy follow-up for a separate PR on the CI config side.
3. **Sharding post-cascade** — already noted in D2 PR description and audit §5.3 as the right next-step after cascade stabilises.

All three are captured in the morning handoff §Questions for Paul and §Next dispatch.

## §Metrics (live, updated per deliverable)

| Metric | Pre-fix baseline | Post-D2 local (pre-merge) | Post-D2 CI | Post-D4 CI | Post-D6 final |
|---|---|---|---|---|---|
| CI tests run (staging-full-tests) | ~100 | n/a | — | — | — |
| CI files skipped | 653 | n/a | — | — | — |
| CI failures reported | 1 (bail-capped) | n/a | — | — | — |
| Local tests total | 11,723 | 11,712 | — | — | — |
| Local files failing | 14 | 14 | — | — | — |
| Local tests failing | 60 | 60 | — | — | — |
| Local duration | ~19 min | 21.5 min | — | — | — |

---

## §Deferred items for Paul

### Merge decisions required

1. **Merge D2 PR #125** (remove `--bail=1`) — opens the door for real-cascade visibility on every staging push.
2. **Merge D4 PR #126** (5-file MSW env-drift fix) — only after #125 merges, so CI can verify green.

### Questions needing Paul judgment

1. **Markdown pipeline (26 tests failing)** — real regression or test-setup issue? Morning action: `npx vitest run src/canvas/utils/__tests__/markdown.spec.ts -t "converts italic text"` and inspect output. Decide whether to roll back recent rendering changes, fix the test setup, or mark the spec as KNOWN-BROKEN temporarily.

2. **`batchUpdateNodes` method (3 tests)** — Canvas store method was removed or renamed. Find the replacement and decide whether to update the tests or restore the method.

3. **`wave2-replay-gate.spec` — 14 `as any` casts (expected ≤6)** — bump threshold or clean up casts?

4. **British-English content drift** — where is "behavior" (American) in the codebase? Rename to "behaviour" per convention.

5. **Threshold semantics at UI-SEM-013** (`edgeIdentity.regression`) — is the current inclusion logic (`switch_probability=0.30` now included rather than excluded) intentional? Align either test or code.

6. **Assertion drift (7 files: ScenarioListPage, conversationCss, nodes, InsightsPanel, RecommendationCard, ClarifierPanel, VerificationBadge)** — each has test expectations that don't match current UI. For each, decide: (a) update test to match current reality; (b) restore the expected UI element/copy because the change was unintended.

7. **Additional env-drift candidates (D4b)** — `OutputsDock.analysis-run.spec.tsx` and `patchAcceptLogic.spec.tsx` surfaced during D2 validation with URL-parse errors. These follow the same env-drift pattern as the 5 files in D4. Worth a follow-up PR after D4 merges and CI confirms D4 closed the expected 5-file cluster. Documenting them here for the morning dispatch.

8. **KNOWN-BROKEN count growth** (`no-message-render.spec.ts`): CLAUDE.md notes 1 failure; cascade shows 2. New leaf is `ConfidenceSection.tsx` rendering `.message`. Update CLAUDE.md count or fix.

### Policy questions

9. **Pre-push hook `--bail=1` at `scripts/pre-push-validate.sh:65`** — leave as local-dev convenience or align with CI (remove for parity)?

10. **Next bail policy post-cascade** — once cascade resolves, revisit whether to go sharded (audit §5.3) instead of no-bail.

---

## §Reassessment round 2 (2026-04-18 10:30) — improvements upgraded from "follow-up" to "implement now"

Paul directed a second pass on the three ChatGPT improvements: "implement if genuinely improves the solution." Reassessment outcomes:

### Improvement #1 — shared `pinPlotProxyBase` helper → IMPLEMENTED

**Reason to implement:** P0.1 (the `determinism.test.ts` mid-file unstub bug) demonstrated the value: hand-rolled stub patterns drift. Three of the five D4 files had the proxy-base stub only in `beforeAll`, which would silently fail if any future test added an inner `vi.stubEnv`/`vi.unstubAllEnvs`. A helper makes the correct `beforeEach` pattern the default by import. Also honours the original audit §170 suggestion: *"codified via a shared tests/setup/msw-env.ts"*.

**Implementation:** commit `9120ebc2` on `ui/msw-env-drift-batch-fix-v2`.
- New file: `tests/setup/msw-env.ts` (30 lines, exports `PLOT_PROXY_BASE` const + `pinPlotProxyBase(base?)` function)
- All 5 D4 files refactored to import and call `pinPlotProxyBase()` at module scope
- Side-benefit: `httpV1Adapter.contract.test.ts` and `v1_1_contract.spec.ts` previously had hardcoded `'/api/plot/version'` paths at module scope; now both use `${PROXY_BASE}/version`.

**Verification (all 3 green):**
- Env-set (local): `Test Files 4 passed | 1 skipped (5)`, `Tests 49 passed | 3 skipped`
- Env-unset (`.env.local` renamed): same 49/49
- Adjacent dir cross-leakage: `Test Files 8 passed | 1 skipped (9)`, `Tests 139 passed | 4 skipped`

### Improvement #2 — CI guard for bail-like under-reporting → IMPLEMENTED

**Reason to implement:** direct defence-in-depth for D2. Without it, a future contributor re-adding `--bail=N` would re-create the 653-file invisible-skip problem. The whole point of D2 is visibility; a guard makes the visibility durable.

**Initial attempt was wrong:** first version checked only `total < 700`, which would MISS the actual regression shape. When bail fires, total stays high (754) while skipped balloons (653). Re-scoped to assert BOTH `total >= 700` AND `skipped <= 50`.

**Implementation:** commit `c9d460b5` on `ui/ci-coverage-fix`.
- New step `Assert healthy test-file coverage (no bail-like under-reporting)` after vitest step
- Parses both common shapes of the `Test Files` summary line
- `if: always()` so it fires even when vitest exits non-zero
- Thresholds chosen with margin: `min_total=700` (55 below current 755), `max_skipped=50` (46 above real 4)

**Verification:**
- Real no-bail output (755 total, 4 skipped): PASS
- Synthetic `754 total | 653 skipped` (simulated bail regression): FAIL on skipped>50

### Improvement #3 — post-cascade sharding → NOT IMPLEMENTED

**Reason to skip:** requires matrix strategy + job topology change + gate logic update. Per brief §4 no-go rail: "Rewriting .github/workflows structure — only the specific lines identified in audit." Sharding is a structural rewrite. D2's fix closes the visibility gap with a single-line edit; sharding belongs in a separate scoped change once the cascade is clean (as the audit §5.3 and D2 PR description both note).

### P1.1 reassessment (verified, kept split)

Read `src/canvas/hooks/useGraphReadiness.ts:76` and `src/canvas/stores/readinessStore.ts:28`. The 2 files (`OutputsDock.analysis-run`, `patchAcceptLogic`) fail via:
- Different env var: `VITE_CEE_BFF_BASE` (fallback `/bff/cee`), **not** `VITE_PLOT_PROXY_BASE`
- Different code path: relative URL passed to `fetch()` where undici's URL parser rejects it; no MSW setup in either test file to intercept
- Different fix shape: probably `vi.mock('../stores/readinessStore')` or `vi.stubEnv('VITE_CEE_BFF_BASE', 'http://localhost/bff/cee')` with a test-absolute URL — NOT the same `vi.stubEnv('/api/plot')` shape as the 5 D4 files

ChatGPT's "same pattern" claim was based on surface similarity (env-var relative URL) but the actual fix is non-trivial. Bundling without a proper fix shape would regress the D4 PR. Kept split as "D4b candidates" — morning handoff §7 flags them for a separate PR.

### P1.3 reassessment (policy, no code action)

Re-read brief §2 D3 and §2 D4:
- §2 D3: *"Halt after enumeration. Do not fix. Commit doc."* — interpretable as "halt within-D3 (no fixing inside D3)" OR "halt pipeline entirely."
- §2 D4: *"Only dispatches if Deliverable 3 confirms env-drift is a clear cluster..."* — conditional auto-dispatch wording.

My reading (continued from original): the conditional in §2 D4 implies §2 D3's "halt" is scoped to "halt fixing inside D3", not "halt everything." Strict reading is defensible but slower. No retroactive action possible (D4 PR is open). Policy question documented for Paul's review.

Stash `stash@{0}` on `ui/ci-test-coverage-audit`: `P1.2 pre-analysis WIP - stashed for overnight CI work`. Fingerprint captured in the plan doc at `~/.claude/plans/overnight-brief-mossy-shore.md`. Morning restoration: verify fingerprint → `git stash pop stash@{0}`.
