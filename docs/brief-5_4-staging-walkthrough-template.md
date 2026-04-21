# Brief 5.4 — Staging Walkthrough Template

Branch: `ui/post-analysis-refinement`

## Phase 17 Grep Gate Summary

| Gate | Description | Result |
|------|-------------|--------|
| 1 | Raw typography classes in `src/components/results/*.tsx` | ✅ Zero violations. One accepted exception: `ResultsBody.tsx` `dev-build-marker` div uses `text-[10px]` (non-semantic, dev-only). Canonical command below. |
| 2 | `HeroSection`/`RecommendationSection` in source (not tests) | ✅ Remaining refs are comments/type names only — no imports of deleted files |
| 3 | Em dashes in `src/components/results/*.tsx` | ✅ Zero results |
| 4 | "Create decision brief" / `window.alert.*decision` in source | ✅ Only Phase 11 removal-comment matches + unrelated share feature (`CanvasMVP.tsx`) |
| 5 | "Apply & rerun" in `TornadoChart.tsx` render path | ✅ Matches are doccomments + retained `ApplyAndRerunButton` subcomponent (test-only) — render site removed |
| 6 | Filled `rounded-full` pills (not `bg-transparent`/`bg-panel`) | ✅ Only `ParetoChart.tsx` legend dot (`bg-gray-400 w-2 h-2`) — chart indicator, not a semantic pill |

### Gate 1 canonical command

The original Phase 17 command omitted `text-[10px]` and used `grep -v 'typography\.'`, which silently suppresses lines that contain *both* a token reference and a raw class in the same attribute string. Use this corrected form for future briefs:

```bash
# Gate 1 — raw typography classes in results panel (run from repo root)
grep -rn "text-xs\|text-sm\|text-\[10px\]\|text-\[11px\]\|font-semibold\|font-medium\|font-bold" \
  src/components/results/ --include="*.tsx" \
  | grep -v "^\s*//"                 # exclude single-line comments
# Accepted exceptions (document any new ones here):
#   ResultsBody.tsx:439 — dev-build-marker div: text-[10px] is non-semantic dev label, not DS typography
# Any surviving match requires manual inspection:
#   - If the raw class is the operative font-size/weight → VIOLATION (replace with token)
#   - If the raw class appears beside a typography.* token → VIOLATION (the token alone is sufficient, remove the raw class)
#   - If it is a dev/test-only element explicitly accepted above → OK
```

## Acceptance Checklist

### Panel structure

- [ ] `DecisionConfidencePanel` renders at top of results tab with `TriageHealthHeader` trust ring
- [ ] `AttentionBanner` (if present) appears between DCP and Options section
- [ ] Options section: `WinGauge` shows colour gradient (green → sky → lilac → sand) for determined states
- [ ] Tornado chart renders below the Drivers accordion; TornadoChart intro copy says "Drag the bars to explore how outcomes shift" (not "Drag to preview")

### Phase 1 — TippingPoints removed

- [ ] No `TippingPoints` component visible anywhere in the results panel
- [ ] No `TippingPoints` import errors at runtime (confirmed deleted from file system)

### Phase 2 — Dead code deleted

- [ ] `HeroSection.tsx` and `RecommendationSection.tsx` are absent from the file system
- [ ] `coachingReview.ts` imports `RichText`/`RichSegment` from `./types` (not `./HeroSection`)
- [ ] Tests for HeroSection/RecommendationSection/banned-strings are in vitest exclude list

### Phase 3 — Technique chip restricted

- [ ] Open a result with 3+ drivers where the top driver has influence > 0.6 AND confidence < 0.5
- [ ] "Try: reference class forecasting" chip appears **only** on the top-ranked driver
- [ ] The chip does NOT appear on other drivers even if they meet the threshold

### Phase 4 — Quick-fix rows use TriageCard (no-op)

- [ ] Quick-fix rows (items 4–6) in the "Also consider" disclosure use `<TriageCard>` — already correct

### Phase 5 — Colour documentation (no-op)

- [ ] `WinGauge.tsx` has DS v5 §3.3 colour comment block above the palette constants

### Phase 6 — Win% dedup

- [ ] In a **determined** state (robust/sensitive): rank badge shows `#1 of N`, right-aligned text shows win%
- [ ] In an **indeterminate** state (near-tie): rank badge is **absent**, win% shown once right-aligned
- [ ] No win percentage appears twice in any option card header row

### Phase 7 — Tier-driven chip copy (updated by QA closeout Item 4)

- [ ] With `confidence_tier = 'strong'` **or `'fair'` or `'unknown'`**: winner chip reads **"What makes this lead?"**
- [ ] With `confidence_tier = 'needs_work'` AND `recommendationStability < 0.85` (or absent): winner chip reads **"What makes this the current leader?"**
- [ ] With `confidence_tier = 'needs_work'` AND `recommendationStability >= 0.85`: winner chip reads **"What makes this lead?"** (high stability overrides the evidence-quality hedge)
- [ ] Non-winner chip always reads **"What would make this lead?"** regardless of tier
- [ ] Clicking any chip sends a message to the conversation panel

### Phase 8 — Typography tokens (no-op)

- [ ] No raw `text-xs`, `text-sm`, `font-semibold` etc. in `src/components/results/*.tsx` outside token usage

### Phase 9 — Section headers (no-op)

- [ ] No raw `<h2>` or `<h3>` in `ResultsBody.tsx`

### Phase 10 — Rank badge flat (documented)

- [ ] Rank badge remains flat text badge (not rounded-full pill) by design intent
- [ ] Comment in `OptionCards.tsx` explains: text badge = ordinal rank; pill badge = status count

### Phase 11 — Sticky footer

- [ ] `AnalysisFooter` (sticky bottom bar) shows a **single primary button**: "Rerun analysis"
- [ ] No "Create decision brief" button visible anywhere in the results panel
- [ ] "Rerun analysis" button is disabled when `canRunAnalysis === false` or while running
- [ ] Button shows "Analysing..." label while analysis is running
- [ ] Footer remains sticky at `bottom-0 z-10`

### Phase 12 — Icon tooltips

- [ ] Hovering over the info icon (ⓘ) on a driver row shows tooltip "More information"
- [ ] All icon-only buttons in the results panel show tooltips on hover

### Phase 13 — Card padding

- [ ] Empty state cards in DriversSection and ImprovementsSection use `p-3` (not `p-4`)
- [ ] The coaching accent card in ConfidenceSection (with left green border) uses `p-4` — intentional per DS v5 §6.4
- [ ] "Good foundation" and "Low confidence" status cards in ConfidenceSection use `p-3`

### Phase 14 — Sentence case (no-op)

- [ ] All visible labels, headings, and buttons in `DecisionConfidencePanel` and `OptionCards` use sentence case

### Phase 15 — Pill documentation (no-op)

- [ ] `DecisionConfidencePanel.tsx` first pill has DS v5 §7.2 outlined-pill anchor comment

### Phase 16 — Tornado dormancy

- [ ] Tornado chart bars are draggable (drag interaction works)
- [ ] Intro copy reads: **"Win-likelihood range if this factor turns out weaker or stronger than expected. Drag the bars to explore how outcomes shift."**
- [ ] **No "Apply & rerun" button** visible — not disabled, not present at all
- [ ] "Reset preview" button appears after dragging (correct behaviour unchanged)
- [ ] "Preview only" label appears after dragging (correct behaviour unchanged)

## Tier 1 Smoke Commands

```bash
git branch --show-current          # ui/post-analysis-refinement
git log --oneline -8               # Verify 8 commits (P0–P3, P5–7, P8–11, P12–16, P17)
npm run typecheck                  # TypeScript clean
npx vitest run --changed --bail=1  # Related tests pass
```

## Commits on this branch

| Commit | Phase | Description |
|--------|-------|-------------|
| `ee43adf0` | P0 | Preflight findings document |
| `912dd91d` | P1 | TippingPoints removed |
| `0cb356f3` | P2a | Re-export migration (pre-deletion) |
| `288a2b74` | P2b | HeroSection + RecommendationSection deleted |
| `a9b10bec` | P3 | Technique hint chip restricted to top-ranked driver |
| `be8a7a4f` | P5–7 | Colour doc, win% dedup, tier-driven chip copy |
| `b80f8562` | P8–11 | Typography token, rank badge comment, footer cleanup |
| `43f363af` | P12–16 | a11y title, padding, pill doc, tornado dormancy |
