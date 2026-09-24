/**
 * StatusPill — small inline status indicator placed top-right of a node card.
 *
 * Used to flag a node that needs user input (factor missing value, goal missing
 * threshold). Replaces the legacy "?" overlay badge per Graph v1.1 wireframe v4
 * (FactorNeedsPre / GoalNoTargetPre).
 *
 * Spec (Polish 4 Task 6, SUPERSEDED by contract v3.1 — see `STATE_WORD_CLASSES`):
 * 10px text, 500 weight, 2px×8px padding, 10px radius, warning at 15% bg / 40%
 * border, warning text colour. The original 9px/1px spec was unreadable at
 * typical canvas zoom (80–100%). British English: colour.
 *
 * ⭐ 18 Aug 2026: that 11px was an INLINE `fontSize`, so it never saw the canvas
 * counter-scale and rendered at 5.5px at the 0.50 auto-fit floor — smaller than
 * the 9px this note records as already rejected at 80–100%. Same declared size,
 * now via the `nodeLabel` token (DS v5 §2.3), which carries the counter-scale.
 *
 * ⭐⭐ THIS COMPONENT NO LONGER POSITIONS ITSELF (2026-09-03). It hand-wrote
 * `absolute -top-2 -right-1 z-10` — one pixel from, and at the SAME z as,
 * `node-corner-stack-{id}` (`absolute -top-2 -right-2 z-10`), the container built
 * specifically to abolish same-corner overlap. It was the fourth occupant of that
 * corner to arrive with its own positioning authority, after rank vs coaching
 * (Codex P1-5) and the edited-since-run dot (Codex P2), and it was fixed the same
 * way all three were: ONE authority owns the corner, everything else is a static
 * flex child. `BaseNode.tsx` renders it inside that stack.
 *
 * ⚠ SO DO NOT RE-ADD AN OFFSET HERE. Nudging `-right-1` to `-right-2` is the
 * fix already rejected for the other three occupants: it leaves two positioning
 * authorities agreeing by coincidence, which is how each of them re-collided.
 *
 * Measured before the move (real Chromium, `e2e/geometry/statusPillCorner.measure.ts`,
 * 1440x900, starters `vendor-selection` / `build-vs-buy`, prior run in history):
 * the pill covered 15px² of the edited-since-run dot's 25px² — 60% of it. The
 * no-run-history arm of the same run measured zero, so the probe discriminated.
 */
import { memo } from 'react'
import { typography } from '../../../styles/typography'

interface StatusPillProps {
  label: string
  /** Tooltip text (defaults to label). */
  title?: string
  /**
   * ⭐ THE PILL'S IDENTITY, AND WHY IT IS A PROP RATHER THAN A CONSTANT.
   *
   * This testid was hardcoded `needs-input-pill` while the component was used
   * for exactly one claim. The moment a SECOND claim reuses the same pill —
   * "Not in this analysis", which is a different fact about a different
   * question — a spec asserting `needs-input-pill` starts passing on a node
   * that says no such thing. That is an assertion binding by APPEARANCE rather
   * than by IDENTITY, the defect trap 19 exists to name, and it would be
   * invisible: the element is present, the test is green, and the claim it
   * certifies is not the one on screen.
   *
   * Defaults to the original value, so every existing caller and every existing
   * spec is byte-identical.
   */
  testId?: string
  /**
   * ⭐ MT-21 (manual test on served `4c6ec07b`): a pill that names a gap the
   * user can close must not be INERT. When given, the pill is a button with the
   * SAME geometry, whose accessible name is `title` (the full claim and the
   * action) — so a card never states a gap and withholds the route to it.
   */
  onActivate?: () => void
}

/**
 * ⭐⭐ THE COLOUR MOVED TO THE BORDER, 17 Sep 2026 — RULE 5, AND THE REPO'S OWN
 * DESIGN SYSTEM SAID SO FIRST.
 *
 * Node design system, rule 5: *"Kind colour on the full border, the bars and the
 * glyphs — never on small text. Measured on this palette, no semantic colour
 * clears 3:1 on either panel ground, so text stays #262626 or #6E6B6B."*
 *
 * `DESIGN_SYSTEM.md` §"Pills and Badges" reaches the same rule from the other
 * end and is blunter about it — it lists `className="border border-danger/30
 * text-danger"` as an explicit ❌ WRONG example: *"Text on pills is always
 * `text-text-body` — never `text-{colour}`. Colour is carried by the border
 * only."* This pill was `text-warning bg-warning/15 border-warning/40`: the
 * named anti-pattern, at `typography.nodeLabel`.
 *
 * ⭐ AND A SIBLING COMPONENT HAD ALREADY MADE THIS EXACT MOVE AND WRITTEN DOWN
 * WHY. `NodeProvenanceMark` converted its own `border-info/40 text-info` pill on
 * 1 Sep, recording that `text-warning` and `text-success` measure **1.92:1** and
 * **2.02:1** against the card fill `--bg-panel` #FEFEFE, where SC 1.4.11 asks
 * 3:1 for a graphic that carries meaning. That measurement is this pill's too —
 * same tokens, same ground — and it sat one directory away for sixteen days.
 *
 * ⚠ THE FIX RAISES CONTRAST; IT DOES NOT TRADE IT. `text-text-body` (#3F3F3E)
 * over `bg-warning/15` on #FEFEFE is far above 4.5:1, against the 1.92:1 the
 * amber was reaching. The amber is not lost — it stays on the border and the
 * wash, which is where rule 5 puts it and where a colour-blind reader was never
 * relying on it anyway.
 *
 * ⛔ NOTHING ELSE MOVES: no padding, no border width, no `lineHeight`, no copy.
 * One token, so the pill's geometry is byte-identical and no card's height can
 * change. (That was the scope of the 17 Sep change. The wash, the border and
 * the geometry moved on 24 Sep for contract v3.1 — below.)
 */
/**
 * ⭐⭐ THE STATE WORD — contract v3.1 `.node .state-word` (deltas T04 / T06 /
 * F14 / FRAME-07 / PILL-01; DS v5 §8.5 "One treatment only: outlined. No
 * filled backgrounds on pills. Ever.").
 *
 * The contract: `border:1px solid #DDC6AB; border-radius:99px; padding:1px 6px;
 * font-size:10px; color:var(--ink); background:white`, weight normal. What it
 * replaced read as warning styling: an amber WASH (`bg-warning/15`), 12px
 * medium — the size of the body rows, where the contract's word is a step
 * below them — and a 0.5px border that is NOT counter-scaled (~0.33 device px
 * at the 65% landing zoom, so it vanished and left a tinted blob), with a 10px
 * radius that stopped being round once the counter-scaled text grew the pill.
 *
 *   · colour — `border-warning-ink/35` composites to ~#D8C6B6 on the panel,
 *     the nearest existing token to the contract's #DDC6AB (no new colour);
 *     the ground is `bg-panel`, the text stays `text-text-body` (10.45:1).
 *   · type — `edgeLabel` (11px × scale), the served ramp's equivalent of the
 *     contract's 10px (the served canvas ramp runs one step above it), weight
 *     normal.
 *   · geometry — `rounded-full`; padding in `em`, the contract's 1px/6px at
 *     10px, so it scales with the counter-scaled text instead of drifting; and
 *     a 1px border that is counter-scaled like the text, so it is one screen
 *     pixel at every zoom.
 *
 * The pill is a flex child of the ABSOLUTE corner stack, so no card box moves;
 * it gets ~1px shorter and ~12% narrower. Exported so every state word (the
 * goal's "Target not captured" chip, PILL-04) shares the one anatomy instead of
 * restating it.
 */
export const STATE_WORD_CLASSES =
  `${typography.edgeLabel} shrink-0 whitespace-nowrap inline-flex items-center gap-1 font-normal text-text-body bg-panel border border-solid border-warning-ink/35 rounded-full`
export const STATE_WORD_STYLE = {
  padding: '0.1em 0.6em',
  lineHeight: 1.3,
  borderWidth: 'calc(1px * var(--canvas-label-scale, 1))',
} as const

const PILL_CLASSES = STATE_WORD_CLASSES
const PILL_STYLE = STATE_WORD_STYLE

export const StatusPill = memo(({ label, title, testId = 'needs-input-pill', onActivate }: StatusPillProps) =>
  onActivate ? (
    <button
      type="button"
      aria-label={title ?? label}
      className={`${PILL_CLASSES} nodrag nopan cursor-pointer hover:bg-panel-hover hover:border-warning-ink/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      style={PILL_STYLE}
      title={title ?? label}
      data-testid={testId}
      data-node-tooltip="true"
      onClick={(e) => {
        e.stopPropagation()
        onActivate()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {label}
    </button>
  ) : (
    <span
      role="status"
      aria-label={title ?? label}
      className={PILL_CLASSES}
      style={PILL_STYLE}
      title={title ?? label}
      data-testid={testId}
    >
      {label}
    </span>
  ),
)

StatusPill.displayName = 'StatusPill'
