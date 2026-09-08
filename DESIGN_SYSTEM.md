# Olumi Design System — Quick Reference

> Full specification: [`docs/Design/Olumi_Design_System_v5.md`](docs/Design/Olumi_Design_System_v5.md)
>
> ⚠ This link previously read `docs/design/…_v4.md` — **lower-case `design`, and v4**. The
> directory is `docs/Design/` (capital `D`), so the old path resolved on a case-insensitive
> macOS checkout and would fail on Linux/CI. v5 declares itself *"Single source of truth for
> all UI implementation. Supersedes all previous versions."*
>
> **The `v4 §N` citations below are deliberate and mostly still correct — see "Key Files".**

## Philosophy

- **Three-channel visual system:** Shapes (nouns) = what something is · Colour (adjectives) = how it's doing · Icons (verbs) = what you can do. No channel should duplicate another.
- **Two shades per colour**: Main (text/icons/borders) + Light (canvas node fills and panel entity-hover only)
- **No coloured backgrounds on components**: Cards, banners, pills, coaching cards use `bg-panel` — never `bg-{colour}-light`
- **Borders via opacity**: Use main colour at 30% opacity — never add extra shade tokens
- **Single font**: Inter throughout the entire application

## Typography

**Font:** Inter (weights 300–700), single font throughout. Tokens defined in `src/styles/typography.ts`.

```tsx
import { typography, typo } from '@/styles/typography'
<h2 className={typography.h2}>Heading</h2>
<p className={typo('body', 'text-text-light')}>Muted paragraph</p>
```

### Type Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `h1` | 48px (`text-5xl`) | semibold | Page titles |
| `h2` | 30px (`text-3xl`) | semibold | Section headings |
| `h3` | 24px (`text-2xl`) | semibold | Subsection headings |
| `h4` | 20px (`text-xl`) | medium | Card headings |
| `h5` | 18px (`text-lg`) | medium | Minor headings |
| `body` | 16px (`text-base`) | regular | Standard body text |
| `bodySmall` | 14px (`text-sm`) | regular | Minimum accessible size |
| `label` | 14px (`text-sm`) | medium | UI labels |
| `button` | 14px (`text-sm`) | semibold | Button text |
| `caption` | 12px (`text-xs`) | regular | Badges, chips |

### Panel Components — Strict Three-Size System

All side panel UI (results, inspector, issues, templates) uses **only three sizes**. Do not introduce other sizes or raw Tailwind font-size classes (`text-sm`, `text-xs`, etc.) in panel components.

| Token | Size | Usage |
|-------|------|-------|
| `panelHeader` | 14px, semibold | Section titles, winner name, key emphasis |
| `panelBody` | 12px, regular | Body text, descriptions, bullets, card content |
| `panelMeta` | 11px, regular | Badges, pills, axis labels, tertiary metadata |

**Scope:** `src/components/results/`, `src/canvas/panels/`, `src/canvas/ui/EdgeInspector*`, and any component rendered inside a side panel.

### Canvas Nodes

| Token | Size | Usage |
|-------|------|-------|
| `nodeTitle` | 13px, semibold | Node titles |
| `nodeLabel` | 11px, regular | Node labels |
| `edgeLabel` | 10px, regular | Edge labels |

### Rules

- **Minimum font size:** 14px for general/marketing UI (accessibility). Panel and canvas contexts use 10–12px for information density — always via tokens, never raw classes.
- **Use tokens, not raw classes:** Always use semantic tokens from `typography.ts`. Never use raw `text-xs`, `text-sm`, `text-[11px]`, etc.
- **No font-weight overrides on panel tokens:** Each token defines its own weight. Do not add `font-medium`, `font-semibold`, or `font-bold` alongside a panel token. If you need semibold at 14px, use `panelHeader` — not `panelBody font-semibold`.
- Max line length: 65–75 characters for readability

## Iconography

**Library:** Lucide (`lucide-react`). No other icon libraries. No emoji in production UI.

### Sizing

| Context | Size | Tailwind |
|---------|------|----------|
| Canvas node badge / panel inline | 14px | `w-3.5 h-3.5` |
| Panel section header | 16px | `w-4 h-4` |
| Toolbar / navigation | 20px | `w-5 h-5` |
| Empty state | 40px | `w-10 h-10` |

### Colour rule

Icons inherit colour from context — no fixed colours. Follow semantic layer: `text-success`, `text-danger`, `text-info`, `text-warning` for status contexts. `text-text-light` at rest for neutral contexts.

### Visibility tiers

- **Tier 1 — Navigation** (always visible): `ChevronDown`, `ChevronRight`, `X`
- **Tier 2 — Actions** (hover/focus only, tooltip required): `Pencil`, `Link`, `Check`, `Plus`, `ExternalLink`
- **Tier 3 — Status** (always visible, replaces text labels): `CheckCircle`, `AlertTriangle`, `Info`, and the provenance glyphs `Sparkles` (AI), `FileText` (from the brief), `UserCheck` (a person)

  The three provenance glyphs are registered here because they are always-visible
  node status marks that REPLACE text labels — the canvas card's "AI estimate" /
  "From brief" / "Set by you" pill. Their single owner is
  `src/canvas/domain/valueProvenanceIcon.ts` (total over `ValueProvenanceKind`);
  never pick a provenance glyph at a call site. They are neutral `text-text-light`
  rather than semantic: against `--bg-panel` #FEFEFE, `--warning` measures 1.92:1
  and `--success` 2.02:1, both below SC 1.4.11's 3:1 for a graphic carrying
  meaning, and an icon has no word behind it to carry the meaning instead.

### Node-type icons (off-canvas use only)

| Node type | Icon |
|-----------|------|
| Goal | `Target` |
| Decision | `GitBranch` |
| Option | `Lightbulb` |
| Factor | `Settings` |
| Risk | `AlertTriangle` |
| Outcome | `TrendingUp` |

On the canvas, shapes identify node type — icons are off-canvas only (panel lists, conversation blocks, search results).

### Space rules

- Icon-only buttons require tooltips (mandatory, 300ms delay). Minimum touch target 44×44px.
- Maximum three icon actions per row — overflow to `MoreHorizontal` menu.
- No icons in running text or descriptions.

## Colour Reference

All colours defined in `src/styles/brand.css`, mapped in `tailwind.config.js`.

### Text Colours

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--text-header` | #262626 | `text-text-header` | Headlines, emphasis |
| `--text-body` | #3F3F3E | `text-text-body` | Body text, paragraphs |
| `--text-light` | #908D8D | `text-text-light` | Muted text, captions |
| `--text-on-color` | #FFFFFF | `text-text-on-color` | Text on primary/destructive buttons |

### Surfaces and Backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node/banner backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Default hover state backgrounds |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### Semantic Colours

Each colour has exactly TWO shades: **main** (text/icons/borders) + **light** (canvas node fills and panel entity-hover only). Borders use `border-{colour}/30`.

| Colour | Main | Light | Usage |
|--------|------|-------|-------|
| **Danger** | #EA7B4B | #FFB393 | Errors, risks, critical |
| **Success** | #67C89E | #B8E2D0 | Positive outcomes, confirmations |
| **Info** | #277A9D | #BAD7E4 | Informational, decisions, navigation |
| **Warning** | #FFA656 | #FCC798 | Cautions, alerts |

### Node-Specific Colours

| Node Type | Main | Light | Usage |
|-----------|------|-------|-------|
| **Goal** | #F5C433 | #F4DB92 | `bg-goal-light text-goal` (canvas only) |
| **Option** | #AAA7E4 | #DDDCF5 | `bg-option-light text-option` (canvas only) |
| **Factor** | #B0A899 | #EEE6D8 | `bg-factor-light text-factor` (canvas only) |
| **Decision** | (uses Info) | | Decision nodes |
| **Outcome** | (uses Success) | | Outcome nodes |
| **Risk** | (uses Danger) | | Risk nodes |

### Light Shade Restrictions (v4 §3.2)

`bg-{colour}-light` is permitted in exactly two contexts:
1. **Canvas node fills** — large-surface identification of node type
2. **Panel entity-hover** — when hovering a panel row/card linked to a canvas node

**Never** use `bg-{colour}-light` on cards, banners, coaching cards, pills, or any other component background. Use `bg-panel` instead.

### Interactive States

Primary buttons use info blue with a deliberate colour shift to success green on hover ("ready to act" signal).

```tsx
className="bg-primary text-text-on-color hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
```

## Pills and Badges (v4 §8.5)

**One treatment only — outlined.** No filled backgrounds. Ever.

```tsx
// ✅ Correct — outlined pill, neutral text, coloured border
className="bg-transparent border border-danger/30 text-text-body rounded-full px-3 py-1"

// ❌ Wrong — filled background
className="bg-danger-light text-danger"

// ❌ Wrong — coloured text
className="border border-danger/30 text-danger"
```

Text on pills is **always** `text-text-body` — never `text-{colour}`. Colour is carried by the border only.

## Canvas Graph (nodes and edges)

### Border vocabulary (ratified, wireframe v4)

A node's **kind** is carried by its border hue + shape glyph. Two ratified
border modifiers exist, and they mean different things — never conflate them:

- **Dashed border = "outside your control"** (external factors).
- **Amber = "needs your judgement"** (a controllable node missing its value;
  the goal missing its target). ⚠ **Ruled 2026-09-08: amber is a BADGE beside
  the kind hue, not a border replacing it** — see the ruling below. The code
  still paints the border (`BaseNode.tsx:602`) until the implementing lane lands.

External factors NEVER get the needs-judgement treatment, even with no value —
pinned in both directions by `FactorNode.spec.tsx:531-542` and
`BaseNode.incompleteBorderVocabulary.spec.tsx:166-179`. New states must reuse
this vocabulary, not invent a third treatment.

> **RULED 2026-09-08 (Paul).** Supersedes the open question flagged 2026-07-16.
> **The kind hue STAYS on the border. "Needs your judgement" becomes an AMBER
> BADGE, not an amber border.**
>
> The original question was framed around amber-vs-risk (ΔE2000 **13.9**, the
> figure measured in `BaseNode.incompleteBorderVocabulary.spec.tsx`).
> **That is not the worst collision, and the framing understated the problem.**
> CIEDE2000, with dichromat simulation (Viénot–Brettel–Mollon 1999):
>
> | amber vs | normal | deuteranopia | protanopia |
> |---|---|---|---|
> | risk / danger | 13.9 | 9.0 | 12.3 |
> | **goal** | 17.0 | **5.5** | **8.6** |
> | outcome / success | 43.6 | 19.6 | **12.8** |
> | factor | 22.0 | 20.8 | 17.4 |
> | option | 42.9 | 53.6 | 50.6 |
> | decision / info | 51.0 | 58.8 | 49.1 |
>
> - **Amber vs GOAL is ΔE 5.5 under deuteranopia and 8.6 under protanopia** —
>   effectively the same colour. And the amber rule explicitly covers *"the goal
>   missing its target"*, **so the rule is least visible exactly where it is most
>   used.** Amber vs outcome/success is only 12.8 under protanopia.
> - **Decisively: amber-replacing-the-hue makes colour the SOLE channel for
>   "needs your judgement".** It overwrites the kind hue, so no second channel
>   survives to carry the state. **This document's own Developer Checklist
>   requires "Colour is not the sole information channel"** — the current border
>   rule contradicts the same document's accessibility rule.
> - **A badge is a shape-and-position channel**, so it survives every dichromat
>   case *and* it preserves the kind channel. Precedent already exists in the
>   same component: `BaseNode.tsx:958` renders an amber dot
>   (`h-2.5 w-2.5 rounded-full bg-warning border border-canvas`) for "edited
>   since the last analysis".
>
> **Unchanged by this ruling — external factors NEVER get the needs-judgement
> treatment.** Dashed still means "outside your control". The exemption sits
> upstream of the border expression in `isFactorNeedsInput`, and is pinned in
> both directions by `FactorNode.spec.tsx:531-542` (external → `border-factor`,
> never amber) and `BaseNode.incompleteBorderVocabulary.spec.tsx:166-179`
> (external keeps the dash; the incomplete node loses it).
>
> **Implementation is a separate lane; this entry is the ruling, not the change.**
> Until it lands, `BaseNode.tsx:602` still returns `border-warning`, and the
> comments at `BaseNode.tsx:578-581` and
> `BaseNode.incompleteBorderVocabulary.spec.tsx:19-25` still describe this as an
> open question awaiting Paul. **Those two comments are now stale and belong to
> that lane to update.**

### Edge polarity tokens

Causal-edge colours are tokens, not literals: `--edge-positive` /
`--edge-negative` / `--edge-neutral` (+ `-dark` variants) in `brand.css`,
with the full CVD/ΔE rationale attached to the tokens. `directionStroke.ts`
owns the *rule* (which state gets which token); the token file owns the hues.
Amber stays reserved for the warning/fragility family (Paul's C2 ruling).

**RULED 2026-09-08: an edge nobody has set is GREY (`--edge-neutral`) — not
`--goal` yellow.** This section previously read *"truly uninitialised edges use
`--goal` yellow"*. **The code deliberately does not do that**
(`directionStroke.ts:56-63`, a stated exception); that exception is hereby
promoted to the rule. Three grounds, recorded so the question is not re-opened
cheaply:

1. **It is NOT a contrast problem, so contrast cannot decide it — and did not.**
   Goal yellow is perfectly separable from the edge palette (ΔE2000 35.4 from
   `--edge-positive`, 59.1 from `--edge-negative`; worst dichromat case 20.7).
   Grey is separable too (27.5 / 39.3; 17.1 / 28.6 under deuteranopia).
   **Both candidates pass on contrast.** The decision turns on channel ownership.
2. **It is a channel-collision problem, and this document's own rule settles it:**
   *"No channel should duplicate another."* `--goal` is the goal ENTITY's
   identity. Spending it on "we have no data" overloads one hue with two
   meanings — painting a large share of a fresh graph's edges in the goal hue
   would say something about goals, not about missing data.
3. **Grey REUSES the existing vocabulary rather than minting a third hue.** Grey
   already means "we have no verdict" here: it is what a
   weight-set-but-no-direction edge gets, and what the deliberate weight = 0
   choice gets. This is exactly what the border section above already demands —
   *"New states must reuse this vocabulary, not invent a third treatment."*

⛔ **The unset state is decided by PROVENANCE, never by a value.** The branch
this replaces was commented *"truly uninitialised: no direction AND weight is
undefined"* and **could not fire**: `USER_EDGE_DEFAULTS` fabricates
`weight: 0.3` and `direction: 'positive'`, so `rawWeight === undefined` never
happened in the product and **every freshly drawn edge was painted the
confirmed-positive green**. Colour is read pre-attentively, so it asserted
"this is a confirmed positive influence" about a connection the user had merely
drawn. `computeDirectionStroke` now takes `EdgeValueDisplay` /
`EdgeDirectionDisplay` rather than numbers, because there is no argument meaning
"0.3, source unknown". **Any future rule here must key on whether anyone
SUPPLIED the value — never on the value itself, which always has a default.**

The shipped legend already teaches grey: `CanvasLegendPopover.tsx:114` renders
*"Grey: direction not set yet"* against `var(--edge-neutral)`, and the
unset-thickness row uses the same token. **There is no yellow row.**

> ⚠ `src/styles/brand.css:213-215` still carries the superseded sentence
> (*"Yellow (--goal) stays reserved for truly uninitialised edges"*). It is a
> source file and out of scope for this documentation change — it needs the same
> correction. See the PR description.

### Edge-label signals

Three DISTINCT signals may appear on or near an edge — each has one owner and
one format; never invent a fourth or blend them:

| Signal | Format | Owner |
|--------|--------|-------|
| Weight label | "Strong boost" / "Moderate drag (uncertain)" — or numeric via the mode toggle | `domain/edgeLabels.ts` grammar |
| Fragility badge | "Sensitive · NN%" warning pill (analysis result) | robustness surface |
| Existence confidence | "NN% conf." (hover panel row, with title/aria disclosure) | `ConnRow` |

Labels render in `typography.edgeLabel`; stacking is spaced by
`edgeLabelCollision.ts`. The weight label and the fragility badge share ONE
placed chip per edge (`data-testid="edge-influence-label"`, one row each) — the
chip is a CONTAINER, not a fourth signal, and each row keeps its own text,
owner and title. Known density issue: several options converging on
one goal can stack near-identical weight labels — prefer suppressing
duplicates at the convergence (visibility rules live in
`edgeLabelVisibility.ts`) over shrinking or restyling them.

### In-node affordance budget

At most **two persistent icon affordances** per node (e.g. edit + confirm).
Everything else — AI suggestions, visibility, help — appears on hover or
selection. Icons are Lucide only; text glyphs (✓ ✕ ⚠) are never icons.

## Patterns

```tsx
// Standard component pattern: neutral bg + coloured border + dark text
<div className="bg-panel text-text-body border border-danger/30 rounded-md px-3 py-2">
  <span className="text-danger">Error message</span>
</div>

// ✅ Correct border — use opacity
className="border border-info/30"

// ❌ Wrong — coloured backgrounds on components (only on canvas nodes)
className="bg-danger-light text-danger"

// ❌ Wrong — extra shade tokens don't exist
className="border-danger-200"  // DOESN'T EXIST
```

### Coaching Cards (v4 §15)

Complete borders only (V7 L2 — Paul's categorical rule). The neutral `bg-panel`
plus the semantic border **colour on all four sides** is the coaching signal;
the retired `border-l-[3px]` one-sided accent must not come back.

```tsx
// ✅ Correct — neutral bg, complete coloured border
<div className="bg-panel border border-info rounded-lg px-4 py-3">

// ❌ Wrong — one-sided left accent (retired in V7 L2)
<div className="bg-panel border-l-[3px] border-info rounded-lg px-4 py-3">

// ❌ Wrong — coloured background
<div className="bg-info-light border border-info rounded-lg px-4 py-3">
```

### Evaluative Colour Thresholds (v4 §11.6)

Universal threshold system for quality metrics (readiness, stability, quality scores):

| Range | Colour | Meaning |
|-------|--------|---------|
| 0–39% | `text-danger` | Needs attention |
| 40–69% | `text-warning` | Moderate |
| ≥ 70% | `text-success` | Strong |

Does **not** apply to: driver influence bars (use `text-info`), win probability, count badges.

## Canonical State Copy

One system state renders **one sentence, everywhere**. Every user-facing state
string is an exported constant next to the logic that owns it — never a
re-typed literal — so panel, chat, and canvas cannot drift into different
dialects (the July incident class: one surface said "Results may be outdated"
while another said "Cannot confirm whether this analysis is current" for the
same state).

| State | Canonical sentence | Constant |
|-------|--------------------|----------|
| Analysis fresh | Analysis reflects the current model. | `FRESHNESS_COPY.fresh` |
| Model changed since analysis (CEE verdict) | Model changed since this analysis. Re-run to update. | `FRESHNESS_COPY.stale` |
| Freshness unknown | Cannot confirm whether this analysis is current. | `FRESHNESS_COPY.unknown` |
| No analysis yet | No analysis yet. | `FRESHNESS_COPY.none` |
| Analysis held on a bundled starter | Analysis is held on a saved example. Re-draft it live to run one. | `ANALYSIS_HELD_NOTICE.starter` |
| Analysis held on an inserted template | Analysis is held on an inserted template. Re-draft it live to run one. | `ANALYSIS_HELD_NOTICE.template` |
| Guest panel constraint not analysed (persistence inactive) | In guest mode, constraints added here aren't included in the analysis. Add them in chat instead. | `GOAL_CONSTRAINT_COPY.guestConstraintsNotInAnalysis` |
| Template load failed | Failed to load template. | `TEMPLATE_LOAD_FAILED_MESSAGE` |

Rules:
- New state → new constant + a row here, in the same PR.
- Specs pin the **raw literal** (not the constant) so a reworded constant
  cannot silently drift from the sentence the tests promise.
- The locally-edited-while-fresh state currently renders **two different
  sentences on two surfaces** (`resolveDisplayedFreshness` → unknown copy vs
  `classifyFreshnessForDisplay` → changed copy). This is a known conflict
  awaiting a product wording decision — do not add a third dialect.

## Legacy Aliases (Migration In Progress)

These aliases are defined in `brand.css` and `tailwind.config.js` for backward compatibility. **New code MUST use semantic names. When touching a file that uses legacy tokens, migrate those references.**

| Legacy | Semantic Replacement (full Tailwind class) |
|--------|---------------------------------------------|
| `ink-900` | `text-text-header` |
| `paper-50` | `bg-panel` |
| `sand-200` | `border-panel-border` |
| `sun-500` | `text-goal` / `bg-goal` |
| `mint-500` | `text-success` |
| `sky-500` | `text-info` |
| `carrot-500` | `text-danger` |
| `lilac-400` | `text-option` |

## Quick Reference

| Need | Tailwind Class |
|------|----------------|
| Error text | `text-danger` |
| Error border | `border-danger/30` |
| Success text | `text-success` |
| Success border | `border-success/30` |
| Warning text | `text-warning` |
| Warning border | `border-warning/30` |
| Info text | `text-info` |
| Info border | `border-info/30` |
| Primary button | `bg-primary text-text-on-color hover:bg-primary-hover` |
| Destructive button | `bg-danger text-text-on-color` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |
| Canvas node fill | `bg-{entity}-light` (canvas only) |
| Panel entity hover | `bg-{entity}-light` (hover only) |

## Developer Checklist

Before shipping any UI work:

- [ ] No raw hex values in CSS/TSX
- [ ] No raw font-size/font-weight utilities (use tokens)
- [ ] No emoji — use Lucide icons
- [ ] No `bg-{colour}-light` on cards, banners, or pills (canvas/hover only)
- [ ] Pill text is always `text-text-body` — never `text-{colour}`
- [ ] ARIA labels on all interactive elements (especially icon-only buttons)
- [ ] Tooltips on all icon-only buttons (mandatory)
- [ ] Colour is not the sole information channel
- [ ] All 10–11px text accessible at 12–14px via tooltip/expand
- [ ] Focus ring present on all interactive elements (`focus:ring-2 focus:ring-offset-2 focus:ring-info`)

## Key Files

- `docs/Design/Olumi_Design_System_v5.md` — Full design system specification (**current**;
  its own header says it supersedes all previous versions)
- `docs/Design/Olumi_Design_System_v4.md` — retained: the `v4 §N` citations in this file
  point here, and a citation to where a rule was ratified is not stale merely because a
  newer document exists

**Citation audit (verified 2026-09-08 against both documents' headings):**

| Cited here | v4 | v5 | Verdict |
|---|---|---|---|
| v4 §3.2 Light shade restrictions | §3.2 Two-shade rule | §3.2 Two-shade rule | correct in both — **not stale** |
| v4 §8.5 Pills and badges | §8.5 Pills and badges | §8.5 Pills and badges | correct in both — **not stale** |
| v4 §11.6 Evaluative colour thresholds | §11.6 | §11.6 | correct in both — **not stale** |
| v4 §15 Coaching cards | §15 Coaching card pattern | **§16** Coaching card pattern | **renumbered in v5** (v5 inserts §15 "Scroll behaviour") — correct as a v4 citation, wrong if read as v5 |

⚠ The **"Border vocabulary"** and **"Edge polarity tokens"** sections above cite
*wireframe* v4, not the v4 document. Neither the v4 nor the v5 design-system document
mentions amber, "needs your judgement", "outside your control" or the edge tokens
(verified by sweep with a positive control) — **for the canvas border and edge rules this
file is the sole written authority**, which is why both rulings are recorded here.
- `src/styles/brand.css` — CSS custom properties (colour source of truth)
- `tailwind.config.js` — Tailwind colour mappings
- `src/styles/typography.ts` — Typography tokens
- `src/canvas/nodes/colors.ts` — Node colour classes
- `src/canvas/theme/nodes.ts` — Node theme tokens
