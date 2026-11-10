import { useId } from 'react'
import type { ViewModel } from '../client'
import { useViewStore } from '../store'
import { driverRange } from '../ViewChances'
import { driverRowOf, leadAimOf, trackPct } from './pick'
import { TYPE } from './type'

/** A common chance axis makes core's driver ranges comparable without ranking the options. A thin span between two endpoints (ring: the
 *  figure low; dot: the figure high), so the ends read as marks and not as a lump on the bar. */
export function DriverTornado({ model }: { model: ViewModel }) {
  const heading = useViewStore((s) => s.view?.lens_words?.label.what_changes ?? null)
  const headingId = useId()
  const aim = leadAimOf(model)
  const rows = model.cards.flatMap((card) => {
    if (card.family !== 'option') return []
    // Core's per-aim driver (`rows[].driver`, olumi.view/3 at core 69dc9442): the row for the aim being shown, never another aim's. A card
    // none of whose chance rows carries the key (a scenario saved before it) falls back to the card's one driver and its first chance row.
    const keyed = card.rows.some((r) => r.kind === 'chance' && r.driver !== undefined)
    if (keyed && aim !== null) {
      const own = card.rows.find((r) => r.kind === 'chance' && r.aim_id === aim)
      if (own?.kind !== 'chance' || own.driver == null) return []
      const range = driverRange({ low: own.driver.low, high: own.driver.high })
      return range === null ? [] : [{ card, figureId: own.driver.figure as string | null, label: null as string | null, title: null as string | null, chance: own.chance, range }]
    }
    if (card.driver == null) return []
    const range = driverRange(card.driver)
    const row = card.rows[driverRowOf(card)]
    return range === null ? [] : [{ card, figureId: card.driver.figure, label: card.driver.text as string | null, title: card.driver.title as string | null, chance: row?.kind === 'chance' ? row.chance : null, range }]
  })
  if (rows.length < 2) return null

  return (
    <div role="group" data-testid="port-driver-tornado"
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : rows[0]!.title ?? rows[0]!.card.heading}
      className="space-y-3 rounded-lg border border-panel-border bg-panel p-3 text-text-body">
      {heading ? <h3 id={headingId} className={`${TYPE.body} font-medium text-text-header`} data-view="lens_words.label.what_changes">{heading}</h3> : null}
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute inset-y-0 left-0 w-px bg-panel-border" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-panel-border" />
          <span className="absolute inset-y-0 left-full w-px bg-panel-border" />
        </div>
        <div className="relative space-y-4">
          {rows.map(({ card, figureId, label, title, chance, range }) => {
            const tick = chance == null || !Number.isFinite(chance) ? null : trackPct(chance)
            // The figure whose low and high the bar spans, by core's own name for it.
            const figure = figureId === null ? null : model.cards.find((c) => c.id === figureId)
            const left = Math.min(range.lowPct, range.highPct)
            const width = Math.abs(range.highPct - range.lowPct)
            return (
              <div key={card.id} data-tornado-row={card.id} className="space-y-2">
                <p className={`${TYPE.body} relative break-words bg-panel font-medium text-text-header`} data-view={`${card.id}.heading`}>{card.heading}</p>
                {/* The sentence is said once, under the option's own row (SC-02): here it names the bar for a screen reader and on hover. */}
                <div role="img" aria-label={label ?? figure?.heading ?? card.heading} title={title ?? undefined} className="relative h-3" data-testid="port-driver-tornado-track">
                  <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-option" style={{ left: `${left}%`, width: `${width}%` }} data-testid="port-driver-tornado-bar" />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-option bg-panel" style={{ left: `${range.lowPct}%` }} data-testid="port-driver-tornado-low" />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-option" style={{ left: `${range.highPct}%` }} data-testid="port-driver-tornado-high" />
                  {tick === null ? null : <span className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${tick}%`, background: 'var(--text-header)' }} data-testid="port-driver-tornado-chance" />}
                </div>
                {figure == null ? null : <p className={`${TYPE.meta} relative break-words bg-panel text-text-body`} data-view={`${figure.id}.heading`} data-testid="port-driver-tornado-figure">{figure.heading}</p>}
              </div>
            )
          })}
        </div>
      </div>
      <div className={`${TYPE.meta} relative h-5 text-text-body`} data-testid="port-driver-tornado-axis">
        <span className="absolute left-0">0%</span>
        <span className="absolute left-1/2 -translate-x-1/2">50%</span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  )
}
