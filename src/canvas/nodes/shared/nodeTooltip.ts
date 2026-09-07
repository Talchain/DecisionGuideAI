/**
 * ONE hover delay for every node-surface tooltip.
 *
 * ⭐ THE DEFECT THIS SERVES, in the founder's words (6 Sep 2026, driving the
 * deployed canvas): *"if you hover over any individual icon, it doesn't tell you
 * what it is or what to do about it (with a hover state of any kind or something
 * like that)."*
 *
 * The affordance was not missing — it was NATIVE. A bare `title=` attribute
 * renders OS chrome after the platform's own ~1s dwell, with no visual change on
 * the icon and nothing under the pointer in the meantime, so a user who hovers
 * and sees nothing concludes the icon is inert. `NodeProvenanceMark` is the
 * sharpest case: it was converted from a text pill to a GLYPH precisely because
 * of the founder's standing ruling that repeated copy is furniture and *"they
 * should all be icons with hoverover states"* — and it shipped carrying only a
 * native `title`, i.e. an icon with no hover state at all.
 *
 * ⚠ 300ms IS NOT A TASTE. `src/components/Tooltip` records DS v5's recommended
 * 300ms in its own `delay` docstring, and the node surface is exactly the place
 * that needs it: an option card carries `BriefIcon` (`OptionNode.tsx:1445`),
 * `NodeProvenanceMark` (via `BaseNode.tsx:1169`) and one or more `ScienceIcon`s
 * (`OptionNode.tsx:1703`) within a few px of each other, so a 0ms tooltip
 * flickers a bubble at every pointer crossing. `MenuTooltip.useTooltipDelay`
 * independently arrived at the same 300ms for the context menu.
 *
 * It lives in its own module, rather than as a literal at each call site, so the
 * inventory spec can bind to the SAME symbol the components use — a repeated
 * literal is the hand-maintained mirror this estate keeps paying for.
 */
export const NODE_TOOLTIP_DELAY_MS = 300

/**
 * Classes for the tooltip's reference wrapper on the node surface.
 *
 * Node glyphs sit in `inline-flex` rows; `src/components/Tooltip`'s wrapper is a
 * plain block `<div>`, which would drop `shrink-0` and the row's alignment.
 */
export const NODE_TOOLTIP_WRAPPER = 'inline-flex shrink-0'
