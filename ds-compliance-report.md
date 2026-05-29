# Design System v5 — Compliance Audit Report (Stage 1)

**Date:** 2026-05-29 · **Scope:** investigation only (no code changes) · **Authority:** `docs/Design/Olumi_Design_System_v5.md` is the single source of truth.

This report quantifies existing drift from DS v5 so a tightly-scoped Stage 2 "fix + enforce"
brief can follow. **No design decisions are made here.** Findings and proposed mappings are
presented; Paul decides. Where the brief and DS v5 disagree, DS v5 wins and the conflict is flagged.

All counts were produced with read-only `ripgrep` against the current worktree
(`claude/intelligent-williamson-d732f7`), which is treated as ground truth. The exact commands
are embedded per class so any number is reproducible. The legacy-token regex is shaped
`\b(prefix)-(token)\b` so it **cannot** match "ink" inside "link"/"thinking".

> **Representation policy.** Small classes are enumerated in full (file:line). The two huge
> classes (legacy tokens 2,574; raw hex ~2,344) use **per-file rollups + representative samples +
> directory buckets + a reproducible command** rather than thousands of individual lines.
> **Review-only** items (surface-/intent-dependent) are kept strictly separate from confirmed violations.

---

## 0. Summary

| # | Violation class | Confirmed | Review-only / candidate | Stage 2 rank |
|---|---|---|---|---|
| A | **WCAG primary colour** (known item) | spec↔code desync; both fail WCAG | colour choice = Paul's | **11 (last, gated)** |
| 1 | Raw typography in panels (scoped) | 17 | — | 3 |
| 2 | Raw hex in components | ~587 production core | +1,248 debug, +525 `var()` fallback, +306 `.module.css`, +76 theme, +83 poc (each a Stage 2 scope question) | 7–9 |
| 3 | Legacy colour tokens | 2,574 across 134 files | — | **10 (late, global)** |
| 4 | Invalid `bg-*-light` | 4 bare (canvas-node badges) | 24 `hover:` (likely-allowed panel-hover) | 5 |
| 5 | All-caps `uppercase` text | 82 across 47 files | acronyms (EVPI/MRR/VOI) excluded | 4 |
| 6a | Non-Lucide icon imports | **0 (clean)** | — | — |
| 6b | Emoji / unicode-symbol icons | ~UI subset (see §6b) | log/comment emoji excluded | 6 |
| 7 | Icon/shape duplication (canvas) | 0 asserted | all node icons (review) | 12 (deferred) |
| 8 | Title Case static copy | 0 asserted | review sample below | 12 (deferred) |
| B | Chart-token Tailwind mapping (known item) | unmapped; 3 inline uses, 1 file | — | 2 |
| C | DS v4 references (known item) | ~30 genuine refs | "Platform Contract v4" etc. excluded | 1 |

**Delta vs the approved plan:** none material. Contrast ratios, the 2,574 legacy count, the
~2,344 hex count, 17 typography, 82 uppercase, and 3 chart uses all reproduced identically.
Refinements (more precise, not contradictory): Class 4 resolves to **4 bare + 24 hover** (plan
said "28 candidates"); the hex regex is shown to also match non-colour `#xxx` fragments (methodology
caveat, §2); v4 list gained `tailwind.config.js:178` and `typography.ts`.

---

## A. Known item — WCAG primary colour (Paul's decision)

### A.1 The premise is inverted, and it is a spec↔code desync

The brief assumed `--primary` is `#63ADCF` in `brand.css`. **It is not.** The implementation has
already moved to `#52A3C8`:

- `src/styles/brand.css:73` — `--info: #52A3C8;`
- `src/styles/brand.css:136` — `--primary: #52A3C8;`

But the **DS v5 spec still says `#63ADCF` in nine places**: lines 177 (Info row), 199 (chart-1),
216 (`--primary`), 290 (migration "Before"), 368 (focus-ring colour §6.3), 470 (primary-button
background), 560 (link colour §8.7→see §A.4), 754 (decision-node fill), 778 (medium-confidence).

So this is a **spec-vs-code desynchronisation**, not a one-line hex change. Both values fail WCAG
(below). "DS v5 wins" would revert to the *worse* value (`#63ADCF`, 2.50:1). This is surfaced for
Paul; the report recommends no colour.

### A.2 Contrast ratios (computed; WCAG relative-luminance formula — snippet in §Appendix)

Against white (`#FFFFFF`). AA thresholds: **3:1** for non-text UI components (focus ring, button
boundary, icon), **4.5:1** for normal text (links, button label text).

| Colour | Where it is used | Ratio vs white | AA UI 3:1 | AA text 4.5:1 |
|---|---|---:|:---:|:---:|
| `#63ADCF` | spec value (9 sites) | **2.50:1** | ❌ | ❌ |
| `#52A3C8` | **actual** `--primary` / `--info` (brand.css:73,136) | **2.83:1** | ❌ | ❌ |
| `#3A8FB5` | brief candidate | **3.64:1** | ✅ | ❌ |
| `#67C89E` | `--primary-hover` (brand.css:137, success green) | **2.03:1** | ❌ | ❌ |
| `#5AA88A` | `--primary-active` (brand.css:138) | **2.84:1** | ❌ | ❌ |
| `#236E8E` | `--info-hover` / `--link-hover` (brand.css:147,168) | **5.69:1** | ✅ | ✅ |

**Incorrect comment in code:** `src/styles/brand.css:71` claims `#52A3C8` was "Updated … for WCAG
AA 3:1 UI-component contrast on white." That claim is **false** — `#52A3C8` measures **2.83:1**,
below the 3:1 threshold. The applied accessibility fix is itself non-compliant.

### A.3 Usage contexts driven by `--primary` / `--info`

| Context | Token | Threshold | `#52A3C8` today |
|---|---|---|---|
| Primary CTA — white text on blue fill | `--primary` fill + `--text-on-color` | 4.5:1 (button text) | ❌ 2.83:1 |
| Primary CTA — button boundary vs page | `--primary` | 3:1 (UI component) | ❌ 2.83:1 |
| Links (§8.7) — blue **text** on white/panel | `text-info` | 4.5:1 (text) | ❌ 2.83:1 |
| Focus ring (§6.3) | `--focus-color: var(--info)` (brand.css:166) | 3:1 (UI component) | ❌ 2.83:1 |
| Decision-node canvas fill / "medium" confidence | `--info` | (large surface) | n/a |

### A.4 Coupling / desync warning (§3.10)

`--primary`, `--primary-hover` (`#67C89E`), and `--primary-active` (`#5AA88A`) **cannot be changed
independently.** Hover/active are **hardcoded greens, not derived from `--primary`** (brand.css:136-138),
implementing the deliberate blue→green "ready to act" shift (spec line 477). Consequences:

- Changing only `--primary` leaves hover at **2.03:1** (worst of all) and active at 2.84:1.
- `--primary` and `--info` are currently the same value; if links/focus/CTA are meant to track one
  token, splitting them is itself a design-system decision.
- Spec citation note: the brief cites links as **§8.6**; the spec actually places Links at **§8.7**
  (line 556). §8.6 is the count-badge. Stage 2 should cite §8.7.

### A.5 Options for Paul (presented neutrally — **no recommendation**)

1. **Adopt the current code value `#52A3C8`.** Smallest change (spec catches up to code). But it
   **still fails both 3:1 and 4.5:1**; links, CTA text, and focus ring remain non-compliant.
2. **Adopt a passing candidate such as `#3A8FB5`** (3.64:1). Passes UI 3:1 (focus ring, button
   boundary) but **still fails text 4.5:1**, so links and CTA label text would need a separate,
   darker token (e.g. the existing `#236E8E` at 5.69:1) or a different treatment. Also implies a
   broader brand shift and forces a decision on `--primary-hover`/`-active` to avoid re-introducing desync.
3. **Choose another value after reviewing the brand palette** — e.g. one value for UI components
   and a darker paired value for text/links so both thresholds pass.

In all cases the fix lands in **`brand.css` only** (consumers read the token), `--primary-hover`/`-active`
are handled deliberately in the same change, and the nine spec sites are reconciled to match.

---

## 1. Raw typography utilities in panel components (DS v5 §2.4)

**Clause:** §2.4 (spec line 77) — "No raw typography utilities. Never use `text-xs`, `text-sm`,
`text-[11px]`, `font-medium`, `font-semibold`… Always use semantic tokens from `typography.ts`."
Panels use only `panelHeader` / `panelBody` / `panelMeta` (defined `src/styles/typography.ts:52-54`).

**Scope** (per brief): `src/components/results/`, `src/canvas/panels/`, `src/canvas/ui/EdgeInspector*`.
**Adoption is high** — 36/43 results `.tsx` files import `typography`, with 280 `panelHeader/Body/Meta`
references; the 17 below are the stragglers.

**Confirmed: 17.** Command:
`rg -nP '\b(text-(xs|sm|base|lg|xl|2xl|3xl|5xl)|font-(medium|semibold|bold))\b' src/components/results src/canvas/panels src/canvas/ui/EdgeInspector.tsx -g '!**/*.spec.*'`

| File:line | Offending class | Note |
|---|---|---|
| `src/canvas/ui/EdgeInspector.tsx:228` | `text-xl` | close-button glyph |
| `src/canvas/ui/EdgeInspector.tsx:237` | `font-medium` | source label |
| `src/canvas/ui/EdgeInspector.tsx:239` | `font-medium` | target label |
| `src/canvas/panels/InspectorPanel.tsx:402` | `font-medium` | provenance length warning |
| `src/canvas/panels/IssuesPanel.tsx:55` | `font-semibold` | "Graph Issues" h3 |
| `src/canvas/panels/IssuesPanel.tsx:180` | `font-medium` | "Why this matters" |
| `src/canvas/panels/TemplatesPanel.tsx:618` | `font-bold` | weight override **on top of** `typography.panelMeta` |
| `src/canvas/panels/TemplatesPanel.tsx:640` | `font-medium` | override on top of `typography.panelMeta` |
| `src/canvas/panels/TemplatesPanel.tsx:670` | `font-bold` | override on top of `typography.panelMeta` |
| `src/canvas/panels/AdapterStatusBanner.tsx:63` | `text-xs` ×2 | `<code>` endpoints |
| `src/components/results/ResultsBody.tsx:336` | `text-sm` | empty-state copy |
| `src/components/results/ResultsBody.tsx:345` | `text-sm` | empty-state copy |
| `src/components/results/CompactOptionSpread.tsx:78` | `font-semibold` | "Option spread:" |
| `src/components/results/TriageActionCardsBody.tsx:359` | `font-semibold` | dominant label |
| `src/components/results/analysisHeroV17/HeroFooter.tsx:75` | `font-semibold` | "Also:" |
| `src/components/results/analysisHeroV17/HeroFooter.tsx:104` | `font-medium` | override on top of `typography.panelMeta` |

Five of these append a raw weight (`font-bold`/`font-medium`) **onto** a `typography.panelMeta`
class — still a §2.4 violation (raw font utility), and a clean Stage 2 fix (use the token's weight
or a dedicated token).

---

## 2. Raw hex colour values in components (DS v5 §3.12)

**Clause:** §3.12 (spec line 235) — "Never use raw hex values in components." Excludes
token-definition files (`brand.css`, `typography.ts`, `tailwind.config.js`).

**Total raw `#hex`-shaped matches: ~2,344** (1,983 in `.ts/.tsx` excl. tests + 361 in `.css` excl.
`brand.css`). This number is **inflated and must be bucketed** — most are not production-surface
colour literals. Command:
`rg -oP '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b' src -g '!**/brand.css' -g '!**/typography.ts'`

### 2.1 Methodology caveat — non-colour `#xxx` fragments

The `#RGB`/`#RRGGBB` regex also matches non-colour tokens (DOM-id refs, URL fragments, SVG
`url(#id)`). The distinct-value scan shows `#185` (64×), `#156`, `#153` — these are **not colours**.
Stage 2 enforcement should scope to actual colour literals (6-digit, or hex appearing in
`color:`/`fill:`/`background:`/`stroke:`/Tailwind-arbitrary-value `[#...]` context).

### 2.2 Directory buckets — each is an explicit Stage 2 scope question (do not assume "fix all")

| Bucket | Count | **Stage 2 question for Paul** |
|---|---:|---|
| `src/components/debug/**` | **1,248** | Debug-only developer UI. **Include in enforcement, or exclude (allowlist `debug/`)?** |
| `var(--token, #hex)` fallbacks | **525** | Token-first with a hex safety net. **Treat as compliant (allow the fallback pattern), or strip?** |
| `**/*.module.css` | **306** | CSS modules. **In scope for the component hex rule, or governed separately?** |
| `src/poc/**` | **83** | Proof-of-concept (`AppPoC.tsx`). **In scope, or exclude as non-production?** |
| `src/canvas/theme/**` (`nodes.ts`) | **76** | Canvas theme source values. **Allowed as the theme's source-of-truth, or must reference tokens?** |
| **Production core** (`.ts/.tsx`, excl. tests/debug/poc/theme) | **587** | The likely true target. Still includes fallbacks + sandbox-guide/routes. |

### 2.3 Top files

`PipelineTab.tsx` (255), `PayloadLabTab.tsx` (252) — both debug · `Conversation.module.css` (214) ·
`DataFlowTab.tsx`/`ContractIntegrityTab.tsx` (95) · `SummaryTab.tsx` (92) — debug ·
`canvas/theme/nodes.ts` (64) · `TopBar.module.css` (58) · `ContractInspector.tsx` (54) ·
`poc/AppPoC.tsx` (52) · `src/index.css` (42).

### 2.4 Distinct production-core colours → proposed token (proposal only)

| Hex | Count | Proposed DS v5 token | Note |
|---|---:|---|---|
| `#EEE6D8` | 35 | `--border-default` / `--factor-light` | identical value to both |
| `#908D8D` | 28 | `--text-light` | exact |
| `#EA7B4B` | 21 | `--danger` | exact |
| `#FEFEFE` | 13 | `--bg-panel` | exact |
| `#EF4444` | 13 | *(none)* — Tailwind `red-500` | **non-DS colour**; closest `--danger` |
| `#E5E7EB` | 12 | *(none)* — Tailwind `gray-200` | **non-DS**; closest `--border-default` |
| `#6B7280` | 12 | *(none)* — Tailwind `gray-500` | **non-DS**; closest `--text-light` |
| `#2B7FA2` | 12 | ~`--info-hover` (`#236E8E`) | not exact |
| `#FFFFFF` / `#FFF` | 10 / 14 | `--text-on-color` / `--white` | exact |
| `#94A3B8` | 10 | *(none)* — Tailwind `slate-400` | **non-DS**; closest `--text-light` |
| `#3F3F3E` | 10 | `--text-body` | exact |

Several distinct values are **off-palette Tailwind defaults** (red-500, gray-200/500, slate-400) with
no exact DS token — Stage 2 needs a mapping decision, not a mechanical swap.

---

## 3. Legacy colour tokens (DS v5 §3.12 / §3.14)

**Clause:** §3.12 (line 235) — "Never use legacy tokens (`sand-200`, `ink-800`, `bg-sand-50`,
`bg-slate-100`) in new code (§3.14)." §3.14 (line 252) — "Legacy aliases (migration in progress)."

**Confirmed: 2,574 across 134 files** (2,524 production, ~50 test). **Largest class by far.** Command:
`rg -oP '\b(bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|placeholder|caret|accent)-(sand|ink|paper|sun|mint|sky|carrot|lilac)\b' src -g '*.ts' -g '*.tsx' -g '*.css'`

### 3.1 Per-token count → proposed DS v5 token (proposal only)

| Legacy token | Count | → DS v5 | Alias defined at |
|---|---:|---|---|
| `ink` (`text-ink-900` …) | 876 | `text-text-header` (`--text-header`) | `brand.css:32` (`--ink-900`) |
| `sand` (`border/bg-sand-*`) | 602 | `border-panel-border` / `bg-canvas` (per shade) | `brand.css:46` (`--sand-200`→`--border-default`) |
| `sky` | 408 | `info` (`text-info`/`bg-info`) | `brand.css:126` (`--sky-500`→`--info`) |
| `carrot` | 252 | `danger` | `brand.css:127` |
| `mint` | 228 | `success` | `brand.css:125` |
| `paper` | 127 | `bg-panel` | `brand.css:45` (`--paper-50`) |
| `sun` | 81 | `goal` | `brand.css:124` |
| `lilac` | — (counted under tokens above; alias) | `option` | `brand.css:128` (`--lilac-400`) |

### 3.2 Mapping complication (flag for Stage 2)

Usages reference **full shade ramps** the alias layer does not cover — e.g. `text-mint-600`,
`bg-mint-100`, `border-sand-300`, `text-ink-400` (samples from `DriversSignal.tsx:78-79`,
`InputsDock.tsx:70`). The DS v5 system is **two-shade (main + light)**, not a 50–950 ramp, so legacy
shades do **not** map 1:1 (e.g. `mint-100` light fill cannot become `bg-success-light` without
hitting the §3.2 light-shade restriction). This is why the class is high-blast-radius and ranked late.

### 3.3 Top 15 files (of 134)

`InputsDock.tsx` (64) · `DriversSignal.tsx` (62) · `DebugDrawer.tsx` (58) ·
`RecommendationCard/RobustnessBlock.tsx` (53) · `DecisionReviewPanel.tsx` (53) ·
`ResultsPanel/KeyDriversPanel.tsx` (52) · `OutcomesSignal.tsx` (49) · `DecisionSummary.tsx` (47) ·
`SequentialView/index.tsx` (46) · `MultiGoalParetoPanel.tsx` (44) · `ConditionalGuidance/index.tsx` (40) ·
`ComparisonCanvasLayout.tsx` (39) · `RecommendationCard/index.tsx` (37) · `PreAnalysisHealth.tsx` (37) ·
`RiskProfileSelector.tsx` (35). All under `src/canvas/components/` — canvas-adjacent, ranked late.

---

## 4. Invalid `bg-{colour}-light` backgrounds (DS v5 §3.2 / §15.2)

**Clause:** §3.2 / §3.12 (line 235) — light shades are restricted to **canvas node fills** and
**panel entity-hover** only; "Never use `bg-{colour}-light` on cards, banners, accordion headers,
or pills." Total `bg-*-light` matches: **28** = **4 bare (candidate violations)** + **24 `hover:` (likely allowed)**.

### 4.1 Confirmed-candidate violations (bare, non-hover) — 4

All are small **node-attached badges/chips** in `src/canvas/nodes/` (light fill on a pill-like
container → candidate per §3.2; ranked with canvas/shape items):

| File:line | Class | Surface |
|---|---|---|
| `src/canvas/nodes/EvidenceGapBadge.tsx:32` | `bg-warning-light` | badge fill |
| `src/canvas/nodes/EvidenceGapBadge.tsx:33` | `bg-danger-light` | badge fill |
| `src/canvas/nodes/ConstraintNode.tsx:89` | `bg-danger-light` | `rounded` icon chip |
| `src/canvas/nodes/ConstraintNode.tsx:98` | `bg-warning-light` | `rounded` chip + caption |

### 4.2 Review-only — `hover:`/`group-hover:` `bg-*-light` (24, likely allowed)

These are **panel entity-hover** states, the explicitly-permitted use (§3.2). Representative:
`src/canvas/ui/inspector-v2/shared/ConnectionRow.tsx:15-20` (`hover:bg-goal-light`,
`hover:bg-option-light`, … — tints a connected-node row to match its canvas type — textbook compliant).
Others (`OnboardingOverlay.tsx:112,129,146` `hover:bg-info/success/warning-light` on bordered cards;
`WarningBanner.tsx:109` `hover:bg-warning-light/70` on a dismiss button) are **borderline** — hover,
but not strictly "panel entity rows." Listed for human judgment; not asserted as violations.

---

## 5. All-caps UI text (DS v5 §2 sentence-case rule)

**Clause:** spec line 84 — "Sentence case for all UI labels, headings, and section headers. Never
all caps." **Confirmed (styling-driven `uppercase`): 82 across 47 files.** Acronyms (EVPI, MRR, VOI,
AI, CEE, PLoT, ISL, CTA) are **excluded** — they are not styling-driven. Command:
`rg -n '\buppercase\b' src -g '*.tsx' -g '!**/*.spec.*'`

**Top files:** `DecisionList.tsx` (7) · `DebugDrawer.tsx` (6) · `EdgeDiffTable.tsx` (6) ·
`SharedBriefPage.tsx` (5) · `ScoreComparison.tsx` (4) · `PostRunState.tsx` (3) · `DecisionSummary.tsx` (3).

**Cross-cutting note:** the worst offenders are **table column headers** that stack three violations
at once — e.g. `EdgeDiffTable.tsx:129-144` and `DecisionList.tsx:545,555` are
`text-xs font-semibold text-gray-700 uppercase tracking-wide`: all-caps **+** raw typography (§2.4)
**+** off-palette `text-gray-*` (§3.12). Stage 2 can fix all three per line together.

---

## 6. Non-Lucide icons and emoji (DS v5 §9)

**Clause:** §9 (line 649) — "No other icon libraries. No emoji in production UI. No unicode symbol
characters as icon replacements."

### 6a. Non-Lucide icon imports — 0 (CLEAN ✅)

No `react-icons`, `@heroicons`, `@radix-ui/react-icons`, `react-feather`, `@fortawesome`, or `@mui`
imports in `src/`. `package.json` ships only `lucide-react`. Command:
`rg -n "from ['\"](react-icons|@heroicons|@radix-ui/react-icons|react-feather|@fortawesome|@mui)" src`

### 6b. Emoji / unicode-symbol icons — confirmed UI subset (separated from logs/comments)

Emoji appear in 78 production `.tsx` files, but **the count must be split** — only rendered-UI
affordances violate §9; `console.log`/comment emoji do not.

**Confirmed — emoji/unicode-symbol used as a rendered icon (violations):**

| File:line | Glyph | Context |
|---|---|---|
| `src/canvas/components/NodeBadge.tsx:45,63` | `⚠️` | `icon:` field |
| `src/canvas/components/NodeBadge.tsx:73` | `🔍` | `icon:` field |
| `src/pages/sandbox-guide/components/shared/EvidenceQualityBadge.tsx:28,42` | `✓` `⚠` | `icon:` (unicode-symbol — §9 forbids these too) |
| `src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:53,62,70` | `✨` `📋` `🔨` | `icon=` prop |

(Also flagged for Stage 2 enumeration: `PlotToolbar.tsx`, `RiskProfileBadge.tsx`, `CommandPalette.tsx`,
`UtilityWeightPanel.tsx` — per the investigation sweep.)

**Excluded — log/comment emoji (NOT violations):** e.g. `src/contexts/DecisionContext.tsx:75`
(`console.warn('… ⚠️ …')`), `src/pages/sandbox-guide/components/canvas/CopilotCanvas.tsx:34,121,148`
and `GhostSuggestionsOverlay.tsx:31,37` (`console.log('… 🎨/🎬/👻/🚀/💀 …')`).

Stage 2 must classify each of the 78 files line-by-line (rendered JSX/`icon:`/`label:` field →
violation; `console.*`/comment → ignore). This report does not assert the full 78 as violations.

---

## 7. Icon/shape duplication on canvas (DS v5 §1 three-channel) — REVIEW ONLY

**Clause:** §1 (lines 15-23) — Shapes = nouns (what it is), Colour = adjectives (how it's doing),
Icons = verbs (what you can do). An icon must not duplicate the shape's noun.

**No violations asserted.** Node components that render both a shape and icon(s):
`GoalNode`, `OptionNode`, `OutcomeNode`, `FactorNode`, `RiskNode`, `BaseNode` + `NodeShapeIndicator`
(renders the shape/noun) and shared icons `ScienceIcon` (analysis signal — verb), `ActionIcons`
(edit/mutate — verbs), `BriefIcon` (brief link — verb). On inspection these read as **verb-channel
augmentation, not noun-duplication** — i.e. compliant three-channel use. Listed for human confirmation
per the brief; **no change proposed.**

---

## 8. Title Case in static UI copy (DS v5 §2 sentence-case) — REVIEW ONLY

**Clause:** spec line 5 / 84 — sentence case for UI copy. **No violations asserted** (proper nouns —
Olumi, Goal, Option A, Status Quo — are excepted, and distinguishing them is a human judgment).
Representative review sample (`src/canvas/`): "Set Goal" (`CanvasToolbar.tsx:339`), "Guided Layout"
(`LayoutGuidedModal.tsx:19`), "Weight Distribution" (`UtilityWeightPanel.tsx:195`), "Snapshot Manager"
(`SnapshotManager.tsx:143`), "Engine Limits" (`LimitsPanel.tsx:199`), "Orphan Nodes" / "Circular
Dependencies" / "Logic Issues" (`StructuralHealth.tsx:42,51,60`). Stage 2 should review with Paul;
not mechanically fixable.

---

## B. Known item — Chart-token Tailwind mapping (DS v5 §3.9 / §14.1)

**Confirmed.** `--chart-1` … `--chart-6` are defined in `src/styles/brand.css:246-251` (aliasing
`--info`/`--success`/`--goal`/`--option`/`--warning`/`--danger`). **No Tailwind utilities are mapped**
(`tailwind.config.js` has no `chart` colour key), so components must use inline
`style={{ stroke: 'var(--chart-N)' }}`. **`--chart-7` / `--chart-8` do NOT exist** (spec marks them
planned). Total inline usage a mapped utility would replace = **3 lines, 1 file**:

- `src/canvas/compare-tab/TrajectorySection.tsx:99` — `stroke="var(--chart-1)"`
- `src/canvas/compare-tab/TrajectorySection.tsx:107` — `stroke="var(--chart-4)"`
- `src/canvas/compare-tab/TrajectorySection.tsx:116` — `stroke="var(--chart-3)"`

Stage 2 (if pursued): map **`chart-1..6` only**; do not invent `chart-7/8`. Small blast radius.

---

## C. Known item — DS v4 references (version staleness)

**~30 genuine "Design System v4" references** remain. Removing v4 from project knowledge is Paul's
action (not a code change). False positives **excluded**: `useLensFilter.ts:111` ("Platform Contract
v4"), `llm-context-assembly-audit…md:8` ("v4 pipeline" — LLM, not DS).

### C.1 Version-staleness signals in token/config files (highest-value)

These are the load-bearing ones — the token layer and dev entry-points still point at v4:

- **`src/styles/brand.css:3`** — header self-labels **"Version 2.0"**; **`:135`** comment cites
  **"v4 §3.10"**. The single source of colour values is labelled with an obsolete version. Part of
  the spec↔code staleness story in §A.
- `tailwind.config.js:178` — `// PRIMARY (Maps to Info Blue — v4 §3.10)`
- `src/styles/typography.ts:2,5` — "Olumi Typography System (Design System v4)" + points to v4 spec.
- `src/index.css:103` — `/* DS v4 branded scrollbars — global */`
- `CLAUDE.md:11` and `DESIGN_SYSTEM.md:3,151,167,202,212,277` — dev quick-ref + project instructions
  still link `docs/design/Olumi_Design_System_v4.md` and cite v4 section numbers.
- `docs/Design/Olumi_Design_System_v4.md` — the superseded spec file still present (capital-`D`
  `Design/`; note CLAUDE.md uses lowercase `docs/design/` — works on case-insensitive macOS but inconsistent).

### C.2 Inline `§ v4` comments in canvas (lower-value, cosmetic)

`src/canvas/conversation/primitives/IconButton.tsx:4`, `NodeShape.tsx:14`,
`zones/BriefGuidanceStrip.tsx:14`, `nodes/NodeShapeIndicator.tsx:4,19`, `contextMenu/useMenuItems.ts:46`,
`CanvasContextMenu.tsx:4`, `MenuTooltip.tsx:5`, `ui/inspector-v2/inspectorStrings.ts:99,113`,
`InspectorShell.tsx:3`, `shared/ConfidenceBadge.tsx:3`, `shared/CoachingCard.tsx:2`,
`src/pages/ScenarioListPage.tsx:6`, `src/components/results/utils/getThresholdColour.ts:2`,
`docs/handover/analysis-hero-v17-workstream.md:27`, `docs/v5/wave-4-source-to-render-trace.md:46`.
Plus test files asserting v4 contracts: `ModelTabBody.spec.tsx:599,610`, `CanvasContextMenu.spec.tsx:86`.

---

## D. Snapshot / visual-regression infrastructure (finding only)

Reported as a finding; **nothing built or modified.** The repo has vitest-based visual-regression
tests (`tests/visual-regression/` — `analysis-tab.spec.ts`, `utils.ts`, `README.md`) and a
`.storybook/` directory, but **no CI visual-regression gate** (no Chromatic; the full vitest suite
runs in CI per `staging-full-tests.yml`). Stage 2's "broad visual check" for the `--primary` change
would therefore be manual/staging-replay unless a gate is added (out of scope here).

---

## E. Proposed Stage 2 fix order (ranked by blast radius — lowest-risk first)

Per the brief: lowest-risk token swaps first; global tokens and canvas/shape items last. Stage 2 is
**token/config swaps only** — no layout, hierarchy, copy-meaning, or behaviour change.

| Rank | Item | Why here | Risk |
|---|---|---|---|
| 1 | **C — v4 comment/doc references** | comments/docs only; zero runtime/visual impact | trivial |
| 2 | **B — chart-1..6 Tailwind mapping** | additive utility; 1 consumer (3 lines) | low |
| 3 | **1 — raw typography → `typography.panel*`** | 17 localized; pattern already adopted (280×) | low |
| 4 | **5 — `uppercase` removal / sentence-case** | 82 localized; bundle with gray + raw-type on table headers | low-med |
| 5 | **4 — bare `bg-*-light` on badges → `bg-panel`** | 4 lines (canvas-node chips); leave 24 hover alone | low-med |
| 6 | **6b — rendered-UI emoji → Lucide** | per-line classify (skip logs/comments); touches many files | med |
| 7 | **2 — production-core hex → tokens** | ~587; several off-palette values need mapping decisions | med |
| 8 | **2 — `var()` fallback hexes** | **policy decision (§2.2 Q)** — keep or strip | deferred |
| 9 | **2 — debug / poc / theme / module.css hex** | **scope decisions (§2.2 Qs)** — likely allowlist | deferred |
| 10 | **3 — legacy colour tokens (2,574 / 134 files)** | global swap, canvas-heavy, ramp≠two-shade complication | **high** |
| 11 | **A — `--primary` WCAG hex (brand.css)** | single token but **global visual reach** + §3.10 coupling + spec reconciliation + Paul picks value | **high, gated** |
| 12 | **7 + 8 — icon/shape & Title Case** | review-only; need human decision, not mechanical | deferred |

---

## F. Carry-forward to the Stage 2 (fix + enforce) brief (recorded, not actioned)

- Fixes are **token/config swaps only**; anything needing restructuring → golden-journey UX audit.
- Apply only the **Paul-confirmed `--primary` hex**, in **`brand.css` only**; handle
  `--primary-hover`/`-active` (§3.10) deliberately in the same change to avoid re-introducing desync.
- Map only **`chart-1..6`** (do not invent `chart-7/8`).
- Enforcement (ESLint + grep) wired into the existing pre-push/CI gate, each with one positive and
  one negative fixture. **Negative fixtures live in an allowlisted test-fixture directory, tested only
  by the enforcement script itself; the production gate must not scan/fail on the fixture files.**
- No broad formatting churn; limit any formatter to touched files.
- Resolve the open scope questions in §2.2 (debug / poc / `var()` fallback / `.module.css`) before
  writing the hex enforcement rule, so the gate's scope matches Paul's intent.

---

## Appendix — contrast computation (reproducible)

```python
def lin(c):
    c /= 255
    return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
def L(h):
    h = h.lstrip('#')
    return 0.2126*lin(int(h[0:2],16)) + 0.7152*lin(int(h[2:4],16)) + 0.0722*lin(int(h[4:6],16))
def ratio(fg, bg='#FFFFFF'):
    a, b = L(fg), L(bg)
    return (max(a,b)+0.05) / (min(a,b)+0.05)
# #63ADCF→2.50  #52A3C8→2.83  #3A8FB5→3.64  #67C89E→2.03  #5AA88A→2.84  #236E8E→5.69
```
