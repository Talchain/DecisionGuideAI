/**
 * HeroEvidenceDisclosure — §6.6's one expandable evidence section:
 * "Why and what could change it", hosting three views.
 *
 * Toggle anatomy (prototype §3): a full-width row button — bold title
 * stacked over the 'Drivers, flip risks and trade-offs' subtitle, grow
 * spacer, trailing chevron rotating 180° when open (reduced-motion safe),
 * row hover background.
 *
 * - Drivers: producer rank order, top three with See all factors/Show
 *   fewer; rows carry the +/- direction sign (producer direction, omitted
 *   when absent) and a 6px influence magnitude bar (the SAME displayed
 *   metric DriversSection renders — UI-SEM-080 layout mapping); rows focus
 *   the factor on canvas when a target exists. Evidence-quality wording is
 *   deliberately absent live (no display-safe producer contract — same
 *   class as the hidden DriversSection quality hint); the slot returns
 *   with the producer signal.
 * - Flip risks: plain-language consequences pre-built by buildHeroModel
 *   from producer flipThresholds (user units, named alternative winner,
 *   no normalised internals), with the producer switch probability as the
 *   row meta ('48% switch') and magnitude bar where the fragile-edge join
 *   found one.
 * - Trade-offs: renders ONLY when the model carries a producer/reviewed
 *   narrative (null live — the UI must not invent trade-offs), so the
 *   tab is fixture-gallery-only today. Grid layout per prototype: a 2×2
 *   grid of bordered cells (de-emphasised label over value).
 *
 * Presentational: no store access; focus is the container's callback.
 */
import { useState } from 'react'
import { ChevronDown, Crosshair } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { HERO_COPY } from './heroCopy'
import type { HeroEvidenceModel } from './heroTypes'

const VISIBLE_DRIVERS = 3

type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs'

export interface HeroEvidenceDisclosureProps {
  evidence: HeroEvidenceModel
  onFocusTarget?: (targetId: string) => void
}

/**
 * UI-SEM-080 (layout half): magnitude-bar width from an existing 0-1
 * producer-backed fraction (displayed influence / switch probability),
 * clamped to [0, 100]%. Layout only — the percentage is never displayed as
 * data, never described semantically, and never fed back into selection.
 */
function barPct(fraction: number): number {
  return Math.max(0, Math.min(100, fraction * 100))
}

/** 6px magnitude bar (prototype .evidence-bar): border-default track, info fill. */
function MagnitudeBar({ fraction, testId }: { fraction: number; testId: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="block h-1.5 w-full overflow-hidden rounded-full bg-panel-border"
    >
      <span
        className="block h-full rounded-full bg-info"
        style={{ width: `${barPct(fraction)}%` }}
      />
    </span>
  )
}

export function HeroEvidenceDisclosure({
  evidence,
  onFocusTarget,
}: HeroEvidenceDisclosureProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<EvidenceView>('drivers')
  const [showAllDrivers, setShowAllDrivers] = useState(false)

  const hasDrivers = evidence.drivers.length > 0
  const hasFlipRisks = evidence.flipRisks.length > 0
  const hasTradeOffs = evidence.tradeOffs != null && evidence.tradeOffs.length > 0
  if (!hasDrivers && !hasFlipRisks && !hasTradeOffs) return null

  const views = (
    [
      { key: 'drivers', label: HERO_COPY.evidence.driversTab, present: hasDrivers },
      { key: 'flipRisks', label: HERO_COPY.evidence.flipRisksTab, present: hasFlipRisks },
      { key: 'tradeOffs', label: HERO_COPY.evidence.tradeOffsTab, present: hasTradeOffs },
    ] satisfies Array<{ key: EvidenceView; label: string; present: boolean }>
  ).filter((v) => v.present)
  const activeView = views.some((v) => v.key === view) ? view : views[0].key

  const visibleDrivers = showAllDrivers
    ? evidence.drivers
    : evidence.drivers.slice(0, VISIBLE_DRIVERS)

  /** Driver row body: sign + label, then the magnitude bar. */
  const driverRowBody = (d: HeroEvidenceModel['drivers'][number]) => (
    <>
      <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-text-body`}>
        {onFocusTarget && d.targetId != null && (
          <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
        )}
        {d.direction != null && (
          <span
            data-testid="hero-driver-sign"
            aria-hidden="true"
            className={`font-semibold ${d.direction === 'positive' ? 'text-success' : 'text-danger'}`}
          >
            {d.direction === 'positive' ? '+' : '-'}
          </span>
        )}
        <span className="min-w-0 truncate text-left">{d.label}</span>
        {/* Direction perceivable without the sign glyph/colour. */}
        {d.direction != null && (
          <span className="sr-only">
            ({d.direction === 'positive' ? 'increases the outcome' : 'decreases the outcome'})
          </span>
        )}
      </span>
      {d.influence != null ? (
        <MagnitudeBar fraction={d.influence} testId="hero-driver-bar" />
      ) : (
        <span />
      )}
    </>
  )

  /** Flip row body: consequence sentence, bar, switch meta. */
  const flipRowBody = (r: HeroEvidenceModel['flipRisks'][number]) => (
    <>
      <span className={`${typography.panelBody} flex min-w-0 items-start gap-1.5 text-left text-text-body`}>
        {onFocusTarget && r.targetId != null && (
          <Crosshair aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none text-info" />
        )}
        <span className="min-w-0">{r.text}</span>
      </span>
      {r.magnitude != null ? (
        <MagnitudeBar fraction={r.magnitude} testId="hero-flip-bar" />
      ) : (
        <span />
      )}
      {r.switchMeta != null ? (
        <span
          data-testid="hero-flip-switch-meta"
          className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
        >
          {r.switchMeta}
        </span>
      ) : (
        <span />
      )}
    </>
  )

  return (
    <div className="border-t border-panel-border pt-1" data-testid="hero-evidence-disclosure">
      {/* Full-width toggle row (prototype §3): stacked title + subtitle,
          spacer, trailing chevron rotating 180° when open. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>
            {HERO_COPY.evidence.heading}
          </span>
          <span className={`${typography.panelMeta} block text-text-light`}>
            {HERO_COPY.evidence.subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Plain toggle buttons, NOT role=tab: the ARIA tabs pattern
              promises arrow-key/roving-tabindex behaviour (HeroLensTabs
              implements it fully); claiming the role without the keyboard
              model would mislead AT users. Selected state uses the
              HeroLensTabs treatment (bg-primary), not a filled pill. */}
          {views.length > 1 && (
            <div className="flex gap-1">
              {views.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={activeView === v.key}
                  onClick={() => setView(v.key)}
                  className={`px-2 py-0.5 rounded-full ${typography.panelMeta} ${
                    activeView === v.key
                      ? 'bg-primary text-text-on-color'
                      : 'border border-panel-border bg-transparent text-text-light hover:border-info/30 hover:text-text-body'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {activeView === 'drivers' && (
            <div className="space-y-1.5" data-testid="hero-evidence-drivers">
              <p className={`${typography.panelMeta} text-text-light`}>
                {HERO_COPY.evidence.driversNote}
              </p>
              {visibleDrivers.map((d) => {
                const key = `driver-${d.rank}-${d.label}`
                const grid = 'grid w-full grid-cols-[minmax(0,1fr)_5rem] items-center gap-2'
                return d.targetId != null && onFocusTarget ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFocusTarget(d.targetId!)}
                    className={`${grid} rounded py-0.5 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  >
                    {driverRowBody(d)}
                  </button>
                ) : (
                  <div key={key} className={`${grid} py-0.5`}>
                    {driverRowBody(d)}
                  </div>
                )
              })}
              {evidence.drivers.length > VISIBLE_DRIVERS && (
                <button
                  type="button"
                  onClick={() => setShowAllDrivers((s) => !s)}
                  className={`${typography.panelMeta} text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                >
                  {showAllDrivers
                    ? HERO_COPY.evidence.showFewer
                    : HERO_COPY.evidence.seeAllFactors}
                </button>
              )}
            </div>
          )}

          {activeView === 'flipRisks' && (
            <div className="space-y-1.5" data-testid="hero-evidence-flip-risks">
              <p className={`${typography.panelMeta} text-text-light`}>
                {HERO_COPY.evidence.flipRisksNote(evidence.designationsWithheld)}
              </p>
              {evidence.flipRisks.map((r, i) => {
                const key = `flip-${i}`
                const grid =
                  'grid w-full grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2'
                return r.targetId != null && onFocusTarget ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFocusTarget(r.targetId!)}
                    className={`${grid} rounded py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  >
                    {flipRowBody(r)}
                  </button>
                ) : (
                  <div key={key} className={`${grid} py-0.5`}>
                    {flipRowBody(r)}
                  </div>
                )
              })}
            </div>
          )}

          {activeView === 'tradeOffs' && evidence.tradeOffs && (
            <div className="space-y-2" data-testid="hero-evidence-trade-offs">
              {evidence.tradeOffs.map((t) => (
                <div key={t.option} className="space-y-1">
                  <p className={`${typography.panelBody} font-semibold text-text-header`}>
                    {t.option}
                  </p>
                  {/* Prototype .trade-grid: 2×2 bordered cells, de-emphasised
                      label over the value. */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        [HERO_COPY.evidence.tradeOffGain, t.gain],
                        [HERO_COPY.evidence.tradeOffGiveUp, t.giveUp],
                        [HERO_COPY.evidence.tradeOffDependsOn, t.dependsOn],
                        [HERO_COPY.evidence.tradeOffWatch, t.watch],
                      ] as const
                    ).map(([cellLabel, value]) => (
                      <div
                        key={cellLabel}
                        className="rounded-lg border border-panel-border p-1.5"
                      >
                        <p className={`${typography.panelMeta} text-text-light`}>{cellLabel}</p>
                        <p className={`${typography.panelBody} mt-0.5 text-text-body`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
