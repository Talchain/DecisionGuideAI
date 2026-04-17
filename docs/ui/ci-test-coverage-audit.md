# CI test-coverage audit — why "653 test files skip" on staging

**Date:** 2026-04-18
**Branch:** `ui/ci-test-coverage-audit` (off `staging`)
**Scope:** diagnostic only — no fixes. Answers: what runs in staging CI vs local, what's skipped, and why.
**Origin:** post-merge CI results on `0b50e62a` showed `Test Files 1 failed | 100 passed | 653 skipped (754)` vs local full-suite `14 failed | 734 passed | 4 skipped (755)`. This audit explains the 653-file gap.

---

## 1. Top-line finding

**There is no coverage-config issue. The 653 "skipped" test files are vitest's reporting of files enqueued but never reached before [`--bail=1`](../../.github/workflows/staging-full-tests.yml#L112) triggered.**

Single line in `.github/workflows/staging-full-tests.yml`:

```yaml
# line 112
run: npx vitest run --reporter=verbose --bail=1
```

`--bail=1` makes vitest abort the entire run at the first test failure. Remaining files still in the queue are marked as "skipped" in the final summary. Nothing about the suite is structurally excluded — every one of the 755 test files is eligible to run; only the first failure determines how many actually do.

**The cascade I kept chasing this session is an artefact of `--bail=1`:**

| Commit | Failure that triggered bail | Tests reached before bail |
|---|---|---|
| pre-PR-#122 (`c0e6feea`) | `useConversation.hook.spec` (21 tests) | **~402** (tests in files alphabetically before / test-order before `useConversation.hook.spec`) |
| after PR #122 | 1 residual in `useConversation.hook.spec` | **~402** (same file, slightly later point) |
| after PR #123 (`2b512f2b`) | `httpV1Adapter.stream.test.ts` | **~4181** |
| after PR #124 (`0b50e62a`) | `httpV1Adapter.contract.test.ts` | **~4293** |

Each PR removed one bail point; the next pre-existing failure down the queue became the new bail point. Local run without `--bail` (default mode) shows the true total: **60 failed tests across 14 files out of 11,723 total**.

---

## 2. Workflow + config inventory

### 2.1 What runs on push to `staging`

One workflow triggers on push to `staging`: [`.github/workflows/staging-full-tests.yml`](../../.github/workflows/staging-full-tests.yml). 5 jobs:

| Job | Step | Notes |
|---|---|---|
| `install` | `npm ci` | Shared install + `actions/cache` on `node_modules`. |
| `tsc` (TypeScript + Lint) | `npm run lint`, `npm run typecheck` | — |
| `vitest` (Full Test Suite) | **`npx vitest run --reporter=verbose --bail=1`** with `NODE_OPTIONS=--max-old-space-size=7168` | **Bail-at-first-failure is the root cause of the skip-653 observation.** |
| `build` (Production Build) | `npm run build` | — |
| `gate` (Staging Gate) | script asserts `tsc.result`, `vitest.result`, `build.result` all `success` | Intended as branch-protection required check on `main`. |

### 2.2 `vitest.config.ts`

Clean. Relevant fields:

- `include:` covers `src/**/__tests__/**`, `src/**/tests/**`, `tests/**`. No narrow filter.
- `exclude:` three entries, all DOM-integration specs marked for later work (`ReactFlowGraph.layout.dom.spec.tsx`, `canvas.run-gating.dom.spec.tsx`, `OutputsDock.dom.spec.tsx`). Comments label them "CI-only" or needing CSS variables jsdom can't provide.
- `environment: 'jsdom'`, `watch: false`, `reporters: ['default']`.
- `restoreMocks / clearMocks / mockReset / isolate: true`, `passWithNoTests: true`.
- `poolOptions.threads.maxThreads = 1, minThreads = 1`. Config comment: *"Single thread to avoid JS heap OOM locally. CI has more RAM and uses sharded runners for parallelism instead."*
- **No `bail` field, no `shard` field, no `testNamePattern`.** The bail is specified only at CLI in the workflow.

### 2.3 Other workflows that run tests (not staging-triggered)

| Workflow | Trigger | Test command | Scope |
|---|---|---|---|
| `ci.yml` | push to `main` / PR to `main` | `npm run test:coverage` | Full suite with v8 coverage. No bail flag → runs to completion. |
| `contract-validation.yml` | (probably PR) | `npx vitest run tests/contracts/ --reporter=verbose --bail=1` | Narrow subtree only. Small scope, bail impact minimal. |
| `main.yml` | on main branch events | `npm test --if-present` | Standard npm test, no bail. |

Only `staging-full-tests.yml` fires on `push: staging`. That's the one this audit is about.

### 2.4 Config-comment vs actual behaviour

The `vitest.config.ts` comment says "CI has more RAM and uses sharded runners for parallelism instead." This describes an **intended** design, not the current workflow. The staging workflow runs one `vitest` job on one `ubuntu-latest` runner. No sharding. The comment and reality have drifted.

---

## 3. What "skipped" means in vitest's reporter

From vitest source behaviour: when `--bail=N` triggers, the runner stops queuing new test files and cancels in-flight workers after their current test completes. Files that were in the queue but never started are reported as skipped in the final file/test counts. It is NOT a user-declared `it.skip()` — it's a runtime state.

This is why local counts (no bail) differ from CI counts (bail=1):

- Local `pnpm test` (single-thread, 19 min total): `14 failed / 734 passed / 4 skipped (755 files)`, `60 failed / 11576 passed / 49 skipped (11723 tests)`. The 4/49 skipped ARE declared `.skip()`/`it.skip()` — those are intentional.
- Staging CI (`--bail=1`): same 4/49 declared-skips, plus whatever-was-queued-after-bail reported as additional skips. 653 files + vitest-internal-skipped > 49 tests → counts blow up.

The 653-file skip is entirely a consequence of `--bail=1`.

---

## 4. Implications + trade-offs of the current design

**Intent (inferred from the workflow comment and the `gate` job design):** fail-fast on any regression. Save CI minutes. Surface the issue quickly. One failure kills the gate.

**Operational cost when the codebase carries a long-standing failure:**
- The first failure is always the same one until fixed. Every downstream failure is invisible.
- Every fix unblocks ONE more failure. Serial fixes required.
- Evidence packs / reviewer reports under-count the problem: "1 failed / 4180 passed" reads like "one bug left", but the real count (per local full-suite) is 60 failed / 11576 passed.
- Fix-one-at-a-time cadence means each round costs ~20 min for CI feedback + PR/merge ceremony for effectively ~1% of the failure surface.

**Intent-vs-cost balance:** valid for a codebase where the test suite is usually green — bail-on-first is cheap and fast. But when the suite has been red for weeks, bail hides the blast radius and drives unnecessary serial rework.

---

## 5. Available levers (for Paul's decision, not this audit to choose)

Each of these is a test-mocks-infrastructure-adjacent change with its own blast radius. All go in `.github/workflows/staging-full-tests.yml` (and, if touched, `vitest.config.ts`).

### 5.1 Remove `--bail=1` outright

```yaml
# line 112 replacement
run: npx vitest run --reporter=verbose
```

- Full failure list surfaces every CI run.
- Gate decision unchanged (any failure fails the gate).
- CI runtime increases proportional to suite size and number of failures. Local run took 19 min on single-thread; CI should be comparable with its 7 GB heap.
- Simplest change. Zero config drift.

### 5.2 `--bail=N` with a budget

```yaml
run: npx vitest run --reporter=verbose --bail=50
```

- Surfaces up to N failures before aborting.
- Caps the worst-case runtime.
- Picks a middle ground between "first failure only" and "full list".
- Need to pick N — reasonable: 50–100.

### 5.3 Shard across parallel jobs

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx vitest run --reporter=verbose --bail=1 --shard=${{ matrix.shard }}/4
```

- Each shard reports its own failures independently. Bail-at-first applies per-shard.
- Cuts wall-clock runtime to ~`total/N`.
- Requires vitest `--shard` support (available since v1.x; the project's version is pinned in `package.json`).
- Matches the config comment's "CI uses sharded runners for parallelism" intent — closes the drift between comment and reality.

### 5.4 Add a separate "diagnostic" workflow

```yaml
# new file, e.g. .github/workflows/staging-full-tests-diagnostic.yml
on: workflow_dispatch  # manual trigger only
# run without --bail
```

- Keeps staging-full-tests.yml's fail-fast behaviour for normal pushes.
- Gives reviewers a manual button for "run without bail, show me everything".
- Doesn't affect the push-to-staging gate at all.

### 5.5 Leave as-is

- Accept that each fix unblocks the next failure.
- Fix serially.
- Existing approach of this session. Known to converge eventually but slow.

---

## 6. Related concerns surfaced incidentally

- **`poolOptions` comment vs reality.** The comment claims CI uses sharded runners. Staging CI actually uses one runner, one job, one vitest process. If sharding is adopted (§5.3), the comment becomes accurate without further action.
- **`onUnhandledRequest: 'error'` in MSW tests + `--bail=1`.** When any MSW-using test fetches an unstubbed URL, MSW throws, which can terminate the test worker, which can accelerate bail-triggering beyond a single test's boundaries. Contributes to the "cascade" feel: one env-drift spec can terminate its worker and be reported before slower-running files ever load.
- **Local `.env.local` masks the env-drift class of failure.** Nine of the 14 failing files from the local full-suite run (if the pattern holds beyond the 5 I already grepped) are MSW/env-drift. Local dev never sees them because `.env.local` carries `VITE_PLOT_PROXY_BASE=/api/plot`. CI doesn't. Every new MSW spec added by someone developing locally will silently drift the same way unless the stub pattern is codified (e.g., via a shared `tests/setup/msw-env.ts`).

---

## 7. Scope notes for any follow-up fix

- `.github/workflows/*.yml` edits have **higher blast radius** than test-mocks edits. Any change affects every push to staging, gate evaluation, and (via cascade) every merge-to-main eligibility.
- Changes to `vitest.config.ts` affect local dev too (not just CI). If a fix wants to codify the env stub shared setup, it belongs in `tests/setup/msw-env.ts` (or similar) and wired via `setupFiles:` in `vitest.config.ts` — that's a test-infra change, not production code.
- The `5-file batch fix` on `ui/msw-env-drift-batch-fix` (commit `07b7a971`, not pushed) addresses one slice of the env-drift class. It's still the right fix; it just won't verify-on-CI as green-suite until the bail-masking is resolved.

---

## 8. Explicit non-decisions

This audit does NOT recommend a specific lever. Removing `--bail=1` is the simplest, shard-based parallelism is the most config-intent-consistent, and the diagnostic workflow is the most conservative. The right pick depends on CI-minutes budget, team preference for fail-fast vs full-list-per-run, and whether the codebase is expected to have persistent red for a while (shifts the calculus toward §5.1 or §5.3).

No code edited by this audit. Paul reviews → decides lever → a separate branch implements.
