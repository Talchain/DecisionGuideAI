/**
 * ⭐ THE WORKING-RANGE BAND (prototype, Paul 25 Sep: an external factor shows
 * its range with a band — contract `rangePlot`, "A genuine supplied range only.
 * No probability density or confidence level is implied.").
 *
 *   25%  ▬▬▬▬▬▬▬▬▬  45%
 *
 * ⛔ IT DRAWS ONLY WHAT THE RANGE LINE ABOVE IT SAYS. `low` / `high` are the two
 * strings `resolveFactorPriorRangeEnds` returns — the very strings the
 * `Range: a to b` line prints — so the band cannot state a different range.
 * No display domain is carried by the prior, so none is drawn: the band IS the
 * range, end to end, with each end labelled beside it. Nothing about density,
 * confidence or a "current" point is implied, and no marker is drawn inside it.
 *
 * Decorative for assistive technology (`aria-hidden`): the range line above it
 * already states the same two numbers in words.
 */
import { typography } from '../../../styles/typography'

export function FactorRangeBand({ nodeId, low, high }: { nodeId: string; low: string; high: string }) {
  return (
    <span
      data-testid={`factor-range-band-${nodeId}`}
      aria-hidden="true"
      className="mt-1 flex w-full items-center gap-1.5"
    >
      <span data-testid={`factor-range-band-low-${nodeId}`} className={`${typography.edgeLabel} text-text-light tabular-nums`}>
        {low}
      </span>
      <span className="relative block h-1 min-w-[54px] flex-1 rounded-full bg-panel-border">
        {/* The band: neutral ink (Paul 23 Sep point 9 reserves Info blue for
            attention), thicker than the track, with an end tick at each bound
            (contract `rangePlot`: `M64 4v12M160 4v12`). */}
        <span className="absolute inset-x-0 top-1/2 block h-1.5 -translate-y-1/2 rounded-full bg-text-light/60" />
        <span className="absolute left-0 top-1/2 block h-2.5 w-px -translate-y-1/2 bg-text-light" />
        <span className="absolute right-0 top-1/2 block h-2.5 w-px -translate-y-1/2 bg-text-light" />
      </span>
      <span data-testid={`factor-range-band-high-${nodeId}`} className={`${typography.edgeLabel} text-text-light tabular-nums`}>
        {high}
      </span>
    </span>
  )
}
