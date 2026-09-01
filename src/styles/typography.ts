/**
 * Olumi Typography System (Design System v5)
 *
 * Single font family: Inter for all text.
 * Full specification: docs/Design/Olumi_Design_System_v5.md
 *
 * Usage:
 * import { typography } from '@/styles/typography'
 * <h2 className={typography.h2}>Heading</h2>
 */

export const typography = {
  // Display (Hero)
  display: 'text-5xl font-bold font-sans leading-tight tracking-tight',

  // Headings - Inter (Olumi v1.2 aligned)
  h1: 'text-5xl font-semibold font-sans leading-tight',     // 48px
  h2: 'text-3xl font-semibold font-sans leading-tight',     // 30px (close to 32px)
  h3: 'text-2xl font-semibold font-sans leading-snug',      // 24px
  h4: 'text-xl font-medium font-sans leading-snug',         // 20px
  h5: 'text-lg font-medium font-sans leading-snug',         // 18px

  // Body - Inter (Olumi v1.2: Body is 16px)
  bodyLarge: 'text-lg font-sans leading-relaxed',           // 18px
  body: 'text-base font-sans leading-relaxed',              // 16px (guideline)
  bodySmall: 'text-sm font-sans leading-normal',            // 14px (minimum)

  // UI Elements - Inter (Olumi v1.2: Label is 14px)
  label: 'text-sm font-medium font-sans leading-normal',    // 14px (guideline)
  labelSmall: 'text-xs font-medium font-sans leading-normal', // 12px (badges only)
  caption: 'text-xs font-sans leading-normal',              // 12px (badges/chips)

  // Interactive - Inter
  button: 'text-sm font-semibold font-sans leading-none',   // 14px
  buttonSmall: 'text-xs font-semibold font-sans leading-none', // 12px
  link: 'text-sm font-medium font-sans underline hover:no-underline',

  // Specialized
  code: 'text-xs font-mono leading-normal',
  tabular: 'text-sm font-sans leading-normal tabular-nums', // 14px

  // Canvas/Graph - Inter (smaller for dense UI)
  //
  // ⭐ THE DECLARED SIZES BELOW ARE 12 / 11 / 10, AND THEY ARE WHAT THE USER
  // ACTUALLY SEES (17 Aug 2026 wired the counter-scale that made that true).
  //
  // ⚠ THIS COMMENT READ "DS v5 §2.3 ... 13 / 11 / 10" UNTIL 1 Sep 2026, FOUR
  // LINES ABOVE A TOKEN DECLARING 12px. #1088 moved the title to 12px
  // deliberately (the derivation is in the block on `nodeTitle` below) and did
  // not amend the sentence describing it — so the file contradicted itself, and
  // two visual specs that had copied the 13 threw on it. A comment that names a
  // number the code beside it does not use is the hand-maintained mirror at the
  // top of CLAUDE.md, at the shortest possible range.
  //
  // ⚠ DS v5 §2.3 ITSELF STILL SAYS 13px/semibold. The DOCUMENT is now the stale
  // half — rowed for the design-system owner, not edited from here.
  //
  // Canvas labels are DOM inside React Flow's viewport transform, which scales
  // glyphs. A post-draft graph clamps at the `LABEL_LEGIBLE_ZOOM` floor of 0.50,
  // so these three tokens were rendering at 6.5 / 5.5 / 5.0px — against §2.4's
  // 10px canvas floor, and past the point where the §2.4 small-font guardrail
  // (10–11px only for non-essential metadata) means anything at all.
  //
  // `--canvas-label-scale` is the counter-scale, written onto the React Flow
  // root by `CanvasLabelScaleSync` as `1 / zoom` across the legible band. The
  // `var(…, 1)` fallback is load-bearing: OUTSIDE that subtree the property is
  // unset, so every non-canvas use of these tokens resolves to exactly the same
  // font-size it had before this change. Derivation and bounds:
  // `src/canvas/utils/zoomLegibility.ts`.
  // ⭐ `font-medium`, not `font-semibold` (1 Sep 2026). At 13px on a card the
  // heavier weight read as a heading on every node at once, so nothing on the
  // board had emphasis — twenty shouting labels are twenty quiet ones. Medium
  // holds the hierarchy against the 11px body while letting the numbers and the
  // type glyph carry the emphasis instead.
  /**
   * ⭐ 13px → 11px (1 Sep 2026, Paul: "we haven't reduced the size of the font
   * or the weight at all to make it easier to fit more information and less
   * overwhelming").
   *
   * MEASURED CAUSE. On deployed `7d717c13` a node title rendered at **26px**
   * (13 declared × the counter-scale of 2) inside a **288px** card. That is
   * roughly 18 characters a line, so real titles ran to 3, 4 and 5 lines and
   * SIX of eighteen were clipped. The card was not too small; the type was too
   * big for it.
   *
   * ⛔ 12px, AND THE REASON IT IS NOT 11 IS THE BAND *BELOW* THE FLOOR.
   *
   * Rendered size is `declared × scale × zoom` and the scale is capped at
   * `1 / LABEL_LEGIBLE_ZOOM` = 2. At and above the floor the two cancel, so
   * rendered size equals DECLARED size and anything ≥ 10px satisfies Design
   * System v5 §2.4. That reasoning alone picks 11px, and I did pick 11px first.
   *
   * It is wrong just below the floor, where the cap has bitten and the zoom
   * keeps falling: rendered = declared × 2 × zoom. At zoom 0.45 —
   * inside the graceful-degradation band the product deliberately enters, and a
   * band where TITLES STILL RENDER — that is 11 × 2 × 0.45 = **9.9px**, under
   * the floor. 12px gives 10.8px and stays over it.
   *
   * Caught by `zoomLegibility.counterScale.spec.ts`'s "degrades gracefully
   * below the floor rather than falling off a cliff", which pins that exact
   * band. The cheaper reading was to call sub-floor text acceptable because the
   * product is already showing a "zoomed out" banner there — but a banner
   * explains a state, it does not license shipping type the design system
   * forbids. 12px costs ~8% of the width win instead of ~18% and needs no
   * argument.
   *
   * Effect: ~18% more characters a line at the same card width, and the card
   * itself narrows (see `NODE_TITLE_WIDEST_WORD_PX`, re-derived with it), so
   * more cards fit a row and the graph gets shorter — which is the same
   * laptop-legibility problem from the other end.
   *
   * ⚠ WEIGHT DELIBERATELY UNCHANGED at 500. It is the only thing separating a
   * title from a metric value once both are near the floor size; dropping it to
   * 400 would buy no space and cost the hierarchy.
   */
  nodeTitle: 'text-[length:calc(12px*var(--canvas-label-scale,1))] font-medium font-sans leading-tight',
  nodeLabel: 'text-[length:calc(11px*var(--canvas-label-scale,1))] font-sans leading-tight',
  edgeLabel: 'text-[length:calc(10px*var(--canvas-label-scale,1))] font-sans leading-tight',

  // Results Panel — strict 3-size system (Brief 5.5 §2.1 lock)
  // Only these three tokens should be used inside src/components/results/
  // and src/canvas/components/pre-analysis/.
  //
  // ⚠ THE 32px DISPLAY TOKEN WAS RETIRED ON 2026-08-31, AND IT SHOULD NOT COME
  // BACK. It existed for one thing — a headline win probability, set larger
  // than anything else on the panel. That is the anchoring bias Olumi's own
  // alignment principle names: the largest type in the product, first on
  // screen, on a number computed partly from values Olumi invented rather than
  // the user. It was rejected twice in design and shipped anyway, as the sole
  // consumer of this token, until `AtAGlance` was changed to lead with the
  // producer's own sentence instead. A panel that needs a bigger size than
  // `panelHeader` is a panel promoting a number; say it in words instead.
  panelHeader: 'text-sm font-semibold font-sans leading-snug',    // 14px — section titles, winner name, key emphasis
  panelBody: 'text-xs font-sans leading-relaxed',                 // 12px — body text, descriptions, bullets, card content
  panelMeta: 'text-[11px] font-sans leading-snug',                // 11px — badges, pills, axis labels, tertiary metadata

  // Conversation panel — ONE type scale (lane F3, register 1.69(a)).
  // The panel renders exactly three sizes — 14 (panelHeader / chatProse /
  // bodySmall), 12 (panelBody), 11 (panelMeta) — plus the named 24px
  // first-use hero (welcomeHeading below). chatProse is the message-prose
  // step: same 14px as panelHeader but regular weight with relaxed rhythm
  // for multi-line reading. Census-enforced: scripts/conversation-type-census.mjs
  // + tests/ci-guards/conversation-type-census.spec.ts fail on any new size.
  chatProse: 'text-sm font-sans leading-relaxed',                // 14px — chat message prose

  // AI Panel v2 first-use hero heading. Inter, 24px, semibold, calm rhythm.
  // Used exclusively by first-use welcome surfaces (FirstUseComposer, the
  // conversation EmptyState hero) so the hero reads as a prominent
  // invitation without breaking the strict panel-text hierarchy used
  // elsewhere. Neutral letter spacing — display tightening
  // (tracking-tight) felt off on this hero scale.
  welcomeHeading: 'text-[24px] font-semibold font-sans leading-snug', // 24px — AI Panel v2 hero only

  // Utility
  screenReaderOnly: 'sr-only',
} as const

export type TypographyKey = keyof typeof typography

/**
 * Helper to combine typography with additional classes
 */
export function typo(key: TypographyKey, additional?: string): string {
  return additional ? `${typography[key]} ${additional}` : typography[key]
}
