# Overnight chat 1 — evidence pack

**Brief:** overnight CI coverage audit + UI test cascade resolution (mossy-shore).
**Hub branch:** `ui/overnight-ci-and-tests` off `staging` @ `dcc5ce1b`.
**Populated live as deliverables land.**

---

## §Push log

| Deliverable | Branch | PR | Opened (UTC) | Merged (UTC) | Paul approval |
|---|---|---|---|---|---|
| D2 | `ui/ci-coverage-fix` | — | — | — | REQUIRED — morning review |

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

## §D2 — Remove `--bail=1` (pending execution)

(populated after D2 runs)

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

| Metric | Pre-fix baseline | Post-D2 CI | Post-D4 CI | Post-D6 final |
|---|---|---|---|---|
| CI tests run (staging-full-tests) | ~100 | — | — | — |
| CI files skipped | 653 | — | — | — |
| CI failures reported | 1 (bail-capped) | — | — | — |
| Local tests | 11,723 | — | — | — |
| Local files failing | 14 | — | — | — |
| Local tests failing | 60 | — | — | — |

---

## §Deferred items for Paul

(populated as halts fire)

---

## §Stash safety

Stash `stash@{0}` on `ui/ci-test-coverage-audit`: `P1.2 pre-analysis WIP - stashed for overnight CI work`. Fingerprint captured in the plan doc at `~/.claude/plans/overnight-brief-mossy-shore.md`. Morning restoration: verify fingerprint → `git stash pop stash@{0}`.
