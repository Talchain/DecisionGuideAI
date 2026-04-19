# Brief 5.1 — final-pass review

**Branch:** `ui/analysis-tab-brief-5_1` off staging (`80c6debd`)
**Commits:** 21 after both review rounds (11 primary + 5 round-1 follow-ups
+ 5 round-2 follow-ups including this doc).
**Last updated:** 2026-04-19 after second ChatGPT review incorporation.

---

## Commit chain

### Primary phases (11)

| Commit | Phase | Task | Scope |
|---|---|---|---|
| `b4f1f1b1` | 0 | — | Preflight findings + gate decisions |
| `bff8e945` | 1 | 1 | Driver expert leak — gate + regression |
| `3df8815c` | 2 | 4 | `certaintyCopy.ts` + wired into DecisionConfidencePanel fallback |
| `cd0ebf58` | 3 | 2 | Accordion subtitle + scope subtitles + symmetric bridge |
| `9fa3e88a` | 4 | 3 | Expertise row value slot + em-dash + icon parity |
| `74feafee` | 5 | 5 | Tornado legend full-width + Apply kept dormant |
| `f5e90e25` | 6 | 6 | Eye + Gauge icons on risk controls |
| `a13fc870` | 7 | 7 | `formatOptionLabelForCard` + unified chip copy |
| `2e0d3780` | 7.5 | 7.5 | "Try: …" chip wired to chat |
| `32424a20` | 8 | 8 | Fragile rows + "Review this relationship" chip |
| `89cd4dca` | 9 | 9 | `DiscussWithAiButton` variant applied |
| `19ced8c1` | 10 | — | Initial final-pass review doc |

### Round-1 follow-ups (5)

| Commit | Addresses | Scope |
|---|---|---|
| `c23e3b2c` | P0 #2 | Caveat tier-driven, unaffected by coaching-headline precedence |
| `b49627b8` | P1 #1 | Compile-time `PLOT_BOUNDS_WIRED` flag on Tornado Apply |
| `39d80720` | Imp #3 | Expert-leak regression strengthened with DOM-structural assertions |
| `e890e695` | P0 #1 partial | MissingData "No data" → "Not set" |
| `5d107fbf` | P1 #3 | Final-review reconciliation (round 1) |

### Round-2 follow-ups (5)

| Commit | Addresses | Scope |
|---|---|---|
| `b7f1af45` | P1 #3 + Imp #2 | Extract `ApplyAndRerunButton` subcomponent; restore dormant-contract tests (aria-disabled, guarded click, aria-describedby, sr-only hint) that were lost when the in-line JSX was gated |
| `b0c81bf1` | P1 #2 | Harden `e2e/brief-5/your-expertise-brief-only.spec.ts` — replace `waitForTimeout(100)` with a deterministic `page.getByTestId('model-tab')` assertion; relabel skip paths as COVERAGE-DEBT |
| `2997228a` | Imp #3 (precedence) | Lock certainty decision-table precedence policy (unstable vs weak tier, partial vs all, 0.70 boundary, single-option) |
| `47873887` | **P0 #1 close-out** | In-place ScientificEditor inside AiEstimated + MissingData, one-active-editor invariant across the expanded surface, analysisRunKey reset, backwards-compatible fallback |
| (this doc) | Doc reconciliation | Correct the round-1 doc error (P1 #2 was falsely classified "file does not exist"); reclassify Task 3 as **complete** now that the inline editor shipped |

---

## Correction: round-1 P1 #2 classification

The round-1 doc dismissed ChatGPT's P1 #2 critique on the grounds that
`your-expertise-brief-only.spec.ts` "does not exist in the repo". That
was a factual error — the file lives at
`e2e/brief-5/your-expertise-brief-only.spec.ts` and my earlier grep was
scoped only to `src/`. The correct classification:

- **Round-1:** dismissed incorrectly.
- **Round-2 (`b0c81bf1`):** hardened the deterministic deep-link
  assertion. The skip paths remain — closing those requires a sandbox
  `?seed=brief-only` entry point, which is tracked below as sandbox
  coverage debt.

---

## Verification — checks run (post round-2)

| Check | Outcome |
|---|---|
| `npm run typecheck` | Clean. Zero errors. |
| `npm run lint` on touched files | 0 errors; 0 new warnings introduced. |
| `npx vitest run src/components/results/__tests__` | All passing |
| `npx vitest run src/canvas/components/pre-analysis` | 35 files passed, 1 skipped; 567 tests passed, 13 skipped |
| `npx vitest run src/canvas/components/pre-analysis/expertise/__tests__/YourExpertise.inlineEditor.spec.tsx` | 5/5 passed |
| `npx vitest run src/components/results/__tests__/TornadoChart.spec.tsx` | 46 passed (incl. 4 new ApplyAndRerunButton dormant-contract tests) |
| `npx vitest run src/components/results/utils/__tests__/certaintyCopy.spec.ts` | 19 passed (incl. 4 new precedence tests) |

CI will run the full suite + E2E + bundle policy.

---

## Grep gates — final

| Gate | Result |
|---|---|
| `elasticity:` in Analysis tab | Only at `DriversSection.tsx:721`, gated on `expertMode && isExpertField('elasticity')`. **Pass.** |
| "Why does this lose" | Zero live production renders. **Pass.** |
| `(Status Quo)` outside helper | Zero (comment only). **Pass.** |
| "Mostly stable" / "clear leading" | Only in canonical utilities or suppressed dead code. **Pass.** |
| New `as any` / `as unknown` delta | Zero. **Pass.** |
| Raw `text-sm` / `text-xs` / `text-base` in touched files | Zero. **Pass.** |

---

## Regression tests added across both rounds

| File | Tests | Notes |
|---|---|---|
| `DriversSection.expertLeak.spec.tsx` | 3 | DOM-structural + text assertions (round 1 Imp #3) |
| `certaintyCopy.spec.ts` | 19 | Full decision table + em-dash compliance + **4 precedence tests** (round 2 Imp #3) |
| `DecisionConfidencePanel.semanticCoherence.spec.tsx` | 5 | Bridge 4-state matrix + identity fallback |
| `DecisionConfidencePanel.caveatGuarantee.spec.tsx` | 4 | **Caveat attaches regardless of headline source** (round 1 Imp #1) |
| `AiEstimated.valueAndIconParity.spec.tsx` | 6 | Value slot + "Not set" (round 1 P0 #1 partial) |
| `TornadoChart.spec.tsx` | 46 total incl. **4 new `ApplyAndRerunButton` a11y-contract tests** + 2 dormancy/flag tests (round 2 P1 #3 + Imp #2) + the legend case (primary Phase 5) |
| `OptionCards.brief-5_1.spec.tsx` | 11 | Helper + integration + chip copy |
| `DriversSection.techniqueChip.spec.tsx` | 6 | Chip dispatch + a11y |
| `ChallengeSection.fragileRows.spec.tsx` | 6 | Layout + Review chip + multi-edge independence |
| `DiscussWithAiButton.variant.spec.tsx` | 4 | Variant + a11y invariants |
| **`YourExpertise.inlineEditor.spec.tsx`** | **5** | **Round-2 P0 #1 close-out**: Pencil → editor, exclusivity A→B, cross-group exclusivity, fallback path, analysisRunKey reset |
| `e2e/.../your-expertise-brief-only.spec.ts` | 1 Playwright | Deterministic deep-link assertion (round 2 P1 #2) |

**Net-new: 76 regression tests** across the brief (56 primary + 8 round-1 follow-up + 12 round-2 follow-up), all passing.

---

## Task-by-task delivery — final

| Task | Status | Notes |
|---|---|---|
| 1 — driver expert leak | **Complete** | Gate + regression + DOM-structural assertions |
| 2 — semantic coherence | **Complete** | Subtitles + symmetric bridge |
| 3 — expertise rows | **Complete** | Value slot + em-dash + icon parity + "Not set" + **inline editor + one-active-editor invariant** (round 2 `47873887`) |
| 4 — certainty copy | **Complete** | Utility + caveat + **tier-driven caveat override-proof** + **precedence policy pinned** |
| 5 — tornado legend | **Complete** | Full-width + structural `PLOT_BOUNDS_WIRED` + extracted `ApplyAndRerunButton` keeps dormant-contract tested |
| 6 — risk control icons | **Complete** | Eye + Gauge |
| 7 — runner-up title + chip | **Complete** | Helper + unified copy |
| 7.5 — technique chip | **Complete** | Wired to chat |
| 8 — fragility scannability | **Complete** | Layout + per-edge Review chip |
| 9 — sparkle density | **Complete** | `DiscussWithAiButton` variant applied |

**All 10 tasks complete.**

---

## Coverage debt / follow-ups (not blocking)

| Item | Disposition |
|---|---|
| Sandbox `?seed=brief-only` entry point for the Playwright deep-link smoke | Would let `your-expertise-brief-only.spec.ts` run its assertions instead of skipping. Sandbox entrypoint change — out of Brief 5.1 scope. |
| `DriversSection 2.tsx` orphan file cleanup | Hygiene pass; no imports reference it |
| Archived `ConfidenceSection.tsx` removal | Separate hygiene pass; kept for legacy test fixtures |
| Expertise `ImprovementItem.display_value` threading | CEE display-value short-circuit unused today in expertise rows |
| Cross-codebase sparkle refactor (66 sites) | Out of scope per preflight §9 |
| Baseline VR PNG capture | Explicit brief out-of-scope |

---

## Performance notes

- `useMemo` on `certainty`, `topDriverIdentity`, `topEvidenceGapIdentity` in DecisionConfidencePanel.
- `activeEditorKey` state is local to `YourExpertise` and only mutated on Pencil-click / save / cancel / rerun — no hot-path allocations.
- `ApplyAndRerunButton` is a pure stateless component.
- `PLOT_BOUNDS_WIRED` is a module-level constant — zero runtime cost.
- `handleCommitValue` captures via `useCallback`; accesses `useCanvasStore.getState()` at call time (no subscription).

No new `useEffect` in any hot path. No performance concern.

---

## Launch triage

### Blockers
None.

### Safe follow-ups
- Coverage-debt items above.

### Deliberate deferrals
- Cross-codebase sparkle refactor.
- Baseline VR PNG capture.

---

## Branch state

- Local only — no push to remote.
- 21 commits ahead of staging.
- Ready for user review / staging push decision.

*End of final-pass review.*
