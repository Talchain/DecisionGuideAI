# V5 testing audit — DecisionGuideAI UI

Branch: `claude/v5-testing-audit-and-improvements` (from `origin/staging`).
Scope: read-only audit plus minimal P0 additions. No prompt changes, no PLoT/ISL changes, no CI workflow edits, no env or secret changes. Local commits only.

## 1. Phase 0 — command and gate inventory

| Command | Scope | Network/secrets | Tier | Blocking |
| --- | --- | --- | --- | --- |
| `pnpm test:contracts` | Cross-boundary CEE/V5 contract tests | none | 2 | CI |
| `pnpm test:full` | Vitest unit/integration (`--bail=1`, single thread, 6 GB heap) | none | 2 | CI |
| `pnpm test:coverage` | Coverage collection | none | 2 | CI |
| `pnpm e2e` | Playwright | dev server | 3 | CI (sharded chromium) |
| `pnpm e2e:smoke` | Playwright `e2e/smoke/` (incl. `v5-exclusive-routing.spec.ts`) | dev server | 3 | optional |
| `pnpm e2e:prod-safe` | Production build safety screen | none | 3 | optional |
| `pnpm e2e:perf` | Worker layout p95 probe | none | 4 | informational |
| `pnpm e2e:staging:v5` | Playwright transport gate against the deployed CEE proxy via `request` fixture; uses `playwright.staging.config.ts` (no dev server). Self-skips without `RUN_STAGING_E2E=1` + `STAGING_CEE_PROXY_URL` + `STAGING_CEE_PROXY_ALLOWED_ORIGIN`. **Manual-only — must not be wired into CI as a UI deploy acceptance gate** (see §8). | yes (network) | 3 | manual |
| `pnpm typecheck` | `tsc -p tsconfig.ci.json --noEmit` | none | 1/2 | CI |
| `pnpm lint` | ESLint with brand-token enforcement | none | 1/2 | CI |
| Pre-push hooks | none detected | — | — | — |

About 800 vitest tests + 90 Playwright specs across 91 files. 3 vitest tests skipped in `vitest.config.ts` (jsdom limitations on canvas DOM integration).

## 2. V5 coverage matrix

Coverage state legend used throughout this report:

- ✅ **merged on staging** — protection in place on the branch this audit lands on
- 🟡 **on an unmerged branch** — protection drafted but not yet on staging; gap remains until that branch lands
- ❌ **absent everywhere** — gap; needs a follow-up branch


| Area | Files | Asserts | Gap | Catches a recent failure? |
| --- | --- | --- | --- | --- |
| V5 endpoint resolution | `src/v5/__tests__/v5Adapter.test.ts` | `VITE_V5_ENDPOINT` > `VITE_ORCHESTRATOR_BASE` > `/bff/orchestrate/v2/turn` fallback | live-network rejects | yes |
| V5 timeout selection | `getTimeoutMs.test.ts` | 90 s conversational, 130 s analyse, caller override | actual abort behaviour | partial |
| First-turn draft graph | `applyV5State.fixtures.test.ts` | inline `draft_graph` ingestion, `canvasEmpty` guard | post-render visual coherence | partial |
| Generate / retry / regenerate | `systemEventParity.test.ts` | `patch_accepted` payload | concurrency / cancel | partial |
| Conversation turn | `end-to-end.test.ts` | message send, response parse, store update | depends on mocked transport | partial |
| Response parsing | `responseParser.test.ts`, `.diagnostics.test.ts` | JSON envelope, block structure, validation | non-JSON failure paths only at parser layer | partial |
| Non-JSON raw capture | `responseParser.test.ts` | HTML / text fallback | end-to-end transport classification | partial |
| Source classification | `v5Adapter.test.ts` | Netlify, CEE, proxy, browser_timeout, preflight_or_network, unknown | live-network distinction | yes when adapter is hit |
| Severity-aware routing | `responseRouter.test.ts` (warn-recoverable test landed; `claude/p0-warn-block-recoverable` already merged into staging at `f6f8c108`) | warn-level recoverable vs error-level fatal | drift in copy / class names | yes |
| analysis_ready UI | `applyV5State.test.ts` | set / clear / malformed shape | live ISL variance | partial |
| Analysis freshness | `applyV5State.hardening.test.ts`, `src/lib/__tests__/analysisFreshnessState.test.ts`, `useAnalysisFreshnessState` (P0 branch) | `turnClientId` stale-guard, freshness selector contract | parity with CEE staleness — see CEE audit §8 | partial |
| Graph stale / rerun | `responseRouter.test.ts` + E2E | stale-turn detection, graph expiry | rerun chip presence end-to-end | partial |
| Result completeness / view-model | `useResultCompleteness.test.ts`, `DecisionConfidencePanel.completenessIntegration.spec.tsx`, `useResultsSectionData.ts`, `copy.freshnessReasons.test.ts` (all on `claude/p0-v5-golden-path-integration`) | win-prob / drivers / sensitivity rendering, curated reason copy | rendering verification on actual production data | yes |
| Debug bundle structure | `src/components/debug/__tests__/exportBundle.structure.spec.ts` (P0 branch) | required keys, redacted attributes, RTL render of bundle viewer | secret-pattern matchers across the full export | partial — synthetic-secret matchers not yet asserted |
| Pipeline status derivation | `derivePipelineStatus.test.ts` | scoped status semantics | UI integration with debug bundle | partial |
| Edge proxy headers | `src/v5/__tests__/edge-functions/orchestrator-proxy.headers.test.ts` | allowed forward headers, CORS allow-headers list | Deno runtime behaviour | no — static text match only |
| V5-exclusive routing smoke | `e2e/smoke/v5-exclusive-routing.spec.ts` | zero V1 hits during bootstrap | positive journey assertion | partly — negative-only |
| Result-consumption trace | `docs/v5/wave-4-source-to-render-trace.md` (P0 branch) — diagnostic trace doc | source-to-render data path mapping | none material | yes (trace exists) |
| PLoT / ISL result consumption | `__tests__/audit-runtime-fixes.spec.ts` partial; the P0 branch wires `useResultsSectionData.ts` | view-model adapter | transport-level live response shape | partial |
| Handler action flows | E2E only via `e2e/canvas-authoring.spec.ts` | broad coverage at canvas layer | unit-level action-strip dispatch | partial |
| Decision review | `decisionReviewAdapter.test.ts` (minimal) | adapter shape | rendered fallback presence | partial |
| Design-system / state copy | `ci:guard:duplicates` static audit; no functional test | tokens, dedup | runtime visual coherence | no |
| Payload redaction | redaction code exists; no dedicated unit test | — | full unit coverage | no |
| Golden-path / PoC harness | `tests/contracts/golden-path-fixture.test.ts` | contract shape against fixture | turn-by-turn user journey | partial |

## 3. Phase 0 — concurrent P0 workstream overlap

UI branches inspected:

| Branch | Status | Coverage relevant to this audit |
| --- | --- | --- |
| `claude/p0-v5-golden-path-integration` | active | `docs/v5/wave-4-source-to-render-trace.md`; result-completeness selector + tests (`useResultCompleteness.test.ts`, `DecisionConfidencePanel.completenessIntegration.spec.tsx`); freshness reasons copy (`copy.freshnessReasons.test.ts`); pipeline-status derivation (`derivePipelineStatus.test.ts`); analysis-freshness selector (`analysisFreshnessState.test.ts`); export-bundle structure spec (`exportBundle.structure.spec.ts`); ActionStrip / conversation selectors |
| `claude/p0-warn-block-recoverable` | already merged into staging (commit `f6f8c108`) | severity-aware response routing test landed |
| `claude/p0-debug-bundle-hardening` | already merged into staging (`8ce6b322` plus follow-up `45259f7e`) | debug bundle inspection visibility + fetch error classification |
| `claude/v5-alpha-hardening-ui` | active | safety-net 120 s → 135 s, severity-aware routing (now in staging) |

### Disposition for each P0 in the plan

6. **V5 result-consumption diagnostic-trace test** — 🟡 on an unmerged branch (`claude/p0-v5-golden-path-integration`): trace doc at `docs/v5/wave-4-source-to-render-trace.md`, `useResultCompleteness.test.ts`, `DecisionConfidencePanel.completenessIntegration.spec.tsx`. Until that branch merges, the staging gap remains open. No duplication here.
7. **Severity-aware warn-block rendering** — ✅ merged on staging (commit `f6f8c108`). Reference only.
8. **Debug bundle contract** — partial: 🟡 `exportBundle.structure.spec.ts` on the P0 branch; ✅ debug-bundle-hardening already merged on staging (`8ce6b322` + `45259f7e`). Synthetic-secret matchers across the export are still ❌ absent everywhere → P1.
9. **Hiring-prompt deployed-path smoke** — split:
   - ❌ → ✅ **transport gate** added in this branch as `e2e/smoke/v5-proxy-reachability.spec.ts` (HTTP only via Playwright `request` fixture). Renamed from the original `v5-hiring-prompt.spec.ts` to make its non-journey nature obvious. The canonical equivalent lives in CEE at `tests/staging/proxy-v5-hiring-prompt.smoke.test.ts`; this spec is the operational counterpart so the UI deploy pipeline can run a quick post-deploy gate without a CEE checkout.
   - ❌ **real browser journey smoke** (endpoint resolution, browser CORS, canvas render, result consumption, rerun state, debug export) — tracked as P1. Implementation outline: gate on `RUN_STAGING_E2E=1 + STAGING_UI_URL`, `await page.goto(STAGING_UI_URL + '/#/canvas')`, observe network for `/proxy/v5/turn` POST + 200 + draft graph, assert canvas renders nodes, drive Run Analysis chip, observe results panel renders non-null win probabilities. Author only after confirming a URL-seedable canvas or stable composer selectors.

Net new files this branch lands: **one Playwright transport-gate spec plus this audit report**.

## 4. Phase 1 — quality classification

Test classification:

| File | Classification | Note |
| --- | --- | --- |
| `e2e/smoke/v5-exclusive-routing.spec.ts` | staging-smoke + contract | strong negative gate; needs paired positive journey smoke |
| `e2e/smoke/v5-proxy-reachability.spec.ts` (new) | staging-smoke + contract | transport gate only — HTTP via Playwright `request` fixture, **not** a UI journey; do not count as UI product-confidence |
| `src/v5/__tests__/v5Adapter.test.ts` | component | mocks fetch; cannot catch live transport regressions |
| `src/components/results/__tests__/useResultCompleteness.test.ts` | product (after P0 merge) | view-model coverage of result rendering |
| `src/components/debug/__tests__/exportBundle.structure.spec.ts` | contract + product | structure asserted; secret-matcher assertion not yet present |
| `src/canvas/conversation/__tests__/selectors.test.ts` | component | scoped selector logic |
| `tests/contracts/golden-path-fixture.test.ts` | contract | fixture-shape only |
| `src/lib/__tests__/analysisFreshnessState.test.ts` | contract + product | freshness selector |
| `src/v5/__tests__/edge-functions/orchestrator-proxy.headers.test.ts` | component | static text match only; no Deno runtime |

Headline: the V5 weakness is not test volume but the absence of a positive deployed-path journey gate. The negative routing smoke proves the UI does not call V1; nothing currently proves the deployed proxy reaches CEE and returns a usable envelope through the same DOM.

## 5. Phase 2 — target tier model

| Tier | Trigger | Command | Blocking | Budget |
| --- | --- | --- | --- | --- |
| 1 Local focused | every change | `pnpm typecheck` + `pnpm vitest run <touched>` + lint touched | dev-only | < 60 s |
| 2 Pre-merge | local before push | `pnpm test:full` + `pnpm test:contracts` + `pnpm e2e:smoke` | yes | < 8 min |
| 3 Deployed-path transport gate | post-staging-deploy / explicit | `RUN_STAGING_E2E=1 STAGING_CEE_PROXY_URL=… STAGING_CEE_PROXY_ALLOWED_ORIGIN=… pnpm e2e:staging:v5` (the new spec self-skips otherwise) | manual | < 2 min |
| 4 Visual / journey | scheduled | journey-driven Playwright spec — P1 once a URL-seedable canvas or stable composer selectors are verified | informational | nightly |

## 6. Phase 3 — recommendations

### P0 — must hold for V5 PoC

| # | Test | Status | Catches |
| --- | --- | --- | --- |
| 6 | result-consumption diagnostic trace + view-model assertions | 🟡 unmerged branch | null win-probabilities / sensitivities / drivers in UI; UI-SEM fabrication |
| 7 | severity-aware warn-block | ✅ merged on staging | recoverable warn block rendered as fatal |
| 8 | debug bundle contract | partial — 🟡 structure spec on P0 branch, ✅ hardening already in staging | incomplete or contradictory debug bundles; missing-section rendering |
| 9a | proxy reachability transport gate (HTTP via `request` fixture, OPTIONS + POST) | ✅ added in this branch | OPTIONS 500 regression (c73d1469); CEE proxy host outages on the deployed transport; CORS Allow-Headers drift; x-request-id rewrite by intermediate middleware. **Must not be wired in as a UI deploy acceptance gate** — see warning below. |
| 9b | real-browser journey smoke (endpoint resolution, render, results, rerun, debug export) | ❌ deferred to P1 | UI deploy regressions where the bundle uses the wrong endpoint or the canvas does not render |

### P1

- journey-driven Playwright E2E that drives DraftChat with the hiring brief end to end, using verified composer selectors against staging.
- secret-pattern matcher assertions on `exportBundle` output (synthetic secrets only), extending `exportBundle.structure.spec.ts`.
- live-network classification tests using Playwright `request` fixtures rather than mocked `fetch`.
- Edge proxy Deno runtime test pack (currently static text match only).

### P2

- prune Playwright stale specs (`canvas-authoring.spec.ts` and friends — verify against current canvas).
- consolidate snapshot-style assertions away from the freshness copy module to a single source of truth.
- per-file coverage thresholds for `src/v5/`.

## 7. Golden-path coverage matrix (UI columns)

| Step | UI-unit | UI-E2E | Notes |
| --- | --- | --- | --- |
| 6 graph render after draft_graph | partial (`applyV5State.fixtures.test.ts`) | partial (canvas-authoring) | DOM tests skipped due to jsdom limits |
| 9 results displayed | covered after P0 merge (`useResultCompleteness`, `DecisionConfidencePanel.completenessIntegration`) | partial | view-model layer assured |
| 15 rerun chip clear | partial | none | verify with journey E2E (P1) |
| 18 debug bundle | `exportBundle.structure.spec.ts` | partial | secret-matchers are P1 |
| 19 no internal vocabulary in prose | partial (DS guards) | partial | strongest CEE-side gate via golden-path-acceptance + forbidden-terms |

## 8. Risks and constraints

- Local commits only. No push, no deploy, no env or secret rotation, no prompt edits, no PLoT/ISL changes.
- **Do not wire `e2e:staging:v5` in as a UI deploy acceptance gate.** The transport-gate spec proves the CEE proxy is reachable and well-formed; it does **not** prove the deployed UI bundle is configured to use that proxy. A UI deploy can be totally broken (wrong `VITE_V5_ENDPOINT`, missing flag, stale chunk) while this spec stays green. Use the existing `e2e/smoke/v5-exclusive-routing.spec.ts` (negative gate proving zero V1 hits during bootstrap) plus the real-browser journey smoke tracked as P1 (item 9b) for UI deploy acceptance.
- The new staging smoke is HTTP-only against the CEE proxy. A journey-driven Playwright spec that drives DraftChat through the full hiring brief is deferred to P1: composer selectors and staging coordination are not safe to author without verification, and a fragile journey test would create false confidence.
- The new smoke depends on `BROWSER_PROXY_ALLOWED_ORIGINS` on the CEE host containing the configured staging origin; environment gaps surface on first run and are reported, not auto-fixed.

## 9. Confirmation

This audit is read-only review plus one new HTTP-level Playwright transport-gate spec (`e2e/smoke/v5-proxy-reachability.spec.ts`) and one new package-script (`e2e:staging:v5`). Items 6 and 8 are 🟡 on `claude/p0-v5-golden-path-integration` and remain a staging-coverage gap until that branch lands. Item 7 is ✅ merged on staging. Item 9 is split: the transport-gate half is added here; the real-browser journey half is ❌ deferred to P1.
