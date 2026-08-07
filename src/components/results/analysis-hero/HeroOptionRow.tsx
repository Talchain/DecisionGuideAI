/**
 * HeroOptionRow — one option row: numbered token, label, chart track,
 * readout, and a disclosure detail region.
 *
 * Accessibility scaffold follows the proven FocusRowCard / CoachingActionCard
 * contract: the row header is a native <button> carrying aria-expanded +
 * aria-controls, the detail region is mounted only when open and labelled by
 * the row, and one-open-at-a-time is controlled by the parent. The lens
 * leader is perceivable without colour: filled (vs outlined) number token,
 * aria-current on the row button, and a visually-hidden "Highest on this view"
 * cue.
 *
 * Track positions are LAYOUT ONLY — percentages of the track width computed
 * from existing values; they are never displayed as data. Bars and dots
 * animate via transform/opacity exclusively (no left/width animation), and
 * the row DOM persists across lens switches so values morph without a
 * remount. Reduced motion is respected via motion-reduce:transition-none.
 *
 * No goal-target marker: the Likely outcome lens owns option comparison, and
 * a target far above the option spread would compress the bars. Target
 * attainment lives on the Goal fit lens (its probability readouts + the
 * sub-1% / no-option-on-track honesty). The goal lens draws NO track at all
 * (prototype v6: badge + label + probability only).
 *
 * Option labels are producer/user content rendered as escaped React text
 * nodes — no raw HTML injection of any kind.
 */
import { useEffect, useId, useRef, useState } from 'react'
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
  /** Layout-only outcome domain; null hides outcome bars. */
  outcomeDomain: { min: number; max: number } | null
  /**
   * ROADMAP 1.267: whether to draw the ordinal number token.
   *
   * The token reads `stableNumber ?? index`, and on a first run both are
   * seeded from the probability order — so "1" IS `rank == 1`, an ordinal
   * DESIGNATION rather than a measurement. On a withheld run it is omitted
   * entirely; the row keeps its label, readout, bar and disclosure.
   *
   * Separate from `isLeader` on purpose: `isLeader` removes the CROWN (which
   * marks ONE row), this removes the NUMBERING (which ranks ALL of them).
   * A withheld run must lose both, and one flag could not express that.
   */
  showOrdinal: boolean
}

/**
 * Shared row grid (prototype v6 two-line anatomy): badge · label · readout ·
 * chevron on the first implicit row, with the chart track on its OWN
 * full-width second row (col-start-2 spanning under label + readout), so
 * the range comparison is never squeezed between the label and the readout.
 * The axis header in AnalysisHeroPanel uses the same template so the track
 * columns align.
 */
export const HERO_ROW_GRID =
  'grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto_0.875rem] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 text-left'

/** The track's placement on the grid's second row (under label + readout). */
export const HERO_ROW_TRACK_SPAN = 'col-start-2 col-span-3'

/**
 * Range-bar fills — SOLID semantic light tokens, deliberately not opacity
 * modifiers: the theme colours are plain `var(--x)` values, so Tailwind
 * CANNOT generate `bg-option/40`-style classes (it silently emits nothing
 * and the bar renders transparent — the staging "invisible bars" defect).
 * These exact class strings are compile-checked by
 * __tests__/chartClassesCompile.spec.ts; change them only in lockstep.
 * Mapping follows the prototype: option-soft → option-light (rows),
 * lead-fill → info-light (leader).
 *
 * DS note (deliberate, flagged in the PR): the written light-shade rule
 * scopes `-light` to canvas node fills and panel entity-hover. A chart
 * data-mark fill is the closest analogue of a canvas node fill and is the
 * ONLY existing-token treatment that both compiles and stays visible —
 * `bg-panel` is invisible on the panel and the main shades would drown the
 * centre dot. Prototype-mapped exception pending a DS-owner ruling
 * (issue 222).
 */
export const HERO_BAR_FILL = {
  // eslint-disable-next-line brand-tokens/no-bare-light-bg -- chart data-mark fill, not a card/banner/pill: prototype-mapped DS exception pending owner ruling (issue 222)
  leader: 'bg-info-light',
  // eslint-disable-next-line brand-tokens/no-bare-light-bg -- chart data-mark fill, not a card/banner/pill: prototype-mapped DS exception pending owner ruling (issue 222)
  rest: 'bg-option-light',
} as const

/** Dot fills (no opacity modifiers — same compile guarantee). */
export const HERO_DOT_FILL = {
  leader: 'bg-primary',
  rest: 'bg-option',
} as const

/**
 * Number-token border for non-leader rows — `border-option-light`, NOT the
 * original `border-option/40`: opacity-modifier classes on these theme
 * colours do not compile (see above), so the /40 border silently rendered
 * as the default border colour. Compile-checked alongside the fills.
 */
export const HERO_TOKEN_BORDER = 'border-option-light'

/**
 * UI-SEM-055: track position clamp to [0, 100]% of the track width.
 * Layout maths only — positions bars/dots on the fixed track; the clamped
 * percentage is never displayed as data, never described semantically, and
 * never fed back into selection logic (readouts always show the unclamped
 * source values).
 */
function trackPct(fraction: number): number {
  return Math.max(0, Math.min(100, fraction * 100))
}

export function HeroOptionRow({
  row,
  lens,
  isLeader,
  isOpen,
  onToggle,
  outcomeDomain,
  showOrdinal,
}: HeroOptionRowProps) {
  const regionId = useId()
  const labelId = useId()

  // Full-label recovery gate: the opened detail repeats the option name
  // ONLY when the two-line clamp actually clips it (an unclipped name would
  // be pure duplication). Measured when the label or disclosure changes and
  // on real size changes via ResizeObserver — never on every commit (a
  // per-commit scrollHeight read forces synchronous reflow; review fix).
  // The default is TRUE (show) so environments without layout boxes (jsdom
  // reports 0/0) fail safe — the full name is never withheld when in doubt.
  const labelRef = useRef<HTMLSpanElement>(null)
  const [labelClipped, setLabelClipped] = useState(true)
  // isOpen is a deliberate re-measure trigger (the moment the detail opens
  // is when the answer matters), not a value the effect reads.
  useEffect(() => {
    const el = labelRef.current
    if (!el) return
    const measure = () => {
      if (el.scrollHeight === 0 && el.clientHeight === 0) return
      setLabelClipped(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [row.label, isOpen])

  // Per-lens layout positions (percent of track width). null → hidden.
  // The GOAL lens draws NO track at all (prototype v6: badge + label +
  // probability readout only — a probability is not a range, and the bar
  // treatment made the goal lens visually identical to a range chart it is
  // not). Ghost marks (previous run) draw only on the What-changed lens and
  // only when the model carries producer previous values — never UI-diffed.
  let barStart: number | null = null
  let barEnd: number | null = null
  let dotPos: number | null = null
  let ghostBarStart: number | null = null
  let ghostBarEnd: number | null = null
  let ghostDotPos: number | null = null
  if (lens === 'stability') {
    if (row.stability?.value != null) {
      barStart = 0
      barEnd = trackPct(row.stability.value)
      dotPos = barEnd
    }
  } else if (lens !== 'goal' && outcomeDomain) {
    const span = outcomeDomain.max - outcomeDomain.min
    const pos = (v: number) => trackPct((v - outcomeDomain.min) / span)
    if (row.outcome.p10 != null && row.outcome.p90 != null) {
      barStart = pos(row.outcome.p10)
      barEnd = pos(row.outcome.p90)
    }
    if (row.outcome.centre != null) dotPos = pos(row.outcome.centre)
    if (lens === 'whatChanged' && row.outcome.previous) {
      const prev = row.outcome.previous
      if (prev.p10 != null && prev.p90 != null) {
        ghostBarStart = pos(prev.p10)
        ghostBarEnd = pos(prev.p90)
      }
      if (prev.centre != null) ghostDotPos = pos(prev.centre)
    }
  }

  const readout =
    lens === 'goal'
      ? row.goal.readout
      : lens === 'stability'
        ? (row.stability?.readout ?? HERO_COPY.readout.missing)
        : lens === 'whatChanged'
          ? (row.changeReadout ?? row.outcome.readout)
          : row.outcome.readout

  // Expanded-row affordance policy: a chevron promises more than one line.
  // Rows whose ONLY detail is the win probability are not expandable —
  // the win line renders as persistent meta under the row instead, so the
  // information survives without a hollow disclosure. `beyondWin` derives
  // from the detail object itself (not a hand-kept field list), so a new
  // detail line can never silently strand a row as non-expandable.
  // It renders on either lens (matching the opened detail, which is
  // lens-independent).
  const { winChance, ...beyondWin } = row.detail
  const hasDetailBeyondWin = Object.values(beyondWin).some(Boolean)
  const expandable = hasDetailBeyondWin
  const winOnlyMeta = !hasDetailBeyondWin && winChance
  const Chevron = isOpen ? ChevronDown : ChevronRight

  // The goal lens draws no track row at all (prototype v6 goal table).
  const drawsTrack = lens !== 'goal'

  const rowGrid = (
    <>
      {/* Row 1: badge · label · readout · chevron. Badge geometry follows
          the prototype (24×24, 7px radius); leader = filled info-blue with
          white numeral, others outlined.

          ROADMAP 1.267: on a withheld run the numeral is a DESIGNATION
          (`stableNumber ?? index` is seeded from the probability order, so
          "1" is `rank == 1`) and is not drawn. The 1.5rem grid cell is still
          occupied by an empty placeholder — the row grid is
          `grid-cols-[1.5rem_…]`, so omitting the element outright would slide
          the label into the badge column and silently re-lay-out every row.
          Suppress the claim, not the layout. */}
      {showOrdinal ? (
        <span
          aria-hidden="true"
          data-testid="hero-row-number"
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-[7px] ${typography.panelMeta} ${
            isLeader
              ? 'bg-primary text-text-on-color'
              : `border ${HERO_TOKEN_BORDER} bg-transparent text-text-body`
          }`}
        >
          {row.stableNumber ?? row.index}
        </span>
      ) : (
        <span aria-hidden="true" className="h-6 w-6 flex-none" />
      )}
      <span
        id={labelId}
        ref={labelRef}
        title={row.label}
        data-testid="hero-row-label"
        className={`${typography.panelBody} min-w-0 break-words text-left text-text-header line-clamp-2`}
      >
        {row.label}
        {isLeader && <span className="sr-only"> ({HERO_COPY.srLeader})</span>}
      </span>

      <span
        className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
      >
        <span className={isLeader ? 'text-text-header' : 'text-text-body'}>{readout}</span>
      </span>
      {/* Chevron slot is reserved on every row (invisible when static) so the
          readout column stays aligned across the list. */}
      <Chevron
        aria-hidden="true"
        className={`h-3.5 w-3.5 flex-none text-text-light ${expandable ? '' : 'invisible'}`}
      />

      {/* Row 2 (own full-width grid row, indented past the badge): the chart
          track — layout-only positions, transform/opacity animation. The
          goal lens draws no track (readout-only table, prototype v6). */}
      {drawsTrack && (
        <span aria-hidden="true" className={`${HERO_ROW_TRACK_SPAN} relative block h-5 min-w-0`}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-panel-border" />
        {/* Ghost marks (previous run, What-changed lens only): faded copies
            of the same bar/dot geometry from producer previous values —
            static, behind the current marks, never UI-diffed. */}
        {ghostBarStart != null && ghostBarEnd != null && (
          <span
            data-testid="hero-ghost-bar"
            className={`absolute left-0 h-2.5 w-full rounded-full opacity-40 ${
              isLeader ? HERO_BAR_FILL.leader : HERO_BAR_FILL.rest
            }`}
            style={{
              top: 'calc(50% - 5px)',
              transformOrigin: 'left',
              transform: `translateX(${ghostBarStart}%) scaleX(${
                Math.max(ghostBarEnd - ghostBarStart, 0) / 100
              })`,
            }}
          />
        )}
        {ghostDotPos != null && (
          <span className="absolute inset-0 opacity-40" style={{ transform: `translateX(${ghostDotPos}%)` }}>
            <span
              data-testid="hero-ghost-dot"
              className={`absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel ${
                isLeader ? HERO_DOT_FILL.leader : HERO_DOT_FILL.rest
              }`}
            />
          </span>
        )}
        {/* Range / probability bar: full-width element scaled from the left.
            Solid light-token fill (HERO_BAR_FILL) — opacity-modifier classes
            do not compile with this theme and render transparent. */}
        <span
          data-testid="hero-range-bar"
          data-visible={barStart != null && barEnd != null ? 'true' : 'false'}
          className={`absolute left-0 h-2.5 w-full rounded-full transition-transform motion-reduce:transition-none ${
            isLeader ? HERO_BAR_FILL.leader : HERO_BAR_FILL.rest
          }`}
          style={{
            top: 'calc(50% - 5px)',
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
              className={`absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel ${
                isLeader ? HERO_DOT_FILL.leader : HERO_DOT_FILL.rest
              }`}
            />
          </span>
        </span>
      )}
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
          className="space-y-1 pb-2 pl-10 pr-2 pt-0.5"
        >
          {/* Full, unclamped option name — recovered in place ONLY when the
              two-line clamp actually clips the visible label (labelClipped,
              measured; defaults to shown when layout cannot be read).
              aria-hidden: the region is already labelled by the row label
              (aria-labelledby), so screen readers would otherwise announce
              the name twice. */}
          {labelClipped && (
            <p
              aria-hidden="true"
              className={`${typography.panelBody} text-text-header`}
              data-testid="hero-detail-label"
            >
              {row.label}
            </p>
          )}
          {row.detail.why && (
            <p className={`${typography.panelBody} text-text-body`} data-testid="hero-detail-why">
              <span className="text-text-header">
                {HERO_COPY.detail.whyLabel}
              </span>{' '}
              {row.detail.why}
            </p>
          )}
          {/* Watch / Trade-off — producer-narrative slots (issue 217):
              content renders verbatim when the model carries it; the live
              adapter never populates these today. */}
          {row.detail.watch && (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-detail-watch"
            >
              <span className="text-text-header">{HERO_COPY.detail.watchLabel}</span>{' '}
              {row.detail.watch}
            </p>
          )}
          {row.detail.tradeOff && (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-detail-trade-off"
            >
              <span className="text-text-header">{HERO_COPY.detail.tradeOffLabel}</span>{' '}
              {row.detail.tradeOff}
            </p>
          )}
          {row.detail.range && (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-detail-range"
            >
              {row.detail.range}
            </p>
          )}
          {row.detail.goalFit && (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-detail-goal-fit"
            >
              {row.detail.goalFit}
            </p>
          )}
          {/* Display-honesty (ROADMAP 1.6b follow-up, claim-integrity):
              modelled-basis caveat, rendered adjacent to the goalFit line it
              qualifies — never separately. Same shared wording OptionCards'
              caveat uses (GOAL_FIT_BASIS_CAVEAT_COPY, via buildHeroModel). */}
          {row.detail.goalFitCaveat && (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="hero-detail-goal-fit-caveat"
            >
              {row.detail.goalFitCaveat}
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

      {/* Win-only rows: the chevron is withheld (one line is not a
          disclosure), and the win probability renders as persistent meta
          so the information is not lost. */}
      {winOnlyMeta && (
        <p
          className={`${typography.panelMeta} pb-1.5 pl-10 pr-2 text-text-light`}
          data-testid="hero-win-meta"
        >
          {row.detail.winChance}
        </p>
      )}
    </div>
  )
}

export default HeroOptionRow
