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
 * GEOMETRY. The logo mark (`public/olumi-logo.png`): circle top right,
 * triangle left, square bottom right, as a single-colour outline at Lucide's
 * 24px grid and 2px stroke, so it sits in a row of Lucide icons without
 * looking foreign. The logo's connecting arcs are left out: at 16px they read
 * as noise.
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-icon="olumi-ai"
      aria-hidden={rest['aria-label'] === undefined ? true : undefined}
      focusable="false"
      {...rest}
    >
      <circle cx="15.5" cy="6" r="3" />
      <path d="M5.5 10.5 9 16.5H2Z" />
      <rect x="16" y="15" width="5.5" height="5.5" rx="0.5" />
    </svg>
  )
}
