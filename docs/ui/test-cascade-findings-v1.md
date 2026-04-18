# Test cascade findings v1

**Date:** 2026-04-18
**Branch:** `ui/test-cascade-enumeration` off `staging` @ `dcc5ce1b`
**Input:** `cascade.json` (3.3 MB) + `/tmp/cascade-raw.txt` (verbose reporter)
**Run command:**

```bash
NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --reporter=verbose --reporter=json --outputFile=cascade.json
```

**Duration:** 19.97 min.
**Top-line:** 14 files failed / 734 passed / 4 skipped (755) · 60 tests failed / 11,565 passed / 49 skipped (11,712) · 5 errors.

---

## 1. Important caveat: local cascade ≠ CI cascade

This enumeration ran locally. `.env.local` sets `VITE_PLOT_PROXY_BASE=/api/plot`, so MSW-based tests against `/bff/cee` or `/api/plot` routes pass locally. **In CI (where this env var is unset), an additional class of env-drift failures surfaces.** The audit (§6, §170) confirms this is the root cause of the "cascade" feel — bail was hiding the env-drift class, local dev never sees it.

**Known env-drift cluster (not in this local cascade, but will appear in CI once D2 merges):**

1. `src/adapters/plot/__tests__/autoDetectAdapter.streaming.test.ts`
2. `src/adapters/plot/__tests__/determinism.test.ts`
3. `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts`
4. `src/adapters/plot/__tests__/httpV1Adapter.limits.spec.ts`
5. `src/adapters/plot/__tests__/v1_1_contract.spec.ts`

Existing fix on local branch `ui/msw-env-drift-batch-fix` (commit `07b7a971`) — adds `vi.stubEnv('VITE_PLOT_PROXY_BASE', PROXY_BASE)` in `beforeEach`. Pattern verified against sibling `httpV1Adapter.stream.test.ts` (fix merged as `9e4036a6`).

**Two additional env-drift candidates surfaced by D2 validation's 5-error tail:**

6. `src/canvas/components/__tests__/OutputsDock.analysis-run.spec.tsx` — URL parse error on `/bff/cee/graph-readiness`
7. `src/canvas/conversation/__tests__/patchAcceptLogic.spec.tsx` — same URL parse error

Both originate in `src/canvas/hooks/useGraphReadiness.ts:76` where `new URL(url)` is called on an env-derived relative path. Pattern is the same class; fix is the same shape (stub the env var or mock the URL).

---

## 2. Local cascade — 14 failing files (60 tests)

| # | File | Fails | Category | Complexity | Notes |
|---|---|---|---|---|---|
| 1 | [src/__tests__/wave2-replay-gate.spec.ts](src/__tests__/wave2-replay-gate.spec.ts) | 2 | real regression (code-quality gate) | needs investigation | Expects ≤6 `as any` casts in `useResultsSectionData.ts`; found 14. Test enforces a design constraint. Either casts need cleanup or threshold needs bump |
| 2 | [src/canvas/__tests__/british-english.spec.ts](src/canvas/__tests__/british-english.spec.ts) | 1 | real regression (content drift) | small | Expected 0 American spellings of "behaviour"; found 1. Someone introduced "behavior" somewhere |
| 3 | [src/lib/__tests__/sse-params.test.tsx](src/lib/__tests__/sse-params.test.tsx) | 1 | assertion/mock mismatch | needs investigation | `fetchRunReport` spy expected 1 call, got 0. Either behaviour changed or mock setup stale |
| 4 | [src/pages/__tests__/ScenarioListPage.spec.tsx](src/pages/__tests__/ScenarioListPage.spec.tsx) | 4 | assertion drift | medium | Missing testids: `empty-state` (2×), `scenario-row`; missing text `"Analysis run — Option A won at 73%"`. UI markup changed, tests stale |
| 5 | [src/canvas/conversation/__tests__/conversationCss.spec.ts](src/canvas/conversation/__tests__/conversationCss.spec.ts) | 2 | assertion drift | small | CSS string assertions: expected `--success` border and `olumi-scrollbar …` classname; not present in current CSS |
| 6 | [src/canvas/conversation/__tests__/integratedPath.brief2026-04-10.spec.ts](src/canvas/conversation/__tests__/integratedPath.brief2026-04-10.spec.ts) | 3 | real regression (API change) | needs investigation | `useCanvasStore.getState(...).batchUpdateNodes is not a function`. Method removed or renamed on the store |
| 7 | [src/canvas/domain/__tests__/nodes.spec.ts](src/canvas/domain/__tests__/nodes.spec.ts) | 1 | assertion drift | trivial | Action node default size expected `{220,100}`; got `{180,70}`. Defaults changed |
| 8 | [src/canvas/components/__tests__/InsightsPanel.spec.tsx](src/canvas/components/__tests__/InsightsPanel.spec.tsx) | 2 | assertion drift | small | Missing text "Recommended Next Steps"; missing `role="list"` with name. Panel structure changed |
| 9 | [src/canvas/utils/__tests__/edgeIdentity.regression.spec.ts](src/canvas/utils/__tests__/edgeIdentity.regression.spec.ts) | 3 | real regression (threshold logic) | needs investigation | `switch_probability=0.25/0.30` expected to return `undefined` (below threshold); now returning the edge. Related to UI-SEM-013 fragile-edge threshold (0.3) per CLAUDE.md. Likely threshold semantics changed (`<` vs `<=`) |
| 10 | [src/canvas/utils/__tests__/markdown.spec.ts](src/canvas/utils/__tests__/markdown.spec.ts) | **26** | real regression (rendering pipeline) | medium-to-large | Markdown-to-HTML conversion wholesale broken: italics, inline code, lists, code blocks, blockquotes, headings not producing `<em>/<code>/<ol>/<pre>/<blockquote>/<h1>`; XSS sanitisation not stripping `script/onclick/iframe/javascript:/data:/vbscript:`. Raw source returned. **High-priority** — large blast radius across chat/markdown rendering. Needs root-cause analysis |
| 11 | [src/components/assistants/__tests__/ClarifierPanel.spec.tsx](src/components/assistants/__tests__/ClarifierPanel.spec.tsx) | 1 | assertion drift or regression | small | Progress-indicator filled-bar count: expected ≥2, got 0. Could be UI change or state mock |
| 12 | [src/components/results/__tests__/no-message-render.spec.ts](src/components/results/__tests__/no-message-render.spec.ts) | 2 | KNOWN-BROKEN per CLAUDE.md | skip/defer | CLAUDE.md documents this file. `AdvancedSection.tsx` and `ConfidenceSection.tsx` render critique `.message` in JSX. Memory indicates it was 1 failure on 2026-04-08; now 2. **Known; not for overnight fix** |
| 13 | [src/canvas/components/RecommendationCard/__tests__/RecommendationCard.spec.tsx](src/canvas/components/RecommendationCard/__tests__/RecommendationCard.spec.tsx) | 3 | assertion drift | small | Missing text "Generating recommendation…", "Could not generate recommendation", "Recommended Action". Copy changed |
| 14 | [src/pages/sandbox-guide/components/panel/sections/__tests__/VerificationBadge.test.tsx](src/pages/sandbox-guide/components/panel/sections/__tests__/VerificationBadge.test.tsx) | 9 | assertion drift | small-medium | All 9 tests expect "Review Recommended" text. Badge copy/conditional rendering changed |

---

## 3. Clusters

### 3.1 Unblocker cluster

**None.** No single fix unlocks further test discovery. Bail is already removed (D2), so the full cascade is visible. Markdown (26 tests) is the largest single file but fixing it doesn't unblock others — they're independent.

### 3.2 High-confidence batch-fix cluster — ENV-DRIFT (7 files, test-only)

**Files:** 5 on `ui/msw-env-drift-batch-fix` + 2 surfaced by D2's URL-parse errors.
**Pattern:** identical — `vi.stubEnv('VITE_PLOT_PROXY_BASE', PROXY_BASE)` in `beforeEach` (or equivalent for the `useGraphReadiness` path).
**Test-only:** yes.
**Diff per file:** <20 lines.
**Cluster ≥3:** yes, 7 files.
**D4 eligibility:** **meets brief §2 D4 threshold.** Recommend D4 dispatch, with Paul morning approval required because D4 depends on D2 landing before CI can verify green.

### 3.3 Assertion drift cluster (7 files, ~22 tests)

Files: `ScenarioListPage`, `conversationCss`, `nodes`, `InsightsPanel`, `ClarifierPanel`, `RecommendationCard`, `VerificationBadge`. All test expectations drifted from current UI copy/structure/classnames.

**Not batchable.** Each file requires reading the current component to verify what it actually renders, then updating testids/copy/expectations. Some may reflect real product-behaviour changes requiring Paul's input on intended UI copy. **Defer to Paul** — these are D5 candidates IF they're trivially mechanical; many will be Ambiguous.

### 3.4 Real regression / API-change cluster (3 files, ~30 tests)

- `wave2-replay-gate`: `as any` casts grew past gate threshold — code quality drift
- `integratedPath.brief2026-04-10`: `batchUpdateNodes` method missing — canvas store API change
- `markdown.spec`: markdown rendering wholesale broken — rendering pipeline regression or test setup issue

**Needs production-code investigation.** Per brief §4, any fix touching production code is a halt. **Defer to Paul.**

### 3.5 Threshold/semantics cluster (1 file, 3 tests)

- `edgeIdentity.regression`: `switch_probability` threshold at 0.3 — inclusion semantics changed (`<` vs `<=`). References UI-SEM-013. Could be test drift OR intentional product change.

**Ambiguous.** Defer to Paul.

### 3.6 British-English content drift (1 file, 1 test)

- `british-english.spec.ts`: one "behavior" found where "behaviour" expected. Mechanical to fix BUT requires a production-code change (renaming a variable/string). **Defer to Paul** — brief forbids production changes in D5.

### 3.7 KNOWN-BROKEN (1 file, 2 tests)

- `no-message-render.spec.ts`: CLAUDE.md documents this as known-broken (memory note from 2026-04-08). Count has grown from 1 to 2. **No action tonight** — already tracked.

---

## 4. Recommended next deliverable action

**Proceed to D4 with Paul-approval gating** — env-drift cluster meets D4 threshold (§3.2). D4's PR should open but NOT auto-merge; it depends on D2 landing first.

**HALT D5** — all assertion-drift and real-regression candidates either:
- Require production code changes (forbidden in D5 per brief)
- Require judgment calls on intended UI copy (ambiguous; Paul decision)
- Are KNOWN-BROKEN (tracked elsewhere)

Per brief §2 D3: **halt after enumeration**. This doc + `cascade.json` is the D3 deliverable. D4 dispatch decision deferred to Paul's morning review, informed by this doc.

---

## 5. Artefacts

- `cascade.json` (3.3 MB) — full vitest JSON report (this directory)
- `/tmp/cascade-raw.txt` — verbose-reporter tee capture (OOM safety net)
- D2 PR: https://github.com/Talchain/DecisionGuideAI/pull/125
- Audit: `docs/ui/ci-test-coverage-audit.md` (on `ui/ci-test-coverage-audit` + cherry-picked to hub)
- Evidence pack: `docs/ui/overnight-chat-1-evidence-pack.md` (on hub `ui/overnight-ci-and-tests`)
