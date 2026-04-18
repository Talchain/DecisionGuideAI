# Overnight chat 1 — restated understanding and dispatch order

**Brief:** overnight CI coverage audit + UI test cascade resolution (mossy-shore).
**Date:** 2026-04-18.
**Branch (hub):** `ui/overnight-ci-and-tests` off `staging` @ `dcc5ce1b`.
**Governing docs:** `docs/ui/ci-test-coverage-audit.md` (D1 output, committed upstream as `53bf7725`, cherry-picked on hub as `685b75ad`); CC Dev Standards v3; prior `docs/ui/useconversation-spec-diagnosis.md`.
**Non-interactive:** Paul is asleep. Halt-and-wait on every brief-mandated halt condition.

---

## 1. Understanding

Staging CI reports ~100 tests run / 653 files "skipped"; local baseline is 755 files / 11,723 tests / 14 files failing / 60 tests failing. The 653-file gap is a reporting artefact of `--bail=1` at `.github/workflows/staging-full-tests.yml:112`, not a structural exclusion. Every fix merged over the past weeks has surfaced the next bail point, creating an artificial cascade.

Tonight: close the visibility gap (D2), enumerate the real failure list (D3), batch-fix the environment-drift cluster (D4), handle trivial test-mock fixes only (D5), verify stability (D6). Produce a morning handoff doc.

## 2. Decisions captured in planning

- **D2 option:** remove `--bail=1` outright (audit §5.1). Reasoning: full cascade visibility is higher value than CI-minute savings during the current red-suite phase. Revisit bail policy once cascade is clean.
- **Uncommitted P1.2 work:** stashed as `stash@{0}` with label `P1.2 pre-analysis WIP - stashed for overnight CI work`. Fingerprint captured for morning restoration.
- **Reuse of `ui/msw-env-drift-batch-fix` local branch:** inspect first at D4 and cherry-pick (with SHA provenance recorded) if D3's env-drift cluster matches.

## 3. Branch strategy

| Branch | Purpose | Off | Merge strategy |
|---|---|---|---|
| `ui/ci-test-coverage-audit` | D1 audit (already committed `53bf7725`) | staging | not merged directly; cherry-picked onto hub |
| `ui/overnight-ci-and-tests` (HUB) | docs only (plan, evidence pack, cascade findings, summary) | staging @ `dcc5ce1b` | PR in morning |
| `ui/ci-coverage-fix` | D2 — one-line yml change | staging | PR open, **DO NOT MERGE** until Paul approves in morning |
| `ui/test-cascade-enumeration` | D3 — cascade.json + findings doc | staging | docs-only, may fold into hub branch |
| `ui/msw-env-drift-batch-fix-v2` | D4 — batch MSW fixes | staging (updated after D2) | PR; auto-merge permitted per brief §4 push discipline if all criteria hold |
| `ui/final-state-verification` | D6 | staging (updated) | docs + verification artefacts |

## 4. Dispatch order

1. **Pre-exec** (done at plan-signoff time): stash P1.2, fast-forward staging, create hub branch, cherry-pick audit.
2. **D1 self-review** into evidence pack (audit already exists).
3. **D2** on its own branch. Validate locally. Open PR. No merge.
4. **D2 self-review** into evidence pack.
5. **D3** cascade enumeration on its own branch (or on hub since docs-only). Full suite with `2>&1 | tee /tmp/cascade-raw.txt` as OOM safety net.
6. **D3 self-review**. **Hard halt** per brief §2 (D3 ends at enumeration).
7. **D4** conditional on D3 env-drift cluster ≥3. Record cherry-pick provenance in evidence pack §D4.
8. **D4 self-review**. Auto-merge permitted iff all brief §4 criteria.
9. **D5** only for trivial test-only fixes; halt any touching production.
10. **D6** final verification + morning handoff.

## 5. Halt conditions (reference; applied as they arise)

- New cascade tier post-merge → back to D3
- Test count unexpectedly diverges from baseline
- Any fix requiring production code → halt
- Assertion drift reflecting real behaviour → halt
- Unknown failure category in D3 → halt
- Workflow YAML trigger change — never (only internal job config)

## 6. What this dispatch does NOT do

- Never touches production code
- Never modifies CEE or schemas repos
- Never changes CI triggers, only internal config line
- Never pushes without either Paul approval (D2 + hub) or meeting §4 auto-merge criteria (D4+)
- Never force-pushes, deletes branches, disables jobs, restructures workflows
- Never adds `@ts-ignore` / `eslint-disable` / skipped tests

---

*End of restated understanding. Evidence pack lives at `docs/ui/overnight-chat-1-evidence-pack.md` — populated per-deliverable with two written self-review rounds.*
