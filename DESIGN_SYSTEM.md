# Olumi Design System — Quick Reference

> Full specification: [`docs/Design/Olumi_Design_System_v2_1.md`](docs/Design/Olumi_Design_System_v2_1.md)

## Philosophy

- **Brand-first**: Use brand palette colors, only stray when 100% necessary
- **Two shades per color**: Main (text/icons) + Light (backgrounds)
- **Borders via opacity**: Use main color at 30% opacity — never add extra shade tokens
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

## Color Reference

All colors defined in `src/styles/brand.css`, mapped in `tailwind.config.js`.

### Text Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--text-header` | #262626 | `text-text-header` | Headlines, emphasis |
| `--text-body` | #3F3F3E | `text-text-body` | Body text, paragraphs |
| `--text-light` | #908D8D | `text-text-light` | Muted text, captions |
| `--text-on-color` | #FFFFFF | — | Text on colored backgrounds |

### Surfaces & Backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Hover state backgrounds |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### Semantic Colors

Each color has exactly TWO shades: **main** (text/icons) + **light** (backgrounds). Borders use `border-{color}/30`.

| Color | Main | Light | Usage |
|-------|------|-------|-------|
| **Danger** | #EA7B4B | #FFB393 | Errors, risks, critical |
| **Success** | #67C89E | #B8E2D0 | Positive outcomes, confirmations |
| **Info** | #63ADCF | #BAD7E4 | Informational, decisions, navigation |
| **Warning** | #FFA656 | #FCC798 | Cautions, alerts |

### Node-Specific Colors

| Node Type | Main | Light | Usage |
|-----------|------|-------|-------|
| **Goal** | #F5C433 | #F4DB92 | `bg-goal-light text-goal` |
| **Option** | #AAA7E4 | #DDDCF5 | `bg-option-light text-option` |
| **Factor** | #B0A899 | #EEE6D8 | `bg-factor-light text-factor` |
| **Decision** | (uses Info) | | Decision nodes |
| **Outcome** | (uses Success) | | Outcome nodes |
| **Risk** | (uses Danger) | | Risk nodes |

### Interactive States

Derived from main colors: `hover` (10% darker), `active` (20% darker), `disabled` (40% opacity).

```tsx
className="bg-primary hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
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

These aliases are defined in `brand.css` and `tailwind.config.js` for backward compatibility. They are still **heavily used** across the codebase (60-105 files each for the common ones). New code should use the semantic names.

| Legacy | Semantic Replacement |
|--------|---------------------|
| `ink-900` | `text-header` |
| `paper-50` | `panel` |
| `sand-200` | `panel-border` |
| `sun-500` | `goal` |
| `mint-500` | `success` |
| `sky-500` | `info` |
| `carrot-500` | `danger` |
| `lilac-400` | `option` |

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
| Primary button | `bg-primary hover:bg-primary-hover` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |

## Key Files

- `docs/Design/Olumi_Design_System_v2_1.md` — Full design system specification
- `src/styles/brand.css` — CSS custom properties (colour source of truth)
- `tailwind.config.js` — Tailwind colour mappings
- `src/styles/typography.ts` — Typography tokens
- `src/canvas/nodes/colors.ts` — Node colour classes
- `src/canvas/theme/nodes.ts` — Node theme tokens
