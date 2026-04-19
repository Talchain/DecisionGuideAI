# Brief 5.1 — final-pass review

**Branch:** `ui/analysis-tab-brief-5_1` off staging (`80c6debd`)
**Commits:** 16 (11 primary phases + 5 post-review follow-ups) — this doc is
itself one of them, so any commit-count update lands with its own edit.
**Last updated:** 2026-04-19 after ChatGPT review incorporation.

---

## Commit chain

### Primary phases

| Commit | Phase | Task | Scope |
|---|---|---|---|
| `b4f1f1b1` | 0 | — | Preflight findings + gate decisions |
| `bff8e945` | 1 | 1 | Driver expert leak — gate with `isExpertField` + regression test |
| `3df8815c` | 2 | 4 | `certaintyCopy.ts` + wired into `DecisionConfidencePanel` fallback |
| `cd0ebf58` | 3 | 2 | Accordion subtitle prop + scope subtitles + symmetric bridge |
| `9fa3e88a` | 4 | 3 | Expertise row value slot + em-dash + icon parity |
| `74feafee` | 5 | 5 | Tornado legend full-width + Apply kept dormant |
| `f5e90e25` | 6 | 6 | Eye + Gauge icons on risk controls |
| `a13fc870` | 7 | 7 | `formatOptionLabelForCard` + unified chip copy |
| `2e0d3780` | 7.5 | 7.5 | Promote "Try: …" from tooltip → wired chat chip |
| `32424a20` | 8 | 8 | Fragile rows + "Review this relationship" chip |
| `89cd4dca` | 9 | 9 | `DiscussWithAiButton` variant + applied to Analysis tab |
| `19ced8c1` | 10 | — | Initial final-pass review doc |

### Post-review follow-ups (ChatGPT critique incorporation)

| Commit | Addresses | Scope |
|---|---|---|
| `c23e3b2c` | P0 #2 | Caveat attaches regardless of coaching-headline precedence — closes bypass |
| `b49627b8` | P1 #1 | Structural Tornado Apply dormancy via `PLOT_BOUNDS_WIRED` flag |
| `39d80720` | Imp #3 | Expert-leak regression strengthened with DOM-structure assertions |
| `e890e695` | P0 #1 partial | MissingData copy: "No data" → "Not set"; editor work explicitly deferred |
| (this doc) | P1 #3 | Reconciled Task 3 status + commit counts + deferred-scope sketch |

---

## Verification — checks run

| Check | Outcome |
|---|---|
| `npm run typecheck` (all phases, incl. follow-ups) | Clean. Zero errors. |
| `npm run lint` on touched files | 0 errors; 0 new warnings introduced. Pre-existing warnings in untouched code left as-is. |
| `npx vitest run src/components/results/__tests__` | 50 files, 963 passed (after follow-ups) |
| `npx vitest run src/canvas/components/pre-analysis/expertise/__tests__` | 3 files, 18 passed |
| `npx vitest run src/canvas/components/pre-analysis/__tests__/DiscussWithAiButton.variant.spec.tsx` | 4 passed |
| Per-phase changed-scope vitest | Green after each commit |

CI will run the full suite + E2E + bundle policy — authoritative gate.

---

## Grep gates — final

### Driver expert trio
- Only render path is `DriversSection.tsx:721`, gated on `expertMode && isExpertField('elasticity')`.
- Other hits are data-layer field names / types / orphan backup file with no imports. **Pass.**

### "Why does this lose"
Zero live production renders (comment + tests only). **Pass.**

### "(Status Quo)" outside helper
Zero live production renders (comment only in `OptionCards.tsx:326`). **Pass.**

### "Mostly stable" / "clear leading"
Only in canonical utilities (`stability.ts`, `certaintyCopy.ts`) or suppressed dead code (`HeroSection.tsx:351`). No live Analysis-tab renders outside canon. **Pass.**

### `as any` / `as unknown` delta
`git diff staging..HEAD` for `+.*as (any|unknown)`: zero hits. **Pass.**

### Raw `text-sm` / `text-xs` / `text-base`
Zero new occurrences in touched files. **Pass.**

---

## Regression tests added

| File | Tests | Purpose |
|---|---|---|
| `DriversSection.expertLeak.spec.tsx` | 3 | Trio absence in standard view, presence in expert view — now **with structural DOM assertions** (follow-up Imp #3): the `ExpertBlock` wrapper is absent, trio block null; when expert, all three spans share the flex parent in canonical order inside the info-tint ExpertBlock |
| `certaintyCopy.spec.ts` | 15 | Full decision-table matrix + em-dash compliance |
| `DecisionConfidencePanel.semanticCoherence.spec.tsx` | 5 | Bridge four-state matrix + identity fallback |
| `DecisionConfidencePanel.caveatGuarantee.spec.tsx` | 4 | **Follow-up Imp #1**: caveat attaches even with `coachingHeadline` / `coachingDecisionStatement` present |
| `AiEstimated.valueAndIconParity.spec.tsx` | 6 | Value slot + em-dash + icon parity + **"Not set" on MissingData** (follow-up) |
| `TornadoChart.spec.tsx` | +3 cases | Full-width legend; **follow-up P1 #1** structural Apply dormancy + `PLOT_BOUNDS_WIRED === false` pin |
| `OptionCards.brief-5_1.spec.tsx` | 11 | Helper rules + card integration + chip copy |
| `DriversSection.techniqueChip.spec.tsx` | 6 | Chip threshold + dispatch + aria-label |
| `ChallengeSection.fragileRows.spec.tsx` | 6 | Row layout + Review chip + multi-edge independence |
| `DiscussWithAiButton.variant.spec.tsx` | 4 | Variant prop behaviour + a11y invariants |

**64 new regression tests total** (56 from primary phases + 8 from post-review follow-ups), all passing.

---

## Task-by-task delivery — revised

| Task | Status | Notes |
|---|---|---|
| 1 — driver expert leak | **Complete** | Gate + regression test + DOM-structural assertions (Imp #3) |
| 2 — semantic coherence | **Complete** | Subtitles + symmetric bridge + 4-state test |
| 3 — expertise rows | **Partial** | Value slot, em-dash placeholder, icon parity, "Not set" copy delivered. **Inline editor + one-active-editor invariant deferred** — see deferred section below |
| 4 — certainty copy | **Complete** | Utility + caveat, incl. post-review P0 #2 bypass fix (caveat attaches regardless of headline source) |
| 5 — tornado legend + Apply dormancy | **Complete** | Full-width legend + structural `PLOT_BOUNDS_WIRED` dormancy (follow-up P1 #1) |
| 6 — risk control icons | **Complete** | Eye + Gauge |
| 7 — runner-up title + chip | **Complete** | Helper + unified copy |
| 7.5 — technique chip | **Complete** | Wired to chat |
| 8 — fragility scannability | **Complete** | Layout + per-edge Review chip |
| 9 — sparkle density | **Complete** | `DiscussWithAiButton` variant applied |

**9 of 10 tasks complete; Task 3 partial** (copy + value-slot + icon parity shipped; editor work deferred with defined scope).

---

## Deferred work — Task 3 inline editor (scoped for a follow-up brief)

The brief specified:
> - Pencil opens InlineValueControls inline (same as Review next)
> - Missing data rows — current value slot shows "Not set" + Set value input inline by default
> - One active inline editor at a time across the expertise expanded surface.

What's done (this brief): value slot, em-dash placeholder, "Not set" copy, icon parity with Review-next.

What's deferred (next brief):

### Scope
1. Extend the parent `onSetValue: (nodeId: string) => void` signature to `onSetValue: (nodeId: string, rawValue: number) => void` so the expertise rows can persist a value directly without focusing the inspector. Adjust every caller of the existing signature.
2. Hoist `activeEditorKey: string | null` state into `YourExpertise`. Pass `isEditing` + `onRequestEdit(key)` down to `AiEstimated` and `MissingData`.
3. In each row, render `ScientificEditor` (kind='factor', already exists in `src/components/shared/ScientificEditor.tsx`) inline when `isEditing === true` and compact view otherwise.
4. Opening a second row's editor clears the first via the hoisted state — the one-active-editor invariant.
5. Tests — add the behavioural exclusivity test ChatGPT Imp #2 asks for (open A, open B, assert A collapsed to compact), and the inline-render-on-pencil-click test for each of AiEstimated and MissingData.

### Why deferred
- `onSetValue` signature alignment touches the entire handler chain from `PreAnalysisPanel` down and into the canvas-store persistence path. It's a coordinated structural change.
- Ships cleaner as one coherent brief than as a plumbing patch split across Brief 5.1.
- `ScientificEditor` exists and works in Review-next cards, so the inline-editor component is already built — the remaining work is signature + state hoisting + wiring.

### Why not blocked
- The honesty-critical surfaces (Task 1 leak, Task 4 certainty, Task 8 fragility) shipped completely. The deferred work is a UX completion, not a correctness gap.

---

## Other deferred / out-of-scope items

| Item | Status | Notes |
|---|---|---|
| Imp #2 — editor exclusivity behavioural test | Blocked on deferred Task 3 editor work | Lands in the same follow-up |
| Imp #4 — baseline VR screenshot bootstrap | Explicit brief out-of-scope | "Baseline VR PNG capture — Brief 5 close-out item, not Brief 5.1" |
| P1 #2 — `your-expertise-brief-only.spec.ts` | Not addressed — **file does not exist** in the repo. ChatGPT's critique references a path with no presence in `src/`. |
| `DriversSection 2.tsx` orphan cleanup | Separate hygiene pass | No imports reference it |
| Expertise `ImprovementItem.display_value` threading | Follow-up | Preflight §3 — CEE display-value short-circuit unused today |
| Archived `ConfidenceSection.tsx` removal | Separate hygiene pass | Not render-live; kept for legacy test fixtures |
| Cross-codebase sparkle refactor (66 sites) | Out of scope per preflight §9 | Scoped to Analysis tab in this brief |

---

## Performance notes

- `useMemo` on `certainty`, `topDriverIdentity`, `topEvidenceGapIdentity` in `DecisionConfidencePanel` — precise dependency arrays, small stable slice.
- `Accordion` subtitle is a prop — no state, no effect added.
- `DiscussWithAiButton` variant is a pure prop — same memoisation boundary.
- `formatOptionLabelForCard`, `buildCertaintyCopy` are pure functions.
- `PLOT_BOUNDS_WIRED` is a module-level constant — no runtime cost.

No new `useEffect` in any hot path. No performance concern.

---

## Launch triage

### Blockers
None.

### Safe follow-ups (can ship after this brief)
- Task 3 inline editor + exclusivity (scoped above)
- Deferred hygiene items above

### Deliberate deferrals
- Task 3 inline editor — coordinated signature change best handled as one brief
- Cross-codebase sparkle refactor — not the bug this brief targets

---

## Branch state

- Local only — no push to remote.
- 16 commits ahead of staging.
- Ready for user review / staging push decision.

*End of final-pass review.*
