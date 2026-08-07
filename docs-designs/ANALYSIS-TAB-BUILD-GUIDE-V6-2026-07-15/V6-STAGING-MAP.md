# V6 Staging Component Map

**Baseline:** `origin/staging @ dbd6be9d` (2026-07-14, "perf(canvas): P1 round 2 … (#318)").
All file:line references are against that commit (`git show origin/staging:<path>`), NOT the dirty working tree.
**Prototype:** `analysis-tab-prototype-build-ready-v6.html` (this folder, 590 lines).

**Headline finding:** the v6 prototype is not a greenfield build. Waves 1–3a of the Analysis-tab rebuild already landed on staging *built against this prototype family* — `DecisionOverviewCard` cites "prototype decision-overview v6", `DefineSuccessModal`/`DecisionRecordModal`/`AskOlumiDrawer` cite "build-ready v6", and the analysis-hero module implements the merged panel including the `HeroEvidenceDisclosure` ("Why and what could change it") and the next-recommendation route. The v6 build is therefore mostly (a) flag-consolidation + copy parity, (b) **retiring** the legacy surfaces that still co-mount (Options comparison, Drivers accordion, Tornado, StressTest, AnalysisFooter), and (c) a small set of producer-blocked NEW items (trade-offs narrative, per-option stability, versioned what-changed, option-similarity signal).

Verdict vocabulary: **REUSE** (ship as-is), **ADAPT** (exists, needs targeted change), **REPLACE** (surface exists but v6 supersedes it with a different component), **NEW** (nothing usable exists), **RETIRE** (mounted today, absent from v6).

---

## 0. Feature-flag matrix (src/flags.ts)

| Flag | flags.ts | Default | Staging (netlify.toml) | Gates |
|---|---|---|---|---|
| `decisionOverview` | src/flags.ts:423 | off | **ON** — netlify.toml:78 | DecisionOverviewCard mount (OutputsDock.tsx:2203) |
| `strengthenPanel` | src/flags.ts:431 | off | **ON** — netlify.toml:84 | StrengthenContainer vs FocusNow (ResultsBody.tsx:315) |
| `analysisHeroPanel` | src/flags.ts:339 | off | **ON** — netlify.toml:71 | AnalysisHeroContainer mount + DecisionConfidencePanel suppression (ResultsBody.tsx:275, 292) |
| `analysisHeroV17` | src/flags.ts:305 | off | off | Legacy v17 hero substitution (ResultsBody.tsx:205, 301) — only relevant when `analysisHeroPanel` is OFF |
| `analysisHeroCompare` | src/flags.ts:325 | off | off | v17+legacy side-by-side comparison (ResultsBody.tsx:295) |
| `focusNowPanel` | src/flags.ts:315 | **on** (defaultValue: true) | on | FocusNowContainer fallback when `strengthenPanel` OFF (ResultsBody.tsx:320); "kill switch retires at 3a acceptance" |
| `aiPanelV2` | src/flags.ts:372 | **on** (defaultValue: true) | ON — netlify.toml:50 | Olumi tab (OutputsDock.tsx:237), FloatingOlumiPanel (ReactFlowGraph.tsx:2250), results-tab freshness icon (resultsTabFreshness.ts:31) |
| `v5CanonicalAnalysis` | src/flags.ts:391 | off | off | Canonical run routing + AnalysisOrphanBanner condition (via useAnalysisStateSource) |
| `heroFixtureGallery` | src/flags.ts:356 | off | ON — netlify.toml:90 | Internal /#/dev/hero-gallery only; fixture models blocked from product routes |
| `compareTab` / `journeyTab` | src/flags.ts (compareTab, journeyTab entries) | off | off | Compare/Journey dock tabs (OutputsDock.tsx:239, 241) |

So on staging today the v6 stack (`decisionOverview` + `analysisHeroPanel` + `strengthenPanel` + `aiPanelV2`) is **already the live configuration**.

---

## 1. DecisionOverviewCard (+ ActionsMenu / actionsCatalogue, framing question) — **REUSE**

v6: `#decisionOverview` card — title, classification pills, Actions menu, collapsible brief bar, four brief chips, "Review your decision brief" row, Olumi's framing question (prototype lines 210–248).

- `src/components/results/decision-overview/DecisionOverviewCard.tsx` (451 lines). Header doc:1–22 explicitly: "Wave 1 + parity O — Decision overview card (brief §4, prototype decision-overview v6)". Copy deck `OVERVIEW_COPY` :40–75 matches v6 verbatim ("Framing has the basics", "Olumi's framing question", "Answer directly", "Work through with Olumi").
  - Card root `data-testid="decision-overview"` :303; classification pills :328 (`decision-pill-${dim}`, stakes/reversibility/horizon/risk per :102); **ActionsMenu mounted inside the card** :326; brief bar :331; brief-dimension chips :355–366 (`brief-dim-*`); needs-input questions list :376; brief-actions row :385; framing question block :401–442 (both buttons route to the Ask-Olumi drawer via `openAskOlumi`, :414 and :429).
  - Framing-question derivation `deriveFramingQuestion` :131 (UI-SEM-078 — interrogative from top `discuss` guidance item, selected :190); brief-state machine :195–225 (UI-SEM-079: ready/needs_input/unassessed live, thin/blocked live-derived, contradictory/unverified fixture-only via `stateOverride`).
- `src/components/results/decision-overview/ActionsMenu.tsx` (192 lines): methods open the drawer with prefilled editable draft (:90–101, `parameters: { method_id }`); `rerun_analysis` is a DIRECT canonical run (:107–113); `edit_brief` reuses `REVIEW_BRIEF_ASK` (:127).
- `src/components/results/decision-overview/actionsCatalogue.ts` (111 lines): `METHOD_CATALOGUE` :49–92 and `GLOBAL_ACTIONS` :94–111 are byte-for-byte the v6 `methods` array (prototype lines 444–455): 7 methods + Edit decision brief / Review all inputs / Rerun analysis. `REVIEW_BRIEF_ASK` :31, `RERUN_TOASTS` :43 (honest "started" vs prototype "completed").
- Mount: OutputsDock.tsx:2203–2205, gated `isDecisionOverviewEnabled() && !isPreRun && hasInlineSummary && resultsSectionData`; title from `overviewTitle` memo (OutputsDock.tsx:633).
- **Flag:** `decisionOverview` (staging-on).
- **Delta vs v6:** v6's "Answer directly" claims to "Update this part of the persisted decision brief directly" (prototype :492–494); staging routes it to the drawer with an `answerDraftPrefix` ("My answer: ", :62) — a deliberate approximation until a direct brief-edit path exists. v6 mounts the card in ALL states including pre-run conflict; staging gates on `!isPreRun && hasInlineSummary` (post-run only).

## 2. AnalysisFreshnessNotice + resolveDisplayedFreshness + results-tab icon — **REUSE**

v6: `.status-strip` — colour dot, current/stale line, Rerun ghost button (prototype :249–255).

- `src/components/results/AnalysisFreshnessNotice.tsx` (155 lines). `FRESHNESS_COPY` :28–33 (fresh/stale/unknown/none); prototype-v6 colour-only dot vocabulary :35–43; renders nothing without a verdict :88; Rerun offered in every state except `none` (:98–101, "Parity audit: the prototype offers Rerun in the FRESH state too") and routes through `executeCanonicalRun({ source: 'freshness-strip' })` :138 with honest blocked/unavailable toasts :139–141; rerun-completed toast on running→complete :63–85 (with the settled-without-new-report honesty branch :78).
- `resolveDisplayedFreshness` — `src/canvas/store/analysisFreshness.ts:119` (values type :19). Rule: CEE verdict is source of truth; local dirty overlay may only downgrade retained `fresh` → `unknown`, never fabricate `stale`.
- Mount: OutputsDock.tsx:2209–2211 — deliberately ABOVE the stale wrapper "the recovery control must never sit inside an aria-disabled region" (:2206–2208). It is **the sole freshness owner**: the old top-level stale banner is retired (:2172–2176) and the results body is marked, not dimmed (:2212–2229, `data-freshness-confirmed`, `aria-busy`).
- Results-tab icon states: `deriveResultsTabFreshness` — `src/canvas/components/resultsTabFreshness.ts:27–35` (genuine `stale` → warning glyph; overlay `unknown` → NEUTRAL glyph, "never fabricate stale"; gated on `aiPanelV2`). Consumed OutputsDock.tsx:1585–1586 (from `displayedFreshness` at :601), rendered on the Analysis tab label :1689–1692.
- **Flag:** none for the strip itself; the tab icon is gated by `aiPanelV2`.

## 3. Merged analysis panel (AnalysisHero*) — **REUSE core / ADAPT at the edges**

v6: `#hero` `data-component="merged-analysis-panel"` — headline + subline, 4-lens strip, option table with range bars, quick-link pills, conflict pause-read, evidence disclosure, next-recommendation route (prototype :256–313).

- `src/components/results/analysis-hero/AnalysisHeroContainer.tsx` (67 lines) — "the ONE authorised mount" (doc :2–7, enforced by `__tests__/inertness.spec.ts`), mounted exclusively at ResultsBody.tsx:275–284 behind `analysisHeroPanel`, inside a SectionErrorBoundary; fail-closed empty model :51. Focus routed through `focusModelTarget` :48–50.
- `src/components/results/analysis-hero/useAnalysisHero.ts` — builds the model (:66 `buildHeroModel(data, optionNumbering, canvasNodeIds)`); **next recommendation read live from strengthenStore** (:26, :79–83, gated on `isStrengthenPanelEnabled()` :70); rerun via `executeCanonicalRun({ source: 'analysis-hero' })` :89; `focusPanelSelector` targets `[data-testid="strengthen-panel"]` :46.
- `src/components/results/analysis-hero/AnalysisHeroPanel.tsx` (690 lines, store-free): paused/blocked status variants (`hero-status-${variant}`, `hero-paused-resolve`) :105–120 — the v6 quality-conflict "pause read"; headline :309 / subline :324; lens strip :336; honest unavailable-lens body + inline "Define success" CTA :355–366; option rows :400–403; quick-link pills (`hero-quicklink-driver` / `-flip` / `-combined`) :432–461; `HeroEvidenceDisclosure` :476; rerun :510; focus-target editor + apply-threshold :530–618; **next-step route row** (`hero-next-rec`, "prototype §5 .analysis-next-route: mirrors the TOP active Strengthen entry; Open scrolls to the panel") :651–667.
- `src/components/results/analysis-hero/HeroLensTabs.tsx` (121 lines) + `heroTypes.ts` — `HeroLens = 'goal' | 'outcome' | 'stability' | 'whatChanged'` :19, fixed order :22. **The four v6 lenses exist here** (Goal fit / Likely outcome / Stability / What changed — `heroCopy.ts:28–38`), Goal fit + Likely outcome live, Stability + What changed honest-unavailable (`heroCopy.ts:47–53`; heroTypes doc :11–16 "Olumi will not infer it in the UI" semantics).
- `src/components/results/analysis-hero/buildHeroModel.ts` — flip-threshold filtering :272; evidence flip-risk sentences from producer `flipThresholds` :817–826.
- `src/components/results/analysis-hero/HeroOptionRow.tsx` (454 lines) — stable option numbers + range tracks (numbering via `selectors/optionNumberingStore`).
- `src/components/results/analysis-hero/heroCopy.ts` — headline banding (`slightlyAhead` :86, `noClearLeader` :88, producer `decision_brief.headline_banded` adoption :74–75); sublines :105–130.
- **Flag:** `analysisHeroPanel` (staging-on, production-off). When ON it also **suppresses** `DecisionConfidencePanel`/v17 (ResultsBody.tsx:286–304 "Wave 2 flag-scoped retirement").
- **ADAPT for v6:** v6 makes this panel the *only* driver/flip surface (see §5) and the only headline surface; the remaining work is retiring the parallel legacy sections below it, not changing the panel. v6's `.analysis-evidence-toggle` copy ("Why and what could change it" / "Drivers, flip risks and trade-offs") already matches HeroEvidenceDisclosure doc :2–7.

## 4. Lens/tab structures — **REUSE** (they exist inside the hero, nowhere else)

- Goal fit / Likely outcome / Stability / What changed live at `analysis-hero/HeroLensTabs.tsx` + `heroTypes.ts:19–22` + `heroCopy.ts:28–38` (see §3). No other Analysis-tab component implements the lens strip.
- Goal-fit unlock: null-target suppression + "Set a success target to unlock Goal fit" (`heroCopy.ts:48`) with the Define-success CTA (AnalysisHeroPanel.tsx:366).
- Note: `WhatChangedChip` (ResultsBody.tsx:268, `src/canvas/components/WhatChangedChip.tsx`) is a *client-side* run-over-run diff chip — it is NOT the "What changed" lens and contradicts the v6 doctrine that the UI "will not approximate it locally" (prototype :277). Retirement candidate (§13).

## 5. DriversSection + driverDisplayModel — **REPLACE surface, REUSE policy module**

- `src/components/results/DriversSection.tsx` (1005 lines) mounts as its own accordion "What's driving this" at ResultsBody.tsx:412–437. **v6 has no standalone drivers accordion** — drivers are the first evidence tab inside the merged panel (prototype :289–295), already implemented by `HeroEvidenceDisclosure` (top-3 + "See all factors", +/- producer direction sign, influence magnitude bar — doc :10–17, `VISIBLE_DRIVERS = 3` :36).
- Verdict: **RETIRE the ResultsBody accordion mount** in the v6 layout; **REUSE `src/components/results/driverDisplayModel.ts`** — it is the declared single source of truth for "which number a driver displays and how it is ranked", shared by the Drivers panel, the analysis hero, and the canvas badge (doc :1–21; `DriverDisplayProvenance` :23; `computeNormalisedInfluences` :39). The evidence tab already consumes the same displayed metric ("UI-SEM-080 layout mapping", HeroEvidenceDisclosure.tsx:13).
- Caveat: HeroEvidenceDisclosure deliberately omits the v6 "Low evidence" per-row wording ("no display-safe producer contract", doc :14–17) — the evidence-quality meta column is **NEW/producer-blocked**.

## 6. Flip-risk data consumers (`robustness.fragile_edges`) — inventory

Producers/mappers:
- `src/adapters/plot/v2/responseMapper.ts` — fragile/robust extraction :521–539, confidence proxy :738–743, display payload :1150–1212.
- `src/adapters/plot/enrichment.ts` — `fragile_edges` on sensitivity :92, :427–484, count :519.

UI consumers on the Analysis tab:
- `useResultsSectionData` → `confidence.challengeFragileEdges` → `StressTestSection` (props :53, :189, merged cards :227; mounted ResultsBody.tsx:520–532) — **RETIRE from tab** (not in v6; its "sensitive assumptions" content is covered by the evidence Flip risks tab + Strengthen's flip rec).
- `ChallengeSection.tsx` (:36 "Fragile edge from robustness.fragile_edges") — already superseded by StressTestSection (ResultsBody.tsx:490–494 comment); file is legacy. **RETIRE**.
- `analysis-hero/buildHeroModel.ts:817–826` — evidence Flip risks tab (switch-probability meta, named alternative winner). **REUSE — this is the v6 renderer.**
- `strengthen/buildRecommendations.ts:129–131` — top flip risk → the "Test the assumption most likely to change the leader" rec (inputs mapped from `challengeFragileEdges` at StrengthenContainer.tsx:94–98). **REUSE.**
- `AdvancedSection` receives `fragileEdgeCount`/`robustEdgeCount` (OutputsDock.tsx:2245–2246 → ResultsBody.tsx:551–552). **REUSE (receipts).**
- Off-tab (unaffected): `ModelTabBody.tsx:400–402` (Model tab), `LensInfoPanel.tsx:158` (canvas graph lens), `TornadoChart` flip markers via `flipThresholds` (retiring with Tornado, §13).

## 7. StrengthenPanel / StrengthenContainer / buildRecommendations / strengthenCopy / strengthenStore — **REUSE**

v6: `#strengthCard` — "Strengthen your model", "N addressed · M worth checking", one-open-by-default list, Try-this lead, Focus on canvas / Not relevant / ask icon, Show more / Expand all, addressed history (prototype :314–323, 408–441).

- `src/components/results/strengthen/StrengthenPanel.tsx` — store-free panel; `data-testid="strengthen-panel"` :271; progress summary :277; exactly-one-open discipline :224–247; per-rec status pills (In progress / Reopened) :123–134; stale label :140; Try-this :158; actions row :177–200.
- `src/components/results/strengthen/StrengthenContainer.tsx` — the ONE store-aware mount (doc :1–33): maps producer inputs (worth_investigating, CEE bias signals, stage), reconciles the lifecycle store per completed analysis, credits the success rec directly on goal-threshold set, labels visible-but-stale, routes primary actions vs the prefilled drawer. `adaptivePriorityFromStage` :63–70 (frame→clarify, ideate→broaden, evaluate→evaluate, decide→commit — the v6 "Adaptive priority" control's live equivalent).
- `src/components/results/strengthen/buildRecommendations.ts` — deterministic trigger ladder (PRIORITY :47–56; success-measure deterministic; flip :129; LEHI path-conditional; VOI honesty; **broaden fires ONLY from a producer bias finding** :251–269; commit producer-gated :280–297; flood control `MAX_PHASE3_PROMOTED = 4` :41; adaptive boost :45).
- `src/components/results/strengthen/strengthenCopy.ts` :6–34 — strings marked "(spec) verbatim from the build-ready v6 prototype copy deck".
- `src/canvas/stores/strengthenStore.ts` (254 lines) — the lifecycle: reconcile-by-id never wholesale replace, reopen-on-new-hash, auto-address, visible-but-stale via `markAllStale`, `restoreDismissed` undo; sessionStorage `strengthen.lifecycle.v1` :66 (doc :1–25; `RecRecord` :36–47).
- Mount: ResultsBody.tsx:315–318 behind `strengthenPanel` (staging-on); flag-off fallback `FocusNowContainer` :320–324 (retires at 3a acceptance).
- **Delta vs v6:** v6's broaden rec uses a "producer-owned option-similarity signal" (prototype :410, diversity control :200–205); staging has no such signal — broaden keys off producer bias findings only. NEW producer dependency if v6's diversity trigger is wanted.

## 8. AdvancedSection receipts — **ADAPT**

v6: one collapsed `<details>` "Advanced and receipts" with a 4-row grid: Simulations / Freshness ("Graph hash match") / Result stability ("Tentative") / Result hash (prototype :324).

- `src/components/results/AdvancedSection.tsx` — accordion titled "Advanced and receipts" :138; receipts grid `data-testid="analysis-receipts"` :319–390 (stability %, simulations, edges, graph size, identifiability, seed, copyable hash :375–386; "the prototype's receipts are for EVERYONE — the expert-mode gate hid…" :320–322). Also still hosts the risk-tolerance slider (doc :4–8) and inference-warning surfacing (:17, :563).
- Mounted ResultsBody.tsx:545–566.
- **ADAPT:** (a) fold the robustness display verdict (today rendered by the footer, §9) into the receipts as v6's "Result stability" row, reusing `derivePostFooterStatus`'s fail-closed mapping; (b) add the "Freshness: graph hash match" receipt row (source: the freshness slice's reason field, already on `data-freshness-reason` — AnalysisFreshnessNotice.tsx:112); (c) decide whether the risk slider stays (v6's receipt block has no slider; RiskAppetiteFilter currently renders in the Options section, ResultsBody.tsx:350, which v6 retires).

## 9. AnalysisFooter + postAnalysisFooter — **RETIRE** (v6 removes the sticky footer)

- `src/canvas/shared/AnalysisFooter.tsx:35–112`, mounted at OutputsDock.tsx:2277–2292 with `derivePostFooterStatus`/`derivePostFooterMeta` from `src/canvas/components/utils/postAnalysisFooter.ts` (imports OutputsDock.tsx:114–115; status derivation :1131). The helper's contract doc (postAnalysisFooter.ts:1–40) is the ROBUSTNESS-VERDICT-CONTRACT: verdict only from producer `robustness.display_verdict`, raw stability only as neutral meta beside a determinate verdict.
- v6 has no post-run footer; its robustness statement becomes a receipt row (§8) and Rerun already exists in TWO v6-sanctioned places staging has: the freshness strip (AnalysisFreshnessNotice.tsx:131–149) and the Actions menu (`rerun_analysis`, ActionsMenu.tsx:107).
- **Keep the pure helper** (`derivePostFooterStatus`) as the verdict→copy mapping for the receipt row; retire the mount. Note the existing V17-only suppression interlock (OutputsDock.tsx:720–725, `suppressAnalysisFooterForOrphanBanner`) goes with it. `AnalysisFooter` itself remains used by the pre-run `StickyFooter` (src/canvas/components/pre-analysis/StickyFooter.tsx:133) — retire the *post-run mount*, not the shared component.
- Related already-dead code: `ResultsFooter.tsx` still exists but is unmounted (deletion note ResultsBody.tsx:587–591).

## 10. DefineSuccessModal / goal-threshold commit path — **REUSE**

v6: `#successModal` — metric/direction/threshold/unit/timeframe/baseline, live sentence preview, "Save and rerun", write-note (prototype :329–343, 507–515).

- `src/components/results/modals/DefineSuccessModal.tsx` — header doc :1–23: "prototype #successModal, build-ready v6 … ONE setter + ONE rerun … never a second rerun pipeline". Copy deck :52–70 matches v6 verbatim incl. the write-note; adds the honesty note "Only the target number affects the analysis today" :67. Commit path: `setGoalThresholdAndUpdateNode(goalNodeId, parsedThreshold)` :203 (fallback bare `setGoalThreshold` :205) then `executeCanonicalRun({ source: 'define-success-modal', … })` :223–224 — the same convention as OutputsDock's `handleApplyThreshold` (OutputsDock.tsx:940–989, node+global write :944–945).
- `src/components/results/modals/successMeasureStore.ts` — structured measure per scenario, sessionStorage, version-keyed (doc :1–18); **honesty contract:** only `threshold` reaches the wire (`SuccessMeasure` :28–42). `measureSentence.ts` builds the preview; `scenarioKey.ts` resolves the key.
- **Current (post-#309/#317-era) representation model:** `store.goalThreshold` holds RAW user units with representation carried explicitly in `store.goalThresholdRepresentation: 'raw' | 'normalised' | null` (store.ts:331; set at :2714 and :2721; node-derived thresholds always 'raw' :1077–1090). Request-side normalisation is UI-SEM-058: `resolveChipGoalThreshold` (useV2Run.ts:192–230) divides by the resolved cap (`resolveGoalThresholdCap` :134–151: analysis_ready first, then goal-node data, then measure-unit cap) and **short-circuits when representation is already 'normalised'** (:226) so a CEE bare-synced 0–1 value is never re-divided (doc :69–78). The V5 chip build applies the same normalisation + representation short-circuit (:598–640). The Strengthen success rec is credited directly on threshold set (StrengthenContainer doc :15–18) so a failed rerun never leaves a stale rec.
- `DecisionRecordModal` (v6 `#decisionModal`) also exists and is REUSE: `src/components/results/modals/DecisionRecordModal.tsx` doc :1–23 — options populated read-only from the live analysed set (never the prototype fixtures), confidence validation closes the prototype's `Number('')===0` hole, sessionStorage `decisionRecordStore.ts`, opened via `openDecisionRecord()` (the spec explicitly flags the prototype's 'ask' routing for the commit rec as "a critical wiring bug not to copy").
- Mounts: `AskOlumiDrawer` / `DefineSuccessModal` / `DecisionRecordModal` mounted once at OutputsDock.tsx:1632–1636 (outside the tab switch — always available).

## 11. FloatingOlumiPanel / AskOlumiDrawer (v6 drawer analogue) — **REUSE**

v6's `#olumiDrawer` ("Work through it with Olumi": fixed bottom-right, context box, prefilled editable textarea, Focus on canvas + Send) maps to **AskOlumiDrawer**, not FloatingOlumiPanel:

- `src/components/results/coaching/AskOlumiDrawer.tsx` — header doc :1–24: "Parity P1 — 'Work through it with Olumi' drawer (prototype #olumiDrawer, build-ready v6)". Anatomy per spec; Send dispatches conversation-typed turn via guidance-store degrade chain (`_dispatchAction → _sendMessage`, :45–47) with an honest disabled state; focus via `focusModelTarget`; self-contained toast. Opened everywhere via `openAskOlumi` (`askOlumiStore.ts`). **REUSE — every v6 "drawer" interaction already routes here** (overview pills/chips, methods, strengthen ask-buttons, framing question).
- `src/canvas/components/FloatingOlumiPanel.tsx` (1,048 lines) — the aiPanelV2 draggable/resizable floating conversation panel (portal), hosting `ConversationPanel` + `AIInputBar`; mounted via `FloatingOlumiPanelHost` at ReactFlowGraph.tsx:2250/2341 behind `aiPanelV2` (default ON). This is v6's "deeper dialogue opens in Olumi" destination. **REUSE unchanged** — v6 does not alter it.

## 12. AnalysisOrphanBanner / InferenceWarningStrip — **REUSE (keep; not in v6 — confirm)**

- `src/components/results/AnalysisOrphanBanner.tsx` — renders only when `useAnalysisStateSource().showOrphanBanner` (source === 'orphaned_plot_result' under the `v5CanonicalAnalysis` flag; doc :1–17); Run analysis fires the V5 chip path :28–36; mounted ResultsBody.tsx:253. Honesty surface, no v6 equivalent; keep unless Paul rules otherwise.
- `src/components/results/InferenceWarningStrip.tsx` — warning-severity producer `inference_warnings` only, humanised, fail-closed (doc :1–23; selector :36–41); mounted ResultsBody.tsx:263 directly below the freshness area. Same class of honest caveat; keep.

## 13. OutputsDock results-tab mount order (full sweep) + retirement candidates

`src/canvas/components/OutputsDock.tsx` (2,406 lines), `effectiveActiveTab === 'results'` block :1785–2294. Order as mounted:

| # | Component / block | Lines | In v6? | Verdict for v6 |
|---|---|---|---|---|
| 1 | `ai-panel-transition-receipt` ("Model drafted. Review readiness.") | 1787–1796 | no | RETIRE-candidate (transitional chrome) |
| 2 | Error display: coached intervention-recovery branch + generic `outputs-error-banner` | 1799–2012 | no (v6 has no error state) | KEEP (error path, orthogonal to v6) |
| 3 | Pre-run: `PreAnalysisPanelV3` (flag `preAnalysisV3`, lazy) / legacy `PreAnalysisPanel` | 2015–2044 | no (v6 is post-run only) | KEEP (pre-run surface, separate workstream) |
| 4 | `slow-run-message` strip | 2046–2056 | no | KEEP (run feedback) |
| 5 | `AnalysisRunningBanner` (running + report) | 2060 | no | KEEP |
| 6 | Cancel button (`isV2RunInFlight`) | 2065–2077 | no | KEEP |
| 7 | `ResultsPanelSkeleton` (running, no report) | 2079–2081 | no | KEEP |
| 8 | `IdentifiabilityBadge` | 2083–2092 | no | RETIRE-candidate (identifiability already a receipt row in AdvancedSection) |
| 9 | `ValidationPanel` (blocker engine critique, freshness-gated) | 2104–2111 | partially (v6 conflict pause-read) | KEEP for now; hero 'paused' status is the v6 conflict surface |
| 10 | `WarningBanner` (response warnings) | 2113–2124 | no | RETIRE-candidate (overlaps InferenceWarningStrip) — decision |
| 11 | `DegradedStateBanner` (CEE degraded / partial ISL) | 2126–2157 | no | KEEP (honesty) — decision |
| 12 | `stale-results-banner` (error + retained report) | 2160–2171 | no | RETIRE-candidate (freshness strip owns staleness) |
| 13 | `conv-results-indicator` ("Updated from conversation") | 2178–2191 | no | RETIRE-candidate |
| 14 | **DecisionOverviewCard** | 2203–2205 | yes | REUSE (§1) |
| 15 | **AnalysisFreshnessNotice** | 2209–2211 | yes (status-strip) | REUSE (§2) |
| 16 | Stale wrapper + **ResultsBody** | 2212–2271 | — | see below |
| 17 | **AnalysisFooter** (post-run) | 2277–2292 | **no** | RETIRE (§9) |

Inside `ResultsBody` (`src/components/results/ResultsBody.tsx`, render :247–599), order:

| # | Component | Lines | In v6? | Verdict |
|---|---|---|---|---|
| a | `AnalysisOrphanBanner` | 253 | no | REUSE/keep (§12) |
| b | `InferenceWarningStrip` | 263 | no | REUSE/keep (§12) |
| c | `WhatChangedChip` (client-side run diff) | 268 | **no** (v6: What-changed lens is producer-blocked, "will not approximate locally") | RETIRE-candidate — decision |
| d | **AnalysisHeroContainer** (flag `analysisHeroPanel`) | 275–284 | yes (merged panel) | REUSE (§3) |
| e | `DecisionConfidencePanel` / `AnalysisHeroV17` (+compare) — only when `analysisHeroPanel` OFF | 292–304 | no | RETIRE once `analysisHeroPanel` is accepted (Wave 2 flag-scoped retirement already written, :286–291); then archive `DecisionConfidencePanel.tsx` + `analysisHeroV17/` module |
| f | **StrengthenContainer** (flag `strengthenPanel`) / `FocusNowContainer` fallback | 315–325 | yes | REUSE (§7); retire FocusNow + `focusNowPanel` at 3a acceptance |
| g | Options comparison: `SectionHeader` "Your options" + `RiskAppetiteFilter` + `WinGauge` + `OptionCards` | 337–409 | **no** (v6's option table lives inside the hero's outcome lens) | RETIRE from tab — decision (note the 2026-05-27 revert comment :330–336 that reinstated it; `CompactOptionSpread` kept-in-repo unused) |
| h | Drivers accordion "What's driving this" + `DriversSection` | 412–437 | **no** (evidence tab) | RETIRE (§5) |
| i | Tornado accordion "What could change the result" + `TornadoChart` + flip-thresholds status notes | 440–484 | **no** | RETIRE — flip risks move to the evidence tab |
| j | `StressTestSection` ("Stress-test your decision") | 488–538 | **no** | RETIRE — content covered by evidence Flip risks + Strengthen challenge recs; methods menu carries pre-mortem/consider-the-opposite |
| k | **AdvancedSection** | 545–566 | yes (receipts) | ADAPT (§8) |
| l | Adjustments-made details (strength corrections) | 569–585 | no | RETIRE-candidate (fold into receipts) — decision |
| m | `DevBuildMarker` (dev+expert only) | 598, 610–625 | no | KEEP (dev-only) |

Dock chrome: tab strip `getOutputTabsForParity` OutputsDock.tsx:232–243 — Olumi | Analysis | Compare(flag) | Model | Journey(flag) — matches the v6 dock (Olumi / Analysis / Compare / Model) except Compare is behind `compareTab` (default off).

## 14. NEW items (nothing usable on staging)

1. **Trade-offs live data** — HeroEvidenceDisclosure renders the Trade-offs view only from a producer/reviewed narrative, "null live — the UI must not invent trade-offs" (doc :23–26). Needs a producer contract.
2. **Per-option Stability lens** — heroTypes.ts:122 requires the per-option producer field; honest-unavailable until then.
3. **What changed lens** — requires versioned run comparisons (producer); local `WhatChangedChip` is explicitly not this.
4. **Option-similarity / diversity signal** for the broaden rec (v6 prototype control) — staging's broaden trigger is producer-bias-only (buildRecommendations.ts:251–269).
5. **Evidence-quality meta** ("Low evidence") on driver rows — no display-safe producer contract yet (HeroEvidenceDisclosure.tsx:14–17).
6. **Direct brief edit** ("Answer directly" writing to a persisted brief) — currently a drawer draft (§1 delta).
7. **Durable decision-record persistence** — sessionStorage only; blocked on identity + Model Management (DecisionRecordModal doc :16–18; v6 prototype-note says the same).

---

### Verdict summary

REUSE: DecisionOverviewCard + ActionsMenu/actionsCatalogue, AnalysisFreshnessNotice + resolveDisplayedFreshness + tab icon, analysis-hero module (panel/container/hook/model/rows/copy/lens tabs/evidence disclosure/next-route), Strengthen stack + strengthenStore, DefineSuccessModal + successMeasureStore + canonical threshold commit, DecisionRecordModal, AskOlumiDrawer, FloatingOlumiPanel, AnalysisOrphanBanner, InferenceWarningStrip, driverDisplayModel.
ADAPT: AdvancedSection (receipt rows: result-stability verdict + freshness receipt; slider decision), DecisionOverviewCard pre-run gating if v6 wants the overview in conflict/pre-run states.
REPLACE: standalone DriversSection accordion → hero evidence Drivers tab.
RETIRE: AnalysisFooter post-run mount (+postAnalysisFooter mount wiring), Options-comparison section (WinGauge/OptionCards/RiskAppetiteFilter placement), Tornado accordion, StressTestSection, DecisionConfidencePanel + analysisHeroV17 module (flag-off fallbacks), FocusNowContainer + focusNowPanel flag, WhatChangedChip, ChallengeSection + ResultsFooter (already dead), stale-results banner, conv indicator, IdentifiabilityBadge, transition receipt.
NEW: producer-blocked items in §14.
