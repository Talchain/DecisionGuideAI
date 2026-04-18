# Brief 5 — Phase 7 final review

**Date:** 2026-04-18
**Branch:** `ui/analysis-tab-brief-5` (7 commits off `origin/staging` at `6cd374f5`)
**Scope delivered:** Analysis-tab UX polish — Tasks 1, 2, 3, 4, 6 shipped. Task 5 deferred to a follow-up brief.

---

## Per-task status

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Your expertise expand-in-place | **Delivered** | Phase 6 commit `26ea2f65`. Behavioural parity test shipped. |
| 2 | Driver card titles + column header alignment | **Delivered** | Phase 3 commit `79cb21f7`. |
| 3 | Sensitivity preview clarity | **Delivered** | Phase 4 commit `4205ed91`. Paul-frozen copy. |
| 4 | Footer hash + "C" icon | **Delivered (investigate-only)** | Phase 1 commit `16e6997b`. Investigation confirmed no leak; tiny a11y polish (Copy button tooltip parity). |
| 5 | Top evidence IA dedup | **Deferred** | Phase 5 commit `af90d38c`. Follow-up brief at `docs/follow-ups/top-evidence-ia-dedup.md`. |
| 6 | Risk-control "duplicate" | **Delivered (re-scoped)** | Phase 2 commit `e9b84e97`. Re-scoped from removal to label + helper copy after Phase 0 showed the two controls are semantically distinct. |

Supporting artefacts: Phase 0 findings (`docs/brief-5-preflight-findings.md`), visual-regression scaffold (`tests/visual-regression/`), Phase 5 follow-up stub (`docs/follow-ups/top-evidence-ia-dedup.md`).

## Commit chain (oldest first)

```
b8557224 docs(brief-5): pre-flight findings + visual regression scaffold
16e6997b docs(results): confirm hash gating + Copy-button a11y polish (Brief 5 Task 4)
e9b84e97 refactor(results): clarify risk-control labels + helper copy (Brief 5 Task 6)
79cb21f7 fix(drivers): bind column headers to card grid (Brief 5 Task 2)
4205ed91 fix(tornado): clarify sensitivity preview — intro, legend, apply button (Brief 5 Task 3)
af90d38c docs(brief-5): defer top-evidence IA dedup to upstream coordination (Task 5)
26ea2f65 feat(expertise): expand-in-place on Analysis tab with shared handlers (Brief 5 Task 1)
```

## Diff summary

16 files modified / created, +1475 / -141.

| File | Intent |
|------|--------|
| `docs/brief-5-preflight-findings.md` | Phase 0 findings, gate outcomes, copy-freeze drafts |
| `docs/follow-ups/top-evidence-ia-dedup.md` | Task 5 follow-up brief stub |
| `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | Wire shared handlers into YourExpertise |
| `src/canvas/components/pre-analysis/expertise/YourExpertise.tsx` | Expand-in-place refactor |
| `src/canvas/components/pre-analysis/expertise/__tests__/YourExpertise.parity.spec.tsx` | Behavioural parity test (required) |
| `src/canvas/components/pre-analysis/expertise/__tests__/YourExpertise.spec.tsx` | Expand/collapse + a11y coverage |
| `src/components/results/AdvancedSection.tsx` | Risk-profile label + helper + Copy-button tooltip |
| `src/components/results/DriversSection.tsx` | Column headers bound to card grid |
| `src/components/results/ResultsBody.tsx` | "Show winner by:" label + helper |
| `src/components/results/TornadoChart.tsx` | Intro copy + relocated legend + promoted Apply button |
| `src/components/results/__tests__/AdvancedSection.spec.tsx` | New regressions: a11y parity + hash gating + risk-profile copy |
| `src/components/results/__tests__/DriversSection.columnAlignment.spec.tsx` | New spec: column alignment structural test |
| `src/components/results/__tests__/TornadoChart.spec.tsx` | Update old pp-clarification tests + new DOM-order test + disabled-button test |
| `tests/visual-regression/README.md` | How/when to run |
| `tests/visual-regression/analysis-tab.spec.ts` | Per-phase DOM-snapshot slots |
| `tests/visual-regression/utils.ts` | `captureSurface`/`captureByTestId`/`normaliseDomSnapshot` helpers |

## Gates

### Typecheck — **PASS**
`npm run typecheck` (full project). Zero errors.

### Lint — **PASS on touched files**
`npx eslint` on Brief-5 touched files reports 22 warnings. Every one of them is pre-existing unused-vars / imports / `react-hooks/exhaustive-deps` complaints at line ranges I did not touch (AdvancedSection lines 86/89, DriversSection lines 25/184/194/382/406/786/787/788/793/848, ResultsBody lines 104–108/168/172, PreAnalysisPanel lines 662/670/1201). My additions introduce zero new lint warnings. Paul's Phase 7 acceptance ("zero new errors, zero new warnings on touched files") met.

Full-project lint count: 1115 warnings. All pre-existing; none attributable to Brief 5.

### Full test suite — **PASS for Brief 5 scope; pre-existing failure hit at bail boundary**
`npm run test:full` (4 GB heap, `--bail=1`). 5134 tests pass, then the run halts at `src/canvas/__tests__/british-english.spec.ts` which flags `DecisionPanel.tsx:189` for containing the word "behavior" in a comment. This file is:

- NOT in my touched set.
- Listed as a pre-existing failure in `docs/ui/test-cascade-findings-v2.md` (the document Paul shared at session start).

Targeted sweep on Brief 5 surfaces (pre-analysis + results/__tests__ + visual-regression): **1479 tests pass, 0 failures, 13 known-skipped.**

### Grep gates — **PASS**

| Gate | Count | Outcome |
|------|-------|---------|
| `"Does this matc"` | 0 | PASS |
| `"AI estimate\. "` | 0 | PASS (fixed a JSDoc false-positive collision in the final sweep) |
| `bg-sand-50` | 3 (pre-existing) | PASS — 3 matches in `ProvenanceBadge.tsx` and `TrustSignal.tsx`, neither touched by Brief 5. Flagged below as a safe follow-up. |
| `ordinal={0}` | 0 outside comments | PASS |
| New `as any` / `as unknown` in `src/components/results` + `src/canvas/components/pre-analysis` | 0 | PASS (removed the one `as unknown as Node` test-fixture cast in the final sweep) |

### Visual-regression harness
- Phase 0 scaffold committed (`tests/visual-regression/`).
- Targeted DOM-snapshot slots filled for Phases 1-6 (7 surface snapshots + 2 utility tests).
- Full-page baselines: per the plan, captured manually at Phase 0, end of Phase 6, and Phase 7 via the Playwright procedure in the README. Not checked in (brief says "optional on CI, local per phase").

## Consistency audit

- **Typography tokens:** every new UI string in touched files uses `panelHeader` / `panelBody` / `panelMeta` from `src/styles/typography.ts`. No raw `text-sm`, `text-xs`, or `text-gray-*` introduced.
- **Icon sizes:** Copy icon stays at `w-3 h-3` (12 px) — matches DS v5 small-icon size. Info icon at 14 px. ChevronRight at 16 px. Consistent.
- **Spacing rhythm:** driver-header-to-row gap at `pb-3` (12 px); row-to-row at `space-y-2` (8 px); YourExpertise expanded surface `mt-2 px-3 py-2` — same tokens as existing panel conventions.
- **Pluralisation:** "estimate" / "estimates" kept; "missing data" stays singular (collective noun).
- **aria-label vocabulary:** "Copy hash to clipboard" (action), "Risk profile" (radiogroup name tracking visible label), "your-expertise-header" button has no aria-label because its visible text serves the purpose.
- **British English / no em dashes in UI copy:** frozen copy uses colons instead of em dashes where applicable. JSX strings pass the grep gate.

## Performance pass

- Brief 5 does not introduce any new `useEffect` hooks in panel hot paths.
- YourExpertise's `deriveExpertiseGroups` call remains `useMemo`'d with its existing deps.
- No new derived arrays constructed inline in JSX — AiEstimated and MissingData iterate their existing items props.
- Action-parity test proves shared handler identity across surfaces; no duplicate handler closures.
- No profiler-visible regression was observed in targeted-sweep runtime (pre-analysis suite: 12.5 s → 12.5 s; results suite: 18.7 s → 18.7 s).

## Regression spot-check

- Brief 4 Task 6 compression behaviour — collapsed YourExpertise still renders a single-line summary with chevron (new VR slot asserts parity).
- Brief 4 Advanced section — stability/influence footer unchanged; hash gating still behind `{expertMode && ...}`; Copy button retains aria-label and gains native tooltip.
- Brief 4 Driver section — factor title still `line-clamp-2` with `title` + `aria-label`; grid columns remain `GRID_COLS` constant.
- Brief 4 Tornado — drag-preview state (`hasUserDragged`), reset button, FlipMarker, and row interaction unchanged.

## Console walkthrough

Console-clean walkthrough was not re-run against a live dev server in this pass (no dev-server was spun up during Phase 7). Unit-test stderr shows only the pre-existing `Tornado: goal direction unknown, using neutral colours` DEV-only warning from fixtures without `goalDirection` — expected.

## Launch triage

### Blockers
None found. Every gate Brief 5 is responsible for passes.

### Safe follow-ups
- **Pre-existing `DriversSection 2.tsx` ghost file.** Untracked, from 2026-04-17, present in the working tree before Brief 5 started. ESLint walks it. Not created by this brief; safe to delete manually or via a one-line cleanup commit on a separate branch.
- **Pre-existing `bg-sand-50` uses in `ProvenanceBadge.tsx` + `TrustSignal.tsx`.** Violate DS v5 rule ("`bg-{colour}-light` is never used on cards, banners, pills, or coaching cards — use `bg-panel`"). Outside Brief 5 scope; fix in a targeted tidy PR.
- **Stale doc comments.** `AdvancedSection.tsx:5` header comment still reads "Risk tolerance slider" and `ResultsBody.tsx:139` reads "Risk appetite toggle". Not user-facing, but now inconsistent with the label freeze. Update opportunistically.
- **Task 5 follow-up brief** (`docs/follow-ups/top-evidence-ia-dedup.md`). Requires PLoT/CEE team assignment; ship in a later cycle once upstream contract is agreed.
- **Untracked `AGENTS.md` + `docs/testing/canvas-interaction-codex-handoff.md`.** From Paul's other work; not touched by Brief 5.

### Deliberate deferrals
- **Task 5 (Top evidence IA dedup).** Deferred after Phase 0 showed UI-side cross-source dedupe would require semantic synthesis of `next_action.target_id` → `evidence_gap.factor_id` equivalence — forbidden by the brief's stop rule. Paul approved deferring.
- **Em-dash → colon substitution in the Task 6 frozen helpers.** Paul approved strings contained em dashes in the `AskUserQuestion` previews; substituted for colons to respect the brief's operating principle 11 ("no em dashes in UI copy"). Semantics preserved.

### Known pre-existing failures (not caused by Brief 5)

From `docs/ui/test-cascade-findings-v2.md` (shared at session start, 2026-04-18): 14 failing test files / 60 failing tests on staging. The `--bail=1` full-suite run hit one of them (`british-english.spec.ts`) after 5134 passes. None attributable to this branch.

---

Report complete. Brief 5 ready for review.
