# V6 BUILD PLAN — Analysis-tab v6 lane slicing, flag strategy, tests, decisions, risks

**Inputs:** `ANALYSIS-TAB-BUILD-BRIEF.md` (intent authority), `V6-BUILD-SPEC.md` (prototype contract),
`V6-STAGING-MAP.md` (component verdicts), `V6-DATA-MATRIX.md` (wire verdicts) — all in this directory.
**Baseline:** the three analyst docs are cited against `origin/staging @ dbd6be9d`; head verified
**`f7a52a0c`** at planning time (2026-07-15) — **T1 (#322), T2 (#326) and C3 (#320) have already
squash-merged**, so their outcomes are baseline facts, not preconditions. Every lane branches from
the **live** origin/staging head at branch time, in a **fresh worktree**, after its remaining
precondition lanes have merged. Line anchors drift with each merge (at f7a52a0c the ResultsBody
mounts sit at: hero :277, strengthen :317, "Your options" :342, Drivers :423, Tornado :472) —
anchors below cite dbd6be9d unless marked otherwise; re-derive at branch time.

**Central planning fact (from the staging map):** v6 is not greenfield. Waves 1–3a already shipped the
v6 stack (DecisionOverviewCard + ActionsMenu, AnalysisFreshnessNotice, analysis-hero merged panel with
lenses/evidence disclosure/next-route, Strengthen stack + lifecycle store, DefineSuccess/DecisionRecord
modals, AskOlumiDrawer) and staging's flag config already runs it. The v6 build is therefore:
**(a) composition** — retire the legacy surfaces that still co-mount; **(b) receipts adaptation**;
**(c) small fidelity fixes** (Strengthen container defects, drawer titling); **(d) fixtures + QA + flip**.
Producer-gap elements (trade-offs, per-option stability, versioned what-changed, option-similarity,
evidence-quality meta, classification pills, direct brief edit) ship as the already-implemented
fail-closed honest placeholders — no lane below builds them.

---

## 0. Preconditions — in-flight lanes merge FIRST

The v6 lanes rebase on these; where a v6 lane touches the same file cluster it is sequenced after the
conflicting lane and must compose with its outcome, not fight it. Status verified against
origin/staging `f7a52a0c` + `gh pr list` on 2026-07-15:

| In-flight lane | Status @ f7a52a0c | File cluster | Conflicts with v6 lane |
|---|---|---|---|
| T1 rank-badge | **MERGED** (#322) | `useResultsSectionData.ts` numbering + display-order pin | none direct (V3 reads its outputs via props) |
| T2 receipts | **MERGED** (#326) | `mapV5AnalysisToReport.ts` (seed fail-closed null, robust_edges absent-vs-empty), hydration, envelope wiring | **V3 semantic dependency — satisfied.** V3 asserts fail-closed seed, never re-fabricates |
| T3 guidance | **OPEN draft PR #321** | `DecisionOverviewCard.tsx`, `StrengthenPanel.tsx`, `buildRecommendations.ts` (verified file list; does NOT touch StrengthenContainer) | **V4, V5** — both rebase after T3 |
| C1 rerun-single-owner | **UNSTARTED** (no PR) | `AnalysisHeroPanel.tsx`, `OutputsDock.tsx` | **V2** — rebases after C1; if C1 is descoped, V2 proceeds off head with extra care at the rerun call sites |
| C2 StyledEdge labels | OPEN draft PR #324 | `StyledEdge.tsx` + `edgeLabelCollision.ts` (canvas only) | none |
| C3 FactorNode units | **MERGED** (#320) | `FactorNode.tsx` prior-range rendering | none |
| C4 DriversSection/MetricPills disclosure | **OPEN draft PR #325** | `DriversSection.tsx`, `MetricPills.tsx`, `FactorNode.tsx`, `useNodeDisplayMetadata.ts` | **V1** — the retirement gate lands after C4 merges (flag-off keeps DriversSection live, so C4's work is not wasted; the canvas MetricPills half of C4 is untouched by v6 anyway) |

Discipline per repo convention: each lane = fresh worktree off origin/staging, RED-first, DRAFT PR,
adversarial review, CI shard logs, squash-merge, `git ls-remote` confirmation of the remote head.

---

## 1. Lane slicing (6 lanes, dependency-ordered)

### Lane V1 — `analysisTabV6` flag + ResultsBody composition (retirements behind the flag)

**After:** C4 (#325) merged (T1 already landed). **First v6 lane** — it introduces the flag every
later lane gates on.

**Files:**
- `src/flags.ts` — add `analysisTabV6` entry (§2 below) + resolved gate helper.
- `src/components/results/ResultsBody.tsx` — gate behind `!isAnalysisTabV6Enabled()`:
  - Options-comparison section (`SectionHeader "Your options"` + RiskAppetiteFilter + WinGauge + OptionCards, :337–409)
  - Drivers accordion + `DriversSection` mount (:412–437) — **`driverDisplayModel.ts` untouched** (shared SSOT for hero evidence + canvas badge)
  - Tornado accordion + `TornadoChart` (:440–484)
  - `StressTestSection` (:488–538)
  - `WhatChangedChip` (:268) — contradicts the no-local-approximation doctrine
  - Adjustments-made `<details>` (:569–585) — per ruling D5 (fold into receipts later or gate now)
- New `src/components/results/__tests__/resultsBody.v6Composition.spec.tsx`.

**Adapts/replaces:** replaces the standalone DriversSection surface with the (already-shipped) hero
evidence Drivers tab; retires four legacy sections *behind the flag only*. Flag-off is byte-identical
(repo convention: pinned by test).

**Explicitly untouched:** AnalysisOrphanBanner (:253) and InferenceWarningStrip (:263) stay mounted
(honesty surfaces, confirm in D6); AnalysisHeroContainer, StrengthenContainer, AdvancedSection stay.

### Lane V2 — OutputsDock composition: post-run footer retirement + chrome cleanup

**After:** C1 and V1 merged. Single OutputsDock lane — nothing else may touch this 2,400-line hotspot.

**Files:**
- `src/canvas/components/OutputsDock.tsx`:
  - Gate the post-run `AnalysisFooter` mount (:2277–2292) behind `!isAnalysisTabV6Enabled()`; the
    `suppressAnalysisFooterForOrphanBanner` interlock (:720–725) stays intact for flag-off.
    `AnalysisFooter` the component is NOT retired — the pre-run `StickyFooter` still uses it.
    `derivePostFooterStatus` (postAnalysisFooter.ts) is NOT retired — V3 reuses it as the receipt mapping.
  - Chrome retire-candidates, each per its D-ruling (D5): `ai-panel-transition-receipt` (:1787–1796),
    `stale-results-banner` (:2160–2171 — freshness strip owns staleness), `conv-results-indicator`
    (:2178–2191), `IdentifiabilityBadge` (:2083–2092 — already a receipt row). `WarningBanner` vs
    `InferenceWarningStrip` overlap and `DegradedStateBanner` need rulings before touching; default is KEEP.
  - If D4 rules the overview mounts pre-run/conflict states: the `!isPreRun && hasInlineSummary`
    gate change at :2203 lands **here**, not in V5, so OutputsDock has exactly one lane.

**Adapts/replaces:** freshness strip + Actions menu become the only Rerun surfaces post-run (both exist);
robustness verdict moves from sticky footer to receipts (V3).

### Lane V3 — Advanced receipts adaptation

**After:** V1 merged (ResultsBody prop seam). T2's seed/robust_edges semantics already landed
(#326 verified at f7a52a0c: V5 path `meta.seed` fails closed to null, robust/fragile edge keys
absent when the producer sent none, honest 0 preserved).

**Files:**
- `src/components/results/AdvancedSection.tsx` — the ADAPT verdict:
  - **Result stability row:** key on producer `robustness.display_verdict` via the
    ROBUSTNESS-VERDICT-CONTRACT mapping (`derivePostFooterStatus`, postAnalysisFooter.ts:8–37 —
    robust → "Stable result", moderate/fragile → "Sensitive to assumptions", not_assessed →
    "Robustness not assessed", missing → "Robustness unknown"). The calibrated "Tentative" tier
    (`calibrateUncertaintyCopy`) may render as neutral meta beside a determinate verdict, never alone.
  - **Stop sourcing `recommendation_stability`** — DEPRECATED, no longer emitted (vendored 0.15.0
    enrichment.js:250–262). At f7a52a0c ResultsBody feeds it TWICE: `stability=` into AdvancedSection
    (~:547 — removed here) and `recommendationStability=` into OptionCards (:403 — that surface is
    gated off by V1's Options-section retirement, archived in Phase 3). The complete consumer grep
    recorded in the PR must list both; keep inbound tolerance in mappers.
  - **Simulations row path-conditional honesty:** root `meta.n_samples` is V2-path-only (the CEE→UI
    keep-list deep-strips `meta`); on a pure V5 turn render honest-absent — never promote per-option
    `outcome.n_samples`, never show a stale prior-run number.
  - **Freshness receipt row** ("Graph hash match"): implementation follows the D1 ruling (ask #16).
    Build both branches ready: (a) row omitted; (b) translated vocabulary — a small code→copy map,
    unknown codes fail closed to omit, never raw wire strings.
  - **Seed row:** stays absent (v6 dropped it; T2's #326 made the V5 path fail-closed — landed).
    Assert-only.
  - **Result hash:** producer `response_hash` verbatim truncated; a V5 locally-derived hash must be
    labelled local, not producer.
  - **Risk slider:** per D7 ruling — it loses its Options-section sibling when V1 gates that section.
- `src/components/results/ResultsBody.tsx` — prop-line changes only (sequenced after V1; same file, later lane).

### Lane V4 — Strengthen fidelity + commit path

**After:** T3 merged (open draft PR #321 at planning time; its verified file list is
DecisionOverviewCard + StrengthenPanel + buildRecommendations — it does NOT touch
StrengthenContainer, so V4's container fixes cannot collide, but the buildRecommendations
gating edit rebases on #321's dedupe/subtitle outcome).

**Files:**
- `src/components/results/strengthen/StrengthenContainer.tsx` — the two ledgered container defects
  (both re-verified present at f7a52a0c):
  - :139 stops dropping producer `action_label` (phase-3 rows currently get `actionLabel: undefined`);
  - :143 rank inversion `100 − priority` clamps producer ranks > 100 (fixture ranks 101–104/201–202
    collapse to one band) — preserve producer ordering for arbitrary ranks.
- `src/components/results/strengthen/buildRecommendations.ts` — commit-rec gating per D3 ruling.
  Interim default (recommended): keep the robustness `computed ∧ high` gate; the stage-indicator
  bridge stays **ordering-only, never a gate** (UI-SEM-076); `'analyse'` (outside the ScenarioStage
  union) keeps mapping to null with the ladder untouched.
- Broaden gate: no code change — producer-bias-finding-only stays; the fixture `confirmation_bias`
  enum drift means there is no evidenced live trigger (documented, fail-closed).
- `src/canvas/stores/strengthenStore.ts` — untouched unless rec identity changes force a
  `strengthen.lifecycle.v1` version bump (see risk R2).

**Anti-regression (prototype defects D1/D3 from the spec):** commit rec must open DecisionRecordModal
via `openDecisionRecord()` (already correct on staging — pin it); progress summary, next-route text and
"Show N more" are already derived live (pin with tests; never reintroduce static seeds).

### Lane V5 — Decision overview polish + drawer titling

**After:** T3 merged (#321 edits DecisionOverviewCard's framing filter — V5's copy-parity sweep
targets the post-#321 text). Files strictly under `decision-overview/` + `coaching/` (no OutputsDock
edits — any mount-gate change belongs to V2).

**Files:**
- `src/components/results/decision-overview/DecisionOverviewCard.tsx` / `ActionsMenu.tsx` — copy/behaviour
  parity sweep against V6-BUILD-SPEC §1 (verbatim en-GB, brief auto-expand on thin/conflict, chip dot
  semantics, goal-chip note from the saved measure sentence).
- Drawer titling (prototype defect D2): every `openAskOlumi` call titles the drawer after the actual
  task (the framing question's "Work through with Olumi" must not inherit an unrelated title) —
  audit all call sites in `decision-overview/*` + `strengthen/*` + hero.
- Classification pills: keep the shipped UI-SEM-077 fail-closed "not set" states + horizon from the
  decision-node brief timeframe; pill click opens the review drawer. **No fabrication** — stakes/
  reversibility/risk have no wire home (data matrix §10).
- "Answer directly": stays the drawer-draft honest interim ("My answer: " prefix) — the direct
  brief-edit write path is a producer gap (asks #14/#15 cluster).

### Lane V6 — Required-state fixtures, browser QA, staging flip

**After:** V1–V5 merged. Last lane; carries the netlify staging promotion.

**Files:**
- Hero fixture gallery + typed fixtures covering the brief §16 matrix (20 states: ready/thin/
  contradictory brief, fresh/stale/unknown, close call, clear leader, identical readouts, unavailable
  lenses, narrow option set, LEHI factor, fragile relationship with alternative leader, commit-top,
  no recommendations, long labels, missing units, partial response, unknown-block fallback).
  `fixtureIsolation.spec` stays pinned: fixtures never reach product routes.
- `netlify.toml` — `VITE_FEATURE_ANALYSIS_TAB_V6 = "1"` under `[context.staging.environment]`
  with the standard promotion comment (production promotion only by adding to `[build.environment]`
  after sign-off).
- Browser QA checklist doc (per brief §20 return pack: screenshots of all key states, DS v5 audit,
  a11y audit, data source for every displayed semantic claim).

**Note on a11y scope:** re-verified at f7a52a0c — `modals/ModalShell.tsx` implements Escape-close,
backdrop-click close, Tab trap, focus-into-dialog on open and focus-restore on close, with
`role="dialog"` + `aria-modal` + `aria-labelledby` (header doc :12–17 states this explicitly as
"BEYOND the prototype"); `ActionsMenu.tsx` :44–74 implements the full menu keyboard model (Escape
with focus restore, Arrow/Home/End roving focus, `aria-haspopup="menu"`/`aria-expanded`);
`HeroLensTabs.tsx` :5, :79–97 implements the WAI-ARIA tabs pattern (`role="tablist"`,
`aria-selected`, `aria-controls`, roving tabindex, Left/Right). The evidence-disclosure tabs are
deliberately plain toggle buttons (documented decision). The prototype's D5 gaps are therefore
**already fixed in the app**; no standalone a11y lane — each lane's acceptance includes the brief
§13.5 checks for the surfaces it touches.

### Dependency graph

```
[landed: T1 T2 C3 · open drafts: T3(#321) C2(#324) C4(#325) · unstarted: C1]
        │
        V1 (flag + ResultsBody)          ← after C4 (T1, T2 already in baseline)
       ┌┴─────────────┐
       V2 (OutputsDock) V3 (receipts)    ← V2 after C1+V1; V3 after V1. V2 ∥ V3: disjoint files
       │               │                    (OutputsDock vs AdvancedSection + ResultsBody prop lines)
       V4 (strengthen) V5 (overview)     ← both after T3; parallel with V2/V3 (disjoint clusters)
       └───────┬───────┘
               V6 (fixtures + QA + staging flip)
```

Strict file-cluster ownership: ResultsBody.tsx edits only in V1 then V3 (sequential); OutputsDock.tsx
only in V2; strengthen/* only in V4; decision-overview/* only in V5. V4 and V5 can run in parallel with
V2 and V3.

---

## 2. Flag strategy + retirement sequence

### The flag

Following `src/flags.ts` conventions, verified at f7a52a0c: a `FLAGS_CONFIG` entry (camelCase key,
`VITE_FEATURE_*` envKey, `feature.*` storageKey, optional `defaultValue` — omitted here, so default
off), a `makeFlag(FLAGS_CONFIG.analysisTabV6)` registration in the `flags` export (:507–509 pattern),
and an `isAnalysisTabV6Enabled` export (:512–525 naming pattern), with the comment block stating
rollout + local enable:

```ts
// Analysis-tab rebuild v6 (BUILD-GUIDE-2026-07-15): the v6 COMPOSITION delta —
// retires the legacy co-mounted surfaces (Options comparison, Drivers accordion,
// Tornado, StressTest, WhatChangedChip, post-run AnalysisFooter, retired chrome)
// and adapts AdvancedSection receipts. Gates ONLY the delta: the surfaces it
// reveals are the already-accepted Wave 1–3a stack. Default OFF; staging-on by
// netlify.toml promotion after browser QA (Lane V6); flag-off is byte-identical
// (pinned). Enable locally: localStorage.setItem('feature.analysisTabV6', '1')
analysisTabV6: {
  envKey: 'VITE_FEATURE_ANALYSIS_TAB_V6',
  storageKey: 'feature.analysisTabV6',
},
```

**Composition rule (fail-closed):** a resolved helper
`isAnalysisTabV6Enabled() = flag('analysisTabV6') && decisionOverview && analysisHeroPanel && strengthenPanel`.
The v6 layout only makes sense on top of the Wave 1–3a stack; if any stack flag is off, the helper
returns false and the layout is exactly today's — never a half-v6 hybrid (e.g. Options section retired
but no hero option table to replace it). Each combination is unit-tested.

**Dark-landing:** the flags.ts entry ships in V1 with default off and **no** netlify promotion.
Lanes V1–V5 land dark; QA runs via localStorage. The staging promotion is the last change (Lane V6).
Production promotion is a separate config-only PR, Paul-gated after staging sign-off.

### Retirement sequence (after the flag proves out)

Nothing is deleted while the flag exists — retirement is gate-then-archive:

1. **Phase 0 (during build):** everything gated, flag-off byte-identical. Rollback = flip the flag.
2. **Phase 1 (staging flip, Lane V6):** browser QA against the §16 state matrix + brief §17 acceptance.
3. **Phase 2 (soak):** staging soak (D8 rules the duration; suggest ≥1 week of active dogfooding with
   zero flag-off rollbacks), then production promotion (config-only PR).
4. **Phase 3 (archive PR 1 — v6-gated surfaces):** delete the `!v6` branches and archive:
   OptionCards/WinGauge (+ unused CompactOptionSpread), RiskAppetiteFilter (per D7 — relocate or
   archive), DriversSection.tsx (KEEP `driverDisplayModel.ts`), TornadoChart + accordion,
   StressTestSection, WhatChangedChip, post-run AnalysisFooter wiring in OutputsDock (KEEP
   `AnalysisFooter.tsx` for pre-run StickyFooter; KEEP `derivePostFooterStatus` for the receipt row),
   retired chrome blocks. Note the 2026-05-27 Options-section revert comment (ResultsBody:330–336):
   cite the v6 acceptance in the PR to pre-empt a second revert.
5. **Phase 4 (archive PR 2 — pre-v6 fallbacks now unreachable):** DecisionConfidencePanel +
   `analysisHeroV17/` module + `analysisHeroCompare` flag (analysisHeroPanel acceptance);
   FocusNowContainer + `focusNowPanel` flag ("kill switch retires at 3a acceptance" — now due);
   dead files ChallengeSection.tsx, ResultsFooter.tsx.
6. **Phase 5 (flag fold):** once production runs v6 for a release, fold
   `decisionOverview`/`analysisHeroPanel`/`strengthenPanel`/`analysisTabV6` into permanent code in one
   cleanup PR, keeping `analysisTabV6` alone as the kill switch for one further release, then delete it.

---

## 3. Per-lane RED-test focus

**V1 — composition:**
- RED: flag-off mount inventory is byte-identical to pre-lane staging (pinned snapshot of section
  testids in order).
- RED: flag-on inventory — NO option-cards/win-gauge/risk-filter/drivers-accordion/tornado/stress-test/
  what-changed-chip testids; hero, strengthen, advanced, orphan banner, inference strip all present.
- RED: flag helper combinatorics — `analysisTabV6` on with any stack flag off → today's layout.

**V2 — OutputsDock:**
- RED: flag-on → `results-analysis-footer` absent post-run; freshness strip + Actions menu both offer
  Rerun; orphan banner behaviour unchanged (the footer-suppression interlock has nothing to suppress —
  assert no crash and banner still renders).
- RED: chrome blocks absent flag-on per D5 rulings; present flag-off.
- RED: AnalysisFreshnessNotice remains the sole freshness owner in both flag states ('unknown' never
  rendered as stale — reuse CompareTabBody.freshness.spec pattern).
- RED (if D4 rules pre-run overview): overview mounts pre-run without resultsSectionData and fails
  closed on missing fields.

**V3 — receipts:**
- RED: display_verdict → copy mapping incl. missing → "Robustness unknown"; raw stability % only as
  neutral meta beside a determinate verdict.
- RED: no code path reads `recommendation_stability` for display (complete-manifest grep recorded in
  the PR; inbound tolerance preserved).
- RED: V5-path turn (meta stripped) → Simulations row honest-absent; V2-path → "N simulations".
- RED: freshness receipt — unknown reason code → row omitted; known code → translated copy only
  (or row omitted entirely, per D1 ruling).
- RED: no seed row in either path; local-derived hash labelled local.

**V4 — strengthen:**
- RED: producer `action_label` reaches the rendered primary button for phase-3 rows.
- RED: producer ranks 101–104/201–202 preserve relative order (no clamp collapse).
- RED: commit rec primary opens DecisionRecordModal; modal save marks commit addressed (D1
  anti-regression); modal option list binds to the live analysed set (D7 anti-regression).
- RED: lifecycle — new analysis hash reconciles by id: statuses survive, reopen fires only on
  genuine hash change; `markAllStale` labels visible-but-stale without resetting history.
- RED: `stage_indicator: 'analyse'` → bridge null → deterministic ladder order unchanged.
- RED: broaden absent without a producer narrow-framing finding (never local option counting).

**V5 — overview:**
- RED: drawer title per invoking task for every `openAskOlumi` call site (framing question ≠
  "Resolve the brief conflict").
- RED: brief bar auto-expands + `aria-expanded=true` on thin/conflict, collapses on ready; chip dot
  semantics (warn only under thin, conflict only under conflict).
- RED: pills fail closed to "not set"; horizon renders the brief timeframe verbatim; no fabricated
  stakes/reversibility/risk.
- RED: goal chip note = saved measure sentence "{metric}: {threshold}{unit}, {timeframe}" after
  Define-success save; single canonical rerun (one `executeCanonicalRun`, source pinned).

**V6 — fixtures/QA:**
- RED: every §16 state has a rendering assertion (live-derivable states in component specs;
  producer-gap states gallery-only with the internal-preview banner).
- RED: fixture isolation — no product route imports fixture models; netlify flag matrix pinned
  (staging-on, production + deploy previews off).

---

## 4. Decisions needed (Paul / orchestrator rulings)

| # | Decision | Options / recommendation |
|---|---|---|
| D1 | **freshness_reason-as-receipt doctrine (ask #16).** The field is AVAILABLE (`freshness_reason: 'graph_hash_match'`) but doctrine-marked "debug only, never user copy"; v6's receipt row promotes it. | (a) omit the row; (b) **recommended:** translated vocabulary — curated code→en-GB copy map, unknown codes fail closed to omit, never raw wire strings; (c) verbatim (violates doctrine). V3 builds branch-ready for (a)/(b). |
| D2 | **Success-measure wire structure (ask #14).** Today only the numeric threshold reaches the wire; metric/direction/unit/timeframe/baseline live in sessionStorage. Does the rich measure become a wire/brief-persisted structure? | Affects Goal-fit lens hardening + goal-chip note provenance + reopen semantics. No v6 lane blocks on it (the shipped honesty note covers the interim), but the ruling must land before Goal-fit copy hardens further. |
| D3 | **Commit-rec gating.** v6 wants "commit shows only when the producer says so"; staging gates on robustness `computed ∧ high`; the canonical strengthen-priority signal is ask #8 and staging fixtures emit `'analyse'` outside the ScenarioStage union (needs CEE vocabulary confirmation). | **Recommended interim:** keep the robustness gate, stage bridge stays ordering-only. Revisit when ask #8 ships. |
| D4 | **Overview mounting scope.** v6 mounts the overview card in all states incl. pre-run/conflict; staging gates `!isPreRun && hasInlineSummary`. | If yes → gate change lands in Lane V2 (OutputsDock). Pre-run overview needs fail-closed rendering without `resultsSectionData`. |
| D5 | **OutputsDock chrome retire-candidates.** Per-item ruling: transition receipt, stale-results banner, conv-results indicator, IdentifiabilityBadge (retire-candidates); WarningBanner-vs-InferenceWarningStrip overlap, DegradedStateBanner, adjustments-made details (keep/fold decisions). | Default in V2 is retire the four candidates behind the flag, KEEP the honesty banners. Rulings before V2 starts. |
| D6 | **Orphan banner + InferenceWarningStrip retention.** Not in the v6 prototype; both are honesty surfaces. | Staging map says keep — confirm so V1 pins them in the flag-on inventory. |
| D7 | **Risk slider home.** RiskAppetiteFilter's section retires in V1; AdvancedSection also hosts a risk-tolerance slider; brief §10.2 says user risk posture belongs in the overview only if it actively changes coaching (the CEE→ISL preference flow is a stub). | (a) keep slider in AdvancedSection unchanged; (b) retire the filter with its section and defer posture to the classification-pills producer ask. Rulings before V1/V3. |
| D8 | **Soak duration + promotion authority.** How long staging soaks before Phase 3 archive PRs; production promotion sign-off (Paul per repo convention). | Suggest ≥1 week active dogfooding, zero flag-off rollbacks. |
| D9 | **Flag fold timing (Phase 5).** When the three wave flags + `analysisTabV6` collapse into permanent code. | Suggest one production release after promotion. |

---

## 5. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | **OutputsDock churn.** 2,400-line hotspot; C1 touches it in-flight; historically conflict-prone. | Exactly one v6 lane (V2) owns the file; rebases after C1; edits are gate-expressions only (no restructuring); flag-off byte-identical pinned; mount-order inventory test. |
| R2 | **strengthenStore lifecycle compatibility.** V4's container fixes change rec ordering inputs; `strengthen.lifecycle.v1` sessionStorage reconciles by id — if ids or reconciliation semantics shift, user history resets or stale reopens fire. | Rec ids stay stable (`success`, `flip:*`, phase-3 item_ids); RED test: new payload with changed ranks/labels does not reset statuses; reopen only on genuine analysis-hash change; bump the storage version key only if the record shape changes, with a migration or documented reset. |
| R3 | **Goal-threshold representation interplay.** #309/#317 just stabilised raw-vs-normalised (`goalThresholdRepresentation`, `resolveChipGoalThreshold` short-circuit at useV2Run.ts:226). Any v6 edit near the threshold path could re-break double-normalisation. | No v6 lane touches `useV2Run.ts`, `store.ts` threshold slices, or DefineSuccessModal's commit path. V5's goal-chip work reads the measure store only. Regression spec runs in V3/V5 CI shards regardless. |
| R4 | **Deprecated `recommendation_stability` removal breaks a hidden consumer.** | Complete-manifest grep (scope: `src/`, claim type: no display-read) recorded in the V3 PR; mappers keep inbound tolerance; only display sourcing removed. |
| R5 | **V5-path receipts dishonesty.** Keep-list strips `meta`; a V5 turn after a V2 run could show the stale V2 seed/n_samples as if current. | Receipts derive from the current report's provenance, not last-known values; RED tests per path; T2's #326 already landed the fail-closed seed + no-stale-attribution pins (envelopeAnalysisWiring), so V3 asserts and extends rather than re-implements. |
| R6 | **Flag combinatorics hybrid.** `analysisTabV6` on where stack flags are off (e.g. production localStorage) would retire sections with no replacement mounted. | The resolved AND-helper (§2); combination unit tests; netlify promotion only carries the one new var. |
| R7 | **Retiring Tornado/StressTest loses data surfaces.** Their inputs (`flip_thresholds`, `fragile_edges`) must remain fully represented in the hero evidence tabs. | Pre-retirement parity check: top flip risks rendered by the evidence tab match StressTest's merged cards on the golden fixture; code archived only in Phase 3, not deleted at gating time. |
| R8 | **In-flight lane drift.** T3/C1/C2/C4 outcomes may differ from their briefs (T1/T2/C3 verified merged at f7a52a0c and folded into this plan); analyst docs were baselined at dbd6be9d. | Each v6 lane re-reads its file cluster at branch time from the live head (fresh worktree); verify remote head via ls-remote; re-derive any dependent claim if a precursor lane's verdict flipped (global working practice). |
| R9 | **Copy drift / double edits.** T3 edits DecisionOverviewCard + buildRecommendations copy in-flight while V4/V5 assert "(spec) verbatim" strings. | V4/V5 sequence strictly after T3; verbatim-copy assertions target the spec doc strings, updated once against T3's merged reality. |
| R10 | **Prototype defects leaking in (D1–D7 of the spec).** | All seven are app-avoided today; V4/V5/V3 add anti-regression pins (commit→modal, derived progress strings, live option list in the record modal, measure-sentence word order via `measureSentence.ts` authored shape). |
| R11 | **Revert history repeats.** The Options-comparison section was reverted back in on 2026-05-27; retiring it again may surprise stakeholders. | Retirement is flag-gated (instant restore), cited to this build guide + brief §3 in the V1 PR; archive only post-soak with Paul's sign-off (D8). |
| R12 | **`headline_banded` has zero fixture evidence.** The producer band is contract-typed but unseen on the wire; the shipped fallback thresholds carry the headline. | No v6 lane changes headline logic (out of refinement authority — brief §14). V6 fixtures include a `headline_banded` case so the adoption path is at least gallery-proven. |

---

## 6. Return-pack hooks (per lane)

Each lane's DRAFT PR carries the brief §20 pack: what changed, flag state matrix, screenshots
(V6 gallery states for producer-gap surfaces), tests run with CI shard logs, DS v5 + a11y audit for
touched surfaces, data source for every displayed semantic claim (cite V6-DATA-MATRIX row), deviations,
and open decisions blocking the next lane.
