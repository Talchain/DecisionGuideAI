/**
 * Each option's lines from the Run, drawn from the View (olumi.view/2) on the olumi-core lane, in place of the adapter-fed
 * `ViewOnlyRunChancesBlock`. Every word is core's, drawn exactly as it arrives: the option's heading, then each row (a chance with its
 * aim, its approximate mark and Olumi's marks, a limit, a route, or why there is nothing yet), with core's hover. Nothing is composed, rounded or reordered
 * here, and the band is not drawn yet (a v10 slice).
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows, so a test can bind every element to its own
 * value by identity (design §3).
 */
import type { ViewCard, ViewModel, ViewRow } from './client'
import { optionCards } from './layout'
import { currentModel, useViewStore } from './store'
import { typography } from '../styles/typography'

function Mark({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) {
  return mark === null ? null : <span data-view={`${at}.glyph`} title={mark.title} aria-label={mark.title}>{mark.glyph}</span>
}

export function Row({ card, row, i }: { card: ViewCard; row: ViewRow; i: number }) {
  const at = `${card.id}.rows.${i}`
  switch (row.kind) {
    case 'chance':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          <span className={typography.panelTabular}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span></span>
          <Mark at={`${at}.olumi`} mark={row.olumi} />
          <Mark at={`${at}.likely`} mark={row.likely} />
        </div>
      )
    case 'limit':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          <span className={typography.panelTabular} data-view={`${at}.value`}>{row.value}</span>
        </div>
      )
    case 'route':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.glyph`}>{row.glyph}</span>
          <span data-view={`${at}.aim`}>{row.aim}</span>
        </div>
      )
    case 'none':
      return <div data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></div>
  }
}

/** The lines for one View model: pure, so a test draws it from a golden View. */
export function ViewChances({ model }: { model: ViewModel }) {
  return (
    <div className={`${typography.panelBody} space-y-3`} data-testid="view-chances">
      {optionCards(model).map((card) => (
        <div key={card.id} data-view-card={card.id}>
          <div className={typography.panelHeader} data-view={`${card.id}.heading`}>{card.heading}</div>
          {card.rows.map((row, i) => <Row key={i} card={card} row={row} i={i} />)}
        </div>
      ))}
    </div>
  )
}

/** The block on the olumi-core lane: the page's View of the approved model, or nothing while none is current (`currentModel`). */
export function ViewChancesBlock() {
  const model = useViewStore(currentModel)
  return model === null ? null : <ViewChances model={model} />
}
