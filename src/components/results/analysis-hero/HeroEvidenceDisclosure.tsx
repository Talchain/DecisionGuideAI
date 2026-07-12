/**
 * HeroEvidenceDisclosure — §6.6's one expandable evidence section:
 * "Why and what could change it", hosting three views.
 *
 * - Drivers: producer rank order, top three with See all factors/Show
 *   fewer; rows focus the factor on canvas when a target exists.
 *   Evidence-quality wording is deliberately absent live (no display-safe
 *   producer contract — same class as the hidden DriversSection quality
 *   hint); the slot returns with the producer signal.
 * - Flip risks: plain-language consequences pre-built by buildHeroModel
 *   from producer flipThresholds (user units, named alternative winner,
 *   no normalised internals).
 * - Trade-offs: renders ONLY when the model carries a producer/reviewed
 *   narrative (null live — the UI must not invent trade-offs), so the
 *   tab is fixture-gallery-only today.
 *
 * Presentational: no store access; focus is the container's callback.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Crosshair } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { HERO_COPY } from './heroCopy'
import type { HeroEvidenceModel } from './heroTypes'

const VISIBLE_DRIVERS = 3

type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs'

export interface HeroEvidenceDisclosureProps {
  evidence: HeroEvidenceModel
  onFocusTarget?: (targetId: string) => void
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

  const Chevron = open ? ChevronDown : ChevronRight

  const focusRow = (label: string, targetId: string | null, key: string) =>
    targetId && onFocusTarget ? (
      <button
        key={key}
        type="button"
        onClick={() => onFocusTarget(targetId)}
        className={`${typography.panelBody} flex w-full items-start gap-1.5 text-left text-text-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        <Crosshair aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-info" />
        <span>{label}</span>
      </button>
    ) : (
      <p key={key} className={`${typography.panelBody} text-text-body`}>
        {label}
      </p>
    )

  return (
    <div className="border-t border-panel-border pt-2" data-testid="hero-evidence-disclosure">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${typography.panelBody} inline-flex items-center gap-1.5 text-text-header hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        <Chevron aria-hidden="true" className="h-3.5 w-3.5 flex-none text-text-light" />
        {HERO_COPY.evidence.heading}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {views.length > 1 && (
            <div role="tablist" className="flex gap-1">
              {views.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={activeView === v.key}
                  onClick={() => setView(v.key)}
                  className={`px-2 py-0.5 rounded-full ${typography.panelMeta} border bg-transparent ${
                    activeView === v.key
                      ? 'border-info/60 text-info'
                      : 'border-panel-border text-text-light hover:border-info/30 hover:text-text-body'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {activeView === 'drivers' && (
            <div className="space-y-1.5" data-testid="hero-evidence-drivers">
              {visibleDrivers.map((d) =>
                focusRow(d.label, d.targetId, `driver-${d.rank}-${d.label}`),
              )}
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
              {evidence.flipRisks.map((r, i) => focusRow(r.text, r.targetId, `flip-${i}`))}
            </div>
          )}

          {activeView === 'tradeOffs' && evidence.tradeOffs && (
            <div className="space-y-2" data-testid="hero-evidence-trade-offs">
              {evidence.tradeOffs.map((t) => (
                <div key={t.option} className="space-y-0.5">
                  <p className={`${typography.panelBody} text-text-header`}>{t.option}</p>
                  <p className={`${typography.panelBody} text-text-body`}>
                    {HERO_COPY.evidence.tradeOffGain}: {t.gain}
                  </p>
                  <p className={`${typography.panelBody} text-text-body`}>
                    {HERO_COPY.evidence.tradeOffGiveUp}: {t.giveUp}
                  </p>
                  <p className={`${typography.panelBody} text-text-body`}>
                    {HERO_COPY.evidence.tradeOffDependsOn}: {t.dependsOn}
                  </p>
                  <p className={`${typography.panelBody} text-text-body`}>
                    {HERO_COPY.evidence.tradeOffWatch}: {t.watch}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
