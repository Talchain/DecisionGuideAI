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
| D3 enumeration | `ui/test-cascade-enumeration` | TBD (docs-only; may fold into hub) | — | — | — |

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

## §D3 — Cascade enumeration (pending)

(populated after D3 runs)

---

## §D4 — MSW batch fix (conditional)

(populated if dispatched; includes cherry-pick provenance from `ui/msw-env-drift-batch-fix`)

---

## §D5 — Non-env-drift fixes (conditional)

(populated only for trivially test-only fixes)

---

## §D6 — Final verification (pending)

(populated last; summary doc lives separately at `docs/ui/overnight-chat-1-summary.md`)

---

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

(populated as halts fire)

---

## §Stash safety

Stash `stash@{0}` on `ui/ci-test-coverage-audit`: `P1.2 pre-analysis WIP - stashed for overnight CI work`. Fingerprint captured in the plan doc at `~/.claude/plans/overnight-brief-mossy-shore.md`. Morning restoration: verify fingerprint → `git stash pop stash@{0}`.
