/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RIGHT-HAND WORKSPACE SHELL CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ONE authority for the right-hand dock's layout. `OutputsDock.tsx` is the
 * shell; every tab body under it is a CHILD SURFACE. This module states what
 * the shell owns and what a child may never set — and everything a guard,
 * a spec or a child needs is EXPORTED from here, so nothing has to be
 * hand-copied anywhere else.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────
 * The dock lost 35% of its width (416px → 280px) and NOT ONE component
 * noticed: there were zero container queries across ~450 panel files, so
 * every child had baked its own assumptions about how much room it had.
 * The panel degraded and only the founder's eyes caught it. The fix is not
 * "make the children responsive one by one" — it is to give them ONE place
 * that answers "how wide am I, what type scale do I use, where does my
 * content scroll, and who owns the footer".
 *
 * ── WHAT THE SHELL OWNS · WHAT A CHILD MAY NOT DO ─────────────────────────
 *
 *  | The shell owns                        | A child surface may NOT             |
 *  |---------------------------------------|-------------------------------------|
 *  | The width budget (`dockWidth.ts`)     | Set its own width/min-width/max     |
 *  | The tab strip and its controls        | Render a tab, or add a strip control|
 *  | Which element scrolls, and its padding| Create a scroll container unless it |
 *  |                                       |   declared `scroll: 'self'`         |
 *  | The footer region and reserved space  | Use `position: sticky` bottom-anchored
 *  |                                       |   anywhere inside the body          |
 *  | Composer placement                    | Render a conversational composer    |
 *  |                                       |   (form inputs are a different class)|
 *  | Type scale, spacing scale, radius     | Use a raw font/spacing/radius utility|
 *  | Responsive behaviour (PANEL width)    | Use a viewport breakpoint (`sm:`…)  |
 *
 * ── HOW EACH OF THOSE IS ENFORCED (a rule nobody enforces is a comment) ───
 *  - scroll/padding ...... TYPE SYSTEM. `WORKSPACE_SURFACES` is a
 *                          `Record<OutputTab, …>` with REQUIRED `scroll` and
 *                          `padding` fields, so a new tab CANNOT COMPILE
 *                          without declaring both. This replaced a ternary on
 *                          tab id that silently gave every new tab the wrong
 *                          layout model by default.
 *  - width ............... `dockWidth.ts` is the only module that may compute
 *                          one; the conformance guard reds on a px dock-width
 *                          literal anywhere else in shell scope.
 *  - type / spacing /
 *    radius / sticky /
 *    viewport prefixes ... `tests/ci-guards/shell-conformance.spec.ts`, whose
 *                          rules are DERIVED FROM THE TOKENS BELOW — not from
 *                          a hand-listed allowlist. Add a token here and the
 *                          guard's vocabulary changes with it.
 *
 * ── FOR A CHILD-SURFACE LANE ──────────────────────────────────────────────
 * Read `SHELL_CONTENT_BUDGET_PX` and design to it. Read your surface's row in
 * `WORKSPACE_SURFACES` — it tells you whether YOU own scroll and padding or
 * the shell does. Use `usePanelWidth()` (see `usePanelWidth.tsx`) or the
 * `--panel-width` custom property for anything width-conditional; never a
 * `sm:`/`md:` viewport prefix, because the panel's width has almost nothing
 * to do with the viewport's.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ─────────────────────────────
 * It does not restyle child surfaces. Establishing the authority and
 * conforming the children are separate steps on purpose: a single change that
 * did both would be unreviewable and would land a redesign under cover of a
 * refactor.
 */

import type { OutputTab } from '../../../stores/uiStore'
import { DOCK_MIN_WIDTH, DOCK_RESPONSIVE_MAX_WIDTH } from '../dockWidth'

// ───────────────────────────────────────────────────────────────────────────
// 1. GEOMETRY — the width budget, stated once and derived downstream
// ───────────────────────────────────────────────────────────────────────────

/**
 * The shell's own gutter, in px. Tailwind `px-3`. The shell applies this to
 * whichever element scrolls; a `padding: 'self'` surface applies its own and
 * the shell applies none, so the two can never double up.
 */
export const SHELL_GUTTER_PX = 12

/** The shell's 1px border, both sides. Part of the budget, so it is named. */
export const SHELL_BORDER_PX = 1

/**
 * Content width available to a child at a given dock width.
 *
 * DERIVED — never write a content-width number into a child. At the 416px
 * default this is 390px; at the 280px drag floor it is 254px, and every child
 * surface must stay legible there.
 */
export function shellContentBudget(dockWidth: number): number {
  return dockWidth - 2 * SHELL_BORDER_PX - 2 * SHELL_GUTTER_PX
}

/** The budget at the default width (416px) — 390px. */
export const SHELL_CONTENT_BUDGET_PX = shellContentBudget(DOCK_RESPONSIVE_MAX_WIDTH)

/** The budget at the drag floor (280px) — 254px. The legibility target. */
export const SHELL_CONTENT_BUDGET_FLOOR_PX = shellContentBudget(DOCK_MIN_WIDTH)

/**
 * The CSS custom property the shell publishes its LIVE measured width on.
 *
 * Written from the dock's own `getBoundingClientRect()`, the same derive-don't-
 * duplicate pattern as `measureDockInset()`. A child that needs to branch on
 * width reads this (or `usePanelWidth()`), and is therefore correct on drag,
 * on resize and on a width nobody predicted.
 */
export const PANEL_WIDTH_CSS_VAR = '--panel-width'

// ───────────────────────────────────────────────────────────────────────────
// 2. SCALES — type, spacing, radius. The shell owns them; children inherit.
// ───────────────────────────────────────────────────────────────────────────

/**
 * DS v5 §2.2 — side panel UI uses ONLY THREE SIZES. These are keys into
 * `src/styles/typography.ts`, which stays the typography authority; this list
 * is the subset the panel is allowed to use, and it is what the conformance
 * guard treats as legal.
 *
 * DS §2.4 is stricter than it is usually quoted: raw sizes AND raw weights are
 * both banned. `panelBody font-semibold` is a violation — the tokens carry
 * their own weight, and needing semibold at 14px means you wanted
 * `panelHeader`.
 */
export const SHELL_TYPOGRAPHY_KEYS = ['panelHeader', 'panelBody', 'panelMeta'] as const
export type ShellTypographyKey = (typeof SHELL_TYPOGRAPHY_KEYS)[number]

/**
 * DS v5 §4.1 — the eleven-step spacing scale, in px.
 *
 * ⚠ These are NOT reachable from a Tailwind utility today: `brand.css` defines
 * them as `--space-*` custom properties and `tailwind.config.js` never extends
 * `theme.spacing`, so Tailwind's DEFAULT scale is in force and admits the
 * 2/6/10/14px half-steps this scale excludes. Wiring `theme.spacing` is the
 * WRONG fix — in Tailwind 3 `width`/`height`/`size`/`inset` derive from it, so
 * replacing it silently deletes ~588 sizing utilities including the product's
 * standard 14px icon (`w-3.5`, 179 uses), with no build error. The correct
 * mechanism is replacing the top-level `padding`/`margin`/`gap`/`space` keys.
 * That is a separate, harness-gated change; it is NOT done here.
 *
 * What IS done here: this array is the guard's vocabulary, so shell scope is
 * held to the scale even while the rest of the tree cannot be.
 */
export const SHELL_SPACING_SCALE_PX = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64] as const

/**
 * The Tailwind spacing steps that resolve to an on-scale px value
 * (`n × 4px`). DERIVED from `SHELL_SPACING_SCALE_PX`, so it cannot drift from
 * it: `p-3` → 12px → on scale; `p-2.5` → 10px → off scale.
 */
export const SHELL_SPACING_STEPS: readonly string[] = SHELL_SPACING_SCALE_PX.map(px =>
  String(px / 4),
)

/**
 * DS v5 §6.2 border radius, in px, with §6.2's explicit panel override:
 *
 *   - `panelCard`  12px — cards INSIDE a panel. The dock is a panel.
 *   - `standalone` 20px — standalone surfaces: the dock's own outer shell,
 *                         large panels, conversation blocks.
 *
 * The distinction is the whole point and it is routinely lost: a child that
 * reaches for the standalone radius inside the panel makes the dock look like
 * a stack of floating cards rather than one surface with sections in it.
 *
 * ⚠ KNOWN DEFECT, NOT FIXED HERE (derived, `ed98cbd3`): `--radius-lg` is
 * declared TWICE — `styles/brand.css:349` = 20px and `index.css:512` = 14px,
 * and `index.css` wins because `@import './styles/brand.css'` is hoisted above
 * its own `:root`. So the LIVE value of `rounded-lg` is 14px, matching neither
 * DS number, across 622 occurrences in product `.tsx`. Reconciling it is a
 * visible change at that scale and belongs behind the visual-regression
 * harness as its own reviewable step. These constants are the target; the
 * shell's OWN surfaces already use them.
 */
export const SHELL_RADIUS_PX = {
  /** Inputs, small buttons. DS `sm`. */
  input: 8,
  /** Cards inside the panel. DS `md`. THIS is the in-panel default. */
  panelCard: 12,
  /** The dock's outer shell and other standalone surfaces. DS `lg`. */
  standalone: 20,
  /** Pills and round buttons. DS `pill`. */
  pill: 999,
} as const

// ───────────────────────────────────────────────────────────────────────────
// 3. THE SURFACE REGISTRY — scroll and padding declared IN THE TYPE SYSTEM
// ───────────────────────────────────────────────────────────────────────────

/**
 * Who owns the scroll container for a surface.
 *
 *  - `'shell'` — the shell's body element scrolls. The surface renders plain
 *    content and MUST NOT contain an `overflow-y-auto` of its own; nesting a
 *    scroller inside the shell's scroller doubles the gutter and produces two
 *    scrollbars, which is exactly the defect Journey shipped.
 *  - `'self'`  — the surface owns its scroll. The shell hands it
 *    `flex-1 min-h-0` and NO overflow and NO padding.
 *
 * `'self'` is not a preference, it is a requirement for a surface whose
 * scrolling is a DIFFERENT KIND: Olumi's thread is bottom-anchored with a
 * stick-to-bottom threshold (`useSmartScroll`), while Analysis and Model are
 * top-anchored. A shell that owned scroll uniformly would break Olumi.
 */
export type ShellScrollOwner = 'shell' | 'self'

/** Who applies the gutter. Mirrors `ShellScrollOwner`; they must not double up. */
export type ShellPaddingOwner = 'shell' | 'self'

export interface WorkspaceSurfaceDescriptor {
  /** The tab id. Note `'diagnostics'` is the tab everyone CALLS "Model". */
  readonly id: OutputTab
  /** The user-visible label. */
  readonly label: string
  /** REQUIRED. See `ShellScrollOwner`. */
  readonly scroll: ShellScrollOwner
  /** REQUIRED. See `ShellPaddingOwner`. */
  readonly padding: ShellPaddingOwner
  /**
   * REQUIRED. Whether this surface is offered as a top-level tab at all.
   *
   * `false` means the capability is not mounted for users — it is NOT a
   * feature flag and must not become one. A surface is hidden here only when
   * showing it would advertise something the product cannot honour.
   */
  readonly presentedAsTab: boolean
  /** Why, in one line, when `presentedAsTab` is false. Empty otherwise. */
  readonly hiddenReason: string
}

/**
 * Every surface the dock can host.
 *
 * ⭐ THE MECHANISM: this is a `Record` over the `OutputTab` UNION with
 * `scroll` and `padding` REQUIRED. Adding a tab id to `OutputTab` without
 * adding a row here is a TYPE ERROR, and adding a row without declaring how it
 * scrolls is a TYPE ERROR. That is stronger than any guard, and it replaces
 * `effectiveActiveTab === 'results' || effectiveActiveTab === 'olumi' ? … : …`
 * — a ternary on tab id that decided between two incompatible layout models
 * and gave every NEW tab the wrong one silently.
 *
 * ⚠ IDENTITY TRAP, kept from `getOutputTabsForParity`: the tab a user calls
 * "Model" has id `'diagnostics'`. There is no tab whose id is `'model'`. A
 * spec that queries `'model'` binds to nothing and passes vacuously.
 */
export const WORKSPACE_SURFACES: Record<OutputTab, WorkspaceSurfaceDescriptor> = {
  olumi: {
    id: 'olumi',
    label: 'Olumi',
    // Bottom-anchored conversation with its own stick-to-bottom threshold.
    scroll: 'self',
    padding: 'self',
    presentedAsTab: true,
    hiddenReason: '',
  },
  results: {
    id: 'results',
    label: 'Analysis',
    // The Analysis body manages its own scroller so the pre-run readiness
    // layout can be a full-height flex column rather than a scrolling list.
    scroll: 'self',
    padding: 'self',
    presentedAsTab: true,
    hiddenReason: '',
  },
  compare: {
    id: 'compare',
    label: 'Compare',
    scroll: 'shell',
    padding: 'shell',
    presentedAsTab: true,
    hiddenReason: '',
  },
  diagnostics: {
    id: 'diagnostics',
    label: 'Model',
    scroll: 'shell',
    padding: 'shell',
    presentedAsTab: true,
    hiddenReason: '',
  },
  journey: {
    id: 'journey',
    label: 'Journey',
    scroll: 'shell',
    padding: 'shell',
    // ⭐ RULING (Paul, 17 Aug 2026): Journey stays hidden until it is a real
    // mounted capability. It was measured DARK end to end — its flag is absent
    // and, under a diagnostic override, the event feed stays empty after a full
    // journey: two independent breaks. A tab that opens onto nothing is the
    // Research-CTA defect in another costume — the product advertising an
    // action that terminates in nothing. It also cost a fifth of the tab strip
    // at the width where the strip is tightest.
    presentedAsTab: false,
    hiddenReason: 'Dark capability — empty event feed even under a flag override (Paul, 17 Aug 2026)',
  },
}

/** Left-to-right order of the tab strip. Olumi leads by product decision. */
export const WORKSPACE_SURFACE_ORDER: readonly OutputTab[] = [
  'olumi',
  'results',
  'compare',
  'diagnostics',
  'journey',
]

/**
 * The maximum number of tabs the strip can ever be asked to lay out.
 *
 * Recorded and asserted, so a sixth surface REDs rather than silently
 * overflowing the row at the drag floor. This counts surfaces that are
 * PRESENTED — a hidden one costs no strip width.
 */
export const MAX_PRESENTED_SURFACES = 4

/**
 * The surfaces offered as tabs, in strip order.
 *
 * Flag state still applies on top of this (Olumi and Compare are flagged);
 * `presentedAsTab: false` is the stronger statement and is not a flag.
 */
export function presentedSurfaces(): WorkspaceSurfaceDescriptor[] {
  return WORKSPACE_SURFACE_ORDER.map(id => WORKSPACE_SURFACES[id]).filter(s => s.presentedAsTab)
}

// ───────────────────────────────────────────────────────────────────────────
// 4. DERIVED LAYOUT — the shell's body classes come from the declaration
// ───────────────────────────────────────────────────────────────────────────

/**
 * The class list for the shell's body element, for a given surface.
 *
 * DERIVED FROM THE DECLARATION, so the layout model a surface gets is the one
 * it asked for, and a new surface gets whatever it declared rather than
 * whatever the ternary's else-branch happened to be.
 */
export function shellBodyClassName(surface: WorkspaceSurfaceDescriptor): string {
  const base = 'flex-1 min-h-0'
  if (surface.scroll === 'self') {
    // The shell reserves the space and gets out of the way. No overflow, no
    // padding — the surface owns both.
    return `${base} flex flex-col overflow-hidden`
  }
  const gutter = surface.padding === 'shell' ? 'px-3 py-3 space-y-4' : ''
  return `${base} olumi-scrollbar overflow-y-auto ${gutter}`.trim()
}
