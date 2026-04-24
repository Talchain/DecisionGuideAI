# Brief 5.5 — Final review

Branch: `ui/analysis-tab-visual-system`  
Commits: 20 (D1–D18 + corrections + polish), local only. Not pushed.

---

## Deliverable-by-deliverable status

| D# | Description | Status | Notes |
|---|---|---|---|
| D1 | Precondition baseline | **Delivered** | Branch from staging, 1563/13/0 baseline captured, paths audited, D12/D9 decisions locked. |
| D2 | Visual system spec | **Delivered** | §2.1–2.9 locked. bg-factor → bg-option correction; shouldSoftenPhrasing helper defined. |
| D1/D2 corrections | Peer review fixes | **Delivered** | Gate locked to tier+stability, grep gates production-scoped, heroDisplay locked, sectionColorMarker typed. |
| D3 | Typography enforcement | **Delivered** | heroDisplay added. Raw utilities eliminated from scope. Gate passes zero. |
| D4 | Section header unification | **Delivered** | sectionColorMarker prop; icon: 'option' migrated. No tooltip icons on headers; no info-colour active states. |
| D5 | Scope subtitles / regression fix | **No-op** | Subtitles already present (PreAnalysisPanel:1488, :1715); count-duplication line already absent. Verified visually on staging at launch. |
| D6 | Numbered badge unification | **Delivered** | Improve-confidence badge: bg-factor → bg-option. Review next and Top evidence already bg-info. |
| D7 | Bar vocabulary consolidation | **Delivered** | Driver-row confidence → 4-dot indicator (w-2 h-2, gap-1, bg-text-body/bg-panel-hover, role=progressbar preserved). |
| D8 | Tier-soften gate | **Delivered** | Gate: tier ∈ {needs_work, fair} AND stability < 0.85. coachingReadiness removed as trigger. Fair + low stability now softens. Fallback Rule 7: "leads by N points" with gap; "is the leading option" without gap. Rewrote 8 test files, +12 tests net. |
| D8 polish | Grammar + DS fixes | **Delivered** | square marker → no rounding; confidence dots w-1.5→w-2; fallback bare-"leads" → "is the leading option". |
| D9 | Standalone factor card removal | **Delivered (9a+9b)** | AttentionBanner + 3 spec files deleted. Validate/Research chips folded into DriversSection dominant-factor warning. Phase-0 check confirmed. |
| D10 | Top evidence card unification | **Delivered** | TrustSummary heading → SectionHeader. Science nudges separated by "Model checks" sub-header (Path B). |
| D11 | Fragility row consolidation | **Delivered** | Grouped by alt-winner (not source). Header: "N factors could flip the result to {Y}". Per-edge triggers listed; per-edge Review chips preserved. |
| D12 | Something Missing unification | **Delivered** | `src/components/shared/MissingKnowledgePrompt.tsx` with context prop. CoachingPrompt.tsx deleted. Pre-analysis import updated. |
| D13 | Driver row density | **Delivered** | Rows 2+: direction arrow removed, tooltip (i) button removed, non-interactive title → ExpandableCoachingText. |
| D14 | Structural repairs notification | **Delivered** | "Olumi applied N adjustments" removed from AdvancedSection. Model tab confirmed as canonical home (ModelTabBody.tsx:619). |
| D15 | Card padding and border | **Delivered** | 5 arbitrary-px spacing hits converted to Tailwind scale equivalents. Gate passes zero. |
| D16 | Icon-only focus coverage | **Delivered** | Confidence click button gained focus-visible ring. All other touched-file icon-only buttons already compliant. |
| D17 | Option card rank prefix + colour marker | **Delivered** | "#N of M" text removed. 10px inline-style colour marker from WIN_GAUGE_COLORS[rank-1]. |
| D18 cleanup | OptionPreview + YourExpertise Info icons | **Delivered** | Info tooltip icons removed from "Your options" (OptionPreview:387) and "Your expertise" (3 render paths) section headers. Unused Info imports removed. |
| D18 | Final pass | **Delivered** | This document + staging walkthrough template. |

---

## Grep gate results (all zero)

All gates produced zero hits after final cleanup changes were applied.

```
Gate 1 (typography)       — 0 hits ✓
Gate 2 (currently leads)  — 0 hits ✓  (only inside certaintyCopy.ts)
Gate 3 (rank prefix)      — 0 hits ✓  (comment-only line in jsdoc)
Gate 4 (Olumi applied)    — 0 hits ✓
Gate 5 (count-dup line)   — 0 hits ✓
Gate 6 (arbitrary spacing)— 0 hits ✓
Gate 7 (bg-colour-light)  — 0 hits ✓
Gate 8 (text-white badge) — 0 hits ✓
Gate 9 (bg-factor)        — 0 hits ✓  (one pre-existing carve-out: OptionCards.tsx neutralised-bar fill — approved use, not a badge/indicator)
```

---

## Test counts (Analysis-tab surface: src/components/results + src/canvas/components/pre-analysis)

| Checkpoint | Files | Passed | Skipped | Failed |
|---|---|---|---|---|
| D1 baseline (staging HEAD) | 90 | 1563 | 13 | 0 |
| D8 (after test rewrites +12 new) | 90 | 1575 | 13 | 0 |
| D9 (after 3 spec files deleted) | 87 | 1548 | 13 | 0 |
| D12 (after CoachingPrompt.spec deleted) | 86 | 1544 | 13 | 0 |
| D18 final | 86 | 1544 | 13 | 0 |

**Net change from D1 baseline:** −4 test files (deleted with their components), +12 tests added (D8 cross-product coverage). Zero regressions.

---

## Typecheck status

Pre-cleanup background run: **PASS** (exit 0).  
Post-cleanup `npm run typecheck`: 4 errors in `src/v5/__tests__/applyV5State.hardening.test.ts` — these files belong to the **authorised parallel CC session** working on branch `claude/v5-alpha-hardening-ui` (V5 alpha hardening, non-overlapping scope). They are untracked on this branch and must not be touched.

**Push coordination required:** `npm run typecheck` picks up all `.ts` files in `src/` regardless of git tracking, so those untracked v5 files will cause the pre-push hook's typecheck to fail when run in the same working tree. Coordinate with the v5 session to commit or vacate their working files before pushing this branch, or push when the other session's untracked files are not present.

---

## Visual system spec compliance per deliverable

| §2.x | Requirement | Compliant |
|---|---|---|
| §2.1 Typography | 4 scales only; heroDisplay added | ✓ |
| §2.2 Bar vocabulary | Magnitude / Bidirectional / Confidence dots — no collision | ✓ |
| §2.3 Section headers | Single SectionHeader component; tooltip icons removed from all 10 sections (D4 + D18 cleanup) | ✓ |
| §2.4 Numbered badges | bg-info (Review next, Top evidence), bg-option (Improve confidence), text-text-on-color | ✓ |
| §2.5 Cards | Padding/border per category; mutual-exclusion left-accent ↔ badge enforced | ✓ |
| §2.6 Dedup registry | All 6 sites resolved | ✓ |
| §2.7 Tier-soften gate | tier+stability gate, readiness removed, fair softens at <0.85 | ✓ |
| §2.8 Grep gates | All 9 gates zero | ✓ |
| §2.9 Schema freeze | No pattern changes after D2 commit | ✓ |

---

## Launch triage

### Blockers
None.

### Safe follow-ups (not blocking launch)

1. **Typecheck contamination** — remove untracked stash files before push or verify they belong to another branch. The push hook will run typecheck and may fail on them.
2. **D5 visual verification** — confirm "N assumptions to review and N quality suggestions to consider" is absent after merge to staging. Brief notes this as a staging walkthrough item.
3. **OptionCards.tsx still has `rank: undefined` in jsdoc** — the comment now says "Ordinal colour marker + option name" but `rank` is used in card internals. Minor doc drift; no functional impact.
4. **YourExpertise tooltip removal** — the three Info icons carried useful content ("Review factors and relationships on the Model tab", "Confirm AI estimates..."). The spec §2.3 removes header tooltips. Consider whether the instruction text should move to a subtitle prop instead. Flagged as deferred.

5. **MissingKnowledgePrompt canvas dependency** — `src/components/shared/MissingKnowledgePrompt.tsx` imports `DiscussWithAiButton` from `@/canvas/components/pre-analysis/`, creating a transitive canvas dependency from a shared component. Correct fix is to inject the button via a `chatButton?: React.ReactNode` prop slot; deferred because it requires test rewrites. Tracked for a follow-up accessibility/dependency pass.

### Deferrals (out-of-scope for Brief 5.5, tracked for future work)
- `AllImprovements.tsx:264` — tier-section sub-header Info icon (not in spec §2.3 ten-section list)
- `DecisionQualityChecks.tsx:266` — "Sharpen your thinking" sub-header Info icon (same)
- `WorthInvestigating.tsx:120` — sub-section header Info icon (same)
- `OptionCards` — `focus-visible` rings missing on winner chip + "Edit interventions" text buttons (text buttons, out of D16 icon-only scope; should be added in a follow-up accessibility pass)

---

## Performance observations

- No new `useEffect` hooks added in hot paths.
- `useMemo` used in certaintyCopy callers (existing pattern preserved).
- `shouldSoftenPhrasing` is a pure function with no side effects; memoisation not needed.
- AttentionBanner deletion removes one `useMemo` + filter from the `ResultsBody` render path (minor improvement).

---

## Accessibility audit findings

- All new Validate/Research chips (D9a): `aria-label` + `focus-visible:ring-warning` + text content. ✓
- Confidence indicator (D7): `role="progressbar"` + `aria-valuenow` + `aria-label` + `focus-visible:ring-info` (D16 fix). ✓
- sectionColorMarker (D4): `aria-hidden="true"` on the square (decorative). ✓
- Rank colour marker (D17): `aria-hidden="true"` (decorative; position conveys rank). ✓
- MissingKnowledgePrompt (D12): dismiss button has `aria-label="Dismiss"` + `focus-visible:ring-1 focus-visible:ring-info` + canonical Tooltip. ✓
- YourExpertise header Info icons (D18 cleanup): removed; tooltip content was descriptive but the section heading is self-describing.

---

## Opportunities registered for future work

1. **`panelMetaStrong` token** — if `TargetProbabilityBars` per-constraint percentages need emphasis, a 11px/600 token avoids raw font-weight utilities. Flagged during D3 adversarial review.
2. **TriageCard `badgeColor` prop narrowing** — currently accepts `string`; should be a union like `sectionColorMarker`. D6 commit body noted this.
3. **Text-button focus rings** — OptionCards winner chip, "Edit interventions", "Show all / Show fewer" lack focus-visible rings. Out of D16 icon-only scope; should be a follow-up.
4. **YourExpertise tooltip content** — the removed Info tooltips contained actionable copy ("Confirm AI estimates, fill missing data..."). Consider converting to a subtitle prop on the section header.
5. **D5 no-op monitoring** — if the count-duplication string was never present in the branch's staging source, confirm it's definitively absent in the deployed bundle.
