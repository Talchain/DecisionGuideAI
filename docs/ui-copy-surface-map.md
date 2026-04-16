# UI copy surface map

**Date:** 2026-04-03
**Commit:** 799bac0b

---

## Conversation (138 strings)

**Origin breakdown:**
- Developer-authored: 118 (86%)
- From CEE response: 15 (11%)
- Design system specified: 5 (3%)

**Top 3 anomalies:**
1. **Em dashes (5):** BiasAlertIcon tooltips, ConversationPanel error, InlineBlocks staleness warning, BriefCoachingHint
2. **Technical jargon (4):** "factors" in ChatComposer coaching, "Calibrate" in MessageBubble insight chips, "causal" in FactBlockRenderer
3. **Coaching-tone violations (3):** "Must fix" / "Should fix" in GuidanceStrip, "Failed to apply" in ConversationPanel

**Key components contributing text:**
- `ChatComposer.tsx` (stage placeholders, coaching tips)
- `GuidanceStrip.tsx` (category labels, action labels)
- `InlineBlocks.tsx` (block renderers: facts, robustness, evidence, framing, brief, review cards)
- `MessageBubble.tsx` (insight action chips, progressive disclosure)
- `GuideDropdown.tsx` (scaffold, example brief, help text)
- `ActionStrip.tsx` (CTA labels, status text)
- `BaseRateChipRow.tsx` (base rate questions, frequency chips)

---

## Canvas (352 strings)

**Origin breakdown:**
- Developer-authored: 328 (93%)
- Design system specified: 18 (5%)
- From CEE response: 6 (2%)

**Top 3 anomalies:**
1. **Technical jargon (8):** "nodes" in EmptyStateOverlay + CoachMarks + ReconnectBanner, "graph" in DriverChips + onboarding, "Monte Carlo" in StickyFooter + CoachMarks, "EVPI" in StatusBar
2. **Em dashes (10):** RobustnessBlock (6), DraftLoadingAnimation (2), ValidationBanner (1), LayoutGuidedModal (1)
3. **"Coming soon" placeholders (4):** ThinkingModeDropdown, ThinkingModePopover, EvidencePackExport, sandbox EmptyState

**Key components contributing text:**
- `pre-analysis/` subdirectory (Header, BlockersSection, StickyFooter, PreAnalysisPanel, SuccessTarget)
- `DriverChips.tsx` (driver labels, evidence prompts, top causal factors)
- `model-tab/` subdirectory (CoachingCard, ReanalyseBar, StatusBar, strengthBands)
- `WarningBanner.tsx`, `LayoutProgressBanner.tsx`, `DegradedBanner.tsx` (error/warning text)
- `InputsDock.tsx` (framing section: labels, placeholders, coaching)
- `onboarding/CoachMarks.tsx`, `onboarding/EmptyState.tsx` (first-run text)
- `RecommendationCard/` subdirectory (robustness coaching, option comparison)
- `ConfirmDialog.tsx`, `RecoveryBanner.tsx`, `RateLimitNotice.tsx`

---

## Inspector (187 strings)

**Origin breakdown:**
- Developer-authored: 142 (76%)
- Design system specified: 45 (24%)

**Top 3 anomalies:**
1. **Em dashes (9):** coachingText.ts has 8 coaching strings all using em dashes, coachingConfig.ts has 1
2. **Typography token bypass (10):** FactorControllablePanel, FactorObservablePanel, EdgePanel, OutcomePanel using raw `text-xs`, `text-lg`, `text-xl`
3. **Technical jargon (4):** "model" in EdgePanel/OptionPanel/OutcomePanel, "causal link" in EdgePanel, "nodes" in IntelligenceSection

**Key components contributing text:**
- `inspector-v2/inspectorStrings.ts` (centralised section titles, type labels, empty states, ask templates)
- `inspector-v2/coachingConfig.ts` (coaching text per node/edge type)
- `inspector/coachingText.ts` (confidence + effect size coaching)
- `inspector-v2/panels/EdgePanel.tsx` (link types, calibration, fragility)
- `inspector-v2/panels/GoalPanel.tsx` (target, constraints, probability)
- `inspector-v2/panels/OptionPanel.tsx` (changes, win chance)
- `inspector-v2/panels/FactorControllablePanel.tsx` (influence, evidence value coaching)
- `inspector-v2/panels/FactorExternalPanel.tsx` (quick set labels, uncertainty coaching)
- `panels/IssuesPanel.tsx` (graph issues with technical jargon)

---

## Results panel (254 strings)

**Origin breakdown:**
- Developer-authored: 234 (92%)
- Design system specified: 12 (5%)
- From PLoT response: 8 (3%)

**Top 3 anomalies:**
1. **Scientific framing gap:** 63% of coaching/status/empty_state strings are generic/functional. Key offenders: emptyStates.ts (6/7 generic), ConfidenceSection tier descriptions, AttentionBanner
2. **Duplicated strings (3 patterns):** "Show more/less" in 5 components, "In some simulations..." duplicated in DriversSection, empty state prefixes bypassing central constants
3. **Banned-string violations (2):** "simulated scenarios" in OptionCards.tsx:85, em dash in DecisionConfidencePanel.tsx:147

**Key components contributing text:**
- `HeroSection.tsx` (recommendation headline, stability coaching, trust reasons, decision state labels)
- `DriversSection.tsx` (driver ranking labels, elasticity descriptions, VOI hints, flip warnings)
- `ConfidenceSection.tsx` (quality tiers, uncertainty messages, hinge points, tipping points, conditional recs)
- `AdvancedSection.tsx` (risk tolerance, trust narrative, analysis details, structural validity disclaimer)
- `DecisionConfidencePanel.tsx` (evidence dimensions, gap coaching, contested relationships)
- `OptionCards.tsx` (option context lines, win likelihood descriptions)
- `TrustOneLiner.tsx` (trust score, evidence/stability reasons)
- `emptyStates.ts`, `constants.ts` (centralised strings)

---

## Analysis tab (56 strings)

**Origin breakdown:**
- Developer-authored: 52 (93%)
- Design system specified: 4 (7%)

**Top 3 anomalies:**
1. **Coaching-tone violations (4):** "Fix before running" (BlockersSection), "Blocked" (Header, StickyFooter), "Complete required actions" (StickyFooter)
2. **Hardcoded numbers (1):** "1,000 Monte Carlo simulations" in StickyFooter tooltip
3. **Technical jargon (1):** "Monte Carlo" in CTA tooltip

**Key components contributing text:**
- `pre-analysis/Header.tsx` (readiness status labels)
- `pre-analysis/StickyFooter.tsx` (review counts, CTA text, tooltips)
- `pre-analysis/BlockersSection.tsx` (blocker headings, constraint card)
- `pre-analysis/SuccessTarget.tsx` (target editing, constraint management)
- `pre-analysis/PreAnalysisPanel.tsx` (structural flag labels)
- `pre-analysis/ModelHealthCard.tsx` (readiness dimensions)
- `pre-analysis/MissingKnowledgePrompt.tsx` (feedback prompt)

---

## Compare tab (45 strings)

**Origin breakdown:**
- Developer-authored: 45 (100%)

**Top 3 anomalies:**
1. **Technical jargon (6):** "Nodes:", "Edges:", "Edge Summary:", "w/b", "dw / db", "Provenance" in EdgeDiffTable and labels.ts
2. **All-caps violations (1):** EdgeDiffTable table headers with `uppercase tracking-wide`
3. **Hardcoded numbers (1):** "Top changes: 5" hardcoded in CompareSummary

**Key components contributing text:**
- `compare/labels.ts` (centralised labels: Run A/B, diff statuses, summary prefixes)
- `compare/EdgeDiffTable.tsx` (table headers with dense technical abbreviations)
- `compare/CompareSummary.tsx` (summary stats)

---

## Model tab (46 strings)

**Origin breakdown:**
- Developer-authored: 44 (96%)
- Design system specified: 2 (4%)

**Top 3 anomalies:**
1. **Technical jargon (2):** "EVPI" and "pp" in StatusBar, "fragile" in StatusBar
2. **Em dashes (1):** strengthBands.ts "Uncertain -- your input would help"
3. **Duplicated strings (1):** Thinking mode content duplicated between dropdown and popover

**Key components contributing text:**
- `model-tab/StatusBar.tsx` (verification, fragility, EVPI, stability counts)
- `model-tab/ReanalyseBar.tsx` (staleness warning, re-analyse CTA)
- `model-tab/CoachingCard.tsx` (dismissible coaching)
- `model-tab/strengthBands.ts` (band labels and basis descriptions)

---

## Navigation (46 strings)

**Origin breakdown:**
- Developer-authored: 46 (100%)

**Top 3 anomalies:**
1. **Title Case overuse (12):** "My Decisions", "New Decision", "Sign Out", "Create Account", "Show Grid", "Snap to Grid", etc.
2. **Em dash (2):** "Save failed -- retrying" in TopBar, "Analysis run -- {winner} won" in ScenarioListPage
3. **"Coming soon" (1):** "Templates are Coming Soon" in LeftSidebar tooltip

**Key components contributing text:**
- `layout/TopBar.tsx` (view mode, save status, share, settings menu)
- `layout/LeftSidebar.tsx` (tool tooltips)
- `layout/UserAvatarMenu.tsx` (account menu items)
- `navigation/Navbar.tsx` (main nav items, auth actions)
- `CanvasToolbar.tsx` (toolbar labels, run button, reset confirmation)

---

## Modal (56 strings)

**Origin breakdown:**
- Developer-authored: 56 (100%)

**Top 3 anomalies:**
1. **Coaching-tone violations (5):** "Failed to create account", "Sign in failed", "Reset failed", "Failed to save", "Failed to load brief"
2. **Title Case overuse (8):** "Password Reset Complete", "Check Your Email", "Account Created!", "Continue to Sign In", etc.
3. **Exclamation marks (2):** "Account Created!", "Profile updated successfully!"

**Key components contributing text:**
- `auth/LoginForm.tsx`, `auth/SignUpForm.tsx`, `auth/ForgotPasswordForm.tsx`, `auth/ResetPasswordForm.tsx`
- `auth/SignUpConfirmation.tsx`, `auth/ProfileForm.tsx`
- `pages/ProfileSettingsPage.tsx` (profile settings, danger zone, delete confirmation)

---

## Global (67 strings)

**Origin breakdown:**
- Developer-authored: 60 (90%)
- Design system specified: 7 (10%)

**Top 3 anomalies:**
1. **Em dashes (5):** ScenarioListPage activity strings, mappers/constants.ts messages
2. **Technical jargon (2):** "Blueprint" in TemplatesPanel error, "node" in CanvasToolbar reset confirmation
3. **Title Case (4):** "Blueprint Insertion Failed", "Templates Unavailable", "Run Analysis", "Save as Scenario"

**Key components contributing text:**
- `lib/userFriendlyErrors.ts` (centralised error system: 16 error types)
- `lib/mappers/constants.ts` (coaching message templates)
- `config/terminology.ts` (dual terminology mappings)
- `config/aiModels.ts` (model display names)
- `constants/validation.ts` (brief validation, example chips)
- `pages/ScenarioListPage.tsx` (stage labels, activity descriptions)
- `canvas/panels/TemplatesPanel.tsx` (template browser text)
- `utils/sanitiseStatusReason.ts` (fallback error messages)

---

## Copy quality risk concentration

| Surface | Strings | Generic/functional coaching % | Anomaly density | Risk level |
|---------|---------|-------------------------------|-----------------|------------|
| Results panel | 254 | 63% | 0.20 anomalies/string | **High** |
| Canvas | 352 | 58% | 0.15 anomalies/string | **High** |
| Inspector | 187 | 42% | 0.16 anomalies/string | **Medium** |
| Analysis tab | 56 | 55% | 0.14 anomalies/string | **Medium** |
| Conversation | 138 | 48% | 0.09 anomalies/string | **Medium** |
| Modal | 56 | 71% | 0.16 anomalies/string | **Medium** |
| Compare tab | 45 | n/a (no coaching strings) | 0.18 anomalies/string | **Low** (jargon) |
| Model tab | 46 | 40% | 0.09 anomalies/string | **Low** |
| Navigation | 46 | n/a | 0.33 anomalies/string | **Low** (cosmetic) |
| Global | 67 | 45% | 0.10 anomalies/string | **Low** |
