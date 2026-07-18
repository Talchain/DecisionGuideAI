# Olumi Design System v5

**Single source of truth for all UI implementation. Supersedes all previous versions.**

British English throughout. Sentence case for all UI text. "and" not "&". No em dashes — use commas, colons, full stops, or restructured sentences.

---

## 1. Design philosophy

Scientific rigour made approachable. Calm, warm surfaces with purposeful colour that guides users through complex decisions. Coaching over gates: the UI encourages rather than blocks.

**Principles:** Clear (remove complexity, not capability) · Pragmatic (every decision has rationale) · Optimistic (forward-looking) · Human (enhances, not replaces)

**Three-channel visual system:** Olumi communicates through three non-overlapping visual channels. Each channel has a distinct job. When they overlap, information is wasted.

| Channel | Communicates | Example |
|---------|-------------|---------|
| **Shapes** (nouns) | What something is | Diamond = goal node |
| **Colour** (adjectives) | How it's doing | Green border = high confidence |
| **Icons** (verbs) | What you can do | Pencil = edit this |

No channel should duplicate another. A goal node uses a diamond shape and yellow fill. It does not also need a Target icon on the canvas, because the shape already identifies it.

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

### 2.2 Panel components: strict three-size system

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
- **Minimum font size:** 14px for general/marketing UI (accessibility). Panel and canvas contexts use 10–12px for information density, always via tokens, never raw classes.
- **Small font guardrail:** 10–11px (`panelMeta`, `nodeLabel`, `edgeLabel`) is permitted only for non-essential metadata. Any information displayed at 10–11px must also be accessible at 12–14px via tooltip, inspector, or expanded view.
- **Max line length:** 65–75 characters for readability.
- **Sentence case** for all UI labels, headings, and section headers. Never all caps. Title case only for main navigation items.

---

## 3. Colour system

### 3.1 Three-layer colour model

| Layer | Purpose | Owns | Example |
|-------|---------|------|---------|
| **Semantic** | What things mean, what to do | Borders, status indicators, state styling, alerts | Danger border = risk |
| **Entity** | What things are on the canvas | Node fills, type labels | Goal node = yellow fill |
| **Data** | Which data belongs together in charts | Chart fill, chart stroke, legend colours | Series 1, series 2 (ordinal) |

**Precedence rule:** When layers overlap, semantic always wins for borders and state indicators. Entity always wins for fills.

### 3.2 Two-shade rule: main and light

Each colour has exactly TWO shades: **Main** and **Light**. These have strict, non-interchangeable roles.

**Main shades are foreground:** text, icons, borders, accents. They carry meaning and must be legible.

**Light shades are restricted to two uses only:**
1. **Canvas node fills:** large-surface identification of node type
2. **Panel entity-hover states:** when hovering a panel row/card, the entity-light colour tints the background to connect the item to its canvas node type

Light shades are **never** used as backgrounds for cards, banners, coaching cards, pills, accordion headers, or any small container. All component backgrounds use `bg-panel` or `bg-transparent`.

| Element | Shade | Example |
|---------|-------|---------|
| Text on white/panel surfaces | Main | `text-danger` on `bg-panel` |
| Icons | Main | `text-info` icon on neutral background |
| Borders, accents, dots | Main | `border-success` accent |
| Canvas node fills | Light | `bg-factor-light` fill on factor node |
| Panel hover (entity-linked items) | Light | `bg-option-light` on hover over option row |
| Card/section backgrounds | Neutral only | `bg-panel`, never `bg-{colour}-light` |
| Accordion header backgrounds | Neutral only | `bg-panel`, never `bg-sand-50` or `bg-{colour}-light` |
| Pill backgrounds | None | `bg-transparent`, border carries colour signal |
| Button backgrounds | Main (exception) | `bg-primary` with `text-on-color` |

**Priority rule for hover:** If an element already has a semantic border (confidence, error, warning), hover uses neutral `bg-panel-hover`. Entity-light hover only applies when there's no competing semantic colour.

**Implementation check: ask three questions:**
1. Is this foreground (text, icon, border, accent)? → Main shade
2. Is this a canvas node fill or panel entity-hover? → Light shade
3. Is this any other background? → `bg-panel` or `bg-transparent`

**Scoped exception:** The data layer (§3.9) defines additional chart-only colours. Chart fills may use light shades for bar/area fills where the main shade provides the border.

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
| `--danger` | `text-danger` / `border-danger` | `text-danger` |
| `--success` | `text-success` / `border-success` | `text-success` |

When referencing a colour in documentation or code comments, use the Tailwind class form.

### 3.5 Text colours

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--text-header` | #262626 | `text-text-header` | Headlines, emphasis |
| `--text-body` | #3F3F3E | `text-text-body` | Body text, paragraphs |
| `--text-light` | #908D8D | `text-text-light` | Muted text, captions |
| `--text-on-color` | #FFFFFF | — | Text on button backgrounds (primary, destructive, status) |

### 3.6 Surfaces and backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node/banner/accordion header backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Default hover state (when no entity hover applies) |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### 3.7 Semantic colours (Layer 1)

| Colour | Main | Light | Main usage | Light usage |
|--------|------|-------|------------|-------------|
| **Danger** | #EA7B4B | #FFB393 | Error text, risk borders, alert icons | Risk node canvas fill, panel hover |
| **Success** | #67C89E | #B8E2D0 | Positive text, confirmation icons, success borders | Outcome node canvas fill, panel hover |
| **Info** | #2B7FA2 | #BAD7E4 | Links, nav text, info borders, primary buttons | Decision node canvas fill, panel hover |
| **Warning** | #FFA656 | #FCC798 | Warning text, caution icons, warning borders | Panel hover only |

### 3.8 Entity colours (Layer 2)

| Node type | Main | Light | Main usage | Light usage |
|-----------|------|-------|------------|-------------|
| **Goal** | #F5C433 | #F4DB92 | Goal text, goal borders, progress bars | Goal node canvas fill, panel hover |
| **Option** | #AAA7E4 | #DDDCF5 | Option text, option borders | Option node canvas fill, panel hover |
| **Factor** | #B0A899 | #EEE6D8 | Factor text, factor borders, muted labels | Factor node canvas fill, panel hover |
| **Decision** | (uses Info) | | | |
| **Outcome** | (uses Success) | | | |
| **Risk** | (uses Danger) | | | |

### 3.9 Data colours (Layer 3: chart-only)

Purely ordinal. No semantic meaning. Chart fills may use light shades for bar/area fills with main shade borders.

**Implementation status:** Only 6 tokens (`chart-1` through `chart-6`) are currently defined in `brand.css` as CSS var aliases. Tailwind utility classes are not yet mapped. Tokens `chart-7` and `chart-8` are planned.

| Token | Alias / Hex | Status |
|-------|-------------|--------|
| `chart-1` | → `--info` (#2B7FA2) | ✅ Implemented |
| `chart-2` | → `--success` (#67C89E) | ✅ Implemented |
| `chart-3` | → `--goal` (#F5C433) | ✅ Implemented |
| `chart-4` | → `--option` (#AAA7E4) | ✅ Implemented |
| `chart-5` | #5C9BB8 | ✅ Implemented |
| `chart-6` | #C9D9FF | ✅ Implemented |
| `chart-7` | #62B28F | 🔲 Planned |
| `chart-8` | #FFE497 | 🔲 Planned |

### 3.10 Primary action colour

Primary maps to Info blue. Used for CTAs and all interactive buttons. **Text on primary backgrounds uses `--text-on-color` (#FFFFFF).**

Goal yellow (#F5C433) remains the brand/entity colour for goal nodes and progress bars only.

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | #2B7FA2 | Primary buttons, CTAs |
| `--primary-hover` | #67C89E | Hover state (success green: "ready to act") |
| `--primary-active` | #5AA88A | Active/pressed state (darker green) |
| `--primary-disabled` | rgba(43,127,162,0.40) | Disabled state |

```tsx
className="bg-primary text-on-color hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
```

### 3.11 Interactive states

Derived from main colours: `hover` (10% darker), `active` (20% darker), `disabled` (40% opacity).

**Exception:** Primary buttons transition from info blue to success green on hover, a colour shift rather than a darkness shift. This reinforces the "ready to act" signal. The transition uses `--duration-fast` (200ms) with `--ease-in-out`.

### 3.12 Colour rules

✅ Use semantic tokens in components. Test with colour blindness simulators. Provide non-colour indicators (icons per §9, shapes per §10, patterns).

❌ Never use pure black (#000000). Never use raw hex values in components. Never rely on colour alone for meaning. Never use `bg-{colour}-light` on cards, banners, accordion headers, or pills (§3.2). Never use legacy tokens (`sand-200`, `ink-800`, `bg-sand-50`, `bg-slate-100`) in new code (§3.14).

### 3.13 Colour application patterns

```tsx
// Standard component: neutral bg + coloured border + dark text
<div className="bg-panel text-text-body border border-danger/30 rounded-lg px-3 py-2">
  <span className="text-danger">Error message</span>
</div>

// ❌ Wrong: no coloured backgrounds on components
className="bg-danger-light text-danger"  // PROHIBITED outside canvas nodes

// ❌ Wrong: extra shade tokens don't exist
className="border-danger-200"  // DOESN'T EXIST
```

### 3.14 Legacy aliases (migration in progress)

**New code MUST use semantic names. When touching a file that uses legacy tokens, migrate those references.**

| Legacy | Semantic replacement |
|--------|---------------------------------------------|
| `ink-900`, `ink-800` | `text-text-header` |
| `paper-50` | `bg-panel` |
| `sand-200`, `sand-50` | `border-panel-border`, `bg-panel` |
| `slate-100`, `slate-700` | `bg-panel`, `text-text-body` |
| `sun-500` | `text-goal` / `bg-goal` |
| `mint-500` | `text-success` |
| `sky-500`, `sky-200`, `sky-600` | `text-info` |
| `carrot-500` | `text-danger` |
| `lilac-400` | `text-option` |
| `bg-warning-100` | Do not use. Use `border-warning/30` on `bg-panel` |

### 3.15 Tailwind opacity modifier safety

Tailwind opacity modifiers (e.g. `border-info/30`, `bg-info/[0.04]`) require the underlying colour to be defined as space-separated RGB channels, not hex. When CSS variables resolve to hex values, these modifiers fail silently and produce no visible output.

**Safe patterns:**

```tsx
// ✅ Safe: opacity modifier works if colour is defined as RGB channels in tailwind.config.js
className="border border-info/30"

// ✅ Safe: inline style for alpha when unsure about token format
style={{ borderColor: 'rgba(99, 173, 207, 0.3)' }}

// ❌ Unsafe: arbitrary opacity on a CSS var that resolves to hex
className="bg-info/[0.04]"  // May fail silently
```

**Rule:** If an opacity modifier produces no visible result, switch to inline style with rgba. Report the failing token so the colour can be converted to RGB channel format in `brand.css` and `tailwind.config.js`.

**Long-term fix:** Convert all colour definitions in `brand.css` from hex to space-separated RGB channels:
```css
/* Before: */ --info: #2B7FA2;
/* After:  */ --info: 43 127 162;  /* Tailwind resolves as rgb(43 127 162) */
```

---

## 4. Layout and spacing

### 4.1 Spacing scale

```
4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px · 56px · 64px
```

### 4.2 Grid

12 columns · max width 1200–1280px · gutters 24px · margins: 16px (mobile) · 24px (tablet) · 32px (desktop).

### 4.3 Breakpoints and viewport

| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Wide screens |

**PoC: desktop-only.** Minimum supported viewport width is 1280px. Responsive breakpoint behaviour is deferred to post-pilot.

### 4.4 Surface hierarchy

1. **Canvas** → `bg-canvas` (#F4F0EA)
2. **Panels/cards** → `bg-panel` (#FEFEFE)
3. **Neutral hover** → `bg-panel-hover` (#FEF9F3)
4. **Entity hover** → `bg-{entity}-light` (panel rows linked to canvas nodes)
5. **Overlays** → `bg-panel` + `shadow-3`

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-1` | `0 1px 2px rgba(38,38,38,0.06)` | Cards, resting panels |
| `shadow-2` | `0 4px 12px rgba(38,38,38,0.10)` | Hover elevation, dropdowns |
| `shadow-3` | `0 8px 24px rgba(38,38,38,0.14)` | Modals, overlays |

Warm-tinted (ink-900 rgba, not pure black). There is no `shadow-0` token. For flat elements, omit the shadow class.

---

## 6. Borders

### 6.1 Border widths

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| `default` | 1px | `border` | Standard borders, dividers, pills |
| `state` | 2px | `border-2` | Selected states, focus indicators, canvas node resting |
| `emphasis` | 3px | `border-[3px]` | Block type indicators, coaching cards, section accents |

### 6.2 Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Inputs, small buttons |
| `md` | 12px | Panel cards, modals, accordions |
| `lg` | 20px | Standalone cards, large panels, conversation blocks |
| `pill` | 999px | Pills, round buttons |

**Panel context override:** Cards inside panels use `md` (12px). Cards outside panels use `lg` (20px).

### 6.3 Focus ring

| Property | Value |
|----------|-------|
| Width | 2px |
| Offset | 2px |
| Colour | `info` (#2B7FA2) |
| Tailwind | `focus:ring-2 focus:ring-offset-2 focus:ring-info` |

Never remove outline. Focus indicators must always be visible.

### 6.4 Border placement rules

Coloured borders communicate state or type. Neutral borders separate content. Every surface type has one correct border treatment.

| Surface type | Border treatment | Example |
|-------------|-----------------|---------|
| **Panel section cards** (options, factors, assumptions, quality, improvements) | Full border, all sides: `border border-{colour}/30 rounded-lg` | `border border-option/30` |
| **Conversation blocks** (§21.2) | Top 3px accent: `border-t-[3px] border-{colour}` | `border-t-[3px] border-info` |
| **Coaching cards** (§16) | Left 3px accent: `border-l-[3px] border-info` | Only exception for left-only border |
| **MVS card** (§16.1) | Left 3px accent: `border-l-[3px] border-success` | Elevated coaching |
| **Alert cards** (§16.2) | Top 3px accent: `border-t-[3px] border-danger` | Blocking issues |
| **Canvas nodes** | Full border, confidence-based: `border-2 border-{confidence-colour} border-{style}` | Solid green = high confidence |
| **Neutral/default cards** | Full border: `border border-panel-border rounded-lg` | No semantic signal |
| **Edge cards** (model tab) | Full border, neutral: `border border-panel-border rounded-lg` | Edges have no entity colour |
| **Winner option card** (results) | Full border: `border border-success/30 rounded-lg` | Success = winner |
| **Non-winner option cards** (results) | Full border: `border border-panel-border rounded-lg` | Neutral |

**Rules:**
- Left-only coloured borders are prohibited except for coaching cards (§16) and MVS cards (§16.1).
- Structural borders (dividers, separators) always use `border-panel-border`.
- Coloured borders always mean something. If a border is decorative, it should be `border-panel-border`.

---

## 7. Motion

### 7.1 Timing

| Token | Duration | Usage |
|-------|----------|-------|
| `--duration-instant` | 100ms | Hover states, micro-feedback |
| `--duration-fast` | 200ms | Micro-interactions, fade-outs, action reveal |
| `--duration-base` | 300ms | Panel transitions, skeleton pulses, crossfades |
| `--duration-slow` | 400ms | Page transitions |

### 7.2 Easing

```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);   /* Default */
--ease-out:    cubic-bezier(0.0, 0, 0.2, 1);     /* Enter */
--ease-in:     cubic-bezier(0.4, 0, 1, 1);       /* Exit */
```

### 7.3 Hover state table

Every interactive element has one defined hover behaviour. Do not invent hover treatments.

| Element | Hover behaviour |
|---------|----------------|
| **Standalone card** | shadow-1 → shadow-2 + translateY(-2px) |
| **Panel card/row (entity-linked)** | `bg-{entity}-light` tint (200ms). If semantic border exists, use `bg-panel-hover` instead |
| **Panel card/row (no entity)** | `bg-panel-hover` tint (200ms) |
| **Canvas node** | Border thickens 2px → 3px. Fill shifts to `bg-{entity}-light`. Shadow-1 → shadow-2 |
| **Button (primary)** | `bg-primary` → `bg-primary-hover` (blue→green shift, 200ms) + translateY(-1px) |
| **Button (secondary)** | `bg-transparent` → `bg-panel-hover` |
| **Link** | Underline appears |
| **Icon-only button** | `text-text-light` → `text-text-body` |
| **Tab** | `bg-panel-hover` tint |
| **Pill/badge** | No hover change (pills are informational, not interactive) |
| **Accordion header** | `bg-panel-hover` tint (never `bg-sand-50` or any coloured fill) |
| **Canvas edge** | Edge thickens 1.5px → 2.5px with subtle glow matching edge colour |

### 7.4 Canvas node selection

Selected nodes use their entity-light fill and thickened border. No blue ring overlay.

| State | Fill | Border |
|-------|------|--------|
| **Resting** | `bg-panel` (zoomed in) or `bg-{entity}-light` (zoomed out) | 2px entity or confidence colour |
| **Hover** | `bg-{entity}-light` | 3px same colour |
| **Selected** | `bg-{entity}-light` | 3px same colour (persists until deselected) |

Selecting a node dims unconnected nodes and edges to 20% opacity, highlighting the selected node's neighbourhood.

### 7.5 Pre→post analysis transition

When analysis completes, the panel content crossfades (300ms `--duration-base`). Canvas result values (win probabilities, sensitivity bars on nodes) fade in with a staggered 100ms delay per node. No slide animations.

### 7.6 Reduced motion

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
background: var(--primary);         /* #2B7FA2 */
color: var(--text-on-color);        /* #FFFFFF */
padding: 12px 24px;
border-radius: 999px;
font-weight: 600;
box-shadow: var(--shadow-1);
```
States: hover → `--primary-hover` (#67C89E, green) + translateY(-1px). Active → `--primary-active` (#5AA88A). Disabled → `--primary-disabled` + no shadow. Focus → §6.3 ring.

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
[Label]           — panelHeader (14px) in panels, label (14px) outside
  4px gap
[Input]           — min-height 44px
  4px gap
[Helper/error]    — panelMeta (11px) in panels, bodySmall (14px) outside
```

Error: Lucide `AlertTriangle` (14px, `text-danger`) + error text. Success: Lucide `Check` (14px, `text-success`) + confirmation text. Inline validation: show on blur, clear on focus.

### 8.4 Cards

```css
background: var(--bg-panel);
border-radius: 20px;              /* 12px inside panels: see §6.2 */
padding: 24px;
box-shadow: var(--shadow-1);
```
Variants: interactive (hover per §7.3). Selected (2px border `info`). Analysis (see §6.4 for border placement).

### 8.5 Pills and badges

**One treatment only: outlined.** No filled backgrounds on pills. Ever.

```css
background: transparent;
border: 1px solid {colour at 30% opacity};
color: var(--text-body);           /* Always dark text, never text-{colour} */
padding: 4px 12px;
border-radius: 999px;
font-weight: 500;
```

| Context | Font size | Token |
|---------|-----------|-------|
| Default (outside panels) | 14px | `label` |
| Inside panels | 11px | `panelMeta` |
| On canvas | 11px | `panelMeta`, use `bg-panel` instead of `bg-transparent` |

**Colour is carried by the border only.** The border signals the semantic meaning; the text is always legible.

Examples: "Low confidence" → `border-danger/30 text-text-body`. "Ready" → `border-success/30 text-text-body`. "Default" → `border-factor/30 text-text-body`. "Fragile" → `border-warning/30 text-text-body`. "Recommended" → `border-success/30 text-text-body`.

### 8.6 Count badges

Small circled numbers on section headers. Colour follows state-based logic, not percentage thresholds.

| State | Colour | When |
|-------|--------|------|
| All resolved | `border-success/30` | Every item reviewed/complete |
| Some unresolved | `border-warning/30` | At least one item unresolved, none critical |
| Critical items present | `border-danger/30` | At least one item blocking or high-risk |

A count of "0" shows no badge. Treatment follows the outlined pill pattern (§8.5).

### 8.7 Links

| Property | Value |
|----------|-------|
| Colour | `text-info` (#2B7FA2) |
| Default underline | None |
| Hover | Underline |
| Focus | §6.3 ring |
| Visited | Same as default (Olumi is a SPA) |

In panels, links use `panelBody` (12px). Outside panels, links inherit parent font size.

### 8.8 Navigation

**App bar:** 64px height, `bg-panel`, logo left, user avatar right. Active item: 2px underline `info`.

**Tabs:** 44px height. Selected: pill background `rgba(43,127,162,0.15)` (info blue at 15%). Transition 200ms. Never use legacy `bg-sky-200` or `text-sky-600`.

### 8.9 Sticky footer (panels)

Anchored to the bottom of side panels. Consistent between pre-analysis and post-analysis.

```css
background: var(--bg-panel);
border-top: 1px solid var(--border-default);
padding: 8px 16px;
```

| Position | Content | Typography |
|----------|---------|-----------|
| Left | Status icon + status text + review count | `panelMeta`, colour from evaluative thresholds (§12.6) |
| Right | Primary action button | `bg-primary text-on-color` |

Pre-analysis: "Ready · 0/2 reviewed · [Analyse Now]". Post-analysis: "Trust: moderate · [Rerun]".

### 8.10 Toggle button group

Mutually exclusive options rendered as a row of outlined pills. Used for: risk tolerance, quick-set selectors.

```tsx
<div className="flex gap-2">
  {options.map(opt => (
    <button className={`px-3 py-1.5 rounded-full border text-text-body ${
      selected === opt
        ? 'border-info bg-panel'
        : 'border-panel-border bg-transparent'
    }`} onClick={() => setSelected(opt)}>
      {opt}
    </button>
  ))}
</div>
```

Selected state uses `border-info` (full opacity, not /30). Unselected uses `border-panel-border`. No filled backgrounds.

### 8.11 Tooltips

Displayed on all icon-only interactive elements (§9.9). Delay: 300ms.

```css
background: var(--text-header);    /* #262626: dark */
color: var(--text-on-color);       /* #FFFFFF */
padding: 6px 10px;
border-radius: 6px;
font-size: 11px;                   /* panelMeta */
max-width: 200px;
box-shadow: var(--shadow-2);
```

Position: above, centred. No arrow. Multiline wraps naturally within max-width.

### 8.12 Modal/dialog

Used sparingly: destructive actions, irrecoverable errors, session expiry only.

```css
background: var(--bg-panel);
border-radius: 12px;
padding: 24px;
box-shadow: var(--shadow-3);
max-width: 420px;
```

**Overlay:** `bg-canvas` at 60% opacity. Click outside to dismiss (unless destructive).

**Anatomy:** Title (`panelHeader`) → description (`panelBody`, `text-text-light`) → action row (primary right, cancel left).

**Destructive variant:** Primary button uses `bg-danger text-on-color`. Cancel uses secondary.

**Animation:** Overlay fades in (200ms). Modal scales from 0.95→1.0 + fades in (200ms).

---

## 9. Iconography

**Library:** Lucide (`lucide-react@0.263.1`). MIT-licensed, 24px grid, 2px stroke weight. No other icon libraries. No emoji in production UI. No unicode symbol characters as icon replacements.

### 9.1 Sizing

| Context | Size | Tailwind |
|---------|------|----------|
| Canvas node badge | 14px | `w-3.5 h-3.5` |
| Panel inline / row actions | 14px | `w-3.5 h-3.5` |
| Panel section header | 16px | `w-4 h-4` |
| Toolbar / navigation | 20px | `w-5 h-5` |
| Empty state | 40px | `w-10 h-10` |

### 9.2 Colour rule

Icons inherit colour from their context. Colour communicates state, not identity.

- **Canvas:** entity colour of the node type
- **Semantic contexts** (alerts, status, coaching): `text-success`, `text-danger`, `text-info`, `text-warning`
- **Neutral contexts** (actions, navigation, metadata): `text-text-light` at rest; `text-text-body` on hover
- **Bias category icons:** always `text-text-light`

### 9.3 Icon tiers: space efficiency

**Tier 1: Navigation (always visible, no label).** `ChevronDown`/`ChevronRight`, `X`, tab icons. Rendered in `text-text-light`.

**Tier 2: Actions (visible on hover/focus, tooltip mandatory).** `Pencil`, `Link`, `Check`, `HelpCircle`, `Plus`, `ExternalLink`. Hidden at rest, revealed on row/card hover.

**Touch/narrow override:** When panel width < 400px or on touch devices, tier 2 icons are always-visible.

**Tier 3: Status (always visible, replaces text labels).** `CheckCircle`, `AlertTriangle` with count, confidence glyph.

### 9.4 Node-type icons

Used **off-canvas only**: panel lists, driver rows, conversation panel node references, search results.

| Node type | Icon |
|-----------|------|
| Goal | `Target` |
| Decision | `GitBranch` |
| Option | `Lightbulb` |
| Factor | `Settings` |
| Risk | `AlertTriangle` |
| Outcome | `TrendingUp` |

### 9.5 State icons

| State | Icon | Colour |
|-------|------|--------|
| Ready / complete | `CheckCircle` | `text-success` |
| Error / not ready | `XCircle` | `text-danger` |
| Warning | `AlertTriangle` | `text-warning` |
| Info | `Info` | `text-info` |

### 9.6 Behavioural bias category icons

Defer from PoC. Revisit post-pilot.

| Category | Icon |
|----------|------|
| Anchoring | `Anchor` |
| Framing | `Frame` |
| Confidence | `Gauge` |
| Blind spots | `EyeOff` |

### 9.7 Challenge/reflection icons

Use `HelpCircle` (Lucide). Never use inverted triangles (reserved for risk nodes §10.1).

### 9.8 Olumi AI interaction icon

The only custom icon in the system. Marks any element where clicking triggers an AI interaction.

**Design:** The Olumi logo mark (circle, square, triangle) rendered as a single-colour glyph at icon scale, matching Lucide's 2px stroke weight.

**Colour:** `text-info` to signal interactivity. `text-text-light` at rest in dense contexts.

**Placement:**
- Small affordance on individual elements (nodes, driver rows, evidence items): "discuss this with the AI"
- Conversation panel identity / AI avatar icon
- Coaching card action links ("Ask about this", "Explore trade-off")

### 9.9 Space rules

- **Icon-only buttons** (with tooltip per §8.11) over labelled buttons for unambiguous actions. Minimum touch target 44×44px.
- **Icon + short label** only where the action is ambiguous.
- **No icons in running text** or descriptions.
- **Maximum three icon actions per row.** Beyond three, use overflow menu (`MoreHorizontal`).
- **Tooltips mandatory** on all icon-only interactive elements.
- **No emoji.** No unicode symbol characters as icon replacements (e.g. '⚠', '⛔', 'ℹ', '✕'). Use Lucide.

---

## 10. Node shape system

Shapes identify node type on the canvas. See §1 three-channel principle.

### 10.1 Shape-to-node mapping

| Node type | Shape | Colour (solid fill) | Scientific basis |
|-----------|-------|---------------------|-----------------|
| Factor | Circle | `factor` (#B0A899) | Standard causal graph convention |
| Option | Square | `option` (#AAA7E4) | Influence diagram convention |
| Goal | Diamond | `goal` (#F5C433) | Influence diagram convention |
| Decision | Hexagon | `info` (#2B7FA2) | Distinct junction shape |
| Risk | Inverted triangle | `danger` (#EA7B4B) | Universal caution symbol |
| Outcome | Upward triangle | `success` (#67C89E) | Paired opposite to risk |

### 10.2 Zoom behaviour

| Zoom level | Rendering | Text |
|------------|-----------|------|
| **Zoomed in** | Full node card. Shape as 14px badge in corner. | Yes |
| **Zoomed out** | Shape replaces card. Solid entity colour fill, no border, no text. | No |

### 10.3 Off-canvas representation

Use node-type icons (§9.4), not shapes, when referencing nodes outside the canvas.

---

## 11. Confidence as visual language

### 11.1 Confidence levels

| Level | Range | Colour | Glyph |
|-------|-------|--------|-------|
| High | 70–100% | Success (#67C89E) | ✓ |
| Medium | 40–69% | Info (#2B7FA2) | ~ |
| Low | 0–39% | Factor (#B0A899) | ? |

Glyphs are text characters (not Lucide icons) inside styled badge containers. Glyph colour matches the level: ✓ `text-success`, ~ `text-info`, ? `text-factor`.

### 11.2 Context-dependent rendering

| Context | Cues used |
|---------|-----------|
| **Canvas nodes** | Border style + colour + glyph badge |
| **Full-width cards** | Border style + colour + glyph badge |
| **Panel driver rows** | Confidence bar + glyph badge |
| **Compact lists** | Colour + glyph badge only |

### 11.3 Border style mapping (canvas and full-width cards only)

| Level | Border style |
|-------|-------------|
| High | `border-success border-solid` |
| Medium | `border-info border-dashed` |
| Low | `border-factor border-dotted` |

Low-confidence dotted borders use minimum `border-[3px]` width.

### 11.4 Glyph badge pattern

```tsx
<div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center bg-success text-white"
  style={{ fontSize: 10, fontWeight: 700 }}>
  ✓
</div>
```

### 11.5 Confidence bar pattern (panels)

```tsx
<div className="flex items-center gap-2">
  <div className="flex-1 h-1.5 rounded-full bg-panel-border overflow-hidden">
    <div className="h-full rounded-full bg-success" style={{ width: `${confidence}%` }} />
  </div>
  <span className="text-success" style={{ fontSize: 10, fontWeight: 700 }}>✓</span>
</div>
```

### 11.6 Evaluative colour thresholds

Single universal system for metrics judged as good/moderate/poor. Aligns with confidence levels.

| Range | Colour | Token | Meaning |
|-------|--------|-------|---------|
| 0–39% | Danger | `var(--danger)` | Needs attention |
| 40–69% | Warning | `var(--warning)` | Moderate |
| ≥ 70% | Success | `var(--success)` | Strong |

**Applies to:** Readiness bars, stability bars, quality scores, sticky footer quality label.

**Does NOT apply to:** Driver influence bars (stay `var(--info)`), confidence bars in driver rows (use §11 with glyph badges), win probability (entity-coloured), count badges (state-based per §8.6).

Implement as shared utility: `getThresholdColour(value: number): string`.

---

## 12. Decision states

| State | Border | Background | Lucide icon |
|-------|--------|------------|-------------|
| Draft | 2px `factor` | `bg-panel` | `Pencil` |
| Active | 2px `info` | `bg-panel` | `Play` |
| Complete | 2px `success` | `bg-panel` | `Check` |
| Blocked | 2px `danger` | `bg-panel` | `AlertTriangle` |

---

## 13. Progress indicators

```css
/* Track */
background: rgba(38,38,38,0.10);
height: 8px;
border-radius: 4px;

/* Bar */
background: var(--goal);       /* #F5C433: brand yellow */
transition: width 300ms ease-out;
```

Progress bars show completion, not quality (always goal yellow). For evaluative bars, use threshold colours per §11.6.

---

## 14. Data visualisation

### 14.1 Chart colour sequence

Uses data layer tokens (§3.9). Ordinal only.

### 14.2 Semantic chart elements

- **Positive direction:** success fill at low opacity, success border
- **Negative direction:** danger fill at low opacity, danger border
- **Uncertainty bands:** info at 30% opacity
- **Target lines:** dashed, goal (#F5C433)
- **Threshold lines:** dotted, danger (#EA7B4B)
- **Gridlines:** panel-border at 50% opacity
- **Axis labels:** `text-text-light`, `panelMeta` size

### 14.3 Chart accessibility

Never rely on colour alone. Add patterns for critical distinctions. Include data labels on hover/tap. Provide table view alternative.

### 14.4 Stacked summary bar

Entity-coloured segment bar used at the top of the model tab and results hero to show node/option distribution.

Each segment uses the entity main colour at full opacity. Segment widths are proportional. No borders between segments, `rounded-full` on the container, 8px height.

---

## 15. Scroll behaviour

### 15.1 Panel scrolling

Panels scroll vertically. Section headers within scrollable panels are **not** sticky (panel space is too constrained).

Scroll indicators: a 1px `border-panel-border` fade at the top of the scroll area when content is scrolled down.

### 15.2 Accordion behaviour

Use one shared accordion component with smooth CSS height transition (`transition-[height,opacity] duration-200`). Accordion headers use `bg-panel` (never `bg-sand-50` or any coloured fill), `panelHeader` typography, `text-text-body` colour, Lucide `ChevronRight` (rotates on expand).

---

## 16. Coaching card pattern

Distinct from error/warning. Feels encouraging, not blocking.

```tsx
<div className="bg-panel border-l-[3px] border-info rounded-lg px-4 py-3">
  <div className="flex items-center gap-2 mb-1">
    <Lightbulb className="text-info w-4 h-4" />
    <span className={typography.panelHeader + " text-info"}>Strengthen your model</span>
  </div>
  <p className={typography.panelBody + " text-text-body"}>
    Adding a time horizon to your goal would help the simulation produce more actionable results.
  </p>
</div>
```

**Key differences from alerts:** left border (not top), `bg-panel` background, Lucide `Lightbulb` icon, encouraging copy.

### 16.1 Most Valuable Step (MVS) card

Elevated coaching card for the single highest-priority action.

- Left border: `var(--success)` (green: "this is the positive action to take")
- Background: `bg-panel`
- Icon: Lucide `Lightbulb`
- Shadow: `var(--shadow-1)`

### 16.2 ReviewCardBlock variant selection

| Variant | When | Border | Background | Icon | Tone |
|---------|------|--------|------------|------|------|
| **Alert** (default) | Risks, critical issues, blocking items | Top 3px `danger` | `bg-panel` | `AlertTriangle` | Direct |
| **Coaching** | Suggestions, evidence gaps, optional enhancements | Left 3px `info` | `bg-panel` | `Lightbulb` | Encouraging |

---

## 17. Error, warning, and notification system

### 17.1 Severity levels

| Level | Colour | Icon | When |
|-------|--------|------|------|
| Error | `danger` | `XCircle` | Something failed. User must act. |
| Warning | `warning` | `AlertTriangle` | May cause problems. User can proceed. |
| Info | `info` | `Info` | Neutral context. No action required. |
| Success | `success` | `CheckCircle` | Action completed. |

### 17.2 Escalation pattern

**Level 1: Inline (field/element).** Red border + helper text with `AlertTriangle`. On blur, clears on focus.

**Level 2: Section banner (panel/card).** `bg-panel`, `border border-danger/30`, icon + message + action. Dismissable for warning/info, persistent for error.

**Level 3: Toast (transient).** Top-right, auto-dismiss 5s (errors persist). Max one visible.

```css
background: var(--bg-panel);
border-radius: 12px;
padding: 12px 16px;
box-shadow: var(--shadow-2);
border-left: 3px solid {severity colour};
max-width: 360px;
```

**Anatomy:** Lucide icon (16px) left + single-line text (`panelBody`) + optional action link (`text-info`) + close button (`X`, `text-text-light`). No progress bar.

**Level 4: Blocking modal (critical).** Per §8.12. Extremely rare.

### 17.3 Message rules

- Never show error codes or technical identifiers
- Never use all caps
- Never stack multiple toasts
- Never use a modal for something that could be a banner
- Always provide guidance on resolution

### 17.4 Canvas errors

2px `danger` border on affected element + `AlertTriangle` badge. Click opens inspector. No text overlay on canvas.

### 17.5 Conversation panel errors

System event message: centred, `text-danger`, `panelMeta`, with retry link. Not a block card.

### 17.6 Unsupported/unknown block treatment

When the UI receives a block type it cannot render:

```tsx
<div className="bg-panel border border-panel-border rounded-lg px-4 py-3">
  <div className="flex items-center gap-2">
    <Info className="text-text-light w-4 h-4" />
    <span className={typography.panelBody + " text-text-light"}>
      This content type is not yet supported.
    </span>
  </div>
</div>
```

Neutral, non-alarming. No semantic colour. No action required from user.

---

## 18. Empty and zero states

```tsx
<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
  <IconComponent className="text-text-light w-10 h-10 mb-3" />
  <p className={typography.body + " text-text-body mb-1"}>{headline}</p>
  <p className={typography.bodySmall + " text-text-light mb-4"}>{guidance}</p>
  <Button variant="secondary" size="sm">{cta}</Button>
</div>
```

Encouraging, never blame the user. Use "yet" to imply progress. Two lines max.

---

## 19. Loading and skeleton patterns

**Skeleton:** pulse between `bg-panel-hover` and `border-panel-border`. Duration: 300ms.

**Simulation loading:**
```tsx
<div className="flex items-center gap-3 py-4 px-4 bg-panel border border-info/30 rounded-lg">
  <Spinner className="text-info w-4 h-4" />
  <span className={typography.panelBody + " text-text-body"}>Running 1,000 simulations…</span>
</div>
```

---

## 20. Progressive disclosure

Complexity revealed on demand, not imposed.

**Levels:**
1. **Headline:** always visible. Plain language, one line.
2. **Explanation:** expandable. What this means in context.
3. **Methodology:** on request. Technical detail.

**Expand/collapse labels:** "More" with Lucide `ChevronDown` / "Less" with Lucide `ChevronUp`. Shortest, symmetric, uses icons.

**Expanded content:**
```tsx
<div className="mt-2 pl-3 border-l-2 border-panel-border">
  <p className={typography.panelBody + " text-text-light"}>{explanation}</p>
</div>
```

---

## 21. Conversational UI patterns

*Implementation status: target architecture. The Orchestrator conversation panel is being built via Track D. See Conversational Orchestrator v3 for the full interaction specification.*

### 21.1 Message styling

| Element | Styling |
|---------|---------|
| **User message** | `bg-panel rounded-lg shadow-1` right-aligned, `text-text-body`, user avatar (§23.1) |
| **AI text** | No background (inline on canvas bg), `text-text-body`, left-aligned, AI avatar (§23.2) |
| **AI block** | Card with type-specific top border (§21.2) |
| **System event** | Centred, `text-text-light`, `panelMeta`, no background |

### 21.2 Block rendering

Base block: `bg-panel`, `rounded-[20px]`, 24px padding, `shadow-1`.

Type-specific top borders (3px). Block type badges are small coloured dots (8px diameter, main colour fill) top-left.

| Block type | Border colour | Rationale |
|-----------|--------------|-----------|
| FramingBlock | `info` | Information/structuring |
| GraphPatchBlock | `goal` | Action required |
| FactBlock | `success` | Computed results |
| CommentaryBlock | None (inline) | Explanation |
| ReviewCardBlock | `danger` or `info` | Alert or coaching (§16.2) |
| ScenarioBlock | `option` | Comparison |
| BriefBlock | `success` | Deliverable |
| EvidenceBlock | `info` | External information |

**Block actions:** Accept → `bg-primary text-on-color`. Edit → secondary. Dismiss → `text-text-light` link.

**Block states:** proposed → actions visible. Accepted → green flash + `Check` → collapse (300ms). Dismissed → fade out (200ms). Rejected → danger border + explanation.

### 21.3 Typing and tool execution

Three pulsing dots (`text-info`) for thinking. Spinner + `panelMeta` text for tool execution.

### 21.4 Suggested action chips

Max 2 per AI response. `panelBody` (12px) inside panels, `bodySmall` (14px) outside. `bg-panel`, `border border-panel-border`, `hover:bg-panel-hover`.

---

## 22. Analysis tab: shared patterns

Pre-analysis and post-analysis are two phases of one system. They share the same visual grammar, the same component patterns, the same spacing and borders. They differ in informational emphasis.

### 22.1 Emphasis by phase

| Phase | Default emphasis | User's job |
|-------|-----------------|-----------|
| **Pre-analysis** | Readiness, gaps, critiques, fixes, assumptions | Prepare the model |
| **Post-analysis** | Outcomes, drivers, confidence, trust, comparisons | Interpret the results |

### 22.2 Shared patterns

Both phases use the same set of patterns. All differences are in content, not treatment.

**Section header:** Shared `SectionHeader` component. Title (`panelHeader`) + optional Lucide icon (16px, `text-text-light`) + optional count badge (§8.6) + "More"/"Less" disclosure (§20). No accordion header fills. No legacy `bg-sand-50`.

**Summary card:** `bg-panel`, full `border border-{colour}/30`, `rounded-lg` (12px), px-3 py-2. Pre-analysis: goal target + edit actions. Post-analysis: winner + key stats.

**Item row:** `bg-panel`, full `border border-panel-border`, `rounded-lg`, hover → entity-light per §7.3. Pre: intervention arrows + status. Post: win % + description.

**Signal card:** `bg-panel`, full `border border-{semantic}/30`, `rounded-lg`. Pre: blockers + quality checks with Lucide icons and action CTAs. Post: uncertainties + fragile edges with Lucide icons and action CTAs.

**Action row:** Inline text links (`text-info`) or outlined pill CTAs. Consistent between phases: Fix / Confirm / Edit (pre), Investigate / Gather evidence (post).

**Accordion:** Shared `Accordion.tsx` component everywhere. Smooth `transition-[height,opacity] duration-200`. Header: `bg-panel`, `panelHeader`, `text-text-body`, Lucide `ChevronRight` (rotates). No `bg-sand-50`. No raw button patterns.

**Sticky footer:** Per §8.9. Same structure both phases.

### 22.3 Standardisation requirements

| Attribute | Standard |
|-----------|----------|
| Accordion implementation | Shared `Accordion.tsx` with smooth transition |
| Accordion header | `bg-panel`, no coloured fills |
| Section header | Shared `SectionHeader` component |
| Border tokens | Semantic only (`border-panel-border`, `border-{colour}/30`), no legacy |
| Typography colour | Semantic only (`text-text-header`, `text-text-body`, `text-text-light`), no legacy |
| Icons | Lucide only, no unicode emoji |
| Card radius | `rounded-lg` (12px) consistently |
| Count badges | Outlined pill (§8.5), state-based colour (§8.6) |
| Improvement tiers | Section header + count badge for grouping, not left-border colour |

---

## 23. User identity and AI avatar

### 23.1 User avatar

**PoC (single neutral):**
```css
width: 32px; height: 32px; border-radius: 999px;
background: var(--bg-canvas);
border: 1px solid var(--border-default);
color: var(--text-body); font-size: 12px; font-weight: 600;
```

Content: user initials. No colour assignment. Post-pilot: introduce muted, desaturated user colours outside the entity/semantic palette.

### 23.2 AI avatar

```css
width: 32px; height: 32px; border-radius: 999px;
background: var(--bg-panel);
border: 1px solid var(--info);
color: var(--info);
```

Uses the custom Olumi logo mark icon (§9.8). Blue AI = active participant. Neutral user = decision-maker.

---

## 24. Inspector panels

Inspector panels appear when a canvas node or edge is selected. They follow all panel patterns (§2.2 typography, §6.2 radius, §6.4 borders) plus these additional rules.

### 24.1 Inspector anatomy

1. **Top accent:** 3px bar in confidence colour (success/info/factor per §11.1)
2. **Header:** Node shape indicator (§10, 24px) + node name (`panelHeader`) + type badge (outlined pill §8.5) + confidence badge (§11)
3. **Sections:** Lucide section icons (16px, `text-text-light`) + section title (sentence case, `panelMeta`, uppercase, 0.5px letter-spacing)
4. **Close button:** Lucide `X`, top-right, `text-text-light`

### 24.2 Section headers in inspectors

**Sentence case always.** Never all caps for section titles. "Success target", not "SUCCESS TARGET". "What drives this", not "WHAT DRIVES THIS".

Section icons must be Lucide (e.g. `Target` for success target, `BarChart3` for impact, `Link` for connections, `Lock` for confidence, `Ruler` for value/range). Never emoji.

### 24.3 Keyboard shortcut display

When displaying keyboard shortcuts (e.g. "Shift+D for diagnostics"):

```tsx
<kbd className="px-1.5 py-0.5 rounded bg-panel-hover border border-panel-border text-text-light"
  style={{ fontSize: 11, fontFamily: 'monospace' }}>
  Shift+D
</kbd>
```

---

## 25. Search and filter

### 25.1 Search input

```tsx
<div className="flex items-center gap-2 px-3 py-2 border border-panel-border rounded-lg bg-panel">
  <Search className="text-text-light w-4 h-4" />
  <input className={typography.panelBody + " text-text-body placeholder:text-text-light flex-1 bg-transparent outline-none"}
    placeholder="Search factors and edges…" />
</div>
```

### 25.2 No results

Centre-aligned, `text-text-light`, `panelBody`. "No matches found." with optional "Try a broader search" guidance.

### 25.3 Result highlighting

Matched text in search results uses `text-text-header` + `font-semibold`. Non-matched text uses `text-text-body`.

---

## 26. Accessibility

### 26.1 Requirements

- **WCAG AA** minimum contrast (4.5:1 text, 3:1 UI elements)
- **Touch targets:** minimum 44×44px
- **Focus indicators:** always visible (§6.3)
- **Screen reader:** semantic HTML + ARIA labels
- **Keyboard:** full navigation, focus traps in modals
- **Reduced motion:** respect `prefers-reduced-motion` (§7.6)

### 26.2 Developer checklist

- [ ] No raw hex values in CSS/TSX
- [ ] No raw font-size/font-weight utilities
- [ ] No emoji or unicode symbols as icons (§9)
- [ ] No `bg-{colour}-light` on cards, banners, accordion headers, or pills (§3.2)
- [ ] No legacy tokens (`sand-*`, `ink-*`, `sky-*`, `slate-*`) in new code (§3.14)
- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus trap in modals/overlays
- [ ] Animations respect reduced motion
- [ ] Loading states implemented
- [ ] Error boundaries in place
- [ ] Colour is not sole information channel (§3.12)
- [ ] All 10–11px text has 12–14px accessible equivalent
- [ ] Tooltips on all icon-only elements (§8.11)
- [ ] Pill text is always `text-text-body`, never `text-{colour}` (§8.5)
- [ ] No all-caps section headers (§2.4)
- [ ] No em dashes in copy

---

## 27. Quick reference

### 27.1 Colour quick reference

| Need | Tailwind class |
|------|----------------|
| Error text | `text-danger` |
| Error border | `border-danger/30` |
| Success text | `text-success` |
| Success border | `border-success/30` |
| Warning text | `text-warning` |
| Warning border | `border-warning/30` |
| Info text | `text-info` |
| Info border | `border-info/30` |
| Primary button | `bg-primary text-on-color hover:bg-primary-hover` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |
| Canvas node fill | `bg-{entity}-light` (canvas only) |
| Panel entity hover | `bg-{entity}-light` (hover only) |

### 27.2 Component sizing

| Size | Button padding | Input height | Card padding |
|------|---------------|-------------|-------------|
| sm | 8px 16px | 36px | 16px |
| md | 12px 24px | 44px | 24px |
| lg | 16px 32px | 52px | 32px |

### 27.3 Z-index scale

| Layer | Value |
|-------|-------|
| base | 0 |
| dropdown | 100 |
| sticky | 200 |
| modal | 300 |
| popover | 400 |
| toast | 500 |

---

## 28. Key files

| File | Purpose |
|------|---------|
| `src/styles/brand.css` | CSS custom properties (colour source of truth) |
| `tailwind.config.js` | Tailwind colour mappings + border width extensions |
| `src/styles/typography.ts` | Typography tokens |
| `src/canvas/nodes/colors.ts` | Node colour classes |
| `src/canvas/theme/nodes.ts` | Node theme tokens |

---

## 29. Voice and tone

British English throughout. Conversational but professional. Encouraging without being patronising. Data-driven but accessible.

**Prohibited in all UI copy:**
- Em dashes (use commas, colons, full stops, or restructure)
- All caps (use sentence case)
- Error codes or technical identifiers
- Blame language ("you failed to", "error in your input")

**Coaching tone examples:**
- ✅ "Adding a time horizon would strengthen this goal."
- ✅ "Your model could benefit from more evidence on market growth."
- ❌ "Error: goal missing time horizon."
- ❌ "WARNING: insufficient evidence."

---

*This is a living document. When conflicts arise with other documentation, this file takes precedence for all UI implementation decisions.*
