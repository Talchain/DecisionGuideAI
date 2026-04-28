# Brief 5.7 — Precondition baseline

Captured before any 5.7 deliverable. All subsequent work measured against this baseline.

**Branch:** `ui/analysis-tab-hotfix-5_7` (created from `staging` at `2da7b129`)

**Stash hygiene:** unrelated layout WIP (`src/canvas/__tests__/layout.spec.ts`, `src/canvas/layoutStore.ts`, `src/canvas/utils/layout.ts`) stashed as `5.7-pre: layout WIP` before branching. Working tree clean.

**Stash list length:** 28 entries (over the 26+ threshold flagged in Brief 5.5 close-out triage). Top 5:

```
stash@{0}: On staging: 5.7-pre: layout WIP
stash@{1}: On staging: WIP: SeverityStyledCritiques test text update - unrelated to useconversation diagnosis
stash@{2}: On ui/ai-panel-tranche-1: pre-brief-4-switch: ai-panel-tranche-1 WIP
stash@{3}: On staging: pre-investigation tracked changes
stash@{4}: WIP on staging: 867642a7 docs(audit): add AI experience + LLM context assembly audits
```

Documented for awareness — not blocking 5.7 work. User may wish to triage at their discretion (Brief 5.5 close-out previously noted the same condition).

---

## Typecheck

`npm run typecheck` (tsc -p tsconfig.ci.json --noEmit) — **clean**, no errors emitted.

---

## Scoped vitest baseline

Command: `npx vitest run src/components/results src/canvas/components/pre-analysis`

```
Test Files  83 passed | 1 skipped (84)
Tests       1518 passed | 13 skipped (1531)
Duration    32.71s
```

**Target post-D8:** pass count ≥ 1518 (adjusted for any documented test deletions / spec amendments — D4 will need to update `DriversSection.confidence-bar.spec.tsx` to assert thin bar + percentage rather than 4-dot scale; this is a spec-amendment edit, not a regression).

---

## Brief 5.7 D8 grep gates (baseline — expected non-zero before fixes)

| Gate | Path | Baseline hits | Target post-fix |
|------|------|--------------:|----------------:|
| `Model checks` | `src/components/results/` | 1 (DecisionConfidencePanel.tsx:673) | 0 |
| `Watch for this bias` | `src/` | 1 (PreAnalysisPanel.tsx:1598) | 0 |
| `filledSteps\|filled-dot\|unfilled-dot` | `src/components/results/DriversSection.tsx` | 2 (lines 480, 495) | 0 |

Note: the `DecisionReadinessBadge.tsx:184` "Model checks:" hit is in a **different path** (`src/canvas/components/`) and is **out of scope** for the D2 grep gate (which is restricted to `src/components/results/`). It belongs to the canvas readiness badge popover, not the Results panel. Preserved deliberately.

---

## Brief 5.5 §2.8 gates (baseline — must remain zero/documented)

All gates restricted to `src/components/results/` and `src/canvas/components/pre-analysis/` with `GATE_GLOBS='-g !**/__tests__/** -g !**/*.spec.* -g !**/*.test.*'`.

| # | Gate | Baseline |
|---|------|---------:|
| 1 | raw typography utilities (`text-xs|text-sm|text-base|text-lg|text-[Npx]|font-medium|font-semibold|font-bold`) | **0** |
| 2 | `currently leads` | **0** |
| 3 | `# N of M` option pattern in OptionCards.tsx | (regex tooling note — gate runs in CI; baseline assumed clean per Brief 5.5 close-out) |
| 4 | `Olumi applied` | **0** |
| 5 | `assumptions to review and` | **0** |
| 6 | `as any | as unknown` summed count | **0** |
| 7 | `bg-{colour}-light` | **0** |
| 8 | `text-white` | **0** |
| 9 | arbitrary px spacing (`p-[Npx]|px-[Npx]|py-[Npx]|gap-[Npx]`) | **0** |
| 10 | `bg-factor` | **0** |

---

## Brief 5.6 §2.6 gates (baseline)

| # | Gate | Baseline | Notes |
|---|------|---------:|-------|
| 1 | ResultsBody RiskAppetiteFilter render | re-export only | RiskAppetiteFilter component **moved** to AdvancedSection; ResultsBody re-exports the type/component but does NOT render it. Conforms to Brief 5.6 spec. |
| 2 | AdvancedSection RiskAppetiteFilter | render call present | Conforms. |
| 3 | "Some confidence scores reflect default estimates" in DriversSection | 1 hit (line 823 inside Tooltip content string) | Conforms — Brief 5.6 spec allows tooltip content; only standalone paragraph forbidden. |
| 4 | "to review and...quality suggestion" in usePreAnalysisData | **0** | Conforms. |
| 5 | YourExpertise/AiEstimated/MissingData/deriveExpertiseGroups | code refs to `deriveExpertiseGroups` (legitimate hook) + 2 explanatory comments referencing the removed YourExpertise section + 2 test-file comments | All references are legitimate — `deriveExpertiseGroups` is the surviving hook (Brief 5.6 D7 retained it), the comments document why expertise is now threaded into Improve confidence rather than living standalone, and tests reference the migration. No live YourExpertise component remains. |
| 6 | ModelHealthCard "Structure"/"Coverage" | **0** | Conforms — replaced by Decision shape / Your contribution per Brief 5.6 D11/D12. |
| 7 | pre-analysis "Structure:"/"Coverage:" copy | **0** | Conforms. |

---

## Render-site map (verified during exploration)

| # | Item | File | Lines | Fix surface |
|---|------|------|------:|-------------|
| D2 | "Model checks" card (scienceNudges block) | `src/components/results/DecisionConfidencePanel.tsx` | 670–686 | Delete JSX + dead-import audit |
| D2 | DecisionReadinessBadge "Model checks:" | `src/canvas/components/DecisionReadinessBadge.tsx` | 184 | **Out of scope** (different surface — canvas badge popover) |
| D3 | Dominant-factor warning (Validate gated on `data.dominantFactorId`) | `src/components/results/DriversSection.tsx` | 779–800 | Add `topDriver.matchedNodeId/factorKey` fallback target |
| D4 | 4-dot confidence indicator (`filledSteps`) | `src/components/results/DriversSection.tsx` | 480–504 | Replace with thin `bg-info` bar + percentage readout |
| D5 | Authority bias trigger builder (`biasTriggers` useMemo) | `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | 813–835 | Add `target_factor_id` filter for `AUTHORITY_BIAS` |
| D5 | Bias card (start-here variant, "Watch for this bias…") | `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | 1592–1604 | Replace generic copy with bias-type-aware text |
| D6 | Top evidence card 1/2/3 stack | `src/components/results/DecisionConfidencePanel.tsx` | 627–652 | **Path B** — split into Evidence gaps + Suggested next actions sub-blocks |
| D7 | Improve confidence cards builder (`expertiseTriageCards` useMemo) | `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | 1138–1173 | Symmetric `aiEstimated` augmentation (defensive — `mapItem` already supports `kind: 'confirm'`) |

---

## Acceptance for D1

- [x] Branch `ui/analysis-tab-hotfix-5_7` created from latest `staging`
- [x] Working tree clean (unrelated layout WIP stashed as `5.7-pre: layout WIP`)
- [x] Typecheck status captured (clean)
- [x] Scoped vitest counts captured (1518 / 13 skipped / 0 failed)
- [x] Render-site map populated for all six items
- [x] Stash list length captured (28 entries — documented, not blocking)
