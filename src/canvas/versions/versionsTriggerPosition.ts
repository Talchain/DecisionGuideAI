/**
 * Where the "Versions" trigger sits, relative to the OutputsDock.
 *
 * ── THE DEFECT THIS EXISTS TO MAKE IMPOSSIBLE ────────────────────────────────
 * The trigger shipped as `absolute top-3 right-3` (#720). The OutputsDock is
 * `position: fixed; right: 12; top: 12` (OutputsDock.tsx `asideStyle`). Both
 * anchor to the SAME viewport edge at the SAME inset, so the trigger landed
 * exactly on the dock's top-right chrome — and it carries `z-[1500]` against
 * the dock's `zIndex: 900`, so it won the stack.
 *
 * Measured on the deployed build `8e6f7629` at 1280x800, dock expanded:
 * `Collapse outputs dock` at x=1235 w=24 h=24; trigger at x=1173 w=95 h=33.5;
 * overlap 540px2 = 93.8% of the control, and
 * `document.elementFromPoint()` at the control's own centre returned the
 * TRIGGER. The dock's expand/collapse control could not be clicked at all —
 * Playwright reported "versions-panel-trigger intercepts pointer events".
 * The same measurement held 8/8 across four laptop viewports x both dock
 * states, so it is not a corner case.
 *
 * ── WHY THE OFFSET IS DERIVED, NOT A CONSTANT (trap 12) ──────────────────────
 * The obvious repair — "nudge the trigger left by 350px" — is a hand-copy of
 * the dock's width into a second file, and it goes stale silently the first
 * time the dock's width rule changes. It already would have: the dock's width
 * moved from a fixed 26rem to a viewport-proportional 280..480px band
 * (dockWidth.ts) three days before the trigger shipped.
 *
 * So the offset is expressed against the dock's OWN width authority, the
 * `--dock-right-expanded` custom property that `asideStyle` itself consumes,
 * with the SAME `24rem` fallback the dock declares. Producer and consumer read
 * one value; there is no second copy to drift.
 *
 * ── WHY THE *EXPANDED* WIDTH, IN BOTH DOCK STATES ────────────────────────────
 * The dock is narrow (a 40px rail) when collapsed and 280..480px when open,
 * and the trigger cannot see which — it owns no shared state, deliberately
 * (see VersionsPanelHost's header). Positioning against the EXPANDED width
 * unconditionally makes the clearance hold in BOTH states without the trigger
 * knowing anything about the dock: the expanded width is always the larger of
 * the two, so clearing it clears the rail as well. The trigger keeps ONE
 * resting place instead of jumping when the dock toggles.
 */

/**
 * The dock's own inset from the viewport edge — `asideStyle.right`. Not a
 * choice this module makes; it is where the dock is.
 */
export const DOCK_VIEWPORT_GUTTER_PX = 12

/** Visual breathing room between the trigger's right edge and the dock's left edge. */
export const TRIGGER_DOCK_GAP_PX = 12

/** The custom property `asideStyle.width` reads when the dock is open. */
export const DOCK_EXPANDED_WIDTH_VAR = '--dock-right-expanded'

/**
 * The fallback `asideStyle.width` declares for that property. It MUST equal
 * the dock's, or the two disagree in exactly the window where nothing has set
 * the variable yet — which is first paint, i.e. the state every fresh user
 * loads. Pinned by spec against OutputsDock's own source.
 */
export const DOCK_EXPANDED_WIDTH_FALLBACK = '24rem'

/**
 * The trigger's `right` inset, in px, given the dock's expanded width.
 *
 * The dock occupies `[gutter, gutter + dockWidth]` measured from the right
 * edge; the trigger begins where that ends, plus a gap.
 */
export function versionsTriggerRightOffsetPx(dockExpandedWidthPx: number): number {
  return DOCK_VIEWPORT_GUTTER_PX + dockExpandedWidthPx + TRIGGER_DOCK_GAP_PX
}

/**
 * The same rule as a CSS value, for the element that cannot know the dock's
 * pixel width at render time. Built from the constants above so the numeric
 * and CSS forms cannot drift.
 */
export function versionsTriggerRightOffsetCss(): string {
  const constant = DOCK_VIEWPORT_GUTTER_PX + TRIGGER_DOCK_GAP_PX
  return `calc(var(${DOCK_EXPANDED_WIDTH_VAR}, ${DOCK_EXPANDED_WIDTH_FALLBACK}) + ${constant}px)`
}

/** The trigger's `top` inset — level with the dock's own top edge. */
export const VERSIONS_TRIGGER_TOP_PX = DOCK_VIEWPORT_GUTTER_PX

export interface OverlapInput {
  /** Rendered width of the trigger button. */
  triggerWidth: number
  /** The trigger's `right` inset in px. */
  triggerRightOffset: number
  /** The dock's rendered width in px — 40 when collapsed to the rail. */
  dockWidth: number
}

/**
 * Horizontal overlap, in px, between the trigger and the dock.
 *
 * Both elements are anchored to the RIGHT edge, so the viewport width cancels
 * out of the arithmetic entirely — which is precisely why the guarantee holds
 * at every supported viewport rather than at the four that were measured. The
 * spec asserts that property directly rather than trusting this comment.
 */
export function triggerDockHorizontalOverlapPx({
  triggerWidth,
  triggerRightOffset,
  dockWidth,
}: OverlapInput): number {
  // Distances from the viewport's right edge, near edge first.
  const dockNear = DOCK_VIEWPORT_GUTTER_PX
  const dockFar = DOCK_VIEWPORT_GUTTER_PX + dockWidth
  const triggerNear = triggerRightOffset
  const triggerFar = triggerRightOffset + triggerWidth

  return Math.max(0, Math.min(dockFar, triggerFar) - Math.max(dockNear, triggerNear))
}
