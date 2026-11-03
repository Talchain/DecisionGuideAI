/**
 * Each option's lines from the Run, drawn from the View (olumi.view/2) on the olumi-core lane, in place of the adapter-fed
 * `ViewOnlyRunChancesBlock`. Every word is core's, drawn exactly as it arrives: the option's heading, then each row (a chance with its
 * aim, its approximate mark and Olumi's marks, a limit, or why there is nothing yet), with core's hover. Nothing is composed, rounded or reordered
 * here, and the band is not drawn yet (a v10 slice).
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows, so a test can bind every element to its own
 * value by identity (design §3).
 */
import type { ViewCard, ViewModel, ViewRow, ViewRun } from './client'
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
          <Mark at={`${at}.olumi`} mark={row.olumi} />
        </div>
      )
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as the base dock did (00058 P1)
      return row.text == null
        ? <div data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></div>
        : <div title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span></div>
  }
}

type WaitsOn = NonNullable<ViewRun['waits_on']>

/** What the chances wait on, each item core's `‘label’` with its hover; a figure no one can size yet says so in the headline only. */
function WaitsOnItems({ w, unknown }: { w: WaitsOn; unknown: boolean }) {
  return (
    <>
      {w.items.map((it, i) => (
        <span key={it.id} title={it.title}>
          <span data-view={`run.waits_on.items.${i}.text`}>{it.text}</span>
          {unknown && it.unknown !== null ? <span data-view={`run.waits_on.items.${i}.unknown`}>{it.unknown}</span> : null}
          {i < w.items.length - 1 ? ', ' : null}
        </span>
      ))}
    </>
  )
}

/**
 * The lines for one View model: pure, so a test draws it from a golden View. As the base dock (ViewOnlyRunChancesBlock): the Run's lead,
 * then, when every option waits (`all_withheld`), the waits-on headline; each option with its lines and what moves its chance most; the
 * most likely option; the notes; and, when not every option waits, what the chances wait on. Every word is the View's.
 */
export function ViewChances({ model }: { model: ViewModel }) {
  const run = model.run ?? null // absent from a core before view-dock (00058 P1)
  const headline = run !== null && run.all_withheld && run.waits_on !== null
  return (
    <div className={`${typography.panelBody} space-y-3`} data-testid="view-chances">
      {run?.lead == null ? null : <p data-view="run.lead">{run.lead}</p>}
      {!headline ? null : (
        <div data-testid="view-run-waits-headline">
          <p className={typography.panelMeta} data-view="run.waits_on.head">{run.waits_on!.head}</p>
          <p><span data-view="run.waits_on.text">{run.waits_on!.text}</span>{': '}<WaitsOnItems w={run.waits_on!} unknown /></p>
        </div>
      )}
      {optionCards(model).map((card) => (
        <div key={card.id} data-view-card={card.id}>
          <div className={typography.panelHeader} data-view={`${card.id}.heading`}>{card.heading}</div>
          {card.rows.map((row, i) => <Row key={i} card={card} row={row} i={i} />)}
          {card.driver == null ? null : <p className={typography.panelMeta} title={card.driver.title} data-view={`${card.id}.driver.text`}>{card.driver.text}</p>}
        </div>
      ))}
      {run?.most_likely == null ? null : <p title={run.most_likely.title} data-view="run.most_likely.text">{run.most_likely.text}</p>}
      {run === null || run.notes.length === 0 ? null : (
        <div data-testid="view-run-notes">
          {run.notes.map((n, i) => <p key={i} className={typography.panelMeta} title={n.title} data-view={`run.notes.${i}.text`}>{n.text}</p>)}
        </div>
      )}
      {run === null || run.waits_on === null || headline ? null : (
        <p data-testid="view-run-waits-on"><span data-view="run.waits_on.label">{run.waits_on.label}</span>{' '}<WaitsOnItems w={run.waits_on} unknown={false} /></p>
      )}
    </div>
  )
}

/** The block on the olumi-core lane: the page's View of the approved model, or nothing while none is current (`currentModel`). */
export function ViewChancesBlock() {
  const model = useViewStore(currentModel)
  return model === null ? null : <ViewChances model={model} />
}
