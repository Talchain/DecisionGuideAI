# Olumi Design System v4

**Single source of truth for all UI implementation. Supersedes all previous versions.**

British English throughout. Sentence case for all UI text. "and" not "&".

---

## 1. Design philosophy

Scientific rigour made approachable. Calm, warm surfaces with purposeful colour that guides users through complex decisions. Coaching over gates — the UI encourages rather than blocks.

**Principles:** Clear (remove complexity, not capability) · Pragmatic (every decision has rationale) · Optimistic (forward-looking) · Human (enhances, not replaces)

**Three-channel visual system:** Olumi communicates through three non-overlapping visual channels. Each channel has a distinct job — when they overlap, information is wasted.

| Channel | Communicates | Example |
|---------|-------------|---------|
| **Shapes** (nouns) | What something is | Diamond = goal node |
| **Colour** (adjectives) | How it's doing | Green border = high confidence |
| **Icons** (verbs) | What you can do | Pencil = edit this |

No channel should duplicate another. A goal node uses a diamond shape and yellow fill — it does not also need a Target icon on the canvas, because the shape already identifies it.

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
- Badges/pills inside panels — `panelMeta` (11px). Outside panels — `label` (14px).
- Buttons inside panels — `panelBody` (12px). Outside panels — `button` (14px).
- Helper/error text inside panels — `panelMeta` (11px). Outside panels — `bodySmall` (14px).

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
| **Entity** | What things are on the canvas | Node fills, type labels | Goal node = yellow fill |
| **Data** | Which data belongs together in charts | Chart fill, chart stroke, legend colours | Series 1, series 2 (ordinal) |

**Precedence rule:** When layers overlap, semantic always wins for borders and state indicators. Entity always wins for fills.

### 3.2 Two-shade rule — main and light

Each colour has exactly TWO shades: **Main** and **Light**. These have strict, non-interchangeable roles.

**Main shades are foreground — text, icons, borders, accents.** They carry meaning and must be legible.

**Light shades are restricted to two uses only:**
1. **Canvas node fills** — large-surface identification of node type
2. **Panel entity-hover states** — when hovering a panel row/card, the entity-light colour tints the background to connect the item to its canvas node type

Light shades are **never** used as backgrounds for cards, banners, coaching cards, pills, or any small container. All component backgrounds use `bg-panel` or `bg-transparent`.

| Element | Shade | Example |
|---------|-------|---------|
| Text on white/panel surfaces | Main | `text-danger` on `bg-panel` |
| Icons | Main | `text-info` icon on neutral background |
| Borders, left accents, dots | Main | `border-success` left accent |
| Canvas node fills | Light | `bg-factor-light` fill on factor node |
| Panel hover (entity-linked items) | Light | `bg-option-light` on hover over option row |
| Card/section backgrounds | Neutral only | `bg-panel` — never `bg-{colour}-light` |
| Pill backgrounds | None | `bg-transparent` — border carries colour signal |
| Button backgrounds | Main (exception) | `bg-primary` with `text-on-color` |

**Priority rule for hover:** If an element already has a semantic border (confidence, error, warning), hover uses neutral `bg-panel-hover`. Entity-light hover only applies when there's no competing semantic colour.

**Implementation check — ask three questions:**
1. Is this foreground (text, icon, border, accent)? — Main shade
2. Is this a canvas node fill or panel entity-hover? — Light shade
3. Is this any other background? — `bg-panel` or `bg-transparent`

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
| `--text-on-color` | #FFFFFF | `text-text-on-color` | Text on button backgrounds (primary, destructive, status) |

### 3.6 Surfaces and backgrounds

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `--bg-canvas` | #F4F0EA | `bg-canvas` | App/canvas background |
| `--bg-panel` | #FEFEFE | `bg-panel` | Panel/card/node/banner backgrounds |
| `--bg-panel-hover` | #FEF9F3 | `bg-panel-hover` | Default hover state (when no entity hover applies) |
| `--border-default` | #EEE6D8 | `border-panel-border` | Default borders, dividers |

### 3.7 Semantic colours (Layer 1)

Owns borders, status indicators, state styling.

| Colour | Main | Light | Main usage | Light usage |
|--------|------|-------|------------|-------------|
| **Danger** | #EA7B4B | #FFB393 | Error text, risk borders, alert icons | Risk node canvas fill, panel hover |
| **Success** | #67C89E | #B8E2D0 | Positive text, confirmation icons, success borders | Outcome node canvas fill, panel hover |
| **Info** | #2B7FA2 | #BAD7E4 | Links, nav text, info borders, primary buttons | Decision node canvas fill, panel hover |
| **Warning** | #FFA656 | #FCC798 | Warning text, caution icons, warning borders | Panel hover only |

### 3.8 Entity colours (Layer 2)

Owns node fills on canvas.

| Node type | Main | Light | Main usage | Light usage |
|-----------|------|-------|------------|-------------|
| **Goal** | #F5C433 | #F4DB92 | Goal text, goal borders, progress bars | Goal node canvas fill, panel hover |
| **Option** | #AAA7E4 | #DDDCF5 | Option text, option borders | Option node canvas fill, panel hover |
| **Factor** | #B0A899 | #EEE6D8 | Factor text, factor borders, muted labels | Factor node canvas fill, panel hover |
| **Decision** | (uses Info) | | | |
| **Outcome** | (uses Success) | | | |
| **Risk** | (uses Danger) | | | |

### 3.9 Data colours (Layer 3 — chart-only)

Purely ordinal. No semantic meaning. Chart fills may use light shades for bar/area fills with main shade borders.

**Implementation status:** Only 6 tokens (`chart-1` through `chart-6`) are currently defined in `brand.css` as CSS var aliases. Tailwind utility classes are not yet mapped. Tokens `chart-7` and `chart-8` are planned.

| Token | Alias / Hex | Status | Usage |
|-------|-------------|--------|-------|
| `chart-1` | → `--info` (#2B7FA2) | Implemented | Primary series |
| `chart-2` | → `--success` (#67C89E) | Implemented | Secondary series |
| `chart-3` | → `--goal` (#F5C433) | Implemented | Highlight series |
| `chart-4` | → `--option` (#AAA7E4) | Implemented | Comparison series |
| `chart-5` | #5C9BB8 | Implemented | Additional series |
| `chart-6` | #C9D9FF | Implemented | Tertiary fill |
| `chart-7` | #62B28F | Planned | Alt series |
| `chart-8` | #FFE497 | Planned | Soft highlight |

**Usage pattern (until Tailwind mapping is implemented):**
```tsx
style={{ fill: 'var(--chart-1)' }}

// Not yet available
className="bg-chart-1"
```

### 3.10 Primary action colour

Primary maps to Info blue. Used for CTAs and all interactive buttons. Blue signals interactivity throughout Olumi — buttons, links (§8.6), and focus rings (§6.3) all share the info blue family, creating a consistent "click here" language. **Text on primary backgrounds uses `--text-on-color` (#FFFFFF).**

Goal yellow (#F5C433) remains the brand/entity colour for goal nodes and progress bars — it is no longer used for interactive buttons.

**Implementation note:** Verify hover/active hex values against `brand.css` before use. The values below reflect the design intent; if `brand.css` differs, the CSS file is authoritative.

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | #2B7FA2 | Primary buttons, CTAs |
| `--primary-hover` | #67C89E | Hover state (success green — signals "ready to act") |
| `--primary-active` | #5AA88A | Active/pressed state (darker green) |
| `--primary-disabled` | rgba(43,127,162,0.40) | Disabled state |

```tsx
className="bg-primary text-text-on-color hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
```

### 3.11 Interactive states

Derived from main colours: `hover` (10% darker), `active` (20% darker), `disabled` (40% opacity).

**Exception:** Primary buttons transition from info blue to success green on hover — a colour shift rather than a darkness shift. This reinforces the "ready to act" signal. The transition uses `--duration-fast` (200ms) with `--ease-in-out` for a smooth colour blend.

### 3.12 Colour rules

Use semantic tokens in components. Test with colour blindness simulators. Provide non-colour indicators (icons per §9, shapes per §10, patterns).

Never use pure black (#000000). Never use raw hex values in components. Never rely on colour alone for meaning. Never use `bg-{colour}-light` on cards, banners, or pills (§3.2).

### 3.13 Colour application patterns

```tsx
// Standard component: neutral bg + coloured border + dark text
<div className="bg-panel text-text-body border border-danger/30 rounded-md px-3 py-2">
  <span className="text-danger">Error message</span>
</div>

// Correct border — use opacity
className="border border-info/30"

// Wrong — no coloured backgrounds on components
className="bg-danger-light text-danger"  // PROHIBITED outside canvas nodes

// Wrong — extra shade tokens don't exist
className="border-danger-200"  // DOESN'T EXIST
```

### 3.14 Legacy aliases (migration in progress)

Defined in `brand.css` and `tailwind.config.js` for backward compatibility. **New code MUST use semantic names. When touching a file that uses legacy tokens, migrate those references.**

| Legacy | Semantic replacement (full Tailwind class) |
|--------|---------------------------------------------|
| `ink-900` | `text-text-header` |
| `paper-50` | `bg-panel` |
| `sand-200` | `border-panel-border` |
| `sun-500` | `text-goal` / `bg-goal` |
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
3. **Neutral hover** — `bg-panel-hover` (#FEF9F3)
4. **Entity hover** — `bg-{entity}-light` (panel rows linked to canvas nodes)
5. **Overlays** — `bg-panel` + `shadow-3`

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-1` | `0 1px 2px rgba(38,38,38,0.06)` | Cards, resting panels |
| `shadow-2` | `0 4px 12px rgba(38,38,38,0.10)` | Hover elevation, dropdowns |
| `shadow-3` | `0 8px 24px rgba(38,38,38,0.14)` | Modals, overlays |

Warm-tinted (ink-900 rgba, not pure black).

**Note:** There is no `shadow-0` token. For flat/unshadowed elements, omit the shadow class.

---

## 6. Borders

### 6.1 Border widths

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| `default` | 1px | `border` | Standard borders, dividers, pills |
| `state` | 2px | `border-2` | Selected states, focus indicators |
| `emphasis` | 3px | `border-[3px]` | Block type indicators, coaching cards, section accents |

### 6.2 Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Inputs, small buttons |
| `md` | 12px | Panel cards, modals |
| `lg` | 20px | Standalone cards, large panels |
| `pill` | 999px | Pills, round buttons |

**Panel context override:** Cards inside panels use `md` (12px). Cards outside panels use `lg` (20px). This matches the panel typography size override pattern in §2.2.

### 6.3 Focus ring

| Property | Value |
|----------|-------|
| Width | 2px |
| Offset | 2px |
| Colour | `info` (#2B7FA2) |
| Tailwind | `focus:ring-2 focus:ring-offset-2 focus:ring-info` |

Never remove outline. Focus indicators must always be visible.

---

## 7. Motion

### 7.1 Timing

| Token | Duration | Usage |
|-------|----------|-------|
| `--duration-instant` | 100ms | Hover states, micro-feedback |
| `--duration-fast` | 200ms | Micro-interactions, fade-outs, action reveal |
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
- **Accepted:** brief green flash + `Check` icon (Lucide) → collapse to summary (300ms)
- **Dismissed:** fade out (200ms) → remove
- **Action reveal:** icon-only action buttons fade in on row/card hover (200ms)
- **Entity hover:** panel row/card tints with `bg-{entity}-light` (200ms)

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
background: var(--primary);         /* #2B7FA2 — info blue */
color: var(--text-on-color);        /* #FFFFFF */
padding: 12px 24px;
border-radius: 999px;
font-weight: 600;
box-shadow: var(--shadow-1);
```
States: hover → `--primary-hover` (#67C89E, success green) + translateY(-1px). Active → `--primary-active` (#5AA88A) + translateY(0). Disabled → `--primary-disabled` + no shadow. Focus → §6.3 ring.

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

Error helper: prefix with Lucide `AlertTriangle` (14px, `text-danger`) + error text. Success helper: prefix with Lucide `Check` (14px, `text-success`) + confirmation text. Inline validation: show on blur, clear on focus.

### 8.4 Cards

```css
background: var(--bg-panel);
border-radius: 20px;              /* 12px inside panels — see §6.2 */
padding: 24px;
box-shadow: var(--shadow-1);
```
Variants: interactive (hover → shadow-2 + translateY(-2px)). Selected (2px border `info`). Analysis (3px top border in semantic colour).

### 8.5 Pills and badges

**One treatment only — outlined.** No filled backgrounds on pills. Ever.

```css
background: transparent;
border: 1px solid {colour at 30% opacity};
color: var(--text-body);           /* Always dark text — never text-{colour} */
padding: 4px 12px;
border-radius: 999px;
font-weight: 500;
```

| Context | Font size | Token |
|---------|-----------|-------|
| Default (outside panels) | 14px | `label` |
| Inside panels | 11px | `panelMeta` |

**Colour is carried by the border only.** The border signals the semantic meaning; the text is always legible.

Examples: "Low confidence" → `border-danger/30 text-text-body`. "Ready" → `border-success/30 text-text-body`. "Default" → `border-factor/30 text-text-body`. "#1 of 4" → `border-success/30 text-text-body`.

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
| Visited | Same as default (no visited state — Olumi is a SPA) |

In panels, links use `panelBody` (12px) size. Outside panels, links inherit parent font size.

### 8.8 Navigation

**App bar:** 64px height, `bg-panel`, logo left, user avatar right. Active item: 2px underline `info`.

**Tabs:** 44px height. Selected: pill background `rgba(43,127,162,0.15)`. Transition 200ms.

### 8.9 Sticky footer (panels)

Anchored to the bottom of side panels. Contains status summary and primary action.

```css
background: var(--bg-panel);
border-top: 1px solid var(--border-default);
padding: 8px 16px;
```

- **Quality/status label:** `panelMeta` size, colour from evaluative thresholds (§11.6)
- **Review count:** `panelMeta` size, `text-text-light`
- **Primary action button:** `bg-primary text-text-on-color` (info blue, white text)

---

## 9. Iconography

**Library:** Lucide (`lucide-react@0.263.1`). MIT-licensed, 24px grid, 2px stroke weight. Already in the codebase. No other icon libraries permitted — no emoji in production UI.

### 9.1 Sizing

| Context | Size | Tailwind |
|---------|------|----------|
| Canvas node badge | 14px | `w-3.5 h-3.5` |
| Panel inline / row actions | 14px | `w-3.5 h-3.5` |
| Panel section header | 16px | `w-4 h-4` |
| Toolbar / navigation | 20px | `w-5 h-5` |
| Empty state | 40px | `w-10 h-10` |

### 9.2 Colour rule

Icons inherit colour from their context — they do not carry fixed colours. This follows the three-channel principle (§1): colour communicates state, not identity.

- **Canvas:** entity colour of the node type (goal yellow, info blue, etc.)
- **Semantic contexts** (alerts, status, coaching): semantic colour (`text-success`, `text-danger`, `text-info`, `text-warning`)
- **Neutral contexts** (actions, navigation, metadata): `text-text-light` at rest; `text-text-body` on hover
- **Bias category icons:** always `text-text-light` — shape differentiates, not colour

### 9.3 Icon tiers — space efficiency

Icons in panels follow three visibility tiers to minimise visual clutter:

**Tier 1 — Navigation (always visible, no label).** Actions users perform constantly: expand/collapse (`ChevronDown`/`ChevronRight`), close (`X`), tab switching. Rendered in `text-text-light`, invisible until needed.

**Tier 2 — Actions (visible on hover/focus, tooltip mandatory).** Edit (`Pencil`), add evidence (`Link`), confirm (`Check`), help (`HelpCircle`), add (`Plus`), external link (`ExternalLink`). Hidden at rest, revealed on row/card hover. Keeps panels clean.

**Touch/narrow override:** When panel width is below 400px or on touch devices, tier 2 icons are always-visible since hover-to-reveal doesn't work.

**Tier 3 — Status (always visible, replaces text labels).** Biggest space saving — a 14px icon replaces a 100px text badge. Examples: `CheckCircle` for complete, `AlertTriangle` with count for issues, confidence glyph for confidence level.

### 9.4 Node-type icons

Used **off-canvas only** — in panel lists, driver rows, conversation panel node references, and search results. On the canvas, shapes (§10) identify node type instead.

| Node type | Icon | Rationale |
|-----------|------|-----------|
| Goal | `Target` | Bullseye = objective |
| Decision | `GitBranch` | Fork = choice point |
| Option | `Lightbulb` | Idea / path |
| Factor | `Settings` | Variable / parameter |
| Risk | `AlertTriangle` | Universal warning |
| Outcome | `TrendingUp` | Result / measurement |

### 9.5 State icons

| State | Icon | Colour |
|-------|------|--------|
| Ready / complete | `CheckCircle` | `text-success` |
| Error / not ready | `XCircle` | `text-danger` |
| Warning | `AlertTriangle` | `text-warning` |
| Info | `Info` | `text-info` |

### 9.6 Behavioural bias category icons

| Category | Icon | Rationale |
|----------|------|-----------|
| Anchoring | `Anchor` | Anchored to a reference point |
| Framing | `Frame` | How the decision is bounded |
| Confidence | `Gauge` | Calibration / certainty |
| Blind spots | `EyeOff` | What you're not seeing |

All four in `text-text-light` at rest, `text-text-body` on hover. Defer from PoC — revisit post-pilot.

### 9.7 Challenge/reflection icons

Challenge and reflection items in results panels use `HelpCircle` (Lucide) as the marker icon. Do not use inverted triangles — these are reserved for risk nodes (§10.1).

### 9.8 Olumi AI interaction icon

The only custom icon in the system. Marks any element where clicking triggers an AI interaction.

**Design:** The Olumi logo mark (circle–square–triangle composition) rendered as a single-colour glyph at icon scale, matching Lucide's 2px stroke weight. Must be visually distinct from Lucide icons.

**Colour:** `text-info` to signal interactivity. `text-text-light` at rest in dense contexts.

**Placement — two patterns only:**
- Small affordance on individual elements (nodes, driver rows, evidence items) meaning "discuss this with the AI"
- Conversation panel identity / AI avatar icon

### 9.9 Space rules

- **Icon-only buttons** (with tooltip) over labelled buttons for unambiguous actions. Minimum touch target 44x44px even when the icon is 14px.
- **Icon + short label** only where the action is ambiguous (e.g. `Plus` + "Add evidence").
- **No icons in running text** or descriptions.
- **Maximum three icon actions per row.** Beyond three, group into an overflow menu (`MoreHorizontal`).
- **Tooltips mandatory** on all icon-only interactive elements. Delay: 300ms. Position: above, centred.
- **No emoji.** All emoji in the codebase must be replaced with Lucide icons.

---

## 10. Node shape system

Shapes identify node type on the canvas. Grounded in causal graph convention where precedent exists, extended intuitively where it doesn't. See §1 three-channel principle — shapes handle "what it is" so colour and icons are free for other jobs.

### 10.1 Shape-to-node mapping

| Node type | Shape | Colour (solid fill) | Scientific basis |
|-----------|-------|---------------------|-----------------|
| Factor | Circle | `factor` (#B0A899) | Standard causal graph convention for observed variables |
| Option | Square | `option` (#AAA7E4) | Influence diagram convention for decision nodes |
| Goal | Diamond | `goal` (#F5C433) | Influence diagram convention for utility/value nodes |
| Decision | Hexagon | `info` (#2B7FA2) | Distinct junction shape — where paths converge to a resolution |
| Risk | Inverted triangle | `danger` (#EA7B4B) | Intuitive extension — universal caution symbol |
| Outcome | Upward triangle | `success` (#67C89E) | Paired opposite to risk's inverted triangle — positive direction |

### 10.2 Zoom behaviour

| Zoom level | Rendering | Text visible |
|------------|-----------|-------------|
| **Zoomed in** | Full node card with text label. Shape as small type indicator in the corner (14px). | Yes |
| **Zoomed out** | Shape replaces the card entirely. Solid entity colour fill, no border, no text. | No |

### 10.3 Off-canvas representation

When nodes are referenced outside the canvas (panel lists, conversation blocks, search results), use the node-type icon (§9.4) rather than the shape. Icons are more legible at panel scale (14px) than geometric shapes.

---

## 11. Confidence as visual language

Confidence is communicated through a context-dependent combination of cues — border style, colour, glyph badge, and confidence bar.

### 11.1 Confidence levels

| Level | Range | Colour | Glyph |
|-------|-------|--------|-------|
| High | 70–100% | Success (#67C89E) | ✓ |
| Medium | 40–69% | Info (#2B7FA2) | ~ |
| Low | 0–39% | Factor (#B0A899) | ? |

Confidence glyphs are rendered as text characters (not Lucide icons) inside styled badge containers.

### 11.2 Context-dependent rendering

| Context | Cues used | Example |
|---------|-----------|---------|
| **Canvas nodes** | Border style + colour + glyph badge | Solid green border with ✓ badge on a factor node |
| **Full-width cards** | Border style + colour + glyph badge | Dashed blue top border with ~ badge |
| **Panel driver rows** | Confidence bar + glyph badge | Filled bar at 75% width, green, with ✓ |
| **Compact lists** | Colour + glyph badge only | Green ✓ inline |

### 11.3 Border style mapping (canvas and full-width cards only)

| Level | Border style | Tailwind border |
|-------|-------------|----------------|
| High | Solid | `border-success border-solid` |
| Medium | Dashed | `border-info border-dashed` |
| Low | Dotted | `border-factor border-dotted` |

Low-confidence dotted borders use a minimum `border-[3px]` width to remain visible.

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
    <div
      className="h-full rounded-full bg-success"
      style={{ width: `${confidence}%` }}
    />
  </div>
  <span className="text-success" style={{ fontSize: 10, fontWeight: 700 }}>✓</span>
</div>
```

### 11.6 Evaluative colour thresholds

Single universal threshold system for any metric judged as good/moderate/poor. Aligns with confidence levels (§11.1).

| Range | Colour | Token | Meaning |
|-------|--------|-------|---------|
| 0–39% | Danger | `var(--danger)` | Needs attention |
| 40–69% | Warning | `var(--warning)` | Moderate |
| >= 70% | Success | `var(--success)` | Strong |

**Applies to:** Readiness bars (evidence, robustness, framing), stability bars, quality scores, quality label in sticky footer.

**Does NOT apply to:** Driver influence bars (magnitude, not quality — stay `var(--info)`), confidence bars in driver rows (use §11 confidence display with glyph badges), win probability (entity-coloured per option), count badges (state-based per §8.6).

Implement as shared utility: `getThresholdColour(value: number): string`.

---

## 12. Decision states

| State | Border | Background | Lucide icon |
|-------|--------|------------|-------------|
| Draft | 2px `factor` (#B0A899) | `bg-panel` | `Pencil` |
| Active | 2px `info` (#2B7FA2) | `bg-panel` | `Play` |
| Complete | 2px `success` (#67C89E) | `bg-panel` | `Check` |
| Blocked | 2px `danger` (#EA7B4B) | `bg-panel` | `AlertTriangle` |

---

## 13. Progress indicators

```css
/* Track */
background: rgba(38,38,38,0.10);
height: 8px;
border-radius: 4px;

/* Bar */
background: var(--goal);       /* #F5C433 — brand yellow */
transition: width 300ms ease-out;
```

Progress bars show completion, not quality — always goal yellow. For evaluative bars (readiness, stability), use threshold colours per §11.6.

---

## 14. Data visualisation

### 14.1 Chart colour sequence

Uses data layer tokens (§3.9). Ordinal only — no semantic meaning in charts.

### 14.2 Semantic chart elements

Tornado charts and directional indicators use semantic layer colours:
- **Positive direction:** success (#67C89E) fill at low opacity, success border
- **Negative direction:** danger (#EA7B4B) fill at low opacity, danger border
- **Uncertainty bands:** info (#2B7FA2) at 30% opacity
- **Target lines:** dashed, goal (#F5C433)
- **Threshold lines:** dotted, danger (#EA7B4B)
- **Gridlines:** panel-border (#EEE6D8) at 50% opacity
- **Axis labels:** `text-text-light` (#908D8D), `panelMeta` size (11px)

### 14.3 Chart accessibility

Never rely on colour alone. Add patterns for critical distinctions. Include data labels on hover/tap. Provide table view alternative.

---

## 15. Coaching card pattern

Distinct from error/warning. Used when the system suggests improvements. Feels encouraging, not blocking.

```tsx
<div className="bg-panel border-l-[3px] border-info rounded-lg px-4 py-3">
  <div className="flex items-center gap-2 mb-1">
    <Lightbulb className="text-info w-4 h-4" />  {/* Lucide */}
    <span className={typography.panelHeader + " text-info"}>Strengthen your model</span>
  </div>
  <p className={typography.panelBody + " text-text-body"}>
    Adding a time horizon to your goal would help the simulation produce more actionable results.
  </p>
</div>
```

**Key differences from alerts:** left border (not top), `bg-panel` background (neutral), Lucide `Lightbulb` icon (not `AlertTriangle`), encouraging copy ("strengthen" not "fix").

### 15.1 Most Valuable Step (MVS) card

Elevated coaching card for the single highest-priority action. Distinguished from standard coaching cards by success green treatment.

- Left border: `var(--success)` (green — "this is the positive action to take")
- Background: `bg-panel`
- Icon: Lucide `Lightbulb`
- Shadow: `var(--shadow-1)`

### 15.2 ReviewCardBlock variant selection

| Variant | When to use | Border | Background | Lucide icon | Tone |
|---------|-------------|--------|------------|-------------|------|
| **Alert** (default) | Risks, critical issues, validation failures | Top 3px `danger` | `bg-panel` | `AlertTriangle` | Direct: "This needs attention" |
| **Coaching** | Suggestions, evidence gaps, optional enhancements | Left 3px `info` | `bg-panel` | `Lightbulb` | Encouraging: "Consider strengthening..." |

---

## 16. Error, warning, and notification system

### 16.1 Severity levels

| Level | Colour | Lucide icon | When |
|-------|--------|-------------|------|
| Error | `danger` | `XCircle` | Something failed or is invalid. User must act. |
| Warning | `warning` | `AlertTriangle` | Something may cause problems. User can proceed. |
| Info | `info` | `Info` | Neutral context or guidance. No action required. |
| Success | `success` | `CheckCircle` | Action completed successfully. |

### 16.2 Escalation pattern

Use the lowest level sufficient to communicate the problem.

**Level 1 — Inline (field/element).** Red border + helper text with `AlertTriangle`. Appears on blur, clears on focus.

**Level 2 — Section banner (panel/card).** Full-width strip inside a panel: `bg-panel`, `border border-danger/30`, icon + message + action link. Dismissable for warning/info, persistent for error.

**Level 3 — Toast (transient, app level).** Slides in from top-right, auto-dismisses after 5 seconds (errors persist until manually dismissed). Maximum one visible at a time.

```css
background: var(--bg-panel);
border-radius: 12px;
padding: 12px 16px;
box-shadow: var(--shadow-2);
border-left: 3px solid {severity colour};
max-width: 360px;
```

**Level 4 — Blocking modal (critical).** Destructive actions, irrecoverable errors, session expiry only. Extremely rare.

### 16.3 Message anatomy

Every error/warning follows: what happened — why it matters — what to do about it.

- Never show error codes or technical identifiers
- Never use all caps — sentence case always
- Never stack multiple toasts
- Never use a modal for something that could be a banner
- Never leave an error without guidance on resolution

### 16.4 Canvas errors

Invalid edges, cycles, orphaned nodes: 2px `danger` border on the affected element + small `AlertTriangle` badge. Clicking opens the inspector with error detail. No text overlay on the canvas.

### 16.5 Conversation panel errors

Failed API calls, inference failures: system event message (centred, `text-danger`, `panelMeta` size) with retry link. Not a block card — infrastructure events, not conversation.

---

## 17. Empty and zero states

When a panel or section has no data, guide the user forward.

```tsx
<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
  <IconComponent className="text-text-light w-10 h-10 mb-3" />  {/* Lucide, 40px per §9.1 */}
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

## 18. Loading and skeleton patterns

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
<div className="flex items-center gap-3 py-4 px-4 bg-panel border border-info/30 rounded-lg">
  <Spinner className="text-info w-4 h-4" />
  <span className={typography.panelBody + " text-text-body"}>
    Running 1,000 simulations...
  </span>
</div>
```

---

## 19. Progressive disclosure

Complexity revealed on demand, not imposed.

**Levels:**
1. **Headline** — always visible. Plain language, one line.
2. **Explanation** — expandable. What this means in context.
3. **Methodology** — on request. Technical detail.

**Expand/collapse labels:** "More" with Lucide `ChevronDown` / "Less" with Lucide `ChevronUp`. Shortest, symmetric, uses icons per §9.

**Expanded content pattern:**
```tsx
<div className="mt-2 pl-3 border-l-2 border-panel-border">
  <p className={typography.panelBody + " text-text-light"}>{explanation}</p>
</div>
```

---

## 20. Conversational UI patterns

*Implementation status: target architecture. The Orchestrator conversation panel is being built via Track D (A.5 — A.6 — A.7). Block components described here are the implementation target; the current codebase uses a monolithic DraftChat component. See Conversational Orchestrator v3 for the full interaction specification.*

### 20.1 Message styling

| Element | Styling |
|---------|---------|
| **User message** | `bg-panel rounded-lg shadow-1` right-aligned, `text-text-body`, user avatar (§21.1) |
| **AI text** | No background (inline on canvas bg), `text-text-body`, left-aligned, AI avatar (§21.2) |
| **AI block** | Card with type-specific top border (§20.2) |
| **System event** | Centred, `text-text-light`, `panelMeta` size, no background |

### 20.2 Block rendering

Base block:
```css
background: var(--bg-panel);
border-radius: 20px;
padding: 24px;
box-shadow: var(--shadow-1);
```

Type-specific top borders (3px). Block type badges are small coloured dots (8px diameter, main colour fill) positioned top-left.

| Block type | Border colour | Badge colour | Rationale |
|-----------|--------------|-------------|-----------|
| FramingBlock | `info` (#2B7FA2) | `info` | Information/structuring |
| GraphPatchBlock | `goal` (#F5C433) | `goal` | Action required |
| FactBlock | `success` (#67C89E) | `success` | Computed results |
| CommentaryBlock | None (inline) | None | Explanation, no action |
| ReviewCardBlock | `danger` or `info` | `danger` or `info` | Alert or coaching — see §15.2 |
| ScenarioBlock | `option` (#AAA7E4) | `option` | Comparison |
| BriefBlock | `success` (#67C89E) | `success` | Deliverable |
| EvidenceBlock | `info` (#2B7FA2) | `info` | External information |

**Block actions:** Accept — primary button (`bg-primary text-text-on-color`). Edit — secondary button. Dismiss — text link (`text-text-light`).

**Block states:** proposed — actions visible. Accepted — green flash + Lucide `Check` → collapse (300ms). Dismissed — fade out (200ms) → removed. Rejected — danger border + AI explanation.

### 20.3 Typing and tool execution

```tsx
// AI thinking — three pulsing dots
<div className="flex items-center gap-2 py-2">
  <ThinkingDots className="text-info" />
</div>

// Tool execution
<div className="flex items-center gap-2 py-2 text-text-light">
  <Spinner className="w-3 h-3" />
  <span className={typography.panelMeta}>Running 1,000 simulations...</span>
</div>
```

### 20.4 Suggested action chips

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

## 21. User identity and AI avatar

### 21.1 User avatar

User identity colours sit entirely outside the semantic and entity palettes to avoid confusion with data colours.

**PoC treatment (single neutral):**
```css
width: 32px;
height: 32px;
border-radius: 999px;
background: var(--bg-canvas);        /* #F4F0EA — warm neutral */
border: 1px solid var(--border-default);
color: var(--text-body);
font-size: 12px;
font-weight: 600;
```

Content: user initials (e.g. "PH"). No colour assignment — every user looks the same. The product is about the decision, not the participants.

**Post-pilot:** Introduce a set of muted, desaturated user colours (soft slate blues, warm greys, muted mauves) that are clearly "people" not "data." Never assign user colours that overlap with entity or semantic colours.

### 21.2 AI avatar

The Olumi AI uses the custom logo mark icon (§9.8) as its avatar in conversational contexts.

```css
width: 32px;
height: 32px;
border-radius: 999px;
background: var(--bg-panel);
border: 1px solid var(--info);       /* Blue border — AI = interactivity */
color: var(--info);
```

The blue AI avatar contrasts with the neutral user avatar — AI is an active participant (blue = interactivity), the user is the decision-maker (neutral = human, grounded).

---

## 22. Accessibility

### 22.1 Requirements

- **WCAG AA** minimum contrast (4.5:1 text, 3:1 UI elements)
- **Touch targets:** minimum 44x44px (including icon-only buttons per §9.9)
- **Focus indicators:** always visible (§6.3)
- **Screen reader:** semantic HTML + ARIA labels
- **Keyboard:** full navigation, focus traps in modals
- **Reduced motion:** respect `prefers-reduced-motion` (§7.4)

### 22.2 Developer checklist

- [ ] No raw hex values in CSS/TSX
- [ ] No raw font-size/font-weight utilities
- [ ] No emoji — all replaced with Lucide icons (§9)
- [ ] No `bg-{colour}-light` on cards, banners, or pills (§3.2)
- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements (especially icon-only buttons)
- [ ] Keyboard navigation works
- [ ] Focus trap in modals/overlays
- [ ] Animations respect reduced motion
- [ ] Loading states implemented
- [ ] Error boundaries in place
- [ ] Colour is not sole information channel (§3.12)
- [ ] All 10–11px text has 12–14px accessible equivalent
- [ ] Tooltips present on all icon-only interactive elements (§9.9)
- [ ] Pill text is always `text-text-body` — never `text-{colour}` (§8.5)

---

## 23. Quick reference

### 23.1 Colour quick reference

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
| Primary button | `bg-primary text-text-on-color hover:bg-primary-hover` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |
| Canvas node fill | `bg-{entity}-light` (canvas only) |
| Panel entity hover | `bg-{entity}-light` (hover only) |

### 23.2 Component sizing

| Size | Button padding | Input height | Card padding |
|------|---------------|-------------|-------------|
| sm | 8px 16px | 36px | 16px |
| md | 12px 24px | 44px | 24px |
| lg | 16px 32px | 52px | 32px |

### 23.3 Z-index scale

| Layer | Value |
|-------|-------|
| base | 0 |
| dropdown | 100 |
| sticky | 200 |
| modal | 300 |
| popover | 400 |
| toast | 500 |

---

## 24. Key files

| File | Purpose |
|------|---------|
| `src/styles/brand.css` | CSS custom properties (colour source of truth) |
| `tailwind.config.js` | Tailwind colour mappings + border width extensions |
| `src/styles/typography.ts` | Typography tokens |
| `src/canvas/nodes/colors.ts` | Node colour classes |
| `src/canvas/theme/nodes.ts` | Node theme tokens |

---

## 25. Voice and tone

British English throughout. Conversational but professional. Encouraging without being patronising. Data-driven but accessible.

**Coaching tone examples:**
- "Adding a time horizon would strengthen this goal."
- "Your model could benefit from more evidence on market growth."
- Not: "Error: goal missing time horizon."
- Not: "WARNING: insufficient evidence."

---

*This is a living document. When conflicts arise with other documentation, this file takes precedence for all UI implementation decisions.*
