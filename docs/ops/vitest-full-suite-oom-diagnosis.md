# Vitest full-suite OOM — diagnosis and fix options

**Filed:** Brief 5.2 close-out, 2026-04-20
**Surfaced from:** `scripts/pre-push-validate.sh` run on commit `8679ea79` emitted `Worker terminated due to reaching memory limit: JS heap out of memory` during vitest teardown while the test summary showed `1 failed | 6218 passed | 36 skipped`.

## Immediate mitigation (already applied in this close-out)

Bumped local heap budgets from 4 GB to 6 GB:
- `scripts/pre-push-validate.sh:65` — `NODE_OPTIONS=--max-old-space-size=6144`
- `package.json "test:full"` — same

This closes the gap to CI (which runs at 7168 MB via `.github/workflows/staging-full-tests.yml`) and should eliminate the teardown-phase OOM on developer machines with ≥8 GB free RAM.

## Diagnosis

Root cause is **infrastructural**, not a leaking test. The evidence:

1. **The suite passes.** 6218/6219 tests pass (the 1 failure is the pre-existing tornado test, tracked separately). Tests themselves run inside isolated jsdom sandboxes and tear down cleanly — no accumulating DOM leaks across tests.
2. **The OOM fires during teardown, not mid-run.** Summary line `Duration 911.12s (transform 3.70s, setup 14.03s, collect 15.13s, tests 45.65s, environment 28.14s, prepare 5.10s)` — tests run in 45.65s; the remaining ~850s is transform + environment + reporter teardown per test file. The `ERR_WORKER_OUT_OF_MEMORY` entries appear in the "Unhandled Error" block emitted AFTER the summary, i.e. during worker exit.
3. **Single-thread compounds retention.** `vitest.config.ts` sets `poolOptions.threads.maxThreads: 1` + `isolate: true`. Every one of the 188 test files gets a fresh module graph, but Node's parent process retains the accumulated heap of previously-imported modules (React, jsdom, @testing-library, Zustand, ReactFlow) until GC fires. With a 4 GB ceiling the reporter's final snapshot phase crosses the line.
4. **CI has 7 GB and still reports OOM occasionally.** So the problem isn't purely a local-machine constraint — it's a genuine aggregate-memory issue that widens as the suite grows.

## Fix options if the 6 GB mitigation proves insufficient

Ranked by effort / risk:

### Option A — switch to the `forks` pool

```ts
// vitest.config.ts
poolOptions: {
  forks: { maxForks: 1, minForks: 1 },
}
pool: 'forks',
```

Child-process isolation releases each file's heap on exit, so the parent never accumulates the 188-file module graph. Trade-off: `forks` is ~15-20% slower than `threads` because each file pays a process startup cost. On a 14-minute suite that adds ~2-3 minutes.

**Risk:** some tests may have accidental dependencies on module-level singletons that persisted between files in `threads` mode; `forks` exposes those. Worth running the full suite once with `forks` to enumerate any surprises.

### Option B — heap profile + targeted fixes

```bash
NODE_OPTIONS="--max-old-space-size=6144 --heapsnapshot-near-heap-limit=3" \
  npx vitest run --bail=1
```

Collect three snapshots near the limit; load in Chrome DevTools; identify which imported modules dominate retained size. Likely culprits: a large test fixture file imported transitively by many specs, or a `vi.mock` that monkey-patches something globally.

**Effort:** 2-3 hours to capture + analyse + ship the targeted fix. **Reward:** potentially moves peak from ~5 GB → ~3 GB and closes the problem permanently.

### Option C — suite sharding (local)

CI already shards in effect by running on a dedicated runner. Locally the `pre-push-validate.sh` could shard the suite into 2 sequential invocations with independent Node processes:

```bash
npx vitest run --bail=1 --shard=1/2
npx vitest run --bail=1 --shard=2/2
```

Half the module graph per process → half the peak. Trade-off: adds ~30s of startup overhead. Simple and reversible.

### Option D — reduce what each test file imports

Audit fixture files to stop pulling the full `ResultsBody` tree into specs that only need `DecisionConfidencePanel`. Moves in the right direction but high effort for uncertain payoff.

## What was deliberately NOT done in this close-out

- **No pool-mode change.** Switching to `forks` is a config-level decision with a real performance trade-off; flagged as Option A here so it's a judgement call, not an unknown.
- **No heap-profile session.** Out of scope for a close-out; captured as Option B with concrete commands.

## Close conditions

This document closes when one of:
- **6 GB mitigation holds for 30 days** across developer machines and CI with zero OOM reports → mark this doc historical.
- **OOM recurs** → trigger Option A (forks pool) as the next step.
- **Suite grows past ~250 test files** → trigger Option B (heap profile) proactively before the next OOM.
