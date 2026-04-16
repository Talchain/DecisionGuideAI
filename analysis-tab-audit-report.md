# Analysis Tab — Investigation Report

**Date:** 2026-03-27
**Branch:** staging @ `7d43a695`
**Scope:** Pre-analysis (PreAnalysisPanel) + Post-analysis (ResultsBody) in the Analysis tab

---

## Task 1: Component Inventory

### Pre-Analysis Components (PreAnalysisPanel)

| # | Component | File | Status vs v4 |
|---|-----------|------|-------------|
| 1 | ModelHealthCard | `src/canvas/components/pre-analysis/ModelHealthCard.tsx` | **Match** — wraps shared TriageHealthHeader |
| 2 | DecisionHealthRing | `src/canvas/components/pre-analysis/DecisionHealthRing.tsx` | **Match** — ring with evaluative colours |
| 3 | SuccessTarget | `src/canvas/components/pre-analysis/SuccessTarget.tsx` | **Partial** — exists but v4 folds this into the triage panel check rows |
| 4 | BlockersSection | `src/canvas/components/pre-analysis/BlockersSection.tsx` | **Not in v4** — v4 moves blockers into the triage panel's check rows |
| 5 | OptionPreview | `src/canvas/components/pre-analysis/OptionPreview.tsx` | **Match** — "Your options" section |
| 6 | DecisionQualityChecks | `src/canvas/components/pre-analysis/DecisionQualityChecks.tsx` | **Not in v4** — v4 folds checks into triage panel |
| 7 | GoalBaselineInput | `src/canvas/components/pre-analysis/GoalBaselineInput.tsx` | **Partial** — nested in DecisionQualityChecks, v4 has it standalone |
| 8 | YourExpertise | `src/canvas/components/pre-analysis/expertise/YourExpertise.tsx` | **Match** — collapsed calibration list |
| 9 | ContestedRelationships | `src/canvas/components/pre-analysis/expertise/ContestedRelationships.tsx` | **Match** |
| 10 | AiEstimated | `src/canvas/components/pre-analysis/expertise/AiEstimated.tsx` | **Match** |
| 11 | MissingData | `src/canvas/components/pre-analysis/expertise/MissingData.tsx` | **Match** |
| 12 | FromBrief | `src/canvas/components/pre-analysis/expertise/FromBrief.tsx` | **Match** |
| 13 | KeyRelationshipsSubgroup | `src/canvas/components/pre-analysis/expertise/KeyRelationshipsSubgroup.tsx` | **Match** |
| 14 | EdgeEvidenceGaps | `src/canvas/components/pre-analysis/expertise/EdgeEvidenceGaps.tsx` | **Match** |
| 15 | ConfidenceSpectrum | `src/canvas/components/pre-analysis/expertise/ConfidenceSpectrum.tsx` | **Match** |
| 16 | MissingKnowledgePrompt | `src/canvas/components/pre-analysis/MissingKnowledgePrompt.tsx` | **Match** — "Tell the AI" prompt |
| 17 | DraftNotes | `src/canvas/components/pre-analysis/DraftNotes.tsx` | **Not in v4** — v4 folds model adjustments into Advanced |
| 18 | PreMortemSection | `PreAnalysisPanel.tsx` (inline, lines 48–89) | **Not in v4 pre-analysis** — only in v4 post-analysis |
| 19 | ModelSnapshot | `src/canvas/components/pre-analysis/ModelSnapshot.tsx` | **Not in v4** — v4 folds this into Advanced |
| 20 | StickyFooter | `src/canvas/components/pre-analysis/StickyFooter.tsx` | **Partial** — v4 has footer checks, not sticky CTA bar |
| 21 | M1TopActions | `src/canvas/components/pre-analysis/M1TopActions.tsx` | **Not used** — exported but not rendered in PreAnalysisPanel |

### Post-Analysis Components (ResultsBody)

| # | Component | File | Status vs v4 |
|---|-----------|------|-------------|
| 1 | DecisionConfidencePanel | `src/components/results/DecisionConfidencePanel.tsx` | **Match** — triage panel with ring + action cards |
| 2 | TriageHealthHeader | `src/components/shared/TriageHealthHeader.tsx` | **Match** — shared ring + dimension bars |
| 3 | TriageCard | `src/components/shared/TriageCard.tsx` | **Match** — shared action card |
| 4 | ScientificEditor | `src/components/shared/ScientificEditor.tsx` | **Match** — Level 1/Level 2 progressive disclosure |
| 5 | AttentionBanner | `src/components/results/AttentionBanner.tsx` | **Not in v4** — v4 doesn't have a top-level critique banner |
| 6 | RecommendationSection | `src/components/results/RecommendationSection.tsx` | **Partial** — v4 folds hero into the triage panel |
| 7 | HeroSection | `src/components/results/HeroSection.tsx` | **Not in v4** — v4 replaces with triage panel headline |
| 8 | WinGauge | `src/components/results/WinGauge.tsx` | **Match** — "Your options" win probability bar |
| 9 | OptionCards | `src/components/results/OptionCards.tsx` | **Match** — option comparison cards |
| 10 | TippingPoints | `src/components/results/TippingPoints.tsx` | **Partial** — v4 replaces with tornado in "What could change" |
| 11 | DriversSection | `src/components/results/DriversSection.tsx` | **Match** — "What's driving this" |
| 12 | TornadoChart | `src/components/results/TornadoChart.tsx` | **Partial** — v4 puts tornado in its own section |
| 13 | ConfidenceSection | `src/components/results/ConfidenceSection.tsx` | **Partial** — v4 replaces "Your next steps" with triage action cards |
| 14 | ChallengeSection | `src/components/results/ChallengeSection.tsx` | **Match** — "Before you commit" (v4 renames) |
| 15 | AdvancedSection | `src/components/results/AdvancedSection.tsx` | **Match** — collapsed, shows analysis details |
| 16 | CoachingPrompt | `src/components/results/CoachingPrompt.tsx` | **Match** — "Something missing?" prompt |
| 17 | ResultsFooter | `src/components/results/ResultsFooter.tsx` | **Partial** — v4 has different footer structure |
| 18 | TargetProbabilityBars | `src/components/results/TargetProbabilityBars.tsx` | **Match** — constraint probability bars |
| 19 | ProgressBar | `src/components/results/ProgressBar.tsx` | **Match** — "You've addressed N of M" |
| 20 | TrustOneLiner | `src/components/results/TrustOneLiner.tsx` | **Partial** — v4 integrates into triage panel |
| 21 | GuidanceActionItemRow | `src/components/results/GuidanceActionItemRow.tsx` | **Match** |

### Components in Codebase but Not in v4 (Removal Candidates)

| Component | File | Reason |
|-----------|------|--------|
| BlockersSection | `pre-analysis/BlockersSection.tsx` | v4 folds blockers into triage panel check rows |
| DecisionQualityChecks | `pre-analysis/DecisionQualityChecks.tsx` | v4 folds checks into triage panel |
| DraftNotes | `pre-analysis/DraftNotes.tsx` | v4 folds into Advanced |
| ModelSnapshot | `pre-analysis/ModelSnapshot.tsx` | v4 folds into Advanced |
| PreMortemSection | `PreAnalysisPanel.tsx` inline | Not in v4 pre-analysis |
| M1TopActions | `pre-analysis/M1TopActions.tsx` | Exported but never rendered |
| AttentionBanner | `results/AttentionBanner.tsx` | Not in v4 post-analysis |
| HeroSection | `results/HeroSection.tsx` | v4 replaces with triage panel |
| TippingPoints | `results/TippingPoints.tsx` | v4 uses tornado in separate section |

### Components in v4 but Not in Codebase (Need Building)

| Component | What it does | Complexity |
|-----------|-------------|-----------|
| Triage check rows | Pass/fail rows for goal target, constraints, status quo, diversity | Medium |
| Ideation coaching card | Option homogeneity coaching with "Ask AI" CTA | Small |
| "Sharpen your thinking" section | Pre-analysis bias/validity exercises, collapsed | Medium |
| "What could change the result" section | Post-analysis tornado in its own accordion | Small (restructure) |
| "Stress-test your decision" section | Post-analysis exercises with progress tracking | Medium |
| Transition bridge banner | "You verified N items, covering X% of influence" | Small (exists in DecisionConfidencePanel but not wired to OutputsDock) |
| Risk appetite controls | Pre-analysis risk appetite selector | Medium |

---

## Task 2: Section Structure Audit

### Pre-Analysis: Current vs v4

| v4 Section | Current Equivalent | Position Match | Name Match | Expand State |
|---|---|---|---|---|
| 1. Decision readiness (triage) | ModelHealthCard | **Yes** (top) | **Yes** | N/A (always visible) |
| 1a. Check rows | SuccessTarget + BlockersSection + DecisionQualityChecks | **No** — split across 3 separate sections | **No** | N/A |
| 1b. Narrative + top 3 actions | Not present | **Missing** | N/A | N/A |
| 1c. Quick-fix rows | Not present | **Missing** | N/A | N/A |
| 1d. Science nudges | Not present | **Missing** | N/A | N/A |
| 1e. Footer checks | StickyFooter | **Partial** — at bottom, not within triage | **No** | N/A |
| 2. Your options | OptionPreview | **Yes** (after checks) | **Yes** | Always visible |
| 3. Your expertise | YourExpertise | **Yes** | **Yes** | Expanded (v4: collapsed) — **mismatch** |
| 4. Sharpen your thinking | Not present | **Missing** | N/A | N/A |
| 5. Advanced | ModelSnapshot + DraftNotes | **Partial** — split into 2 separate accordions | **No** | Collapsed ✓ |

**Severity:** Should fix — the pre-analysis triage panel lacks the unified structure v4 expects. Current implementation scatters check rows, blockers, and quality checks across separate sections instead of consolidating into a single triage panel.

### Post-Analysis: Current vs v4

| v4 Section | Current Equivalent | Position Match | Name Match | Expand State |
|---|---|---|---|---|
| 1. Stale warning | Stale banner in OutputsDock | **Yes** (conditional) | **Yes** | N/A |
| 2. Transition bridge | TransitionBridge in DecisionConfidencePanel | **Yes** (but props not wired from OutputsDock) | **Yes** | N/A |
| 3. Decision confidence (triage) | DecisionConfidencePanel | **Yes** (position 0 in ResultsBody) | **Yes** | N/A |
| 4. Your options | "How the options compare" section | **Yes** | **No** — old label | N/A |
| 5. What's driving this | DriversSection | **Yes** | **Yes** | Always visible (v4: collapsed) — **mismatch** |
| 6. What could change the result | TornadoChart (inside DriversSection) | **No** — bundled inside Drivers | **No** — no separate section | N/A |
| 7. Stress-test your decision | "Before you commit" (ChallengeSection) | **Partial** | **No** — old label | Collapsed ✓ |
| 8. Advanced | AdvancedSection | **Yes** | **Yes** | Collapsed ✓ |

**Additional post-analysis sections NOT in v4:**
- AttentionBanner (renders above everything)
- RecommendationSection / HeroSection (large hero block — v4 consolidates into triage panel)
- "Your next steps" accordion with ConfidenceSection (v4 moves actions into triage panel)
- CoachingPrompt (standalone card)

---

## Task 3: Data Availability Audit

| Data Point | Available? | Source | Field Path | Gaps |
|---|---|---|---|---|
| 4 health dimensions | **Partial** | Pre: usePreAnalysisData (completeness, evidence, balance, calibration). Post: coachingReadinessDimensions (evidence, robustness, clarity) | Pre: `ceeQuality.structure/10`, `evidenceQuality.ratio`, `balanceScore`, `reviewedCount/totalCount`. Post: `m1Coaching.readiness_signals.dimensions` | Post-analysis has 3 CEE dimensions, not 4. "Structure" and "Verified" must be UI-computed for post-analysis. |
| Decision summary sentence | **Yes** | Pre: graph synthesis. Post: `m1_coaching.executive_summary.decision_statement` | `coachingDecisionStatement` on RecommendationSectionData | Pre-analysis has no CEE field — synthesised from optionCount + goalLabel |
| Goal target + constraints | **Yes** | CEE → goal node. ISL → constraint_analysis | `goal_threshold_raw`, `goal_constraints[]` on goal node. `OptionResult.constraintAnalysis` | Fully populated |
| Status quo presence | **Yes** | `src/canvas/utils/baselineDetection.ts` | `node.data.is_baseline` | 14-keyword detection + value fallback + implicit fallback |
| Option diversity | **Partial** | `usePreAnalysisData.ts:1746` | Check 4: "2+ non-baseline options" in balanceScore | Only checks count. No homogeneity/diversity assessment from CEE. Would need CEE GuidanceItem. |
| Contested edge metadata | **Yes** | CEE multi-pass validation | `edge.data.validation: ValidationMetadata` | All fields populated. EVOI fields null pre-analysis, populated post. |
| EVOI/EVPI on edges | **Post only** | ISL robustness analysis | `validation.evoi_rank`, `validation.evoi_impact` | Always null pre-analysis |
| Influence percentages | **Post only** | ISL factor_sensitivity | `DriverItem.normalisedInfluence` (dynamic 0–1). Pre-analysis: `preAnalysisSensitivity.factor_influence` from PLoT m1 | Pre-analysis influence available when PLoT m1_review runs |
| Risk/trade-off presence | **Yes** | Graph scan | Negative edges: `effect_direction === 'negative'`. Risk nodes: `node.type === 'risk'` | Used in balanceScore computation |
| Transition bridge data | **Partial** | `user_action` tracked on `edge.data.validation`. Reviewed factor count in `usePreAnalysisData` | `reviewedFactorsCount`, `weightedInfluenceReviewed` in StickyFooter | Data exists but DecisionConfidencePanel's `verifiedCount`/`influenceCoverage` props are not wired from OutputsDock |
| Science nudge content | **Partial** | CEE bias_findings, PLoT pre_mortem, decision_quality_prompts | `m1_review.bias_findings[]`, `m1_review.pre_mortem`, `m1_review.decision_quality_prompts[]` | Available post-analysis. Pre-analysis has CEE coaching_summary only — no structured nudges. |
| Trust score | **Yes** | PLoT robustness | `recommendation_stability` (0–1), `robustnessLevel`, `coachingReadinessScore` (0–100) | Highly reliable |
| Target probabilities | **Yes** | ISL constraint analysis | `probability_of_goal` on V2OptionComparison. `ConstraintAnalysis.constraints[].prob_satisfied`. `joint_probability` | Requires goal_threshold in request |
| Winner + margin | **Partial** | PLoT option_comparison | `win_probability` per option. `expected_outcome` per option. Margin computed from delta. | No single "winner + margin" field. `decision_statement` sentence contains winner info. Margin must be derived from option comparison delta. |
| Condition card (fragility) | **Yes** | PLoT robustness | `robustness.flip_thresholds[]`, `topFragileEdge` (computed in useResultsSectionData) | Fully populated |
| M2 narrative | **Yes** | PLoT m1_review | `m1_review.narrative_summary` (string). Gated on `reviewStatus === 'complete'` | Maps to `m2NarrativeSummary` |
| Factor category | **Yes** | CEE v12.4 | `node.data.category: 'controllable' \| 'observable' \| 'external'` | Reliable when CEE populates. May be absent for user-created nodes. |
| Sensitivity for tornado | **Yes** | PLoT factor_sensitivity | `V2FactorSensitivity` array with elasticity, direction, confidence, EVPI | Always present post-analysis |

### Data Points That Don't Exist (Would Need Service Changes)

| Data Point | Required From | Violates F.6? | Notes |
|---|---|---|---|
| Option diversity/homogeneity assessment | CEE GuidanceItem | No (CEE would generate) | CEE would need to assess whether options are too similar |
| Pre-analysis science nudges (anchoring, pre-mortem prompts) | CEE coaching blocks | No | Pre-analysis only has `coaching_summary` string — no structured nudge items |
| Structured winner + margin object | PLoT response | No | Currently derived from option_comparison. A `ranking_summary` object with `winner`, `margin_pct` exists in types but needs verification of population |

---

## Task 4: DS v5 Compliance Audit

### Left-Only Coloured Borders (§6.4) — 2 occurrences

| File | Line | Code | Severity |
|---|---|---|---|
| `src/components/results/HeroSection.tsx` | 761 | `border-l-[3px] border-info` on coaching card | Nice to have — exempt per §16 (coaching card) |
| `src/components/results/ConfidenceSection.tsx` | 493 | `border-l-[3px] border-l-success` on MVS card | Nice to have — exempt per §16.1 (MVS card) |

### focus: Instead of focus-visible: (§6.3) — 16 violations

| File | Lines | Severity |
|---|---|---|
| `src/components/results/HeroSection.tsx` | 704, 734, 925 | Should fix |
| `src/components/results/AttentionBanner.tsx` | 53, 118, 195 | Should fix |
| `src/components/results/GraphLink.tsx` | 88 | Should fix |
| `src/components/results/DriversSection.tsx` | 527 | Should fix |
| `src/components/results/ConfidenceSection.tsx` | 290, 816, 979 | Should fix |
| `src/components/results/BaselineToggleCard.tsx` | 104 | Should fix |
| `src/components/results/TornadoChart.tsx` | 457 | Should fix |
| `src/components/results/SuccessTargetRow.tsx` | 216 | Should fix |
| `src/canvas/components/pre-analysis/DecisionQualityChecks.tsx` | 189 | Should fix |
| `src/canvas/components/pre-analysis/SuccessTarget.tsx` | 260 | Should fix |

### Emoji / Unicode Symbols (§9.9) — 6 violations

| File | Line | Symbol | Replace With | Severity |
|---|---|---|---|---|
| `src/components/results/DriversSection.tsx` | 275 | ⚠️ emoji | Lucide `AlertTriangle` | Should fix |
| `src/components/results/DriversSection.tsx` | 485 | ⚠️ emoji | Lucide `AlertTriangle` | Should fix |
| `src/components/results/ConfidenceSection.tsx` | 521 | ✓ unicode | Lucide `Check` | Should fix |
| `src/components/results/ConfidenceSection.tsx` | 536 | ⚠ unicode | Lucide `AlertTriangle` | Should fix |
| `src/components/results/ConfidenceSection.tsx` | 555 | ✓ unicode | Lucide `Check` | Should fix |
| `src/canvas/components/pre-analysis/expertise/AiEstimated.tsx` | 81 | ✓ unicode | Lucide `Check` | Should fix |

### Raw Font Utilities Without Typography Tokens (§2.4) — 15+ occurrences

| File | Lines | Pattern | Severity |
|---|---|---|---|
| `src/components/results/TrustOneLiner.tsx` | 114, 124 | `font-bold`, `font-semibold` standalone | Should fix |
| `src/components/results/ConfidenceSection.tsx` | 567 | `font-medium` standalone | Should fix |
| `src/components/results/OptionCards.tsx` | 209, 287, 313 | `font-semibold` with raw `text-[12px]`, `text-[14px]` | Should fix |
| `src/components/results/BaselineTargetRow.tsx` | 90 | `font-medium` standalone | Nice to have |
| `src/canvas/components/pre-analysis/EdgeSummarySection.tsx` | 152, 165, 175, 188 | `font-medium` standalone | Nice to have |
| `src/canvas/ui/inspector-v2/shared/IntelligenceSection.tsx` | 100, 107, 120 | `font-medium` standalone | Nice to have |

### Raw Hex Values (§3.12) — None

All hex values found are CSS variable fallbacks (`var(--token, #hex)`), which are standard patterns and not violations.

### Hover States (§7.3) — Compliant

Interactive elements in shared and new components use `hover:bg-panel-hover`. Legacy components (HeroSection, ConfidenceSection) use `hover:underline` for links, which is acceptable for text links per DS v5.

### All-Caps Text (§2.4) — None Found

No `uppercase` class or all-caps hardcoded text found in Analysis tab components.

### Panel Typography 3-Size System (§2.2) — Mostly Compliant

New components (TriageHealthHeader, TriageCard, ScientificEditor, DecisionConfidencePanel) consistently use `typography.panelHeader`, `typography.panelBody`, `typography.panelMeta`. Legacy components have some raw font size usage (see above).

### Accordion Headers (§15.2) — Compliant

`src/components/results/Accordion.tsx` correctly uses `bg-panel` for header backgrounds (line 139).

---

## Task 5: Interaction Audit

| Interaction | Status | Notes |
|---|---|---|
| Accordion expand/collapse | **Works** | 200ms CSS transition on height+opacity. Uses requestAnimationFrame for collapse. |
| Inline edit (click→field→save/cancel) | **Works** | SuccessTarget, GoalBaselineInput — autoFocus, Enter/Escape key handling. |
| Quick-select buttons (mutual exclusion) | **Works** | KeyRelationshipsSubgroup and ContestedRelationships — parent controls state, buttons update edge via callback. |
| "Show interventions" toggle | **Works** | OptionPreview — expanded/collapsed state with "Show interventions" / "Hide" links. |
| Contested edge resolution | **Works** | ContestedRelationships — "Keep original" / "Use review" / "Skip" update `user_action` and `resolved_value` via `handleResolveContestedEdge` in PreAnalysisPanel. |
| "Ask AI" CTA | **Works** | Multiple locations: SuccessTarget, AiEstimated, MissingData, OptionPreview — all call `onSendMessage` which triggers conversation turn. |
| Footer "Analyse now" / "Rerun" | **Works** | Pre-analysis: StickyFooter `onAnalyse`. Post-analysis: AnalysisFooter with "Rerun analysis" label. Both call `handleRunAnalysis` in OutputsDock. |
| Pre/post crossfade | **Partially works** | OutputsDock has `transition-[width,opacity] duration-200` on the dock container + respects `prefers-reduced-motion`. But there is no crossfade between PreAnalysisPanel and ResultsBody — they swap via conditional rendering (`isPreRun`). The post-analysis panel has `animate-fade-in`. |
| Stale warning | **Works** | OutputsDock lines 1251–1272: `stale-results-banner` and `graph-stale-banner` test IDs. Shown when graph changes after analysis completes. |

---

## Task 6: Renamed Labels Check

| Old Label | New Label (v4) | Current State | File(s) | Severity |
|---|---|---|---|---|
| Complete | Structure | **Renamed** in ModelHealthCard + DecisionConfidencePanel | Pre-analysis: `ModelHealthCard.tsx`. Post: `DecisionConfidencePanel.tsx` | Done ✓ |
| Balance | Coverage | **Renamed** in ModelHealthCard + DecisionConfidencePanel | Same files | Done ✓ |
| Calibrated | Verified | **Renamed** in ModelHealthCard + DecisionConfidencePanel | Same files | Done ✓ |
| Contested | Needs your judgement | **Not renamed** — "Contested" still used in TornadoChart tooltip and internal logic | `TornadoChart.tsx:439`, `DriversSection.tsx:675` | Should fix |
| Fragile edges | Sensitive assumptions | **Not renamed** | `AdvancedSection.tsx:239`, `HeroSection.tsx:1075` | Should fix |
| Convergence | Simulation quality | **Not renamed** | `AdvancedSection.tsx:233`, `HeroSection.tsx:1081` | Should fix |
| Before you commit | Stress-test your decision | **Not renamed** | `ResultsBody.tsx:413` (Accordion title) | Should fix |
| How the options compare | Your options | **Not renamed** in post-analysis | `ResultsBody.tsx:189` (SectionHeader title) | Should fix |

---

## Task 7: Missing Components List

| Component | What It Does | Data Dependencies | Blocked By | Complexity |
|---|---|---|---|---|
| **Pre-analysis triage check rows** | Pass/fail rows within triage panel: goal target set, constraints valid, status quo present, option diversity | Goal node state, option list, balance checks | None — data exists | Medium |
| **Pre-analysis narrative + action cards** | Coaching sentence + top 3 prioritised actions within triage | CEE coaching_summary, improvement items sorted by influence | Pre-analysis sensitivity data (already exists via m1) | Medium |
| **Pre-analysis science nudges** | 1–3 contextual coaching prompts (anchoring, confirmation bias) | CEE GuidanceItems or coaching blocks | CEE would need to provide structured nudge items (currently only string `coaching_summary`) | Medium (needs backend) |
| **"Sharpen your thinking" section** | Pre-analysis bias/validity exercises, collapsed accordion | CEE decision_quality_prompts, bias_findings | CEE structured prompts (partially available) | Medium |
| **"What could change the result" section** | Post-analysis tornado in its own accordion, separated from Drivers | Existing tornado data (already computed) | None — restructure only | Small |
| **Risk appetite selector (pre-analysis)** | Pre-analysis risk appetite input (risk_averse/neutral/risk_seeking) | None — UI-only state stored in canvas store | None | Small |
| **Ideation coaching card** | Option diversity assessment with "Explore other strategies" CTA | CEE diversity assessment | CEE would need homogeneity detection | Small (needs backend) |
| **Post-analysis exercise progress** | Track which stress-test exercises user has completed | UI state (session or persisted) | None | Small |

---

## Task 8: Opportunities

### Dead Code Removal

| File | Item | Reason |
|---|---|---|
| `src/canvas/components/pre-analysis/M1TopActions.tsx` | Entire component | Exported but never rendered in PreAnalysisPanel. TriageCard now serves this purpose. |
| `src/canvas/components/pre-analysis/EdgeSummarySection.tsx` | Entire component | Comment in PreAnalysisPanel says "removed in v6 alignment" |
| `src/canvas/components/pre-analysis/EdgeAssumptionsTable.tsx` | Entire component | Referenced in EdgeSummarySection which is removed |
| `src/components/results/TippingPoints.tsx` | Dual-mode component | Mode A (flip threshold tracks) and Mode B (bar chart) — v4 replaces with tornado-only. Consider deprecation. |

### Performance Opportunities

| Item | Location | Issue | Impact |
|---|---|---|---|
| `useResultsSectionData` is ~2500 lines | `src/components/results/useResultsSectionData.ts` | Single massive hook computing all results data. Heavy on every render. | Medium — could split into focused hooks per section |
| `DecisionConfidencePanel` re-merges data | `DecisionConfidencePanel.tsx:345–356` | `allActions` useMemo sorts merged evidence gaps + next actions on every data change. `onSetValue` in deps causes re-creation when parent re-renders. | Low — could stabilise with useCallback at call site |
| `HeroSection` is ~1100 lines | `src/components/results/HeroSection.tsx` | Monolithic component with complex conditional rendering. Renders even when v4 replaces it with triage panel. | Medium — if v4 transition happens, this component becomes dead weight |

### Accessibility Gaps

| Item | Files | Issue | Severity |
|---|---|---|---|
| 16 × `focus:` instead of `focus-visible:` | See Task 4 | Keyboard focus rings show on mouse click, not just keyboard nav | Should fix |
| StatusDot in DecisionConfidencePanel | `DecisionConfidencePanel.tsx:286–295` | Colour-only status indication (green/red dots). No text alternative for colourblind users. | Should fix — already has adjacent text label, but dot itself needs `aria-hidden="true"` |
| TornadoChart tornado bars | `TornadoChart.tsx` | Complex SVG with no `aria-label` on individual bars | Nice to have |

### Data Available but Not Surfaced

| Data | Source | Current Use | Opportunity |
|---|---|---|---|
| `attribution_stability` per driver | ISL bootstrap analysis | Stored on `DriverItem.attributionStability` | Could show stability indicator per driver row |
| `rank_flip_rate` per driver | ISL | Stored on `DriverItem.rankFlipRate` | Could flag "this factor's ranking is unstable" |
| `evpi_percentage_points` per driver | ISL | Stored on `DriverItem.evpiPercentagePoints` | Already used in DecisionConfidencePanel but not in DriversSection cards |
| `decision_quality_prompts` from M2 | PLoT m1_review | Mapped but used only in ChallengeSection | v4 "Stress-test your decision" could render these as interactive exercises |
| Pre-analysis `factor_influence` map | PLoT m1 | Used in YourExpertise subgroup sorting | Could surface in triage panel action card ranking |

### Pattern Simplification

| Pattern | Current | Simplified |
|---|---|---|
| Duplicate dimension label constants | PRE_ANALYSIS_DIMENSIONS in ModelHealthCard + inline in DecisionConfidencePanel | Extract to single shared constant in TriageHealthHeader |
| `evaluativeVar` reimplemented | Was duplicated 3× before extraction to `src/styles/evaluative.ts` — now shared | Done ✓ — but `getBarColour` in TargetProbabilityBars.tsx and `evaluativeColour` in DataBar.tsx still duplicate the same logic |
| Section header naming | "How the options compare" (ResultsBody) vs "Your options" (OptionPreview) | Unify to v4 label "Your options" |

---

## Summary of Priorities

### Blocking (must fix before v4 alignment)
- None identified — all current code functions correctly

### Should Fix (significant v4 gaps)
| # | Item | Effort |
|---|---|---|
| 1 | Rename 5 old labels ("Contested"→"Needs your judgement", "Fragile edges"→"Sensitive assumptions", "Convergence"→"Simulation quality", "Before you commit"→"Stress-test your decision", "How the options compare"→"Your options") | Small |
| 2 | Fix 16 `focus:` → `focus-visible:` violations | Small |
| 3 | Replace 6 emoji/unicode with Lucide icons | Small |
| 4 | Separate tornado into own "What could change the result" accordion | Small |
| 5 | Wire `verifiedCount` + `influenceCoverage` props from OutputsDock to DecisionConfidencePanel | Small |
| 6 | Consolidate pre-analysis SuccessTarget + BlockersSection + DecisionQualityChecks into triage panel check rows | Large |
| 7 | Change DriversSection default state from always-visible to collapsed accordion | Small |
| 8 | Change YourExpertise default state from expanded to collapsed | Small |

### Nice to Have
| # | Item | Effort |
|---|---|---|
| 1 | Remove M1TopActions (dead code) | Small |
| 2 | Add `aria-hidden="true"` to StatusDot colour indicators | Small |
| 3 | Replace raw `font-medium`/`font-semibold` with typography tokens (15+ occurrences) | Medium |
| 4 | Build "Sharpen your thinking" pre-analysis section | Large (needs CEE prompts) |
| 5 | Build risk appetite selector for pre-analysis | Medium |
| 6 | Consolidate `getBarColour` / `evaluativeColour` / `evaluativeVar` into single utility | Small |
