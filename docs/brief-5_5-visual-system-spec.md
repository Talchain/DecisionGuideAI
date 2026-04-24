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

**Addition (D3):** `heroDisplay` added to `src/styles/typography.ts`:
```ts
heroDisplay: 'text-[32px] font-semibold leading-none tracking-tight',
```
Leading + tracking values are initial guesses anchored to DS v5 display typographic treatment. D3 commit may refine these during implementation; if refined, commit body documents the refinement.

**Forbidden in touched files (D3 grep gate):** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-[Npx]`, `font-medium`, `font-semibold`, `font-bold` — **except** inside the `heroDisplay` token definition itself in `typography.ts`.

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
Four-step dot scale rendered at the confidence column.
```tsx
<div className="inline-flex items-center gap-0.5" aria-label={`Confidence ${label}`}>
  {[0,1,2,3].map(i => (
    <span
      key={i}
      className={`w-1.5 h-1.5 rounded-full ${i < filledSteps ? 'bg-text-body' : 'bg-panel-hover border border-panel-border'}`}
      aria-hidden="true"
    />
  ))}
</div>
```
- `filledSteps` = `Math.round(confidence01 * 4)`, clamped to [0, 4].
- Single neutral token (`bg-text-body` for filled, `bg-panel-hover` + panel-border for unfilled).
- Sole use: driver-row confidence, evidence-level confidence.
- Must **not** use success / info / warning palette — that collides with Patterns A and B.

Accessibility: `aria-label="Confidence <label>"` where `<label>` comes from existing `constraintConfidenceColour` label map (`HIGH`/`MEDIUM`/`LOW` per UI-SEM-010).

---

## 2.3 Section header pattern (one component, one shape)

Single rendering path via `src/components/results/SectionHeader.tsx`. Accepted props:

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | Rendered as `panelHeader` + `text-text-header` |
| `count` | `number` | no | Rendered as a numbered pill — `border border-panel-border bg-transparent rounded-full px-1.5`, `panelMeta`, `text-text-body` |
| `subtitle` | `string` | no | `panelMeta` + `text-text-light`, single line, truncate |
| `chevron` | `'open' \| 'closed' \| undefined` | no | Rotated ChevronDown, 14px, `text-text-light` |
| `sectionColorMarker` | `string \| undefined` | no | 10×10px square rendered before title; value is a DS tailwind colour class (e.g., `bg-option`) |
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
| "Something missing from the model/results?" | `MissingKnowledgePrompt.tsx` (pre-analysis) + `CoachingPrompt.tsx` (post-analysis) | `MissingKnowledgePrompt.tsx` extended with `context: 'model' \| 'results'` prop. `CoachingPrompt.tsx` deleted. Canonical component **locked in D1**. | D12 |
| "N assumptions to review and N quality suggestions to consider" | `PreAnalysisPanel.tsx` (readiness banner area) | Removed entirely — section counts already convey this. Brief 5.3 Task 1 regression. | D5 |
| "Olumi applied N model adjustments" | `AdvancedSection.tsx` (results panel) | Removed from results per Signal Registry v3 §6.4; Model tab retains it. D14 verifies Model-tab render before removal. | D14 |
| Standalone `AttentionBanner` card between DCP and Your options | `ResultsBody.tsx:214` | Removed (9b) after Validate/Research chips folded into DriversSection dominant-factor warning (9a). | D9 |

---

## 2.7 Tier-soften gate (locked, full decision table)

Gate source: `src/components/results/utils/certaintyCopy.ts`. Consumed by hero composition in `DecisionConfidencePanel.tsx` and by winner chip (`winnerChipCopy.ts`) used in `OptionCards.tsx`.

**Rule:** soft phrasing ("currently leads", "current leader") fires **only** when BOTH:
1. `confidenceTier ∈ {'needs_work', 'fair'}` OR `coachingReadiness ∈ {'needs_evidence','needs_framing','low','not_ready'}`, AND
2. `recommendationStability < 0.85`.

**Decision table (tier × stability × downstream coaching readiness collapsed to one axis):**

| tier | stability | Phrasing | Example |
|---|---|---|---|
| `strong` | any | Confident | Hero: "leads by N points". Chip: "What makes this lead?" |
| `fair` | ≥ 0.85 | **Confident (stability override)** | Hero: "leads by N points". Chip: "What makes this lead?" |
| `fair` | < 0.85 | Soft | Hero: "currently leads by N points". Chip: "What makes this the current leader?" |
| `needs_work` | ≥ 0.85 | **Confident (stability override)** | Hero: "leads by N points". Chip: "What makes this lead?" |
| `needs_work` | < 0.85 | Soft | Hero: "currently leads by N points". Chip: "What makes this the current leader?" |
| `needs_work` + close_call readiness | any | existing close-call path unchanged | (path preserved from current row 5) |

**D8 acceptance tests (three named bundles — specific bundle fixtures to be chosen during D8):**
- Bundle A: tier=`needs_work`, stability=0.87 → hero reads confident; chip reads confident.
- Bundle B: tier=`needs_work`, stability=0.75 → hero reads soft; chip reads soft.
- Bundle C: tier=`strong`, stability=0.95 → hero reads confident; chip reads confident.

**D8 is a full deliverable (correction 2):** regardless of how much of this gate is already shipped at D8 entry, D8 delivers (a) unit tests spanning every cell of the table, (b) verified behaviour across the three bundles, (c) any code adjustments needed to achieve the table. Not a test-only deliverable.

---

## 2.8 Grep gate list (D18 executes; all must return zero)

```
rg -n "text-xs|text-sm|text-base|text-lg|text-\[[0-9]+px\]|font-medium|font-semibold|font-bold" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero (typography token enforcement — except typography.ts itself which defines heroDisplay)

rg -n "currently leads" src/components/results/
# Expected: matches only inside src/components/results/utils/certaintyCopy.ts

rg -n "# of |#1 of |#2 of |#\{" src/components/results/OptionCards.tsx
# Expected: zero (rank prefix removed)

rg -n "Olumi applied" src/components/results/
# Expected: zero (removed from results; Model tab retains)

rg -n "assumptions to review and" src/canvas/components/pre-analysis/
# Expected: zero (count-duplication line removed)

rg -c "as any\|as unknown" src/components/results/ src/canvas/components/pre-analysis/
# Expected: count ≤ baseline captured at D1 time (no net increase)

rg -n "bg-[a-z]+-light" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero hits on card / pill / banner elements (may appear only in existing node-hover contexts explicitly sanctioned by DS v5)

rg -n "text-white" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero on badges (replaced with text-text-on-color)

rg -n "p-\[[0-9]+px\]|px-\[[0-9]+px\]|py-\[[0-9]+px\]|gap-\[[0-9]+px\]" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero (arbitrary spacing forbidden; use Tailwind scale or --space-* tokens)

rg -n "bg-factor\b" src/components/results/ src/canvas/components/pre-analysis/
# Expected: zero (token is stone/brown, not the purple the brief intended; use bg-option)
```

Baseline `as any` / `as unknown` count captured at D18 entry by running the command against the branch-creation HEAD (`f7907f89`) — documented in final review.

---

## 2.9 Schema freeze statement

This commit locks 2.1–2.8. Deliverables 3–17 execute against these patterns without modification. Any implementation finding that appears to require a pattern change constitutes a brief STOP trigger — halt, surface the conflict, obtain user approval, amend this document in a separate commit before proceeding.
