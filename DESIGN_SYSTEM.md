# Olumi Design System — Quick Reference

> Full specification: [`docs/design/Olumi_Design_System_v4.md`](docs/design/Olumi_Design_System_v4.md)

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
- **Tier 3 — Status** (always visible, replaces text labels): `CheckCircle`, `AlertTriangle`, `Info`

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
| **Info** | #2B7FA2 | #BAD7E4 | Informational, decisions, navigation |
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
- **Amber border = "needs your judgement"** (a controllable node missing its
  value; the goal missing its target).

External factors NEVER get amber, even with no value (pinned in
`FactorNode.spec.tsx`). New states must reuse this vocabulary, not invent a
third border treatment.

> **Open question (flagged 2026-07-16, Paul to rule):** amber-on-incomplete
> replaces the kind hue on the border, and amber `#FFA656` sits one perceptual
> step from the risk border `#EA7B4B` — the same ΔE neighbourhood the E1 edge
> work deliberately moved away from. An alternative (kind-hue border + amber
> badge for needs-judgement) would preserve the kind channel; changing it
> means re-ruling wireframe v4, so it is recorded here rather than changed.

### Edge polarity tokens

Causal-edge colours are tokens, not literals: `--edge-positive` /
`--edge-negative` / `--edge-neutral` (+ `-dark` variants) in `brand.css`,
with the full CVD/ΔE rationale attached to the tokens. `directionStroke.ts`
owns the *rule* (which state gets which token); the token file owns the hues.
Truly uninitialised edges use `--goal` yellow; amber stays reserved for the
warning/fragility family.

### Edge-label signals

Three DISTINCT signals may appear on or near an edge — each has one owner and
one format; never invent a fourth or blend them:

| Signal | Format | Owner |
|--------|--------|-------|
| Weight label | "Strong boost" / "Moderate drag (uncertain)" — or numeric via the mode toggle | `domain/edgeLabels.ts` grammar |
| Fragility badge | "Sensitive · NN%" warning pill (analysis result) | robustness surface |
| Existence confidence | "NN% conf." (hover panel row, with title/aria disclosure) | `ConnRow` |

Labels render in `typography.edgeLabel`; stacking is spaced by
`edgeLabelCollision.ts`. Known density issue: several options converging on
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

```tsx
// ✅ Correct — neutral bg, coloured left border
<div className="bg-panel border-l-[3px] border-info rounded-lg px-4 py-3">

// ❌ Wrong — coloured background
<div className="bg-info-light border-l-[3px] border-info rounded-lg px-4 py-3">
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
| Engine cannot see the model | Draft or save a model first, then run analysis. | `CEE_DRAFT_FIRST_REFUSAL` |
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

- `docs/design/Olumi_Design_System_v4.md` — Full design system specification
- `src/styles/brand.css` — CSS custom properties (colour source of truth)
- `tailwind.config.js` — Tailwind colour mappings
- `src/styles/typography.ts` — Typography tokens
- `src/canvas/nodes/colors.ts` — Node colour classes
- `src/canvas/theme/nodes.ts` — Node theme tokens
