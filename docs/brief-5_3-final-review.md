# Brief 5.3 — Final review

**Branch:** `claude/laughing-archimedes-a0a42d`
**Date:** 2026-04-20
**Phases completed:** 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14 (Phase 13 was a no-op — target string absent from codebase)

---

## Commits (one per phase, brief-ordered)

| Phase | Commit | Summary |
|-------|--------|---------|
| 0 | `8e33dee5` | Phase 0 pre-flight findings doc |
| 1 | `f44a3eec` | Suppress readiness duplication in dynamicHeadline cases 4–5 |
| 2 | `3c50ba57` | Add scope subtitles to Review next and Improve confidence headers |
| 3 | `b2262ed7` | Render overlapping factor labels in collapsed Your options |
| 4 | `911e99ae` | Remove ModelAdjustments from pre-analysis panel |
| 5 | `8698e2c0` | Suppress AUTHORITY_BIAS card when target_factor_id absent |
| 6 | `f13a1510` | Eliminate raw typography utilities (4 violations) |
| 7 | `6943a5ef` | Use panelBody for outlined action buttons |
| 8 | `e72fdaa3` | Unify section header colour and element |
| 9 | `136d3137` | Section-based ordinal badge colours for triage cards |
| 10 | `4f26f248` | Bring card padding and triage spacing to DS v5 scale |
| 11 | `fe269a2e` | Add Tooltip and focus-visible ring to dismiss X in MissingKnowledgePrompt |
| 12 | `4d5ddecc` | Add helper copy to MissingKnowledgePrompt affordance |

---

## Gate results

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (pre-existing warnings only) |
| Raw typography utilities in changed files | ✅ CLEAN — no `text-xs/sm/base`, `font-medium/semibold/bold` outside tokens |
| Raw hex colours | ✅ None introduced |
| New `as any` / `as unknown` | ✅ None introduced (3 pre-existing in PAP unchanged) |
| `aria-label` + `<Tooltip>` on new interactives | ✅ MissingKnowledgePrompt dismiss X: Tooltip added, ring added |
| ModelAdjustments render site removed from PreAnalysisPanel | ✅ Confirmed — `ModelAdjustments.tsx` intentionally retained in pre-analysis directory for Model tab use; gate is "no render in `PreAnalysisPanel.tsx`", not a directory-wide string match |
| British English, sentence case | ✅ Verified in all new copy |
| Em dashes | ✅ None introduced |
| Pre-analysis spec (95 tests) | ✅ All passing |
| MissingKnowledgePrompt spec | ✅ Passing |
| OptionPreview spec | ✅ Passing |

---

## Task-by-task decisions

### Task 1 — Readiness duplication
Suppressed `dynamicHeadline` cases 4 ("Ready to run. N checks...") and 5 ("Ready to run."). The StatusBanner already owns those states. Cases 1–3 (CEE override, must-fix label, review-next coaching) are preserved. Two spec assertions updated to `queryByTestId + not.toBeInTheDocument()`.

### Task 2 — Scope subtitles
Added `subtitle` prop to `SectionHeader` (column layout when present, unchanged flat row otherwise). Added `subtitle` prop to `ImproveConfidenceAccordion`. Both render in `panelMeta text-text-light`. Existing callers of `SectionHeader` without `subtitle` are structurally unaffected.

### Task 3 — Factor overlap inline
`sharedFactorLabels()` helper computes intersection of non-baseline option `interventions.factorId` sets. Renders "All options route through [A], [B]." in `panelMeta text-text-light` above `SameLeversCoaching` in collapsed state only. Returns `[]` when fewer than 2 non-baseline options (no intersection possible).

### Task 4 — ModelAdjustments removal
Removed render block and import from `PreAnalysisPanel.tsx`. `data.modelAdjustments` field retained in hook — `ModelAdjustments` component remains in codebase for Model tab use. No content is lost.

### Task 5 — AUTHORITY_BIAS filter
Added `target_factor_id?: string` to `RawBiasFinding`. Filter added before `normaliseCeeBiasFinding` call: skip if `code === 'AUTHORITY_BIAS' || type === 'authority_bias'` AND no `target_factor_id`. Conservative — can be loosened when CEE adds target anchoring.

### Task 6 — Typography violations
4 removals: `text-sm` → `panelBody` in `AnalysisSettings`; `font-medium` removed from `DecisionQualityChecks` badge; `font-medium` removed from `TriageCard` compact title; `font-semibold` removed from `TriageCard` default title.

### Task 7 — Outlined action buttons
`panelMeta` → `panelBody` on 4 "Edit brief" / "Retry Draft" buttons: 2 in `BlockersSection.tsx`, 2 in `PreAnalysisPanel.tsx` draft-error card. DS v5 §2.2: border-pill interactive elements use `panelBody`.

### Task 8 — Section header unification
`OptionPreview` title: `text-text-body` → `text-text-header` (the only colour mismatch). `ImproveConfidenceAccordion` header: `<p>` → `<h3>` for semantic parity with `SectionHeader`. `YourExpertise` was already compliant.

### Task 9 — Ordinal badge colours
Added `badgeColor?: string` prop to `TriageCard` (default: `BADGE_COLORS[category]`). Also changed `text-white` → `text-text-on-color` (DS semantic token). Review next triage: `bg-info`. Improve confidence triage: `bg-factor`. Ordinal numbering already restarts per section — no change required.

### Task 10 — Card padding and spacing
All pre-analysis card horizontal padding: `px-3` (12px) → `px-4` (16px) per DS v5 §27.2 sm. Vertical stays at `py-2.5` (density-appropriate for 360px panel). Triage card list gap: `gap-1.5` (6px, off DS scale) → `gap-2` (8px).

### Task 11 — Icon-only tooltip coverage
`AiEstimated.tsx` — already compliant from Brief 5.2 Task 8 (Tooltip + focus-visible ring present). `MissingKnowledgePrompt.tsx` dismiss X — added `<Tooltip delay={300} content="Dismiss">` and `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`. Fixed incorrect relative import path to use `@/components/Tooltip` alias.

### Task 12 — Helper copy
Added helper paragraph to `MissingKnowledgePrompt`: "Describe what's missing and Olumi will suggest where it fits in your model." Rendered in `panelMeta text-text-light`. Layout changed from `items-center` flat row to `items-start` with text in a flex-col container.

### Task 13 — "Show scientific parameters" (no-op)
`rg "scientific|Show scientific" src/canvas/components/pre-analysis/` → zero matches. Target was already absent. Recorded in Phase 0 findings.

---

## Deferred / out of scope

- `data.modelAdjustments` hook field cleanup (brief explicitly excluded)
- Sticky footer review count (deliberate deviation with documented rationale in Phase 0)
- DS v5 `text-text-on-color` → `text-white` cleanup across legacy badge sites outside this brief's scope
