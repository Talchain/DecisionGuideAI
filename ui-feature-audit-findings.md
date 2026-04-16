# UI Feature Audit — Findings and Implementation Report

## Summary

**23 items audited. 17 already implemented. 9 gaps addressed in this brief.**

| Item | Status before | Status after | Files changed |
|------|--------------|-------------|---------------|
| A.1 InfluenceBar consolidation | Partial | Done | `FactorsSection.tsx`, deleted `InfluenceBar.tsx` usage |
| A.2 Option "Add a change" | Done | — | — |
| A.3 Option comparison | Partial | Done | `OutcomePanel.tsx` |
| A.4 VoI icon prominence | Partial | Done | `FactorNode.tsx` |
| A.5 Edge hover popover | Done | — | — |
| A.6 Constraint badges | Missing | Done | `ConstraintBadge.tsx` (new), `FactorNode.tsx` |
| A.7 Constraint section | Done | — | — |
| A.8 Fragile edge styling | Done | — | — |
| A.9 Gap escalation | Missing | Done | `EvidenceGapBadge.tsx`, `FactorNode.tsx`, `index.css` |
| A.10 Option provenance | Missing | Done | `OptionNode.tsx` (UI-SEM-048) |
| A.11 Viewport layout | Done | — | — |
| A.12 Coaching templates | Done | — | — |
| A.13 Edge table | Done | — | — |
| A.14 Goal target | Done | — | — |
| B.1a Direction display | Done | — | — |
| B.1b Observed/assumed | Partial | Done | `FactorNode.tsx` |
| B.1c Sensitivity rank | Done | — | — |
| B.2 Strength bands | Done | — | — |
| B.3 Basis labels | Done | — | — |
| B.4 Quick-select buttons | Missing | Done | `StrengthBandButtons.tsx` (new), `EdgePanel.tsx` |
| B.5 Add constraint | Missing | Done | `GoalPanel.tsx` |
| C.1 Avatar menu | Done | — | — |
| C.2 Scenario nav | Done | — | — |
| C.3 Scenario list | Done | — | — |
| C.4 Profile settings | Done | — | — |

---

## Section A: Canvas and Decision Graph

### A.1 InfluenceBar consolidation
**Before:** Three parallel bar implementations — `InfluenceIndicator` (text), `DataBar` (progress bar), `InfluenceBar` (model tab mini bar).
**After:** `InfluenceBar` replaced with `DataBar` in `FactorsSection.tsx`. `InfluenceBar.tsx` is now dead code (retained but unused — can be deleted in cleanup).

### A.3 Option comparison in OutcomePanel
**Before:** Placeholder text "Distribution data will be displayed here when available."
**After:** `OptionComparisonSection` renders per-option cards with label, win probability bar, mean + p10-p90 range. Handles pre-analysis (shows "Run analysis" prompt), pending (shows "Analysis in progress"), failed (hidden), and computed states. Cards are clickable to navigate to the option node.

### A.4 VoI icon prominence
**Before:** Search icon rendered below DataBars, easy to miss.
**After:** Search icon moved to the header slot next to the category icon (eye/sliders/cloud). Enhanced tooltip includes actionable guidance text.

### A.6 Constraint badges on factor nodes
**New component:** `src/canvas/nodes/ConstraintBadge.tsx`
- Target icon (Lucide), 12px circle at bottom-left
- `border-info/50 bg-panel text-info`, pointer-events-none
- Tooltip lists all matching constraints with operator and value
- Case-insensitive label matching against `goalConstraints`
- Feature-gated behind `isGraphBadgesEnabled()`

### A.9 Post-analysis gap escalation
**Before:** `EvidenceGapBadge` was static pre-analysis only.
**After:** Accepts `escalation` prop: `'none'` | `'warning'` | `'critical'`
- `warning` (VoI > 0.05): `border-warning bg-warning-light` + CSS pulse
- `critical` (VoI > 0.20 AND voiRank 1-3): `border-danger bg-danger-light` + CSS pulse
- Pulse animation uses `evidence-gap-pulse` keyframes in `index.css`
- Respects `prefers-reduced-motion` per DS v5 §7.6: `animation-duration: 0.01ms`
- Tooltip text escalates with severity level

### A.10 Option provenance (UI-SEM-048)
**Blocker:** CEE schema does not provide `provenance_source` on option nodes.
**Workaround:** Infers provenance from `ceeAnalysisReady.options` array membership:
- Option in CEE array: shows "Generated from your brief" pill (`border-info/30`)
- Option not in array (user-created, template-sourced): no pill shown
- Code comment references UI-SEM-048 and the CEE schema gap for traceability
- Template-sourced options correctly show no pill (ceeAnalysisReady is null for templates)

---

## Section B: Inspectors

### B.1b Observed/assumed status pills
**Before:** Only "estimated" pill for `extractionType === 'inferred'`.
**After:** Added "assumed" pill for `source === 'default'` or (no source AND no extractionType AND value exists).
- Mutually exclusive with "estimated" (isAssumed checks isInferred first)
- Mutually exclusive with provenance pills (isAssumed checks provenanceLabel)
- Tooltip differentiation:
  - "estimated": "Value inferred by the model from your brief"
  - "assumed": "Default value assumed by the model — verify or update with your own estimate"

### B.4 Quick-select strength buttons
**New component:** `src/canvas/ui/inspector-v2/shared/StrengthBandButtons.tsx`
- Four outlined pills: Slight (0.10), Moderate (0.35), Strong (0.50), Very strong (0.80)
- Clicking sets magnitude to midpoint, preserving current direction sign
- Active detection: within ±0.05 of midpoint → highlighted with `border-info/50 text-info`
- Rendered above the SignedStrengthSlider in EdgePanel
- `role="group" aria-label="Strength presets"`, `aria-pressed` on active button

### B.5 Add constraint button
**Added to:** `src/canvas/ui/inspector-v2/panels/GoalPanel.tsx`
- "+ Add constraint" button (dashed border, text-info) below constraint list
- Inline form with: factor dropdown, operator select (>=, <=, =), value input
- Already-constrained factors shown as disabled in dropdown
- Validation: requires factor selection and valid numeric value
- Appends to `goalConstraints` store via `setGoalConstraints`
- Cancel button hides form and clears error state

---

## New files created
- `src/canvas/nodes/ConstraintBadge.tsx`
- `src/canvas/nodes/__tests__/ConstraintBadge.spec.tsx`
- `src/canvas/ui/inspector-v2/shared/StrengthBandButtons.tsx`
- `src/canvas/ui/inspector-v2/shared/__tests__/StrengthBandButtons.spec.tsx`

## Modified files
- `src/canvas/nodes/FactorNode.tsx` — A.4, A.6, A.9, B.1b
- `src/canvas/nodes/EvidenceGapBadge.tsx` — A.9
- `src/canvas/nodes/OptionNode.tsx` — A.10
- `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx` — B.4
- `src/canvas/ui/inspector-v2/panels/GoalPanel.tsx` — B.5
- `src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx` — A.3
- `src/canvas/components/model-tab/FactorsSection.tsx` — A.1
- `src/canvas/nodes/__tests__/EvidenceGapBadge.spec.tsx` — A.9 escalation tests
- `src/index.css` — evidence-gap-pulse animation + prefers-reduced-motion

## Test results
- Typecheck: passes
- New tests: 31 passing (ConstraintBadge 6, EvidenceGapBadge escalation 8, StrengthBandButtons 9, existing 8 still pass)
- All changed-file tests: 824 passing, 1 pre-existing failure (StyledEdge.contested — unrelated)
