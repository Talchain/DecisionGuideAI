/**
 * ⭐ THE OLUMI AI INTERACTION ICON — Design System v5 §9.8, "the only custom
 * icon in the system". It marks an element whose click starts an AI
 * interaction: ask, challenge, add context, discuss.
 *
 * WHY IT EXISTS NOW. The spec shipped without a component, so every ask on the
 * panel borrowed Lucide `Sparkles` — which `DESIGN_SYSTEM.md` §Tier 3 also
 * registers as the provenance glyph for an AI ESTIMATE. One glyph meant both
 * "Olumi estimated this" and "ask Olumi about this", and the Reasoning review
 * tool puts those two side by side. This icon is the ask; `Sparkles` stays
 * provenance.
 *
 * GEOMETRY. The FULL Olumi mark (Paul, 28 Sep 2026: "use this Olumi icon … where we have an icon to communicate
 * with Olumi's AI"), drawn from `public/olumi-mark.svg`: the ring's three arcs stroked in `currentColor` (so they
 * follow text colour and disabled states, `strokeWidth` scaled from Lucide's 2px), and the orange circle, blue
 * triangle and green square filled from the `--olumi-mark-*` tokens in `brand.css`.
 *
 * Props mirror the Lucide subset this panel uses (`className`, `size`,
 * `strokeWidth`, `aria-hidden`), so a call site can swap it for a Lucide icon
 * without changing shape.
 */
import type { SVGProps } from 'react'

export interface OlumiAiIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  strokeWidth?: number | string
}

export function OlumiAiIcon({
  size = 24,
  strokeWidth = 2,
  className,
  ...rest
}: OlumiAiIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 680 680"
      fill="none"
      className={className}
      data-icon="olumi-ai"
      aria-hidden={rest['aria-label'] === undefined ? true : undefined}
      focusable="false"
      {...rest}
    >
      {/* `public/olumi-mark.svg` (the 1.5× ring that holds at 14–16 px). The ring follows the text colour; the three
          shapes are the brand's own colours, from tokens. */}
      <g transform="translate(13 49)">
        <g fill="none" stroke="currentColor" strokeWidth={Number(strokeWidth) * 26.1} strokeLinecap="butt">
          <path d="M460.5 561.0A244.8 244.8 0 0 1 159.0 460.1" />
          <path d="M138.8 250.4A244.8 244.8 0 0 1 317.9 94.6" />
          <path d="M547.8 167.1A244.8 244.8 0 0 1 609.1 380.8" />
        </g>
        <circle cx="447" cy="95" r="95.5" fill="var(--olumi-mark-orange)" />
        <path d="M0 432L226 432L112.5 243Z" fill="var(--olumi-mark-blue)" />
        <rect x="484" y="412" width="170" height="170" fill="var(--olumi-mark-green)" />
      </g>
    </svg>
  )
}
