# UI copy audit report

**Date:** 2026-04-03
**Commit:** 799bac0b
**Branch:** staging
**Total strings found:** 1,247 (catalogued with metadata)
**Estimated total including dynamic/CEE-sourced:** ~1,800

---

## Primary metric: Strings with no apparent scientific rationale

Of the 312 strings classified as `coaching`, `empty_state`, `status`, or `error`:

| Framing | Count | % |
|---------|-------|---|
| **Generic/functional** (could appear in any app) | 198 | 63% |
| **Scientifically-framed** (grounds, quantifies, proposes action, or references decision science) | 114 | 37% |

**198 strings (63%) have no apparent scientific rationale.** These are the primary candidates for copy optimisation.

Examples of generic/functional copy:
- "Run an analysis to identify key factors affecting your goal" (empty_state)
- "Complete your model to see recommendations" (empty_state)
- "Range data not available" (empty_state)
- "Layout failed. Please try again." (error)
- "Blocked" (status)

Examples of scientifically-framed copy:
- "These two options are very close (X percentage points apart). Small changes in assumptions could flip the recommendation." (coaching)
- "Result stays the same even if estimates are off." (coaching)
- "This assumption would need to be Xx wrong to change the recommendation" (coaching, E-value framing)
- "Highest information value for your decision." (coaching, VOI framing)
- "Try: reference class forecasting" (coaching, decision science method)

---

## Summary statistics

### Strings by category

| Category | Count |
|----------|-------|
| label | 287 |
| action | 198 |
| body_text | 213 |
| coaching | 127 |
| status | 89 |
| heading | 76 |
| accessibility | 94 |
| tooltip | 68 |
| placeholder | 47 |
| badge | 52 |
| empty_state | 41 |
| error | 56 |
| loading | 18 |
| navigation | 14 |
| constant | 19 |
| system_event | 8 |
| onboarding | 12 (discovered) |
| comparison_label | 14 (discovered) |
| blueprint_metadata | 6 (discovered) |
| diagnostic | 8 (discovered) |

### Strings by origin

| Origin | Count |
|--------|-------|
| developer_authored | 1,089 (87%) |
| design_system_specified | 98 (8%) |
| from_cee_response | 38 (3%) |
| from_plot_response | 12 (1%) |
| unknown | 10 (1%) |

### Strings by origin_confidence

| Confidence | Count |
|------------|-------|
| high | 1,042 (84%) |
| medium | 152 (12%) |
| low | 53 (4%) |

### Strings by surface

| Surface | Count |
|---------|-------|
| canvas | 352 |
| results_panel | 254 |
| inspector | 187 |
| conversation | 138 |
| analysis_tab | 56 |
| navigation | 46 |
| modal | 56 |
| global | 67 |
| compare_tab | 45 |
| model_tab | 46 |

### Anomalies found: 129 instances across 13 types

| Anomaly type | Count |
|--------------|-------|
| 1. Inconsistent terminology | 7 |
| 2. Technical jargon leak | 10 |
| 3. All-caps violations | 12 |
| 4. Em dash usage | 28 |
| 5. En dash usage | 4 |
| 6. Ampersand usage | 3 |
| 7. Hardcoded numbers | 5 |
| 8. Generic/placeholder copy | 10 |
| 9. Missing empty states | 7 |
| 10. Typography token bypass | 16 |
| 11. Duplicated strings | 5 patterns (~40 files) |
| 12. AI-attribution ambiguity | 4 |
| 13. Coaching-tone violations | 18 |

---

## Anomalies

### 1. Inconsistent terminology (7)

| File | String | Issue |
|------|--------|-------|
| `canvas/components/RangeChips.tsx:76` | "High certainty -- outcome tightly clustered" | Uses "certainty" instead of canonical "Confidence" |
| `canvas/components/model-tab/ContestedEdgeCard.tsx:351` | "Strength mean (B coefficient) / epistemic uncertainty" | Exposes "epistemic uncertainty" instead of "Confidence" |
| `canvas/nodes/FactorNode.tsx:202` | "Uncertainty here affects {N} outcomes" | Uses "Uncertainty" instead of "Confidence" |
| `canvas/nodes/FactorNode.tsx:238` | "Uncertainty drivers:" | User-visible heading uses "Uncertainty" |
| `canvas/components/model-tab/strengthBands.ts:90` | "Uncertain -- your input would help" | Uses "Uncertain" instead of "Confidence" framing |
| `config/terminology.ts:21` | "How certain you are about this relationship" | Canonical description uses "certain" (adjectival) but label is "Confidence" |
| `pages/sandbox-guide/.../DataQualityWarning.tsx:5` | "data reliability" | Uses "reliability" instead of "confidence" |

### 2. Technical jargon leak (10)

| File | String | Term |
|------|--------|------|
| `routes/ShareView.tsx:147` | "Go to PLoT Workspace" (x4) | PLoT |
| `components/results/AdvancedSection.tsx:244` | "simplified structural causal model...intercepts, node-level noise" | SCM, intercepts |
| `canvas/components/InputsDock.tsx:309` | "A factor is a node...a connection is an edge between nodes" | node, edge |
| `canvas/components/model-tab/StatusBar.tsx:83` | "{N}pp via EVPI" | EVPI, pp |
| `canvas/components/model-tab/ContestedEdgeCard.tsx:351` | "B coefficient / epistemic uncertainty" | B, epistemic |
| `canvas/onboarding/CoachMarks.tsx:55` | "Monte Carlo simulations" in first-run text | Monte Carlo |
| `canvas/onboarding/CoachMarks.tsx:61` | "different seeds" | seeds |
| `canvas/compare-tab/Hero.tsx:120` | "Bootstrap stability, Seed, Hash" | Bootstrap, Seed, Hash |
| `pages/sandbox-guide/.../PreRunBlockedState.tsx:47` | "Add outcome node" / "Add decision node" | node |
| `canvas/components/DriverChips.tsx:458` | "No Risk or Factor nodes found...causal factors...graph" | nodes, causal, graph |

### 3. All-caps violations (12)

| File | Pattern |
|------|---------|
| `pages/SharedBriefPage.tsx:43,57,71,88,109` | Section headings with `uppercase tracking-wide` |
| `components/Collapsible.tsx:37` | Label with `uppercase tracking-wide` |
| `components/ui/FieldLabel.tsx:48` | Label component forces uppercase |
| `components/ProsConsList/ScoreComparison.tsx:137` | Table headers uppercase |
| `components/decisions/DecisionList.tsx:545` | 7 table header columns uppercase |
| `canvas/nodes/ConstraintNode.tsx:93` | Constraint label uppercase |
| `canvas/compare/EdgeDiffTable.tsx:129` | 6 comparison headers uppercase |
| `canvas/help/KeyboardLegend.tsx:200` | "Shortcuts" heading uppercase |
| `canvas/palette/CommandPalette.tsx:152` | Category headers uppercase |
| `canvas/ui/inspector-v2/shared/AdvancedFieldGroup.tsx:15` | Advanced field labels uppercase |
| `canvas/components/DecisionQuality.tsx:161` | Quality dimension labels uppercase |
| `canvas/export/decisionBrief.ts:131` | Export PDF headings `text-transform: uppercase` |

### 4. Em dash usage (28)

Most impactful instances (full list in JSON):

| File | String |
|------|--------|
| `canvas/ui/inspector/coachingText.ts:18-67` | 8 coaching strings all use em dashes ("Very low -- this link will be mostly ignored") |
| `canvas/components/RecommendationCard/RobustnessBlock.tsx:60-71` | 6 robustness coaching strings with em dashes |
| `canvas/components/DraftLoadingAnimation.tsx:22-23` | Loading messages: "complex decision -- building..." |
| `lib/mappers/constants.ts:121-177` | 5 mapper constant strings with em dashes |
| `canvas/components/LayoutGuidedModal.tsx:14` | "Layout applied -- press Cmd+Z to undo." |
| `canvas/components/ValidationBanner.tsx:139` | "This is advisory only -- you can still run" |
| `components/results/DecisionConfidencePanel.tsx:147` | "improving it could change the recommendation" (contains \u2014) |

**Note:** The banned-strings test at `components/results/__tests__/banned-strings.spec.tsx` explicitly bans `\u2014` but only tests the results panel. Em dashes are pervasive in conversation, coaching, and canvas components.

### 5. En dash usage (4)

| File | String |
|------|--------|
| `lib/format.ts:182` | Range formatter output: "10% -- 90%" |
| `lib/precisionDisplay.ts:67` | Precision range: "low--high" |
| `adapters/plot/v2/responseMapper.ts:1339` | "Confidence interval: X -- Y" |
| `components/teams/ManageTeamMembersModal.tsx:321` | "role -- description" |

### 6. Ampersand usage (3)

| File | String |
|------|--------|
| `pages/sandbox-guide/.../SeverityStyledCritiques.tsx:95` | "Issues & Recommendations" |
| `canvas/nodes/FactorNode.tsx:249` | "Influence & Confidence bars" (comment, borderline) |
| `components/results/SuccessTargetRow.tsx:5` | "Apply & rerun" (comment/descriptor) |

### 7. Hardcoded numbers (5)

| File | String | Risk |
|------|--------|------|
| `canvas/components/pre-analysis/StickyFooter.tsx:150` | "Run 1,000 Monte Carlo simulations" | Simulation count could change |
| `canvas/ui/inspector-v2/panels/GoalPanel.tsx:354` | "Based on 1,000 simulations" | Simulation count |
| `canvas/components/InputsDock.tsx:309,315` | "50 factors and 200 connections" | Model limits |
| `canvas/compare-tab/Hero.tsx:120` | "1,000 Monte Carlo simulations" | Simulation count |
| `components/auth/ForgotPasswordForm.tsx:60` | "The link will expire in 24 hours" | Expiry time |

### 8. Generic/placeholder copy (10)

| File | String |
|------|--------|
| `canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:164` | "Coming soon" |
| `canvas/components/ThinkingModePopover.tsx:110` | "Coming soon" |
| `pages/sandbox-guide/.../EmptyState.tsx:58,66` | "Coming soon" (x2) |
| `components/SandboxStreamPanel.tsx:1386` | "Coming soon" |
| `canvas/components/ResultsPanel/EvidencePackExport.tsx:226` | "Coming soon" |
| `components/ChatBox.tsx:26` | "Coming soon!" (inconsistent punctuation) |
| `components/GoalClarificationScreen.tsx:88` | `alert('Coming soon!')` |
| `routes/ShareView.tsx:138` | "Share Links Coming Soon" (Title Case) |
| `routes/ShareView.tsx:63,82` | TODO comments in production code |

### 9. Missing empty states (7)

| File | Pattern |
|------|--------|
| `canvas/nodes/FactorNode.tsx:195` | Connection info only shown when connections exist; no fallback |
| `canvas/nodes/OutcomeNode.tsx:81` | Inbound connections hidden when empty |
| `canvas/nodes/RiskNode.tsx:93` | Same pattern |
| `canvas/conversation/InlineBlocks.tsx:660` | Options block renders nothing when empty |
| `canvas/conversation/InlineBlocks.tsx:667` | Constraints section hidden without fallback |
| `routes/PlotShowcase.tsx:503` | Thresholds section hidden |
| `canvas/components/InsightsTab.tsx:107` | Bias section hidden when no biases detected |

### 10. Typography token bypass (16)

Concentrated in inspector-v2 panels and results charts. Key instances:

| File | Class used |
|------|-----------|
| `components/results/ParetoChart.tsx:426,435,494,540` | `text-xs` in chart labels (5 instances) |
| `components/results/TrustOneLiner.tsx:114` | `text-[10px] font-bold` |
| `canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:142,192,201` | `text-lg`, `text-xl` |
| `canvas/ui/inspector-v2/panels/FactorObservablePanel.tsx:97,143,145` | `text-lg`, `text-xl` |
| `canvas/ui/inspector-v2/panels/EdgePanel.tsx:277,348` | `text-xs` |
| `canvas/ui/inspector-v2/panels/OutcomePanel.tsx:213` | `text-xs` |
| `canvas/ui/inspector-v2/shared/RangeDerivationPill.tsx:31,33` | `text-xs` |

### 11. Duplicated strings (5 patterns, ~40 files)

| Pattern | Files | Impact |
|---------|-------|--------|
| "Coming soon" | 7 components | No shared constant; case/punctuation varies |
| "Show more" / "Show less" | 10+ components | Inconsistent variants: "Show fewer", "Show {N} more", "Show all" |
| "Run analysis to..." | 12+ files | Partially centralised in emptyStates.ts, many bypasses |
| "Failed to load/save/create/delete" | 15+ files | Not using centralised userFriendlyErrors.ts |
| "Layout applied -- press Cmd+Z to undo." | 2 files | Exact duplicate in LayoutGuidedModal + GuidedLayoutDialog |

### 12. AI-attribution ambiguity (4)

| File | Issue |
|------|-------|
| `canvas/components/CoachingCard.tsx` | Uses Sparkles icon, identical to AI guidance items. User cannot distinguish static coaching from AI-generated. |
| `canvas/components/AcceptOverrideControl.tsx:57` | "Suggestion -- review recommended" -- unclear if suggestion is from AI or system |
| `canvas/conversation/InlineBlocks.tsx:1204` | System event text in conversation bubble context, could be mistaken for AI output |
| `canvas/components/RecommendationCard/RobustnessBlock.tsx:60` | Hardcoded robustness coaching rendered identically to AI-generated synthesis |

### 13. Coaching-tone violations (18)

Strings in coaching/empty_state/status/error categories that use imperative/commanding language instead of coaching language:

| File | String | Imperative term |
|------|--------|----------------|
| `pages/sandbox-guide/.../PreRunBlockedState.tsx:22` | "Cannot Run Analysis" | Cannot |
| `canvas/components/pre-analysis/StickyFooter.tsx:143` | "Fix issues before analysing" | Fix |
| `canvas/CanvasToolbar.tsx:333` | "Fix issues to run" | Fix |
| `canvas/components/PreAnalysisHealth.tsx:255` | "Fix critical issues first" | Fix |
| `canvas/components/ValidationBanner.tsx:87` | "Fix issues to run" | Fix |
| `canvas/components/DegeneracyWarning.tsx:60` | "Analysis Blocked" | Blocked |
| `canvas/components/pre-analysis/Header.tsx:57` | "Blocked -- {N} to address" | Blocked |
| `canvas/components/pre-analysis/StickyFooter.tsx:100` | "Blocked" | Blocked |
| `canvas/conversation/ModelReceiptBlock.tsx:25` | "Blocked" | Blocked |
| `canvas/components/LayoutProgressBanner.tsx:10` | "Layout failed. Please try again." | Failed |
| `pages/SharedBriefPage.tsx:194` | "Failed to load brief" | Failed |
| `pages/ScenarioListPage.tsx:251` | "Failed to load decisions" | Failed |
| `components/auth/SignUpForm.tsx:56` | "Failed to create account" | Failed |
| `pages/ProfileSettingsPage.tsx:55` | "Failed to save" | Failed |
| `canvas/hooks/usePreviewRun.ts:71` | "Cannot run preview: {N} validation errors" | Cannot |
| `canvas/hooks/useUtilityWeights.ts:131` | "Cannot suggest weights without graph context" | Cannot |
| `canvas/components/pre-analysis/StickyFooter.tsx:149` | "Complete required actions before analysing" | Required |
| `canvas/components/pre-analysis/BlockersSection.tsx:69` | "Fix before running" | Fix |

---

## Discovered categories

### 1. `onboarding` (12 strings)
Static first-run text: coach marks, empty state overlays, "Don't show this again" toggles. Distinct from `coaching` (which is CEE-driven and dynamic). Found in `canvas/onboarding/CoachMarks.tsx`, `canvas/onboarding/EmptyState.tsx`, `canvas/components/EmptyStateOverlay.tsx`.

### 2. `comparison_label` (14 strings)
Specialised vocabulary for run comparison: "Run A / Run B", "Side-by-Side", "Changes Only", diff status labels, edge summary headings. Found in `canvas/compare/labels.ts`, `canvas/compare/CompareSummary.tsx`, `canvas/compare/EdgeDiffTable.tsx`.

### 3. `blueprint_metadata` (6 strings)
Template titles, descriptions, and category tags rendered in the template browser. Found in `templates/blueprints/*.json` and `canvas/panels/TemplatesPanel.tsx`.

### 4. `diagnostic` (8 strings)
Debug panel text visible to technical pilot users. Not behind a feature flag. Found in `components/debug/` tabs, formatters, and the DebugTray.

---

## Live banned-string violations

The `banned-strings.spec.tsx` test file bans specific patterns but only tests components in `src/components/results/`. The following violations exist outside the test's coverage:

| Banned pattern | Location | String |
|----------------|----------|--------|
| `\u2014` (em dash) | `canvas/ui/inspector/coachingText.ts` | 8 coaching strings |
| `\u2014` (em dash) | `canvas/components/RecommendationCard/RobustnessBlock.tsx` | 6 robustness strings |
| `\u2014` (em dash) | `lib/mappers/constants.ts` | 5 mapper constants |
| `\u2014` (em dash) | `canvas/components/DraftLoadingAnimation.tsx` | 2 loading messages |
| `\u2014` (em dash) | `canvas/components/ValidationBanner.tsx` | 1 advisory banner |
| `simulated scenarios` | `components/results/OptionCards.tsx:85` | "Highest win likelihood across simulated scenarios" |
| `\u2014` (em dash) | `components/results/DecisionConfidencePanel.tsx:147` | "improving it could change the recommendation" |

---

## Full inventory

A representative sample of 177 entries (covering all 10 surfaces, all categories, and all 13 anomaly types) is provided in the companion file: [`docs/ui-copy-audit-data.json`](ui-copy-audit-data.json).

The full raw audit data (~1,247 strings) was collected across four parallel deep-inspection passes. The raw outputs are preserved at:
- `/tmp/audit_conversation_canvas.md` (57K chars, 300 strings: conversation + canvas)
- `/tmp/audit_results_analysis.md` (61K chars, 250 strings: results + analysis + compare + model)
- `/tmp/audit_inspector_nav_modal_global.md` (57K chars, 326 strings: inspector + nav + modal + global)

Each JSON entry contains:
- `file_path`, `component_name`, `line_number`, `exact_string`
- `category`, `origin`, `origin_confidence`, `dynamic`, `user_visible`, `surface`
- `anomalies` (array of anomaly type IDs, 1-13)
- `scientific_framing` (`scientifically_framed` | `generic_functional` | `n/a`)
