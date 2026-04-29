# Brief 5.7 — Final review

Branch: `ui/analysis-tab-hotfix-5_7` (local only, not pushed)
Base: `staging` at `2da7b129`
Branch range: `b4e6ac97..HEAD` — D1..D7 originals (`b4e6ac97..6d1daba5`), D8 docs (`ce075760`), D5/D6/D7 follow-ups from review feedback (`94bcaccb..be7b8c38`), and the close-out doc commits that produced this file (the most recent on the branch). Use `git log --oneline ui/analysis-tab-hotfix-5_7` for the live ordering, since this file lives on the same branch and cannot self-reference its own commit hash.

---

## Per-deliverable status

| # | Deliverable | Commit | Status | Notes |
|---|---|---|---|---|
| D1 | Precondition baseline | `b4e6ac97` | Done | Branch + baseline doc + stash hygiene captured |
| D2 | Remove Model checks card | `53904990` | Done | JSX block + ScienceNudgeCard + buildScienceNudges + Lightbulb import all dead-coded; equivalent factor signal lives in DriversSection dominant-factor warning |
| D3 | Validate chip topDriver fallback | `d31c8f3d` | Done | dominantFocusId derives from `data.dominantFactorId ?? topDriver.matchedNodeId ?? topDriver.factorKey`; +3 regression tests |
| D4 | Confidence dots → thin bar | `0cd4f999` | Done | Bar with `bg-info` h-1 + numeric readout; spec §2.2 Pattern C amended; +2 regression tests |
| D5 | Authority bias filter | `b96fa394` | Done | `shouldSuppressBiasFinding` predicate exported + applied; BiasSignal extended with subtitle; start-here copy now uses trigger explanation; +9 unit tests |
| D6 | Top evidence split (Path B) | `81cfa103` | Done | Evidence gaps + Suggested next actions blocks under separate subheaders; ordinals continue across split; +4 regression tests |
| D7 | Confirm action on AI-estimated | `6d1daba5` | Done | `augmentAiEstimatedItemWithConfirm` helper exported; symmetric augmentation with missing-data branch; +6 unit tests |
| D8 | Final review + walkthrough docs | `ce075760` | Done | Per-deliverable summary, all grep gates, performance + a11y audit, walkthrough template |
| D5-FU | Target factor naming + suppression | `94bcaccb` | Done | NormalisedBiasTrigger threads target id + resolved label; resolver suppresses unresolvable targets; title "<bias> on <factor>" + targeting subtitle; +8 unit tests |
| D6-FU | Conditional evidence-gap header | `f490ab8d` | Done | TrustSummary gated on `evidenceGapCards.length`; next-actions-only states no longer mis-labelled as evidence gaps; +2 regression tests |
| D7-FU | Component-level D5 + D7 render tests | `be7b8c38` | Done | New `PreAnalysisPanel.brief57.spec.tsx`: 3 tests covering rendered target naming, unresolvable suppression, and Confirm-click → updateNode with `source: 'user_confirmed'` |

---

## Brief 5.7 D8 grep gates (final state)

| Gate | Path | Baseline (D1) | Final | Result |
|------|------|--------------:|------:|--------|
| `Model checks` | `src/components/results/` | 1 | **0** | PASS |
| `Watch for this bias` | `src/` | 1 | **0** | PASS |
| `filledSteps\|filled-dot\|unfilled-dot` | `src/components/results/DriversSection.tsx` | 2 | **0** | PASS |

`DecisionReadinessBadge.tsx:184` "Model checks:" hit — different file path (`src/canvas/components/`), different surface (canvas readiness badge popover), out of scope per D1 baseline. Preserved deliberately.

---

## Brief 5.5 §2.8 gates (re-run — all zero/documented)

`GATE_GLOBS='-g !**/__tests__/** -g !**/*.spec.* -g !**/*.test.*'`

| # | Gate | Final | Result |
|---|------|------:|--------|
| 1 | typography utilities (text-xs/sm/base/lg/[Npx], font-medium/semibold/bold) | 0 | PASS |
| 2 | "currently leads" | 0 | PASS |
| 3 | option `# N of M` pattern in OptionCards.tsx | (CI) | unchanged |
| 4 | "Olumi applied" | 0 | PASS |
| 5 | "assumptions to review and" | 0 | PASS |
| 6 | `as any` / `as unknown` summed count | 0 | PASS |
| 7 | `bg-{colour}-light` | 0 | PASS |
| 8 | `text-white` | 0 | PASS |
| 9 | arbitrary px spacing | 0 | PASS |
| 10 | `bg-factor` | 0 | PASS |

---

## Brief 5.6 §2.6 gates (re-run)

| # | Gate | Final | Result |
|---|------|------:|--------|
| 1 | ResultsBody RiskAppetiteFilter render | re-export only | PASS |
| 2 | AdvancedSection RiskAppetiteFilter | render call present | PASS |
| 3 | "Some confidence scores reflect default estimates" in DriversSection | 1 (Tooltip content string only — spec-allowed) | PASS |
| 4 | "to review and...quality suggestion" in usePreAnalysisData | 0 | PASS |
| 5 | live YourExpertise component (import / JSX) | 0 (only legacy comment refs + tests) | PASS |
| 6 | ModelHealthCard "Structure"/"Coverage" | 0 | PASS |
| 7 | pre-analysis "Structure:"/"Coverage:" copy | 0 | PASS |

---

## Verification

| Check | Baseline (D1) | Final (after D7) | Notes |
|---|--------------:|-----------------:|---|
| `npm run typecheck` | clean | **clean** | |
| Lint on touched files | (clean) | **clean** | only deprecated `.eslintignore` warning, unrelated |
| Scoped vitest pass count | 1518 | **1557** | +39 new regression tests (D3 +3, D4 +2, D5 +9 → +11, D6 +4 → +6, D7 +6, D5-FU +8, D7-FU render +3) |
| Scoped vitest skipped | 13 | 13 | unchanged |
| Scoped vitest failed | 0 | **0** | no regressions |

Console-clean: yes (the `[focusHelpers] focusNodeById called before ReactFlow mounted` lines are pre-existing harmless integration-test noise, not introduced by 5.7).

---

## Performance audit

| File | New `useEffect` | New `useMemo` | Verdict |
|---|:--:|:--:|---|
| DecisionConfidencePanel.tsx | 0 | 0 | D6 split derives from existing `top3` slice — no new memo |
| DriversSection.tsx | 0 | 0 | D3 fallback is a single `??` chain on existing in-scope vars; D4 swaps inner JSX without new hooks |
| PreAnalysisPanel.tsx | 0 | 0 | D5 + D7 both pure-function helpers called inside existing useMemos |

---

## A11y audit

- Confidence bar: `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax` + `aria-label` retained on the inner track div; click-target wrapper button retains its own `aria-label`.
- Validate chip in dominant-factor warning: `aria-label="Validate ${factorLabel} on canvas"` retained.
- New "Suggested next actions" SectionHeader: rendered as `<h3>` per the SectionHeader component contract.
- `data-testid` added for Path B regression coverage: `evidence-gap-cards`, `next-action-cards`, `next-actions-section-header`.

---

## Shared component touch audit

- `TriageCard` — **not modified**. Confirm chip rendering at lines 492–510 uses existing `action.kind === 'confirm'` branch.
- `SectionHeader` — **not modified**. D6 reuses with existing props (title, className, testId).
- `DataBar` — **not modified**. Sensitivity bar at DriversSection.tsx:451–461 unchanged.
- `BiasSignal` (interface in pickStartHere.ts) — **extended additively** with optional `subtitle?: string` (D5) and optional `targetFactorLabel?: string` (D5 follow-up). No existing consumer breaks.
- `NormalisedBiasTrigger` (in PreAnalysisPanel.tsx) — **extended additively** with `targetFactorId: string | null` and `targetFactorLabel: string | null` (D5 follow-up). All construction sites populate the new fields explicitly.

---

## Launch triage

**Ship readiness:** ready for staging deployment as a self-contained hotfix.

**Risk profile:** low.
- All 6 root causes verified before fix; no blind changes.
- 37 new regression tests guard each fix surface.
- No data-layer changes (CEE / PLoT / ISL untouched).
- No schema changes (Supabase, factor enum, edge enum all unchanged).
- Brief 5.5 schema freeze respected — only documented amendment is §2.2 Pattern C (4-dot → thin bar) per Brief 5.7 D4.

**Walkthrough:** see `docs/brief-5_7-staging-walkthrough-template.md` (filled with concrete local-preview artefacts per AGENTS.md §1).

**Rollback plan:** revert `b4e6ac97..HEAD` (the full Brief 5.7 sequence on this branch) — one revert per commit, each independently revertable. The originals (D1..D7), the D8 docs, the follow-ups from review feedback (D5-FU `94bcaccb`, D6-FU `f490ab8d`, D7-FU `be7b8c38`), and any subsequent docs close-out commits all stand alone. Git tree has no merges in the 5.7 sequence. Run `git log --oneline ui/analysis-tab-hotfix-5_7` for the live commit order.
