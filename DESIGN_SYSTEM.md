# Olumi Design System — Quick Reference

> Full specification: [`docs/Design/Olumi_Design_System_v3.md`](docs/Design/Olumi_Design_System_v3.md)

## Philosophy

- **Three-channel visual system:** Shapes (nouns) = what something is · Colour (adjectives) = how it's doing · Icons (verbs) = what you can do. No channel should duplicate another.
- **Two shades per colour**: Main (text/icons) + Light (backgrounds)
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
| `--text-on-color` | #FFFFFF | — | Text on coloured backgrounds |

### Surfaces & Backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Hover state backgrounds |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### Semantic Colours

Each colour has exactly TWO shades: **main** (text/icons) + **light** (backgrounds). Borders use `border-{colour}/30`.

| Colour | Main | Light | Usage |
|--------|------|-------|-------|
| **Danger** | #EA7B4B | #FFB393 | Errors, risks, critical |
| **Success** | #67C89E | #B8E2D0 | Positive outcomes, confirmations |
| **Info** | #63ADCF | #BAD7E4 | Informational, decisions, navigation |
| **Warning** | #FFA656 | #FCC798 | Cautions, alerts |

### Node-Specific Colours

| Node Type | Main | Light | Usage |
|-----------|------|-------|-------|
| **Goal** | #F5C433 | #F4DB92 | `bg-goal-light text-goal` |
| **Option** | #AAA7E4 | #DDDCF5 | `bg-option-light text-option` |
| **Factor** | #B0A899 | #EEE6D8 | `bg-factor-light text-factor` |
| **Decision** | (uses Info) | | Decision nodes |
| **Outcome** | (uses Success) | | Outcome nodes |
| **Risk** | (uses Danger) | | Risk nodes |

### Interactive States

Derived from main colours: `hover` (10% darker), `active` (20% darker), `disabled` (40% opacity).

```tsx
className="bg-primary text-text-header hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
```

## Patterns

```tsx
// Standard component pattern: light bg + main text + opacity border
<div className="bg-danger-light text-danger border border-danger/30 rounded-md px-3 py-2">
  Error message
</div>

// ✅ Correct border — use opacity
className="border border-info/30"

// ❌ Wrong — extra shade tokens don't exist
className="border-danger-200"  // DOESN'T EXIST
```

## Legacy Aliases (Migration In Progress)

These aliases are defined in `brand.css` and `tailwind.config.js` for backward compatibility. **New code MUST use semantic names. When touching a file that uses legacy tokens, migrate those references.**

| Legacy | Semantic Replacement (full Tailwind class) |
|--------|---------------------------------------------|
| `ink-900` | `text-text-header` |
| `paper-50` | `bg-panel` |
| `sand-200` | `border-panel-border` |
| `sun-500` | `text-goal` / `bg-primary` |
| `mint-500` | `text-success` |
| `sky-500` | `text-info` |
| `carrot-500` | `text-danger` |
| `lilac-400` | `text-option` |

## Quick Reference

| Need | Tailwind Class |
|------|----------------|
| Error text | `text-danger` |
| Error background | `bg-danger-light` |
| Error border | `border-danger/30` |
| Success text | `text-success` |
| Success background | `bg-success-light` |
| Warning text | `text-warning` |
| Warning background | `bg-warning-light` |
| Info text | `text-info` |
| Info background | `bg-info-light` |
| Primary button | `bg-primary text-text-header hover:bg-primary-hover` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |

## Developer Checklist

Before shipping any UI work:

- [ ] No raw hex values in CSS/TSX
- [ ] No raw font-size/font-weight utilities (use tokens)
- [ ] No emoji — use Lucide icons
- [ ] ARIA labels on all interactive elements (especially icon-only buttons)
- [ ] Tooltips on all icon-only buttons (mandatory)
- [ ] Colour is not the sole information channel
- [ ] All 10–11px text accessible at 12–14px via tooltip/expand
- [ ] Focus ring present on all interactive elements (`focus:ring-2 focus:ring-offset-2 focus:ring-info`)

## Key Files

- `docs/Design/Olumi_Design_System_v3.md` — Full design system specification
- `src/styles/brand.css` — CSS custom properties (colour source of truth)
- `tailwind.config.js` — Tailwind colour mappings
- `src/styles/typography.ts` — Typography tokens
- `src/canvas/nodes/colors.ts` — Node colour classes
- `src/canvas/theme/nodes.ts` — Node theme tokens
