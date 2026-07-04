/**
 * HeroOptionRow — one option row: numbered token, label, chart track,
 * readout, and a disclosure detail region.
 *
 * Accessibility scaffold follows the proven FocusRowCard / CoachingActionCard
 * contract: the row header is a native <button> carrying aria-expanded +
 * aria-controls, the detail region is mounted only when open and labelled by
 * the row, and one-open-at-a-time is controlled by the parent. The lens
 * leader is perceivable without colour: filled (vs outlined) number token,
 * aria-current on the row button, and a visually-hidden "Leads on this view"
 * cue.
 *
 * Track positions are LAYOUT ONLY — percentages of the track width computed
 * from existing values; they are never displayed as data. Bars and dots
 * animate via transform/opacity exclusively (no left/width animation), and
 * the row DOM persists across lens switches so values morph without a
 * remount. Reduced motion is respected via motion-reduce:transition-none.
 *
 * Option labels are producer/user content rendered as escaped React text
 * nodes — no raw HTML injection of any kind.
 */
import { useId } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'
import { HERO_COPY } from './heroCopy'
import type { HeroLens, HeroRowVM } from './heroTypes'

export interface HeroOptionRowProps {
  row: HeroRowVM
  lens: HeroLens
  isLeader: boolean
  isOpen: boolean
  onToggle: () => void
  /** False while stale — rows render but do not respond. */
  interactive: boolean
  /** Layout-only outcome domain; null hides outcome bars. */
  outcomeDomain: { min: number; max: number } | null
  /** Unit-compatible target value, or null (marker hidden). */
  targetValue: number | null
}

/**
 * Shared row grid: number+label · track · readout · chevron slot. The axis
 * header in AnalysisHeroPanel uses the same template so columns align.
 */
export const HERO_ROW_GRID =
  'grid w-full grid-cols-[minmax(0,7.5rem)_1fr_auto_0.875rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left'

/** Clamp a layout fraction to the track (layout maths only). */
function trackPct(fraction: number): number {
  return Math.max(0, Math.min(100, fraction * 100))
}

export function HeroOptionRow({
  row,
  lens,
  isLeader,
  isOpen,
  onToggle,
  interactive,
  outcomeDomain,
  targetValue,
}: HeroOptionRowProps) {
  const regionId = useId()
  const labelId = useId()

  // Per-lens layout positions (percent of track width). null → hidden.
  let barStart: number | null = null
  let barEnd: number | null = null
  let dotPos: number | null = null
  let targetPos: number | null = null
  if (lens === 'goal') {
    if (row.goal.value != null) {
      barStart = 0
      barEnd = trackPct(row.goal.value)
      dotPos = barEnd
    }
  } else if (outcomeDomain) {
    const span = outcomeDomain.max - outcomeDomain.min
    const pos = (v: number) => trackPct((v - outcomeDomain.min) / span)
    if (row.outcome.p10 != null && row.outcome.p90 != null) {
      barStart = pos(row.outcome.p10)
      barEnd = pos(row.outcome.p90)
    }
    if (row.outcome.centre != null) dotPos = pos(row.outcome.centre)
    if (targetValue != null) targetPos = pos(targetValue)
  }

  const readout = lens === 'goal' ? row.goal.readout : row.outcome.readout
  const readoutSuffix =
    lens === 'goal' && row.goal.value != null ? ` ${HERO_COPY.readout.goalSuffix}` : ''

  const expandable = row.hasDetail && interactive
  const Chevron = isOpen ? ChevronDown : ChevronRight

  const rowGrid = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded ${typography.panelMeta} ${
            isLeader
              ? 'bg-primary text-text-on-color'
              : 'border border-option/40 bg-transparent text-text-body'
          }`}
        >
          {row.index}
        </span>
        <span
          id={labelId}
          className={`${typography.panelBody} min-w-0 flex-1 truncate text-left text-text-header`}
        >
          {row.label}
          {isLeader && <span className="sr-only"> ({HERO_COPY.srLeader})</span>}
        </span>
      </span>

      {/* Chart track — layout-only positions, transform/opacity animation. */}
      <span aria-hidden="true" className="relative block h-5 min-w-0">
        <span className="absolute inset-x-0 top-1/2 h-px bg-panel-border" />
        {/* Target marker (outcome lens, unit-compatible threshold only). */}
        <span
          data-testid="hero-target-marker"
          data-visible={targetPos != null ? 'true' : 'false'}
          className="absolute inset-0 transition-transform motion-reduce:transition-none"
          style={{
            transform: `translateX(${targetPos ?? 0}%)`,
            opacity: targetPos != null ? 1 : 0,
          }}
        >
          <span className="absolute bottom-0.5 left-0 top-0.5 w-0 border-l-2 border-dashed border-warning" />
        </span>
        {/* Range / probability bar: full-width element scaled from the left. */}
        <span
          className={`absolute left-0 h-1.5 w-full rounded-full transition-transform motion-reduce:transition-none ${
            isLeader ? 'bg-primary/40' : 'bg-option/30'
          }`}
          style={{
            top: 'calc(50% - 3px)',
            transformOrigin: 'left',
            transform: `translateX(${barStart ?? 0}%) scaleX(${
              barStart != null && barEnd != null ? Math.max(barEnd - barStart, 0) / 100 : 0
            })`,
            opacity: barStart != null && barEnd != null ? 1 : 0,
          }}
        />
        {/* Centre dot: full-width positioner translated by track percent. */}
        <span
          className="absolute inset-0 transition-transform motion-reduce:transition-none"
          style={{
            transform: `translateX(${dotPos ?? 0}%)`,
            opacity: dotPos != null ? 1 : 0,
          }}
        >
          <span
            className={`absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel ${
              isLeader ? 'bg-primary' : 'bg-option'
            }`}
          />
        </span>
      </span>

      <span
        className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
      >
        <span className={isLeader ? 'text-text-header' : 'text-text-body'}>{readout}</span>
        {readoutSuffix}
      </span>
      {/* Chevron slot is reserved on every row (invisible when static) so the
          track and readout columns stay aligned across the list. */}
      <Chevron
        aria-hidden="true"
        className={`h-3.5 w-3.5 flex-none text-text-light ${expandable ? '' : 'invisible'}`}
      />
    </>
  )

  return (
    <div data-testid={`hero-option-row-${row.index}`} data-option-id={row.id}>
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={regionId}
          aria-current={isLeader ? 'true' : undefined}
          className={`${HERO_ROW_GRID} transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset ${
            isOpen ? 'bg-panel-hover' : ''
          }`}
        >
          {rowGrid}
        </button>
      ) : (
        <div aria-current={isLeader ? 'true' : undefined} className={HERO_ROW_GRID}>
          {rowGrid}
        </div>
      )}

      {expandable && isOpen && (
        <div
          id={regionId}
          role="region"
          aria-labelledby={labelId}
          data-testid="hero-option-detail"
          className="space-y-1 pb-2 pl-9 pr-2 pt-0.5"
        >
          {row.detail.why && (
            <p className={`${typography.panelBody} text-text-body`} data-testid="hero-detail-why">
              <span className="text-text-header">
                {HERO_COPY.detail.whyLabel}
              </span>{' '}
              {row.detail.why}
            </p>
          )}
          {row.detail.couldChangeIf && (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-detail-could-change"
            >
              <span className="text-text-header">
                {HERO_COPY.detail.couldChangeIfLabel}
              </span>{' '}
              {row.detail.couldChangeIf}
            </p>
          )}
          {row.detail.winChance && (
            <p
              className={`${typography.panelBody} text-text-light`}
              data-testid="hero-detail-win"
            >
              {row.detail.winChance}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default HeroOptionRow
