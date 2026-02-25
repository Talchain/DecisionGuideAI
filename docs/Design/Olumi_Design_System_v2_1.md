# Olumi Design System v2.1

**Single source of truth for all UI implementation. Supersedes Design Guidelines v1.2 and Two-Shade System v2.0.**

British English throughout. Sentence case for all UI text. "and" not "&".

---

## 1. Design philosophy

Scientific rigour made approachable. Calm, warm surfaces with purposeful colour that guides users through complex decisions. Coaching over gates — the UI encourages rather than blocks.

**Principles:** Clear (remove complexity, not capability) · Pragmatic (every decision has rationale) · Optimistic (forward-looking) · Human (enhances, not replaces)

---

## 2. Typography

**Font:** Inter (weights 300–700). Single font throughout. Tokens in `src/styles/typography.ts`.

```tsx
import { typography, typo } from '@/styles/typography'
<h2 className={typography.h2}>Heading</h2>
<p className={typo('body', 'text-text-light')}>Muted paragraph</p>
```

### 2.1 General type scale

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

### 2.2 Panel components — strict three-size system

All side panel UI (results, inspector, issues, templates) uses **only three sizes**. Do not introduce other sizes or raw Tailwind font-size/font-weight classes in panel components.

| Token | Size | Usage |
|-------|------|-------|
| `panelHeader` | 14px, semibold | Section titles, winner name, key emphasis |
| `panelBody` | 12px, regular | Body text, descriptions, bullets, card content |
| `panelMeta` | 11px, regular | Badges, pills, axis labels, tertiary metadata |

**Scope:** `src/components/results/`, `src/canvas/panels/`, `src/canvas/ui/EdgeInspector*`, and any component rendered inside a side panel.

**Panel context overrides for shared components:**
- Badges/pills inside panels → `panelMeta` (11px). Outside panels → `label` (14px).
- Buttons inside panels → `panelBody` (12px). Outside panels → `button` (14px).
- Helper/error text inside panels → `panelMeta` (11px). Outside panels → `bodySmall` (14px).

### 2.3 Canvas nodes

| Token | Size | Usage |
|-------|------|-------|
| `nodeTitle` | 13px, semibold | Node titles |
| `nodeLabel` | 11px, regular | Node labels |
| `edgeLabel` | 10px, regular | Edge labels |

### 2.4 Typography rules

- **No raw typography utilities.** Never use `text-xs`, `text-sm`, `text-[11px]`, `font-medium`, `font-semibold`, `font-bold`, or any other font-size/font-weight class directly. Always use semantic tokens from `typography.ts`. Layout utilities (flex, padding, gap, rounded, etc.) are allowed.
- **No font-weight overrides on panel tokens.** Each token defines its own weight. Need semibold at 14px? Use `panelHeader`, not `panelBody font-semibold`.
- **Minimum font size:** 14px for general/marketing UI (accessibility). Panel and canvas contexts use 10–12px for information density — always via tokens, never raw classes.
- **Small font guardrail:** 10–11px (`panelMeta`, `nodeLabel`, `edgeLabel`) is permitted only for non-essential metadata. Any information displayed at 10–11px must also be accessible at 12–14px via tooltip, inspector, or expanded view.
- **Max line length:** 65–75 characters for readability.
- **Sentence case** for all UI labels and headings. Title case only for main navigation items.

---

## 3. Colour system

### 3.1 Three-layer colour model

Olumi uses three distinct colour layers, each with a different job. Colours may be shared across layers, but each layer owns specific CSS properties.

| Layer | Purpose | Owns | Example |
|-------|---------|------|---------|
| **Semantic** | What things mean, what to do | Borders, status indicators, state styling, alerts | Danger border = risk |
| **Entity** | What things are on the canvas | Node backgrounds, fills, type labels | Goal node = yellow fill |
| **Data** | Which data belongs together in charts | Chart fill, chart stroke, legend colours | Series 1, series 2 (ordinal) |

**Precedence rule:** When layers overlap, semantic always wins for borders and state indicators. Entity always wins for fills. A risk node (entity: danger fill) with high confidence (semantic: success border) shows the green solid border on a red-light background.

### 3.2 Two-shade rule

Each colour has exactly TWO shades: **Main** (text/icons) + **Light** (backgrounds). Borders use `border-{colour}/30`. No extra shade tokens.

**Scoped exception:** The data layer (§3.9) defines additional chart-only colours beyond the two-shade system. These are the only sanctioned extra colours and must not be used outside chart/visualisation contexts.

### 3.3 Design ratio

70% neutrals · 20% brand · 10% accents.

All colours defined in `src/styles/brand.css`, mapped in `tailwind.config.js`.

### 3.4 Naming conventions

Every colour has three canonical forms. Always use the full Tailwind class name in code and migration targets.

| CSS variable | Tailwind class | Migration target |
|-------------|----------------|-----------------|
| `--text-header` | `text-text-header` | `text-text-header` |
| `--text-body` | `text-text-body` | `text-text-body` |
| `--bg-canvas` | `bg-canvas` | `bg-canvas` |
| `--danger` | `text-danger` / `bg-danger-light` | `text-danger` |
| `--success` | `text-success` / `bg-success-light` | `text-success` |

When referencing a colour in documentation or code comments, use the Tailwind class form.

### 3.5 Text colours

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--text-header` | #262626 | `text-text-header` | Headlines, emphasis |
| `--text-body` | #3F3F3E | `text-text-body` | Body text, paragraphs |
| `--text-light` | #908D8D | `text-text-light` | Muted text, captions |
| `--text-on-color` | #FFFFFF | — | Text on dark coloured backgrounds (info, success, danger) |

### 3.6 Surfaces and backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Hover/highlight state backgrounds |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### 3.7 Semantic colours (Layer 1)

Owns borders, status indicators, state styling.

| Colour | Main | Light | Tailwind (main / light) | Usage |
|--------|------|-------|-----------------------|-------|
| **Danger** | #EA7B4B | #FFB393 | `text-danger` / `bg-danger-light` | Errors, risks, critical, negative direction |
| **Success** | #67C89E | #B8E2D0 | `text-success` / `bg-success-light` | Positive outcomes, confirmations, positive direction |
| **Info** | #63ADCF | #BAD7E4 | `text-info` / `bg-info-light` | Informational, navigation, indeterminate |
| **Warning** | #FFA656 | #FCC798 | `text-warning` / `bg-warning-light` | Cautions, alerts |

### 3.8 Entity colours (Layer 2)

Owns node backgrounds and fills.

| Node type | Main | Light | Tailwind | Usage |
|-----------|------|-------|----------|-------|
| **Goal** | #F5C433 | #F4DB92 | `text-goal` / `bg-goal-light` | Goal nodes |
| **Option** | #AAA7E4 | #DDDCF5 | `text-option` / `bg-option-light` | Option nodes |
| **Factor** | #B0A899 | #EEE6D8 | `text-factor` / `bg-factor-light` | Factor nodes |
| **Decision** | (uses Info) | | | Decision nodes |
| **Outcome** | (uses Success) | | | Outcome nodes |
| **Risk** | (uses Danger) | | | Risk nodes |

### 3.9 Data colours (Layer 3 — chart-only)

Purely ordinal. No semantic meaning. Scoped exception to the two-shade rule — these tokens must not be used outside chart/visualisation contexts.

**Implementation status:** Only 6 tokens (`chart-1` through `chart-6`) are currently defined as CSS custom properties in `brand.css`. These are CSS var aliases to semantic colours. Tailwind utility classes (`bg-chart-1`, etc.) are not yet mapped — chart components currently use inline styles referencing CSS variables. Tokens `chart-7` and `chart-8` below are planned but not yet implemented.

| Token | CSS var alias | Resolves to | Status | Usage |
|-------|--------------|-------------|--------|-------|
| `chart-1` | `var(--info)` | #63ADCF | Implemented | Primary series |
| `chart-2` | `var(--success)` | #67C89E | Implemented | Secondary series |
| `chart-3` | `var(--goal)` | #F5C433 | Implemented | Highlight series |
| `chart-4` | `var(--option)` | #AAA7E4 | Implemented | Comparison series |
| `chart-5` | `var(--warning)` | #FFA656 | Implemented | Additional series |
| `chart-6` | `var(--danger)` | #EA7B4B | Implemented | Tertiary series |
| `chart-7` | — | — | Planned | Alt series |
| `chart-8` | — | — | Planned | Soft highlight |

**Usage pattern (until Tailwind mapping is implemented):**
```tsx
// Use CSS variables via inline styles
style={{ fill: 'var(--chart-1)' }}

// ❌ Not yet available — do not use
className="bg-chart-1"
```

### 3.10 Primary action colour

Primary maps to Goal yellow. Used for CTAs and primary buttons. **Text on primary backgrounds must use `--text-header` (#262626), not white** — yellow fails WCAG AA contrast with white text.

**Implementation note:** `brand.css` is authoritative for hex values. If this document and `brand.css` disagree, the CSS file wins.

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | #F5C433 | Primary buttons, active progress |
| `--primary-hover` | #E5B523 | Hover state |
| `--primary-active` | #D4A41C | Active/pressed state |
| `--primary-disabled` | rgba(245,196,51,0.40) | Disabled state |

```tsx
className="bg-primary text-text-header hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
```

White text (`--text-on-color`) is reserved for backgrounds that pass AA contrast: info (#63ADCF), success (#67C89E), danger (#EA7B4B).

### 3.11 Interactive states

Derived from main colours: `hover` (10% darker), `active` (20% darker), `disabled` (40% opacity).

### 3.12 Colour rules

✅ Use semantic tokens in components. Test with colour blindness simulators. Provide non-colour indicators (icons, patterns).

❌ Never use pure black (#000000). Never use raw hex values in components. Never rely on colour alone for meaning.

### 3.13 Colour patterns

```tsx
// Standard component: light bg + main text + opacity border
<div className="bg-danger-light text-danger border border-danger/30 rounded-md px-3 py-2">
  Error message
</div>

// ✅ Correct border — use opacity
className="border border-info/30"

// ❌ Wrong — extra shade tokens don't exist
className="border-danger-200"  // DOESN'T EXIST
```

### 3.14 Legacy aliases (migration in progress)

Defined in `brand.css` and `tailwind.config.js` for backward compatibility. Still heavily used (60–105 files each). **New code MUST use semantic names. When touching a file that uses legacy tokens, migrate those references.**

| Legacy | Semantic replacement (full Tailwind class) |
|--------|---------------------------------------------|
| `ink-900` | `text-text-header` |
| `paper-50` | `bg-panel` |
| `sand-200` | `border-panel-border` |
| `sun-500` | `text-goal` / `bg-primary` |
| `mint-500` | `text-success` |
| `sky-500` | `text-info` |
| `carrot-500` | `text-danger` |
| `lilac-400` | `text-option` |

---

## 4. Layout and spacing

### 4.1 Spacing scale

```
4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px · 56px · 64px
```

### 4.2 Grid

12 columns · max width 1200–1280px · gutters 24px · margins: 16px (mobile) · 24px (tablet) · 32px (desktop).

### 4.3 Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Wide screens |

### 4.4 Surface hierarchy

1. **Canvas** — `bg-canvas` (#F4F0EA)
2. **Panels/cards** — `bg-panel` (#FEFEFE)
3. **Interactive hover** — `bg-panel-hover` (#FEF9F3)
4. **Overlays** — `bg-panel` + `shadow-3`

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-1` | `0 1px 2px rgba(38,38,38,0.06)` | Cards, resting panels |
| `shadow-2` | `0 4px 12px rgba(38,38,38,0.10)` | Hover elevation, dropdowns |
| `shadow-3` | `0 8px 24px rgba(38,38,38,0.14)` | Modals, overlays |

Warm-tinted (ink-900 rgba, not pure black).

**Note:** There is no `shadow-0` token defined in CSS or Tailwind config. For flat/unshadowed elements, simply omit the shadow class — do not reference `shadow-0` in code.

---

## 6. Borders

### 6.1 Border widths

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| `default` | 1px | `border` | Standard borders, dividers |
| `state` | 2px | `border-2` | Selected states, focus indicators |
| `emphasis` | 3px | `border-[3px]` | Block type indicators, coaching cards, winner accents |

### 6.2 Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Inputs, small buttons |
| `md` | 12px | Cards, modals |
| `lg` | 20px | Large cards, panels |
| `pill` | 999px | Pills, round buttons |

### 6.3 Focus ring

| Property | Value |
|----------|-------|
| Width | 2px |
| Offset | 2px |
| Colour | `info` (#63ADCF) |
| Tailwind | `focus:ring-2 focus:ring-offset-2 focus:ring-info` |

Never remove outline. Focus indicators must always be visible.

---

## 7. Motion

### 7.1 Timing

| Token | Duration | Usage |
|-------|----------|-------|
| `--duration-instant` | 100ms | Hover states, micro-feedback |
| `--duration-fast` | 200ms | Micro-interactions, fade-outs |
| `--duration-base` | 300ms | Panel transitions, skeleton pulses |
| `--duration-slow` | 400ms | Page transitions |

### 7.2 Easing

```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);   /* Default */
--ease-out:    cubic-bezier(0.0, 0, 0.2, 1);     /* Enter */
--ease-in:     cubic-bezier(0.4, 0, 1, 1);       /* Exit */
```

### 7.3 Interaction patterns

- **Hover:** shadow-1 → shadow-2 + translateY(-2px)
- **Click:** scale(0.98) for 100ms
- **Focus:** visible ring (§6.3), never remove outline
- **Accepted:** brief green flash + check icon → collapse to summary (300ms)
- **Dismissed:** fade out (200ms) → remove

### 7.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Components

### 8.1 Buttons

**Primary:**
```css
background: var(--primary);         /* #F5C433 */
color: var(--text-header);          /* #262626 — NOT white */
padding: 12px 24px;
border-radius: 999px;
font-weight: 600;
box-shadow: var(--shadow-1);
```
States: hover → `--primary-hover` + translateY(-1px). Active → `--primary-active` + translateY(0). Disabled → `--primary-disabled` + no shadow. Focus → §6.3 ring.

**Secondary:**
```css
background: transparent;
border: 1px solid rgba(38,38,38,0.16);
color: var(--text-body);
```

**Destructive:** `bg-danger`, white text (`--text-on-color`). Same state pattern as primary.

### 8.2 Input fields

```css
min-height: 44px;
padding: 12px 16px;
background: var(--bg-panel);
border: 1px solid rgba(38,38,38,0.16);
border-radius: 12px;
```
States: focus → §6.3 ring. Error → border `danger` + helper text `text-danger`. Disabled → opacity 0.5. Success → border `success`.

### 8.3 Form field anatomy

```
[Label]           → panelHeader (14px) in panels, label (14px) outside
  4px gap
[Input]           → min-height 44px
  4px gap
[Helper/error]    → panelMeta (11px) in panels, bodySmall (14px) outside
```

Error helper: prefix with inline icon (⚠) + `text-danger`. Success helper: prefix with ✓ + `text-success`. Inline validation: show on blur, clear on focus.

### 8.4 Cards

```css
background: var(--bg-panel);
border-radius: 20px;
padding: 24px;
box-shadow: var(--shadow-1);
```
Variants: interactive (hover → shadow-2 + translateY(-2px)). Selected (2px border `info`). Analysis (3px top border in semantic colour).

### 8.5 Badges and pills

```css
padding: 4px 12px;
border-radius: 999px;
font-weight: 500;
```

| Context | Font size | Token |
|---------|-----------|-------|
| Default (outside panels) | 14px | `label` |
| Inside panels | 11px | `panelMeta` |

Semantic variants: success (bg success-light, text success), info (bg info-light, text info), warning (bg warning-light, text warning), danger (bg danger-light, text danger).

### 8.6 Links

| Property | Value |
|----------|-------|
| Colour | `text-info` (#63ADCF) |
| Default underline | None |
| Hover | Underline |
| Focus | §6.3 ring |
| Visited | Same as default (no visited state — Olumi is a SPA) |

In panels, links use `panelBody` (12px) size. Outside panels, links inherit parent font size.

### 8.7 Navigation

**App bar:** 64px height, `bg-panel`, logo left, actions right. Active item: 2px underline `info`.

**Tabs:** 44px height. Selected: pill background `rgba(99,173,207,0.15)`. Transition 200ms.

---

## 9. Confidence as visual language

Confidence is communicated through a context-dependent combination of cues — border style, colour, icon badge, and confidence bar — ensuring robustness in greyscale, print, and low-contrast conditions.

### 9.1 Confidence levels

| Level | Range | Colour | Icon badge |
|-------|-------|--------|------------|
| High | 70–100% | Success (#67C89E) | ✓ (check) |
| Medium | 40–69% | Info (#63ADCF) | ~ (tilde) |
| Low | 0–39% | Factor (#B0A899) | ? (question) |

### 9.2 Context-dependent rendering

Different UI contexts use different combinations of confidence cues. The full three-cue treatment (border style + colour + icon badge) is reserved for contexts with sufficient visual space.

| Context | Cues used | Example |
|---------|-----------|---------|
| **Canvas nodes** | Border style + colour + icon badge | Solid green border with ✓ badge on a factor node |
| **Full-width cards** (e.g. review cards, evidence blocks) | Border style + colour + icon badge | Dashed blue top border with ~ badge |
| **Panel driver rows** | Confidence bar + icon badge only | Filled bar at 75% width, green, with ✓ |
| **Compact lists** (e.g. factor summaries) | Colour + icon badge only | Green ✓ inline |

**Rationale:** Dotted/dashed borders require minimum 3px width to remain visible on light backgrounds, which creates visual heaviness in compact panel contexts. Confidence bars communicate the same information more efficiently at small scale.

### 9.3 Border style mapping (canvas and full-width cards only)

| Level | Border style | Tailwind border |
|-------|-------------|----------------|
| High | Solid | `border-success border-solid` |
| Medium | Dashed | `border-info border-dashed` |
| Low | Dotted | `border-factor border-dotted` |

Low-confidence dotted borders use a minimum `border-[3px]` width to remain visible.

### 9.4 Icon badge pattern

```tsx
<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center bg-success text-white"
  style={{ fontSize: 10, fontWeight: 700 }}>
  ✓
</div>
```

### 9.5 Confidence bar pattern (panels)

```tsx
<div className="flex items-center gap-2">
  <div className="flex-1 h-1.5 rounded-full bg-panel-border overflow-hidden">
    <div
      className="h-full rounded-full bg-success"
      style={{ width: `${confidence}%` }}
    />
  </div>
  <span className="text-success" style={{ fontSize: 10, fontWeight: 700 }}>✓</span>
</div>
```

---

## 10. Decision states

| State | Border | Background | Icon |
|-------|--------|------------|------|
| Draft | 2px `factor` (#B0A899) | `bg-panel` | Pencil |
| Active | 2px `info` (#63ADCF) | `bg-info-light` | Play |
| Complete | 2px `success` (#67C89E) | `bg-success-light` | Check |
| Blocked | 2px `danger` (#EA7B4B) | `bg-danger-light` | Alert |

---

## 11. Progress indicators

```css
/* Track */
background: rgba(38,38,38,0.10);
height: 8px;
border-radius: 4px;

/* Bar */
background: var(--primary);    /* #F5C433 */
transition: width 300ms ease-out;
```

---

## 12. Data visualisation

### 12.1 Chart colour sequence

Uses data layer tokens (§3.9). Ordinal only — no semantic meaning in charts.

### 12.2 Semantic chart elements

Tornado charts and directional indicators use semantic layer colours:
- **Positive direction:** success-light (#B8E2D0) fill, success (#67C89E) border
- **Negative direction:** danger-light (#FFB393) fill, danger (#EA7B4B) border
- **Uncertainty bands:** info-light (#BAD7E4) at 30% opacity
- **Target lines:** dashed, primary (#F5C433)
- **Threshold lines:** dotted, danger (#EA7B4B)
- **Gridlines:** panel-border (#EEE6D8) at 50% opacity
- **Axis labels:** `text-text-light` (#908D8D), `panelMeta` size (11px)

### 12.3 Chart accessibility

Never rely on colour alone. Add patterns for critical distinctions. Include data labels on hover/tap. Provide table view alternative.

---

## 13. Coaching card pattern

Distinct from error/warning. Used when the system suggests improvements. Feels encouraging, not blocking.

```tsx
<div className="bg-info-light border-l-[3px] border-info rounded-lg px-4 py-3">
  <div className="flex items-center gap-2 mb-1">
    <LightbulbIcon className="text-info w-4 h-4" />
    <span className={typography.panelHeader + " text-info"}>Strengthen your model</span>
  </div>
  <p className={typography.panelBody + " text-text-body"}>
    Adding a time horizon to your goal would help the simulation produce more actionable results.
  </p>
</div>
```

**Key differences from alerts:** left border (not top), `info-light` background (not danger/warning), lightbulb icon (not alert triangle), encouraging copy ("strengthen" not "fix").

Use for: model improvement suggestions, evidence gaps, missing factors, assumption challenges. Part of the ReviewCardBlock rendering in the Orchestrator (see §13.1 for variant selection).

### 13.1 ReviewCardBlock variant selection

ReviewCardBlock in the Orchestrator conversation panel renders in two distinct visual treatments depending on the nature of the review item:

| Variant | When to use | Border | Background | Icon | Tone |
|---------|-------------|--------|------------|------|------|
| **Alert** (default) | Risks, critical issues, validation failures, items requiring immediate attention | Top 3px `danger` | `bg-panel` | Alert triangle | Direct: "This needs attention" |
| **Coaching** | Model improvement suggestions, evidence gaps, assumption challenges, optional enhancements | Left 3px `info` | `bg-info-light` | Lightbulb | Encouraging: "Consider strengthening…" |

**Selection rule:** If the review item is blocking or identifies a risk, use the alert variant. If the review item is a suggestion or improvement opportunity, use the coaching variant. The Orchestrator's `review_card_type` field (when present) determines the variant; if absent, default to alert.

---

## 14. Empty and zero states

When a panel or section has no data, guide the user forward.

**Pattern:**
```tsx
<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
  <IconComponent className="text-text-light w-10 h-10 mb-3" />
  <p className={typography.body + " text-text-body mb-1"}>{headline}</p>
  <p className={typography.bodySmall + " text-text-light mb-4"}>{guidance}</p>
  <Button variant="secondary" size="sm">{cta}</Button>
</div>
```

**Tone:** encouraging, never blame the user. Use "yet" to imply progress. Two lines of text maximum.

| Location | Headline | Guidance |
|----------|----------|----------|
| Results panel | No results yet | Run your first simulation to see how your options compare. |
| Canvas (no nodes) | Start building your model | Describe your decision and the AI will help you structure it. |
| Sensitivity tab | No sensitivity data | Run a simulation first to see which factors matter most. |
| Factor inspector | No evidence attached | Add evidence to strengthen this factor's credibility. |
| Baseline not set | No baseline set | Set a baseline to track how your decision progresses. |

---

## 15. Loading and skeleton patterns

**Skeleton colours:** pulse between `bg-panel-hover` (#FEF9F3) and `border-panel-border` (#EEE6D8). Duration: 300ms (`--duration-base`).

```tsx
// Skeleton line
<div className="h-3 rounded bg-panel-border animate-pulse" style={{ width: '75%' }} />

// Skeleton card
<div className="bg-panel rounded-lg p-4 shadow-1">
  <div className="h-4 rounded bg-panel-border animate-pulse mb-3 w-1/3" />
  <div className="h-3 rounded bg-panel-border animate-pulse mb-2 w-full" />
  <div className="h-3 rounded bg-panel-border animate-pulse w-2/3" />
</div>
```

**Simulation loading:**
```tsx
<div className="flex items-center gap-3 py-4 px-4 bg-info-light rounded-lg">
  <Spinner className="text-info w-4 h-4" />
  <span className={typography.panelBody + " text-text-body"}>
    Running 1,000 simulations…
  </span>
</div>
```

---

## 16. Progressive disclosure

Complexity revealed on demand, not imposed.

**Levels:**
1. **Headline** — always visible. Plain language, one line.
2. **Explanation** — expandable. What this means in context.
3. **Methodology** — on request. Technical detail.

**Implementation:**
```tsx
<div>
  <p className={typography.panelBody}>{headline}</p>
  <button className="text-info mt-1" onClick={toggleExpand}>
    {expanded ? 'Show less' : 'Learn more'}
  </button>
  {expanded && (
    <div className="mt-2 pl-3 border-l-2 border-panel-border">
      <p className={typography.panelBody + " text-text-light"}>{explanation}</p>
    </div>
  )}
</div>
```

---

## 17. Conversational UI patterns

*Implementation status: target architecture. The Orchestrator conversation panel is being built via Track D (A.5 → A.6 → A.7). Block components described here are the implementation target; the current codebase uses a monolithic DraftChat component. See Conversational Orchestrator v3 for the full interaction specification.*

The Orchestrator conversation panel is Olumi's primary interaction surface.

### 17.1 Message styling

| Element | Styling |
|---------|---------|
| **User message** | `bg-panel rounded-lg shadow-1` right-aligned, `text-text-body` |
| **AI text** | No background (inline on canvas bg), `text-text-body`, left-aligned |
| **AI block** | Card with type-specific top border (§17.2) |
| **System event** | Centred, `text-text-light`, `panelMeta` size, no background |

### 17.2 Block rendering

Base block:
```css
background: var(--bg-panel);
border-radius: 20px;
padding: 24px;
box-shadow: var(--shadow-1);
```

Type-specific top borders (3px):

| Block type | Border colour | Badge | Rationale |
|-----------|--------------|-------|-----------|
| FramingBlock | `info` (#63ADCF) | `info` | Information/structuring |
| GraphPatchBlock | `goal` (#F5C433) | `goal` | Action required |
| FactBlock | `success` (#67C89E) | `success` | Computed results |
| CommentaryBlock | None (inline) | None | Explanation, no action |
| ReviewCardBlock | `danger` (#EA7B4B) or `info` (#63ADCF) | `danger` or `info` | Alert variant (top border, danger) or coaching variant (left border, info) — see §13.1 |
| ScenarioBlock | `option` (#AAA7E4) | `option` | Comparison |
| BriefBlock | `success` (#67C89E) | `success` | Deliverable |
| EvidenceBlock | `info` (#63ADCF) | `info` | External information |

**Block actions:** Accept → primary button (`bg-primary text-text-header`). Edit → secondary button. Dismiss → text link (`text-text-light`).

**Block states:** proposed → actions visible. Accepted → green flash + check → collapse (300ms). Dismissed → fade out (200ms) → removed. Rejected → danger border + AI explanation.

### 17.3 Typing and tool execution

```tsx
// AI thinking — three pulsing dots
<div className="flex items-center gap-2 py-2">
  <ThinkingDots className="text-info" />
</div>

// Tool execution
<div className="flex items-center gap-2 py-2 text-text-light">
  <Spinner className="w-3 h-3" />
  <span className={typography.panelMeta}>Running 1,000 simulations…</span>
</div>
```

### 17.4 Suggested action chips

Max 2 per AI response. Below the response.

```tsx
<div className="flex gap-2 mt-2">
  <button className="px-3 py-1.5 rounded-full border border-panel-border
    text-text-body bg-panel hover:bg-panel-hover">
    {suggestion}
  </button>
</div>
```

Chips use `panelBody` (12px) inside panels, `bodySmall` (14px) outside.

---

## 18. Accessibility

### 18.1 Requirements

- **WCAG AA** minimum contrast (4.5:1 text, 3:1 UI elements)
- **Touch targets:** minimum 44×44px
- **Focus indicators:** always visible (§6.3)
- **Screen reader:** semantic HTML + ARIA labels
- **Keyboard:** full navigation, focus traps in modals
- **Reduced motion:** respect `prefers-reduced-motion` (§7.4)

### 18.2 Developer checklist

- [ ] No raw hex values in CSS/TSX
- [ ] No raw font-size/font-weight utilities
- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus trap in modals/overlays
- [ ] Animations respect reduced motion
- [ ] Loading states implemented
- [ ] Error boundaries in place
- [ ] Colour is not sole information channel
- [ ] All 10–11px text has 12–14px accessible equivalent

---

## 19. Quick reference

### 19.1 Colour quick reference

| Need | Tailwind class |
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

### 19.2 Component sizing

| Size | Button padding | Input height | Card padding |
|------|---------------|-------------|-------------|
| sm | 8px 16px | 36px | 16px |
| md | 12px 24px | 44px | 24px |
| lg | 16px 32px | 52px | 32px |

### 19.3 Z-index scale

| Layer | Value |
|-------|-------|
| base | 0 |
| dropdown | 100 |
| sticky | 200 |
| modal | 300 |
| popover | 400 |
| toast | 500 |

---

## 20. Key files

| File | Purpose |
|------|---------|
| `src/styles/brand.css` | CSS custom properties (colour source of truth) |
| `tailwind.config.js` | Tailwind colour mappings + border width extensions |
| `src/styles/typography.ts` | Typography tokens |
| `src/canvas/nodes/colors.ts` | Node colour classes |
| `src/canvas/theme/nodes.ts` | Node theme tokens |

---

## 21. Voice and tone

British English throughout. Conversational but professional. Encouraging without being patronising. Data-driven but accessible.

**Coaching tone examples:**
- ✅ "Adding a time horizon would strengthen this goal."
- ✅ "Your model could benefit from more evidence on market growth."
- ❌ "Error: goal missing time horizon."
- ❌ "WARNING: insufficient evidence."

---

*This is a living document. When conflicts arise with other documentation, this file takes precedence for all UI implementation decisions. When conflicts arise with `brand.css` for colour values, `brand.css` is authoritative.*
