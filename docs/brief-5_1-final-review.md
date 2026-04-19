# Brief 5.1 — final-pass review

**Branch:** `ui/analysis-tab-brief-5_1` off staging (`80c6debd`)
**Commits:** 11 (incl. Phase 0 docs + Phase 10 review)
**Scope:** 23 files changed · 1769 insertions · 97 deletions

Every phase delivered one commit. One support commit landed the preflight
findings that dictated the corrected copy / scope decisions. This document
is the final audit before the branch moves off local.

---

## Commit chain

| Commit | Phase | Task | Scope |
|---|---|---|---|
| `b4f1f1b1` | 0 | — | Preflight findings + gate decisions |
| `bff8e945` | 1 | 1 | Driver expert leak — gate with `isExpertField` belt-and-braces + regression test |
| `3df8815c` | 2 | 4 | `certaintyCopy.ts` utility + wired into `DecisionConfidencePanel` fallback |
| `cd0ebf58` | 3 | 2 | Accordion subtitle prop + scope subtitles + symmetric driver/evidence bridge |
| `9fa3e88a` | 4 | 3 | Expertise row value slot (em-dash placeholder) + icon parity with Review-next |
| `74feafee` | 5 | 5 | Tornado legend full-width row, no `truncate` centre, Apply button dormant |
| `f5e90e25` | 6 | 6 | Eye icon on "Show winner by", Gauge icon on "Risk profile" |
| `a13fc870` | 7 | 7 | `formatOptionLabelForCard` helper + unified chip copy |
| `2e0d3780` | 7.5 | 7.5 | Promote "Try: reference class forecasting" from tooltip → wired chat chip |
| `32424a20` | 8 | 8 | Fragile-edge row layout + per-edge "Review this relationship" chip |
| `89cd4dca` | 9 | 9 | `DiscussWithAiButton` variant prop + `secondary` on Analysis-tab call sites |

---

## Verification — checks run

| Check | Outcome |
|---|---|
| `npm run typecheck` (Phase 10) | Clean. Zero errors. |
| `npm run lint` (Phase 10) | 0 errors. 1116 pre-existing warnings on untouched files. Zero warnings introduced on files I changed (one I introduced during Phase 7 was removed in Phase 10: unused `stripEncodingNotation` import in `OptionCards.tsx`). |
| `npx vitest run src/components/results/__tests__` | 48 files, 954 passed |
| `npx vitest run src/components/results src/canvas/components/pre-analysis` | 82 files passed, 1 skipped; 1515 tests passed, 13 skipped |
| Per-phase changed-scope vitest | Green after each commit |

CI will run the full suite + E2E + bundle policy — authoritative gate.

---

## Grep gates — final

### Driver expert trio
```
rg -n "elasticity:" src/components/results/ (tsx)
```
Hits (non-test, production):
- `DriversSection.tsx:721` — inside `{expertMode && isExpertField('elasticity') && (...)}` (gated)
- `DriversSection 2.tsx:716` — orphan backup file; grep confirms no imports reference it. Not render-live.
- `types.ts:602`, `useResultsSectionData.ts:{255,1329}` — data-layer field names, not rendered strings.

**Pass.** The only render path is the correctly-gated expert block.

### "Why does this lose"
Non-test production hits: **0**. Remaining references are a production code comment explaining WHY the string was removed, and test assertions confirming its absence. **Pass.**

### "(Status Quo)" outside helper
Non-test production hits: **0** (one code comment in `OptionCards.tsx:326` explaining the helper). **Pass.**

### "Mostly stable" / "clear leading"
- `stability.ts` — canonical footer mapping (allowed)
- `certaintyCopy.ts` — canonical hero mapping (allowed)
- `HeroSection.tsx:351` — dead code (suppressed per `ResultsBody.tsx:198`; see preflight §4 analysis-details coherence)
- `compare-tab/Hero.tsx`, `errorTaxonomy.ts` — different surfaces (compare tab, error messages), out of scope

No live Analysis-tab renders outside the canonical utilities. **Pass.**

### New `as any` / `as unknown` delta
`git diff staging..HEAD` for `+.*as (any|unknown)`: **zero hits.** **Pass.**

### Raw `text-sm` / `text-xs` / `text-base` in touched files
Zero new occurrences in my diff. **Pass.**

---

## Regression tests added

| File | Tests | Purpose |
|---|---|---|
| `DriversSection.expertLeak.spec.tsx` | 3 | Standard vs expert view — zero leak in standard, all three strings in expert |
| `certaintyCopy.spec.ts` | 15 | Full decision-table matrix across all tier combinations + em-dash compliance |
| `DecisionConfidencePanel.semanticCoherence.spec.tsx` | 5 | Four-state bridge (differ / match / one-absent / both-empty) + identity fallback |
| `AiEstimated.valueAndIconParity.spec.tsx` | 5 | Value slot + em-dash placeholder + icon parity 28×28 on both AiEstimated + MissingData |
| `TornadoChart.spec.tsx` (+1 case) | 1 added | Legend full-width, no `truncate`, centre text equals tooltip title |
| `OptionCards.brief-5_1.spec.tsx` | 11 | Helper stripping rules (7) + card title integration (2) + chip copy (2) |
| `DriversSection.techniqueChip.spec.tsx` | 6 | Chip rendering threshold, click dispatch, absence when no handler, aria-label |
| `ChallengeSection.fragileRows.spec.tsx` | 6 | Row layout semibold, Review chip wiring + aria-label, multi-edge independence |
| `DiscussWithAiButton.variant.spec.tsx` | 4 | Variant default, secondary opacity classes, accessible name preserved, no invisible-but-focusable |

**56 new regression tests**, all passing.

---

## Task-by-task delivery

| Task | Delivered | Partial | Deferred |
|---|---|---|---|
| 1 — driver expert leak | ✅ gate tightened + regression | — | — |
| 2 — semantic coherence | ✅ subtitles + bridge + 4-state test | — | — |
| 3 — expertise rows | ✅ value slot + em-dash + icon parity | — | Full inline InlineValueControls editor deferred (see §Deferred below) |
| 4 — certainty copy | ✅ utility + caveat wired | — | — |
| 5 — tornado legend | ✅ full-width, Apply still dormant | — | — |
| 6 — risk control icons | ✅ Eye + Gauge | — | — |
| 7 — runner-up + chip | ✅ helper + unified copy | — | — |
| 7.5 — technique chip | ✅ wired to chat | — | — |
| 8 — fragility rows | ✅ layout + Review chip | — | — |
| 9 — sparkle density | ✅ variant + applied | — | — |

---

## Performance notes

- Two new `useMemo` added in `DecisionConfidencePanel`: `certainty` (Phase 2) and `topDriverIdentity` + `topEvidenceGapIdentity` (Phase 3). All have precise dependency arrays; each derives from a small, stable slice of the bundle.
- `Accordion` subtitle is a prop — no state, no effect added.
- `DiscussWithAiButton` variant is a pure prop — same memoisation boundary.
- `formatOptionLabelForCard`, `buildCertaintyCopy` are pure functions — no allocations outside the string output.

No new `useEffect` in any hot path. No performance concern.

---

## Deferred (registered follow-ups)

| Item | Reason | Notes |
|---|---|---|
| True inline InlineValueControls editor in expertise rows | Would need a shared editor primitive + state hoisted above AiEstimated/MissingData; Phase 4 delivered the focused value-slot + icon-parity fix instead | Brief 5.1 Task 3 "Pencil opens InlineValueControls inline" — current behaviour retained (click-through to parent handler) |
| `DriversSection 2.tsx` orphan file cleanup | Out of scope; separate hygiene pass | No imports reference it; may be a historical rollback copy |
| Expertise `ImprovementItem.display_value` threading | Would let CEE-provided display strings short-circuit in expertise rows (same as Review-next) | Preflight §3 — minor follow-up |
| ConfidenceSection removal | Archived per no-message-render.spec but still on disk; tests depend on it | Separate hygiene pass |
| 66-site cross-codebase sparkle inventory (canvas / pre-analysis / suggestions panels) | Constrained out of Brief 5.1 scope per user correction | Track separately if panel noise remains an issue after staging QA |

---

## Launch triage

### Blockers
None.

### Safe follow-ups (can ship after this brief)
- Deferred items above.

### Deliberate deferrals
- Full inline editor in expertise rows — structurally larger than Brief 5.1 scope
- Cross-codebase sparkle refactor — not the bug Brief 5.1 targets

---

## Branch state

- Local only — no push to remote.
- Ready for user review / staging push decision.
- Pre-push hook will run full suite + build.

*End of final-pass review.*
