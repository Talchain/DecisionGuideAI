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

/**
 * The shell's CSS container name. A child may write
 * `@container workspace-shell (max-width: 320px) { ... }` and it will match —
 * measured, not assumed (see the block at `OutputsDock.tsx`'s `asideStyle`,
 * and the browser assertion in `e2e/visual/shellLayout.visual.spec.ts`).
 *
 * ⚠ Use THIS rather than a viewport breakpoint. The dock is 416px at a 1280px
 * viewport and 416px at 3840px, and 280px on a drag at either — so `sm:`/`md:`
 * answer a question about the window that has almost nothing to do with the
 * panel. The conformance guard REDs on viewport prefixes in shell scope for
 * exactly this reason.
 */
export const SHELL_CONTAINER_NAME = 'workspace-shell'

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
 *
 * ⚠ FOUR KEYS, STILL THREE SIZES. `panelTabular` (added 4 Sep 2026) is
 * `panelBody`'s size and weight with `tabular-nums` — 12px either way — so the
 * ONLY-THREE-SIZES rule above is unchanged by it. It is listed here because
 * this list is what the conformance guard names as legal, and omitting a token
 * the panel is meant to use would send the next lane to delete it.
 */
export const SHELL_TYPOGRAPHY_KEYS = [
  'panelHeader',
  'panelBody',
  'panelMeta',
  'panelTabular',
] as const
export type ShellTypographyKey = (typeof SHELL_TYPOGRAPHY_KEYS)[number]

/**
 * ⚠⚠ THE INHERITED BASELINE MOVED. READ THIS BEFORE MEASURING ANYTHING.
 *
 * The dock body used to inherit `typography.caption`; it now inherits
 * `typography.panelBody`. Both are 12px, so this reads like a rename — it is
 * not. `caption` is `leading-normal` (1.5) and `panelBody` is `leading-relaxed`
 * (1.625), and **line-height inherits**, so EVERY descendant that does not set
 * its own `leading-*` moved with it. Measured live in Chromium on all four
 * mounted tabs: `outputs-dock-body` computes **12px / 19.5px** where it
 * previously computed 12px / 18px.
 *
 * Second change in the same family: the tab buttons were
 * `caption font-medium` and are now `panelBody`, i.e. **weight 500 → 400**.
 * Narrower glyphs — which means the tab-strip headroom figures recorded in the
 * shell PR were taken at weight 400, and a child measuring against the older
 * numbers will be measuring a different product.
 *
 * Both are DS v5 §2.2/§2.4 corrections and both are INTENDED. `caption` is not
 * in the panel scale at all, and §2.4 forbids weight overrides on panel tokens.
 * They are written down here because they are baked into the re-blessed visual
 * references, and four child lanes are about to start from that baseline: a
 * lane told "nothing moved" would attribute the extra 1.5px of leading to its
 * own change.
 */
export const SHELL_INHERITED_BODY_TYPOGRAPHY: ShellTypographyKey = 'panelBody'

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
  /**
   * REQUIRED. Which surface-level bar, if any, the SHELL renders into its
   * reserved footer region for this surface.
   *
   * The shell owns the footer region; a surface never pins its own bar with
   * `sticky bottom-0` inside the scrolling body, because that covers whatever
   * the shell rendered below it. But a bar that carries a stale warning and
   * the surface's only re-run control also cannot simply be dropped into the
   * end of a long scrolling list, where it lands several screens below the
   * fold. Declaring it here is how a surface asks the shell to host it.
   *
   * ⭐ THIS FIELD IS THE CANONICAL OWNER OF "WHAT DOES THE SHELL PUT UNDER THIS
   * SURFACE", AND IT IS THE ANSWER TO A RECURRING SHAPE, NOT A ONE-OFF. Both
   * values exist because a control the user needs lives inside
   * `OutputsDock`'s `results` render branch — `{effectiveActiveTab ===
   * 'results' && …}` — and is therefore UNMOUNTED, not merely hidden, on every
   * other surface:
   *
   *   'reanalyse' — the Model surface had no re-run control at all, because
   *                 `AnalysisFooter` mounts on `results` only.
   *   'readiness' — the Olumi surface had no statement of WHY the run is
   *                 blocked, because the pre-analysis footer mounts on
   *                 `results` only. That mattered more than it sounds: the
   *                 blocked footer's own copy says *"Ask in the chat what they
   *                 need"*, and acting on it fronts the Olumi tab, which takes
   *                 the sentence and the Analyse control off screen. The
   *                 instruction destroyed its own context.
   *
   * ⚠ WHY THE FIX IS A FOOTER DECLARATION AND NOT A MOUNT CHANGE. Making the
   * `results` subtree survive a tab switch (as Olumi's does) would preserve its
   * STATE and change nothing a user can see — a CSS-hidden subtree is still
   * invisible. And Olumi's mount is not the anomaly to copy in the other
   * direction: it is deliberate and load-bearing (`OutputsDock.tsx`'s wrapper
   * comment; `OlumiTabBody`'s guidance-store callbacks are registered with no
   * cleanup precisely because it stays mounted). The asymmetry is fine. What
   * was missing was a way for the surface the user is SENT TO to carry the fact
   * they were sent to ask about.
   */
  readonly footerBar: 'none' | 'reanalyse' | 'readiness'
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
    // `AnalysisReadinessBar` — the pre-run readiness statement, carried to the
    // surface the blocked footer's own copy sends the user to. Renders null
    // unless the Analysis surface would be showing its pre-run panel for the
    // same store state, so it makes no claim Analysis is not already making.
    footerBar: 'readiness',
    // Bottom-anchored conversation with its own stick-to-bottom threshold.
    scroll: 'self',
    padding: 'self',
    presentedAsTab: true,
    hiddenReason: '',
  },
  results: {
    id: 'results',
    label: 'Analysis',
    // The Analysis surface has its own always-visible `AnalysisFooter`, which
    // is already a flex sibling of its scroller and owns stale + Rerun there.
    footerBar: 'none',
    // The Analysis body manages its own scroller so the pre-run readiness
    // layout can be a full-height flex column rather than a scrolling list.
    scroll: 'self',
    padding: 'self',
    presentedAsTab: true,
    hiddenReason: '',
  },
  /**
   * TEMPORARY comparison surface (Paul, 27 Aug 2026) — "Analysis (New)".
   *
   * A SECOND, SEPARATE Analysis tab rendering the SAME analysis run through a
   * reasoning-led IA (Key insights · Strengthen the reasoning · Drivers and
   * dynamics · Uncertainty and gaps), so the existing Analysis surface and this
   * one can be compared directly on one scenario. `results` above is UNCHANGED
   * and stays the default tab; this row is purely additive.
   *
   * Sits directly after `results` so the two surfaces under comparison are
   * adjacent in the strip — the same placement rule the retired 'Alt view'
   * comparison tab used (PR #673). Unflagged, per the standing no-dark-launch
   * ruling: a flag here would add a second posture to reason about for a
   * surface whose whole purpose is to be looked at.
   *
   * `footerBar: 'reanalyse'` DELIBERATELY. The Rerun control and the stale
   * warning are then rendered BY THE SHELL, from the SAME `handleRunAnalysis`
   * the Model surface uses — so this experiment introduces no second run
   * authority and no second staleness owner. `AnalysisFooter` mounts on the
   * `results` branch only, so without this declaration the surface would have
   * no re-run control at all, which is the exact defect this field exists to
   * fix.
   *
   * `scroll`/`padding: 'self'` because the surface owns a narrower inner
   * content measure than the shell gutter provides (the dock's outer width is
   * unchanged — see the width note in `AnalysisNewTabBody.tsx`).
   */
  analysisNew: {
    id: 'analysisNew',
    label: 'Analysis (New)',
    footerBar: 'reanalyse',
    scroll: 'self',
    padding: 'self',
    presentedAsTab: true,
    hiddenReason: '',
  },
  compare: {
    id: 'compare',
    label: 'Compare',
    footerBar: 'none',
    scroll: 'shell',
    padding: 'shell',
    // ⭐ RULING (Fable, 18 Aug 2026): Compare's tab leaves the presented row.
    // It is STRUCTURALLY EMPTY for every staging guest —
    // `useCompareHistoryHydration.ts:79` early-returns without a `userId`, so a
    // guest who opens it reaches nothing — and beside Analysis it is a
    // competing hierarchy for the same question. Journey's row above is the
    // precedent and the same mechanism.
    //
    // ⚠ SCOPE, STATED NARROWLY (trap 20 — a record must not generalise the
    // finding it came from): this hides the TAB. Compare's CODE IS NOT DELETED;
    // retirement is a separate decision. Folding Compare into Analysis as an
    // accordion was the other half of the proposal and is DEFERRED, not built.
    //
    // ⚠⚠ AND THE LIMIT OF THIS FIELD, BECAUSE THE HEADER ABOVE OVERSTATES IT.
    // `presentedAsTab: false` is a statement about the TAB ROW — the strip, the
    // collapsed icon rail, and the `?tab=` deep link all derive from
    // `presentedSurfaces()` and are closed by it. It is NOT a statement about
    // reachability: the dock's activation guards are keyed on the FLAG, not on
    // this field (`OutputsDock.tsx:519`, `:580`), and `compareTab` is ON in the
    // build config (`netlify.toml:157`). So a programmatic `setActiveOutputTab
    // ('compare')` still fronts the Compare BODY (`OutputsDock.tsx:3155`) with
    // no tab lit — reachable today from `OptionPanel.tsx:422`, the
    // `showComparePanel` effect
    // (`ReactFlowGraph.tsx:819` → `OutputsDock.tsx:1902`) and an `open_panel`
    // ui_directive. Journey never exposed this because its flag is absent.
    // Closing it means teaching those guards to read this contract instead of
    // the flag; that is a SEPARATE, briefed change and is deliberately not
    // improvised here.
    presentedAsTab: false,
    hiddenReason:
      'Structurally empty for guests (compare history needs a userId); folds into Analysis pending the /v2/run retirement decision (Fable, 18 Aug 2026)',
  },
  diagnostics: {
    id: 'diagnostics',
    label: 'Model',
    // `ReanalyseBar` — this surface's ONLY stale warning and ONLY re-run
    // control. `AnalysisFooter` mounts on the `results` branch only, so
    // nothing else here offers a Rerun.
    footerBar: 'reanalyse',
    scroll: 'shell',
    padding: 'shell',
    presentedAsTab: true,
    hiddenReason: '',
  },
  journey: {
    id: 'journey',
    label: 'Journey',
    footerBar: 'none',
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

/**
 * Left-to-right order of the tab strip. Olumi leads by product decision.
 *
 * ⚠ THIS IS AN ORDERING HINT, NOT THE MEMBERSHIP LIST — and the distinction is
 * the whole point. It was originally a plain array that `presentedSurfaces()`
 * mapped over, which made it a hand-maintained mirror of the Record's keys
 * inside the file written to abolish hand-maintained mirrors. Proven by
 * mutant: a surface marked `presentedAsTab: true` in the Record but omitted
 * here rendered NOWHERE, with tsc clean and the whole guard suite green, and
 * `MAX_PRESENTED_SURFACES` defeated because the count was taken from this
 * array rather than from the Record.
 *
 * Membership now comes from `WORKSPACE_SURFACES` — the type-checked source of
 * truth — and this only sorts it. An id missing from here still renders, at
 * the end, and the conformance guard REDs on the mismatch so the ordering gets
 * fixed deliberately rather than a surface disappearing silently.
 */
export const WORKSPACE_SURFACE_ORDER: readonly OutputTab[] = [
  'olumi',
  'results',
  // Directly after 'results' so the two surfaces under comparison are adjacent
  // in the strip (Paul, 27 Aug 2026 — the same placement rule the retired
  // 'Alt view' comparison tab used).
  'analysisNew',
  'compare',
  'diagnostics',
  'journey',
]

/**
 * The number of tabs the strip is currently asked to lay out.
 *
 * ⚠ THIS IS A RECORDED LITERAL, NOT A DERIVATION, AND THAT IS DELIBERATE —
 * the header of this file bans hand-maintained mirrors, so the exception needs
 * its reason stated. Setting it to `presentedSurfaces().length` would make
 * shell-conformance's *"the strip never has to lay out more than the recorded
 * maximum"* a tautology: it could never RED, because the budget would move to
 * meet whatever the Record said. A guard that agrees with itself is worse than
 * no guard. So the number stays written down, the conformance case asserts
 * EQUALITY against the Record, and any change to the presented set — a surface
 * added OR one hidden — must be re-recorded here deliberately.
 *
 * ⚠ The prose here used to say *"a sixth surface REDs"* while the value was 4;
 * it was written when five surfaces were presented and was never re-read. Do
 * not restate the count in words. Derive it: `presentedSurfaces().length`.
 *
 * Was 4 until 18 Aug 2026; 3 since Compare's row was hidden by contract; 4
 * again since 27 Aug 2026, when the temporary 'Analysis (New)' comparison
 * surface was added beside Analysis. It returns to 3 when that experiment
 * retires — re-record it here in the same change, deliberately.
 */
export const MAX_PRESENTED_SURFACES = 4

/**
 * The surfaces offered as tabs, in strip order.
 *
 * Flag state still applies on top of this (Olumi and Compare are flagged);
 * `presentedAsTab: false` is the stronger statement and is not a flag — a
 * surface hidden here stays out of the strip with its flag ON, which is what
 * the Compare row is a live test of (`journey`'s flag is absent, so it could
 * never distinguish the two).
 */
export function presentedSurfaces(): WorkspaceSurfaceDescriptor[] {
  // Iterate the RECORD (membership), then sort by ORDER (presentation). An id
  // absent from ORDER sorts last rather than vanishing — see ORDER's header.
  const rank = (id: OutputTab) => {
    const i = WORKSPACE_SURFACE_ORDER.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return (Object.keys(WORKSPACE_SURFACES) as OutputTab[])
    .map(id => WORKSPACE_SURFACES[id])
    .filter(s => s.presentedAsTab)
    .sort((a, z) => rank(a.id) - rank(z.id))
}

/**
 * The descriptor for a tab id, with a documented fallback.
 *
 * The shell indexes `WORKSPACE_SURFACES[activeTab]` to derive its body layout.
 * The reviewer found no reachable path that supplies an unknown id — but the
 * old tab-id ternary DEGRADED to an empty-ish body where a bare index THROWS,
 * and a render-time throw in the shell takes the whole dock down. One line
 * removes the class of failure rather than arguing about its reachability.
 */
export function surfaceFor(tab: OutputTab | string): WorkspaceSurfaceDescriptor {
  return WORKSPACE_SURFACES[tab as OutputTab] ?? WORKSPACE_SURFACES.results
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
