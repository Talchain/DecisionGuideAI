# Brief 5 — Phase 0 pre-flight findings

**Date:** 2026-04-18
**Branch:** `ui/analysis-tab-brief-5` (off `origin/staging` at `6cd374f5`)
**Scope:** Analysis-tab UX polish (Tasks 1–6) + robustness scaffolding.

---

## Executive summary

Phase 1 exploration traced all six task surfaces. Two tasks re-scope after the Phase 0 go/no-go gate:

| # | Task | Gate | Phase action |
|---|------|------|--------------|
| 1 | Your expertise expand-in-place | **GO** | Phase 6 implements |
| 2 | Driver card titles + column headers | GO | Phase 3 implements |
| 3 | Sensitivity preview clarity | GO (copy freeze required) | Phase 4 after copy approval |
| 4 | Footer hash + "C" icon | **INVESTIGATE-FIRST** | Phase 1 confirms gating before any fix |
| 5 | Top evidence IA dedup | **NO-GO — DEFERRED** | Phase 5 docs-only; follow-up brief for upstream |
| 6 | Risk-control "duplicate" | **RE-SCOPED — LABELS + HELPER COPY** | Phase 2 after copy approval |

Task 5's deferral was approved by Paul after exploration showed the two evidence-card sources (`m1_coaching.evidence_gaps` and `m1_coaching.next_actions`) are semantically distinct with no shared factor_id. UI-side dedupe would require semantic synthesis (brief's stop rule).

Task 6's re-scope was approved by Paul after exploration showed the two controls are not duplicates — they are separate semantic surfaces (local display filter vs persistent risk profile).

---

## Task 1 — Your expertise expand-in-place

**Gate: GO.**

### Current render path
`src/canvas/components/pre-analysis/expertise/YourExpertise.tsx` (lines 1–96). Post Brief-4-Task-6 compression: single button with summary text + chevron, `onClick` calls `useUIStore.getState().setActiveOutputTab('diagnostics')` (line 60–62).

### Pre-compression structure (reference: commit `af23999d`)
Six subgroups behind an `isExpanded` toggle:
- ContestedRelationships, AiEstimated, MissingData, FromBrief, KeyRelationshipsSubgroup, EdgeEvidenceGaps
- Handlers: `onFocusNode`, `onFocusEdge`, `onConfirm`, `onEdit`, `onSetValue`, `onSendMessage`, `onResolveEdge`, `onUpdateEdgeStrength`, `onAddEvidence`, `onHoverEnter`, `onHoverLeave`

### Data accessibility (critical gate evidence)
All required data for Phase 6 scope (AI estimates + Missing data only; contested relationships stay on Model tab) is already accessible in the Analysis-tab render tree via `deriveExpertiseGroups` at `src/canvas/components/pre-analysis/hooks/deriveExpertiseGroups.ts:82–106`:

- `groups.aiEstimated` — filters `improvementItems.verify` by `subgroup === 'cee_inference'`.
- `groups.missingData` — graph nodes with `observedState.value == null`.

### Handler reuse
- Confirm pattern: `AiEstimated.tsx:96` → `onConfirm?.(nodeId)`.
- SetValue pattern: `MissingData.tsx:91` → `onSetValue?.(nodeId)`.
- Discuss pattern: `DiscussWithAiButton` (shared).
- TriageCard (`src/components/shared/TriageCard.tsx:65–78`) exposes same prop shapes (`onConfirm`, `onEdit`, `onSetValue`, `onSendMessage`).
- Inline editor: `ScientificEditor` (imported in `TriageCard.tsx:16`).

### Phase 6 deep-link constraint
**Preserve `useUIStore.getState().setActiveOutputTab('diagnostics')` exactly.** Do not reinterpret or hardcode a new target. The "Audit all relationships in Model tab" bottom link inside the expanded surface uses the same call.

### Semantic stop rule for Phase 6
If mid-phase new semantic stitching or upstream-data synthesis surfaces as a requirement, STOP and escalate. Do not expand scope in UI.

---

## Task 2 — Driver card titles + column header alignment

**Gate: GO.**

### Component
`src/components/results/DriversSection.tsx`. Not a `TriageCard`; uses bespoke `DriverRow` (lines 378–757) inside the file.

### Layout structure
- Grid constant: `GRID_COLS = 'grid-cols-[minmax(120px,1fr)_85px_85px_28px]'` (line 65).
- Column headers: **separate floating grid container** at lines 883–903 with empty-cell placeholders.
- DriverRow list: `<div className="space-y-2.5">` at line 918 — different container from the headers above it.
- Factor title: `line-clamp-2 break-words leading-snug` inside flex `min-w-0` wrapper, already carries `title={cleanedLabel}` (line 565–572).

### Fix shape (for Phase 3)
Bind headers + rows inside one grid container so column alignment is structural, not visual-approximation. Title tooltip already set — ensure keyboard-users get it too (aria-label parity on the title button).

### Typography tokens
`panelBody` (12px) already used for both headers and titles (lines 889, 894, 555). No new tokens required.

### Variant parity
DriverRow is bespoke; not a TriageCard. Variant-parity tests do not apply for Task 2. Documented.

---

## Task 3 — Sensitivity preview clarity

**Gate: GO (copy freeze required).**

### Component
`src/components/results/TornadoChart.tsx`.

### Current state
- Info strip with copy "Drag bars to preview, then apply and rerun for confirmed results" (line 620).
- Axis-labels flex row ("← Weaker / Expected / Stronger →") at lines 593–607, rendered **below** bars (`mt-1.5 ml-[162px]`).
- Conditional Apply-and-rerun button (lines 643–652) gated on `onApplyAndRerun` callback. Custom inline styling (not a shared Button component).
- "Preview only" italic indicator appears after drag (lines 627–631).

### Fix shape (for Phase 4)
- Move intro copy above the bar stack.
- Relocate axis-labels flex row to above the first bar (the element currently at lines 593–607).
- Promote Apply-and-rerun button to a proper primary-button treatment below the bars, gated on `dragState.hasUserDragged`.
- Keep disabled state visually distinct until a drag occurs.

### Copy-freeze drafts (Task 3) — **Paul approval required before Phase 4 code**

| Location | Candidate string |
|----------|------------------|
| Intro (above bars) | "Win-likelihood range if this factor turns out weaker or stronger than expected. Drag to preview." |
| Legend (above first bar) | Retain "← Weaker / Expected: {X} / Stronger →" verbatim (keeps unit-awareness in place). |
| Apply button label | "Apply and rerun" (unchanged). |
| Disabled-state micro-copy | "Drag a bar to preview a change before running." (shown as hover tooltip on the disabled button, or as `aria-describedby`.) |

---

## Task 4 — Footer hash + "C" icon

**Gate: INVESTIGATE-FIRST (HARD).**

### Current state of evidence

- `src/components/results/ResultsFooter.tsx` (the actual footer) renders **stability label + influence %**. No hash. Component ends at line 45.
- Hash lives in `src/components/results/AdvancedSection.tsx:379–400` inside `ExpertBlock` (line 328), which the agent reports as gated by `expertMode`.
- Copy button at `AdvancedSection.tsx:386–397` **already has** `aria-label="Copy hash to clipboard"`.
- `isExpertField` utility (`src/components/results/utils/isExpertField.ts:1–33`) defines `'hash'` as an expert field.

### Phase 1 plan
Phase 1 begins with an investigation step:
1. Render the Analysis tab on both bundles with expert mode off.
2. Confirm whether a hash appears. Trace the rendering path responsible.
3. **If the hash is already correctly gated and the Copy button is already labelled (current evidence suggests both):** Phase 1 is a documentation-only confirmation commit noting the investigation outcome, plus tiny a11y polish (tooltip parity on the Copy icon, `aria-hidden` on any decorative icons encountered).
4. **If a real leak exists:** trace and patch the leak path. Gate correctly via `isExpertField` or equivalent.

Do not invent a fix for a leak that may not exist.

### Phase 1 investigation outcome (2026-04-18)

**No leak exists.** Trace of every hash-rendering site in the Analysis tab:

- **`src/components/results/AdvancedSection.tsx:379-400`** — only live hash-rendering path. Wrapped in `{expertMode && (<ExpertBlock>...)}` at line 327. Gate holds.
- **`src/components/results/RecommendationSection.tsx`** — accepts `responseHash` as a prop but is **dead code** in the Analysis-tab render path. `ResultsBody.tsx:198` comment documents the replacement: "Old RecommendationSection/HeroSection suppressed — triage panel replaces it". Zero `<RecommendationSection ...>` JSX mounts in `src/` outside tests.
- **`src/components/results/ResultsFooter.tsx`** — renders stability + influence only. Component ends at line 45 with no hash mention.
- **`src/components/results/HeroSection.tsx`** — zero `hash` occurrences.
- **`expertMode` initialisation** — `OutputsDock.tsx:371` sets `useState(false)`. Must be toggled via the expert-mode UI to surface the hash row. No default-true path found.

Paul's screenshot showing the hash therefore reflects a legitimate state: the Advanced accordion was expanded with expert mode on. No gating fix required.

**Tiny a11y polish delivered (DS v5 compliance — Paul correction: icon-only interactive requires both aria-label AND tooltip):**

- `AdvancedSection.tsx:386-398` Copy button gains `title="Copy hash to clipboard"` alongside the existing `aria-label`. One-line change.
- Two regression tests added in `AdvancedSection.spec.tsx`:
  - Copy button has both `aria-label` AND `title` (DS v5 parity).
  - Hash is NOT rendered when `expertMode === false`, even when `responseHash` is supplied (locks in the gate).
- Visual-regression Phase 1 slot populated: footer DOM snapshot asserts stability + influence are present and no hash-shaped token (7+ hex chars) appears in the footer's rendered output.

**Outcome classification:** "already-compliant" with a very small polish commit, per the brief's investigate-first rule.

---

## Task 5 — Top evidence IA dedup (DEFERRED)

**Gate: NO-GO. Deferred per Paul.**

### Evidence of semantic divergence
Explored at `src/components/results/DecisionConfidencePanel.tsx:385–545` and `src/components/results/useResultsSectionData.ts:2146–2220`.

| Field | Evidence gaps (source 1) | Next actions (source 2) |
|-------|-------------------------|-------------------------|
| Upstream source | `m1Coaching.evidence_gaps` | `m1Coaching.next_actions` |
| Dedupe key within source | `factor_id` | `action` text + `target_id` |
| Cross-source dedupe key | **none** (target_id is generic, not always a factor_id) | **none** |
| Semantic intent | "Gather evidence on this factor" | "Do this higher-order action" |
| Card shape | Rich factor card (pill, influence, EVPI, inline editor, More chevron) | Headline card ("Gather evidence on X") with description |

### Why this triggers the stop rule
UI-side dedupe would require the UI to judge equivalence between `evidence_gap.factor_id` and `next_action.target_id` — that is semantic synthesis on upstream data. The brief's rule: "implementation MUST NOT merge, reinterpret, or synthesise semantics in UI."

### Phase 5 action
Docs-only commit registering a follow-up brief stub at `docs/follow-ups/top-evidence-ia-dedup.md` requesting upstream coordination (either PLoT emits a unified schema, or PLoT provides a cross-source dedupe hint).

---

## Task 6 — Risk-control "duplicate" (RE-SCOPED)

**Gate: RE-SCOPED per Paul — labels + helper copy only, no state refactor.**

### The two controls are not duplicates

| Attribute | Instance 1 ("Your options") | Instance 2 (Advanced) |
|-----------|------------------------------|-----------------------|
| File | `src/components/results/ResultsBody.tsx:232–251` | `src/components/results/AdvancedSection.tsx:154–189` |
| Label today | "Risk appetite:" | "Risk Tolerance" |
| Option labels | Conservative / Neutral / Aggressive | Risk Averse / Neutral / Risk Seeking |
| State owner | **Local component state** (`useState<RiskAppetite>`, line 140) | **Canvas store via `useRiskProfile` hook** |
| Semantic | Display filter: reweights winner by p10/winProb/p90 | Persistent profile: drives PLoT analysis reruns |
| Blast radius if removed | Lose p10/p90-weighted winner preview | Lose persistent questionnaire + reruns |

### Phase 2 fix shape
Labels alone are too subtle to disambiguate. Add a one-line inline helper or tooltip on each control.

### Copy-freeze drafts (Task 6) — **Paul approval required before Phase 2 code**

| Location | Candidate string |
|----------|------------------|
| Your-options control label | "Show winner by:" |
| Your-options helper (inline sub-label or tooltip) | "Display filter — reweights which option is shown as winner." |
| Advanced control label | "Risk profile" |
| Advanced helper (inline sub-label or tooltip) | "Persistent profile — used when analysis is rerun." |

---

## Visual-regression scaffold (Phase 0 deliverable)

### Location
`tests/visual-regression/` — new directory, picked up automatically by vitest via the existing `tests/**/*.{test,spec}.?(c|m)[jt]s?(x)` glob.

### Approach
Hybrid:
- **Targeted per-phase surface diffs:** DOM-snapshot fallback via Vitest + Testing Library (no dev-server dependency, runs in the Tier-1 fast feedback loop).
- **Full-page snapshots:** manual Playwright capture (repo already has `playwright.config.ts` + `@playwright/test`). Run at Phase 0 baseline, end of Phase 6, and Phase 7. Documented commands in `tests/visual-regression/README.md`.

### Why DOM-snapshot (not pixel) for targeted diffs
- Runs in existing vitest infra without requiring a running dev server or installed browsers.
- Normalises noisy attributes (testids that change per-run, inline style ordering) before comparison.
- Fast enough to run per phase as part of the per-phase self-review.
- The brief explicitly permits this fallback: "Use existing Playwright + screenshot tooling if available, or Vitest + `@testing-library/jest-dom` DOM snapshot as fallback."

### Files delivered in Phase 0
- `tests/visual-regression/README.md` — how/when to run, per-phase cadence.
- `tests/visual-regression/utils.ts` — `captureSurface(node)` helper + normalisation routine.
- `tests/visual-regression/analysis-tab.spec.ts` — placeholder spec enumerating each brief-5-touched surface, with a minimal passing smoke test to verify the scaffold compiles and runs.

### Baselines
No static baseline files committed in Phase 0; the vitest snapshot mechanism stores baselines as `__snapshots__/*.snap` next to the spec on first run. The Phase 0 commit establishes the scaffold; first-run baselines are generated when the spec runs locally.

---

## Ready-to-start checklist

- [x] Branch `ui/analysis-tab-brief-5` off `origin/staging` at `6cd374f5`.
- [x] Pre-flight findings (this doc).
- [x] Copy-freeze drafts for Task 3 and Task 6 — awaiting Paul approval before Phase 2 / Phase 4 code.
- [x] Visual-regression scaffold delivered (see `tests/visual-regression/`).
- [x] Gate outcomes recorded with rationale.
- [ ] Paul approves Task 3 + Task 6 copy freezes (blocks Phase 2 and Phase 4).
- [ ] Phase 1 begins as investigation-first (Task 4 hard gate).
