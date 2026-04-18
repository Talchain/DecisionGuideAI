# Overnight chat 1 — morning handoff

**Brief:** mossy-shore (overnight CI coverage audit + test cascade resolution).
**Date:** 2026-04-18.
**Primary artefact:** `docs/ui/overnight-chat-1-evidence-pack.md` (full detail).

---

## What shipped

| D | Description | Branch | Commit | PR | Status |
|---|---|---|---|---|---|
| D1 | CI coverage audit | `ui/ci-test-coverage-audit` | `53bf7725` (also cherry-picked to hub as `685b75ad`) | — | Committed, pushed |
| D2 | Remove `--bail=1` from staging-full-tests | `ui/ci-coverage-fix` | `57bc318b` | **[#125](https://github.com/Talchain/DecisionGuideAI/pull/125)** | PR open, **awaiting Paul merge** |
| D3 | Cascade enumeration | `ui/test-cascade-enumeration` | `46189a63` | (no PR; reference branch) | Doc + cascade.json committed |
| D4 | 5-file MSW env-drift batch fix | `ui/msw-env-drift-batch-fix-v2` | `18b42938` → `8b1af916` (amended after ChatGPT P0.1 review) | **[#126](https://github.com/Talchain/DecisionGuideAI/pull/126)** | PR open, **depends on #125 merging first** |
| D1 addendum | `poc-pr.yml` + `poc-sweep.yml` added to workflow inventory (ChatGPT P1.2) | `ui/overnight-ci-and-tests` | tip | — | Rolls up into hub PR |
| Hub | Plan doc + evidence pack + summary | `ui/overnight-ci-and-tests` | `ffd7fe2d` → tip | — | Pushed; open PR after morning cleanup |

No merges happened overnight. Paul approval needed for #125 → then #126 → then hub.

---

## What halted

| D | Halt reason |
|---|---|
| D5 | No candidate meets "trivially fixable AND unambiguously test-mock AND no production code". All 14 failing files require Paul judgment or production changes. Evidence pack §D5 tabulates each. |
| D6 | Pre-merge verification would re-run D3 for no additional information. Defer to post-merge follow-up chat. |

---

## Metrics

| Metric | Pre-overnight (from audit) | Post-overnight local | Post-merge (expected) |
|---|---|---|---|
| CI files run (staging) | ~100 | n/a (#125 unmerged) | ~755 (post-#125) |
| CI files reported skipped | 653 (bail artefact) | n/a | 4 (real `it.skip`) |
| Local files failing | 14 | 14 | ~9 (post-#126: 14 − 5) |
| Local tests failing | 60 | 60 | ~40 (post-#126) |
| Local test total | 11,723 | 11,712 | 11,712 |
| Local run duration | ~19 min | 19.97 min | same |

Failing-test reduction numbers are estimates: if the 5 D4 files have an average ~4 failing tests in CI each, #126 drops the cascade by ~20 tests. Post-merge D6 verification will measure the real reduction.

---

## Questions for Paul (priority-ordered)

See evidence pack §Deferred items for the full list. Top five:

1. **Merge #125?** (required to unmask real cascade in CI.)
2. **Merge #126 after #125?** (removes ~20 tests from cascade, test-only diff. Includes ChatGPT P0.1 fix for `determinism.test.ts` and direct env-unset evidence per P0.2.)
3. **Markdown spec (26 tests failing)** — is this a rendering pipeline regression or test-setup issue? Fastest diagnostic: `npx vitest run src/canvas/utils/__tests__/markdown.spec.ts -t "converts italic text"` and inspect whether raw markdown is returned vs rendered HTML.
4. **`batchUpdateNodes` method missing (3 tests)** — was this renamed/removed intentionally? Find the replacement and decide test-update vs store-restore.
5. **Assertion drift across 7 UI files** — per-file decision on whether current UI is intentional (update tests) or regression (restore UI).

### ChatGPT external review — amendments made overnight

Three of ChatGPT's 8 points identified real issues and were addressed before morning:

- **P0.1** `determinism.test.ts` re-stub bug → fixed in `8b1af916` on D4 branch
- **P0.2** direct env-unset verification gap → ran with `.env.local` renamed, 49/49 green, evidence attached to PR #126
- **P1.2** audit workflow inventory missing `poc-pr.yml` / `poc-sweep.yml` → addendum added to `docs/ui/ci-test-coverage-audit.md` §2.3

Two partial-disagreements documented in evidence pack §Post-overnight review:

- **P1.1** (5 vs 7 env-drift files) — kept split because the 2 deferred files are a different code path (`new URL()` in `useGraphReadiness.ts`, not MSW stub). Labelled as "D4b candidates" for a follow-up PR.
- **P1.3** (halt gating policy) — brief text is ambiguous; documented our interpretation for Paul's morning review.

Three ChatGPT "improvements" (shared helper, CI guard for test-count floor, sharding) are out of overnight scope and captured as follow-ups.

---

## Blockers

- **#125 merge** blocks everything else in the cascade resolution sequence. Until it merges, CI has no visibility into the real failure list, and #126's correctness cannot be verified in CI.
- **Markdown pipeline regression (26 tests)** is the largest single failure cluster. It may affect chat/markdown rendering in production, not just tests. Worth early attention in the morning.

---

## Next dispatch (recommendation)

A follow-up chat after morning merges to:
- Merge #125 (after Paul's review).
- Merge #126 (after #125 is green-plus-one-cycle).
- Dispatch D6 properly: full suite local + CI on post-merge staging, capture before/after metrics.
- Open the assertion-drift items as a per-file triage, with Paul's copy intent for each.
- Investigate the markdown pipeline failure as priority 1 (production-code investigation allowed, separate from overnight D1-D6 test-only scope).
- Consider a short "D4b" PR bundling the two additional env-drift candidates (`OutputsDock.analysis-run`, `patchAcceptLogic`) once the D4 pattern is confirmed green in CI.

---

## Stash safety

`stash@{0}` on `ui/ci-test-coverage-audit`: `P1.2 pre-analysis WIP - stashed for overnight CI work`. Fingerprint captured in `~/.claude/plans/overnight-brief-mossy-shore.md`. To restore:

```bash
git stash show -p stash@{0} | head -c 500   # verify fingerprint match
git stash pop stash@{0}
```

Stash list unchanged overnight; still at position `{0}`.

---

## Branches pushed overnight

- `ui/ci-test-coverage-audit` — audit commit
- `ui/overnight-ci-and-tests` — hub (docs)
- `ui/ci-coverage-fix` — D2
- `ui/test-cascade-enumeration` — D3
- `ui/msw-env-drift-batch-fix-v2` — D4

No force-pushes. No deletions. No merges. Original `ui/msw-env-drift-batch-fix` local branch preserved intact (contains the source commit `07b7a971` cherry-picked into v2 as `18b42938`).

---

## Self-review audit trail

All deliverables have both rounds written in evidence pack sections §D1, §D2, §D3, §D4. D5 is an explicit halt decision (not a "clean" round). D6 is deferred (morning work, not overnight).

All rounds decisive outcomes: D1 proceed · D2 proceed · D3 halt per spec · D4 proceed · D5 halt · D6 deferred.

---

*End of handoff. Evidence pack has full detail.*
