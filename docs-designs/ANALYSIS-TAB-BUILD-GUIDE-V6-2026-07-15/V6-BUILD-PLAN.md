# V6 BUILD PLAN — Analysis-tab v6 lane slicing, flag strategy, tests, decisions, risks

## Amendment log (2026-07-16)

The 2026-07-15 adversarial plan review returned **APPROVED-WITH-AMENDMENTS** (11 amendments,
recorded in the programme handover, ~13:00 block). This log records each amendment as applied,
plus every premise re-derived against `origin/staging @ bf921314` (2026-07-16). The tree moved
TWICE since the review: first the #321/#324/#325/#327/#329/#330/#333/#334 merge train
(15 Jul afternoon), then #335 through #352 (15 to 16 Jul), including the **#352 trust
consolidation** which rebuilt the freshness/orphan/footer surfaces this plan's V2 describes.
Line anchors throughout this document are now cited against **bf921314** unless marked otherwise.

### The 11 amendments, as applied

| # | Amendment (review verdict) | Disposition in this document |
|---|---|---|
| 1 | V4's claim "#321 does not touch StrengthenContainer" was FALSE at 0191a1fd (comment-only overlap). | Applied: V4 restated on the true basis. #321's merged file list includes `StrengthenContainer.tsx` (comment-only overlap, no logic collision). #321 has since **merged** (`ac070cf4`), and the :139/:143 container defects are re-verified present at bf921314. |
| 2 | C1 was NOT unstarted (#329 open at review time) and its real footprint includes `ResultsBody.tsx` (the region V1 gates) plus AnalysisFooter, AnalysisHeroContainer, useAnalysisHero, heroCopy. V1 needed a "#329 merged" precondition; V2's descope fallback was unreal. | Applied, then satisfied by reality: **#329 merged** (`412a7d2a`). V1's precondition is restated as satisfied-with-SHA; V2's "if C1 is descoped" fallback is deleted; V2's line refs re-derived post-#329 AND post-#352. |
| 3 | **(BIGGEST)** V1 silently ORPHANS a shipped brief §11.2 behaviour: `useCanvasResultsSync` makes canvas factor-selection expand, scroll to and highlight the Drivers row. Flag-on V1 removes the accordion; the hero evidence tab receives neither prop; the behaviour dies with no lane re-homing it. | Applied: Lane V1 now carries an explicit requirement (default: re-home the sync at the hero evidence Drivers tab; alternative: record an accepted regression in the V1 PR under brief §20 deviations). Lane V6's QA gains the brief §17 graph-to-Analysis cross-surface checks in either case. See V1 and V6. |
| 4 | V3's "no code reads recommendation_stability" is unachievable repo-wide (GoalNode, DecisionNode, useNodeDisplayMetadata, LensInfoPanel, ModelTab*, TrajectorySection, DecisionConfidencePanel, analysisSnapshotFactory `?? 0` live fabrication, UI-SEM-005 fallback, and more). | Applied: the claim is rescoped to "no AdvancedSection/receipts display-read" with the wider consumer set ledgered in V3 (47 files reference the field at bf921314). R4 updated to match. |
| 5 | "Flag-off byte-identical" overclaimed: the pin is a testid mount-inventory snapshot, not byte-identity; V3/V4/V5 change flag-off-visible behaviour unless individually gated. | Applied: byte-identity language replaced with "mount-inventory identical (pinned testid snapshot)" and scoped to the V1/V2 composition deltas; V3, V4 and V5 now carry explicit per-lane flag-off gating statements. |
| 6 | Add D10 (Options-comparison retirement) and D11 (WhatChangedChip retirement) as PAUL decisions; both were treated as settled V1 retirements. | Applied: §4 gains D10 and D11 as open PAUL decision slots (not resolved here); V1 gates both retirements on the rulings. |
| 7 | Production promotion is a FOUR-flag jump: netlify.toml `[build.environment]` carries none of the three stack flags, so adding only `VITE_FEATURE_ANALYSIS_TAB_V6` is a silent no-op via the fail-closed AND-helper. | Applied: §2 and Lane V6 name the full set (`VITE_FEATURE_DECISION_OVERVIEW`, `VITE_FEATURE_ANALYSIS_HERO_PANEL`, `VITE_FEATURE_STRENGTHEN_PANEL`, `VITE_FEATURE_ANALYSIS_TAB_V6`) and the blast radius: production users receive the entire Wave 1 to 3a stack plus the v6 composition delta in one jump, having soaked none of it. Re-verified at bf921314: netlify.toml :71/:78/:84 are staging-context only. |
| 8 | Own C1's deferred rerun-affordance debt (inspector StaleGuardBanner, RunHistoryDrawer, dormant tornado apply-and-rerun) in V2 or a D-item. | Applied to V2, re-derived post-#352: the StaleGuardBanner leg is RESOLVED (#352 F10 deleted `useStaleGuard` and the banner's stale half; it is now an empty-state wrapper with no rerun affordance). The `RunHistoryDrawer` leg (behind `historyRerun`) and the dormant `ApplyAndRerunButton` in TornadoChart remain; V2 reconciles both. |
| 9 | Downgrade V1's hard dependency on C4 (#325) to merge-order (zero file overlap; C4 was stalled at review time). | Applied, then satisfied by reality: **#325 merged** (`1c6a099f`). Recorded as merge-order for the audit trail. |
| 10 | V2's REDs lived in `OutputsDock.dom.spec`, which #329 quarantined in the vitest excludes; un-quarantine or replace. | **Premise changed since the review:** #334 (`695933d9`) un-quarantined `OutputsDock.dom.spec`. At bf921314 the vitest excludes hold only `ReactFlowGraph.layout.dom.spec.tsx` and `canvas.run-gating.dom.spec.tsx`. V2's REDs run in CI as-is; no un-quarantine work remains. V2 additionally has the post-#329 `OutputsDock.rerunSingleOwner.spec` family to extend. |
| 11 | Declare the brief §15/§16/§20 deviations (V2 parallel with V3, V4 parallel with V5, versus "one lane at a time"; brief Wave 4 has no dedicated lane) and map fixtures 1:1 to §16's twenty states, including states 2 and 5. | Applied: new §7 "Declared deviations from the brief"; Lane V6's fixture list is now a numbered 1:1 mapping to brief §16 (the prose list previously omitted state 2, ready brief with valid target, and blurred state 5, fresh analysis, into a freshness triple). |

### Premises re-derived (old → new), verified against origin/staging @ bf921314

Merge-state premises:

- Baseline head: `f7a52a0c` → **`bf921314`** (fetched and verified 2026-07-16).
- T3 #321: OPEN draft → **MERGED `ac070cf4`**; its file list DID include StrengthenContainer.tsx (amendment 1 confirmed against the merged PR).
- C1: "UNSTARTED (no PR)" → **PR #329 MERGED `412a7d2a`** with the wider footprint amendment 2 names.
- C2 #324: OPEN → **MERGED `7c583bfa`**. C4 #325: OPEN → **MERGED `1c6a099f`**.
- T2b #333 (`77bd6bc4`) landed: receipts stay honest through the persistence roundtrip. Baseline fact for V3 (extends T2/#326).
- #334 (`695933d9`): OutputsDock test revival; `OutputsDock.dom.spec` un-quarantined (amendment 10 premise flip).
- #330/#335/#339/#344 to #351 landed (camera, starter strip, freshness dirty fix, run-gate homes, DS ratchet/bricks, metric pills, archive sweep). #347 archived 8 dead canvas components; none of the surfaces this plan names moved (`ChallengeSection.tsx`, `ResultsFooter.tsx` remain in place, still dead).

#352 trust-consolidation premises (the plan's V2/V1 surface descriptions were stale):

- `AnalysisOrphanBanner.tsx` (was ResultsBody:253): **DELETED by #352.** The orphan state folds into the freshness strip: `resolveTrustEffectiveState` (in the new `src/canvas/hooks/useAnalysisTrust.ts`) synthesises the cannot-confirm variant with the one Rerun for an orphaned result with no (or 'none') verdict; a held verdict wins. The strip stamps `data-orphaned` + `data-freshness-reason="orphaned_result"`.
- `useAnalysisTrust.ts`: **NEW (#352).** The single answer to "can these results be trusted as current"; every trust-rendering surface reads it, never the slices directly.
- `suppressAnalysisFooterForOrphanBanner` interlock (was OutputsDock:720–725): **REMOVED by #329** (rationale recorded in the OutputsDock comment now at :756–782; it must not return, not even as an action-level gate).
- Post-run footer ownership: the footer is **STATUS-ONLY** whenever `freshnessStripOwnsRerun` (OutputsDock:626–627: a held non-'none' verdict OR an orphaned result); it keeps its Rerun only when the strip shows no control. Mount now at :2344–2364.
- `useStaleGuard`: **DELETED by #352 (F10)** — its hash keys had no write sites, so its consumers could never fire. `StaleGuardBanner` survives as an empty-state-only wrapper.

Line-anchor re-derivations (bf921314):

- ResultsBody.tsx (now 623 lines): InferenceWarningStrip :263 → **:258** · WhatChangedChip :268 → **:263** · hero mount :275–284 → **:270–278** · DecisionConfidencePanel/v17 fallback :292–304 → **:286–298** · StrengthenContainer :315–325 → **:309–319** · Options comparison :337–409 → **:331–403** (2026-05-27 revert comment now :324–330) · Drivers accordion :412–437 → **:405–431** · Tornado :440–484 → **:433–478** · StressTestSection :488–538 → **:480–532** · AdvancedSection :545–566 → **:538–560** (`stability=` feed ~:547 → **:542**) · adjustments-made details :569–585 → **:562–579** · OptionCards `recommendationStability=` :403 → **:397**. AnalysisOrphanBanner :253 → **gone** (see above).
- OutputsDock.tsx (2,406 → 2,478 lines): `ai-panel-transition-receipt` :1787–1796 → **:1844–1854** · IdentifiabilityBadge :2083–2092 → **:2142–2152** · WarningBanner :2113–2124 → **:2172–2184** · DegradedStateBanner :2126–2157 → **:2185–2217** · `stale-results-banner` :2160–2171 → **:2218–2231** · `conv-results-indicator` :2178–2191 → **:2238–2252** · DecisionOverviewCard gate :2203–2205 → **:2264–2266** · AnalysisFreshnessNotice :2209–2211 → **:2270–2272** · stale wrapper + ResultsBody :2212–2271 → **:2273–2332** · post-run AnalysisFooter :2277–2292 → **:2344–2364** · `useCanvasResultsSync` call :711 → **:736–740** (props into ResultsBody at :2295–2296).
- StrengthenContainer.tsx :139 (`actionLabel: undefined`) and :143 (`100 - (item.priority ?? 0)`): **re-verified unchanged** at bf921314.
- flags.ts patterns (registration cluster, `is*Enabled` exports): re-verified; `decisionOverview`/`strengthenPanel` registrations now :507–508, exports :570/:579/:580. Pattern citations in §2 still hold.
- ModalShell/ActionsMenu/HeroLensTabs a11y claims (V6 note): re-verified intact post-#351 Modal promotion.
- netlify.toml: `VITE_FEATURE_ANALYSIS_HERO_PANEL` :71, `VITE_FEATURE_DECISION_OVERVIEW` :78, `VITE_FEATURE_STRENGTHEN_PANEL` :84, all under `[context.staging.environment]` only; `[build.environment]` carries none of them (amendment 7 basis confirmed).

Decision-slot re-derivation: **D6's orphan-banner half is overtaken by #352** (the banner no longer exists; the orphan surface is the freshness strip's fold). D6 reduces to the InferenceWarningStrip retention question; §4 updated. D5's `stale-results-banner` and chrome candidates re-anchored but otherwise unchanged.

---

**Inputs:** `ANALYSIS-TAB-BUILD-BRIEF.md` (intent authority), `V6-BUILD-SPEC.md` (prototype contract),
`V6-STAGING-MAP.md` (component verdicts), `V6-DATA-MATRIX.md` (wire verdicts) — all in this directory.
**Baseline:** the three analyst docs are cited against `origin/staging @ dbd6be9d`; head verified
**`bf921314`** at amendment time (2026-07-16) — **T1 (#322), T2 (#326), C3 (#320), T3 (#321),
C2 (#324), C4 (#325), C1 (#329), T2b (#333) and the #330 to #352 train have all squash-merged**,
so their outcomes are baseline facts, not preconditions. Every lane branches from
the **live** origin/staging head at branch time, in a **fresh worktree**. Line anchors drift with
each merge (at bf921314 the ResultsBody mounts sit at: hero :270, strengthen :309, "Your options"
:331, Drivers :405, Tornado :433) — anchors below cite bf921314 unless marked otherwise (the
amendment log records the dbd6be9d/f7a52a0c → bf921314 re-derivations); re-derive at branch time.

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

## 0. Preconditions — ALL SATISFIED at bf921314

Every in-flight lane this plan originally sequenced behind has merged. The table restates each
precondition as satisfied-with-SHA (amendments 1, 2 and 9). Status verified against
origin/staging `bf921314` + `gh pr view` on 2026-07-16:

| In-flight lane | Status @ bf921314 | File cluster | Consequence for v6 lanes |
|---|---|---|---|
| T1 rank-badge | **MERGED** #322 (`04c1fe49`) | `useResultsSectionData.ts` numbering + display-order pin | baseline fact (V3 reads its outputs via props) |
| T2 receipts | **MERGED** #326 (`f7a52a0c`) | `mapV5AnalysisToReport.ts` (seed fail-closed null, robust_edges absent-vs-empty), hydration, envelope wiring | **V3 semantic dependency satisfied.** V3 asserts fail-closed seed, never re-fabricates |
| T2b receipts persistence | **MERGED** #333 (`77bd6bc4`) | `useV2Run.ts` seed provenance, `useConversation.ts` snapshot | baseline fact for V3 (the "Seed 0 resurrects on reload" leg is closed) |
| T3 guidance | **MERGED** #321 (`ac070cf4`) | `DecisionOverviewCard.tsx`, `StrengthenPanel.tsx`, `StrengthenContainer.tsx` (comment-only overlap — amendment 1: the earlier "does NOT touch StrengthenContainer" claim was false), `buildRecommendations.ts` | **V4, V5 precondition satisfied** — both rebase on the merged reality |
| C1 rerun-single-owner | **MERGED** #329 (`412a7d2a`) | Real footprint (amendment 2): `OutputsDock.tsx`, `AnalysisFooter.tsx`, `AnalysisFreshnessNotice.tsx`, **`ResultsBody.tsx`** (the region V1 gates), `AnalysisHeroContainer/AnalysisHeroPanel/useAnalysisHero/heroCopy` | **V1 and V2 preconditions satisfied.** The former "if C1 is descoped" fallback is deleted; V2 composes with #329's footer-ownership outcome (and #352's rebuild on top of it) |
| C2 StyledEdge labels | **MERGED** #324 (`7c583bfa`) | `StyledEdge.tsx` + `edgeLabelCollision.ts` (canvas only) | none |
| C3 FactorNode units | **MERGED** #320 (`f6fa6c84`) | `FactorNode.tsx` prior-range rendering | none |
| C4 DriversSection/MetricPills disclosure | **MERGED** #325 (`1c6a099f`) | `DriversSection.tsx`, `MetricPills.tsx`, `FactorNode.tsx`, `useNodeDisplayMetadata.ts` | **V1 precondition satisfied.** Amendment 9: this was downgraded from a hard dependency to merge-order (zero file overlap with V1's edits) before reality satisfied it anyway |

Additionally merged since the review and RELEVANT to lane content (not mere anchors): **#352**
(`bf921314`, trust consolidation — deletes AnalysisOrphanBanner, adds `useAnalysisTrust`, folds
the orphan state into the freshness strip; V1/V2 sections below are re-derived against it) and
**#334** (`695933d9` — un-quarantines `OutputsDock.dom.spec`; amendment 10).

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
