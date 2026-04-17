# Diagnosis: useConversation.hook.spec.ts — "expected spy to be called 1 times, but got 0 times"

**Date:** 2026-04-17
**Branch:** `ui/useconversation-spec-diagnosis` (off `staging`)
**Scope:** diagnostic only — no fixes
**Failing test:** [`useConversation.hook.spec.ts`](../../src/canvas/conversation/__tests__/useConversation.hook.spec.ts)
→ describe `buildRequest payload — RF → CEE graph_state transform`
→ it `transforms nodes to CEE format (kind, label, no RF internals)` (and 20 sibling tests in the same block)

---

## 1. Root cause

**Category (c): environment-dependent code path — V4 streaming vs non-streaming branch.**

The failing assertion at [`useConversation.hook.spec.ts:347`](../../src/canvas/conversation/__tests__/useConversation.hook.spec.ts#L347) is:

```ts
expect(mockStreamTurn).toHaveBeenCalledTimes(1)
const request = mockStreamTurn.mock.calls[0][0]
```

`sendMessage` in [`useConversation.ts:2659`](../../src/canvas/conversation/useConversation.ts#L2659) branches on the orchestrator-streaming feature flag:

```ts
if (isOrchestratorStreamingEnabled()) {
  // STREAMING PATH
  for await (const event of streamOrchestratorTurn(request, controller.signal)) { ... }   // L2695
} else {
  // NON-STREAMING PATH
  const envelope = await callOrchestratorTurn(request, controller.signal)                 // L2835
}
```

The test assumes the streaming branch is taken — it only spies on `streamOrchestratorTurn` (aliased to `mockStreamTurn`). When the flag resolves to `false` at test time, `callOrchestratorTurn` (`mockCallTurn`) is called instead, so `mockStreamTurn.mock.calls[0]` is `undefined` → "got 0 times".

`isOrchestratorStreamingEnabled` is built from [`flagFactory.ts`](../../src/lib/flagFactory.ts) which resolves, in order: localStorage → `import.meta.env.VITE_FEATURE_ORCHESTRATOR_STREAMING` → `defaultValue: false`. The test file does **not** mock `../../flags`, so the flag's real resolution runs.

This is **not** a V5 issue. V5 eligibility ([`useConversation.ts:2408`](../../src/canvas/conversation/useConversation.ts#L2408)) gates on a separate env var `VITE_ENABLE_V5_ORCHESTRATOR`, which is not set in staging or in the test env.

---

## 2. Evidence

### 2.1 Local reproduction — confirms the flag is the switch

On my machine [`.env.local:52`](../../.env.local#L52) sets `VITE_FEATURE_ORCHESTRATOR_STREAMING=1`, so the test **passes** here:

```
$ npx vitest run src/canvas/conversation/__tests__/useConversation.hook.spec.ts -t "transforms nodes to CEE format"
[sendTurn] streaming flag: true | source: env | localStorage: null | env: 1
 ✓ transforms nodes to CEE format (kind, label, no RF internals)
 Test Files  1 passed (1)
```

Forcing the flag off reproduces the reported failure exactly:

```
$ VITE_FEATURE_ORCHESTRATOR_STREAMING=0 npx vitest run ... -t "transforms nodes to CEE format"
[sendTurn] streaming flag: false | source: env | localStorage: null | env: 0
 × transforms nodes to CEE format (kind, label, no RF internals)
   → expected "spy" to be called 1 times, but got 0 times
   at useConversation.hook.spec.ts:347:28
```

Running the whole describe block with the flag off reveals the failure is block-wide:

```
$ VITE_FEATURE_ORCHESTRATOR_STREAMING=0 npx vitest run ... -t "buildRequest payload"
 Tests  21 failed | 34 skipped (55)
```

All 21 tests in `describe('buildRequest payload — RF → CEE graph_state transform', ...)` read from `mockStreamTurn.mock.calls[0][0]`.

### 2.2 Git history — when and why the assertion switched

Commit [`271bc166`](https://github.com/Talchain/DecisionGuideAI) (2026-03-25, "feat(loading): EmptyState as loading hub…") rewrote this block from asserting on `mockCallTurn` to asserting on `mockStreamTurn`:

```diff
- expect(mockCallTurn).toHaveBeenCalledTimes(1)
- const request = mockCallTurn.mock.calls[0][0]
+ expect(mockStreamTurn).toHaveBeenCalledTimes(1)
+ const request = mockStreamTurn.mock.calls[0][0]
```

The commit message says: *"Test mock added for streamOrchestratorTurn (was missing, causing pre-existing test failures in useConversation.hook.spec.ts)."* The added `mockStreamTurn` and its default implementation at [`useConversation.hook.spec.ts:24-37`](../../src/canvas/conversation/__tests__/useConversation.hook.spec.ts#L24-L37) delegate through `mockCallTurn`, so `mockResolvedValue(...)`-style setups still work when the streaming path runs. What the rewrite missed is a flag-override block (e.g. `vi.mock('../../flags', () => ({ isOrchestratorStreamingEnabled: () => true, ... }))`) or an env set in `tests/setup/rtl.ts`. Every other `useConversation` spec in `__tests__/` explicitly pins the flag — for example [`streamingLifecycle.spec.ts:43`](../../src/canvas/conversation/__tests__/streamingLifecycle.spec.ts#L43) (`=> true`) and [`conversation-flow.spec.ts:41`](../../src/canvas/conversation/__tests__/conversation-flow.spec.ts#L41) (`=> false`). `useConversation.hook.spec.ts` is the outlier: no flag mock.

### 2.3 Why it passes locally but fails elsewhere

- `.env.local` → loaded by Vite for all modes including `test` → flag resolves true here.
- CI GitHub Actions workflows in [`.github/workflows/`](../../.github/workflows/) do not set `VITE_FEATURE_ORCHESTRATOR_STREAMING` anywhere (`grep -r VITE_FEATURE_ORCHESTRATOR_STREAMING .github` returns nothing).
- No `.env.test` exists. `tests/setup/rtl.ts` does not seed feature-flag env vars.
- Therefore on any machine or CI shard without `.env.local`, the flag is `false` and the block fails.

This matches the brief's "pre-existing on staging — identical failure on last 3 commits". The failure has existed since 2026-03-25 (commit `271bc166`), concealed locally by `.env.local`.

### 2.4 Spy target is still valid

- `streamOrchestratorTurn` is still exported from [`turnService.ts`](../../src/canvas/conversation/turnService.ts) and imported at [`useConversation.ts:13`](../../src/canvas/conversation/useConversation.ts#L13).
- The call site at [`useConversation.ts:2695`](../../src/canvas/conversation/useConversation.ts#L2695) is intact and reachable.
- The RF→CEE transform itself in `buildRequest` ([`useConversation.ts:1379`](../../src/canvas/conversation/useConversation.ts#L1379)) is also intact — all 21 body assertions pass when the streaming branch is reached.

### 2.5 End-to-end runtime check (independent of the spy)

With the flag on, the single failing test passes entirely, including the body assertions:

```
✓ transforms nodes to CEE format (kind, label, no RF internals)
```

This covers input shape (React Flow nodes with `observedState`, `selected`, `dragging`, `measured`, `interventions`, etc.) → output shape (CEE wire format with `observed_state`, no RF internals, signed-mean edges). The transform is correct at runtime. The failure is a test-harness seam, not a regression in `buildRequest`.

---

## 3. Impact on Slice B

**No runtime regression inherited.** Slice B's session-persistence user journey will exercise `buildRequest` via the same code path; on staging and production the streaming flag is set in [`.env.local`](../../.env.local#L52) / deployment env, so the RF→CEE transform Slice B depends on runs and is correct.

However, this test block is **load-bearing as a regression guard** for Slice B (as the brief notes). While broken it provides no coverage — any future refactor that silently breaks the RF→CEE transform (e.g. changing `observedState` → `observed_state` rename, stripping RF internals, signed-strength derivation) will not be caught by this file until the flag seam is fixed. That is a test-coverage gap, not a live runtime bug.

The broken state also masks related failures: if the streaming path is accidentally disabled or renamed, all 21 tests would still "fail for the same reason" and nobody would notice the new real cause.

---

## 4. Recommended fix scope

**Test update only.** Two reasonable options — either is sound, preference to (a):

**(a) Pin the flag in the test file.** Add near the top of [`useConversation.hook.spec.ts`](../../src/canvas/conversation/__tests__/useConversation.hook.spec.ts):

```ts
vi.mock('../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../flags')>()
  return { ...actual, isOrchestratorStreamingEnabled: () => true }
})
```

This matches the pattern used by every other `useConversation` spec in the directory. One line of intent; makes the block's assumption explicit; survives any env/CI change.

**(b) Assert against whichever spy was called.** Replace `expect(mockStreamTurn).toHaveBeenCalledTimes(1)` with a helper that returns whichever of the two mocks has calls and reads `.mock.calls[0][0]` from it. More change, less clarity about which path is under test — not recommended.

No production code change is warranted. The V4 non-streaming path (`callOrchestratorTurn`) is still a legitimate fallback and the transform works equally on either branch.

**Out of scope for any future fix brief:** do not "fix" by deleting the non-streaming path. Per [`useConversation.ts:2833-2858`](../../src/canvas/conversation/useConversation.ts#L2833-L2858) the non-streaming branch is the documented fallback when the streaming flag is off.

---

## 5. Effort estimate

- **Fix:** ~10 minutes. 1 file, ~5 LOC (`vi.mock` block), no adapter/production changes.
- **Verification:** run the spec file with flag explicitly off (`VITE_FEATURE_ORCHESTRATOR_STREAMING=0 npx vitest run src/canvas/conversation/__tests__/useConversation.hook.spec.ts`) to confirm all 21 tests now pass regardless of env, plus Tier 1 smoke (`npm run typecheck` + `npx vitest run --changed`).
- **Risk:** very low. Mocking the flag is localised to this spec file and mirrors established patterns in the same directory.

---

## 6. Appendix — command transcript

```bash
# Passes locally (.env.local has flag=1)
$ npx vitest run src/canvas/conversation/__tests__/useConversation.hook.spec.ts -t "transforms nodes to CEE format"
[sendTurn] streaming flag: true | source: env | localStorage: null | env: 1
✓ Test Files  1 passed (1) | Tests  1 passed | 54 skipped (55)

# Reproduces brief's failure
$ VITE_FEATURE_ORCHESTRATOR_STREAMING=0 npx vitest run src/canvas/conversation/__tests__/useConversation.hook.spec.ts -t "transforms nodes to CEE format"
[sendTurn] streaming flag: false | source: env | localStorage: null | env: 0
× expected "spy" to be called 1 times, but got 0 times
  at useConversation.hook.spec.ts:347:28

# Shows it's block-wide
$ VITE_FEATURE_ORCHESTRATOR_STREAMING=0 npx vitest run src/canvas/conversation/__tests__/useConversation.hook.spec.ts -t "buildRequest payload"
Tests  21 failed | 34 skipped (55)
```

---

## 7. Amendment (2026-04-17, post-PR-#122-merge)

PR #122 landed commit `331c972a` which pinned **only** `isOrchestratorStreamingEnabled`. That made 20 of the 21 originally-failing tests pass. CI on the merge commit (`a656bd1a`) then surfaced a 21st failure with the same "spy called 0 times" symptom but a distinct root cause — different enough that the original diagnosis missed it.

**Why the original fix was incomplete:**

- **`sendMessage`** (used by the 20 tests that passed) delegates straight to `sendTurn` at [`useConversation.ts:2959`](../../src/canvas/conversation/useConversation.ts#L2959) — no V2 guard. Streaming flag pin alone is sufficient.
- **`sendSystemEvent`** (used by `system event turn also transforms graph_state correctly`) guards on `isOrchestratorV2Enabled()` at [`useConversation.ts:2984`](../../src/canvas/conversation/useConversation.ts#L2984) and early-returns if false. `sendTurn` is never reached; streaming branch never fires; `mockStreamTurn.mock.calls[0]` is `undefined`.

The PR #122 mock used `importOriginal` + override, which preserved the real `isOrchestratorV2Enabled`. In CI without `VITE_ENABLE_ORCHESTRATOR_V2=1`, that flag resolves `false` → system-event test bypasses the asserted path.

**Amended fix** (PR #123, branch `ui/useconversation-hook-spec-system-event-fix`): pin both flags. Mirrors the pattern already used in sibling specs [`useConversation.systemEvents.spec.ts:37-40`](../../src/canvas/conversation/__tests__/useConversation.systemEvents.spec.ts#L37-L40) and [`streamingLifecycle.spec.ts:41-45`](../../src/canvas/conversation/__tests__/streamingLifecycle.spec.ts#L41-L45).

```ts
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorStreamingEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
  }
})
```

Verified locally: 54 passed + 1 skipped with `VITE_FEATURE_ORCHESTRATOR_STREAMING=0` **AND** `=1`. The spec is now fully env-independent for both `sendMessage` and `sendSystemEvent` paths.

**Lesson to carry forward:** when fixing a whole `describe` block that failed with a single symptom, don't assume every test in the block uses the same code path. The 21st test's assertion looked identical but the function under test (`sendSystemEvent`) has a distinct guard that `sendMessage` doesn't. Targeted mock pinning needs to cover every guard on every code path the tests exercise.
