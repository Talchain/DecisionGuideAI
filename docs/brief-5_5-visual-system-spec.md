# Brief 5.5 — Analysis-tab visual system specification (LOCKED)

This document is the contract for Deliverables 3–17. After this commit, schema freeze applies: no changes to patterns below without explicit user halt + approval.

All tokens cited are DS v5 tokens (in-repo at `docs/Design/Olumi_Design_System_v5.md`). Registry/Contract citations not required in this document.

---

## 2.0 Scope and token source

Touched files live in:
- `src/components/results/**`
- `src/canvas/components/pre-analysis/**`
- `src/styles/typography.ts` (new `heroDisplay` token only)

Tokens drawn from `src/styles/brand.css` (`--info`, `--success`, `--warning`, `--danger`, `--option`, `--factor`, `--text-header`, `--text-body`, `--text-light`, `--text-on-color`, `--bg-panel`, `--bg-panel-hover`, `--border-default`). Semantic Tailwind classes (`bg-info`, `border-panel-border`, `text-text-on-color`, etc.) per DS v5 §3.

**bg-factor runtime check (correction 1):** `--factor: #B0A899` (stone/warm-beige/brown; see `src/styles/brand.css:102`). **NOT PURPLE.** The brief's 2.4 reference to `bg-factor` for Improve-confidence badges was token-name in error. DS v5 §3 defines purple as `--option: #AAA7E4`. Spec 2.4 below uses **`bg-option`** for Improve-confidence numbered badges. `bg-option` on a UI chip is DS-sanctioned (DS v5 §3 lists `option` in comparison/scenario contexts, e.g., line 1088 ScenarioBlock). Using it on a numbered badge does not conflict with the three-channel system since badges are not node-shape entities.

---

## 2.1 Typography scale (locked — exactly 4 scales permitted in touched files)

| Scale | Size / weight | Sole use |
|---|---|---|
| `heroDisplay` | 32px / 600 | **Only** the hero probability numeric on the Current result card |
| `panelHeader` | 14px / 600 | Every section title, hero winner name, card titles |
| `panelBody` | 12px / 400 | Primary body copy |
| `panelMeta` | 11px / 400 | Subtitles, helper text, pill labels, disclaimers |

**Addition (D3) — LOCKED value (no refinement without spec amendment):**
```ts
heroDisplay: 'text-[32px] font-semibold leading-none tracking-tight',
```
D3 adds this exact string to `src/styles/typography.ts`. If implementation reveals a need to refine `leading-none` or `tracking-tight`, that constitutes a §2.9 schema-freeze change — D3 halts, user approves an amendment to this spec, then the refined token value is committed.

**Forbidden in touched files (D3 grep gate):** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-[Npx]`, `font-medium`, `font-semibold`, `font-bold` — **except** inside the `heroDisplay` token definition itself in `typography.ts`.

**§2.1 amendment (Brief 5.5 close-out, 2026-04-25):** `typography.code` (12px monospace) is permitted in `<details>` blocks that display technical formatted data such as edge-strength correction old→new value pairs (`ResultsBody.tsx`). Rationale: the monospace rendering is semantically appropriate for code-like `"from → to": 0.50 → 0.5` output. This is not a new token — it is a narrow scope clarification. The surface is production-visible but only renders when structural corrections were applied during analysis (users rarely see it). Both uses confirmed at D4 site: `typography.caption` replaced with `typography.panelBody` (exact visual match); `typography.code` retained with inline comment referencing this exception.

---

## 2.2 Bar-graph vocabulary (locked — 3 patterns, one per concept)

### Pattern A — Magnitude bar
Left-anchored single fill, fixed-height track.
```tsx
<div className="w-full h-1.5 bg-panel-hover rounded-full overflow-hidden">
  <div
    className={`h-full rounded-full ${fillColourClass}`}
    style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
  />
</div>
```
- Fill colour from DS v5 semantic palette (`bg-success`, `bg-info`, `bg-warning`).
- Used for: driver influence, option win probability, trust-narrative quality scores (Evidence / Robustness / Framing), "hits target" percentage.
- **Trust-narrative bar decision (correction 4):** **keep as magnitude bars.** Quality scores are single-axis 0–1 measurements with no direction, sharing the conceptual category with influence and win-probability. They do not collide with sensitivity (Pattern B) or confidence (Pattern C) because they are grouped inside the Advanced / Trust narrative surface and are visually distant from driver-row confidence indicators.

### Pattern B — Bidirectional sensitivity bar
Centred, two-segment fill extending left (weaker) and right (stronger) from midline.
- Sole use: **TornadoChart only.**
- Palette: `bg-warning` (weaker, left) + `bg-success` (stronger, right).
- No other section may use a centre-anchored two-segment bar.

### Pattern C — Confidence indicator

**Amended in Brief 5.7 D4 (2026-04-29):** the original four-step dot scale was replaced with a thin horizontal bar plus numeric readout. Rationale: staging QA proved the dot rendering was harder to read at the column's width than the bar treatment it had replaced. Visual separation from Pattern A (the magnitude bar) is preserved via colour (`bg-info` vs `bg-success`/`bg-warning`) AND thickness (`h-1` vs `h-1.5`), so the no-vocabulary-collision intent of the original Pattern C is intact.

Thin bar + numeric readout rendered at the confidence column.

```tsx
<div className="inline-flex items-center gap-1.5">
  <div
    role="progressbar"
    aria-valuenow={Math.round(confidence01 * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={`${label} confidence: ${Math.round(confidence01 * 100)}%`}
    className="w-12 h-1 bg-panel-hover rounded-full overflow-hidden"
  >
    <div
      className="h-full bg-info rounded-full"
      style={{ width: `${Math.round(confidence01 * 100)}%` }}
    />
  </div>
  <span className={`${typography.panelBody} font-mono text-text-light`}>
    {Math.round(confidence01 * 100)}%
  </span>
</div>
```

The numeric readout uses `typography.panelBody` (12px) — the locked Brief 5.5 §2.1 token — not a raw `text-[12px]` utility. This keeps the spec snippet aligned with the production code in `src/components/results/DriversSection.tsx` and lets §2.1 grep gate 1 (forbid raw typography utilities) stay green even if a reader copies the snippet verbatim.

- Track height `h-1` (4 px). Track background `bg-panel-hover` so the empty state still reads as a column.
- Fill colour `bg-info` (DS v5 info blue). Width = `confidence01 * 100`%.
- Numeric readout sits to the right in `font-mono text-text-light` so the percentage is legible without needing to read the bar.
- Sole use: driver-row confidence, evidence-level confidence.
- Must **not** use the success / warning palette — those are reserved for Pattern A magnitude bars (influence, win-probability, target-hits).
- Visual separation from Pattern A: `h-1` (vs `h-1.5`) AND `bg-info` (vs `bg-success`/`bg-warning`).

Accessibility: bar carries `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax` + `aria-label`. The wrapping click-target button continues to expose its own `aria-label="<factor> confidence: <pct>%. Click to update."` per existing focus-helper convention.

---

## 2.3 Section header pattern (one component, one shape)

Single rendering path via `src/components/results/SectionHeader.tsx`. Accepted props:

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | Rendered as `panelHeader` + `text-text-header` |
| `count` | `number` | no | Rendered as a numbered pill — `border border-panel-border bg-transparent rounded-full px-1.5`, `panelMeta`, `text-text-body` |
| `subtitle` | `string` | no | `panelMeta` + `text-text-light`, single line, truncate |
| `chevron` | `'open' \| 'closed' \| undefined` | no | Rotated ChevronDown, 14px, `text-text-light` |
| `sectionColorMarker` | `'bg-option' \| undefined` | no | 10×10px square rendered before title. Constrained union (not free `string`) so Tailwind JIT sees the class literal and static review can audit. Only `'bg-option'` in scope (Your options section). Widening the union requires a §2.9 spec amendment. |
| `testId` | `string` | no | existing pattern |
| `icon` | existing | no | left unchanged in D4 (do not remove existing `icon` prop) |

**Removed from all section headers in D4:**
- Tooltip `(i)` icons attached to header titles (chevron conveys expansion; subtitles and copy convey meaning)
- "Active-state" info-colour outlines on expanded accordion headers
- `bg-{colour}-light` fills behind expanded headers

Applies to all ten sections: Current result (title only), Top evidence, Your options (with `sectionColorMarker="bg-option"`), What's driving this, What could change the result, Before you decide, Advanced, Review next (subtitle), Improve confidence (subtitle), Your expertise.

Hero uses SectionHeader with `title` only. No count, chevron, or subtitle.

Subtitles live **only** where D5 adds them (Review next, Improve confidence) and where D13 retains the row-1 technique hint (driver top row, not a section header).

---

## 2.4 Numbered badge pattern (locked)

Shape: `rounded-full w-5 h-5 inline-flex items-center justify-center`. Text: `panelMeta` + `text-text-on-color`. Numbering restarts per section; no cross-section continuation.

| Section | Tailwind class | Rationale |
|---|---|---|
| Review next | `bg-info` | Forward-leaning actions |
| Top evidence | `bg-info` | Matches Review next (forward action class) |
| Improve confidence | `bg-option` | **Corrected from brief-5.5 text `bg-factor` (which is stone/brown, not purple) per runtime check in §2.0.** Supporting refinement class. |
| Fragility (Before you decide) | — | **No numbered badges.** Fragility rows are consequences, not ranked actions. |
| Option cards | — | **No `#N of M` prefix.** Rank conveyed via position + colour marker (§2.5 option-comparison entry) + right-aligned win percentage. |

**Forbidden:** `text-white` on numbered badges — use `text-text-on-color`. No filled `bg-{colour}-light` badges.

---

## 2.5 Card pattern (locked per category)

All cards: `rounded-lg border border-panel-border bg-panel`. Additional attributes below.

| Category | Padding | Border addition | Left accent | Fill override |
|---|---|---|---|---|
| Hero (Current result card) | `p-4` | — | none | none |
| Warning callout | `p-3` | warning icon inline at top-left | none | none |
| Standard coaching card | `p-3` | — | none | none |
| High-priority card (Review next top item; equivalent rank-1 cards in other surfaces) | `p-3` | — | **3px left accent** via `border-l-[3px] border-l-success` (or `border-l-info` when success is not thematic) | none |
| Driver row | `px-3 py-1.5` | — | none | none |
| Option comparison card | `p-3` | ordinal border tinting preserved from V14.2 (winner `border-success/60`, runner-up `border-info/60`, third `border-option/60`) + **4–6px left colour marker** matching scenario-bar dot per option (D17) | — matches ordinal tint, not a separate accent | none |
| Fragility row | `p-3` | warning icon rendered at card top-left | none | none |

**Mutual-exclusion rule (locked):** a card has **either** a 3px left accent **or** a numbered badge — never both. Any implementation that violates this fails D15 acceptance.

**Forbidden on cards / pills / banners:** `bg-{colour}-light` fills (DS v5 §3).

**Grep gate (D15):** `rg "p-\[[0-9]+px\]|px-\[[0-9]+px\]|py-\[[0-9]+px\]|gap-\[[0-9]+px\]" src/components/results/ src/canvas/components/pre-analysis/` returns zero.

---

## 2.6 Duplication-removal registry

| Claim | Sites rendering today | Canonical home (post-brief) | Deliverable |
|---|---|---|---|
| "Currently leads" soft phrasing | Hero copy (`certaintyCopy.ts`) + winner chip (`winnerChipCopy.ts`, used in `OptionCards.tsx`) | Both consume `certaintyCopy`; gate fires only when `tier ∈ {needs_work, fair}` AND `recommendationStability < 0.85`. Strong-stability runs always use confident phrasing. | D8 |
| Fragility rows with identical alt-winner | Three separate rows in Before you decide (`ChallengeSection.tsx`) | One grouped row listing triggers; Review chip dropdown / multi-select per-edge | D11 |
| "Something missing from the model/results?" | `MissingKnowledgePrompt.tsx` (pre-analysis) + `CoachingPrompt.tsx` (post-analysis) | **Moved to `src/components/shared/MissingKnowledgePrompt.tsx`** (shared location) with `context: 'model' \| 'results'` prop. Pre-analysis import updated. `CoachingPrompt.tsx` deleted. Avoids results components importing from `src/canvas/**`, which would establish a cross-surface dependency in the wrong direction. | D12 |
| "N assumptions to review and N quality suggestions to consider" | `PreAnalysisPanel.tsx` (readiness banner area) | Removed entirely — section counts already convey this. Brief 5.3 Task 1 regression. | D5 |
| "Olumi applied N model adjustments" | `AdvancedSection.tsx` (results panel) | Removed from results per Signal Registry v3 §6.4; Model tab retains it. D14 verifies Model-tab render before removal. | D14 |
| Standalone `AttentionBanner` card between DCP and Your options | `ResultsBody.tsx:214` | Removed (9b) after Validate/Research chips folded into DriversSection dominant-factor warning (9a). | D9 |

---

## 2.7 Tier-soften gate (locked, full decision table)

Gate source: `src/components/results/utils/certaintyCopy.ts`. Consumed by hero composition in `DecisionConfidencePanel.tsx` and by winner chip (`winnerChipCopy.ts`) used in `OptionCards.tsx`.

**Rule (locked to brief):** soft phrasing ("currently leads", "current leader") fires **if and only if** BOTH:
1. `confidenceTier ∈ {'needs_work', 'fair'}`, AND
2. `recommendationStability < 0.85`.

**Null/absent stability (addition — not a pattern change):** If `recommendationStability` is `null` or `undefined`, treat as weak (`stabilityIsWeak = true`). Phrase softens. Rationale: when stability is unknown we cannot assert a strong result, so cautious phrasing is the safe default. Tests asserting absent stability softens are correct.

`coachingReadiness` is **not** a softening trigger. If the current `certaintyCopy.ts` implementation reads `coachingReadiness` as an alternate condition 1 (it does — Row 4 of the current code), D8 removes that branch as part of its full scope (correction 2). Readiness remains an input to other copy decisions (close_call, evidence caveats) but cannot soften a `strong` tier or a high-stability run.

**Decision table (tier × stability, complete):**

| tier | stability | Phrasing |
|---|---|---|
| `strong` | any | Confident (hero: "leads by N points"; chip: "What makes this lead?") |
| `fair` | ≥ 0.85 | Confident (stability override) |
| `fair` | < 0.85 | Soft (hero: "currently leads by N points"; chip: "What makes this the current leader?") |
| `needs_work` | ≥ 0.85 | Confident (stability override) |
| `needs_work` | < 0.85 | Soft |

Close-call copy (existing Row 5 path) is orthogonal and preserved; it neither softens nor strengthens the leader phrasing governed by this table.

**Readiness cross-product tests (D8 must cover all four):**
- `strong` tier + `coachingReadiness='needs_evidence'` + stability 0.75 → **Confident** (tier `strong` alone blocks softening; readiness must not sneak softening through).
- `needs_work` tier + `coachingReadiness='ready'` + stability 0.75 → Soft (readiness does not rescue confidence when tier+stability both demand soft).
- `needs_work` tier + `coachingReadiness='needs_evidence'` + stability 0.90 → **Confident** (stability override beats weak readiness).
- `fair` tier + `coachingReadiness='not_ready'` + stability 0.80 → Soft (unambiguous soft path, readiness is incidental).

**D8 acceptance tests (three named bundles — specific bundle fixtures to be chosen during D8):**
- Bundle A: tier=`needs_work`, stability=0.87 → hero reads confident; chip reads confident.
- Bundle B: tier=`needs_work`, stability=0.75 → hero reads soft; chip reads soft.
- Bundle C: tier=`strong`, stability=0.95 → hero reads confident; chip reads confident.

**D8 is a full deliverable (correction 2):** regardless of how much of this gate is already shipped at D8 entry, D8 delivers (a) unit tests spanning every cell of the table, (b) verified behaviour across the three bundles, (c) any code adjustments needed to achieve the table. Not a test-only deliverable.

---

## 2.8 Grep gate list (D18 executes; all must return zero)

All gates exclude test directories via `--glob '!**/__tests__/**' --glob '!**/*.spec.*' --glob '!**/*.test.*'`. Test files legitimately contain many of these strings for assertion purposes and would cause false positives. Shared glob exclusion alias used below: `GATE_GLOBS='-g !**/__tests__/** -g !**/*.spec.* -g !**/*.test.*'`.

```
# Typography enforcement — forbidden utilities in production code
rg $GATE_GLOBS -n "text-xs|text-sm|text-base|text-lg|text-\[[0-9]+px\]|font-medium|font-semibold|font-bold" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero. Exception: src/styles/typography.ts defines tokens (heroDisplay uses text-[32px]) — typography.ts lives outside the two scanned trees, so naturally excluded.

# "Currently leads" phrasing — production only, certaintyCopy is the sole source
rg $GATE_GLOBS -n "currently leads" src/components/results/
# Expected: matches only inside src/components/results/utils/certaintyCopy.ts

# OptionCards rank prefix — catches literal and template forms
rg $GATE_GLOBS -n "#\s*(\d+|\$\{[^}]+\})\s+of\b" src/components/results/OptionCards.tsx
# Expected: zero. Catches "#1 of 3", "#${rank} of ${totalOptions}", "# 1 of 3" etc.

# "Olumi applied" structural-repairs notification removed from results
rg $GATE_GLOBS -n "Olumi applied" src/components/results/
# Expected: zero (Model tab retains; Model tab outside scanned tree)

# Count-duplication line in pre-analysis readiness area
rg $GATE_GLOBS -n "assumptions to review and" src/canvas/components/pre-analysis/
# Expected: zero

# Unsafe casts — net count may not increase
rg $GATE_GLOBS -c "as any|as unknown" src/components/results/ src/canvas/components/pre-analysis/ | awk -F: '{sum+=$2} END {print sum}'
# Expected: count ≤ baseline captured at D18 entry (no net increase vs branch-creation HEAD)

# bg-{colour}-light — never on cards, pills, banners in these trees
rg $GATE_GLOBS -n "bg-[a-z]+-light" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero new uses. Approved pre-existing carve-outs:
#   TornadoChart.tsx:628-630,656-657 — `bg-text-light/40` chart divider lines (false positive;
#   bg-text-light is a text-color token, not a colour-semantic light fill — regex is too broad)

# text-white on badges
rg $GATE_GLOBS -n "text-white" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero (replaced with text-text-on-color)

# Arbitrary spacing — use scale or --space-* tokens
rg $GATE_GLOBS -n "p-\[[0-9]+px\]|px-\[[0-9]+px\]|py-\[[0-9]+px\]|gap-\[[0-9]+px\]" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero

# bg-factor stone/brown token — forbidden as badge/indicator (corrected to bg-option per §2.4)
rg $GATE_GLOBS -n "bg-factor\b" src/components/results/ src/canvas/components/pre-analysis/
# Expected: 2 approved hits (regex catches bg-factor-light suffix via word boundary):
#   OptionCards.tsx:151 — neutralised-bar fill (semantic "no result" state, not a badge)
#   AllImprovements.tsx:877 — `hover:bg-factor-light` row hover (panel entity-hover, DS-sanctioned)
# Gate intent is zero badge uses; both pre-existing carve-outs are explicitly approved.
```

Baseline `as any` / `as unknown` count captured at D18 entry by running the command against the branch-creation HEAD (`f7907f89`) — documented in final review.

---

## 2.9 Schema freeze statement

This commit locks 2.1–2.8. Deliverables 3–17 execute against these patterns without modification. Any implementation finding that appears to require a pattern change constitutes a brief STOP trigger — halt, surface the conflict, obtain user approval, amend this document in a separate commit before proceeding.
