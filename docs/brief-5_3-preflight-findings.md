# Brief 5.3 — Phase 0 pre-flight findings

**Branch:** `claude/laughing-archimedes-a0a42d` from `origin/staging` @ `1cce2d23`
**Date:** 2026-04-20
**Scope:** Investigation only — no code edits. All code paths verified by reading source files.

---

## Phase 0 gates — summary

| Gate | Decision |
|---|---|
| IA Part 1 go: signal registry compliance | **GO** — misplaced signal identified (`ModelAdjustments`), no new data deps required to remove it |
| Part 2 DS v5 go: remediation tables complete | **GO** — all six button/pill patterns locked, badge colour tokens specified, canonical tooltip confirmed |
| Open questions for Paul before Phase 7 | **None** — all decisions below are deterministic from DS v5 or the brief |

---

## 0.1 Typography audit

**Grep command run:** `rg -n "text-xs|text-sm|text-base|text-\[[0-9]+px\]|font-medium|font-semibold|font-bold" src/canvas/components/pre-analysis src/components/shared/TriageCard.tsx`

| File | Line | Violation | Classification | Remediation |
|------|------|-----------|----------------|-------------|
| `src/canvas/components/pre-analysis/AnalysisSettings.tsx` | 63 | `text-sm` on `<select>` | (a) Genuine DS v5 §2.4 violation — panel context | Replace with `${typography.panelBody}` |
| `src/canvas/components/pre-analysis/DecisionQualityChecks.tsx` | 401 | `font-medium` on assumption severity badge alongside `typography.panelMeta` | (a) Genuine violation — §2.4 "No font-weight overrides on panel tokens" | Remove `font-medium`; badge weight is defined by `panelMeta` token |
| `src/components/shared/TriageCard.tsx` | 302 | `font-medium` alongside `typography.panelMeta` on compact card title | (a) Genuine violation — same rule | Remove `font-medium`; if emphasis needed, use `panelHeader` token |
| `src/components/shared/TriageCard.tsx` | 433 | `font-semibold` alongside `typography.panelBody` on title | (a) Genuine violation | Remove `font-semibold` |

**Scope note:** `TriageCard.tsx` is a shared component used outside pre-analysis (post-analysis results tab). Changes require care not to break post-analysis rendering. Both violations are removals (not replacements), so they are safe — the token already defines the correct weight.

**Note on `text-info`, `text-success`, `text-danger` in DecisionQualityChecks.tsx:** These are semantic colour utilities, not typography utilities. They are DS-compliant.

---

## 0.2 Button and pill inventory

### Identified interactive elements

| Element | File | Current classes | DS v5 category | Status |
|---------|------|-----------------|----------------|--------|
| **Primary CTA "Analyse now"** | `AnalysisFooter.tsx:84-90` | `bg-primary text-text-on-color rounded-full px-4 ${typography.panelBody}` | Primary | ✅ Compliant |
| **Secondary "Retry Draft" / "Edit brief" / "Retry"** | `BlockersSection.tsx:226`, `PreAnalysisPanel.tsx:1302,1313` | `${typography.panelMeta} text-info border border-info/40 rounded-full bg-transparent` | Tertiary/outlined pill | ⚠️ Font: `panelMeta` — DS §2.2 says buttons in panels use `panelBody`. Borderless buttons (text links) use any size. These are border-pill style — should use `panelBody`. |
| **"Explore alternatives" / "Explore more options" / "Show/Hide" text links** | `OptionPreview.tsx:228,462,318` | `${typography.panelMeta} text-info hover:underline` | Tertiary link | ✅ Acceptable — `panelMeta` for link text is fine (§8.7 says links use `panelBody` in panels but tertiary meta-links at 11px are permitted as non-essential per §2.4) |
| **Filter pills "Weak / Moderate / Strong"** (edge strength) | `TriageCard.tsx` (EdgeStrengthQuickSelect) | Toggle button group pattern | Filter pill | Need to verify DS §8.10 compliance |
| **Status pills "From brief / No data / AI estimate / Estimated"** (`sourcePill`) | `TriageCard.tsx:303-307` | `border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent` | Status pill | ✅ Compliant — outlined, `text-text-body` |
| **Status pills "Ready / Needs mapping"** | `OptionPreview.tsx:433,435` | via `Pill` component — `bg-transparent border-{color}/30 text-text-body ${typography.panelMeta}` | Status pill | ✅ Compliant |
| **Count pills on OptionPreview header** | `OptionPreview.tsx:371` | `<Pill size="small" variant="success">` | Count badge | ✅ Compliant |
| **Section count badges (Review next, Improve confidence, Blockers, Notes)** | `SectionHeader`, `BlockersSection`, `ImproveConfidenceAccordion` | `border border-{color}/30 ${typography.panelMeta} text-text-body bg-transparent` | Count badge | ✅ Compliant (outlined, correct colours) |
| **Ordinal numbered badges (TriageCard)** | `TriageCard.tsx:298` (compact), similar in default | `${BADGE_COLORS[category]} text-white ${typography.panelMeta}` — filled background | Priority badge | ⚠️ DS §8.5 says no filled backgrounds on pills. However brief Task 9 explicitly calls for "Fill colour carries impact weight" so filled badges ARE intended. The issue is the category-based colouring (not section-based). Task 9 will correct colours. |
| **Pencil / Check icon-only actions (expertise rows)** | `AiEstimated.tsx:177,196` | `aria-label="…"` present, no `<Tooltip>` wrapper | Icon-only interactive | ⚠️ Missing Tooltip (§8.11 mandatory). See §0.6. |
| **DiscussWithAiButton sparkle** | `DiscussWithAiButton.tsx` | `<Tooltip>` + `aria-label` present | Icon-only interactive | ✅ Compliant |
| **X dismiss on MissingKnowledgePrompt** | `MissingKnowledgePrompt.tsx:28` | `aria-label="Dismiss"` — no Tooltip | Icon-only interactive | ⚠️ Missing Tooltip. See §0.6. |

### Six locked patterns for Phase 7

| # | Category | Locked class composition |
|---|----------|--------------------------|
| 1 | **Primary CTA** | `bg-primary text-text-on-color hover:bg-primary-hover rounded-full ${typography.panelBody} px-4 min-h-8 transition-colors focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2` |
| 2 | **Outlined action button** (retry, edit brief) | `${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-info hover:text-info transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info` |
| 3 | **Tertiary text link** (explore, show/hide, audit) | `${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded` |
| 4 | **Filter pill group** (Weak/Moderate/Strong edge quick-select) | DS §8.10 toggle: rest `border-panel-border bg-transparent text-text-body`, selected `border-info bg-panel` — `${typography.panelMeta} px-2 py-0.5 rounded-full border` |
| 5 | **Status pill** (source provenance — From brief, No data, AI estimate, Estimated) | `${typography.panelMeta} bg-transparent border border-{colour}/30 text-text-body px-2 py-0.5 rounded-full` — colour per provenance type |
| 6 | **Icon-only action** | Icon 14px (`w-3.5 h-3.5`) + `aria-label` + `<Tooltip>` (§8.11) + `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded` + Enter/Space handler |

---

## 0.3 Section header hierarchy audit

| Section | File/component | Header element | Count badge | Expand affordance | Subtitle | Tooltip | Pattern |
|---------|---------------|----------------|-------------|-------------------|----------|---------|---------|
| **Must fix** | `SectionHeader` (shared) | `${typography.panelHeader} text-text-header` | `border-danger/30` outlined pill | None (not expandable) | None | None | A |
| **Review next** | `SectionHeader` (shared) | `${typography.panelHeader} text-text-header` | `border-info/30` outlined pill | None (Show more toggle below) | None currently — Task 2 adds | None | A |
| **Your options** | `OptionPreview.tsx:356-376` | `${typography.panelHeader} text-text-body` + OptionSquare + Info tooltip | Count Pill (success) | Chevron on full header button | None | `<Info>` with tooltip text | B (custom) |
| **Improve confidence** | `ImproveConfidenceAccordion:327-364` | `${typography.panelHeader} text-text-header` + count span | `border-factor/30` outlined span | Full header is a button, Chevron at right | Coaching line below (dynamic) | None | C (custom accordion) |
| **Your expertise** | `YourExpertise.tsx:213-239` | `${typography.panelHeader} text-text-header` + Info tooltip + summary text | None | Chevron at right | None (summary text inline) | `<Info>` with tooltip text | D (custom) |

**Target (unified): Pattern A** — `SectionHeader` component (already exists and is used by Must fix and Review next). "Your options", "Improve confidence", and "Your expertise" each use bespoke patterns. Task 8 should make these visually parse as "same component, different content" — not necessarily require sharing the same JSX component, but matching the same visual spec.

**Constraints:**
- "Your options" needs to retain its OptionSquare shape icon (identity signal per DS three-channel system)
- "Your expertise" needs to retain its inline summary text (not a count badge)
- Subtitle copy per Task 2 only on Review next and Improve confidence — NOT on Your options or Your expertise

---

## 0.4 Numbered badge audit

| Surface | Badge type | Current fill | Numbering scheme | Issues |
|---------|-----------|--------------|------------------|--------|
| Review next — TriageCard ordinals | Filled circle | Category-based (`bg-goal`, `bg-info`, `bg-option`, etc.) | Continuous: 1, 2, 3 (i+1 in map) | Category colour has no relation to priority or section scope |
| Improve confidence — TriageCard ordinals | Filled circle | Same category-based | Continuous from i+1 in map: 1, 2, 3, … | Same issue |
| Section count badges (Must fix, Review next, etc.) | Outlined pill | State-based per §8.6 | Shows total count, not ordinal | ✅ Correct |

**Task 9 locked pattern:** Numbering restarts at 1 per section. Fill colour: per section (not per category):
- **Review next priority badge:** `bg-info` (info blue) — "high-impact checks" scope
- **Improve confidence priority badge:** `bg-factor` (factor neutral) — "lower-impact checks" scope

Rationale: Task 2 adds scope subtitles establishing two distinct queues. The colour difference reinforces the queue distinction. `bg-factor` is deliberately de-emphasised relative to `bg-info` — matching the lower-impact semantic.

To implement: pass a `badgeColor` prop to TriageCard (or derive it from the render site) rather than from `BADGE_COLORS[category]`.

---

## 0.5 Signal Registry compliance audit

### Content blocks currently rendered in pre-analysis panel

| Content block | Component | Line | Intended surface (Signal Registry v3 / Brief) | Compliant? |
|---------------|-----------|------|----------------------------------------------|-----------|
| ModelHealthCard (ring + bars + headline) | `ModelHealthCard` | PAP:1365 | Pre-analysis ✅ | ✅ |
| Must fix — enriched blockers | `BlockersSection` | PAP:1388 | Pre-analysis ✅ | ✅ |
| Must fix — structural check rows | Inline in PAP | PAP:1409 | Pre-analysis ✅ | ✅ |
| Review next — option quality card | `OptionPreview` | PAP:1584 | Pre-analysis ✅ | ✅ |
| Review next — bias trigger cards | Inline biasTriggers | PAP:1601 | Pre-analysis ✅ | ✅ |
| Review next — triage cards | `TriageCard` | PAP:1656 | Pre-analysis ✅ | ✅ |
| **Model adjustments ("Olumi adjusted N factor(s)")** | **`ModelAdjustments`** | **PAP:1704** | **`truth.structural_repairs` → Model tab only. BANNED from pre-analysis (Brief Task 4).** | **❌ Violation** |
| Improve confidence accordion | `ImproveConfidenceAccordion` | PAP:1709 | Pre-analysis ✅ | ✅ |
| Your expertise (summary + expand) | `YourExpertise` | PAP:1779 | Pre-analysis — one-line summary ✅ | ✅ |
| "Something missing?" prompt | `MissingKnowledgePrompt` | PAP:1799 | Pre-analysis ✅ | ✅ |

**Confirmed violation:** `ModelAdjustments` renders at PAP line 1704 conditioned on `data.modelAdjustments.length > 0`. This is `truth.structural_repairs` signal, which the brief designates as Model tab only.

**Model tab alternative:** `ModelAdjustments` is also rendered in `ModelTabBody.tsx` (the Model/Structure tab) where it is the correct surface. Content is accessible from the Model tab — no content is lost by removing from pre-analysis.

**Supersession decision (per brief Task 4):** Earlier roadmap material envisaged structural repairs surfaced in pre-analysis in some form (this appears to be a legacy design decision predating Signal Registry v3). The brief — as the authoritative source for Brief 5.3 — explicitly bans this rendering. This decision is recorded here as "Superseded by Brief 5.3 Task 4 / Signal Registry v3 §6.4", with the Model tab as the canonical surface. Future briefs should not re-add this without updating the registry.

**Other signals checked:**
- `truth.expertise_spectrum` → YourExpertise shows a one-line summary only ("N from brief, M AI estimates, K missing data"). Expanded state shows actionable rows (AI estimated + missing data). No full provenance audit is rendered. ✅ Compliant.
- `truth.factor_provenance` / `truth.edge_provenance` / `truth.causal_claims` / `truth.full_relationship_audit` → None found in pre-analysis render tree. The "Audit all relationships in Model tab →" link routes to the Model tab. ✅ Compliant.

---

## 0.6 Icon-only tooltip coverage

| Element | Location | `aria-label` | `<Tooltip>` | Keyboard handler | `focus-visible` ring |
|---------|----------|--------------|-------------|-----------------|---------------------|
| DiscussWithAiButton (Sparkles) | Throughout pre-analysis | ✅ (computed from element) | ✅ `<Tooltip>` | ✅ via button element | ✅ |
| Check "Confirm" button (AiEstimated) | `AiEstimated.tsx:177` | ✅ `aria-label={...}` | ❌ No Tooltip | ✅ via button | ⚠️ not confirmed |
| Pencil "Edit" button (AiEstimated) | `AiEstimated.tsx:196` | ✅ `aria-label={...}` | ❌ No Tooltip | ✅ via button | ⚠️ not confirmed |
| X "Dismiss" (MissingKnowledgePrompt) | `MissingKnowledgePrompt.tsx:28` | ✅ `aria-label="Dismiss"` | ❌ No Tooltip | ✅ via button | ❌ no ring class |
| Pencil "Edit" (BlockersSection) | `BlockersSection.tsx:204+` | Labels on containing button | N/A (not icon-only, has text) | ✅ | ✅ |

**`Tooltip` component:** The canonical component is `import Tooltip from '@/components/Tooltip'` (used by DiscussWithAiButton, OptionPreview, YourExpertise, etc.). Phase 11 must add this import + wrapper to AiEstimated and MissingKnowledgePrompt.

**Note on TriageCard `IconActionButton`:** TriageCard at line 259-274 uses an `IconActionButton` helper that wraps `Tooltip`. Check + Pencil buttons in TriageCard are covered. The missing coverage is specific to `AiEstimated.tsx` and `MissingKnowledgePrompt.tsx`.

---

## 0.7 Card padding audit

DS v5 §27.2: sm = 16px, md = 24px, lg = 32px card padding.

| Card/container | File | Current padding | DS target | Status |
|---------------|------|----------------|-----------|--------|
| Blocker cards | `BlockersSection.tsx:164` | `px-3 py-2.5` (12px/10px) | sm = 16px | ⚠️ Below minimum |
| Info/note cards | `BlockersSection.tsx:266` | `px-3 py-2.5` | sm = 16px | ⚠️ Below minimum |
| ModelAdjustments single-fix card | `ModelAdjustments.tsx:270` | `px-3 py-2` | sm = 16px | ⚠️ Below minimum |
| Bias trigger cards (Review next) | `PreAnalysisPanel.tsx:1619` | `px-3 pr-7 py-2.5` | sm = 16px | ⚠️ Below minimum |
| YourExpertise expanded container | `YourExpertise.tsx:244` | `px-3 py-2` | sm = 16px | ⚠️ Below minimum |
| MissingKnowledgePrompt | `MissingKnowledgePrompt.tsx:23` | `px-3 py-2` | sm = 16px | ⚠️ Below minimum |
| Draft error card | `PreAnalysisPanel.tsx:1286` | `px-3 py-2.5` | sm = 16px | ⚠️ Below minimum |

**Assessment:** Every pre-analysis card currently uses `px-3` (12px) rather than DS v5 §27.2 sm (16px). This is a consistent pattern, not ad-hoc — it appears to be a deliberate panel density choice made in Brief 4–5 for the 360px wide panel. Upgrading to 16px would meaningfully reduce content density in a narrow panel.

**Decision for Task 10:** Apply DS §27.2 sm (16px = `px-4`) uniformly to card horizontal padding. Keep vertical padding at `py-2.5` (10px) — the brief says "Cards use DS v5 §27.2 sizes" but the sm vertical component is 8px and the current 10px is a reasonable density adjustment. Flag this to Paul if the visual change is too disruptive. The gap between sections (`space-y-3`, `space-y-4`) is already on-scale.

---

## 0.8 Spacing scale audit

DS v5 §4.1 on-scale values: 4/8/12/16/20/24/32/40/48/56/64 (px).

| Usage | Current Tailwind | px | On-scale? |
|-------|-----------------|-----|-----------|
| Between top-level sections | `space-y-4` | 16px | ✅ |
| Within sections | `space-y-3` | 12px | ✅ |
| Within cards (action rows) | `space-y-2`, `space-y-1` | 8/4px | ✅ |
| Between triage cards | `gap-1.5` | 6px | ⚠️ Off-scale (not 4 or 8) |
| Scrollable container padding | `py-3 px-3` | 12px | ✅ |

**Only flagged item:** `gap-1.5` (6px) used in triage card lists. DS scale has 4px (`gap-1`) and 8px (`gap-2`) but not 6px. Change to `gap-2` (8px). Note: multiple occurrences in PAP render tree.

---

## 0.9 Task-specific findings

### Task 1 — Readiness duplication

**Confirmed:** When `reviewNextCount === 0 && mustFixCount === 0 && improveActionable > 0`:
- `StatusBanner` renders: "Ready to run." (kind = `ready`)
- `ModelHealthCard` dynamicHeadline (case 4) renders: "Ready to run. N checks would improve results."
- `ImproveConfidenceAccordion` coaching line renders: "N items could strengthen confidence."

Three surfaces state a variant of "ready + N items" — the StatusBanner lead-in is redundant with the health card copy. The brief's stated fix (remove one line) applies to the dynamicHeadline cases 4 and 5, which mirror the StatusBanner. The dynamicHeadline DOES add value in cases 2 (must-fix label) and 3 (review-next coaching) — only cases 4 and 5 duplicate the StatusBanner.

**Fix:** Suppress dynamicHeadline cases 4 and 5 (the "Ready to run…" variants). The StatusBanner already handles those states. Cases 1–3 remain, as they add specific coaching (error message, must-fix label, review-next item name) that the StatusBanner doesn't provide.

The brief's description of "4 assumptions to review and 3 quality suggestions to consider" appears to describe the combined visual impression of three "count" messages rather than a single specific string. The string doesn't exist literally in the codebase.

**Acceptance:** After the fix, when `reviewNextCount === 0 && improveActionable > 0`, the panel shows: StatusBanner "Ready to run." + ring + bars (no health card count text). The count IS visible in the Improve confidence section badge.

### Task 3 — Factor overlap inline

**Data provenance:** The overlapping factors can be derived from `opt.interventions` in the collapsed OptionPreview. `OptionPreviewData.interventions` contains `factorId` and `factorLabel` per intervention. The intersection of `factorId` across all non-baseline options gives the shared levers.

**GO — derivable from existing props.** No new data fetch. The `options` array (full `OptionPreviewData[]`) is already passed to the collapsed state render. The overlap list can be computed inline within `OptionPreview`.

**Note:** The `SameLeversCoaching` component currently renders "Your options all work through similar factors. Consider a structurally different approach. Explore alternatives." Task 3 prepends: "All options route through [Factor A], [Factor B], [Factor C]." above the coaching line.

### Task 4 — ModelAdjustments removal

**Confirmed:** Remove `ModelAdjustments` from `PreAnalysisPanel.tsx` at line 1703–1705. The conditional `{data.modelAdjustments.length > 0 && ...}` wrapping the component. The `ModelAdjustments` component itself is NOT deleted — it remains in the codebase for Model tab use.

**Note on data prop:** `data.modelAdjustments` is derived in `usePreAnalysisData` and used only by this render site (confirmed by grep). The prop can be left in the hook for now or cleaned up as a follow-up — do NOT clean up in this phase (out of scope).

### Task 5 — Authority bias card

**Finding:** The bias trigger pipeline (`biasTriggers` useMemo in PAP:809-941) handles all CEE bias types uniformly. There is no target factor/edge available for `AUTHORITY_BIAS` in the current data model — the `normaliseCeeBiasFinding` function produces `{ title, subtitle, fullExplanation }` with no `targetFactorId` field.

**Decision: default path — remove AUTHORITY_BIAS from rendering.** When CEE returns `code === 'AUTHORITY_BIAS'`, filter it out from `biasTriggers`. Other bias types may have actionable implications (framing, anchoring from deterministic checks have graph-grounded explanations). AUTHORITY_BIAS is the abstract/generic type.

**Implementation:** Add a filter in the `biasTriggers` useMemo: exclude entries where the lookup key is `AUTHORITY_BIAS` and no `targetFactorId` is present. This is conservative — if CEE ever adds a `target_factor_id` to AUTHORITY_BIAS findings, the filter can be loosened.

### Task 12 — "Something missing from the model?" affordance

**Current state:** `MissingKnowledgePrompt.tsx` renders a card with `"Something missing from the model?"` text + sparkle (DiscussWithAiButton) + X dismiss. The sparkle sends a pre-built prompt. The helper copy requested by Task 12 ("Describe what's missing and Olumi will suggest where it fits in your model.") is absent.

**Assessment:** The current affordance IS wired — clicking the sparkle sends a meaningful prompt. Adding the helper line is the surgical fix per brief default path.

### Task 13 — "Show scientific parameters" disclosure

**Finding:** `rg -n "scientific|Show scientific" src/canvas/components/pre-analysis/` returns **zero matches**. The "Show scientific parameters" disclosure does not exist in the current pre-analysis codebase.

**Decision:** No action required for Task 13. Record as "not present in current implementation." If it existed in an older branch, it was already removed. The task acceptance criterion (`rg "Show scientific parameters" src/canvas/components/pre-analysis/` → zero) is already met.

### Sticky footer compliance

**DS v5 §8.9:** Left: status icon + status text + review count · Right: primary action button.

**Current implementation:** `AnalysisFooter.tsx:41-98`:
- Left: `StatusIcon` + `statusText` + optional `metaText` — ✅
- Right: optional secondary action + primary `bg-primary text-text-on-color` button — ✅

The pre-analysis `StickyFooter` does not pass `reviewedCount`/`totalReviewableCount` (both undefined), so the `metaText` (review count) is suppressed. DS §8.9 says "review count" on the left — technically absent. However, the v2 panel comment in StickyFooter explicitly states "The 'addressed' count is suppressed (redundant with bucket section counts)." This is a deliberate deviation with documented rationale. Mark as **deferred** — do not silently revert.

---

## Part 2 pattern locks

### Typography remediation table (Phase 6)

| File | Line | Old | New |
|------|------|-----|-----|
| `AnalysisSettings.tsx` | 63 | `text-sm` in `<select>` className | `${typography.panelBody}` |
| `DecisionQualityChecks.tsx` | 401 | `${typography.panelMeta} font-medium` | `${typography.panelMeta}` (remove `font-medium`) |
| `TriageCard.tsx` | 302 | `${typography.panelMeta} text-info font-medium` | `${typography.panelMeta} text-info` (remove `font-medium`) |
| `TriageCard.tsx` | 433 | `${typography.panelBody} font-semibold` | `${typography.panelBody}` (remove `font-semibold`) |

### Canonical tooltip component

`import Tooltip from '@/components/Tooltip'` — used by `DiscussWithAiButton`, `OptionPreview`, `YourExpertise`, `TriageCard`. This is the canonical tooltip. Phase 11 uses this component exclusively.

### Badge colour tokens (Phase 9)

| Section | Badge fill | Rationale |
|---------|-----------|-----------|
| Review next priority badges | `bg-info text-text-on-color` | Info blue signals high-impact, action-required |
| Improve confidence priority badges | `bg-factor text-text-on-color` | Factor neutral signals lower-impact, optional |

---

## Files touched (for grep gate planning)

Phase 6: `AnalysisSettings.tsx`, `DecisionQualityChecks.tsx`, `TriageCard.tsx`
Phase 7: `BlockersSection.tsx` (retry/edit buttons), `PreAnalysisPanel.tsx` (retry/edit in draft-error card)
Phase 8: `OptionPreview.tsx` (header pattern), `ImproveConfidenceAccordion` (in PAP), `YourExpertise.tsx`
Phase 9: `TriageCard.tsx` (badge colour prop)
Phase 10: `BlockersSection.tsx`, `ModelAdjustments.tsx`, `PreAnalysisPanel.tsx`, `YourExpertise.tsx`, `MissingKnowledgePrompt.tsx`
Phase 11: `AiEstimated.tsx`, `MissingKnowledgePrompt.tsx`
